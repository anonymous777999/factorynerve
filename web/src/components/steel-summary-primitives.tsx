"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import type {
  SteelConfidenceSummary,
  SteelPrioritySummary,
  SteelQuickAction,
  SteelStatusTone,
} from "@/lib/steel-decision";

function toneClasses(tone: SteelStatusTone) {
  if (tone === "critical") return "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]";
  if (tone === "watch") return "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]";
  return "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-fg)]";
}

function toneAccentClasses(tone: SteelStatusTone) {
  if (tone === "critical") return "border-[var(--status-danger-border)] bg-[var(--status-danger-fg)] text-[var(--text-inverse)]";
  if (tone === "watch") return "border-[var(--status-warning-border)] bg-[var(--status-warning-icon)] text-[var(--text-inverse)]";
  return "border-[var(--status-success-border)] bg-[var(--status-success-icon)] text-[var(--text-inverse)]";
}

function toneSymbol(tone: SteelStatusTone) {
  if (tone === "critical") return "!";
  if (tone === "watch") return "~";
  return "OK";
}

function MetricBadge({ tone, label }: { tone: SteelStatusTone; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.02em]",
        toneClasses(tone),
      )}
    >
      <span
        className={cn(
          "inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1 text-[10px] font-bold leading-none",
          toneAccentClasses(tone),
        )}
      >
        {toneSymbol(tone)}
      </span>
      {label}
    </span>
  );
}

export function SteelConfidenceBadge({ summary }: { summary: SteelConfidenceSummary }) {
  return <MetricBadge tone={summary.tone} label={`Confidence ${summary.label}`} />;
}

export function SteelQuickActionRow({
  actions,
  className,
}: {
  actions: SteelQuickAction[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {actions.map((action) => (
        <Link key={`${action.href}:${action.label}`} href={action.href}>
          <span
            className={cn(
              "inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold tracking-[-0.01em] transition duration-200",
              action.variant === "secondary"
                ? "!border-[var(--action-secondary-border)] !bg-[var(--action-secondary)] !text-[var(--action-secondary-text)]"
                : "!border-[var(--action-primary)] !bg-[var(--action-primary)] !text-[var(--action-primary-text)]",
            )}
          >
            {action.label}
          </span>
        </Link>
      ))}
    </div>
  );
}

export function SteelStatusStrip({
  overallStatus,
  topPriority,
  confidence,
  timeContext,
}: {
  overallStatus: { tone: SteelStatusTone; label: string; reason: string; nextStep: string };
  topPriority: SteelPrioritySummary;
  confidence: SteelConfidenceSummary;
  timeContext: string;
}) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-[1.5rem] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-sm)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-tertiary)]">Overall Status</div>
        <div className="mt-3">
          <MetricBadge tone={overallStatus.tone} label={overallStatus.label} />
        </div>
        <div className="mt-3 text-base font-semibold text-[var(--text-primary)]">{overallStatus.reason}</div>
        <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{overallStatus.nextStep}</div>
      </div>
      <div className="rounded-[1.5rem] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-sm)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-tertiary)]">Top Priority</div>
        <div className="mt-3">
          <MetricBadge tone={topPriority.tone} label={topPriority.statusLabel} />
        </div>
        <div className="mt-3 text-base font-semibold text-[var(--text-primary)]">{topPriority.reason}</div>
        <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{topPriority.nextStep}</div>
      </div>
      <div className="rounded-[1.5rem] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-sm)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-tertiary)]">Data Confidence</div>
        <div className="mt-3">
          <SteelConfidenceBadge summary={confidence} />
        </div>
        <div className="mt-3 text-base font-semibold text-[var(--text-primary)]">{confidence.reason}</div>
        <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{confidence.nextStep}</div>
      </div>
      <div className="rounded-[1.5rem] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-sm)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-tertiary)]">Time Context</div>
        <div className="mt-3">
          <MetricBadge tone="good" label={timeContext} />
        </div>
        <div className="mt-3 text-base font-semibold text-[var(--text-primary)]">All KPI comparisons use explicit period context.</div>
        <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Read the KPI trend row to see whether the latest steel movement is better, worse, or flat against the prior period.</div>
      </div>
    </section>
  );
}

export function SteelTopPriorityCard({
  priority,
  eyebrow = "Top Priority",
  className,
}: {
  priority: SteelPrioritySummary;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.8rem] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5 shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[var(--text-tertiary)]">{eyebrow}</div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <MetricBadge tone={priority.tone} label={priority.statusLabel} />
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{priority.reason}</div>
      <div className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{priority.nextStep}</div>
      <SteelQuickActionRow
        className="mt-5"
        actions={[priority.primaryAction, ...(priority.secondaryAction ? [priority.secondaryAction] : [])]}
      />
    </div>
  );
}
