"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type AnomalyStripProps = {
    count: number;
    topMessage?: string | null;
    reviewHref?: string;
    className?: string;
};

/**
 * AnomalyStrip — the owner-facing red banner at the top of the dashboard.
 *
 * Renders nothing when count is 0. Use the anomaly-strip pattern across:
 *   - /dashboard (owner)
 *   - /control-tower
 *   - /reports (when anomaly count > 0)
 *
 * This is the "one signal that matters" surface. Never use it for warnings
 * or info — it's reserved for active operational anomalies.
 */
export function AnomalyStrip({
    count,
    topMessage,
    reviewHref = "/ai",
    className,
}: AnomalyStripProps) {
    if (count <= 0) return null;

    return (
        <div
            role="alert"
            className={cn(
                "rounded-xl border px-4 py-3 animate-fade-in",
                "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)]",
                className,
            )}
        >
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                    <span
                        className="mt-1 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: "var(--status-danger-icon)" }}
                        aria-hidden="true"
                    />
                    <div className="min-w-0">
                        <div
                            className="text-sm font-semibold"
                            style={{ color: "var(--status-danger-fg)" }}
                        >
                            {count} operational signal{count === 1 ? "" : "s"} need attention
                        </div>
                        {topMessage ? (
                            <div
                                className="mt-0.5 truncate text-xs"
                                style={{ color: "var(--status-danger-fg)", opacity: 0.85 }}
                            >
                                {topMessage}
                            </div>
                        ) : null}
                    </div>
                </div>
                <Link href={reviewHref} className="shrink-0">
                    <button
                        type="button"
                        className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 text-xs font-semibold text-[var(--status-danger-fg)] hover:brightness-110"
                    >
                        Review now
                    </button>
                </Link>
            </div>
        </div>
    );
}
