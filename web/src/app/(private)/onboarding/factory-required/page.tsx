"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth";
import { clearSession } from "@/lib/session-store";

export default function FactoryRequiredPage() {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      clearSession();
    } finally {
      if (typeof window !== "undefined") {
        window.location.href = "/access";
      }
    }
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090d14] px-6 py-10 text-[#e8edf7]">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-8 shadow-[0_24px_60px_rgba(2,6,23,0.45)]">
        <div className="flex items-center gap-2">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            className="h-5 w-5 text-amber-300"
          >
            <path d="M10 2.5 2.5 17.5h15L10 2.5Z" strokeLinejoin="round" />
            <path d="M10 7.5v4.2" strokeLinecap="round" />
            <circle cx="10" cy="14.5" r="0.7" fill="currentColor" stroke="none" />
          </svg>
          <div className="text-xs font-semibold uppercase tracking-prominent text-sky-200/80">
            Workspace unavailable
          </div>
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
          Your workspace needs a factory
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          Your account is signed in, but there is no active factory workspace assigned. This usually happens when
          your factory access was removed or the factory was deactivated.
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-400">
          You can try signing out and signing back in, or contact your administrator to restore your factory access.
        </p>

        <div className="mt-8 space-y-3">
          <Link href="mailto:admin@dpr.ai?subject=Factory%20access%20request&body=I%20am%20unable%20to%20access%20my%20workspace.%20Please%20restore%20my%20factory%20access.">
            <Button className="w-full rounded-xl bg-[linear-gradient(180deg,#89bcf8,#55a9ff)] px-5 text-sm font-semibold text-[#07131f]">
              Contact your administrator
            </Button>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut ? "Signing out..." : "Sign out and try again"}
          </button>
        </div>

        <p className="mt-6 text-xs leading-5 text-slate-500">
          Still having trouble? Reach out to support at{" "}
          <a href="mailto:support@dpr.ai" className="text-sky-300 underline transition hover:text-sky-200">
            support@dpr.ai
          </a>
        </p>
      </div>
    </main>
  );
}
