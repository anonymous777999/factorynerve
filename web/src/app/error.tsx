"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { reportFrontendError } from "@/lib/observability";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
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
      <div className="w-full max-w-xl rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.94)] p-8 shadow-2xl">
        <div className="text-sm uppercase tracking-[0.22em] text-[var(--accent)]">Observability</div>
        <h1 className="mt-3 text-3xl font-semibold">Page error.</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Let’s keep moving: you can retry this screen or jump back to the dashboard while the error is tracked in the launch monitor.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => reset()}>Retry Page</Button>
          <Link href="/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
