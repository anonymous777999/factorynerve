"use client";

import { cn } from "@/lib/utils";

type ConfidenceMeterProps = {
    /** Confidence in [0, 1]. */
    value: number;
    /** Optional override of the band thresholds. */
    thresholds?: {
        high: number; // default 0.85
        medium: number; // default 0.6
    };
    /** Show the percentage label inline. */
    showLabel?: boolean;
    /** Compact (h-1) or default (h-1.5). */
    size?: "compact" | "default";
    className?: string;
    ariaLabel?: string;
};

const DEFAULT_THRESHOLDS = { high: 0.85, medium: 0.6 } as const;

/**
 * ConfidenceMeter — visual bar for AI-produced values.
 *
 * Color tier:
 *   ≥ 0.85 → success (green)
 *   ≥ 0.6  → warning (amber)
 *   < 0.6  → danger (red)
 *
 * This is the canonical confidence visual. Use it everywhere a 0–100%
 * value is shown for an AI extraction. Don't reinvent the color mapping.
 */
export function ConfidenceMeter({
    value,
    thresholds = DEFAULT_THRESHOLDS,
    showLabel = false,
    size = "default",
    className,
    ariaLabel,
}: ConfidenceMeterProps) {
    const safe = Math.max(0, Math.min(1, value));
    const percent = Math.round(safe * 100);
    const fill =
        safe >= thresholds.high
            ? "var(--status-success-icon)"
            : safe >= thresholds.medium
                ? "var(--status-warning-icon)"
                : "var(--status-danger-icon)";

    return (
        <div
            role="meter"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={ariaLabel ?? `${percent}% confidence`}
            className={cn("min-w-0", className)}
        >
            {showLabel ? (
                <div className="mb-1 flex items-center justify-between text-xs text-text-tertiary">
                    <span>Confidence</span>
                    <span className="tabular-nums font-semibold text-text-primary">{percent}%</span>
                </div>
            ) : null}
            <div
                className={cn(
                    "overflow-hidden rounded-full bg-[var(--surface-elevated)]",
                    size === "compact" ? "h-1" : "h-1.5",
                )}
            >
                <div
                    className="h-full rounded-full transition-[width] duration-150"
                    style={{
                        width: `${Math.max(2, percent)}%`,
                        background: fill,
                    }}
                />
            </div>
        </div>
    );
}

export function getConfidenceTone(value: number, thresholds = DEFAULT_THRESHOLDS) {
    if (value >= thresholds.high) return "success" as const;
    if (value >= thresholds.medium) return "warning" as const;
    return "danger" as const;
}
