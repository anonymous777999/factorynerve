"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
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
  supportTitle,
  supportDescription,
  children,
  cardClassName,
  contentClassName,
}: AuthShellProps) {
  const { t } = useI18n();
  useI18nNamespaces(["auth", "common"]);
  const resolvedSupportTitle = supportTitle || t("auth.shell.support_title", "Factory-safe account flow");
  const resolvedSupportDescription =
    supportDescription ||
    t(
      "auth.shell.support_description",
      "Every auth step is designed to protect the workspace, verify inbox ownership, and keep access traceable.",
    );

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(3,9,16,0.95),rgba(7,14,24,0.97))]" />
      <div className="auth-ocean-mesh pointer-events-none absolute inset-0 opacity-90" />
      <div className="auth-dot-field pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -translate-y-8 h-[45%] bg-[radial-gradient(circle_at_top,rgba(120,214,255,0.16),transparent_58%)]" />
      <div className="auth-float-slow pointer-events-none absolute left-4 top-14 h-40 w-40 rounded-full bg-cyan-300/10 blur-3xl sm:-left-20 sm:h-72 sm:w-72" />
      <div className="auth-float-delay pointer-events-none absolute right-4 top-[16%] h-44 w-44 rounded-full bg-sky-400/10 blur-3xl sm:right-0 sm:h-80 sm:w-80 sm:translate-x-16" />
      <div className="auth-float-slower pointer-events-none absolute bottom-4 left-[14%] h-36 w-36 rounded-full bg-teal-300/8 blur-3xl sm:bottom-0 sm:h-64 sm:w-64 sm:translate-y-16" />

      <div className="relative mx-auto w-full max-w-5xl">
        <Link
          href="/"
          className="auth-rise mb-5 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-slate-200 shadow-[0_12px_32px_rgba(2,6,23,0.28)] backdrop-blur-xl"
          style={{ animationDelay: "40ms" }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-cyan-200/15 bg-[linear-gradient(135deg,rgba(76,176,255,0.24),rgba(45,212,191,0.18))] text-sm font-semibold text-white">
            D
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-white">{t("auth.shell.home_label", "DPR.ai")}</div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{t("auth.shell.home_caption", "Factory access")}</div>
          </div>
        </Link>

        <Card
          className={cn(
            "relative w-full overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(11,18,30,0.84),rgba(8,13,24,0.94))] shadow-[0_32px_110px_rgba(2,6,23,0.55)] backdrop-blur-2xl",
            cardClassName,
          )}
        >
          <div className="auth-edge-beam pointer-events-none absolute inset-x-10 top-0 h-px" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(76,176,255,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(45,212,191,0.08),transparent_28%)]" />
          <CardHeader className="relative space-y-4 border-b border-white/8 pb-6">
            <div
              className="auth-rise inline-flex w-fit rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300"
              style={{ animationDelay: "120ms" }}
            >
              {badge}
            </div>
            <div className="space-y-3">
              <CardTitle
                className="auth-rise auth-title-glow text-3xl tracking-[-0.04em] text-white sm:text-[2.65rem]"
                style={{ animationDelay: "170ms" }}
              >
                {title}
              </CardTitle>
              <p
                className="auth-rise max-w-2xl text-sm leading-7 text-slate-300 sm:text-base"
                style={{ animationDelay: "230ms" }}
              >
                {description}
              </p>
            </div>
          </CardHeader>
          <CardContent
            className={cn("relative pt-6", contentClassName)}
          >
            <div className="auth-rise" style={{ animationDelay: "290ms" }}>
              {children}
            </div>
          </CardContent>
        </Card>

        <section className="mt-4 grid gap-4 lg:grid-cols-[1.18fr_0.82fr]">
          <div
            className="auth-rise rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(12,20,33,0.78),rgba(8,14,24,0.92))] p-5 shadow-[0_18px_60px_rgba(2,6,23,0.34)] backdrop-blur-xl"
            style={{ animationDelay: "360ms" }}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t("auth.shell.workflow_map", "Workflow map")}</div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">{journeyTitle}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{journeyDescription}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {steps.map((step, index) => (
                <div
                  key={`${step.title}-${index}`}
                  className="rounded-[1.35rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-200/15 bg-cyan-300/10 text-sm font-semibold text-cyan-100">
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
          </div>

          <div
            className="auth-rise rounded-[1.7rem] border border-emerald-400/18 bg-[linear-gradient(180deg,rgba(9,25,23,0.88),rgba(7,17,22,0.96))] p-5 shadow-[0_18px_60px_rgba(2,6,23,0.34)] backdrop-blur-xl"
            style={{ animationDelay: "440ms" }}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100/70">{t("auth.shell.guardrails", "Guardrails")}</div>
            <div className="mt-3 text-xl font-semibold tracking-[-0.02em] text-emerald-50">{resolvedSupportTitle}</div>
            <div className="mt-3 text-sm leading-7 text-emerald-50/80">{resolvedSupportDescription}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
