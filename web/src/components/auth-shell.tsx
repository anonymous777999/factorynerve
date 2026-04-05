"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AuthShellStep = {
  title: string;
  description: string;
};

type AuthShellProps = {
  badge: string;
  title: string;
  description: string;
  journeyTitle: string;
  journeyDescription: string;
  steps: AuthShellStep[];
  supportTitle?: string;
  supportDescription?: string;
  children: ReactNode;
  cardClassName?: string;
  contentClassName?: string;
};

export function AuthShell({
  badge,
  title,
  description,
  journeyTitle,
  journeyDescription,
  steps,
  supportTitle = "Factory-safe account flow",
  supportDescription = "Every auth step is designed to protect the workspace, verify inbox ownership, and keep access traceable.",
  children,
  cardClassName,
  contentClassName,
}: AuthShellProps) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(76,176,255,0.2),transparent_28%),radial-gradient(circle_at_85%_16%,rgba(34,197,94,0.12),transparent_24%),linear-gradient(180deg,rgba(5,11,19,0.98),rgba(11,19,31,0.96))]" />
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-position:center] [background-size:72px_72px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[linear-gradient(90deg,rgba(76,176,255,0.14),transparent,rgba(34,197,94,0.10))]" />
      <div className="pointer-events-none absolute -left-16 top-24 h-52 w-52 rounded-full bg-sky-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-12 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_minmax(0,1.05fr)] lg:gap-10">
        <section className="relative flex flex-col justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(14,22,35,0.78),rgba(9,15,24,0.88))] p-6 shadow-[var(--shadow-lg)] backdrop-blur md:p-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="inline-flex w-fit rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-100">
            Factory Account Flow
          </div>
          <h1 className="mt-5 max-w-xl text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[2.5rem]">
            {journeyTitle}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            {journeyDescription}
          </p>

          <div className="mt-8 grid gap-3.5">
            {steps.map((step, index) => (
              <div
                key={`${step.title}-${index}`}
                className="rounded-[1.45rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-300/20 bg-sky-400/10 text-sm font-semibold text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold tracking-[-0.01em] text-white">{step.title}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-300">{step.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[1.45rem] border border-emerald-400/18 bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(16,185,129,0.08))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="text-sm font-semibold tracking-[-0.01em] text-emerald-50">{supportTitle}</div>
            <div className="mt-2 text-sm leading-6 text-emerald-50/80">{supportDescription}</div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <Card
            className={cn(
              "w-full overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(14,22,35,0.88),rgba(10,16,26,0.94))] shadow-[0_24px_80px_rgba(2,6,23,0.55)] backdrop-blur",
              cardClassName,
            )}
          >
            <CardHeader className="space-y-4 border-b border-white/8 pb-6">
              <div className="inline-flex w-fit rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                {badge}
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl text-white sm:text-[2rem]">{title}</CardTitle>
                <p className="max-w-2xl text-sm leading-7 text-slate-300">{description}</p>
              </div>
            </CardHeader>
            <CardContent className={cn("pt-6", contentClassName)}>{children}</CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
