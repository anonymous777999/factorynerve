"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { reportFrontendError } from "@/lib/observability";

const CHUNK_RELOAD_KEY = "dpr:chunk-reload-attempted";

function isChunkLoadError(error: Error) {
  const combined = `${error.message || ""}\n${error.stack || ""}`.toLowerCase();
  return (
    combined.includes("chunkloaderror") ||
    combined.includes("loading chunk") ||
    combined.includes("failed to load chunk") ||
    combined.includes("failed to fetch dynamically imported module") ||
    combined.includes("loading css chunk")
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Chunk load errors happen after redeployment when the browser has cached
    // stale HTML that references old chunk hashes. Auto-reload once to pick up
    // the new bundles. Guard with sessionStorage to avoid infinite reload loops.
    if (isChunkLoadError(error)) {
      try {
        const reloadKey = `${window.location.pathname}${window.location.search}`;
        const alreadyAttempted = window.sessionStorage.getItem(CHUNK_RELOAD_KEY);
        if (alreadyAttempted !== reloadKey) {
          window.sessionStorage.setItem(CHUNK_RELOAD_KEY, reloadKey);
          window.location.reload();
          return;
        }
        // Already tried a reload — clear the flag so next navigation works
        window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      } catch {
        window.location.reload();
        return;
      }
    }

    reportFrontendError({
      source: "next.error-boundary",
      message: error.message || "Unhandled route error",
      url: typeof window !== "undefined" ? window.location.href : null,
      route: typeof window !== "undefined" ? window.location.pathname : null,
      stack: error.stack,
      digest: error.digest,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-[2rem] border border-[var(--border)] bg-surface-card p-8 shadow-2xl">
        <div className="text-sm uppercase tracking-[0.22em] text-[var(--accent)]">Observability</div>
        <h1 className="mt-3 text-3xl font-semibold">We hit a page error, and it has been reported.</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Let's keep moving: you can retry this screen or jump back to the dashboard while the error is tracked in the launch monitor.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            onClick={() => {
              try {
                window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
              } catch {
                // ignore
              }
              reset();
            }}
          >
            Retry Page
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              try {
                window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
              } catch {
                // ignore
              }
              window.location.reload();
            }}
          >
            Hard Reload
          </Button>
          <Link href="/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
