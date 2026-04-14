"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { useSession } from "@/lib/use-session";
import {
  applyAutonomyFavoriteRoutes,
  getUiAutonomyOverview,
  safeRecordUiSignal,
} from "@/lib/ui-autonomy";

const AUTONOMY_HIDDEN_ROUTES = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]);

const DOM_SCAN_DELAY_MS = 1_200;
const OVERVIEW_SYNC_DELAY_MS = 2_500;
const OVERVIEW_REFRESH_MS = 120_000;
const INTERACTION_THROTTLE_MS = 15_000;
const PERFORMANCE_THROTTLE_MS = 20_000;

function isVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function normalizeSignalKey(value: string, fallback: string) {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.slice(0, 80) || fallback;
}

function describeInteractiveTarget(target: HTMLElement | null) {
  if (!target) {
    return "unknown";
  }
  const hint =
    target.getAttribute("data-ui-autonomy") ||
    target.getAttribute("aria-label") ||
    target.getAttribute("title") ||
    target.textContent ||
    target.getAttribute("href") ||
    target.tagName;
  return normalizeSignalKey(hint || target.tagName, target.tagName.toLowerCase());
}

export function AutonomousUiAgent() {
  const pathname = usePathname() || "/";
  const { user, activeFactoryId, loading } = useSession();
  const issueSignalsRef = useRef<Set<string>>(new Set());
  const interactionRef = useRef<Map<string, number>>(new Map());
  const performanceRef = useRef(0);
  const enabled = Boolean(user?.id) && !loading && !AUTONOMY_HIDDEN_ROUTES.has(pathname);

  useEffect(() => {
    if (!enabled || !user) {
      return;
    }

    const startedAt = performance.now();
    let flushed = false;
    const flushVisit = (reason: string, keepalive = false) => {
      if (flushed) {
        return;
      }
      flushed = true;
      safeRecordUiSignal(
        {
          route: pathname,
          signal_type: "route_visit",
          signal_key: "route_dwell",
          duration_ms: Math.round(performance.now() - startedAt),
          payload: {
            reason,
            active_factory_id: activeFactoryId || null,
          },
        },
        { keepalive },
      );
    };

    const onPageHide = () => flushVisit("pagehide", true);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      flushVisit("route_change", true);
    };
  }, [activeFactoryId, enabled, pathname, user]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timer = window.setTimeout(() => {
      const doc = document.documentElement;
      const viewportHeight = window.innerHeight;
      const overflowPx = doc.scrollWidth - window.innerWidth;
      const routeIssuePrefix = `${pathname}:`;
      const emitIssue = (
        issueKey: string,
        severity: "high" | "medium" | "low",
        payload?: Record<string, string | number | boolean | null>,
      ) => {
        const dedupeKey = `${routeIssuePrefix}${issueKey}`;
        if (issueSignalsRef.current.has(dedupeKey)) {
          return;
        }
        issueSignalsRef.current.add(dedupeKey);
        safeRecordUiSignal({
          route: pathname,
          signal_type:
            issueKey === "long_task"
              ? "performance"
              : issueKey === "missing_primary_heading"
                ? "clarity"
                : issueKey === "crowded_above_fold"
                  ? "hierarchy"
                  : "layout",
          signal_key: issueKey,
          severity,
          payload,
        });
      };

      if (overflowPx > 4) {
        emitIssue("horizontal_overflow", "high", { overflow_px: Math.round(overflowPx) });
      }

      const pageHeading = document.querySelector("main h1, h1");
      if (!pageHeading) {
        emitIssue("missing_primary_heading", "medium");
      }

      const interactiveNodes = Array.from(
        document.querySelectorAll<HTMLElement>(
          "button, a[href], input:not([type='hidden']), select, textarea, [role='button']",
        ),
      ).filter(isVisible);

      const smallTargets = interactiveNodes.filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      });
      if (smallTargets.length >= 2) {
        emitIssue("tap_target_small", smallTargets.length >= 5 ? "high" : "medium", {
          count: smallTargets.length,
        });
      }

      const aboveFoldInteractiveCount = interactiveNodes.filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.top < viewportHeight && rect.bottom > 0;
      }).length;
      if (aboveFoldInteractiveCount >= 10) {
        emitIssue("crowded_above_fold", "medium", { count: aboveFoldInteractiveCount });
      }

      if (doc.scrollHeight > viewportHeight * 3) {
        emitIssue("long_page", "low", {
          scroll_height: doc.scrollHeight,
          viewport_height: viewportHeight,
        });
      }
    }, DOM_SCAN_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [enabled, pathname]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(
        "button, a[href], input, select, textarea, [role='button']",
      ) : null;
      if (!target || !isVisible(target)) {
        return;
      }
      const signalKey = describeInteractiveTarget(target);
      const dedupeKey = `${pathname}:${signalKey}`;
      const lastAt = interactionRef.current.get(dedupeKey) || 0;
      if (Date.now() - lastAt < INTERACTION_THROTTLE_MS) {
        return;
      }
      interactionRef.current.set(dedupeKey, Date.now());
      safeRecordUiSignal({
        route: pathname,
        signal_type: "interaction",
        signal_key: signalKey,
        payload: {
          tag: target.tagName.toLowerCase(),
        },
      });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [enabled, pathname]);

  useEffect(() => {
    if (!enabled || typeof PerformanceObserver === "undefined") {
      return;
    }
    if (!PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
      return;
    }

    const observer = new PerformanceObserver((list) => {
      const now = Date.now();
      if (now - performanceRef.current < PERFORMANCE_THROTTLE_MS) {
        return;
      }
      const entries = list.getEntries();
      const longest = entries.reduce((current, entry) => Math.max(current, entry.duration), 0);
      if (longest < 50) {
        return;
      }
      performanceRef.current = now;
      safeRecordUiSignal({
        route: pathname,
        signal_type: "performance",
        signal_key: "long_task",
        severity: longest >= 150 ? "high" : "medium",
        duration_ms: Math.round(longest),
        value: Math.round(longest),
      });
    });

    observer.observe({ entryTypes: ["longtask"] });
    return () => observer.disconnect();
  }, [enabled, pathname]);

  useEffect(() => {
    if (!enabled || !user) {
      return;
    }

    let cancelled = false;
    const syncOverview = async () => {
      const overview = await getUiAutonomyOverview();
      if (cancelled) {
        return;
      }
      const automaticRoutes = overview.preferences.find((item) => item.key === "priority_routes_auto");
      const routes =
        automaticRoutes &&
        automaticRoutes.value &&
        typeof automaticRoutes.value === "object" &&
        !Array.isArray(automaticRoutes.value) &&
        Array.isArray((automaticRoutes.value as { routes?: unknown[] }).routes)
          ? (automaticRoutes.value as { routes: unknown[] }).routes.filter(
              (item): item is string => typeof item === "string",
            )
          : [];
      if (routes.length > 0) {
        applyAutonomyFavoriteRoutes(routes, user.role);
      }
    };

    const initialTimer = window.setTimeout(() => {
      void syncOverview().catch(() => undefined);
    }, OVERVIEW_SYNC_DELAY_MS);
    const interval = window.setInterval(() => {
      void syncOverview().catch(() => undefined);
    }, OVERVIEW_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [enabled, pathname, user]);

  return null;
}
