"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, Building2, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

export type AuthWorkstationStep = {
  title: string;
  description: string;
};

export type AuthWorkstationSupportItem = {
  icon: ReactNode;
  text: string;
};

export type AuthWorkstationMetric = {
  label: string;
  value: string;
};

type AuthWorkstationShellProps = {
  badge: string;
  title: string;
  description: string;
  leftEyebrow: string;
  leftTitle: string;
  leftDescription: string;
  steps: AuthWorkstationStep[];
  supportTitle: string;
  supportDescription: string;
  supportItems: AuthWorkstationSupportItem[];
  metrics?: AuthWorkstationMetric[];
  statusLabel?: string;
  statusValue?: string;
  topMetaLabel?: string;
  homeHref?: string;
  homeLabel?: string;
  platformLabel?: string;
  rightHeaderSlot?: ReactNode;
  children: ReactNode;
  panelClassName?: string;
  contentClassName?: string;
};

function StatusRail({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "h-1 flex-1 rounded-full border border-border-subtle/80",
        active
          ? "bg-[linear-gradient(90deg,var(--status-success-icon),color-mix(in_srgb,var(--status-success-icon)_60%,var(--action-primary)))] shadow-[var(--shadow-sm)]"
          : "bg-surface-elevated",
      )}
    />
  );
}

export function AuthWorkstationShell({
  badge,
  title,
  description,
  leftEyebrow,
  leftTitle,
  leftDescription,
  steps,
  supportTitle,
  supportDescription,
  supportItems,
  metrics = [],
  statusLabel = "Core systems status",
  statusValue = "Secure connection active",
  topMetaLabel = "Steel Industry",
  homeHref = "/",
  homeLabel = "DPR.ai",
  platformLabel = "Factory OS",
  rightHeaderSlot,
  children,
  panelClassName,
  contentClassName,
}: AuthWorkstationShellProps) {
  return (
    <main className="factory-auth-scope factory-auth-shell">
      <header className="factory-auth-topbar">
        <Link href={homeHref} className="inline-flex items-center gap-3 text-text-primary">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-border-default bg-surface-panel">
            <Building2 className="h-4 w-4 text-[var(--action-primary)]" />
          </div>
          <span className="text-page-title font-semibold tracking-tight">{homeLabel}</span>
        </Link>

        <div className="flex items-center gap-8 text-[11px] font-medium uppercase tracking-[0.24em] text-text-secondary">
          <span>{topMetaLabel}</span>
          <span className="text-[var(--action-primary)]">{platformLabel}</span>
        </div>
      </header>

      <section className="factory-auth-grid">
        <aside className="factory-auth-left">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="factory-auth-metadata">{leftEyebrow}</div>
              <h1 className="max-w-[15ch] text-[clamp(3rem,3.9vw,4.5rem)] font-semibold leading-[0.94] tracking-[-0.045em] text-text-primary">
                {leftTitle}
              </h1>
              <p className="max-w-xl text-sm leading-6 text-text-secondary">{leftDescription}</p>
            </div>

            <div className="factory-auth-card factory-auth-card--support">
              <div className="flex items-center gap-3 border-b border-border-subtle pb-3">
                <ShieldCheck className="h-4 w-4 text-status-success-icon" />
                <div className="factory-auth-metadata text-status-success-fg">{statusValue}</div>
              </div>

              <div className="mt-4 space-y-4 text-sm text-text-secondary">
                {supportItems.map((item, index) => (
                  <div key={index} className="flex gap-3">
                    <span className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary">{item.icon}</span>
                    <div>{item.text}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-[1.18fr_0.82fr] gap-4">
              <div className="factory-auth-card">
                <div className="factory-auth-metadata">Provisioning workflow</div>
                <div className="mt-4 space-y-4">
                  {steps.map((step, index) => (
                    <div key={`${step.title}-${index}`} className="flex gap-3">
                      <div className="factory-auth-step-index">
                        {String(index + 1).padStart(2, "0")}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-text-primary">{step.title}</div>
                        <div className="mt-1 text-sm leading-6 text-text-secondary">{step.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="factory-auth-card">
                <div className="factory-auth-metadata">{statusLabel}</div>
                <div className="mt-5 flex gap-2">
                  <StatusRail active />
                  <StatusRail active />
                  <StatusRail active={false} />
                </div>

                <div className="mt-6 space-y-4 text-sm text-text-secondary">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">Security posture</div>
                    <div className="mt-1 text-sm font-medium text-text-primary">{supportTitle}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">Operational note</div>
                    <div className="mt-1 text-sm text-text-secondary">{supportDescription}</div>
                  </div>
                  {metrics.map((metric) => (
                    <div key={metric.label}>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">{metric.label}</div>
                      <div className="mt-1 text-sm font-medium text-text-primary">{metric.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-8 text-[11px] uppercase tracking-[0.22em] text-text-secondary">
            <AlertTriangle className="h-3.5 w-3.5" />
            Emergency sysadmin: ext 4092
          </div>
        </aside>

        <section className="flex min-h-full items-center justify-center">
          <div className={cn("factory-auth-panel", panelClassName)}>
            <div className="border-b border-border-subtle pb-5">
              <div className="text-center">
                <div className="inline-flex rounded-control border border-border-default bg-surface-shell px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary">
                  {badge}
                </div>
              </div>
              <h2 className="mt-4 text-center text-[2rem] font-semibold tracking-[-0.03em] text-text-primary">
                {title}
              </h2>
              <p className="mx-auto mt-3 max-w-[48ch] text-center text-sm leading-6 text-text-secondary">
                {description}
              </p>
              {rightHeaderSlot ? <div className="mt-4">{rightHeaderSlot}</div> : null}
            </div>

            <div className={cn("mt-6", contentClassName)}>{children}</div>
          </div>
        </section>
      </section>
    </main>
  );
}
