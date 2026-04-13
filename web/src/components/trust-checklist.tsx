"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { type ReportTrustSummary } from "@/lib/report-trust";
import { Button } from "@/components/ui/button";

type TrustChecklistProps = {
  summary: ReportTrustSummary | null;
  loading?: boolean;
  error?: string;
  className?: string;
  title?: string;
  description?: string;
};

function metricTone(isReady: boolean) {
  return isReady
    ? "border-emerald-400/25 bg-[rgba(34,197,94,0.08)]"
    : "border-amber-400/25 bg-[rgba(245,158,11,0.08)]";
}

export function TrustChecklist({
  summary,
  loading = false,
  error,
  className,
  title = "Trust Checklist",
  description = "Review must be complete before anything leaves the factory.",
}: TrustChecklistProps) {
  const ready = Boolean(summary?.can_send);

  return (
    <div className={cn("space-y-4 rounded-3xl border border-border bg-card-elevated p-4", className)}>
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-[0.22em] text-color-primary-light">Trust Gate</div>
        <div className="text-lg font-semibold text-text-primary">{title}</div>
        <div className="text-sm text-text-muted">{description}</div>
      </div>

      {loading && !summary ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-text-muted">
          Checking approval coverage for this report period...
        </div>
      ) : null}

      {error && !summary ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/12 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className={cn("rounded-2xl border p-4", metricTone(summary.ocr.pending_count === 0))}>
              <div className="text-xs uppercase tracking-[0.18em] text-text-muted">OCR reviewed</div>
              <div className="mt-2 text-2xl font-semibold text-text-primary">
                {summary.ocr.approved_count} of {summary.ocr.total_count}
              </div>
              <div className="mt-2 text-sm text-text-muted">
                {summary.ocr.pending_count > 0
                  ? `${summary.ocr.pending_count} pending review`
                  : `${summary.ocr.flagged_count} flagged or rejected`}
              </div>
            </div>
            <div className={cn("rounded-2xl border p-4", metricTone(summary.shift_entries.pending_count === 0))}>
              <div className="text-xs uppercase tracking-[0.18em] text-text-muted">Shift entries</div>
              <div className="mt-2 text-2xl font-semibold text-text-primary">
                {summary.shift_entries.approved_count} of {summary.shift_entries.total_count}
              </div>
              <div className="mt-2 text-sm text-text-muted">
                {summary.shift_entries.pending_count > 0
                  ? `${summary.shift_entries.pending_count} pending review`
                  : `${summary.shift_entries.flagged_count} flagged or rejected`}
              </div>
            </div>
            <div className={cn("rounded-2xl border p-4", metricTone(summary.attendance.pending_count === 0))}>
              <div className="text-xs uppercase tracking-[0.18em] text-text-muted">Attendance</div>
              <div className="mt-2 text-2xl font-semibold capitalize text-text-primary">
                {summary.attendance.status === "reviewed" ? "Reviewed" : "Not reviewed"}
              </div>
              <div className="mt-2 text-sm text-text-muted">
                {summary.attendance.reviewed_count} of {summary.attendance.total_count} records reviewed
              </div>
            </div>
            <div className={cn("rounded-2xl border p-4", metricTone(ready))}>
              <div className="text-xs uppercase tracking-[0.18em] text-text-muted">Overall trust score</div>
              <div className="mt-2 text-2xl font-semibold text-text-primary">{summary.overall_trust_score}%</div>
              <div className="mt-2 text-sm text-text-muted">
                Window {summary.range.start_date} to {summary.range.end_date}
              </div>
            </div>
          </div>

          <div
            className={cn(
              "rounded-2xl border px-4 py-4",
              ready
                ? "border-emerald-400/30 bg-emerald-400/12"
                : "border-amber-400/30 bg-amber-400/12",
            )}
          >
            <div className={cn("text-sm font-medium", ready ? "text-emerald-100" : "text-amber-100")}>
              {ready ? summary.confirmation : summary.blocking_reason}
            </div>
            {summary.next_action ? (
              <div className="mt-3">
                <Link href={summary.next_action.href}>
                  <Button variant={ready ? "outline" : "primary"} className="h-10 w-full sm:w-auto">
                    {summary.next_action.label}
                  </Button>
                </Link>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
