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
  steps?: AuthWorkstationStep[];
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
  /** minimal = form-first (login/recovery); standard = onboarding (register) */
  sidePanel?: "minimal" | "standard";
};

function StatusRail({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "h-1 flex-1 rounded-full border border-border-subtle/80",
        active ? "bg-status-success-icon shadow-xs" : "bg-surface-elevated",
      )}
      aria-hidden
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
  steps = [],
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
  sidePanel = "minimal",
}: AuthWorkstationShellProps) {
  const showFullSidePanel = sidePanel === "standard";

  return (
    <main className="factory-auth-scope factory-auth-shell">
      {/* Ambient Forge Overlays */}
      <div className="factory-auth-noise" />
      <div className="factory-auth-glow factory-auth-glow--orange" />
      <div className="factory-auth-glow factory-auth-glow--blue" />

      <header className="factory-auth-topbar">
        <Link href={homeHref} className="inline-flex items-center gap-3 text-text-primary">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-border-default bg-surface-panel shadow-xs">
            <Building2 className="h-4 w-4 text-accent-orange-amber" />
          </div>
          <span className="font-display text-lg font-bold uppercase tracking-wider">{homeLabel}</span>
        </Link>

        <div className="hidden items-center gap-6 text-label-dense font-mono font-medium text-text-secondary sm:flex">
          <span>{topMetaLabel}</span>
          <span className="text-accent-orange-amber font-semibold uppercase">{platformLabel}</span>
        </div>
      </header>

      <section className="factory-auth-grid">
        <aside className="factory-auth-left" aria-label="System context">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-label-dense font-mono font-medium text-text-tertiary">{leftEyebrow}</p>
              <h1 className="max-w-[22ch] font-display text-2xl font-bold uppercase tracking-wider leading-snug text-text-primary">
                {leftTitle}
              </h1>
              <p className="max-w-md text-body leading-6 text-text-secondary">{leftDescription}</p>
            </div>

            <div className="factory-auth-card factory-auth-card--support">
              <div className="flex items-center gap-3 border-b border-border-default pb-3">
                <ShieldCheck className="h-4 w-4 text-status-success-icon" />
                <p className="text-label font-mono font-medium text-status-success-fg uppercase tracking-wider">{statusValue}</p>
              </div>

              <ul className="mt-4 space-y-3 text-sm text-text-secondary">
                {supportItems.map((item, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary">{item.icon}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {showFullSidePanel ? (
              <div className="grid gap-4 lg:grid-cols-[1.18fr_0.82fr]">
                <div className="factory-auth-card">
                  <p className="text-label-dense font-mono font-medium text-text-tertiary uppercase tracking-wider">Provisioning workflow</p>
                  <ol className="mt-4 space-y-4">
                    {steps.map((step, index) => (
                      <li key={`${step.title}-${index}`} className="flex gap-3">
                        <div className="factory-auth-step-index" aria-hidden>
                          {String(index + 1).padStart(2, "0")}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{step.title}</p>
                          <p className="mt-1 text-sm leading-6 text-text-secondary">{step.description}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="factory-auth-card">
                  <p className="text-label-dense font-mono font-medium text-text-tertiary uppercase tracking-wider">{statusLabel}</p>
                  <div className="mt-4 flex gap-2" role="presentation">
                    <StatusRail active />
                    <StatusRail active />
                    <StatusRail active={false} />
                  </div>

                  <div className="mt-5 space-y-4 text-sm text-text-secondary">
                    <div>
                      <p className="text-label-dense font-mono text-text-tertiary">Security posture</p>
                      <p className="mt-1 font-semibold text-text-primary">{supportTitle}</p>
                    </div>
                    <div>
                      <p className="text-label-dense font-mono text-text-tertiary">Operational note</p>
                      <p className="mt-1">{supportDescription}</p>
                    </div>
                    {metrics.map((metric) => (
                      <div key={metric.label}>
                        <p className="text-label-dense font-mono text-text-tertiary">{metric.label}</p>
                        <p className="mt-1 font-semibold text-text-primary">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="factory-auth-card">
                <p className="text-label-dense font-mono font-medium text-text-tertiary uppercase tracking-wider">{statusLabel}</p>
                <div className="mt-3 flex gap-2" role="presentation">
                  <StatusRail active />
                  <StatusRail active />
                  <StatusRail active={false} />
                </div>
                {metrics.length > 0 ? (
                  <dl className="mt-4 space-y-3">
                    {metrics.map((metric) => (
                      <div key={metric.label}>
                        <dt className="text-label-dense font-mono text-text-tertiary">{metric.label}</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-text-primary">{metric.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            )}
          </div>

          <p className="factory-auth-footer-note flex items-center gap-2 pt-6 text-label-dense font-mono text-text-tertiary">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Emergency sysadmin: ext 4092
          </p>
        </aside>

        <section className="factory-auth-form-column">
          <div className={cn("factory-auth-panel", panelClassName)}>
            <header className="border-b border-border-default pb-5">
              <div className="text-center">
                <span className="inline-flex rounded-control border border-border-default bg-surface-shell px-3 py-1 text-label-dense font-mono font-medium text-text-secondary uppercase tracking-wider">
                  {badge}
                </span>
              </div>
              <h2 className="mt-4 text-center font-display text-2xl font-bold uppercase tracking-wider text-text-primary">
                {title}
              </h2>
              <p className="mx-auto mt-3 max-w-[48ch] text-center text-body leading-6 text-text-secondary">
                {description}
              </p>
              {rightHeaderSlot ? <div className="mt-4">{rightHeaderSlot}</div> : null}
            </header>

            <div className={cn("mt-6", contentClassName)}>{children}</div>
          </div>
        </section>
      </section>
    </main>
  );
}
