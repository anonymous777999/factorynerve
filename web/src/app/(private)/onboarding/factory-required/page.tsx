"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function FactoryRequiredPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090d14] px-6 py-10 text-[#e8edf7]">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(24,28,37,0.98),rgba(18,23,33,0.98))] p-8 shadow-[0_24px_60px_rgba(2,6,23,0.45)]">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-200/80">
          Workspace update
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
          Your workspace is no longer available.
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          Your active factory access was removed, so we paused the workspace instead of leaving you on a broken page.
        </p>
        <div className="mt-8">
          <Link href="mailto:admin@dpr.ai">
            <Button className="rounded-xl bg-[linear-gradient(180deg,#89bcf8,#55a9ff)] px-5 text-sm font-semibold text-[#07131f]">
              Request access from your administrator
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
