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

export function reportFrontendError(payload: FrontendErrorReport) {
  if (typeof window === "undefined") return;
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
