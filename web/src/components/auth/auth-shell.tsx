"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { FnLogo } from "@/components/shared/fn-logo";
import { GuidanceBlock} from "@/components/ui/guidance-block";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type AuthShellStep = {
  title: string;
  description: string;
};

type BrandTrustPoint = {
  icon: ReactNode;
  text: string;
};

type BrandConfig = {
  appInitial: string;
  appName: string;
  eyebrow: string;
  title: string;
  description: string;
  trustPoints: BrandTrustPoint[];
  /**
   * If true, uses the FnLogo mark component instead of the appInitial letter
   * in the brand sidebar and mobile logo.
   */
  useFnLogo?: boolean;
};

type AuthShellProps = {
  badge: string;
  title: string;
  description: string;
  journeyTitle?: string;
  journeyDescription?: string;
  steps?: AuthShellStep[];
  supportTitle?: string;
  supportDescription?: string;
  children: ReactNode;
  cardClassName?: string;
  contentClassName?: string;
  guidanceKey?: string;
  /** @default "single" */
  variant?: "single" | "split";
  /** Required when variant="split" */
  brand?: BrandConfig;
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
  guidanceKey = "auth-login-help",
  variant = "single",
  brand,
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

  // ── Split-pane variant ──────────────────────────────────────────────
  if (variant === "split" && brand) {
    return (
      <main className="relative min-h-screen bg-[#090d14] text-[#e8edf7]">
        <div className="grid min-h-screen lg:grid-cols-2">
          {/* Brand sidebar — desktop only */}
          <aside className="relative hidden overflow-hidden border-r border-white/8 lg:flex lg:flex-col lg:justify-between lg:p-12">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 20% 15%, rgba(72,158,255,0.14), transparent 42%), radial-gradient(circle at 80% 80%, rgba(34,211,238,0.08), transparent 40%), linear-gradient(180deg, #0b1116 0%, #111820 100%)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.15] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:40px_40px]"
            />

            {/* Logo */}
            <div className="relative flex items-center gap-3">
              {brand.useFnLogo ? (
                <FnLogo variant="mark" className="h-10 w-10" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-200/20 bg-[linear-gradient(135deg,rgba(76,176,255,0.24),rgba(45,212,191,0.18))] shadow-[0_8px_20px_rgba(5,13,24,0.3)]">
                  <span className="text-base font-bold text-white">{brand.appInitial}</span>
                </div>
              )}
              <div className="text-lg font-semibold tracking-tight text-[#f0f4fc]">{brand.appName}</div>
            </div>

            {/* Value proposition */}
            <div className="relative max-w-md">
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8fc8ff]">{brand.eyebrow}</div>
              <h1 className="mt-4 text-[2.5rem] font-semibold leading-[1.1] tracking-tight text-[#f0f4fc]">
                {brand.title}
              </h1>
              <p className="mt-5 text-[15px] leading-7 text-[#97a6bd]">{brand.description}</p>

              <ul className="mt-10 space-y-4">
                {brand.trustPoints.map((point) => (
                  <li key={point.text} className="flex items-start gap-3 text-sm text-[#97a6bd]">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-300">
                      {point.icon}
                    </span>
                    <span>{point.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative text-xs text-slate-500">
              &copy; {new Date().getFullYear()} DPR.ai Technologies
            </div>
          </aside>

          {/* Form column */}
          <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10">
            <div className="w-full max-w-[440px]">
              {/* Mobile logo */}
              <div className="mb-10 flex items-center gap-3 lg:hidden">
                {brand.useFnLogo ? (
                  <FnLogo variant="mark" className="h-9 w-9" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-200/20 bg-[linear-gradient(135deg,rgba(76,176,255,0.24),rgba(45,212,191,0.18))]">
                    <span className="text-sm font-bold text-white">{brand.appInitial}</span>
                  </div>
                )}
                <div className="text-base font-semibold tracking-tight text-[#f0f4fc]">{brand.appName}</div>
              </div>

              <Card
                className={cn(
                  "border border-white/10 bg-[linear-gradient(180deg,rgba(11,18,30,0.84),rgba(8,13,24,0.94))] shadow-[0_32px_110px_rgba(2,6,23,0.55)] backdrop-blur-2xl",
                  cardClassName,
                )}
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(76,176,255,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(45,212,191,0.08),transparent_28%)]" />
                <CardHeader className="relative space-y-3 border-b border-white/8 pb-6">
                  <div className="inline-flex w-fit rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-header text-slate-300">
                    {badge}
                  </div>
                  <CardTitle className="text-3xl tracking-tight text-white sm:text-[2.65rem]">{title}</CardTitle>
                  <p className="max-w-2xl text-sm leading-7 text-slate-300">{description}</p>
                </CardHeader>
                <CardContent className={cn("relative pt-6", contentClassName)}>{children}</CardContent>
              </Card>

              {/* Footer */}
              <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500">
                <Link href="/privacy" className="transition hover:text-sky-300 hover:underline">
                  {t("auth.shell.footer_privacy", "Privacy")}
                </Link>
                <Link href="/terms" className="transition hover:text-sky-300 hover:underline">
                  {t("auth.shell.footer_terms", "Terms")}
                </Link>
                <Link href="/security" className="transition hover:text-sky-300 hover:underline">
                  {t("auth.shell.footer_security", "Security")}
                </Link>
                <Link href="/contact" className="transition hover:text-sky-300 hover:underline">
                  {t("auth.shell.footer_contact", "Contact")}
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  // ── Single-column variant (original) ────────────────────────────────
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
          <FnLogo variant="mark" className="h-9 w-9" />              <div className="leading-tight">
                <div className="font-semibold text-white">{t("auth.shell.home_label", "FactoryNerve")}</div>
                <div className="text-[11px] uppercase tracking-header text-slate-400">{t("auth.shell.home_caption", "Factory access")}</div>
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
              className="auth-rise inline-flex w-fit rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-header text-slate-300"
              style={{ animationDelay: "120ms" }}
            >
              {badge}
            </div>
            <div className="space-y-3">
              <CardTitle
                className="auth-rise auth-title-glow text-3xl tracking-tight text-white sm:text-[2.65rem]"
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

        <div className="auth-rise mt-4" style={{ animationDelay: "360ms" }}>
          <GuidanceBlock
            surfaceKey={guidanceKey}
            title={t("auth.shell.learn_more", "Why this is required")}
            summary={resolvedSupportDescription}
            eyebrow={t("auth.shell.guardrails", "Guardrails")}
            collapsedLabel={t("common.open", "Open")}
            expandedLabel={t("common.close", "Close")}
            critical
            className="border-white/10 bg-[linear-gradient(180deg,rgba(12,20,33,0.78),rgba(8,14,24,0.92))] shadow-[0_18px_60px_rgba(2,6,23,0.34)] backdrop-blur-xl"
            eyebrowClassName="text-emerald-100/70"
            titleClassName="text-white"
            summaryClassName="text-slate-300"
            contentClassName="border-white/8"
          >
            <div className="grid gap-4 lg:grid-cols-[1.18fr_0.82fr]">
              <div className="rounded-[1.7rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="text-xs font-semibold uppercase tracking-header text-slate-400">{t("auth.shell.workflow_map", "Workflow map")}</div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">{journeyTitle}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">{journeyDescription}</p>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {(steps ?? []).map((step, index) => (
                    <div
                      key={`${step.title}-${index}`}
                      className="rounded-[1.35rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-200/15 bg-cyan-300/10 text-sm font-semibold text-cyan-100">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-sm font-semibold tracking-tight text-white">{step.title}</div>
                          <div className="mt-1 text-sm leading-6 text-slate-300">{step.description}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.7rem] border border-emerald-400/18 bg-[linear-gradient(180deg,rgba(9,25,23,0.88),rgba(7,17,22,0.96))] p-5 shadow-[0_18px_60px_rgba(2,6,23,0.34)] backdrop-blur-xl">
                <div className="text-xs font-semibold uppercase tracking-header text-emerald-100/70">{t("auth.shell.guardrails", "Guardrails")}</div>
                <div className="mt-3 text-xl font-semibold tracking-tight text-emerald-50">{resolvedSupportTitle}</div>
                <div className="mt-3 text-sm leading-7 text-emerald-50/80">{resolvedSupportDescription}</div>
              </div>
            </div>
          </GuidanceBlock>
        </div>

        {/* Footer links */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/5 pt-6 text-xs text-slate-500">
          <span>&copy; {new Date().getFullYear()} DPR.ai Technologies</span>
          <Link href="/privacy" className="transition hover:text-sky-300 hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="transition hover:text-sky-300 hover:underline">
            Terms of Service
          </Link>
          <Link href="/cookies" className="transition hover:text-sky-300 hover:underline">
            Cookie Policy
          </Link>
          <Link href="/refunds" className="transition hover:text-sky-300 hover:underline">
            Refund Policy
          </Link>
          <Link href="/contact" className="transition hover:text-sky-300 hover:underline">
            Contact
          </Link>
          <Link href="/security" className="transition hover:text-sky-300 hover:underline">
            Security
          </Link>
          <Link href="/data-retention" className="transition hover:text-sky-300 hover:underline">
            Data Retention
          </Link>
          <Link href="/sla" className="transition hover:text-sky-300 hover:underline">
            SLA
          </Link>
          <Link href="/dpa" className="transition hover:text-sky-300 hover:underline">
            DPA
          </Link>
          <Link href="/compliance" className="transition hover:text-sky-300 hover:underline">
            Trust Center
          </Link>
          <Link href="/acceptable-use" className="transition hover:text-sky-300 hover:underline">
            Acceptable Use
          </Link>
          <Link href="/subprocessors" className="transition hover:text-sky-300 hover:underline">
            Sub-processors
          </Link>
          <Link href="/faq" className="transition hover:text-sky-300 hover:underline">
            FAQ
          </Link>
          <Link href="/disclosure" className="transition hover:text-sky-300 hover:underline">
            Disclosure
          </Link>
          <Link href="/eula" className="transition hover:text-sky-300 hover:underline">
            EULA
          </Link>
          <a href="mailto:privacy@dpr.ai" className="transition hover:text-sky-300 hover:underline">
            Contact
          </a>
        </div>
      </div>
    </main>
  );
}
