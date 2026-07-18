"use client";

import { cn } from "@/lib/utils";
import type { CrossValidationResult } from "@/lib/ocr";

function bandConfig(band: CrossValidationResult["band"]) {
  switch (band) {
    case "low":
      return {
        icon: "🚫",
        title: "Cross-validation failed — values may be unreliable",
        border: "border-red-500/40",
        bg: "bg-[rgba(239,68,68,0.08)]",
        text: "text-red-100",
        accent: "text-red-300",
        dot: "bg-red-400",
      };
    case "medium":
      return {
        icon: "⚠️",
        title: "Cross-validation found discrepancies — review recommended",
        border: "border-amber-400/40",
        bg: "bg-[rgba(245,158,11,0.08)]",
        text: "text-amber-100",
        accent: "text-amber-300",
        dot: "bg-amber-400",
      };
    case "high":
      return {
        icon: "✅",
        title: "Cross-validation passed — all numeric values agree",
        border: "border-emerald-400/30",
        bg: "bg-[rgba(34,197,94,0.08)]",
        text: "text-emerald-100",
        accent: "text-emerald-300",
        dot: "bg-emerald-400",
      };
    default:
      return {
        icon: "ℹ️",
        title: "Cross-validation skipped — no numeric data to compare",
        border: "border-[var(--accent-soft)]",
        bg: "bg-[rgba(56,189,248,0.08)]",
        text: "text-[var(--accent)]",
        accent: "text-[var(--accent)]",
        dot: "bg-[var(--accent)]",
      };
  }
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

export function CrossValidationBanner({
  data,
  className,
}: {
  data: CrossValidationResult;
  className?: string;
}) {
  const cfg = bandConfig(data.band);
  const hasDiscrepancies = data.disagreeing_cells > 0;
  const isCritical = data.critical_discrepancies > 0;

  return (
    <div
      className={cn(
        "rounded-[1.35rem] border-2 px-5 py-4 text-sm shadow-sm",
        cfg.border,
        cfg.bg,
        cfg.text,
        className,
      )}
    >
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="text-xl">{cfg.icon}</span>
          <div className="flex-1">
            <div className="font-semibold">{cfg.title}</div>
            <div className="mt-1 text-xs opacity-90">
              {data.total_numeric_cells > 0
                ? `${data.agreeing_cells}/${data.total_numeric_cells} numeric values match (${formatPct(data.score)} agreement)`
                : "No numeric cells found to compare"}
            </div>
          </div>
        </div>

        {/* Stats row */}
        {data.total_numeric_cells > 0 && (
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-current/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-label">
              <span className={cn("h-2 w-2 rounded-full", cfg.dot)} />
              {formatPct(data.score)} agreement
            </span>
            {hasDiscrepancies && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-label text-red-100">
                {data.disagreeing_cells} discrepancy
                {data.disagreeing_cells !== 1 ? "ies" : ""}
              </span>
            )}
            {isCritical && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-[rgba(239,68,68,0.16)] px-3 py-1 text-[11px] font-semibold uppercase tracking-label text-red-50">
                {data.critical_discrepancies} critical
              </span>
            )}
            {data.ai_only_values && data.ai_only_values.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-[rgba(245,158,11,0.1)] px-3 py-1 text-[11px] font-semibold uppercase tracking-label text-amber-100">
                {data.ai_only_values.length} AI-only
              </span>
            )}
          </div>
        )}

        {/* Warnings list */}
        {data.warnings.length > 0 && (
          <div className="space-y-1">
            {data.warnings.map((warning, index) => (
              <div key={index} className="flex items-start gap-2 text-xs opacity-90">
                <span className="mt-0.5 shrink-0">•</span>
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}

        {/* Critical discrepancies detail */}
        {isCritical && data.discrepancies.filter((d) => d.critical).length > 0 && (
          <details className="rounded-[1rem] border border-red-400/20 bg-[rgba(0,0,0,0.2)] px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-label opacity-80">
              View critical discrepancies
            </summary>
            <div className="mt-2 space-y-2">
              {data.discrepancies
                .filter((d) => d.critical)
                .slice(0, 10)
                .map((disc, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3 rounded-lg border border-red-400/20 bg-[rgba(239,68,68,0.06)] px-3 py-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold">{disc.header}</span>
                      <span className="opacity-60">
                        {" "}
                        · Row {disc.row + 1} · Col {disc.col + 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="opacity-60 line-through">
                        {disc.base_value}
                      </span>
                      <span className="font-semibold">{disc.ai_value}</span>
                      {disc.diff_pct != null && (
                        <span className="rounded-full border border-red-400/30 bg-[rgba(239,68,68,0.1)] px-2 py-0.5 text-[10px] font-bold">
                          {disc.diff_pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              {data.discrepancies.filter((d) => d.critical).length > 10 && (
                <div className="text-xs opacity-60">
                  +{data.discrepancies.filter((d) => d.critical).length - 10} more critical
                  {data.discrepancies.filter((d) => d.critical).length - 10 === 1 ? "" : "s"}
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
