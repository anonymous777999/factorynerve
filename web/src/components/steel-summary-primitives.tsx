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
  if (tone === "critical") return "border-[#fecaca] bg-[#fff7f7] text-[#991b1b]";
  if (tone === "watch") return "border-[#fed7aa] bg-[#fffaf3] text-[#9a3412]";
  return "border-[#bbf7d0] bg-[#f4fbf7] text-[#166534]";
}

function toneAccentClasses(tone: SteelStatusTone) {
  if (tone === "critical") return "border-[#fca5a5] bg-[#991b1b] text-white";
  if (tone === "watch") return "border-[#fdba74] bg-[#d97706] text-white";
  return "border-[#86efac] bg-[#0f766e] text-white";
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
                ? "!border-[#d6d3d1] !bg-[#f5f5f4] !text-[#111111]"
                : "!border-[#111111] !bg-[#111111] !text-white",
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
      <div className="rounded-[1.5rem] border border-[#e7e5e4] bg-white p-4 shadow-[0_12px_30px_rgba(17,17,17,0.06)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#78716c]">Overall Status</div>
        <div className="mt-3">
          <MetricBadge tone={overallStatus.tone} label={overallStatus.label} />
        </div>
        <div className="mt-3 text-base font-semibold text-[#111111]">{overallStatus.reason}</div>
        <div className="mt-2 text-sm leading-6 text-[#57534e]">{overallStatus.nextStep}</div>
      </div>
      <div className="rounded-[1.5rem] border border-[#e7e5e4] bg-white p-4 shadow-[0_12px_30px_rgba(17,17,17,0.06)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#78716c]">Top Priority</div>
        <div className="mt-3">
          <MetricBadge tone={topPriority.tone} label={topPriority.statusLabel} />
        </div>
        <div className="mt-3 text-base font-semibold text-[#111111]">{topPriority.reason}</div>
        <div className="mt-2 text-sm leading-6 text-[#57534e]">{topPriority.nextStep}</div>
      </div>
      <div className="rounded-[1.5rem] border border-[#e7e5e4] bg-white p-4 shadow-[0_12px_30px_rgba(17,17,17,0.06)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#78716c]">Data Confidence</div>
        <div className="mt-3">
          <SteelConfidenceBadge summary={confidence} />
        </div>
        <div className="mt-3 text-base font-semibold text-[#111111]">{confidence.reason}</div>
        <div className="mt-2 text-sm leading-6 text-[#57534e]">{confidence.nextStep}</div>
      </div>
      <div className="rounded-[1.5rem] border border-[#e7e5e4] bg-white p-4 shadow-[0_12px_30px_rgba(17,17,17,0.06)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#78716c]">Time Context</div>
        <div className="mt-3">
          <MetricBadge tone="good" label={timeContext} />
        </div>
        <div className="mt-3 text-base font-semibold text-[#111111]">All KPI comparisons use explicit period context.</div>
        <div className="mt-2 text-sm leading-6 text-[#57534e]">Read the KPI trend row to see whether the latest steel movement is better, worse, or flat against the prior period.</div>
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
        "rounded-[1.8rem] border border-[#e7e5e4] bg-white p-5 shadow-[0_18px_40px_rgba(17,17,17,0.07)]",
        "!border-[#e7e5e4] !bg-white !text-[#111111]",
        className,
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#78716c]">{eyebrow}</div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <MetricBadge tone={priority.tone} label={priority.statusLabel} />
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-[#111111]">{priority.reason}</div>
      <div className="mt-3 text-sm leading-7 text-[#57534e]">{priority.nextStep}</div>
      <SteelQuickActionRow
        className="mt-5"
        actions={[priority.primaryAction, ...(priority.secondaryAction ? [priority.secondaryAction] : [])]}
      />
    </div>
  );
}
