"use client";

import { cn } from "@/lib/utils";

export type RecordReviewTone = "approved" | "pending" | "flagged" | "unreviewed";

function defaultLabel(tone: RecordReviewTone) {
  switch (tone) {
    case "approved":
      return "Locked approved record";
    case "pending":
      return "Pending review";
    case "flagged":
      return "Flagged for attention";
    default:
      return "Unreviewed record";
  }
}

export function recordReviewToneFromStatus(status?: string | null): RecordReviewTone {
  switch ((status || "").toLowerCase()) {
    case "approved":
      return "approved";
    case "pending":
    case "submitted":
    case "pending_review":
      return "pending";
    case "rejected":
    case "flagged":
      return "flagged";
    default:
      return "unreviewed";
  }
}

export function recordReviewAccentClass(tone: RecordReviewTone) {
  switch (tone) {
    case "approved":
      return "border-l-emerald-400";
    case "pending":
      return "border-l-amber-400";
    case "flagged":
      return "border-l-red-400";
    default:
      return "border-l-sky-400";
  }
}

export function recordReviewAccentFillClass(tone: RecordReviewTone) {
  switch (tone) {
    case "approved":
      return "bg-emerald-400";
    case "pending":
      return "bg-amber-400";
    case "flagged":
      return "bg-red-400";
    default:
      return "bg-sky-400";
  }
}

export function recordReviewSurfaceClass(tone: RecordReviewTone, interactive = false) {
  return cn(
    "border-l-4 transition",
    recordReviewAccentClass(tone),
    tone === "approved"
      ? "border border-emerald-400/25 bg-[rgba(34,197,94,0.08)]"
      : tone === "pending"
        ? "border border-amber-400/25 bg-[rgba(245,158,11,0.08)]"
        : tone === "flagged"
          ? "border border-red-400/25 bg-[rgba(239,68,68,0.08)]"
          : "border border-sky-400/25 bg-[rgba(56,189,248,0.08)]",
    interactive && tone !== "approved" ? "hover:-translate-y-0.5" : "",
  );
}

export function recordReviewBadgeClass(tone: RecordReviewTone) {
  switch (tone) {
    case "approved":
      return "border-emerald-400/35 bg-emerald-400/12 text-emerald-100";
    case "pending":
      return "border-amber-400/35 bg-amber-400/12 text-amber-100";
    case "flagged":
      return "border-red-400/35 bg-red-400/12 text-red-100";
    default:
      return "border-sky-400/35 bg-sky-400/12 text-sky-100";
  }
}

export function recordReviewActionClass(tone: RecordReviewTone) {
  return tone === "approved" ? "opacity-80" : "";
}

type RecordReviewStateNoteProps = {
  tone: RecordReviewTone;
  detail: string;
  label?: string;
  className?: string;
  compact?: boolean;
};

export function RecordReviewStateNote({
  tone,
  detail,
  label,
  className,
  compact = false,
}: RecordReviewStateNoteProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2",
        recordReviewBadgeClass(tone),
        compact ? "text-[11px]" : "text-xs",
        className,
      )}
    >
      <div className="font-semibold uppercase tracking-[0.16em]">{label || defaultLabel(tone)}</div>
      <div className={cn("leading-5", compact ? "mt-1" : "mt-1.5")}>{detail}</div>
    </div>
  );
}
