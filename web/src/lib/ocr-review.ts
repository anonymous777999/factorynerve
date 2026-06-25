/**
 * Shared utilities for the OCR review/verification workspace.
 * Extracted from the V1 ocr-verification-page.tsx monolith to keep
 * the V2 codebase clean while providing feature parity.
 */

import {
  getOcrConfidenceTier,
  hasOcrConfidenceSignal,
  stringifyOcrCell,
  type OcrCell,
  type OcrConfidenceMatrix,
  type OcrPreviewResult,
  type OcrVerificationRecord,
} from "@/lib/ocr";

/* ── Types ─────────────────────────────────────────────── */

export type ReviewIssueTone = "critical" | "warning" | "info";
export type ReviewIssueImpact =
  | "billing"
  | "dispatch"
  | "stock"
  | "traceability"
  | "workflow";

export type ReviewIssue = {
  key: string;
  tone: ReviewIssueTone;
  title: string;
  detail: string;
  impact: ReviewIssueImpact;
  affectedValue: string;
  expectedValue: string;
  actionLabel: string;
  helpText: string;
  rowIndex?: number;
  columnIndex?: number;
};

export type MobileReviewTab = "document" | "issues" | "fix";

/* ── Confidence display helpers ────────────────────────── */

export function confidenceLabel(
  confidence?: number | null,
): "Review" | "Check" | "Verified" {
  const tier = getOcrConfidenceTier(confidence ?? undefined);
  if (tier === "review_required") return "Review";
  if (tier === "medium") return "Check";
  return "Verified";
}

export function confidenceBadgeClass(confidence?: number | null): string {
  const tier = getOcrConfidenceTier(confidence ?? undefined);
  if (tier === "review_required")
    return "border-red-400/30 bg-[rgba(239,68,68,0.12)] text-red-100";
  if (tier === "medium")
    return "border-amber-400/30 bg-[rgba(245,158,11,0.12)] text-amber-100";
  return "border-emerald-400/30 bg-[rgba(34,197,94,0.12)] text-emerald-100";
}

export function cellInputClass(
  value: string,
  confidence?: number | null,
): string {
  const tier = getOcrConfidenceTier(confidence ?? undefined);
  if (tier === "review_required") {
    return "border-red-400/50 bg-[rgba(239,68,68,0.15)] text-red-50";
  }
  if (tier === "medium") {
    return "border-amber-400/40 bg-[rgba(245,158,11,0.08)] text-amber-50";
  }
  if (!value.trim()) {
    return "border-amber-400/20 bg-[rgba(245,158,11,0.05)]";
  }
  return "";
}

export function documentConfidenceLabel(
  record: Pick<OcrVerificationRecord, "warnings" | "scan_quality"> | null,
  preview?: Pick<OcrPreviewResult, "warnings" | "scan_quality"> | null,
): string {
  const band =
    preview?.scan_quality?.confidence_band ||
    record?.scan_quality?.confidence_band ||
    "unknown";
  if (band === "low") return "Review";
  if (band === "medium") return "Check";
  if (band === "high") return "Verified";
  const warningCount = Math.max(
    record?.warnings?.length || 0,
    preview?.warnings?.length || 0,
  );
  if (warningCount >= 2) return "Review";
  if (warningCount === 1) return "Check";
  return "Verified";
}

/* ── Status / formatting helpers ───────────────────────── */

export function formatTimestamp(value?: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function actorDisplayName(
  name?: string | null,
  id?: number | null,
): string {
  if (name?.trim()) return name.trim();
  if (id) return `User #${id}`;
  return "Unassigned";
}

export function statusBadgeClass(
  status: string,
  theme: "light" | "dark" = "dark",
): string {
  if (theme === "light") {
    switch (status) {
      case "approved":
        return "border-emerald-200 bg-emerald-50 text-emerald-800";
      case "rejected":
        return "border-red-200 bg-red-50 text-red-800";
      case "pending":
        return "border-amber-200 bg-amber-50 text-amber-800";
      default:
        return "border-sky-200 bg-sky-50 text-sky-800";
    }
  }
  switch (status) {
    case "approved":
      return "border-emerald-400/30 bg-[rgba(34,197,94,0.12)] text-emerald-100";
    case "rejected":
      return "border-red-400/30 bg-[rgba(239,68,68,0.12)] text-red-100";
    case "pending":
      return "border-amber-400/30 bg-[rgba(245,158,11,0.12)] text-amber-100";
    default:
      return "border-sky-400/30 bg-[rgba(56,189,248,0.12)] text-sky-100";
  }
}

/* ── Issue tone/impact helpers ─────────────────────────── */

export function signalTone(
  tone: ReviewIssueTone,
): string {
  switch (tone) {
    case "critical":
      return "border-red-400/30 bg-[rgba(239,68,68,0.1)] text-red-100";
    case "warning":
      return "border-amber-400/30 bg-[rgba(245,158,11,0.08)] text-amber-100";
    default:
      return "border-sky-400/30 bg-[rgba(56,189,248,0.08)] text-sky-100";
  }
}

export function signalToneLight(tone: ReviewIssueTone): string {
  switch (tone) {
    case "critical":
      return "border-red-200 bg-red-50 text-red-800";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-sky-200 bg-sky-50 text-sky-800";
  }
}

export function issueWeight(tone: ReviewIssueTone): number {
  switch (tone) {
    case "critical":
      return 3;
    case "warning":
      return 2;
    default:
      return 1;
  }
}

export function impactTone(
  impact: ReviewIssueImpact,
): string {
  switch (impact) {
    case "billing":
      return "border-cyan-400/30 bg-[rgba(34,211,238,0.12)] text-cyan-100";
    case "dispatch":
      return "border-violet-400/30 bg-[rgba(167,139,250,0.14)] text-violet-100";
    case "stock":
      return "border-amber-400/30 bg-[rgba(245,158,11,0.12)] text-amber-100";
    case "traceability":
      return "border-emerald-400/30 bg-[rgba(34,197,94,0.12)] text-emerald-100";
    default:
      return "border-slate-400/30 bg-[rgba(148,163,184,0.12)] text-slate-100";
  }
}

export function impactLabel(impact: ReviewIssueImpact): string {
  switch (impact) {
    case "billing":
      return "Billing impact";
    case "dispatch":
      return "Dispatch impact";
    case "stock":
      return "Stock impact";
    case "traceability":
      return "Traceability impact";
    default:
      return "Workflow impact";
  }
}

/* ── Issue detection logic ─────────────────────────────── */

function inferIssueImpact(
  label: string,
  detail = "",
): ReviewIssueImpact {
  const text = `${label} ${detail}`.toLowerCase();
  if (
    /(amount|rate|invoice|bill|payment|tax|gst|pan|total|value|price)/.test(
      text,
    )
  ) {
    return "billing";
  }
  if (
    /(truck|vehicle|challan|dispatch|transporter|party|customer)/.test(text)
  ) {
    return "dispatch";
  }
  if (/(weight|qty|quantity|kg|stock|scrap|inventory)/.test(text)) {
    return "stock";
  }
  if (
    /(heat|lot|batch|grade|operator|shift|date|time|machine)/.test(text)
  ) {
    return "traceability";
  }
  return "workflow";
}

function looksSuspiciousValue(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (text.includes("??") || text.includes("__") || text.includes("||"))
    return true;
  const symbolCount = Array.from(text).filter(
    (char) => !/[A-Za-z0-9\s.,:/()%\-]/.test(char),
  ).length;
  return text.length >= 4 && symbolCount / text.length > 0.3;
}

function shouldFlagBlankCell(
  columnFillRatio: number,
  impact: ReviewIssueImpact,
): boolean {
  if (impact === "billing" || impact === "stock" || impact === "traceability")
    return true;
  return columnFillRatio >= 0.6;
}

/* ── Build review issues ───────────────────────────────── */

export function buildIssues(input: {
  rows: string[][];
  headers: string[];
  cellConfidence?: OcrConfidenceMatrix | null;
  warnings?: string[];
  rejectionReason?: string | null;
  fallbackUsed?: boolean;
}): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const { rows, headers, cellConfidence, warnings, rejectionReason, fallbackUsed } = input;

  // System warnings
  (warnings ?? []).forEach((warning, index) => {
    issues.push({
      key: `warning-${index}`,
      tone: "warning",
      title: "System warning",
      detail: warning,
      impact: inferIssueImpact("", warning),
      affectedValue: "Check highlighted rows",
      expectedValue: "Confirm the value against the paper",
      actionLabel: "Review warning",
      helpText:
        "System warnings often mean the OCR had trouble reading the page cleanly.",
    });
  });

  // Previously rejected
  if (rejectionReason) {
    issues.unshift({
      key: "sent-back",
      tone: "critical",
      title: "Previously sent back",
      detail: rejectionReason,
      impact: "workflow",
      affectedValue: rejectionReason,
      expectedValue: "Fix the rejected fields before approval",
      actionLabel: "Recheck rejected field",
      helpText:
        "A rejected document should be corrected before it re-enters reporting or export workflows.",
    });
  }

  // Fallback used
  if (fallbackUsed) {
    issues.push({
      key: "fallback",
      tone: "info",
      title: "Fallback OCR was used",
      detail:
        "This document was harder to read, so a quick visual comparison is recommended.",
      impact: "workflow",
      affectedValue: "Fallback read used",
      expectedValue: "Do a faster cross-check before approval",
      actionLabel: "Do quick check",
      helpText:
        "Fallback reads often need a lighter but careful human pass.",
    });
  }

  // Field-level issues
  const columnFillRatios = headers.map((_, columnIndex) => {
    if (!rows.length) return 0;
    const filled = rows.filter((row) => row[columnIndex]?.trim()).length;
    return filled / rows.length;
  });
  const fieldIssues: ReviewIssue[] = [];
  let mediumSignalCount = 0;

  rows.forEach((row, rowIndex) => {
    headers.forEach((header, columnIndex) => {
      const value = row[columnIndex] || "";
      const confidence = cellConfidence?.[rowIndex]?.[columnIndex];
      const impact = inferIssueImpact(header, value);
      const confidenceTier = getOcrConfidenceTier(confidence ?? undefined);

      if (!value.trim()) {
        if (!shouldFlagBlankCell(columnFillRatios[columnIndex] ?? 0, impact)) {
          return;
        }
        fieldIssues.push({
          key: `blank-${rowIndex}-${columnIndex}`,
          tone:
            impact === "billing" || impact === "stock" ? "critical" : "warning",
          title: `${header || `Column ${columnIndex + 1}`} is blank`,
          detail: `Row ${rowIndex + 1} is missing a value in ${
            header || `Column ${columnIndex + 1}`
          }.`,
          impact,
          affectedValue: "Blank",
          expectedValue: "Fill the missing value from the paper",
          actionLabel: "Fill value",
          helpText:
            "Missing fields can break downstream totals, dispatch records, or traceability.",
          rowIndex,
          columnIndex,
        });
        return;
      }

      if (confidenceTier === "review_required" || looksSuspiciousValue(value)) {
        fieldIssues.push({
          key: `confidence-${rowIndex}-${columnIndex}`,
          tone:
            confidenceTier === "review_required" ? "critical" : "warning",
          title: `${header || `Column ${columnIndex + 1}`} needs confirmation`,
          detail: `Row ${rowIndex + 1} may be incorrect. The detected value looks uncertain.`,
          impact,
          affectedValue: value,
          expectedValue: "Compare this value with the original paper",
          actionLabel: "Verify field",
          helpText:
            "Low-confidence fields should be corrected before the document reaches reports or exports.",
          rowIndex,
          columnIndex,
        });
        return;
      }
      if (
        hasOcrConfidenceSignal(confidence) &&
        confidenceTier === "medium"
      ) {
        mediumSignalCount += 1;
      }
    });
  });

  const sortedFieldIssues = fieldIssues.sort((left, right) => {
    if (issueWeight(right.tone) !== issueWeight(left.tone)) {
      return issueWeight(right.tone) - issueWeight(left.tone);
    }
    if ((left.rowIndex ?? 0) !== (right.rowIndex ?? 0)) {
      return (left.rowIndex ?? 0) - (right.rowIndex ?? 0);
    }
    return (left.columnIndex ?? 0) - (right.columnIndex ?? 0);
  });

  const visibleFieldIssues = sortedFieldIssues.slice(0, 18);
  const hiddenCount = sortedFieldIssues.length - visibleFieldIssues.length;
  if (hiddenCount > 0) {
    issues.push({
      key: "more-fields",
      tone: "info",
      title: "More flagged fields exist",
      detail: `${hiddenCount} additional field${
        hiddenCount === 1 ? "" : "s"
      } were hidden to keep the review focused.`,
      impact: "workflow",
      affectedValue: `${hiddenCount} more fields`,
      expectedValue: "Open all rows if a full pass is needed",
      actionLabel: "Review full table",
      helpText:
        "Focus mode keeps the first pass fast. Use all rows for a full audit.",
    });
  }
  if (mediumSignalCount > 0) {
    issues.push({
      key: "medium-signals",
      tone: "info",
      title: "Some cells only need a quick check",
      detail: `${mediumSignalCount} cell${
        mediumSignalCount === 1 ? "" : "s"
      } were marked Check instead of Review to avoid flooding the queue.`,
      impact: "workflow",
      affectedValue: `${mediumSignalCount} check signal${
        mediumSignalCount === 1 ? "" : "s"
      }`,
      expectedValue:
        "Use the amber badges for a quick second pass if anything looks off",
      actionLabel: "Spot-check cells",
      helpText:
        "Amber cells are softer signals, so the queue stays focused on genuinely risky fields.",
    });
  }

  return [...issues, ...visibleFieldIssues];
}

/* ── Helpers for safe cleanup ──────────────────────────── */

export function countSafeFixes(
  headers: string[],
  rows: string[][],
): number {
  return (
    headers.filter(
      (h) => h.trim() !== h || /\s{2,}/.test(h),
    ).length +
    rows.reduce(
      (sum, row) =>
        sum +
        row.filter((cell) => {
          const val = stringifyOcrCell(cell);
          return val.trim() !== val || /\s{2,}/.test(val);
        }).length,
      0,
    )
  );
}

export function applySafeCleanup(
  headers: string[],
  rows: string[][],
): { headers: string[]; rows: string[][] } {
  return {
    headers: headers.map((h) => h.replace(/\s+/g, " ").trim()),
    rows: rows.map((row) =>
      row.map((cell) =>
        cell.replace(/\s+/g, " ").trim(),
      ),
    ),
  };
}
