"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { ApiError, formatApiErrorMessage } from "@/lib/api";
import {
  canApproveOcrVerification,
  canUseOcrVerification,
  validateOcrImageFile,
} from "@/lib/ocr-access";
import {
  approveOcrVerification,
  createOcrVerification,
  downloadOcrVerificationExport,
  getOcrVerification,
  listOcrTemplates,
  listOcrVerifications,
  previewOcrLogbook,
  rejectOcrVerification,
  stringifyOcrCell,
  submitOcrVerification,
  updateOcrVerification,
  type OcrPreviewResult,
  type OcrTemplate,
  type OcrVerificationRecord,
  type OcrVerificationSavePayload,
} from "@/lib/ocr";
import { buildStructuredPdfBlob, exportRowsToCsv, exportRowsToMarkdown } from "@/lib/ocr-export";
import { triggerBlobDownload } from "@/lib/reports";
import { cn } from "@/lib/utils";
import { signalWorkflowRefresh, subscribeToWorkflowRefresh } from "@/lib/workflow-sync";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OcrGuideCard } from "@/components/ocr-guide-card";
import { Input } from "@/components/ui/input";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const PREVIEW_LANGUAGES = ["eng", "auto", "eng+hin+mar"];

type StatusFilter = "all" | "draft" | "pending" | "rejected" | "approved";

type MobileReviewTab = "document" | "issues" | "fix";

type ReviewIssue = {
  key: string;
  tone: "critical" | "warning" | "info";
  title: string;
  detail: string;
  impact: "billing" | "dispatch" | "stock" | "traceability" | "workflow";
  affectedValue: string;
  expectedValue: string;
  actionLabel: string;
  helpText: string;
  rowIndex?: number;
  columnIndex?: number;
};

function fallbackHeaders(
  columnCount: number,
  template: OcrTemplate | undefined,
  rawColumnAdded: boolean,
) {
  const provided = template?.column_names?.length ? [...template.column_names] : [];
  const headers: string[] = [];
  for (let index = 0; index < columnCount; index += 1) {
    headers.push(
      provided[index] ||
        (rawColumnAdded && index === columnCount - 1
          ? template?.raw_column_label || "Raw"
          : `Column ${index + 1}`),
    );
  }
  return headers;
}

function formatTimestamp(value?: string | null) {
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

function actorDisplayName(name?: string | null, id?: number | null) {
  if (name?.trim()) return name.trim();
  if (id) return `User #${id}`;
  return "Unassigned";
}

function exportSourceLabel(value?: string | null) {
  if (!value) return "Review draft";
  return value.replaceAll("_", " ");
}

function verificationExportLabel(record: OcrVerificationRecord | null) {
  if (!record) return "Download Excel";
  if (record.status === "approved") return "Download Approved Excel";
  if (record.status === "rejected") return "Download Sent-Back Excel";
  if (record.status === "pending") return "Download Pending Review Excel";
  return "Download Draft Excel";
}

function statusBadgeClass(status: string) {
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

function metricTone(type: "primary" | "warning" | "success" | "danger") {
  switch (type) {
    case "warning":
      return "border-amber-400/30 bg-[rgba(245,158,11,0.12)] text-amber-100";
    case "success":
      return "border-emerald-400/30 bg-[rgba(34,197,94,0.12)] text-emerald-100";
    case "danger":
      return "border-red-400/30 bg-[rgba(239,68,68,0.12)] text-red-100";
    default:
      return "border-cyan-400/30 bg-[rgba(34,211,238,0.12)] text-cyan-100";
  }
}

function signalTone(tone: ReviewIssue["tone"]) {
  switch (tone) {
    case "critical":
      return "border-red-400/30 bg-[rgba(239,68,68,0.1)] text-red-100";
    case "warning":
      return "border-amber-400/30 bg-[rgba(245,158,11,0.08)] text-amber-100";
    default:
      return "border-sky-400/30 bg-[rgba(56,189,248,0.08)] text-sky-100";
  }
}

function issueWeight(tone: ReviewIssue["tone"]) {
  switch (tone) {
    case "critical":
      return 3;
    case "warning":
      return 2;
    default:
      return 1;
  }
}

function impactTone(impact: ReviewIssue["impact"]) {
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

function impactLabel(impact: ReviewIssue["impact"]) {
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

function inferIssueImpact(label: string, detail = ""): ReviewIssue["impact"] {
  const text = `${label} ${detail}`.toLowerCase();
  if (/(amount|rate|invoice|bill|payment|tax|gst|pan|total|value|price)/.test(text)) {
    return "billing";
  }
  if (/(truck|vehicle|challan|dispatch|transporter|party|customer)/.test(text)) {
    return "dispatch";
  }
  if (/(weight|qty|quantity|kg|stock|scrap|inventory)/.test(text)) {
    return "stock";
  }
  if (/(heat|lot|batch|grade|operator|shift|date|time|machine)/.test(text)) {
    return "traceability";
  }
  return "workflow";
}

function cellInputClass(value: string, confidence?: number | null) {
  if (typeof confidence === "number" && confidence < 60) {
    return "border-red-400/40 bg-[rgba(239,68,68,0.12)]";
  }
  if (typeof confidence === "number" && confidence < 80) {
    return "border-amber-400/40 bg-[rgba(245,158,11,0.1)]";
  }
  if (!value.trim()) {
    return "border-amber-400/30 bg-[rgba(245,158,11,0.08)]";
  }
  return "";
}

function sortWeight(status: OcrVerificationRecord["status"]) {
  switch (status) {
    case "pending":
      return 4;
    case "rejected":
      return 3;
    case "draft":
      return 2;
    default:
      return 1;
  }
}

function SurfaceBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
        className,
      )}
    >
      {children}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[1.4rem] border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4", className)}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-lg font-semibold text-[var(--text)]">{value}</div>
      {detail ? <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{detail}</div> : null}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  detail,
  className,
}: {
  eyebrow: string;
  title: string;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-sm uppercase tracking-[0.24em] text-[var(--accent)]">{eyebrow}</div>
      <div className="text-2xl font-semibold tracking-[-0.02em] text-[var(--text)]">{title}</div>
      {detail ? <div className="max-w-3xl text-sm leading-6 text-[var(--muted)]">{detail}</div> : null}
    </div>
  );
}

function EmptyWorkspace() {
  return (
    <Card className="overflow-hidden border-dashed border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(16,26,40,0.96),rgba(10,16,28,0.98))]">
      <CardContent className="relative min-h-[26rem] px-6 py-8 sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(62,166,255,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_28%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_22rem]">
          <div className="space-y-5">
            <SectionHeading
              eyebrow="Review Documents"
              title="Open a paper, confirm the risky values, and push a trusted export forward."
              detail="Pick a saved document from the queue or bring in a fresh scan. This workbench keeps the human check focused on the values that can break billing, dispatch, stock, or traceability."
            />
            <div className="flex flex-wrap gap-3">
              <Link href="/ocr/scan">
                <Button>Open scan desk</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                label="Queue"
                value="Choose the next file"
                detail="Open a saved draft, a pending approval, or a sent-back document from the review queue."
              />
              <MetricCard
                label="Fix"
                value="Correct only what matters"
                detail="Jump to the flagged fields instead of manually checking every row from scratch."
              />
              <MetricCard
                label="Approve"
                value="Export with confidence"
                detail="Once the risky values are checked, send the cleaned sheet forward as a trusted source."
              />
            </div>
          </div>
          <div className="rounded-[1.8rem] border border-white/10 bg-[rgba(8,12,20,0.74)] p-5 shadow-[0_24px_60px_rgba(2,6,23,0.26)] backdrop-blur">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">What opens here</div>
            <div className="mt-3 space-y-3">
              <div className="rounded-[1.3rem] border border-cyan-400/20 bg-[rgba(34,211,238,0.08)] px-4 py-4">
                <div className="text-sm font-semibold text-cyan-100">Original paper viewer</div>
                <div className="mt-2 text-sm leading-6 text-cyan-50/80">
                  Keep the image on one side and the extracted values on the other so operators can compare fast.
                </div>
              </div>
              <div className="rounded-[1.3rem] border border-amber-400/20 bg-[rgba(245,158,11,0.08)] px-4 py-4">
                <div className="text-sm font-semibold text-amber-100">Issue-first correction flow</div>
                <div className="mt-2 text-sm leading-6 text-amber-50/80">
                  Critical and warning items stay visible until they are checked, corrected, or sent back.
                </div>
              </div>
              <div className="rounded-[1.3rem] border border-emerald-400/20 bg-[rgba(34,197,94,0.08)] px-4 py-4">
                <div className="text-sm font-semibold text-emerald-100">Trusted export decision</div>
                <div className="mt-2 text-sm leading-6 text-emerald-50/80">
                  Approved reviews become the clean source for Excel exports and downstream reporting.
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewWorkspace({
  activeVerification,
  canApprove,
  busy,
  imageUrl,
  preview,
  rows,
  headers,
  reviewerNotes,
  rejectionReason,
  reviewIssues,
  activeIssue,
  resolvedIssueKeys,
  unresolvedIssueCount,
  unresolvedCriticalCount,
  approveNeedsOverride,
  readOnly,
  mobile = false,
  mobileTab,
  onReviewerNotesChange,
  onRejectionReasonChange,
  onSaveDraft,
  onSubmit,
  onApprove,
  onReject,
  onDownloadExcel,
  onDownloadCsv,
  onDownloadPdf,
  onCopyMarkdown,
  onApplySafeCleanup,
  onAddRow,
  onRemoveRow,
  onUpdateHeader,
  onUpdateCell,
  onSelectIssue,
  onMarkIssueChecked,
  onNextIssue,
  onMobileTabChange,
  onRefreshQueue,
}: {
  activeVerification: OcrVerificationRecord | null;
  canApprove: boolean;
  busy: boolean;
  imageUrl: string;
  preview: OcrPreviewResult | null;
  rows: string[][];
  headers: string[];
  reviewerNotes: string;
  rejectionReason: string;
  reviewIssues: ReviewIssue[];
  activeIssue: ReviewIssue | null;
  resolvedIssueKeys: string[];
  unresolvedIssueCount: number;
  unresolvedCriticalCount: number;
  approveNeedsOverride: boolean;
  readOnly: boolean;
  mobile?: boolean;
  mobileTab: MobileReviewTab;
  onReviewerNotesChange: (value: string) => void;
  onRejectionReasonChange: (value: string) => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDownloadExcel: () => void;
  onDownloadCsv: () => void;
  onDownloadPdf: () => void;
  onCopyMarkdown: () => void;
  onApplySafeCleanup: () => void;
  onAddRow: () => void;
  onRemoveRow: (rowIndex: number) => void;
  onUpdateHeader: (columnIndex: number, value: string) => void;
  onUpdateCell: (rowIndex: number, columnIndex: number, value: string) => void;
  onSelectIssue: (issueKey: string, targetTab?: MobileReviewTab) => void;
  onMarkIssueChecked: (issueKey: string) => void;
  onNextIssue: () => void;
  onMobileTabChange: (tab: MobileReviewTab) => void;
  onRefreshQueue: () => void;
}) {
  const [showAllRows, setShowAllRows] = useState(false);

  useEffect(() => {
    if (activeIssue?.rowIndex == null) return;
    const target = document.getElementById(`ocr-cell-${activeIssue.rowIndex}-${activeIssue.columnIndex ?? 0}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }, [activeIssue?.columnIndex, activeIssue?.key, activeIssue?.rowIndex]);

  if (!rows.length && !activeVerification && !imageUrl) {
    return <EmptyWorkspace />;
  }

  const activeStatus = activeVerification?.status || "draft";
  const totalIssues = reviewIssues.length;
  const checkedIssueCount = resolvedIssueKeys.length;
  const criticalCount = reviewIssues.filter((issue) => issue.tone === "critical").length;
  const warningCount = reviewIssues.filter((issue) => issue.tone === "warning").length;
  const progressPercent = totalIssues ? Math.round((checkedIssueCount / totalIssues) * 100) : 100;
  const averageConfidence = (preview?.avg_confidence ?? activeVerification?.avg_confidence ?? 0).toFixed(0);
  const viewerLanguage = preview?.used_language || activeVerification?.language || "-";
  const safeFixCount =
    headers.filter((header) => header.trim() !== header || /\s{2,}/.test(header)).length +
    rows.reduce(
      (sum, row) =>
        sum +
        row.filter((cell) => cell.trim() !== cell || /\s{2,}/.test(cell)).length,
      0,
    );
  const editableIssues = reviewIssues.flatMap((issue) =>
    issue.rowIndex != null && issue.columnIndex != null
      ? ([issue] as Array<ReviewIssue & { rowIndex: number; columnIndex: number }>)
      : [],
  );
  const focusedRows = Array.from(
    new Map(
      reviewIssues
        .filter((issue) => issue.rowIndex != null)
        .map((issue) => [issue.rowIndex as number, rows[issue.rowIndex as number]]),
    ),
  ).map(([rowIndex, row]) => ({ rowIndex, row: row || [] }));
  const displayRows =
    showAllRows || !reviewIssues.length || !focusedRows.length
      ? rows.map((row, rowIndex) => ({ rowIndex, row }))
      : focusedRows;
  const focusModeRows = displayRows.length;
  const currentStep = activeStatus === "approved" ? 4 : 3;
  const steps = ["Select", "Scan", "Review", "Approve"];
  const trustState =
    activeStatus === "approved"
      ? {
          title: "Trusted export",
          detail: "Owner-facing reports can use this approved review as the trusted OCR source.",
          className: "border-emerald-400/30 bg-[rgba(34,197,94,0.1)] text-emerald-100",
        }
      : activeStatus === "pending"
        ? {
            title: "Waiting for approval",
            detail: "Reviewed rows are ready, but they should stay out of trusted reporting until approval.",
            className: "border-amber-400/30 bg-[rgba(245,158,11,0.1)] text-amber-100",
          }
        : activeStatus === "rejected"
          ? {
              title: "Sent back",
              detail: "This document needs correction before the reviewed rows can be trusted again.",
              className: "border-red-400/30 bg-[rgba(239,68,68,0.1)] text-red-100",
            }
          : {
              title: "Draft only",
              detail: "This export uses reviewed rows, but it is still a working draft until approval.",
              className: "border-cyan-400/30 bg-[rgba(34,211,238,0.1)] text-cyan-100",
            };
  const auditEvents = [
    activeVerification?.created_at
      ? {
          label: "Created",
          detail: `${formatTimestamp(activeVerification.created_at)} by ${actorDisplayName(
            activeVerification.created_by_name,
            activeVerification.user_id,
          )}`,
        }
      : null,
    activeVerification?.submitted_at
      ? {
          label: "Submitted",
          detail: `Queued for approval on ${formatTimestamp(activeVerification.submitted_at)}`,
        }
      : null,
    activeVerification?.approved_at
      ? {
          label: "Approved",
          detail: `${formatTimestamp(activeVerification.approved_at)} by ${actorDisplayName(
            activeVerification.approved_by_name,
            activeVerification.approved_by,
          )}`,
        }
      : null,
    activeVerification?.rejected_at
      ? {
          label: "Sent back",
          detail: `${formatTimestamp(activeVerification.rejected_at)} by ${actorDisplayName(
            activeVerification.rejected_by_name,
            activeVerification.rejected_by,
          )}`,
        }
      : null,
    activeVerification?.updated_at
      ? {
          label: "Last saved",
          detail: formatTimestamp(activeVerification.updated_at),
        }
      : null,
  ].filter((item): item is { label: string; detail: string } => Boolean(item));

  const trustSection = activeVerification ? (
    <Card className="overflow-hidden border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(14,22,34,0.98),rgba(10,16,28,0.98))]">
      <CardHeader className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(62,166,255,0.14),transparent_34%)]" />
        <SectionHeading
          eyebrow="Trust and audit"
          title="Why this OCR output can or cannot be trusted"
          detail="This strip is the confidence handoff. It tells the reviewer and the approver whether the reviewed sheet is still a working draft, waiting in the queue, or safe to use as the export source."
          className="relative"
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={cn("rounded-[1.45rem] border px-4 py-4 shadow-[0_18px_40px_rgba(2,6,23,0.18)]", trustState.className)}>
            <div className="text-[11px] uppercase tracking-[0.16em]">Trust state</div>
            <div className="mt-2 text-lg font-semibold">{trustState.title}</div>
            <div className="mt-2 text-sm leading-6">{trustState.detail}</div>
          </div>
          <MetricCard
            label="Export source"
            value={exportSourceLabel(activeVerification.export_source)}
            detail={activeVerification.trusted_export ? "Approved reviewed rows" : "Reviewed rows before approval"}
          />
          <MetricCard
            label="Created by"
            value={actorDisplayName(activeVerification.created_by_name, activeVerification.user_id)}
            detail="Review draft owner for this document record."
          />
          <MetricCard
            label="Latest decision"
            value={
              activeVerification.approved_at
                ? "Approved"
                : activeVerification.rejected_at
                  ? "Sent back"
                  : activeVerification.submitted_at
                    ? "Pending approval"
                    : "Draft"
            }
            detail={
              activeVerification.approved_at
                ? `${actorDisplayName(activeVerification.approved_by_name, activeVerification.approved_by)} on ${formatTimestamp(activeVerification.approved_at)}`
                : activeVerification.rejected_at
                  ? `${actorDisplayName(activeVerification.rejected_by_name, activeVerification.rejected_by)} on ${formatTimestamp(activeVerification.rejected_at)}`
                  : activeVerification.submitted_at
                    ? `Sent for approval on ${formatTimestamp(activeVerification.submitted_at)}`
                    : "Still in working draft mode."
            }
          />
        </div>

        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[rgba(10,15,24,0.76)] px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Audit timeline</div>
              <div className="mt-1 text-sm text-[var(--muted)]">Every save, submit, approval, and send-back checkpoint appears here.</div>
            </div>
            <SurfaceBadge className="border-white/10 bg-white/[0.03] text-[var(--muted)]">
              {auditEvents.length} checkpoint{auditEvents.length === 1 ? "" : "s"}
            </SurfaceBadge>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {auditEvents.length ? (
              auditEvents.map((event) => (
                <div key={`${event.label}-${event.detail}`} className="rounded-[1.25rem] border border-[var(--border)] bg-[rgba(8,12,20,0.82)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">{event.label}</div>
                  <div className="mt-2 text-sm text-[var(--text)]">{event.detail}</div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-[var(--border)] px-4 py-3 text-sm text-[var(--muted)]">
                Audit checkpoints will appear here after this document is saved, submitted, approved, or sent back.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  ) : null;

  const viewerSection = (
    <Card className="overflow-hidden border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(15,22,35,0.98),rgba(10,16,28,0.98))]">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeading
          eyebrow="Document viewer"
          title="Compare against the real paper"
          detail="Keep the source image visible while you confirm the risky values. This is the fastest way to catch OCR misses before they reach reports or dispatch."
        />
        <div className="flex flex-wrap gap-2">
          <SurfaceBadge className="border-cyan-400/30 bg-[rgba(34,211,238,0.12)] text-cyan-100">
            {progressPercent}% reviewed
          </SurfaceBadge>
          <SurfaceBadge className="border-white/10 bg-white/[0.03] text-[var(--muted)]">
            {averageConfidence}% confidence
          </SurfaceBadge>
          {imageUrl ? (
            <a href={imageUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" className="px-4 py-2 text-xs">
                Open full image
              </Button>
            </a>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Issues left" value={unresolvedIssueCount} detail="Outstanding items still need a visual or field-level check." />
          <MetricCard label="Language used" value={viewerLanguage} detail="This is the OCR language hint used for the current read." />
          <MetricCard label="Rows in focus" value={focusModeRows} detail={showAllRows ? "Full extracted table is visible." : "Focus mode keeps the first pass fast."} />
        </div>
        <div className="rounded-[1.6rem] border border-[var(--border)] bg-[rgba(8,12,20,0.94)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          {imageUrl ? (
            <div className="min-h-[26rem] max-h-[46rem] overflow-auto rounded-[1.2rem] bg-[#060811]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt={activeVerification?.source_filename || "OCR source"} className="mx-auto h-auto w-full object-contain" />
            </div>
          ) : (
            <div className="flex min-h-[20rem] flex-col items-center justify-center gap-3 rounded-[1.2rem] border border-dashed border-[var(--border)] text-center text-sm text-[var(--muted)]">
              <div>No source image is attached to this review.</div>
              <div>You can still fix the extracted entries, but image-based confirmation is not available for this document.</div>
            </div>
          )}
        </div>
        <div className="rounded-[1.4rem] border border-cyan-400/20 bg-[rgba(34,211,238,0.06)] px-4 py-4 text-sm leading-6 text-cyan-50/85">
          Work from left to right: confirm the paper first, clear the risky fields second, and only then send the sheet forward as trusted data.
        </div>
      </CardContent>
    </Card>
  );

  const issuesSection = (
    <div className="space-y-6">
      <Card className="border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(15,22,35,0.97),rgba(11,17,29,0.98))]">
        <CardHeader>
          <SectionHeading
            eyebrow="Issue priority"
            title="Check the risky values first"
            detail="The queue below is sorted for speed: start with critical fields, then warnings, then clean up anything still blocking approval."
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                const next = reviewIssues.find((issue) => issue.tone === "critical" && !resolvedIssueKeys.includes(issue.key));
                if (next) onSelectIssue(next.key, "issues");
              }}
              className="rounded-[1.35rem] border border-red-400/30 bg-[rgba(239,68,68,0.1)] px-4 py-4 text-left text-red-100 transition hover:-translate-y-0.5 hover:bg-[rgba(239,68,68,0.14)]"
            >
              <div className="text-[11px] uppercase tracking-[0.16em]">Critical</div>
              <div className="mt-2 text-2xl font-semibold">{criticalCount}</div>
              <div className="mt-2 text-sm text-red-50/80">Highest-risk values that can break operations or approvals.</div>
            </button>
            <button
              type="button"
              onClick={() => {
                const next = reviewIssues.find((issue) => issue.tone === "warning" && !resolvedIssueKeys.includes(issue.key));
                if (next) onSelectIssue(next.key, "issues");
              }}
              className="rounded-[1.35rem] border border-amber-400/30 bg-[rgba(245,158,11,0.1)] px-4 py-4 text-left text-amber-100 transition hover:-translate-y-0.5 hover:bg-[rgba(245,158,11,0.14)]"
            >
              <div className="text-[11px] uppercase tracking-[0.16em]">Warning</div>
              <div className="mt-2 text-2xl font-semibold">{warningCount}</div>
              <div className="mt-2 text-sm text-amber-50/80">Likely readable, but still worth a quick paper check.</div>
            </button>
            <div className="rounded-[1.35rem] border border-emerald-400/30 bg-[rgba(34,197,94,0.1)] px-4 py-4 text-emerald-100">
              <div className="text-[11px] uppercase tracking-[0.16em]">Checked</div>
              <div className="mt-2 text-2xl font-semibold">{checkedIssueCount}</div>
              <div className="mt-2 text-sm text-emerald-50/80">Fields already reviewed and cleared for this pass.</div>
            </div>
          </div>

          {reviewIssues.length ? (
            <div className="space-y-3">
              {reviewIssues.map((issue) => {
                const resolved = resolvedIssueKeys.includes(issue.key);
                const isActive = activeIssue?.key === issue.key;
                return (
                  <button
                    key={issue.key}
                    type="button"
                    onClick={() => onSelectIssue(issue.key, "issues")}
                    className={cn(
                      "w-full rounded-[1.35rem] border px-4 py-4 text-left transition",
                      isActive
                        ? "border-[var(--accent)] bg-[linear-gradient(180deg,rgba(62,166,255,0.12),rgba(62,166,255,0.06))] shadow-[0_16px_36px_rgba(15,23,42,0.2)]"
                        : "border-[var(--border)] bg-[var(--card-strong)] hover:-translate-y-0.5 hover:border-[var(--accent)]/30",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]", signalTone(issue.tone))}>
                            {issue.tone}
                          </span>
                          <span className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]", impactTone(issue.impact))}>
                            {impactLabel(issue.impact)}
                          </span>
                          {resolved ? (
                            <span className="rounded-full border border-emerald-400/30 bg-[rgba(34,197,94,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100">
                              Checked
                            </span>
                          ) : null}
                        </div>
                        <div className="font-semibold text-[var(--text)]">{issue.title}</div>
                        <div className="text-sm leading-6 text-[var(--muted)]">{issue.detail}</div>
                        <div className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                          Expected next step: {issue.actionLabel}
                        </div>
                      </div>
                      <div className="text-xs text-[var(--muted)]">{issue.actionLabel}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-400/30 bg-[rgba(34,197,94,0.08)] px-4 py-4 text-sm text-emerald-100">
              No risky fields were found. A quick visual check should be enough before approval.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(15,22,35,0.97),rgba(11,17,29,0.98))]">
        <CardHeader>
          <SectionHeading
            eyebrow="Active issue"
            title={activeIssue ? activeIssue.title : "No issue selected"}
            detail={
              activeIssue
                ? "Use this panel as the reviewer brief: what was detected, what it should become, and why it matters to downstream work."
                : "Select an item from the issue queue to focus the review and jump to the right field."
            }
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {activeIssue ? (
            <>
              <div className={cn("rounded-[1.35rem] border px-4 py-4", signalTone(activeIssue.tone))}>
                <div className="text-xs font-semibold uppercase tracking-[0.16em]">Suggested check</div>
                <div className="mt-2 text-sm leading-6">{activeIssue.detail}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="Detected value" value={activeIssue.affectedValue || "-"} />
                <MetricCard label="Expected review" value={activeIssue.expectedValue} />
              </div>
              <div className="rounded-[1.35rem] border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Why it matters</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <SurfaceBadge className={cn("", impactTone(activeIssue.impact))}>
                    {impactLabel(activeIssue.impact)}
                  </SurfaceBadge>
                  <span className="text-sm text-[var(--text)]">{activeIssue.helpText}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {resolvedIssueKeys.includes(activeIssue.key) ? (
                  <div className="rounded-full border border-emerald-400/30 bg-[rgba(34,197,94,0.12)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-100">
                    Issue checked
                  </div>
                ) : (
                  <Button onClick={() => onMarkIssueChecked(activeIssue.key)} disabled={busy || readOnly}>
                    Mark checked
                  </Button>
                )}
                <Button variant="outline" onClick={() => onSelectIssue(activeIssue.key, "fix")} disabled={busy}>
                  Jump to field
                </Button>
                <Button variant="ghost" onClick={onNextIssue} disabled={busy || unresolvedIssueCount === 0}>
                  Next issue
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-[1.35rem] border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4 text-sm text-[var(--muted)]">
              Select an issue from the list to focus the review and jump to the right row.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(15,22,35,0.97),rgba(11,17,29,0.98))]">
        <CardHeader>
          <SectionHeading
            eyebrow="Review notes"
            title="Capture what you checked"
            detail="Keep the note short but useful. This is the context the next approver or operator will use when they reopen the document."
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="px-3 py-2 text-xs"
              onClick={() => {
                const next = reviewIssues.find((issue) => issue.tone === "critical");
                if (next) onSelectIssue(next.key, "issues");
              }}
              disabled={!criticalCount}
            >
              Show critical items
            </Button>
            <Button
              variant="outline"
              className="px-3 py-2 text-xs"
              onClick={() => {
                const next = reviewIssues.find((issue) => issue.actionLabel.toLowerCase().includes("fill"));
                if (next) onSelectIssue(next.key, "issues");
              }}
              disabled={!reviewIssues.some((issue) => issue.actionLabel.toLowerCase().includes("fill"))}
            >
              Show missing values
            </Button>
            <Button variant="outline" className="px-3 py-2 text-xs" onClick={onApplySafeCleanup} disabled={busy || readOnly || !safeFixCount}>
              Apply safe cleanup
            </Button>
          </div>
          <div>
            <label className="text-sm text-[var(--muted)]">Review note</label>
            <Textarea
              rows={4}
              value={reviewerNotes}
              onChange={(event) => onReviewerNotesChange(event.target.value)}
              placeholder="Example: checked invoice total against the paper and corrected vehicle number."
              className="mt-3 rounded-[1.35rem] border-[var(--border-strong)] bg-[rgba(8,12,20,0.82)] px-4 py-3 leading-6"
            />
          </div>
          {canApprove ? (
            <div>
              <label className="text-sm text-[var(--muted)]">Reason for correction</label>
              <Textarea
                rows={3}
                value={rejectionReason}
                onChange={(event) => onRejectionReasonChange(event.target.value)}
                placeholder="Only needed when this document must go back for correction."
                className="mt-3 rounded-[1.35rem] border-[var(--border-strong)] bg-[rgba(8,12,20,0.82)] px-4 py-3 leading-6"
              />
            </div>
          ) : null}
          {approveNeedsOverride ? (
            <div className="rounded-2xl border border-amber-400/30 bg-[rgba(245,158,11,0.08)] px-4 py-4 text-sm text-amber-100">
              Critical issues are still open. Check them first, or add a clear review note before forcing approval.
            </div>
          ) : null}
          {activeVerification?.rejection_reason ? (
            <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.08)] px-4 py-4 text-sm text-red-200">
              Last correction reason: {activeVerification.rejection_reason}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );

  const fixSection = (
    <Card className="border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(15,22,35,0.97),rgba(11,17,29,0.98))]">
      <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <SectionHeading
          eyebrow="Fix fields"
          title="Correct the flagged values"
          detail="Stay in focus mode for a fast first pass, then open the full extracted table if you want a deeper cleanup before export."
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowAllRows((current) => !current)} disabled={!rows.length}>
            {showAllRows ? "Hide full table" : "View all extracted rows"}
          </Button>
          <Button variant="outline" onClick={onDownloadExcel} disabled={!rows.length || busy}>
            {verificationExportLabel(activeVerification)}
          </Button>
          <Button variant="outline" onClick={onDownloadCsv} disabled={!rows.length}>
            Download CSV
          </Button>
          <Button variant="outline" onClick={onDownloadPdf} disabled={!rows.length}>
            Download PDF
          </Button>
          <Button variant="outline" onClick={onCopyMarkdown} disabled={!rows.length}>
            Copy Markdown
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Flagged fields" value={editableIssues.length} detail="Editable items that need direct field review." />
          <MetricCard label="Rows loaded" value={rows.length} detail="Total extracted rows currently in this review." />
          <MetricCard label="Safe cleanup" value={safeFixCount} detail="Whitespace-only fixes available for quick cleanup." />
        </div>
        {!editableIssues.length ? (
          <div className="rounded-[1.35rem] border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
            No flagged fields need direct correction right now. You can still open the full extracted table if you want to do a detailed pass.
          </div>
        ) : (
          <div className="space-y-3">
            {editableIssues.slice(0, showAllRows ? editableIssues.length : 6).map((issue) => {
              const confidence = preview?.cell_confidence?.[issue.rowIndex]?.[issue.columnIndex];
              const value = rows[issue.rowIndex]?.[issue.columnIndex] || "";
              const resolved = resolvedIssueKeys.includes(issue.key);
              return (
                <div
                  key={issue.key}
                  className={cn(
                    "rounded-[1.35rem] border px-4 py-4",
                    activeIssue?.key === issue.key
                      ? "border-[var(--accent)] bg-[linear-gradient(180deg,rgba(62,166,255,0.12),rgba(62,166,255,0.05))]"
                      : "border-[var(--border)] bg-[var(--card-strong)]",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]", signalTone(issue.tone))}>
                          {issue.tone}
                        </span>
                        <span className="text-xs text-[var(--muted)]">Row {issue.rowIndex + 1}</span>
                      </div>
                      <div className="mt-2 font-semibold text-[var(--text)]">{issue.title}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">{issue.helpText}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {resolved ? (
                        <div className="rounded-full border border-emerald-400/30 bg-[rgba(34,197,94,0.12)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100">
                          Checked
                        </div>
                      ) : (
                        <Button variant="outline" className="px-3 py-2 text-xs" onClick={() => onMarkIssueChecked(issue.key)} disabled={busy || readOnly}>
                          Mark checked
                        </Button>
                      )}
                      <Button variant="ghost" className="px-3 py-2 text-xs" onClick={() => onSelectIssue(issue.key, mobile ? "fix" : undefined)}>
                        Focus
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Input
                      id={`ocr-cell-${issue.rowIndex}-${issue.columnIndex}`}
                      value={value}
                      onChange={(event) => onUpdateCell(issue.rowIndex, issue.columnIndex, event.target.value)}
                      className={cn(cellInputClass(value, confidence), activeIssue?.key === issue.key && "border-cyan-400/60 ring-2 ring-cyan-400/30")}
                      disabled={readOnly}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showAllRows ? (
          <ResponsiveScrollArea
            debugLabel="ocr-verification-table"
            className="rounded-[1.45rem] border border-[var(--border)] bg-[rgba(8,12,20,0.82)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
          >
            <table className="min-w-full text-left text-sm">
              <thead className="text-[var(--muted)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-3 py-3 font-medium">Row</th>
                  {headers.map((header, columnIndex) => (
                    <th key={`${header}-${columnIndex}`} className="px-3 py-3 font-medium">
                      <Input value={header} onChange={(event) => onUpdateHeader(columnIndex, event.target.value)} disabled={readOnly} />
                    </th>
                  ))}
                  <th className="px-3 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map(({ row, rowIndex }) => (
                  <tr key={`row-${rowIndex}`} className={cn("border-b border-[var(--border)]/60", activeIssue?.rowIndex === rowIndex && "bg-[rgba(62,166,255,0.05)]")}>
                    <td className="px-3 py-3 align-top font-semibold text-[var(--muted)]">{rowIndex + 1}</td>
                    {headers.map((header, columnIndex) => {
                      const confidence = preview?.cell_confidence?.[rowIndex]?.[columnIndex];
                      const isActiveCell = activeIssue?.rowIndex === rowIndex && (activeIssue.columnIndex ?? columnIndex) === columnIndex;
                      return (
                        <td key={`${header}-${rowIndex}-${columnIndex}`} className="px-3 py-3 align-top">
                          <Input
                            id={`ocr-cell-${rowIndex}-${columnIndex}`}
                            value={row[columnIndex] || ""}
                            onChange={(event) => onUpdateCell(rowIndex, columnIndex, event.target.value)}
                            className={cn(cellInputClass(row[columnIndex] || "", confidence), isActiveCell && "border-cyan-400/60 ring-2 ring-cyan-400/30")}
                            disabled={readOnly}
                          />
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 align-top">
                      <Button variant="ghost" onClick={() => onRemoveRow(rowIndex)} disabled={readOnly}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveScrollArea>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" onClick={onAddRow} disabled={!headers.length || readOnly}>
            Add row
          </Button>
          {activeIssue ? (
            <Button variant="outline" onClick={() => onMarkIssueChecked(activeIssue.key)} disabled={busy || readOnly || resolvedIssueKeys.includes(activeIssue.key)}>
              {resolvedIssueKeys.includes(activeIssue.key) ? "Issue checked" : "Mark active issue checked"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {activeVerification?.status === "approved" ? (
        <div className="rounded-[1.35rem] border border-emerald-400/30 bg-[rgba(34,197,94,0.08)] px-4 py-3 text-sm text-emerald-100">
          Approved by{" "}
          <span className="font-semibold">
            {actorDisplayName(activeVerification.approved_by_name, activeVerification.approved_by)}
          </span>{" "}
          on {formatTimestamp(activeVerification.approved_at)}. This approved review is now the trusted Excel export source, so the fields stay locked.
        </div>
      ) : activeVerification?.status === "rejected" ? (
        <div className="rounded-[1.35rem] border border-red-400/30 bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-red-100">
          This document was sent back on {formatTimestamp(activeVerification.rejected_at)}. Fix the flagged rows and resubmit before using it as trusted OCR output.
        </div>
      ) : activeVerification?.status === "pending" ? (
        <div className="rounded-[1.35rem] border border-amber-400/30 bg-[rgba(245,158,11,0.08)] px-4 py-3 text-sm text-amber-100">
          Reviewed rows are ready and waiting for approval. Export is available for checking, but it should not be treated as trusted business data yet.
        </div>
      ) : activeVerification ? (
        <div className="rounded-[1.35rem] border border-cyan-400/30 bg-[rgba(34,211,238,0.08)] px-4 py-3 text-sm text-cyan-100">
          This is still a working draft. Save your corrections here, then send the document for approval when the risky values are checked.
        </div>
      ) : null}
      {trustSection}
      <Card className="overflow-hidden border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(14,22,34,0.98),rgba(10,16,28,0.98))]">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <SurfaceBadge className={cn("", statusBadgeClass(activeStatus))}>
                {activeStatus.replace("_", " ")}
              </SurfaceBadge>
              <SurfaceBadge className="border-white/10 bg-white/[0.03] text-[var(--muted)]">
                {rows.length} row{rows.length === 1 ? "" : "s"} detected
              </SurfaceBadge>
              <SurfaceBadge className="border-white/10 bg-white/[0.03] text-[var(--muted)]">
                {unresolvedIssueCount} issue{unresolvedIssueCount === 1 ? "" : "s"} left
              </SurfaceBadge>
            </div>
            <SectionHeading
              eyebrow="Review workspace"
              title={activeVerification?.source_filename || "New document review"}
              detail={
                activeVerification
                  ? `Last updated ${formatTimestamp(activeVerification.updated_at)}. Keep the reviewer flow tight: compare, correct, note what changed, and approve only when the risky values are clear.`
                  : "Open the paper, check the flagged values, fix only what matters, and send a clean version forward."
              }
            />
            <div className="flex flex-wrap gap-3">
              {steps.map((step, index) => {
                const stepNumber = index + 1;
                const complete = stepNumber < currentStep;
                const current = stepNumber === currentStep;
                return (
                  <SurfaceBadge
                    key={step}
                    className={cn(
                      complete
                        ? "border-emerald-400/30 bg-[rgba(34,197,94,0.12)] text-emerald-100"
                        : current
                          ? "border-cyan-400/30 bg-[rgba(34,211,238,0.12)] text-cyan-100"
                          : "border-[var(--border)] bg-[var(--card-strong)] text-[var(--muted)]",
                    )}
                  >
                    {step}
                  </SurfaceBadge>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={onRefreshQueue} disabled={busy}>
              Refresh queue
            </Button>
          </div>
        </CardHeader>
      </Card>

      {mobile ? (
        <>
          <ResponsiveScrollArea
            className="rounded-[1.35rem] border border-[var(--border)] bg-[rgba(18,22,34,0.94)] shadow-[var(--shadow-sm)]"
            debugLabel="ocr-verification-mobile-tabs"
            innerClassName="flex min-w-max gap-2 p-2"
          >
            {(["document", "issues", "fix"] as MobileReviewTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => onMobileTabChange(tab)}
                className={cn(
                  "min-w-28 rounded-[1rem] px-4 py-3 text-sm font-semibold capitalize transition",
                  mobileTab === tab ? "bg-[var(--accent)] text-black" : "bg-[var(--card-strong)] text-[var(--muted)]",
                )}
              >
                {tab}
              </button>
            ))}
          </ResponsiveScrollArea>

          {mobileTab === "document" ? viewerSection : null}
          {mobileTab === "issues" ? issuesSection : null}
          {mobileTab === "fix" ? fixSection : null}
        </>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_24rem]">
          <div className="min-w-0 space-y-6">
            {viewerSection}
          </div>
          <div className="space-y-6">
            {issuesSection}
            {fixSection}
          </div>
        </section>
      )}

      <div className={cn("sticky z-20 rounded-[1.5rem] border border-[var(--border)] bg-[rgba(10,14,24,0.94)] p-4 shadow-2xl backdrop-blur", mobile ? "safe-bottom-inset bottom-2" : "bottom-4")}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-[var(--muted)]">
            {totalIssues ? `${checkedIssueCount} of ${totalIssues} issues checked.` : "No open issues detected."}
            {unresolvedCriticalCount ? ` ${unresolvedCriticalCount} critical issue${unresolvedCriticalCount === 1 ? "" : "s"} still need attention.` : ""}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={onSaveDraft} disabled={busy || (!rows.length && !activeVerification) || readOnly}>
              {busy ? "Saving..." : "Save draft"}
            </Button>
            <Button variant="outline" onClick={onApplySafeCleanup} disabled={busy || readOnly || !safeFixCount}>
              Apply safe cleanup
            </Button>
            {!canApprove || activeStatus !== "pending" ? (
              <Button onClick={onSubmit} disabled={busy || !rows.length || readOnly}>
                Send for approval
              </Button>
            ) : null}
            {canApprove ? (
              <Button onClick={onApprove} disabled={busy || !rows.length || readOnly || approveNeedsOverride}>
                Approve
              </Button>
            ) : null}
            {canApprove ? (
              <Button variant="ghost" onClick={onReject} disabled={busy || readOnly}>
                Send for correction
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OcrVerificationPage() {
  const { user, loading, error: sessionError } = useSession();
  const searchParams = useSearchParams();
  const [templates, setTemplates] = useState<OcrTemplate[]>([]);
  const [templateGate, setTemplateGate] = useState("");
  const [verifications, setVerifications] = useState<OcrVerificationRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [showQuickIntake, setShowQuickIntake] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [language, setLanguage] = useState("eng");
  const [columns, setColumns] = useState(3);
  const [file, setFile] = useState<File | null>(null);
  const [localImageUrl, setLocalImageUrl] = useState("");
  const [preview, setPreview] = useState<OcrPreviewResult | null>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [headersState, setHeadersState] = useState<string[]>([]);
  const [activeVerificationId, setActiveVerificationId] = useState<number | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [mobileWorkspaceOpen, setMobileWorkspaceOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileReviewTab>("issues");
  const [selectedIssueKey, setSelectedIssueKey] = useState("");
  const [resolvedIssueKeys, setResolvedIssueKeys] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const canVerify = canUseOcrVerification(user?.role);
  const canApprove = canApproveOcrVerification(user?.role);
  const requestedVerificationId = useMemo(() => {
    const raw = searchParams.get("verification_id");
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);

  const activeTemplate = useMemo(
    () => templates.find((template) => String(template.id) === selectedTemplateId),
    [selectedTemplateId, templates],
  );

  const activeVerification = useMemo(
    () =>
      activeVerificationId != null
        ? verifications.find((item) => item.id === activeVerificationId) || null
        : null,
    [activeVerificationId, verifications],
  );

  const readOnly = activeVerification?.status === "approved";

  useEffect(() => {
    if (!activeTemplate) return;
    setColumns(activeTemplate.columns);
    setLanguage(activeTemplate.language || "eng");
  }, [activeTemplate]);

  useEffect(() => {
    if (!file) {
      setLocalImageUrl("");
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setLocalImageUrl(nextUrl);
    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [file]);

  const columnCount = useMemo(() => {
    return Math.max(
      preview?.columns || activeVerification?.columns || 0,
      ...rows.map((row) => row.length),
      headersState.length,
      columns,
      1,
    );
  }, [activeVerification?.columns, columns, headersState.length, preview?.columns, rows]);

  const headers = useMemo(() => {
    const base = fallbackHeaders(
      columnCount,
      activeTemplate,
      Boolean(preview?.raw_column_added ?? activeVerification?.raw_column_added),
    );
    return Array.from({ length: columnCount }, (_, index) => headersState[index] || base[index]);
  }, [activeTemplate, activeVerification?.raw_column_added, columnCount, headersState, preview?.raw_column_added]);

  const resetWorkspace = useCallback(() => {
    setActiveVerificationId(null);
    setPreview(null);
    setRows([]);
    setHeadersState([]);
    setReviewerNotes("");
    setRejectionReason("");
    setFile(null);
    setLocalImageUrl("");
    setMobileWorkspaceOpen(false);
    setMobileTab("issues");
    setSelectedIssueKey("");
    setResolvedIssueKeys([]);
  }, []);

  const hydrateFromRecord = useCallback((record: OcrVerificationRecord) => {
    setActiveVerificationId(record.id);
    setSelectedTemplateId(record.template_id ? String(record.template_id) : "");
    setLanguage(record.language || "eng");
    setColumns(record.columns || 3);
    setPreview({
      type: record.doc_type_hint || "table",
      title: record.source_filename || "OCR Extraction",
      headers: record.headers || [],
      rows: record.original_rows || [],
      raw_text: record.raw_text || null,
      language: record.language || "eng",
      confidence: record.avg_confidence || 0,
      routing: record.routing_meta || null,
      reused: false,
      reused_verification_id: record.id,
      columns: record.columns || 3,
      avg_confidence: record.avg_confidence || 0,
      warnings: record.warnings || [],
      used_language: record.language || "eng",
      fallback_used: false,
      raw_column_added: Boolean(record.raw_column_added),
      template: null,
    });
    const baseRows = record.reviewed_rows?.length ? record.reviewed_rows : record.original_rows || [];
    setRows(
      baseRows.map((row) =>
        Array.from({ length: Math.max(record.columns || row.length || 1, row.length) }, (_, index) =>
          stringifyOcrCell(row[index]),
        ),
      ),
    );
    setHeadersState(record.headers?.length ? record.headers : []);
    setReviewerNotes(record.reviewer_notes || "");
    setRejectionReason(record.rejection_reason || "");
    setFile(null);
    setMobileTab("issues");
    setSelectedIssueKey("");
    setResolvedIssueKeys([]);
    setMobileWorkspaceOpen(typeof window !== "undefined" && window.innerWidth < 1280);
  }, []);

  const loadVerifications = useCallback(async (focusId?: number) => {
    const result = await listOcrVerifications();
    const sorted = [...result].sort((left, right) => {
      if (sortWeight(right.status) !== sortWeight(left.status)) {
        return sortWeight(right.status) - sortWeight(left.status);
      }
      return new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime();
    });
    setVerifications(sorted);
    if (focusId != null) {
      const detail = await getOcrVerification(focusId);
      hydrateFromRecord(detail);
      setVerifications((current) => {
        const next = current.filter((item) => item.id !== detail.id);
        return [detail, ...next].sort((left, right) => {
          if (sortWeight(right.status) !== sortWeight(left.status)) {
            return sortWeight(right.status) - sortWeight(left.status);
          }
          return new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime();
        });
      });
    }
  }, [hydrateFromRecord]);

  useEffect(() => {
    if (!canVerify) return;
    Promise.allSettled([
      listOcrTemplates(),
      loadVerifications(requestedVerificationId ?? undefined),
    ]).then(([templateResult, verificationResult]) => {
        if (templateResult.status === "fulfilled") {
          setTemplates(templateResult.value);
          setTemplateGate("");
        } else if (
          templateResult.reason instanceof ApiError &&
          templateResult.reason.status === 403
        ) {
          setTemplateGate(formatApiErrorMessage(templateResult.reason, templateResult.reason.message));
        } else {
          setError(formatApiErrorMessage(templateResult.reason, "Could not load OCR templates."));
        }

        if (verificationResult.status === "rejected") {
          setError(formatApiErrorMessage(verificationResult.reason, "Could not load verification queue."));
        } else if (requestedVerificationId != null) {
          setStatus(`Opened document #${requestedVerificationId} in Review Documents.`);
        }
      });
  }, [canVerify, loadVerifications, requestedVerificationId]);

  useEffect(() => {
    if (!canVerify) return;
    return subscribeToWorkflowRefresh(() => {
      void loadVerifications(activeVerificationId ?? undefined);
    });
  }, [activeVerificationId, canVerify, loadVerifications]);

  const handleRunPreview = async () => {
    const selectedFile = file;
    const preflightError = validateOcrImageFile(selectedFile, "Document image", { required: true });
    if (preflightError) {
      setError(preflightError);
      return;
    }
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const result = await previewOcrLogbook({
        file: selectedFile as File,
        columns,
        language,
        templateId: selectedTemplateId ? Number(selectedTemplateId) : null,
      });
      const nextColumnCount = Math.max(result.columns || 0, ...result.rows.map((row) => row.length), 1);
      const normalizedRows = result.rows.map((row) =>
        Array.from({ length: nextColumnCount }, (_, index) => stringifyOcrCell(row[index])),
      );
      setPreview(result);
      setRows(normalizedRows);
      setHeadersState(
        fallbackHeaders(nextColumnCount, activeTemplate, Boolean(result.raw_column_added)),
      );
      setActiveVerificationId(null);
      setReviewerNotes("");
      setRejectionReason("");
      setMobileTab("issues");
      setSelectedIssueKey("");
      setResolvedIssueKeys([]);
      setMobileWorkspaceOpen(typeof window !== "undefined" && window.innerWidth < 1280);
      setStatus("Document read successfully. Check the highlighted values, then save or send it forward.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not read this document.");
      }
    } finally {
      setBusy(false);
    }
  };

  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    setRows((current) =>
      current.map((row, index) =>
        index === rowIndex
          ? row.map((cell, cellIndex) => (cellIndex === columnIndex ? value : cell))
          : row,
      ),
    );
  };

  const updateHeader = (columnIndex: number, value: string) => {
    setHeadersState((current) => {
      const next = [...current];
      next[columnIndex] = value;
      return next;
    });
  };

  const addRow = () => {
    setRows((current) => [...current, Array.from({ length: columnCount }, () => "")]);
  };

  const removeRow = (rowIndex: number) => {
    setRows((current) => current.filter((_, index) => index !== rowIndex));
  };

  const buildVerificationPayload = (): OcrVerificationSavePayload => ({
    templateId: selectedTemplateId ? Number(selectedTemplateId) : null,
    sourceFilename: file?.name || activeVerification?.source_filename || null,
    columns: columnCount,
    language,
    avgConfidence: preview?.avg_confidence ?? activeVerification?.avg_confidence ?? null,
    warnings: preview?.warnings ?? activeVerification?.warnings ?? [],
    documentHash: activeVerification?.document_hash ?? null,
    docTypeHint: activeVerification?.doc_type_hint ?? preview?.type ?? "table",
    routingMeta: activeVerification?.routing_meta ?? preview?.routing ?? null,
    rawText: activeVerification?.raw_text ?? preview?.raw_text ?? null,
    headers,
    originalRows: preview?.rows ?? activeVerification?.original_rows ?? rows,
    reviewedRows: rows,
    rawColumnAdded: preview?.raw_column_added ?? activeVerification?.raw_column_added ?? false,
    reviewerNotes,
    file,
  });

  const persistDraft = async () => {
    const payload = buildVerificationPayload();
    if (!payload.reviewedRows?.length && !payload.originalRows?.length) {
      throw new Error("Import or open a document first so there are entries to review.");
    }
    if (activeVerificationId != null) {
      const updatePayload = {
        templateId: payload.templateId,
        sourceFilename: payload.sourceFilename,
        columns: payload.columns,
        language: payload.language,
        avgConfidence: payload.avgConfidence,
        warnings: payload.warnings,
        headers: payload.headers,
        originalRows: payload.originalRows,
        reviewedRows: payload.reviewedRows,
        rawColumnAdded: payload.rawColumnAdded,
        reviewerNotes: payload.reviewerNotes,
      };
      return updateOcrVerification(activeVerificationId, {
        ...updatePayload,
      });
    }
    return createOcrVerification(payload);
  };

  const saveAndRefresh = async () => {
    const saved = await persistDraft();
    await loadVerifications(saved.id);
    signalWorkflowRefresh("ocr-review");
    return saved;
  };

  const handleSaveDraft = async () => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const saved = await saveAndRefresh();
      setStatus(`Document #${saved.id} saved.`);
    } catch (err) {
      setError(formatApiErrorMessage(err, "Could not save this review."));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitForApproval = async () => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const saved = await persistDraft();
      const submitted = await submitOcrVerification(saved.id, reviewerNotes);
      await loadVerifications(submitted.id);
      signalWorkflowRefresh("ocr-review-submitted");
      setStatus(`Document #${submitted.id} sent for approval.`);
    } catch (err) {
      setError(formatApiErrorMessage(err, "Could not submit this document for approval."));
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    if (approveNeedsOverride) {
      setError("Critical issues are still open. Check them first, or add a clear review note before approval.");
      return;
    }
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const saved = await persistDraft();
      const approved = await approveOcrVerification(saved.id, reviewerNotes);
      await loadVerifications(approved.id);
      signalWorkflowRefresh("ocr-review-approved");
      setStatus(`Document #${approved.id} approved.`);
    } catch (err) {
      setError(formatApiErrorMessage(err, "Could not approve this document."));
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError("Add a send-back reason before rejecting this document.");
      return;
    }
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const saved = await persistDraft();
      const rejected = await rejectOcrVerification(saved.id, rejectionReason.trim(), reviewerNotes);
      await loadVerifications(rejected.id);
      signalWorkflowRefresh("ocr-review-rejected");
      setStatus(`Document #${rejected.id} sent back for correction.`);
    } catch (err) {
      setError(formatApiErrorMessage(err, "Could not send this document back."));
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadExcel = async () => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      let targetId = activeVerificationId;
      if (!targetId) {
        const saved = await persistDraft();
        targetId = saved.id;
        await loadVerifications(saved.id);
      } else if (!readOnly) {
        const saved = await persistDraft();
        targetId = saved.id;
        await loadVerifications(saved.id);
      }
      if (!targetId) {
        throw new Error("Save a review draft before exporting Excel.");
      }
      const download = await downloadOcrVerificationExport(targetId);
      triggerBlobDownload(download.blob, download.filename);
      const exportMode = activeVerification?.status === "approved" ? "approved" : "reviewed";
      setStatus(`Downloaded ${exportMode} Excel for document #${targetId}.`);
    } catch (err) {
      setError(formatApiErrorMessage(err, "Could not download reviewed Excel."));
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadCsv = async () => {
    try {
      const csv = exportRowsToCsv(headers, rows);
      triggerBlobDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), "ocr-reviewed.csv");
      setStatus("Downloaded CSV review export.");
    } catch (err) {
      setError(formatApiErrorMessage(err, "Could not prepare reviewed CSV."));
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const pdf = await buildStructuredPdfBlob({
        title: activeVerification?.source_filename || "OCR Review Export",
        headers,
        rows,
      });
      triggerBlobDownload(pdf, "ocr-reviewed.pdf");
      setStatus("Downloaded PDF review export.");
    } catch (err) {
      setError(formatApiErrorMessage(err, "Could not prepare reviewed PDF."));
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(exportRowsToMarkdown(headers, rows));
      setStatus("Copied Markdown review table.");
    } catch (err) {
      setError(formatApiErrorMessage(err, "Could not copy Markdown table."));
    }
  };

  const handleApplySafeCleanup = () => {
    setRows((current) =>
      current.map((row) =>
        row.map((cell) => cell.replace(/\s+/g, " ").trim()),
      ),
    );
    setHeadersState((current) =>
      current.map((header) => header.replace(/\s+/g, " ").trim()),
    );
    setStatus("Safe cleanup applied. Recheck the highlighted values before approval.");
  };

  const handleSelectIssue = useCallback((issueKey: string, targetTab?: MobileReviewTab) => {
    setSelectedIssueKey(issueKey);
    if (targetTab) {
      setMobileTab(targetTab);
    }
  }, []);

  const handleMarkIssueChecked = useCallback((issueKey: string) => {
    setResolvedIssueKeys((current) => (current.includes(issueKey) ? current : [...current, issueKey]));
  }, []);

  const filteredVerifications = useMemo(() => {
    const term = search.trim().toLowerCase();
    return verifications.filter((verification) => {
      if (statusFilter !== "all" && verification.status !== statusFilter) return false;
      if (!term) return true;
      return [
        verification.source_filename || "",
        verification.template_name || "",
        verification.status,
        ...(verification.warnings || []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [search, statusFilter, verifications]);
  // AUDIT: FLOW_BROKEN - keep the next queue document explicit so the page leads with one clear review target.
  const nextQueueVerification = filteredVerifications[0] ?? null;
  // AUDIT: DENSITY_OVERLOAD - surface the active document state once at the page level instead of repeating it across hero copy.
  const activeDocumentLabel = activeVerification?.source_filename || file?.name || (preview ? "New document review" : "No document open");
  const activeDocumentStatus = activeVerification?.status || (preview ? "draft" : "idle");

  const pendingCount = verifications.filter((item) => item.status === "pending").length;

  const sourceImageUrl = useMemo(() => {
    if (localImageUrl) return localImageUrl;
    if (activeVerification?.source_image_url) return `/api${activeVerification.source_image_url}`;
    return "";
  }, [activeVerification?.source_image_url, localImageUrl]);

  const reviewIssues = useMemo<ReviewIssue[]>(() => {
    const issues: ReviewIssue[] = [];
    const warnings = preview?.warnings || activeVerification?.warnings || [];
    warnings.forEach((warning, index) => {
      issues.push({
        key: `warning-${index}`,
        tone: "warning",
        title: "System warning",
        detail: warning,
        impact: inferIssueImpact("", warning),
        affectedValue: "Check highlighted rows",
        expectedValue: "Confirm the value against the paper",
        actionLabel: "Review warning",
        helpText: "System warnings often mean the OCR had trouble reading the page cleanly.",
      });
    });

    if (activeVerification?.rejection_reason) {
      issues.unshift({
        key: "sent-back",
        tone: "critical",
        title: "Previously sent back",
        detail: activeVerification.rejection_reason,
        impact: "workflow",
        affectedValue: activeVerification.rejection_reason,
        expectedValue: "Fix the rejected fields before approval",
        actionLabel: "Recheck rejected field",
        helpText: "A rejected document should be corrected before it re-enters reporting or export workflows.",
      });
    }

    if (preview?.fallback_used) {
      issues.push({
        key: "fallback",
        tone: "info",
        title: "Fallback OCR was used",
        detail: "This document was harder to read, so a quick visual comparison is recommended.",
        impact: "workflow",
        affectedValue: "Fallback read used",
        expectedValue: "Do a faster cross-check before approval",
        actionLabel: "Do quick check",
        helpText: "Fallback reads often need a lighter but careful human pass.",
      });
    }

    const fieldIssues: ReviewIssue[] = [];
    rows.forEach((row, rowIndex) => {
      headers.forEach((header, columnIndex) => {
        const value = row[columnIndex] || "";
        const confidence = preview?.cell_confidence?.[rowIndex]?.[columnIndex];
        const impact = inferIssueImpact(header, value);
        if (!value.trim()) {
          fieldIssues.push({
            key: `blank-${rowIndex}-${columnIndex}`,
            tone: impact === "billing" || impact === "stock" ? "critical" : "warning",
            title: `${header || `Column ${columnIndex + 1}`} is blank`,
            detail: `Row ${rowIndex + 1} is missing a value in ${header || `Column ${columnIndex + 1}`}.`,
            impact,
            affectedValue: "Blank",
            expectedValue: "Fill the missing value from the paper",
            actionLabel: "Fill value",
            helpText: "Missing fields can break downstream totals, dispatch records, or traceability.",
            rowIndex,
            columnIndex,
          });
          return;
        }

        if (typeof confidence === "number" && confidence < 80) {
          fieldIssues.push({
            key: `confidence-${rowIndex}-${columnIndex}`,
            tone: confidence < 60 ? "critical" : "warning",
            title: `${header || `Column ${columnIndex + 1}`} needs confirmation`,
            detail: `Row ${rowIndex + 1} may be incorrect. The detected value looks uncertain.`,
            impact,
            affectedValue: value,
            expectedValue: "Compare this value with the original paper",
            actionLabel: "Verify field",
            helpText: "Low-confidence fields should be corrected before the document reaches reports or exports.",
            rowIndex,
            columnIndex,
          });
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
        detail: `${hiddenCount} additional field${hiddenCount === 1 ? "" : "s"} were hidden to keep the review focused.`,
        impact: "workflow",
        affectedValue: `${hiddenCount} more fields`,
        expectedValue: "Open all rows if a full pass is needed",
        actionLabel: "Review full table",
        helpText: "Focus mode keeps the first pass fast. Use all rows for a full audit.",
      });
    }

    return [...issues, ...visibleFieldIssues];
  }, [activeVerification?.rejection_reason, activeVerification?.warnings, headers, preview?.cell_confidence, preview?.fallback_used, preview?.warnings, rows]);

  useEffect(() => {
    setResolvedIssueKeys((current) => current.filter((key) => reviewIssues.some((issue) => issue.key === key)));
  }, [reviewIssues]);

  useEffect(() => {
    if (!reviewIssues.length) {
      setSelectedIssueKey("");
      return;
    }
    if (reviewIssues.some((issue) => issue.key === selectedIssueKey)) {
      return;
    }
    const next = reviewIssues.find((issue) => !resolvedIssueKeys.includes(issue.key)) || reviewIssues[0];
    setSelectedIssueKey(next.key);
  }, [resolvedIssueKeys, reviewIssues, selectedIssueKey]);

  const activeIssue = useMemo(
    () => reviewIssues.find((issue) => issue.key === selectedIssueKey) || reviewIssues[0] || null,
    [reviewIssues, selectedIssueKey],
  );

  const unresolvedIssues = useMemo(
    () => reviewIssues.filter((issue) => !resolvedIssueKeys.includes(issue.key)),
    [resolvedIssueKeys, reviewIssues],
  );

  const totalIssues = reviewIssues.length;
  const checkedIssueCount = resolvedIssueKeys.length;
  const unresolvedIssueCount = unresolvedIssues.length;
  const unresolvedCriticalCount = unresolvedIssues.filter((issue) => issue.tone === "critical").length;
  const approveNeedsOverride = unresolvedCriticalCount > 0 && reviewerNotes.trim().length < 20;

  const handleNextIssue = useCallback(() => {
    const next = reviewIssues.find((issue) => !resolvedIssueKeys.includes(issue.key) && issue.key !== selectedIssueKey);
    if (next) {
      setSelectedIssueKey(next.key);
      if (mobileWorkspaceOpen) {
        setMobileTab(next.rowIndex != null ? "fix" : "issues");
      }
    }
  }, [mobileWorkspaceOpen, resolvedIssueKeys, reviewIssues, selectedIssueKey]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading document review...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Review Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Please sign in to continue."}</div>
            {/* AUDIT: FLOW_BROKEN - send reviewers through the live auth entry instead of the stale login route. */}
            <Link href="/access">
              <Button>Open Access</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!canVerify) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Review Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">
              Document review is available to supervisors, managers, admins, and owners.
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard">
                <Button>Back to Dashboard</Button>
              </Link>
              <Link href="/ocr/scan">
                <Button variant="outline">Open Document Scan</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(62,166,255,0.09),transparent_24%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.06),transparent_20%)] px-4 py-4 md:px-6">
      <div className="w-full space-y-4">
        <section className="sticky top-3 z-20 overflow-hidden rounded-[2rem] border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(18,27,42,0.97),rgba(11,18,30,0.98))] p-5 shadow-2xl backdrop-blur md:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(62,166,255,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.1),transparent_28%)]" />
          <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_24rem]">
            <div>
              <SectionHeading
                eyebrow="Review"
                title="Review Documents"
                detail="Open the next document and clear risky OCR values before export."
              />
              <div className="mt-4 flex flex-wrap gap-3">
                {([
                  ["Select", activeVerification || preview ? "done" : "current"],
                  ["Review", totalIssues ? "current" : "pending"],
                  ["Approve", activeVerification?.status === "pending" ? "current" : activeVerification?.status === "approved" ? "done" : "pending"],
                ] as Array<[string, "done" | "current" | "pending"]>).map(([step, phase]) => (
                  <SurfaceBadge
                    key={step}
                    className={cn(
                      phase === "done"
                        ? "border-emerald-400/30 bg-[rgba(34,197,94,0.12)] text-emerald-100"
                        : phase === "current"
                          ? "border-cyan-400/30 bg-[rgba(34,211,238,0.12)] text-cyan-100"
                          : "border-[var(--border)] bg-[var(--card-strong)] text-[var(--muted)]",
                    )}
                  >
                    {step}
                  </SurfaceBadge>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <SurfaceBadge className="border-white/10 bg-white/[0.03] text-[var(--muted)]">
                  {activeDocumentLabel}
                </SurfaceBadge>
                <SurfaceBadge className={cn("", activeDocumentStatus === "idle" ? "border-[var(--border)] bg-[var(--card-strong)] text-[var(--muted)]" : statusBadgeClass(activeDocumentStatus))}>
                  {activeDocumentStatus === "idle" ? "idle" : activeDocumentStatus.replace("_", " ")}
                </SurfaceBadge>
                <SurfaceBadge className="border-cyan-400/30 bg-[rgba(34,211,238,0.12)] text-cyan-100">
                  {totalIssues ? `${Math.round((checkedIssueCount / totalIssues) * 100)}% reviewed` : "Clean review"}
                </SurfaceBadge>
                <SurfaceBadge className="border-red-400/30 bg-[rgba(239,68,68,0.12)] text-red-100">
                  {unresolvedCriticalCount} critical
                </SurfaceBadge>
                <SurfaceBadge className="border-amber-400/30 bg-[rgba(245,158,11,0.12)] text-amber-100">
                  {unresolvedIssueCount} issues left
                </SurfaceBadge>
                <SurfaceBadge className="border-white/10 bg-white/[0.03] text-[var(--muted)]">
                  {pendingCount} waiting in queue
                </SurfaceBadge>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {nextQueueVerification ? (
                  <Button className="px-4 py-2 text-xs" onClick={() => hydrateFromRecord(nextQueueVerification)}>
                    Open next doc
                  </Button>
                ) : (
                  <Link href="/ocr/scan">
                    <Button className="px-4 py-2 text-xs">Open scan</Button>
                  </Link>
                )}
                <details className="group">
                  <summary className="list-none">
                    <Button variant="outline" className="px-4 py-2 text-xs">
                      More tools
                    </Button>
                  </summary>
                  <div className="mt-3 flex flex-wrap gap-3 rounded-[1.35rem] border border-[var(--border)] bg-[rgba(10,14,24,0.82)] p-3">
                    <Link href="/ocr/scan">
                      <Button variant="outline" className="px-4 py-2 text-xs">Scan desk</Button>
                    </Link>
                    <Button variant="outline" className="px-4 py-2 text-xs" onClick={() => setShowQuickIntake((current) => !current)}>
                      {showQuickIntake ? "Hide intake" : "Quick intake"}
                    </Button>
                  </div>
                </details>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <MetricCard
                label="Current document"
                value={activeDocumentLabel}
                detail={
                  activeVerification
                    ? `Status ${activeVerification.status}. Last updated ${formatTimestamp(activeVerification.updated_at)}.`
                    : preview
                      ? "New preview is open and ready for review."
                      : "Pick a queue document or scan a new one to start."
                }
                className="border-cyan-400/20 bg-[rgba(8,12,20,0.64)]"
              />
              <MetricCard
                label="Review focus"
                value={totalIssues ? `${unresolvedIssueCount} issues left` : "Clean review"}
                detail="Keep the first pass on flagged fields, then use the full table only when a deeper cleanup is needed."
                className="border-emerald-400/20 bg-[rgba(8,12,20,0.64)]"
              />
            </div>
          </div>
        </section>

        <OcrGuideCard
          pageKey="ocr-verify"
          title="Review tips"
          summary="Keep the queue and active document visible. Open this only when you want the full review path."
          steps={[
            {
              label: "Pick",
              detail: nextQueueVerification
                ? `${nextQueueVerification.source_filename || `Document #${nextQueueVerification.id}`} is ready at the top of the queue.`
                : "Open a scanned file or pull the next document from the queue.",
            },
            {
              label: "Fix",
              detail: totalIssues
                ? `${unresolvedIssueCount} flagged issue${unresolvedIssueCount === 1 ? "" : "s"} still need review.`
                : "No flagged issues are blocking this review right now.",
            },
            {
              label: "Send",
              detail: canApprove
                ? "Approve only when the risky values are clear and the export is ready to trust."
                : "Save or submit once the review note and flagged values are complete.",
            },
          ]}
          className="border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(15,22,35,0.97),rgba(11,17,29,0.98))] text-[var(--text)]"
          summaryClassName="text-[var(--accent)]"
          bodyClassName="text-[var(--muted)]"
          stepClassName="border-[var(--border)] bg-[var(--card-strong)] text-[var(--muted)]"
        />

        {status ? <div className="rounded-[1.35rem] border border-emerald-400/30 bg-[rgba(34,197,94,0.12)] px-4 py-3 text-sm text-emerald-100">{status}</div> : null}
        {error || sessionError ? <div className="rounded-[1.35rem] border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{error || sessionError}</div> : null}

        <section className="grid gap-4 xl:grid-cols-[19rem_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-28 xl:self-start">
            <Card className="overflow-hidden border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(15,22,35,0.97),rgba(11,17,29,0.98))]">
              <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <SectionHeading
                  eyebrow="Document queue"
                  title="Pick the next document"
                  detail="Keep the queue visible, but tuck search and status controls away until they are needed."
                />
                {/* AUDIT: BUTTON_CLUTTER - move queue filters into a secondary reveal so document picking stays primary. */}
                <details className="w-full">
                  <summary className="list-none">
                    <Button variant="outline" className="w-full px-4 py-2 text-xs">
                      Queue filters
                    </Button>
                  </summary>
                  <div className="mt-3 grid gap-3">
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by file, warning, or template" />
                    <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                      <option value="all">All documents</option>
                      <option value="pending">Pending approval</option>
                      <option value="draft">Drafts</option>
                      <option value="rejected">Sent back</option>
                      <option value="approved">Approved</option>
                    </Select>
                  </div>
                </details>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <MetricCard label="Queue size" value={filteredVerifications.length} detail="Documents matching the current search and status filters." />
                  <MetricCard label="Pending approvals" value={pendingCount} detail="Sheets waiting for an approver to unlock trusted export." />
                </div>
                {filteredVerifications.length ? (
                  filteredVerifications.map((verification) => {
                    const warningCount = verification.warnings.length;
                    const isActive = activeVerificationId === verification.id;
                    return (
                      <button
                        key={verification.id}
                        type="button"
                        onClick={() => hydrateFromRecord(verification)}
                        className={cn(
                          "w-full rounded-[1.35rem] border p-4 text-left transition",
                          isActive
                            ? "border-[var(--accent)] bg-[linear-gradient(180deg,rgba(62,166,255,0.12),rgba(62,166,255,0.05))]"
                            : "border-[var(--border)] bg-[var(--card-strong)] hover:-translate-y-0.5 hover:border-[var(--accent)]/40",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="font-semibold text-[var(--text)]">
                              {verification.source_filename || `Document #${verification.id}`}
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {verification.template_name || "No template"} | {formatTimestamp(verification.updated_at)}
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                              <span className={cn("rounded-full border px-3 py-1", statusBadgeClass(verification.status))}>
                                {verification.status}
                              </span>
                              <span className={cn("rounded-full border px-3 py-1", verification.trusted_export ? metricTone("success") : metricTone("primary"))}>
                                {verification.trusted_export ? "trusted export" : "review draft"}
                              </span>
                              <span className={cn("rounded-full border px-3 py-1", verification.avg_confidence < 75 || warningCount ? metricTone("warning") : metricTone("success"))}>
                                {verification.avg_confidence.toFixed(0)}% confidence
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            {warningCount ? `${warningCount} warning${warningCount === 1 ? "" : "s"}` : "Clean read"}
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                    No documents match the current queue filters.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AUDIT: BUTTON_CLUTTER - keep quick intake available but secondary to the review queue and active workspace. */}
            {showQuickIntake ? (
              <details className="group overflow-hidden rounded-[1.6rem] border border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(15,22,35,0.97),rgba(11,17,29,0.98))]" open>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <div className="text-sm uppercase tracking-[0.22em] text-[var(--accent)]">Quick intake</div>
                    <div className="mt-1 text-xl font-semibold text-[var(--text)]">Bring a new document into review</div>
                  </div>
                </summary>
                <div className="space-y-4 border-t border-[var(--border)] px-5 py-5">
                  <div>
                    <label className="text-sm text-[var(--muted)]">Document image</label>
                    <Input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Reading guide</label>
                    <Select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
                      <option value="">No template</option>
                      {templates.map((template) => (
                        <option key={template.id} value={String(template.id)}>
                          {template.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm text-[var(--muted)]">Expected columns</label>
                      <Input type="number" min={1} max={8} value={columns} onChange={(event) => setColumns(Math.max(1, Number(event.target.value) || 1))} />
                    </div>
                    <div>
                      <label className="text-sm text-[var(--muted)]">Language hint</label>
                      <Select value={language} onChange={(event) => setLanguage(event.target.value)}>
                        {PREVIEW_LANGUAGES.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  {templateGate ? <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">{templateGate}</div> : null}
                  <div className="flex flex-wrap gap-3">
                    <Button className="px-4 py-2 text-xs" onClick={handleRunPreview} disabled={busy || !file}>
                      {busy ? "Reading..." : "Read doc"}
                    </Button>
                    <Button variant="ghost" className="px-4 py-2 text-xs" onClick={resetWorkspace} disabled={busy}>
                      Clear
                    </Button>
                  </div>
                </div>
              </details>
            ) : null}
          </aside>

          <div className="hidden xl:block min-w-0">
            <ReviewWorkspace
              key={`workspace-desktop-${activeVerificationId ?? "draft"}-${activeVerification?.updated_at || localImageUrl || "new"}`}
              activeVerification={activeVerification}
              canApprove={canApprove}
              busy={busy}
              imageUrl={sourceImageUrl}
              preview={preview}
              rows={rows}
              headers={headers}
              reviewerNotes={reviewerNotes}
              rejectionReason={rejectionReason}
              reviewIssues={reviewIssues}
              activeIssue={activeIssue}
              resolvedIssueKeys={resolvedIssueKeys}
              unresolvedIssueCount={unresolvedIssueCount}
              unresolvedCriticalCount={unresolvedCriticalCount}
              approveNeedsOverride={approveNeedsOverride}
              readOnly={readOnly}
              mobileTab={mobileTab}
              onReviewerNotesChange={setReviewerNotes}
              onRejectionReasonChange={setRejectionReason}
              onSaveDraft={handleSaveDraft}
              onSubmit={handleSubmitForApproval}
              onApprove={handleApprove}
              onReject={handleReject}
              onDownloadExcel={handleDownloadExcel}
              onDownloadCsv={handleDownloadCsv}
              onDownloadPdf={handleDownloadPdf}
              onCopyMarkdown={handleCopyMarkdown}
              onApplySafeCleanup={handleApplySafeCleanup}
              onAddRow={addRow}
              onRemoveRow={removeRow}
              onUpdateHeader={updateHeader}
              onUpdateCell={updateCell}
              onSelectIssue={handleSelectIssue}
              onMarkIssueChecked={handleMarkIssueChecked}
              onNextIssue={handleNextIssue}
              onMobileTabChange={setMobileTab}
              onRefreshQueue={() => void loadVerifications(activeVerificationId ?? undefined)}
            />
          </div>
        </section>
      </div>

      {mobileWorkspaceOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(4,8,16,0.96)] px-4 py-4 xl:hidden">
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setMobileWorkspaceOpen(false)}>
                Close
              </Button>
            </div>
            <ReviewWorkspace
              key={`workspace-mobile-${activeVerificationId ?? "draft"}-${activeVerification?.updated_at || localImageUrl || "new"}`}
              activeVerification={activeVerification}
              canApprove={canApprove}
              busy={busy}
              imageUrl={sourceImageUrl}
              preview={preview}
              rows={rows}
              headers={headers}
              reviewerNotes={reviewerNotes}
              rejectionReason={rejectionReason}
              reviewIssues={reviewIssues}
              activeIssue={activeIssue}
              resolvedIssueKeys={resolvedIssueKeys}
              unresolvedIssueCount={unresolvedIssueCount}
              unresolvedCriticalCount={unresolvedCriticalCount}
              approveNeedsOverride={approveNeedsOverride}
              readOnly={readOnly}
              mobile
              mobileTab={mobileTab}
              onReviewerNotesChange={setReviewerNotes}
              onRejectionReasonChange={setRejectionReason}
              onSaveDraft={handleSaveDraft}
              onSubmit={handleSubmitForApproval}
              onApprove={handleApprove}
              onReject={handleReject}
              onDownloadExcel={handleDownloadExcel}
              onDownloadCsv={handleDownloadCsv}
              onDownloadPdf={handleDownloadPdf}
              onCopyMarkdown={handleCopyMarkdown}
              onApplySafeCleanup={handleApplySafeCleanup}
              onAddRow={addRow}
              onRemoveRow={removeRow}
              onUpdateHeader={updateHeader}
              onUpdateCell={updateCell}
              onSelectIssue={handleSelectIssue}
              onMarkIssueChecked={handleMarkIssueChecked}
              onNextIssue={handleNextIssue}
              onMobileTabChange={setMobileTab}
              onRefreshQueue={() => void loadVerifications(activeVerificationId ?? undefined)}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
