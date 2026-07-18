import * as React from "react";

import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Supporting line under the value (aka `hint`/`detail` in old local copies). */
  hint?: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
};

/**
 * Shared KPI/metric card. Consolidates the local `MetricCard` copies in
 * report-insights-board and ocr-verification-v2. `hint` and `detail` are aliases.
 */
export function MetricCard({ label, value, hint, detail, className }: MetricCardProps) {
  const support = hint ?? detail;
  return (
    <div
      className={cn(
        "rounded-[1.5rem] border border-[var(--border)] bg-[var(--card-strong)] p-4",
        className,
      )}
    >
      <div className="text-xs uppercase tracking-caption text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[var(--text)]">{value}</div>
      {support ? (
        <div className="mt-2 text-xs leading-5 text-[var(--muted)]">{support}</div>
      ) : null}
    </div>
  );
}
