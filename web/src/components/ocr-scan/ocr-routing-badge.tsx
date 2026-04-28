"use client";

import type { OcrRoutingMeta } from "@/lib/ocr";
import { cn } from "@/lib/utils";

type OcrRoutingBadgeProps = {
  routing?: OcrRoutingMeta | null;
};

function tierTone(tier: OcrRoutingMeta["model_tier"]) {
  switch (tier) {
    case "best":
      return "border-emerald-400/30 bg-emerald-400/12 text-emerald-100";
    case "balanced":
      return "border-amber-400/30 bg-amber-400/12 text-amber-100";
    default:
      return "border-sky-400/30 bg-sky-400/12 text-sky-100";
  }
}

export function OcrRoutingBadge({ routing }: OcrRoutingBadgeProps) {
  if (!routing) return null;
  const providerLabel =
    routing.provider_used === "anthropic"
      ? "Anthropic AI"
      : routing.provider_used === "bytez"
        ? "Bytez AI"
        : "Local OCR";
  return (
    <div className="flex flex-wrap gap-2">
      <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]", tierTone(routing.model_tier))}>
        {providerLabel}
      </span>
      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-300">
        {routing.model_tier}
      </span>
      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-300">
        Clarity {Math.round(routing.clarity_score)}%
      </span>
      <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-300">
        ${routing.actual_cost_usd.toFixed(4)}
      </span>
    </div>
  );
}
