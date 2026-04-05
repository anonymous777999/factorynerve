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
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.14),transparent_26%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(90deg,rgba(56,189,248,0.12),transparent,rgba(16,185,129,0.10))]" />

      <div className="relative mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_minmax(0,1.05fr)] lg:gap-10">
        <section className="flex flex-col justify-center rounded-[2rem] border border-white/10 bg-[rgba(15,23,42,0.68)] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] backdrop-blur md:p-8">
          <div className="inline-flex w-fit rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200">
            DPR.ai Account Center
          </div>
          <h1 className="mt-5 max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-[2.4rem]">
            {journeyTitle}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            {journeyDescription}
          </p>

          <div className="mt-8 grid gap-3">
            {steps.map((step, index) => (
              <div
                key={`${step.title}-${index}`}
                className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-sky-200">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{step.title}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-300">{step.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
            <div className="text-sm font-semibold text-emerald-100">{supportTitle}</div>
            <div className="mt-2 text-sm leading-6 text-emerald-50/85">{supportDescription}</div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <Card
            className={cn(
              "w-full border border-white/10 bg-[rgba(15,23,42,0.82)] shadow-[0_24px_80px_rgba(2,6,23,0.55)] backdrop-blur",
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
