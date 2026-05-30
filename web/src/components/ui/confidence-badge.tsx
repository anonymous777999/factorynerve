import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Confidence Level Badge - Sprint 2 Task 23
 *
 * Surfaces AI confidence on insights, OCR results, and other AI-derived
 * outputs using calm color-coded indicators.
 *
 * Color mapping (per visual doctrine + Sprint 2 Task 4 tokens):
 *  - high   → green  (#22c55e via --confidence-high-fg)
 *  - medium → amber  (#f59e0b via --confidence-medium-fg)
 *  - low    → slate  (#64748b via --confidence-low-fg)
 *
 * Rules:
 *  - Sentence case labels (no UPPERCASE)
 *  - No pulsing/glow effects
 *  - 1px border, subtle tinted background
 *  - Foreground text uses the wired Tailwind utilities
 *    (text-confidence-high-fg / -medium-fg / -low-fg)
 */
export type ConfidenceLevel = "high" | "medium" | "low";

const levelLabel: Record<ConfidenceLevel, string> = {
    high: "High confidence",
    medium: "Medium confidence",
    low: "Low confidence",
};

// Tinted backgrounds and borders use direct rgba so the opacity behaves
// consistently across Tailwind versions (var() + opacity-modifier syntax
// is unreliable in arbitrary values).
const levelClassNames: Record<ConfidenceLevel, string> = {
    // #22c55e (green-500)
    high: "border-[rgba(34,197,94,0.30)] bg-[rgba(34,197,94,0.10)] text-confidence-high-fg",
    // #f59e0b (amber-500)
    medium:
        "border-[rgba(245,158,11,0.30)] bg-[rgba(245,158,11,0.10)] text-confidence-medium-fg",
    // #64748b (slate-500)
    low: "border-[rgba(100,116,139,0.30)] bg-[rgba(100,116,139,0.10)] text-confidence-low-fg",
};

const dotClassNames: Record<ConfidenceLevel, string> = {
    high: "bg-confidence-high-fg",
    medium: "bg-confidence-medium-fg",
    low: "bg-confidence-low-fg",
};

const baseClassName =
    "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-[4px] border px-[8px] py-[2px] text-[length:var(--text-xs)] font-medium tracking-[var(--tracking-wide)]";

export type ConfidenceBadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
    level: ConfidenceLevel;
    /** When provided, replaces the default "X confidence" label. */
    label?: string;
    /** Hide the leading dot indicator. Defaults to false. */
    hideIndicator?: boolean;
};

export function ConfidenceBadge({
    className,
    hideIndicator = false,
    label,
    level,
    ...props
}: ConfidenceBadgeProps) {
    return (
        <span
            className={cn(baseClassName, levelClassNames[level], className)}
            data-confidence={level}
            {...props}
        >
            {hideIndicator ? null : (
                <span
                    aria-hidden="true"
                    className={cn("h-2 w-2 shrink-0 rounded-full", dotClassNames[level])}
                />
            )}
            <span className="truncate">{label ?? levelLabel[level]}</span>
        </span>
    );
}

/**
 * Map a numeric confidence score (0-100) to a confidence level.
 *
 * Thresholds tuned for OCR/AI workflows:
 *   >= 85  → high
 *   >= 60  → medium
 *   else   → low
 */
export function confidenceLevelFromScore(
    score: number | null | undefined,
): ConfidenceLevel {
    if (typeof score !== "number" || Number.isNaN(score)) return "low";
    if (score >= 85) return "high";
    if (score >= 60) return "medium";
    return "low";
}

/**
 * Truncate AI reasoning text to 280 characters for display in compact panels.
 * Adds an ellipsis when truncation occurs and trims trailing whitespace.
 */
export function truncateReasoning(text: string, max = 280): string {
    if (!text) return "";
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1).trimEnd()}…`;
}
