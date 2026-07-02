"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/use-session";

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 10V7a5 5 0 0 1 10 0v3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M12 14v3" strokeLinecap="round" />
    </svg>
  );
}

export default function AccessRestrictedPage() {
  const router = useRouter();
  const { user } = useSession();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090d14] px-6 py-10 text-[#e8edf7]">
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-8 shadow-[0_24px_60px_rgba(2,6,23,0.45)]">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10 text-amber-200">
          <LockIcon />
        </div>
        <div className="mt-6 text-xs font-semibold uppercase tracking-prominent text-amber-200/80">
          Access Restricted
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          You don&apos;t have permission to access this page.
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          Your workspace is active, but this destination is reserved for a different permission level.
        </p>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
          Your role: {user?.role || "unknown"}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="rounded-xl bg-[linear-gradient(180deg,#89bcf8,#55a9ff)] px-5 text-sm font-semibold text-[#07131f]"
          >
            Back to Dashboard
          </Button>
          <Link
            href="mailto:admin@dpr.ai"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-sky-300/30 hover:text-white"
          >
            Contact your administrator
          </Link>
        </div>
      </div>
    </main>
  );
}
