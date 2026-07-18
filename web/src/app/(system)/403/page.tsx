"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/use-session";

function LockIcon() {
  return <Lock className="h-7 w-7" strokeWidth={1.8} />;
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
            className="rounded-xl bg-[linear-gradient(180deg,#c56d2d,#c56d2d)] px-5 text-sm font-semibold text-[#07131f]"
          >
            Back to Dashboard
          </Button>
          <Link
            href="mailto:admin@dpr.ai"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-[var(--accent-soft)] hover:text-white"
          >
            Contact your administrator
          </Link>
        </div>
      </div>
    </main>
  );
}
