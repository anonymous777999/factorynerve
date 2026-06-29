"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth";

type DiagnosticInfo = {
  status: number;
  timestamp: string;
  factories: Array<{ factory_id: string; name: string }>;
  activeFactoryId: string | null;
  userEmail: string;
  userName: string;
} | null;

function readDiagnostic(): DiagnosticInfo {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem("dpr:redirect-diagnostic");
    if (!raw) return null;
    return JSON.parse(raw) as DiagnosticInfo;
  } catch {
    return null;
  }
}

export default function FactoryRequiredPage() {
  const router = useRouter();
  const [diagnostic, setDiagnostic] = useState<DiagnosticInfo | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setDiagnostic(readDiagnostic());
    // Clean up diagnostic so it doesn't persist across visits
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("dpr:redirect-diagnostic");
    }
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      router.replace("/access");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-6 py-16">
      <div className="w-full max-w-xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10">
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8 text-amber-300"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Factory workspace required</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Your account is active, but no factory workspace has been assigned yet.
            A factory workspace is needed before you can start using the system.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="text-sm font-semibold text-[var(--text)]">What to do next</h2>
          <ul className="space-y-3 text-sm leading-6 text-[var(--muted)]">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-400/15 text-[11px] font-bold text-sky-300">
                1
              </span>
              <span>
                <strong className="text-[var(--text)]">Contact your organization admin</strong> and ask them to
                assign you to a factory workspace.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-400/15 text-[11px] font-bold text-sky-300">
                2
              </span>
              <span>
                If you are the <strong className="text-[var(--text)]">first user</strong> in your organization,
                you may need to complete the organization setup through the settings page once you have access.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-400/15 text-[11px] font-bold text-sky-300">
                3
              </span>
              <span>
                <strong className="text-[var(--text)]">Sign out and sign back in</strong> after your admin has
                assigned your factory. The system will route you to the correct workspace.
              </span>
            </li>
          </ul>
        </div>

        {/* Support link */}
        <div className="rounded-2xl border border-[var(--border)] bg-[rgba(8,12,20,0.5)] p-5">
          <p className="text-sm text-[var(--muted)]">
            Need help? Contact your organization admin or{" "}
            <Link href="/contact" className="font-medium text-sky-300 transition hover:text-sky-200">
              reach out to support
            </Link>
            .
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3">
          <Button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full max-w-xs"
          >
            {loggingOut ? "Signing out..." : "Sign out and try again"}
          </Button>
          <Link
            href="/access"
            className="text-sm text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            Back to sign in
          </Link>
        </div>

        {/* Technical detail — expandable */}
        {diagnostic ? (
          <details className="group rounded-2xl border border-[var(--border)] bg-[rgba(8,12,20,0.3)] px-4 py-3">
            <summary className="cursor-pointer text-xs font-medium text-[var(--muted)] transition hover:text-[var(--text)]">
              Diagnostic info
            </summary>
            <pre className="mt-3 overflow-auto rounded-xl bg-[rgba(3,8,20,0.6)] p-4 text-[11px] leading-5 text-slate-400">
              {JSON.stringify(diagnostic, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>
    </main>
  );
}
