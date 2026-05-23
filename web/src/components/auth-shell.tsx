"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { GuidanceBlock } from "@/components/ui/guidance-block";
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
  guidanceKey?: string;
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
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-surface-app px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-shell)_80%,transparent),transparent_12rem)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 border-b border-border-subtle/60" />

      <div className="relative mx-auto w-full max-w-4xl">
        <Link
          href="/"
          className="auth-rise mb-4 inline-flex items-center gap-3 rounded-control border-[0.5px] border-border-default bg-surface-panel px-3 py-2 text-sm text-text-primary"
          style={{ animationDelay: "40ms" }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-control border-[0.5px] border-border-default bg-surface-shell font-mono text-sm font-semibold text-text-primary">
            D
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-text-primary">{t("auth.shell.home_label", "DPR.ai")}</div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-text-secondary">{t("auth.shell.home_caption", "Factory access")}</div>
          </div>
        </Link>

        <Card
          className={cn(
            "relative w-full overflow-hidden border-[0.5px] border-border-default bg-surface-panel",
            cardClassName,
          )}
        >
          <CardHeader className="relative space-y-3 border-b border-border-subtle pb-4">
            <div
              className="auth-rise inline-flex w-fit rounded-badge border-[0.5px] border-border-default bg-surface-shell px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary"
              style={{ animationDelay: "120ms" }}
            >
              {badge}
            </div>
            <div className="space-y-2">
              <CardTitle
                className="auth-rise text-2xl tracking-tight text-text-primary sm:text-[2rem]"
                style={{ animationDelay: "170ms" }}
              >
                {title}
              </CardTitle>
              <p
                className="auth-rise max-w-2xl text-sm leading-6 text-text-secondary"
                style={{ animationDelay: "230ms" }}
              >
                {description}
              </p>
            </div>
          </CardHeader>
          <CardContent
            className={cn("relative pt-4", contentClassName)}
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
            className="border-border-default bg-surface-panel"
            eyebrowClassName="text-text-secondary"
            titleClassName="text-text-primary"
            summaryClassName="text-text-secondary"
            contentClassName="border-border-subtle"
          >
            <div className="grid gap-4 lg:grid-cols-[1.18fr_0.82fr]">
              <div className="rounded-panel border-[0.5px] border-border-default bg-surface-shell p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-text-secondary">{t("auth.shell.workflow_map", "Workflow map")}</div>
                <h2 className="mt-2 text-xl font-semibold text-text-primary">{journeyTitle}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{journeyDescription}</p>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {steps.map((step, index) => (
                    <div
                      key={`${step.title}-${index}`}
                      className="rounded-panel border-[0.5px] border-border-default bg-surface-panel p-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-control border-[0.5px] border-border-default bg-surface-elevated font-mono text-xs font-semibold text-text-primary">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-text-primary">{step.title}</div>
                          <div className="mt-1 text-sm leading-6 text-text-secondary">{step.description}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-panel border-[0.5px] border-border-default bg-surface-shell p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-text-secondary">{t("auth.shell.guardrails", "Guardrails")}</div>
                <div className="mt-2 text-xl font-semibold text-text-primary">{resolvedSupportTitle}</div>
                <div className="mt-2 text-sm leading-6 text-text-secondary">{resolvedSupportDescription}</div>
              </div>
            </div>
          </GuidanceBlock>
        </div>
      </div>
    </main>
  );
}
