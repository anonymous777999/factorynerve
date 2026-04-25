"use client";

import { getRecentFrontendErrorSnapshot } from "@/lib/observability";
import type { AppLanguage } from "@/lib/i18n";

export type RecentFeedbackAction = {
  kind: "navigation" | "click" | "submit";
  label: string;
  route?: string | null;
  timestamp: string;
};

const LAST_ACTION_STORAGE_KEY = "dpr:feedback:last-action";
export const RECENT_FEEDBACK_ACTION_EVENT = "dpr:feedback:recent-action";

function isBrowser() {
  return typeof window !== "undefined";
}

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function trimmed(value: string | null | undefined, maxLength = 120) {
  const next = String(value || "").replace(/\s+/g, " ").trim();
  if (!next) return null;
  return next.slice(0, maxLength);
}

export function recordRecentFeedbackAction(action: RecentFeedbackAction) {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(LAST_ACTION_STORAGE_KEY, JSON.stringify(action));
    window.dispatchEvent(new CustomEvent(RECENT_FEEDBACK_ACTION_EVENT, { detail: action }));
  } catch {
    // Ignore storage failures for best-effort context.
  }
}

export function getRecentFeedbackAction() {
  if (!isBrowser()) return null;
  return safeParse<RecentFeedbackAction>(window.sessionStorage.getItem(LAST_ACTION_STORAGE_KEY));
}

export function buildFeedbackContext({
  pathname,
  language,
  activeFactoryName,
  organizationName,
  role,
}: {
  pathname: string;
  language: AppLanguage;
  activeFactoryName?: string | null;
  organizationName?: string | null;
  role?: string | null;
}) {
  const recentAction = getRecentFeedbackAction();
  const recentError = getRecentFrontendErrorSnapshot();

  return {
    route: pathname,
    page_title: trimmed(typeof document !== "undefined" ? document.title : null, 160),
    app_language: language,
    active_factory_name: trimmed(activeFactoryName, 120),
    organization_name: trimmed(organizationName, 120),
    role: trimmed(role, 40),
    timestamp_utc: new Date().toISOString(),
    timestamp_local:
      typeof Intl !== "undefined"
        ? new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "medium",
          }).format(new Date())
        : null,
    timezone:
      typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || null : null,
    online: typeof navigator !== "undefined" ? navigator.onLine : null,
    viewport:
      typeof window !== "undefined"
        ? {
            width: window.innerWidth,
            height: window.innerHeight,
          }
        : null,
    user_agent: trimmed(typeof navigator !== "undefined" ? navigator.userAgent : null, 300),
    last_action: recentAction?.label || null,
    last_action_detail: recentAction,
    recent_error: recentError,
  };
}
