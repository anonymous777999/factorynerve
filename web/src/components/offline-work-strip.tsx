"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { countQueuedEntries, loadDraft, subscribeToQueueUpdates } from "@/lib/offline-entries";
import { useNetworkStatus } from "@/lib/use-network-status";
import { useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";

type StripTone = "offline" | "queue" | "draft" | "slow";

type StripConfig = {
  title: string;
  detail: string;
  actionHref?: string;
  actionLabel?: string;
  tone: StripTone;
};

const HIDE_ROUTES = [
  "/",
  "/access",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/offline",
  "/entry",
  "/ocr/scan",
];

function shouldHide(pathname: string) {
  return HIDE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function canTrackLocalEntryWork(role?: string | null) {
  return ["operator", "supervisor", "manager", "admin", "owner"].includes(role || "");
}

function queueLabel(queueCount: number) {
  return `${queueCount} queued entr${queueCount === 1 ? "y" : "ies"}`;
}

function toneClassName(tone: StripTone) {
  if (tone === "offline") {
    return "border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.12)]";
  }
  if (tone === "slow") {
    return "border-[rgba(249,115,22,0.28)] bg-[rgba(249,115,22,0.12)]";
  }
  if (tone === "queue") {
    return "border-[rgba(56,189,248,0.28)] bg-[rgba(56,189,248,0.12)]";
  }
  return "border-[rgba(99,102,241,0.24)] bg-[rgba(99,102,241,0.12)]";
}

function buildStripConfig(
  pathname: string,
  online: boolean,
  constrained: boolean,
  effectiveType: string | null,
  queueCount: number,
  hasDraft: boolean,
): StripConfig | null {
  if (!online) {
    if (pathname.startsWith("/attendance")) {
      return {
        title: "Attendance is paused while offline",
        detail: "Punch in and punch out need a live connection. Reconnect before recording the next attendance action.",
        actionHref: "/dashboard",
        actionLabel: "Open dashboard",
        tone: "offline",
      };
    }
    if (pathname.startsWith("/work-queue") || pathname.startsWith("/approvals") || pathname.startsWith("/reports")) {
      return {
        title: "Live queue data is paused offline",
        detail: "Unread alerts, approvals, and reports need a connection. Local drafts and queued entries still stay on this device.",
        actionHref: queueCount > 0 || hasDraft ? "/entry?focus=offline" : undefined,
        actionLabel: queueCount > 0 ? "Open entry queue" : hasDraft ? "Open saved draft" : undefined,
        tone: "offline",
      };
    }
    return {
      title: "FactoryNerve is offline",
      detail:
        queueCount > 0
          ? `${queueLabel(queueCount)} will sync automatically when the network returns.`
          : hasDraft
            ? "This browser still has a saved shift draft. Reconnect and open Shift Entry to finish it."
            : "Reconnect to refresh live factory data and continue online-only actions.",
      actionHref: queueCount > 0 || hasDraft ? "/entry?focus=offline" : undefined,
      actionLabel: queueCount > 0 ? "Open entry queue" : hasDraft ? "Resume draft" : undefined,
      tone: "offline",
    };
  }

  if (queueCount > 0) {
    return {
      title: `${queueLabel(queueCount)} waiting to sync`,
      detail: constrained
        ? `This browser still has offline DPR work waiting, and the current ${effectiveType || "mobile"} connection is weak, so sync may take longer than usual.`
        : "This browser still has offline DPR work waiting. Open Shift Entry to watch sync status or resolve anything still pending.",
      actionHref: "/entry?focus=offline",
      actionLabel: "Open entry queue",
      tone: "queue",
    };
  }

  if (hasDraft) {
    return {
      title: "Saved shift draft is ready",
      detail: constrained
        ? "Shift Entry already has a local draft on this device. Resume it and keep uploads short while the network is weak."
        : "Shift Entry already has a local draft on this device. Resume it before starting a fresh entry.",
      actionHref: "/entry?focus=draft",
      actionLabel: "Resume draft",
      tone: "draft",
    };
  }

  if (constrained) {
    return {
      title: "Weak connection detected",
      detail:
        effectiveType === "3g"
          ? "FactoryNerve is online, but this looks like a slower mobile connection. Live counts, OCR uploads, and review refreshes may take longer."
          : "FactoryNerve is online, but the current connection looks constrained. Keep actions focused and wait for sync feedback before leaving the screen.",
      actionHref: "/dashboard",
      actionLabel: "Open dashboard",
      tone: "slow",
    };
  }

  return null;
}

export function OfflineWorkStrip() {
  const pathname = usePathname() || "/";
  const { user } = useSession();
  const network = useNetworkStatus();
  const [queueCount, setQueueCount] = useState(0);
  const [hasDraft, setHasDraft] = useState(false);

  const canTrackLocalState = canTrackLocalEntryWork(user?.role);

  const refreshLocalState = useCallback(async () => {
    if (!user || !canTrackLocalState) {
      setQueueCount(0);
      setHasDraft(false);
      return;
    }

    const [queueResult, draftResult] = await Promise.allSettled([
      countQueuedEntries(user.id),
      loadDraft(user.id),
    ]);

    setQueueCount(queueResult.status === "fulfilled" ? queueResult.value : 0);
    setHasDraft(Boolean(draftResult.status === "fulfilled" && draftResult.value));
  }, [canTrackLocalState, user]);

  useEffect(() => {
    if (!user || !canTrackLocalState) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshLocalState();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [canTrackLocalState, refreshLocalState, user]);

  useEffect(() => {
    if (!user || !canTrackLocalState) {
      return;
    }
    return subscribeToQueueUpdates(() => {
      void refreshLocalState();
    });
  }, [canTrackLocalState, refreshLocalState, user]);

  const visibleQueueCount = canTrackLocalState ? queueCount : 0;
  const visibleHasDraft = canTrackLocalState ? hasDraft : false;

  const stripConfig = useMemo(
    () =>
      buildStripConfig(
        pathname,
        network.online,
        network.constrained,
        network.effectiveType,
        visibleQueueCount,
        visibleHasDraft,
      ),
    [network.constrained, network.effectiveType, network.online, pathname, visibleHasDraft, visibleQueueCount],
  );

  if (!user || shouldHide(pathname) || !stripConfig) {
    return null;
  }

  return (
    <section className="safe-inline-pad px-4 pt-4 lg:px-6 lg:pt-5">
      <div
        className={cn(
          "rounded-[1.45rem] border px-4 py-4 shadow-[0_18px_42px_rgba(3,8,20,0.16)]",
          toneClassName(stripConfig.tone),
        )}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(224,231,255,0.92)]">
              {network.online ? "Local Work Status" : "Offline Mode"}
            </div>
            <div className="mt-1 text-sm font-semibold text-[var(--text)]">{stripConfig.title}</div>
            <div className="mt-1 text-sm leading-6 text-[var(--muted)]">{stripConfig.detail}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <span className="rounded-full border border-white/10 bg-[rgba(8,12,20,0.42)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text)]">
              {network.online ? "Online" : "Offline"}
            </span>
            {visibleQueueCount > 0 ? (
              <span className="rounded-full border border-white/10 bg-[rgba(8,12,20,0.42)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text)]">
                {queueLabel(visibleQueueCount)}
              </span>
            ) : null}
            {network.constrained && network.online ? (
              <span className="rounded-full border border-white/10 bg-[rgba(8,12,20,0.42)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text)]">
                {network.effectiveType ? `${network.effectiveType} network` : "Weak network"}
              </span>
            ) : null}
            {visibleHasDraft ? (
              <span className="rounded-full border border-white/10 bg-[rgba(8,12,20,0.42)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text)]">
                Saved draft
              </span>
            ) : null}
            {stripConfig.actionHref && stripConfig.actionLabel ? (
              <Link
                href={stripConfig.actionHref}
                className="inline-flex h-10 items-center justify-center rounded-full border border-white/12 bg-[rgba(8,12,20,0.46)] px-4 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text)] transition hover:border-[rgba(62,166,255,0.32)] hover:bg-[rgba(20,24,36,0.78)]"
              >
                {stripConfig.actionLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
