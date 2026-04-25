"use client";

import { getCookie } from "@/lib/cookies";

export type FrontendErrorReport = {
  message: string;
  source: string;
  url?: string | null;
  route?: string | null;
  stack?: string | null;
  component_stack?: string | null;
  digest?: string | null;
  release?: string | null;
  user_agent?: string | null;
  extra?: Record<string, unknown>;
};

export type FrontendErrorSnapshot = {
  message: string;
  source: string;
  route?: string | null;
  url?: string | null;
  digest?: string | null;
  release?: string | null;
  captured_at: string;
};

export const FRONTEND_ERROR_RECORDED_EVENT = "dpr:frontend:error-recorded";

function toBody(payload: FrontendErrorReport) {
  return JSON.stringify({
    ...payload,
    release:
      payload.release ||
      process.env.NEXT_PUBLIC_RELEASE_VERSION ||
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
      "dev",
  });
}

const CSRF_COOKIE = process.env.NEXT_PUBLIC_CSRF_COOKIE || "dpr_csrf";
const CSRF_HEADER = process.env.NEXT_PUBLIC_CSRF_HEADER || "X-CSRF-Token";
const FRONTEND_ERROR_SNAPSHOT_KEY = "dpr:frontend:last-error";

function buildHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Response-Envelope": "v1",
  };
  const csrf = getCookie(CSRF_COOKIE);
  if (csrf) {
    headers[CSRF_HEADER] = csrf;
  }
  return headers;
}

function rememberFrontendError(payload: FrontendErrorReport) {
  if (typeof window === "undefined") return;
  const snapshot: FrontendErrorSnapshot = {
    message: payload.message,
    source: payload.source,
    route: payload.route,
    url: payload.url,
    digest: payload.digest,
    release:
      payload.release ||
      process.env.NEXT_PUBLIC_RELEASE_VERSION ||
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
      "dev",
    captured_at: new Date().toISOString(),
  };

  try {
    window.sessionStorage.setItem(FRONTEND_ERROR_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage failures and still send the error upstream.
  }
  window.dispatchEvent(new CustomEvent(FRONTEND_ERROR_RECORDED_EVENT, { detail: snapshot }));
}

export function getRecentFrontendErrorSnapshot() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(FRONTEND_ERROR_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FrontendErrorSnapshot;
  } catch {
    return null;
  }
}

export function reportFrontendError(payload: FrontendErrorReport) {
  if (typeof window === "undefined") return;
  rememberFrontendError(payload);
  const body = toBody(payload);
  const url = "/api/observability/frontend-error";

  void fetch(url, {
    method: "POST",
    headers: buildHeaders(),
    body,
    credentials: "include",
    keepalive: true,
  }).catch(() => undefined);
}
