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
  if (tone === "critical") return "border-red-400/30 bg-[rgba(239,68,68,0.12)] text-red-200";
  if (tone === "watch") return "border-amber-400/30 bg-[rgba(245,158,11,0.12)] text-amber-100";
  return "border-emerald-400/30 bg-[rgba(34,197,94,0.12)] text-emerald-100";
}

function toneAccentClasses(tone: SteelStatusTone) {
  if (tone === "critical") return "border-red-400/30 bg-red-500 text-white";
  if (tone === "watch") return "border-amber-400/30 bg-amber-500 text-white";
  return "border-emerald-400/30 bg-emerald-600 text-white";
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
              "inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold tracking-tight transition duration-200",
              action.variant === "secondary"
                ? "border-[var(--border)] bg-[var(--card-strong)] text-[var(--text)]"
                : "border-[var(--accent)] bg-[var(--accent)] text-[#06111c]",
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
      <div className="rounded-card border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-md)]">
        <div className="text-[11px] font-semibold uppercase tracking-header text-[var(--muted)]">Overall Status</div>
        <div className="mt-3">
          <MetricBadge tone={overallStatus.tone} label={overallStatus.label} />
        </div>
        <div className="mt-3 text-base font-semibold text-[var(--text)]">{overallStatus.reason}</div>
        <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{overallStatus.nextStep}</div>
      </div>
      <div className="rounded-card border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-md)]">
        <div className="text-[11px] font-semibold uppercase tracking-header text-[var(--muted)]">Top Priority</div>
        <div className="mt-3">
          <MetricBadge tone={topPriority.tone} label={topPriority.statusLabel} />
        </div>
        <div className="mt-3 text-base font-semibold text-[var(--text)]">{topPriority.reason}</div>
        <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{topPriority.nextStep}</div>
      </div>
      <div className="rounded-card border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-md)]">
        <div className="text-[11px] font-semibold uppercase tracking-header text-[var(--muted)]">Data Confidence</div>
        <div className="mt-3">
          <SteelConfidenceBadge summary={confidence} />
        </div>
        <div className="mt-3 text-base font-semibold text-[var(--text)]">{confidence.reason}</div>
        <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{confidence.nextStep}</div>
      </div>
      <div className="rounded-card border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-md)]">
        <div className="text-[11px] font-semibold uppercase tracking-header text-[var(--muted)]">Time Context</div>
        <div className="mt-3">
          <MetricBadge tone="good" label={timeContext} />
        </div>
        <div className="mt-3 text-base font-semibold text-[var(--text)]">All KPI comparisons use explicit period context.</div>
        <div className="mt-2 text-sm leading-6 text-[var(--muted)]">Read the KPI trend row to see whether the latest steel movement is better, worse, or flat against the prior period.</div>
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
        "rounded-card border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-md)]",
        className,
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-prominent text-[var(--muted)]">{eyebrow}</div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <MetricBadge tone={priority.tone} label={priority.statusLabel} />
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-tight text-[var(--text)]">{priority.reason}</div>
      <div className="mt-3 text-sm leading-7 text-[var(--muted)]">{priority.nextStep}</div>
      <SteelQuickActionRow
        className="mt-5"
        actions={[priority.primaryAction, ...(priority.secondaryAction ? [priority.secondaryAction] : [])]}
      />
    </div>
  );
}
