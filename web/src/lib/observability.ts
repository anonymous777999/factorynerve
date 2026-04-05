"use client";

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

export function reportFrontendError(payload: FrontendErrorReport) {
  if (typeof window === "undefined") return;
  const body = toBody(payload);
  const url = "/api/observability/frontend-error";

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) {
        return;
      }
    }
  } catch {
    // Fall back to fetch below.
  }

  void fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Response-Envelope": "v1",
    },
    body,
    credentials: "include",
    keepalive: true,
  }).catch(() => undefined);
}
