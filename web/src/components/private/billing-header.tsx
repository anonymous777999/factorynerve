"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

type BillingHeaderProps = {
  dashboardLabel: string;
  description: string;
  plansLabel: string;
  title: string;
  toolsTitle: string;
};

export function BillingHeader({
  dashboardLabel,
  description,
  plansLabel,
  title,
  toolsTitle,
}: BillingHeaderProps) {
  return (
    <section className="flex flex-wrap items-start justify-between gap-4 rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur">
      <div>
        <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Billing</div>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">{description}</p>
      </div>
      <details className="w-full min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4 sm:w-auto sm:min-w-[220px]">
        <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)]">
          {toolsTitle}
        </summary>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/plans">
            <Button>{plansLabel}</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">{dashboardLabel}</Button>
          </Link>
        </div>
      </details>
    </section>
  );
}
