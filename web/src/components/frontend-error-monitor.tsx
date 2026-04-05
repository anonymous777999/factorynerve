"use client";

import { useEffect } from "react";

import { reportFrontendError } from "@/lib/observability";

const seenErrors = new Set<string>();
const CHUNK_RECOVERY_KEY = "dpr:chunk-recovery";

function fingerprint(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join("|").slice(0, 1000);
}

function isChunkLoadFailure(message?: string | null, stack?: string | null) {
  const combined = `${message || ""}\n${stack || ""}`.toLowerCase();
  return (
    combined.includes("chunkloaderror") ||
    combined.includes("loading chunk") ||
    combined.includes("failed to fetch dynamically imported module") ||
    combined.includes("loading css chunk")
  );
}

function attemptChunkRecovery() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const key = `${window.location.pathname}${window.location.search}`;
    const previous = window.sessionStorage.getItem(CHUNK_RECOVERY_KEY);
    if (previous === key) {
      return;
    }
    window.sessionStorage.setItem(CHUNK_RECOVERY_KEY, key);
    window.location.reload();
  } catch {
    window.location.reload();
  }
}

export function FrontendErrorMonitor() {
  useEffect(() => {
    try {
      window.sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
    } catch {
      // Ignore storage failures.
    }

    const onError = (event: ErrorEvent) => {
      if (isChunkLoadFailure(event.message, event.error instanceof Error ? event.error.stack : undefined)) {
        attemptChunkRecovery();
      }
      const key = fingerprint([
        "window-error",
        event.message,
        event.filename,
        String(event.lineno),
        String(event.colno),
      ]);
      if (seenErrors.has(key)) return;
      seenErrors.add(key);
      reportFrontendError({
        source: "window.error",
        message: event.message || "Unhandled browser error",
        url: window.location.href,
        route: window.location.pathname,
        stack: event.error instanceof Error ? event.error.stack : undefined,
        user_agent: navigator.userAgent,
        extra: {
          filename: event.filename,
          line: event.lineno,
          column: event.colno,
        },
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason =
        event.reason instanceof Error
          ? event.reason.message
          : typeof event.reason === "string"
            ? event.reason
            : "Unhandled promise rejection";
      const stack = event.reason instanceof Error ? event.reason.stack : undefined;
      if (isChunkLoadFailure(reason, stack)) {
        attemptChunkRecovery();
      }
      const key = fingerprint(["unhandled-rejection", reason, stack]);
      if (seenErrors.has(key)) return;
      seenErrors.add(key);
      reportFrontendError({
        source: "window.unhandledrejection",
        message: reason,
        url: window.location.href,
        route: window.location.pathname,
        stack,
        user_agent: navigator.userAgent,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
