"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  approveAttendanceReview,
  listAttendanceReview,
  rejectAttendanceReview,
  type AttendanceReviewFinalStatus,
  type AttendanceReviewItem,
  type AttendanceReviewPayload,
} from "@/lib/attendance";
import { listUnreadAlerts, markAlertRead, type AlertItem } from "@/lib/dashboard";
import { approveEntry, listEntries, rejectEntry, type Entry } from "@/lib/entries";
import {
  approveOcrVerification,
  listOcrVerifications,
  rejectOcrVerification,
  type OcrVerificationRecord,
} from "@/lib/ocr";
import {
  approveSteelReconciliation,
  getSteelOverview,
  listSteelReconciliations,
  rejectSteelReconciliation,
  type SteelBatch,
  type SteelOverview,
  type SteelReconciliation,
} from "@/lib/steel";
import { cn } from "@/lib/utils";
import { signalWorkflowRefresh, subscribeToWorkflowRefresh } from "@/lib/workflow-sync";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type InboxState = {
  pendingAttendanceReviews: AttendanceReviewItem[];
  pendingAttendanceReviewTotal: number;
  pendingEntries: Entry[];
  pendingEntryTotal: number;
  pendingVerifications: OcrVerificationRecord[];
  pendingVerificationTotal: number;
  pendingReconciliations: SteelReconciliation[];
  pendingReconciliationTotal: number;
  highRiskBatches: SteelBatch[];
  highRiskBatchTotal: number;
  unreadAlerts: AlertItem[];
  unreadAlertTotal: number;
  refreshedAt: string;
};

type ReviewSeverity = "critical" | "high" | "warning" | "info";
type AgeBand = "fresh" | "aging" | "stale";
type TaskKind = "attendance" | "entry" | "ocr" | "reconciliation";
type SignalKind = "alert" | "batch";
type TaskFilter = "all" | TaskKind;
type SeverityFilter = "all" | ReviewSeverity;
type AgeFilter = "all" | AgeBand | "sla8";
type BulkDecision = "approve" | "reject";
type QueuePreset = "all" | "today" | "sla8" | "stale" | "stock" | "ocr" | "custom";

type DetailFact = {
  label: string;
  value: string;
};

type QueueLink = {
  href: string;
  label: string;
};

const REVIEW_DETAIL_PANEL_STORAGE_KEY = "dpr.reviewQueue.detailPanel";

type BaseQueueItem = {
  key: string;
  bucket: "task" | "signal";
  kind: TaskKind | SignalKind;
  typeLabel: string;
  title: string;
  headline: string;
  description: string;
  recommendation: string;
  severity: ReviewSeverity;
  statusLabel: string;
  ageBand: AgeBand;
  ageLabel: string;
  timestamp?: string | null;
  priorityScore: number;
  openHref: string;
  openLabel: string;
  facts: DetailFact[];
};

type EntryTaskItem = BaseQueueItem & {
  bucket: "task";
  kind: "entry";
  source: Entry;
  canApprove: true;
  canReject: true;
};

type AttendanceTaskItem = BaseQueueItem & {
  bucket: "task";
  kind: "attendance";
  source: AttendanceReviewItem;
  canApprove: true;
  canReject: true;
};

type OcrTaskItem = BaseQueueItem & {
  bucket: "task";
  kind: "ocr";
  source: OcrVerificationRecord;
  canApprove: boolean;
  canReject: boolean;
};

type ReconciliationTaskItem = BaseQueueItem & {
  bucket: "task";
  kind: "reconciliation";
  source: SteelReconciliation;
  canApprove: boolean;
  canReject: boolean;
};

type AlertSignalItem = BaseQueueItem & {
  bucket: "signal";
  kind: "alert";
  source: AlertItem;
  actionLabel: string;
};

type BatchSignalItem = BaseQueueItem & {
  bucket: "signal";
  kind: "batch";
  source: SteelBatch;
  actionLabel: string;
};

type ReviewTaskItem = AttendanceTaskItem | EntryTaskItem | OcrTaskItem | ReconciliationTaskItem;
type ReviewSignalItem = AlertSignalItem | BatchSignalItem;
type ReviewQueueItem = ReviewTaskItem | ReviewSignalItem;

function emptyInboxState(): InboxState {
  return {
    pendingAttendanceReviews: [],
    pendingAttendanceReviewTotal: 0,
    pendingEntries: [],
    pendingEntryTotal: 0,
    pendingVerifications: [],
    pendingVerificationTotal: 0,
    pendingReconciliations: [],
    pendingReconciliationTotal: 0,
    highRiskBatches: [],
    highRiskBatchTotal: 0,
    unreadAlerts: [],
    unreadAlertTotal: 0,
    refreshedAt: "",
  };
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatShift(value?: string | null) {
  if (!value) return "-";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatMinutes(value?: number | null) {
  const safe = Math.max(value || 0, 0);
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

function formatNumber(value?: number | null, digits = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCurrency(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function reviewRoles(role?: string | null) {
  return ["supervisor", "manager", "admin", "owner"].includes(role || "");
}

function signalRailCountsRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("dpr:rail-counts-refresh"));
  }
}

function severityWeight(severity: ReviewSeverity) {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "warning":
      return 2;
    default:
      return 1;
  }
}

function severityClasses(severity: ReviewSeverity) {
  switch (severity) {
    case "critical":
      return "border-red-400/40 bg-[rgba(239,68,68,0.12)] text-red-100";
    case "high":
      return "border-orange-400/40 bg-[rgba(249,115,22,0.12)] text-orange-100";
    case "warning":
      return "border-amber-400/40 bg-[rgba(245,158,11,0.12)] text-amber-100";
    default:
      return "border-emerald-400/30 bg-[rgba(34,197,94,0.12)] text-emerald-100";
  }
}

function typeClasses(kind: TaskKind | SignalKind) {
  switch (kind) {
    case "attendance":
      return "border-violet-400/30 bg-[rgba(167,139,250,0.12)] text-violet-100";
    case "entry":
      return "border-sky-400/30 bg-[rgba(56,189,248,0.12)] text-sky-100";
    case "ocr":
      return "border-cyan-400/30 bg-[rgba(34,211,238,0.12)] text-cyan-100";
    case "reconciliation":
      return "border-orange-400/30 bg-[rgba(249,115,22,0.12)] text-orange-100";
    case "batch":
      return "border-fuchsia-400/30 bg-[rgba(217,70,239,0.12)] text-fuchsia-100";
    default:
      return "border-amber-400/30 bg-[rgba(245,158,11,0.12)] text-amber-100";
  }
}

function ageClasses(ageBand: AgeBand) {
  switch (ageBand) {
    case "stale":
      return "text-red-200";
    case "aging":
      return "text-amber-200";
    default:
      return "text-emerald-200";
  }
}

function getAgeMeta(value?: string | null) {
  if (!value) {
    return { ageBand: "fresh" as AgeBand, ageLabel: "New", ageWeight: 0 };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { ageBand: "fresh" as AgeBand, ageLabel: "Recent", ageWeight: 0 };
  }

  const hours = Math.max(0, (Date.now() - parsed.getTime()) / (1000 * 60 * 60));
  if (hours >= 24) {
    return { ageBand: "stale" as AgeBand, ageLabel: `${Math.round(hours)}h waiting`, ageWeight: 3 };
  }
  if (hours >= 8) {
    return { ageBand: "aging" as AgeBand, ageLabel: `${Math.round(hours)}h in queue`, ageWeight: 2 };
  }
  if (hours >= 1) {
    return { ageBand: "fresh" as AgeBand, ageLabel: `${Math.round(hours)}h new`, ageWeight: 1 };
  }
  return { ageBand: "fresh" as AgeBand, ageLabel: "Fresh", ageWeight: 0 };
}

function getEntrySeverity(entry: Entry) {
  const performance = entry.units_target > 0 ? (entry.units_produced / entry.units_target) * 100 : null;
  if (entry.quality_issues || (performance != null && performance < 50) || entry.downtime_minutes >= 90) {
    return "critical" as ReviewSeverity;
  }
  if ((performance != null && performance < 75) || entry.downtime_minutes >= 30) {
    return "high" as ReviewSeverity;
  }
  if (entry.downtime_minutes > 0 || entry.manpower_absent > 0 || (performance != null && performance < 100)) {
    return "warning" as ReviewSeverity;
  }
  return "info" as ReviewSeverity;
}

function normalizeAttendanceStatus(status?: string | null) {
  if (!status) return "-";
  return status
    .split("_")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function getAttendanceIssueLabel(item: AttendanceReviewItem) {
  const requestType = item.regularization?.request_type || "";
  if (requestType === "missed_punch") return "Missed punch";
  if (requestType === "status_correction") return "Status correction";
  if (requestType === "shift_correction") return "Shift correction";
  if (requestType === "timing_correction") return "Timing correction";
  if (!item.punch_in_at || !item.punch_out_at || item.status === "missed_punch") return "Missed punch";
  if (item.status === "absent") return "Absent status";
  if (item.late_minutes > 0) return "Late entry";
  if (item.overtime_minutes > 0) return "Overtime check";
  return "Attendance review";
}

function getAttendanceSeverity(item: AttendanceReviewItem) {
  const issueLabel = getAttendanceIssueLabel(item);
  if (item.status === "absent" || issueLabel === "Missed punch" || issueLabel === "Status correction") {
    return "critical" as ReviewSeverity;
  }
  if (issueLabel === "Shift correction" || issueLabel === "Late entry" || issueLabel === "Timing correction") {
    return "high" as ReviewSeverity;
  }
  if (item.overtime_minutes > 0 || item.review_reason.trim().length > 0) {
    return "warning" as ReviewSeverity;
  }
  return "info" as ReviewSeverity;
}

function normalizeAttendance(item: AttendanceReviewItem): AttendanceTaskItem {
  const severity = getAttendanceSeverity(item);
  const timestamp = item.regularization?.created_at || `${item.attendance_date}T00:00:00`;
  const age = getAgeMeta(timestamp);
  const issueLabel = getAttendanceIssueLabel(item);
  return {
    key: `attendance:${item.attendance_id}`,
    bucket: "task",
    kind: "attendance",
    source: item,
    canApprove: true,
    canReject: true,
    typeLabel: "Attendance review",
    title: `${item.name} • ${formatDate(item.attendance_date)} • ${formatShift(item.shift)}`,
    headline: `${issueLabel} • ${item.department || normalizeAttendanceStatus(item.role)} • status ${normalizeAttendanceStatus(item.status)}`,
    description: item.review_reason || "Attendance record needs a supervisor decision before payroll and reports close.",
    recommendation:
      severity === "critical"
        ? "Confirm punch times or final status now to avoid payroll or compliance drift."
        : "Validate the request and close it so attendance reports stay clean.",
    severity,
    statusLabel: "Pending attendance review",
    ageBand: age.ageBand,
    ageLabel: age.ageLabel,
    timestamp,
    priorityScore: severityWeight(severity) * 100 + age.ageWeight * 10 + (item.regularization ? 6 : 0),
    openHref: "/attendance/review",
    openLabel: "Open attendance review",
    facts: [
      { label: "Employee", value: `${item.name} (${item.user_code})` },
      { label: "Role", value: normalizeAttendanceStatus(item.role) },
      { label: "Department", value: item.department || "-" },
      { label: "Shift", value: formatShift(item.shift) },
      { label: "Status", value: normalizeAttendanceStatus(item.status) },
      { label: "Punch in", value: formatDateTime(item.punch_in_at) },
      { label: "Punch out", value: formatDateTime(item.punch_out_at) },
      { label: "Worked / late", value: `${formatMinutes(item.worked_minutes)} / ${formatMinutes(item.late_minutes)}` },
      { label: "Overtime", value: formatMinutes(item.overtime_minutes) },
      { label: "Review reason", value: item.review_reason || "-" },
    ],
  };
}

function deriveAttendanceFinalStatus(item: AttendanceReviewItem): AttendanceReviewFinalStatus {
  if (item.status === "absent") return "absent";
  if (item.punch_out_at) return "completed";
  return "working";
}

function canRunTaskDecision(item: ReviewTaskItem, decision: BulkDecision) {
  return decision === "approve" ? item.canApprove : item.canReject;
}

function getOcrSeverity(record: OcrVerificationRecord) {
  if (record.avg_confidence < 60 || record.warnings.length >= 3) return "critical" as ReviewSeverity;
  if (record.avg_confidence < 75 || record.warnings.length >= 1) return "high" as ReviewSeverity;
  if (record.avg_confidence < 88) return "warning" as ReviewSeverity;
  return "info" as ReviewSeverity;
}

function getConfidenceSeverity(status?: string | null) {
  switch ((status || "").toLowerCase()) {
    case "red":
      return "critical" as ReviewSeverity;
    case "yellow":
      return "high" as ReviewSeverity;
    default:
      return "warning" as ReviewSeverity;
  }
}

function getAlertSeverity(status?: string | null) {
  switch ((status || "").toLowerCase()) {
    case "critical":
      return "critical" as ReviewSeverity;
    case "high":
      return "high" as ReviewSeverity;
    case "medium":
    case "warning":
    case "watch":
      return "warning" as ReviewSeverity;
    default:
      return "info" as ReviewSeverity;
  }
}

function getSteelBatchSeverity(status?: string | null) {
  switch ((status || "").toLowerCase()) {
    case "critical":
      return "critical" as ReviewSeverity;
    case "high":
      return "high" as ReviewSeverity;
    case "watch":
      return "warning" as ReviewSeverity;
    default:
      return "info" as ReviewSeverity;
  }
}

function normalizeEntry(entry: Entry): EntryTaskItem {
  const severity = getEntrySeverity(entry);
  const timestamp = entry.updated_at || entry.created_at || `${entry.date}T00:00:00`;
  const age = getAgeMeta(timestamp);
  const performance = entry.units_target > 0 ? Math.round((entry.units_produced / entry.units_target) * 100) : null;
  const blockers = [
    entry.quality_issues ? "quality issue raised" : null,
    entry.downtime_minutes > 0 ? `${entry.downtime_minutes} min downtime` : null,
    entry.manpower_absent > 0 ? `${entry.manpower_absent} absent` : null,
  ].filter(Boolean);

  return {
    key: `entry:${entry.id}`,
    bucket: "task",
    kind: "entry",
    source: entry,
    canApprove: true,
    canReject: true,
    typeLabel: "DPR entry",
    title: `${formatDate(entry.date)} • ${formatShift(entry.shift)}`,
    headline: `${entry.department || "No department"} • ${entry.submitted_by || "Unknown"} • ${performance != null ? `${performance}% performance` : `${formatNumber(entry.units_produced)} units`}`,
    description: blockers.length ? blockers.join(" • ") : "Ready for a quick supervisor review.",
    recommendation:
      severity === "critical"
        ? "Open the full entry before approval because production or quality signals look risky."
        : "Check the shift summary and close it quickly if the production notes look normal.",
    severity,
    statusLabel: "Pending DPR review",
    ageBand: age.ageBand,
    ageLabel: age.ageLabel,
    timestamp,
    priorityScore: severityWeight(severity) * 100 + age.ageWeight * 10 + (entry.quality_issues ? 8 : 0),
    openHref: `/entry/${entry.id}`,
    openLabel: "Open entry",
    facts: [
      { label: "Shift", value: formatShift(entry.shift) },
      { label: "Department", value: entry.department || "-" },
      { label: "Submitted by", value: entry.submitted_by || "-" },
      { label: "Units target", value: formatNumber(entry.units_target) },
      { label: "Units produced", value: formatNumber(entry.units_produced) },
      { label: "Present / absent", value: `${formatNumber(entry.manpower_present)} / ${formatNumber(entry.manpower_absent)}` },
      { label: "Downtime", value: `${formatNumber(entry.downtime_minutes)} min` },
      { label: "Quality issue", value: entry.quality_issues ? entry.quality_details || "Yes" : "No" },
      { label: "Last update", value: formatDateTime(timestamp) },
    ],
  };
}

function normalizeOcr(record: OcrVerificationRecord, canApproveOcr: boolean): OcrTaskItem {
  const severity = getOcrSeverity(record);
  const timestamp = record.submitted_at || record.created_at || record.updated_at;
  const age = getAgeMeta(timestamp);
  const warnings = record.warnings.slice(0, 2).join(" • ");

  return {
    key: `ocr:${record.id}`,
    bucket: "task",
    kind: "ocr",
    source: record,
    canApprove: canApproveOcr,
    canReject: canApproveOcr,
    typeLabel: "OCR review",
    title: record.source_filename || `Verification #${record.id}`,
    headline: `${record.columns} columns • ${Math.round(record.avg_confidence)}% confidence • ${record.language.toUpperCase()}`,
    description: warnings || "No warnings raised on the queued document.",
    recommendation:
      canApproveOcr
        ? "Check low-confidence cells and warnings before the rows move into exports."
        : "Open the document review workspace and hand off approval to a manager or above.",
    severity,
    statusLabel: canApproveOcr ? "Waiting for document approval" : "Manager approval required",
    ageBand: age.ageBand,
    ageLabel: age.ageLabel,
    timestamp,
    priorityScore: severityWeight(severity) * 100 + age.ageWeight * 10 + (record.warnings.length > 0 ? 8 : 0),
    openHref: `/ocr/verify?verification_id=${record.id}`,
    openLabel: "Open document review",
    facts: [
      { label: "Template", value: record.template_name || "-" },
      { label: "Language", value: record.language.toUpperCase() },
      { label: "Columns", value: formatNumber(record.columns) },
      { label: "Confidence", value: `${Math.round(record.avg_confidence)}%` },
      { label: "Warnings", value: record.warnings.length ? record.warnings.join(" • ") : "None" },
      { label: "Headers", value: record.headers.length ? record.headers.join(" | ") : "-" },
      { label: "Submitted", value: formatDateTime(timestamp) },
      { label: "Rows", value: formatNumber(record.reviewed_rows.length || record.original_rows.length) },
    ],
  };
}

function normalizeReconciliation(record: SteelReconciliation, canApprove: boolean): ReconciliationTaskItem {
  const severity = getConfidenceSeverity(record.confidence_status);
  const timestamp = record.counted_at;
  const age = getAgeMeta(timestamp);
  return {
    key: `reconciliation:${record.id}`,
    bucket: "task",
    kind: "reconciliation",
    source: record,
    canApprove,
    canReject: canApprove,
    typeLabel: "Stock review",
    title: record.item_name || record.item_code || `Item #${record.item_id}`,
    headline: `Variance ${formatNumber(record.variance_kg, 1)} KG • ${formatNumber(record.variance_percent, 1)}% • ${record.confidence_status.toUpperCase()} confidence`,
    description: record.notes?.trim() || "Physical stock count needs a decision before it changes trust in the inventory book.",
    recommendation:
      canApprove
        ? "Check variance, notes, and counted-by details before locking the stock decision."
        : "Review the stock context and escalate approval to an admin or owner.",
    severity,
    statusLabel: canApprove ? "Pending stock decision" : "Admin approval required",
    ageBand: age.ageBand,
    ageLabel: age.ageLabel,
    timestamp,
    priorityScore: severityWeight(severity) * 100 + age.ageWeight * 10 + (Math.abs(record.variance_kg) >= 100 ? 12 : 0),
    openHref: "/steel/reconciliations",
    openLabel: "Open stock review",
    facts: [
      { label: "System qty", value: `${formatNumber(record.system_qty_kg, 1)} KG` },
      { label: "Physical qty", value: `${formatNumber(record.physical_qty_kg, 1)} KG` },
      { label: "Variance", value: `${formatNumber(record.variance_kg, 1)} KG` },
      { label: "Variance %", value: `${formatNumber(record.variance_percent, 1)}%` },
      { label: "Confidence", value: record.confidence_status.toUpperCase() },
      { label: "Counted by", value: record.counted_by_name || "-" },
      { label: "Counted at", value: formatDateTime(record.counted_at) },
      { label: "Notes", value: record.notes || "-" },
    ],
  };
}

function normalizeAlert(alert: AlertItem): AlertSignalItem {
  const severity = getAlertSeverity(alert.severity);
  const age = getAgeMeta(alert.created_at);
  return {
    key: `alert:${alert.id}`,
    bucket: "signal",
    kind: "alert",
    source: alert,
    actionLabel: "Mark as read",
    typeLabel: "Factory signal",
    title: alert.message,
    headline: `${alert.alert_type} • ${formatDateTime(alert.created_at)}`,
    description: "This is a signal to acknowledge and route into the right operating workflow.",
    recommendation: "Clear the alert only after the related review or factory action has an owner.",
    severity,
    statusLabel: "Unread alert",
    ageBand: age.ageBand,
    ageLabel: age.ageLabel,
    timestamp: alert.created_at,
    priorityScore: severityWeight(severity) * 100 + age.ageWeight * 10,
    openHref: "/dashboard",
    openLabel: "Open dashboard",
    facts: [
      { label: "Type", value: alert.alert_type },
      { label: "Raised at", value: formatDateTime(alert.created_at) },
      { label: "Severity", value: alert.severity || "info" },
    ],
  };
}

function normalizeBatch(batch: SteelBatch): BatchSignalItem {
  const severity = getSteelBatchSeverity(batch.severity);
  const age = getAgeMeta(batch.created_at || batch.production_date);
  return {
    key: `batch:${batch.id}`,
    bucket: "signal",
    kind: "batch",
    source: batch,
    actionLabel: "Trace batch",
    typeLabel: "Steel exception",
    title: batch.batch_code,
    headline: `${formatDate(batch.production_date)} • ${batch.operator_name || "Unknown operator"} • score ${formatNumber(batch.anomaly_score, 1)}`,
    description: `Variance ${formatNumber(batch.variance_kg, 1)} KG • loss ${formatNumber(batch.loss_percent, 1)}%`,
    recommendation: "Trace the batch before dispatch, billing, or stock trust is affected downstream.",
    severity,
    statusLabel: "Needs investigation",
    ageBand: age.ageBand,
    ageLabel: age.ageLabel,
    timestamp: batch.created_at || batch.production_date,
    priorityScore: severityWeight(severity) * 100 + age.ageWeight * 10,
    openHref: `/steel/batches/${batch.id}`,
    openLabel: "Open batch trace",
    facts: [
      { label: "Operator", value: batch.operator_name || "-" },
      { label: "Input item", value: batch.input_item_name || "-" },
      { label: "Output item", value: batch.output_item_name || "-" },
      { label: "Variance", value: `${formatNumber(batch.variance_kg, 1)} KG` },
      { label: "Loss %", value: `${formatNumber(batch.loss_percent, 1)}%` },
      { label: "Leakage value", value: formatCurrency(batch.variance_value_inr) },
      { label: "Estimated margin", value: formatCurrency(batch.estimated_gross_profit_inr) },
      { label: "Created", value: formatDateTime(batch.created_at) },
    ],
  };
}

function latestActivityLabel(item: ReviewQueueItem) {
  const fallbackStatus = item.statusLabel;
  switch (item.kind) {
    case "attendance":
      return item.source.regularization?.created_at
        ? `Raised ${formatDateTime(item.source.regularization.created_at)}`
        : `Review date ${formatDate(item.source.attendance_date)}`;
    case "entry":
      return item.source.updated_at
        ? `Updated ${formatDateTime(item.source.updated_at)}`
        : `Submitted ${formatDateTime(item.source.created_at)}`;
    case "ocr":
      return item.source.submitted_at
        ? `Submitted ${formatDateTime(item.source.submitted_at)}`
        : `Saved ${formatDateTime(item.source.updated_at || item.source.created_at)}`;
    case "reconciliation":
      return `Counted ${formatDateTime(item.source.counted_at)}`;
    case "alert":
      return `Raised ${formatDateTime(item.source.created_at)}`;
    case "batch":
      return `Detected ${formatDateTime(item.source.created_at || item.source.production_date)}`;
    default:
      return fallbackStatus;
  }
}

function requiresDecisionNote(item: ReviewTaskItem, decision: BulkDecision) {
  if (decision === "reject") return true;
  if (item.kind === "entry") return false;
  return item.severity === "critical" || item.severity === "high";
}

function decisionNoteGuidance(item: ReviewTaskItem) {
  if (item.kind === "entry") {
    return "Reject needs a reason. DPR approval itself does not persist a queue review note yet.";
  }
  if (requiresDecisionNote(item, "approve")) {
    return "High-risk approval requires a review note so the queue keeps decision context.";
  }
  return "Reject needs a reason so the queue keeps an audit trail.";
}

function blockedReason(item: ReviewQueueItem) {
  if (item.bucket !== "task" || item.canApprove || item.canReject) return "";
  switch (item.kind) {
    case "ocr":
      return "Manager or higher approval is required before reviewed OCR rows become trusted output.";
    case "reconciliation":
      return "Admin or owner approval is required before a stock trust decision can be locked.";
    default:
      return "This item needs a higher-permission reviewer in the source workflow.";
  }
}

function detailHistoryFacts(item: ReviewQueueItem): DetailFact[] {
  switch (item.kind) {
    case "attendance":
      return [
        { label: "Request raised", value: formatDateTime(item.source.regularization?.created_at) },
        { label: "Request type", value: item.source.regularization?.request_type || getAttendanceIssueLabel(item.source) },
        { label: "Employee note", value: item.source.regularization?.reason || item.source.note || item.source.review_reason || "-" },
        { label: "Last reviewer note", value: item.source.regularization?.reviewer_note || "-" },
        { label: "Reviewed at", value: formatDateTime(item.source.regularization?.reviewed_at) },
      ];
    case "entry":
      return [
        { label: "Created", value: formatDateTime(item.source.created_at) },
        { label: "Last updated", value: formatDateTime(item.source.updated_at) },
        { label: "Status", value: item.source.status || "pending" },
        { label: "Notes", value: item.source.notes || "-" },
      ];
    case "ocr":
      return [
        { label: "Created", value: formatDateTime(item.source.created_at) },
        { label: "Submitted", value: formatDateTime(item.source.submitted_at) },
        { label: "Last updated", value: formatDateTime(item.source.updated_at) },
        { label: "Latest review note", value: item.source.reviewer_notes || "-" },
        { label: "Last correction reason", value: item.source.rejection_reason || "-" },
      ];
    case "reconciliation":
      return [
        { label: "Counted at", value: formatDateTime(item.source.counted_at) },
        { label: "Counted by", value: item.source.counted_by_name || "-" },
        { label: "Approved by", value: item.source.approved_by_name || "-" },
        { label: "Approved at", value: formatDateTime(item.source.approved_at) },
        { label: "Rejected by", value: item.source.rejected_by_name || "-" },
        { label: "Rejected at", value: formatDateTime(item.source.rejected_at) },
        { label: "Approver notes", value: item.source.approver_notes || "-" },
        { label: "Rejection reason", value: item.source.rejection_reason || "-" },
      ];
    case "alert":
      return [
        { label: "Raised", value: formatDateTime(item.source.created_at) },
        { label: "Signal type", value: item.source.alert_type },
        { label: "Severity", value: item.source.severity || "info" },
      ];
    case "batch":
      return [
        { label: "Production date", value: formatDate(item.source.production_date) },
        { label: "Detected", value: formatDateTime(item.source.created_at) },
        { label: "Operator", value: item.source.operator_name || "-" },
        { label: "Reason", value: item.source.variance_reason || "-" },
      ];
    default:
      return [];
  }
}

function detailSummary(item: ReviewQueueItem) {
  const fallbackRecommendation = item.recommendation;
  switch (item.kind) {
    case "attendance":
      return {
        title: "Attendance and payroll impact",
        summary: "Approving this closes an attendance exception and pushes a cleaner final status into attendance reporting and payroll review.",
        checks: [
          "Confirm punch times or final status match the employee request.",
          "Check the regularization reason before closing the exception.",
          "Make sure shift and worked-minute impact look realistic.",
        ],
      };
    case "entry":
      return {
        title: "Production reporting impact",
        summary: "Approving this DPR entry closes the shift into official reporting, so quality, downtime, and manpower signals should be believable first.",
        checks: [
          "Check performance against target before approval.",
          "Look at downtime and quality issue details closely.",
          "Reject and reopen the source entry if the shift story does not add up.",
        ],
      };
    case "ocr":
      return {
        title: "Trusted OCR impact",
        summary: "Approving this OCR review makes the reviewed rows eligible for trusted export and downstream reporting.",
        checks: [
          "Check low-confidence fields and warnings before approval.",
          "Confirm the row count and headers match the source paper.",
          "Use rejection when the document needs another correction pass.",
        ],
      };
    case "reconciliation":
      return {
        title: "Stock trust impact",
        summary: "Approving this reconciliation locks a physical-vs-system stock decision, which directly affects confidence in inventory and downstream dispatch planning.",
        checks: [
          "Verify variance kg and variance percent against the physical count.",
          "Read counted-by context and notes before approving.",
          "Reject and escalate when confidence is red or the variance looks unsafe.",
        ],
      };
    case "alert":
      return {
        title: "Signal routing",
        summary: "This is not a decision item yet. Route it into the right workflow owner before clearing the alert.",
        checks: [
          "Confirm which workflow the alert belongs to.",
          "Assign an owner mentally before acknowledging it.",
          "Open the source page if the alert suggests a deeper operating issue.",
        ],
      };
    case "batch":
      return {
        title: "Investigation impact",
        summary: "This high-risk batch can affect stock trust, dispatch, billing, and owner confidence if the variance is left unexplained.",
        checks: [
          "Trace the operator, date, and item movement first.",
          "Compare leakage value against expected gross profit.",
          "Open the batch trace page for deep investigation before routing onward.",
        ],
      };
    default:
      return {
        title: "Decision context",
        summary: fallbackRecommendation,
        checks: ["Open the source workflow before making a final decision."],
      };
  }
}

function detailNextSteps(item: ReviewQueueItem): QueueLink[] {
  const defaultLink = { href: item.openHref, label: item.openLabel };
  switch (item.kind) {
    case "attendance":
      return [
        { href: item.openHref, label: item.openLabel },
        { href: "/attendance/live", label: "Open live attendance" },
      ];
    case "entry":
      return [
        { href: item.openHref, label: item.openLabel },
        { href: "/reports", label: "Open reports" },
      ];
    case "ocr":
      return [
        { href: item.openHref, label: "Open exact OCR review" },
        { href: "/reports", label: "Open reports" },
      ];
    case "reconciliation":
      return [
        { href: item.openHref, label: item.openLabel },
        { href: "/steel/charts", label: "Open steel charts" },
      ];
    case "alert":
      return [
        { href: item.openHref, label: item.openLabel },
        { href: "/work-queue", label: "Open work queue" },
      ];
    case "batch":
      return [
        { href: item.openHref, label: item.openLabel },
        { href: "/steel/charts", label: "Open steel charts" },
      ];
    default:
      return [defaultLink];
  }
}

function presetLabel(preset: QueuePreset) {
  switch (preset) {
    case "today":
      return "Today";
    case "sla8":
      return "8h+";
    case "stale":
      return "24h+";
    case "stock":
      return "Stock only";
    case "ocr":
      return "OCR only";
    case "custom":
      return "Custom";
    default:
      return "All";
  }
}

function SummaryMetric({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  tone: string;
}) {
  return (
    <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
      <CardHeader className="space-y-2">
        <div className="text-sm text-[var(--muted)]">{label}</div>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        <div className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", tone)}>
          {helper}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <Card className="border-dashed border-[var(--border)] bg-[var(--card-strong)]">
      <CardContent className="flex min-h-[12rem] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Review Queue</div>
        <div className="text-2xl font-semibold text-[var(--text)]">{title}</div>
        <div className="max-w-xl text-sm leading-6 text-[var(--muted)]">{body}</div>
      </CardContent>
    </Card>
  );
}

function QueueDetailPanel({
  item,
  note,
  onNoteChange,
  onApprove,
  onReject,
  onSignalAction,
  busyKey,
  mobile = false,
  onClose,
}: {
  item: ReviewQueueItem | null;
  note: string;
  onNoteChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onSignalAction: () => void;
  busyKey: string;
  mobile?: boolean;
  onClose?: () => void;
}) {
  if (!item) {
    return (
      <Card className="border-dashed border-[var(--border)] bg-[var(--card-strong)]">
        <CardContent className="flex min-h-[22rem] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <div className="text-sm uppercase tracking-[0.26em] text-[var(--accent)]">Review Detail</div>
          <div className="text-2xl font-semibold text-[var(--text)]">Select a review item</div>
          <div className="max-w-sm text-sm leading-6 text-[var(--muted)]">
            The queue is now decision-first. Pick any task from the left to inspect context, capture a note, and close the review with confidence.
          </div>
        </CardContent>
      </Card>
    );
  }

  const isBusy = busyKey === item.key || busyKey.startsWith("bulk:");
  const canReject = item.bucket === "task" ? note.trim().length > 0 : false;
  const summary = detailSummary(item);
  const historyFacts = detailHistoryFacts(item).filter((fact) => fact.value && fact.value !== "-");
  const nextSteps = detailNextSteps(item);
  const restrictedReason = blockedReason(item);
  const approveNeedsNote =
    item.bucket === "task" ? requiresDecisionNote(item, "approve") && !note.trim() : false;
  const noteGuidance = item.bucket === "task" ? decisionNoteGuidance(item) : "";

  return (
    <Card className="border-[var(--border)] bg-[rgba(17,21,33,0.96)] shadow-2xl">
      <CardHeader className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]", typeClasses(item.kind))}>
                {item.typeLabel}
              </span>
              <span className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]", severityClasses(item.severity))}>
                {item.severity}
              </span>
              <span className={cn("text-xs font-semibold uppercase tracking-[0.18em]", ageClasses(item.ageBand))}>
                {item.ageLabel}
              </span>
            </div>
            <div>
              <CardTitle className="text-2xl">{item.title}</CardTitle>
              <div className="mt-2 text-sm text-[var(--muted)]">{item.headline}</div>
            </div>
          </div>
          {mobile && onClose ? (
            <Button variant="ghost" className="px-3 py-2 text-xs" onClick={onClose}>
              Close
            </Button>
          ) : null}
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Recommended action</div>
          <div className="mt-2 text-sm leading-6 text-[var(--text)]">{item.recommendation}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{summary.title}</div>
          <div className="mt-2 text-sm leading-6 text-[var(--text)]">{summary.summary}</div>
          <div className="mt-3 grid gap-2">
            {summary.checks.map((check) => (
              <div key={`${item.key}:${check}`} className="rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-3 py-3 text-sm text-[var(--text)]">
                {check}
              </div>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Why this item is here</div>
          <div className="mt-2 text-sm leading-6 text-[var(--text)]">{item.description}</div>
        </div>

        {historyFacts.length ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Latest activity and history</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {historyFacts.map((fact) => (
                <div key={`${item.key}:history:${fact.label}`} className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{fact.label}</div>
                  <div className="mt-1 text-sm text-[var(--text)]">{fact.value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {item.facts.map((fact) => (
            <div key={`${item.key}:${fact.label}`} className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{fact.label}</div>
              <div className="mt-1 text-sm text-[var(--text)]">{fact.value}</div>
            </div>
          ))}
        </div>

        {item.bucket === "task" ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4">
            <label className="text-sm font-semibold text-[var(--text)]">Review note</label>
            <Textarea
              rows={4}
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Capture why you approved, what you checked, or the reason for rejection."
            />
            <div className={cn("mt-2 text-xs", approveNeedsNote ? "text-amber-200" : "text-[var(--muted)]")}>
              {noteGuidance}
            </div>
          </div>
        ) : null}

        {restrictedReason ? (
          <div className="rounded-2xl border border-amber-400/30 bg-[rgba(245,158,11,0.08)] px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">Escalation needed</div>
            <div className="mt-2 text-sm leading-6 text-amber-100">{restrictedReason}</div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Next step links</div>
          <div className="mt-3 flex flex-wrap gap-3">
            {nextSteps.map((step) => (
              <Link key={`${item.key}:next:${step.href}:${step.label}`} href={step.href}>
                <Button variant="outline" className="px-4 py-2 text-xs">
                  {step.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {item.bucket === "task" ? (
            <>
              {item.canApprove ? (
                <Button className="px-4 py-2 text-xs" disabled={isBusy || approveNeedsNote} onClick={onApprove}>
                  {isBusy ? "Saving..." : "Approve"}
                </Button>
              ) : null}
              {item.canReject ? (
                <Button variant="ghost" className="px-4 py-2 text-xs" disabled={isBusy || !canReject} onClick={onReject}>
                  {isBusy ? "Saving..." : "Reject"}
                </Button>
              ) : null}
              {!item.canApprove && !item.canReject ? (
                <div className="rounded-full border border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">
                  Review visible, but final approval is restricted by role.
                </div>
              ) : null}
            </>
          ) : (
            <Button className="px-4 py-2 text-xs" disabled={isBusy} onClick={onSignalAction}>
              {isBusy ? "Saving..." : item.actionLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ApprovalsPage() {
  const { user, loading, activeFactory } = useSession();
  const [state, setState] = useState<InboxState>(() => emptyInboxState());
  const [busy, setBusy] = useState(false);
  const [actionKey, setActionKey] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [ageFilter, setAgeFilter] = useState<AgeFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(true);
  const [notesByKey, setNotesByKey] = useState<Record<string, string>>({});
  const [selectedTaskKeys, setSelectedTaskKeys] = useState<string[]>([]);
  const [bulkNote, setBulkNote] = useState("");
  const [bulkConfirmDecision, setBulkConfirmDecision] = useState<BulkDecision | null>(null);

  const canReview = reviewRoles(user?.role);
  const steelMode = activeFactory?.industry_type === "steel";
  const canApproveOcr = ["manager", "admin", "owner"].includes(user?.role || "");
  const canApproveReconciliation = ["admin", "owner"].includes(user?.role || "");
  const refreshedLabel = useMemo(() => formatDateTime(state.refreshedAt), [state.refreshedAt]);

  const loadInbox = useCallback(async () => {
    if (!user || !canReview) {
      return;
    }

    setBusy(true);
    try {
      const tasks: Array<Promise<unknown>> = [
        listAttendanceReview(undefined, 14),
        listEntries({ status: ["pending"], page: 1, page_size: 12 }),
        listOcrVerifications("pending"),
        listUnreadAlerts(),
      ];
      if (steelMode) {
        tasks.push(listSteelReconciliations({ status: "pending", limit: 12 }), getSteelOverview());
      }

      const results = await Promise.allSettled(tasks);
      const nextState = emptyInboxState();
      const failedSources: string[] = [];

      const attendanceResult = results[0];
      if (attendanceResult.status === "fulfilled") {
        const payload = attendanceResult.value as AttendanceReviewPayload;
        nextState.pendingAttendanceReviews = payload.items.slice(0, 12);
        nextState.pendingAttendanceReviewTotal = payload.totals.pending_records;
      } else {
        failedSources.push("attendance review");
      }

      const dprResult = results[1];
      if (dprResult.status === "fulfilled") {
        const payload = dprResult.value as { items: Entry[]; total: number };
        nextState.pendingEntries = payload.items;
        nextState.pendingEntryTotal = payload.total;
      } else {
        failedSources.push("DPR entries");
      }

      const verificationResult = results[2];
      if (verificationResult.status === "fulfilled") {
        const items = (verificationResult.value as OcrVerificationRecord[]).slice(0, 12);
        nextState.pendingVerifications = items;
        nextState.pendingVerificationTotal = (verificationResult.value as OcrVerificationRecord[]).length;
      } else {
        failedSources.push("OCR review");
      }

      const alertResult = results[3];
      if (alertResult.status === "fulfilled") {
        const alerts = (alertResult.value as AlertItem[]).slice(0, 8);
        nextState.unreadAlerts = alerts;
        nextState.unreadAlertTotal = (alertResult.value as AlertItem[]).length;
      } else {
        failedSources.push("alerts");
      }

      if (steelMode) {
        const reconciliationResult = results[4];
        const overviewResult = results[5];

        if (reconciliationResult?.status === "fulfilled") {
          const items = (reconciliationResult.value as { items: SteelReconciliation[] }).items;
          nextState.pendingReconciliations = items;
          nextState.pendingReconciliationTotal = items.length;
        } else {
          failedSources.push("stock review");
        }

        if (overviewResult?.status === "fulfilled") {
          const overview = overviewResult.value as SteelOverview;
          nextState.highRiskBatches = overview.ranked_anomalies.slice(0, 8).map((item) => item.batch);
          nextState.highRiskBatchTotal = overview.anomaly_summary.high_batches + overview.anomaly_summary.critical_batches;
        } else {
          failedSources.push("steel exceptions");
        }
      }

      nextState.refreshedAt = new Date().toISOString();
      setState(nextState);
      setError(
        failedSources.length
          ? `Some review sources did not refresh: ${failedSources.join(", ")}.`
          : "",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load review queue.");
    } finally {
      setBusy(false);
    }
  }, [canReview, steelMode, user]);

  const runInboxAction = useCallback(
    async (nextActionKey: string, work: () => Promise<void>, successMessage: string) => {
      setActionKey(nextActionKey);
      setStatus("");
      setError("");
      try {
        await work();
        setStatus(successMessage);
        await loadInbox();
        signalWorkflowRefresh("review-queue");
        signalRailCountsRefresh();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Review queue action failed.");
      } finally {
        setActionKey("");
      }
    },
    [loadInbox],
  );

  useEffect(() => {
    if (!user || !canReview) {
      return;
    }
    loadInbox().catch((err) => {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not load review queue.");
    });
  }, [canReview, loadInbox, user]);

  useEffect(() => {
    if (!user || !canReview) return;
    return subscribeToWorkflowRefresh(() => {
      void loadInbox();
    });
  }, [canReview, loadInbox, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(REVIEW_DETAIL_PANEL_STORAGE_KEY);
    if (saved === "hidden") {
      setShowDetailPanel(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(REVIEW_DETAIL_PANEL_STORAGE_KEY, showDetailPanel ? "shown" : "hidden");
  }, [showDetailPanel]);

  const taskItems = useMemo<ReviewTaskItem[]>(() => {
    const items: ReviewTaskItem[] = [
      ...state.pendingAttendanceReviews.map((item) => normalizeAttendance(item)),
      ...state.pendingEntries.map((entry) => normalizeEntry(entry)),
      ...state.pendingVerifications.map((record) => normalizeOcr(record, canApproveOcr)),
      ...state.pendingReconciliations.map((record) => normalizeReconciliation(record, canApproveReconciliation)),
    ];
    return items.sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) return right.priorityScore - left.priorityScore;
      return new Date(left.timestamp || 0).getTime() - new Date(right.timestamp || 0).getTime();
    });
  }, [
    canApproveOcr,
    canApproveReconciliation,
    state.pendingAttendanceReviews,
    state.pendingEntries,
    state.pendingReconciliations,
    state.pendingVerifications,
  ]);

  const signalItems = useMemo<ReviewSignalItem[]>(() => {
    const items: ReviewSignalItem[] = [
      ...state.unreadAlerts.map((alert) => normalizeAlert(alert)),
      ...state.highRiskBatches.map((batch) => normalizeBatch(batch)),
    ];
    return items.sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) return right.priorityScore - left.priorityScore;
      return new Date(left.timestamp || 0).getTime() - new Date(right.timestamp || 0).getTime();
    });
  }, [state.highRiskBatches, state.unreadAlerts]);

  const searchTerm = search.trim().toLowerCase();

  const filteredTasks = useMemo(() => {
    return taskItems.filter((item) => {
      if (taskFilter !== "all" && item.kind !== taskFilter) return false;
      if (severityFilter !== "all" && item.severity !== severityFilter) return false;
      if (ageFilter === "sla8" && item.ageBand === "fresh") return false;
      if (ageFilter !== "all" && ageFilter !== "sla8" && item.ageBand !== ageFilter) return false;
      if (!searchTerm) return true;
      return [item.title, item.headline, item.description, item.typeLabel]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm);
    });
  }, [ageFilter, searchTerm, severityFilter, taskFilter, taskItems]);

  const activePreset = useMemo<QueuePreset>(() => {
    if (searchTerm) return "custom";
    if (taskFilter === "all" && severityFilter === "all" && ageFilter === "all") return "all";
    if (taskFilter === "all" && severityFilter === "all" && ageFilter === "fresh") return "today";
    if (taskFilter === "all" && severityFilter === "all" && ageFilter === "sla8") return "sla8";
    if (taskFilter === "all" && severityFilter === "all" && ageFilter === "stale") return "stale";
    if (taskFilter === "reconciliation" && severityFilter === "all" && ageFilter === "all") return "stock";
    if (taskFilter === "ocr" && severityFilter === "all" && ageFilter === "all") return "ocr";
    return "custom";
  }, [ageFilter, searchTerm, severityFilter, taskFilter]);

  const applyPreset = useCallback((preset: QueuePreset) => {
    setSearch("");
    setSeverityFilter("all");
    switch (preset) {
      case "today":
        setTaskFilter("all");
        setAgeFilter("fresh");
        return;
      case "sla8":
        setTaskFilter("all");
        setAgeFilter("sla8");
        return;
      case "stale":
        setTaskFilter("all");
        setAgeFilter("stale");
        return;
      case "stock":
        setTaskFilter("reconciliation");
        setAgeFilter("all");
        return;
      case "ocr":
        setTaskFilter("ocr");
        setAgeFilter("all");
        return;
      default:
        setTaskFilter("all");
        setAgeFilter("all");
    }
  }, []);

  useEffect(() => {
    const available = new Set(taskItems.map((item) => item.key));
    setSelectedTaskKeys((current) => current.filter((key) => available.has(key)));
  }, [taskItems]);

  const filteredSignals = useMemo(() => {
    if (!searchTerm) return signalItems;
    return signalItems.filter((item) =>
      [item.title, item.headline, item.description, item.typeLabel]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm),
    );
  }, [searchTerm, signalItems]);

  const selectedTaskKeySet = useMemo(() => new Set(selectedTaskKeys), [selectedTaskKeys]);
  const selectedTaskItems = useMemo(
    () => taskItems.filter((item) => selectedTaskKeySet.has(item.key)),
    [selectedTaskKeySet, taskItems],
  );
  const visibleActionableTaskKeys = useMemo(
    () => filteredTasks.filter((item) => item.canApprove || item.canReject).map((item) => item.key),
    [filteredTasks],
  );
  const allVisibleActionableSelected =
    visibleActionableTaskKeys.length > 0 &&
    visibleActionableTaskKeys.every((key) => selectedTaskKeySet.has(key));
  const bulkConfirmEligibleItems = useMemo(
    () =>
      bulkConfirmDecision
        ? selectedTaskItems.filter((item) => canRunTaskDecision(item, bulkConfirmDecision))
        : [],
    [bulkConfirmDecision, selectedTaskItems],
  );
  const bulkConfirmRestrictedItems = useMemo(
    () =>
      bulkConfirmDecision
        ? selectedTaskItems.filter((item) => !canRunTaskDecision(item, bulkConfirmDecision))
        : [],
    [bulkConfirmDecision, selectedTaskItems],
  );
  const bulkApproveReasonMissing =
    bulkConfirmDecision === "approve" &&
    selectedTaskItems.some((item) => requiresDecisionNote(item, "approve")) &&
    !bulkNote.trim();
  const bulkRejectReasonMissing = bulkConfirmDecision === "reject" && !bulkNote.trim();

  useEffect(() => {
    if (bulkConfirmDecision && !selectedTaskItems.length) {
      setBulkConfirmDecision(null);
    }
  }, [bulkConfirmDecision, selectedTaskItems.length]);

  const visibleItems = useMemo(
    () => [...filteredTasks, ...filteredSignals],
    [filteredSignals, filteredTasks],
  );

  useEffect(() => {
    if (!visibleItems.length) {
      setSelectedKey("");
      return;
    }
    const stillVisible = visibleItems.some((item) => item.key === selectedKey);
    if (!selectedKey || !stillVisible) {
      setSelectedKey(visibleItems[0].key);
    }
  }, [selectedKey, visibleItems]);

  const selectedItem = useMemo(
    () => visibleItems.find((item) => item.key === selectedKey) ?? null,
    [selectedKey, visibleItems],
  );
  const selectedNote = selectedKey ? notesByKey[selectedKey] || "" : "";

  const updateSelectedNote = useCallback(
    (value: string) => {
      if (!selectedKey) return;
      setNotesByKey((current) => ({ ...current, [selectedKey]: value }));
    },
    [selectedKey],
  );

  const openItem = useCallback((key: string, mobile = false) => {
    setSelectedKey(key);
    if (mobile || !showDetailPanel) {
      setMobileDetailOpen(true);
    }
  }, [showDetailPanel]);

  const toggleDetailPanel = useCallback(() => {
    setShowDetailPanel((current) => {
      const next = !current;
      if (next) {
        setMobileDetailOpen(false);
      }
      return next;
    });
  }, []);

  const toggleTaskSelection = useCallback((key: string) => {
    setSelectedTaskKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }, []);

  const toggleVisibleActionableSelection = useCallback(() => {
    setSelectedTaskKeys((current) => {
      if (!visibleActionableTaskKeys.length) return current;
      if (visibleActionableTaskKeys.every((key) => current.includes(key))) {
        return current.filter((key) => !visibleActionableTaskKeys.includes(key));
      }
      const merged = new Set(current);
      visibleActionableTaskKeys.forEach((key) => merged.add(key));
      return Array.from(merged);
    });
  }, [visibleActionableTaskKeys]);

  const runTaskDecision = useCallback(
    async (item: ReviewTaskItem, decision: "approve" | "reject", noteValue: string) => {
      const note = noteValue.trim();
      if (decision === "approve" && requiresDecisionNote(item, "approve") && !note) {
        throw new Error("High-risk approval requires a review note.");
      }
      if (decision === "approve") {
        switch (item.kind) {
          case "attendance":
            await approveAttendanceReview(item.source.attendance_id, {
              regularization_id: item.source.regularization?.id || null,
              final_status: deriveAttendanceFinalStatus(item.source),
              note: note || null,
            });
            return;
          case "entry":
            await approveEntry(item.source.id);
            return;
          case "ocr":
            if (!item.canApprove) throw new Error("Selected OCR item requires manager or higher approval.");
            await approveOcrVerification(item.source.id, note);
            return;
          case "reconciliation":
            if (!item.canApprove) throw new Error("Selected stock item requires admin or owner approval.");
            await approveSteelReconciliation(item.source.id, {
              approver_notes: note || null,
            });
            return;
        }
      }

      if (!note) {
        throw new Error("Rejection note is required.");
      }

      switch (item.kind) {
        case "attendance":
          await rejectAttendanceReview(item.source.attendance_id, {
            regularization_id: item.source.regularization?.id || null,
            note,
          });
          return;
        case "entry":
          await rejectEntry(item.source.id, note);
          return;
        case "ocr":
          if (!item.canReject) throw new Error("Selected OCR item requires manager or higher rejection.");
          await rejectOcrVerification(item.source.id, note, note);
          return;
        case "reconciliation":
          if (!item.canReject) throw new Error("Selected stock item requires admin or owner rejection.");
          await rejectSteelReconciliation(item.source.id, {
            rejection_reason: note,
            approver_notes: note,
          });
          return;
      }
    },
    [],
  );

  const handleApproveSelected = useCallback(() => {
    if (!selectedItem || selectedItem.bucket !== "task") return;
    if (requiresDecisionNote(selectedItem, "approve") && !selectedNote.trim()) {
      setError("Add a review note before approving a high-risk item.");
      return;
    }
    void runInboxAction(
      selectedItem.key,
      async () => {
        await runTaskDecision(selectedItem, "approve", selectedNote);
      },
      `${selectedItem.typeLabel} approved.`,
    );
  }, [runInboxAction, runTaskDecision, selectedItem, selectedNote]);

  const handleRejectSelected = useCallback(() => {
    if (!selectedItem || selectedItem.bucket !== "task" || !selectedNote.trim()) return;
    void runInboxAction(
      selectedItem.key,
      async () => {
        await runTaskDecision(selectedItem, "reject", selectedNote);
      },
      `${selectedItem.typeLabel} rejected.`,
    );
  }, [runInboxAction, runTaskDecision, selectedItem, selectedNote]);

  const openBulkDecisionConfirm = useCallback(
    (decision: BulkDecision) => {
      if (!selectedTaskItems.length) {
        setError("Select at least one task before bulk action.");
        return;
      }
      setError("");
      setBulkConfirmDecision(decision);
    },
    [selectedTaskItems.length],
  );

  const closeBulkDecisionConfirm = useCallback(() => {
    if (actionKey.startsWith("bulk:")) return;
    setBulkConfirmDecision(null);
  }, [actionKey]);

  const confirmBulkDecision = useCallback(() => {
    if (!bulkConfirmDecision) return;
    const decision = bulkConfirmDecision;
    const candidates = selectedTaskItems.filter((item) => canRunTaskDecision(item, decision));
    if (!candidates.length) {
      setError("No selected tasks are eligible for that bulk action.");
      setBulkConfirmDecision(null);
      return;
    }
    if (decision === "approve" && candidates.some((item) => requiresDecisionNote(item, "approve")) && !bulkNote.trim()) {
      setError("Bulk approval includes high-risk items, so add one decision note first.");
      return;
    }
    if (decision === "reject" && !bulkNote.trim()) {
      setError("Bulk rejection requires a reason note.");
      return;
    }

    const actionId = `bulk:${decision}`;
    setActionKey(actionId);
    setStatus("");
    setError("");
    void (async () => {
      try {
        const outcomes = await Promise.allSettled(
          candidates.map((item) => runTaskDecision(item, decision, bulkNote)),
        );
        const successCount = outcomes.filter((outcome) => outcome.status === "fulfilled").length;
        const failedIndexes = outcomes
          .map((outcome, index) => (outcome.status === "rejected" ? index : -1))
          .filter((index) => index >= 0);
        const failedCount = failedIndexes.length;

        if (failedCount) {
          const labels = failedIndexes.map((index) => candidates[index].title).slice(0, 3);
          setError(
            `${failedCount} selected item(s) failed. ${labels.length ? `Check: ${labels.join(", ")}${failedCount > 3 ? "..." : ""}` : ""}`,
          );
        }

        setStatus(
          decision === "approve"
            ? `${successCount}/${candidates.length} selected task(s) approved.`
            : `${successCount}/${candidates.length} selected task(s) rejected.`,
        );
        setSelectedTaskKeys([]);
        if (decision === "reject") {
          setBulkNote("");
        }
        setBulkConfirmDecision(null);
        await loadInbox();
        signalWorkflowRefresh("review-queue");
        signalRailCountsRefresh();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Bulk action failed.");
      } finally {
        setActionKey("");
      }
    })();
  }, [bulkConfirmDecision, bulkNote, loadInbox, runTaskDecision, selectedTaskItems]);

  const handleSignalAction = useCallback(() => {
    if (!selectedItem || selectedItem.bucket !== "signal") return;
    switch (selectedItem.kind) {
      case "alert":
        void runInboxAction(
          selectedItem.key,
          async () => {
            await markAlertRead(selectedItem.source.id);
          },
          "Alert marked as read.",
        );
        return;
      case "batch":
        return;
    }
  }, [runInboxAction, selectedItem]);

  const urgentTaskCount = filteredTasks.filter((item) => item.severity === "critical" || item.severity === "high").length;
  const staleTaskCount = filteredTasks.filter((item) => item.ageBand === "stale").length;
  const signalCount = filteredSignals.length;
  const restrictedTaskCount = filteredTasks.filter((item) => !item.canApprove && !item.canReject).length;
  const attendanceTaskCount = filteredTasks.filter((item) => item.kind === "attendance").length;
  const dprTaskCount = filteredTasks.filter((item) => item.kind === "entry").length;
  const ocrTaskCount = filteredTasks.filter((item) => item.kind === "ocr").length;
  const stockTaskCount = filteredTasks.filter((item) => item.kind === "reconciliation").length;
  const selectedTaskCount = selectedTaskItems.length;
  const selectedApproveCount = selectedTaskItems.filter((item) => item.canApprove).length;
  const selectedRejectCount = selectedTaskItems.filter((item) => item.canReject).length;
  const selectedNoDecisionCount = selectedTaskItems.filter((item) => !item.canApprove && !item.canReject).length;
  const bulkApproveBusy = actionKey === "bulk:approve";
  const bulkRejectBusy = actionKey === "bulk:reject";
  const bulkBusy = bulkApproveBusy || bulkRejectBusy;
  const sla8TaskCount = taskItems.filter((item) => item.ageBand !== "fresh").length;
  const sla8UrgentCount = taskItems.filter(
    (item) => item.ageBand !== "fresh" && (item.severity === "critical" || item.severity === "high"),
  ).length;
  const sla8AttendanceCount = taskItems.filter((item) => item.ageBand !== "fresh" && item.kind === "attendance").length;
  const sla8DprCount = taskItems.filter((item) => item.ageBand !== "fresh" && item.kind === "entry").length;
  const sla8OcrCount = taskItems.filter((item) => item.ageBand !== "fresh" && item.kind === "ocr").length;
  const sla8StockCount = taskItems.filter((item) => item.ageBand !== "fresh" && item.kind === "reconciliation").length;
  const sla24TaskCount = taskItems.filter((item) => item.ageBand === "stale").length;
  const sla24UrgentCount = taskItems.filter(
    (item) => item.ageBand === "stale" && (item.severity === "critical" || item.severity === "high"),
  ).length;
  const sla24AttendanceCount = taskItems.filter((item) => item.ageBand === "stale" && item.kind === "attendance").length;
  const sla24DprCount = taskItems.filter((item) => item.ageBand === "stale" && item.kind === "entry").length;
  const sla24OcrCount = taskItems.filter((item) => item.ageBand === "stale" && item.kind === "ocr").length;
  const sla24StockCount = taskItems.filter((item) => item.ageBand === "stale" && item.kind === "reconciliation").length;

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-36 rounded-[2rem]" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
            <Skeleton className="h-[36rem] rounded-2xl" />
            <Skeleton className="h-[36rem] rounded-2xl" />
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <div className="text-sm uppercase tracking-[0.26em] text-[var(--accent)]">Review Queue</div>
              <CardTitle>You need an active session first</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link href="/login">
                <Button>Open Login</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!canReview) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
            <CardHeader>
              <div className="text-sm uppercase tracking-[0.26em] text-[var(--accent)]">Review Queue</div>
              <CardTitle>Review work is assigned to supervisors and above</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-[var(--muted)]">
              <p>
                Your current role is <span className="font-semibold text-[var(--text)]">{user.role}</span>. We kept this queue focused on review decisions so daily operators do not land in approval-heavy screens by mistake.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard">
                  <Button>Open Operations Board</Button>
                </Link>
                <Link href="/work-queue">
                  <Button variant="outline">Open Work Queue</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 pb-24 md:px-8 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-[1.9rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-5 shadow-2xl backdrop-blur sm:p-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="text-sm uppercase tracking-[0.32em] text-[var(--accent)]">Review</div>
            <h1 className="text-3xl font-semibold sm:text-4xl">Review Queue</h1>
            <p className="max-w-3xl text-sm text-[var(--muted)]">
              One prioritized inbox for attendance, DPR, OCR, and stock review decisions. Tasks stay at the top, signals stay separate, and the right side keeps full context on screen.
            </p>
          </div>
          <div className="grid gap-3 text-sm text-[var(--muted)] md:text-right">
            <span>
              Active factory: <span className="font-semibold text-[var(--text)]">{activeFactory?.name || user.factory_name}</span>
            </span>
            <span>
              Last refresh: <span className="font-semibold text-[var(--text)]">{refreshedLabel}</span>
            </span>
            <Button variant="outline" className="w-full md:w-auto" onClick={() => void loadInbox()}>
              {busy ? "Refreshing..." : "Refresh Queue"}
            </Button>
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{error}</div> : null}
        {status ? <div className="rounded-2xl border border-emerald-400/30 bg-[rgba(34,197,94,0.12)] px-4 py-3 text-sm text-emerald-100">{status}</div> : null}

        <section
          className={cn(
            "grid gap-5",
            showDetailPanel ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.95fr)]" : "lg:grid-cols-1",
          )}
        >
          <div className="space-y-6">
            <Card className="border-[var(--border)] bg-[rgba(18,22,34,0.92)]">
              <CardHeader>
                <div className="text-sm text-[var(--muted)]">Queue controls</div>
                <CardTitle className="text-xl">Prioritize what needs a decision now</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Quick presets</div>
                      <div className="mt-1 text-sm text-[var(--text)]">
                        Active preset: <span className="font-semibold">{presetLabel(activePreset)}</span>
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        Jump between fresh work, SLA backlog, and source-specific lanes without rebuilding filters by hand.
                      </div>
                    </div>
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
                      {(["all", "today", "sla8", "stale", "stock", "ocr"] as QueuePreset[]).map((preset) => (
                        <Button
                          key={`preset:${preset}`}
                          variant={activePreset === preset ? "primary" : "outline"}
                          className="shrink-0 px-3 py-2 text-xs"
                          onClick={() => applyPreset(preset)}
                        >
                          {presetLabel(preset)}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="text-sm text-[var(--muted)]">Task type</label>
                    <Select value={taskFilter} onChange={(event) => setTaskFilter(event.target.value as TaskFilter)}>
                      <option value="all">All review work</option>
                      <option value="attendance">Attendance review</option>
                      <option value="entry">DPR entries</option>
                      <option value="ocr">OCR review</option>
                      <option value="reconciliation">Stock review</option>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Severity</label>
                    <Select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)}>
                      <option value="all">All severities</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="warning">Warning</option>
                      <option value="info">Info</option>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Queue age</label>
                    <Select value={ageFilter} onChange={(event) => setAgeFilter(event.target.value as AgeFilter)}>
                      <option value="all">All ages</option>
                      <option value="sla8">8h+ waiting (SLA)</option>
                      <option value="stale">24h+ waiting</option>
                      <option value="aging">8h to 24h waiting</option>
                      <option value="fresh">Fresh</option>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Search</label>
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search review work or signals" />
                  </div>
                </div>

                {selectedTaskCount ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Bulk decisions</div>
                        <div className="mt-1 text-sm text-[var(--text)]">
                          Selected: {selectedTaskCount} | Approve-ready: {selectedApproveCount} | Reject-ready: {selectedRejectCount}
                        </div>
                        {selectedNoDecisionCount > 0 ? (
                          <div className="mt-1 text-xs text-amber-200">
                            {selectedNoDecisionCount} selected item(s) are role-restricted and cannot be actioned.
                          </div>
                        ) : null}
                      </div>
                      <div className="grid gap-2 sm:flex sm:flex-wrap">
                        <Button
                          variant="outline"
                          className="px-3 py-2 text-xs"
                          onClick={toggleVisibleActionableSelection}
                          disabled={!visibleActionableTaskKeys.length}
                        >
                          {allVisibleActionableSelected ? "Unselect visible" : "Select visible actionable"}
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-3 py-2 text-xs"
                          onClick={() => setSelectedTaskKeys([])}
                          disabled={!selectedTaskCount}
                        >
                          Clear selection
                        </Button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                      <Textarea
                        rows={2}
                        value={bulkNote}
                        onChange={(event) => setBulkNote(event.target.value)}
                        placeholder="Shared decision note. Required for bulk reject and for high-risk approvals."
                      />
                      <Button
                        className="px-4 py-2 text-xs"
                        disabled={bulkBusy || !selectedApproveCount}
                        onClick={() => openBulkDecisionConfirm("approve")}
                      >
                        {bulkApproveBusy ? "Approving..." : "Approve selected"}
                      </Button>
                      <Button
                        variant="ghost"
                        className="px-4 py-2 text-xs"
                        disabled={bulkBusy || !selectedRejectCount}
                        onClick={() => openBulkDecisionConfirm("reject")}
                      >
                        {bulkRejectBusy ? "Rejecting..." : "Reject selected"}
                      </Button>
                    </div>
                    <div className={cn("text-xs", bulkApproveReasonMissing || bulkRejectReasonMissing ? "text-amber-200" : "text-[var(--muted)]")}>
                      {bulkRejectReasonMissing
                        ? "Bulk rejection is blocked until a reason note is added."
                        : bulkApproveReasonMissing
                          ? "High-risk approvals are selected, so add one shared review note before confirming."
                          : "Use one shared note when the same decision context applies across multiple selected items."}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4 text-sm text-[var(--muted)]">
                    Select one or more actionable tasks to unlock bulk decisions. The queue stays lighter until you actually need bulk actions.
                  </div>
                )}
              </CardContent>
            </Card>

            {!showDetailPanel ? (
              <div className="hidden rounded-2xl border border-[rgba(77,163,255,0.18)] bg-[rgba(77,163,255,0.08)] px-4 py-4 lg:block">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(77,163,255,0.92)]">
                      Detail panel hidden
                    </div>
                    <div className="text-sm text-text-secondary">
                      {selectedItem
                        ? `Selected item: ${selectedItem.title}. Use preview when you want the full context.`
                        : "The task list is using full width. Pick any item to preview it in an overlay or show the side panel again."}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem ? (
                      <Button variant="outline" className="px-3 py-2 text-xs" onClick={() => setMobileDetailOpen(true)}>
                        Preview selected
                      </Button>
                    ) : null}
                    <Button className="px-3 py-2 text-xs" onClick={toggleDetailPanel}>
                      Show detail panel
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            <Card className="border-[var(--border)] bg-[rgba(18,22,34,0.92)]">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm text-[var(--muted)]">Decision queue</div>
                  <CardTitle className="text-xl">Tasks waiting for review</CardTitle>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    Mix: Attendance {attendanceTaskCount} | DPR {dprTaskCount} | OCR {ocrTaskCount} | Stock {stockTaskCount}
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:items-end">
                  <div className="text-sm text-[var(--muted)] sm:text-right">
                    {restrictedTaskCount ? `${restrictedTaskCount} item(s) require escalation by role.` : "Highest risk and oldest items stay at the top."}
                  </div>
                  <Button variant="outline" className="hidden px-3 py-2 text-xs lg:inline-flex" onClick={toggleDetailPanel}>
                    {showDetailPanel ? "Hide detail panel" : "Show detail panel"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {filteredTasks.length ? (
                  <>
                    <div className="hidden lg:block">
                      <div className="overflow-x-auto">
                        <table className="min-w-full border-separate border-spacing-0">
                          <thead>
                            <tr className="text-left text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                              <th className="px-6 py-3">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-[var(--border)] bg-transparent"
                                  checked={allVisibleActionableSelected}
                                  disabled={!visibleActionableTaskKeys.length}
                                  onChange={toggleVisibleActionableSelection}
                                  aria-label="Select visible actionable tasks"
                                />
                              </th>
                              <th className="px-6 py-3">Priority</th>
                              <th className="px-4 py-3">Task</th>
                              <th className="px-4 py-3">Context</th>
                              <th className="px-4 py-3">Age</th>
                              <th className="px-6 py-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTasks.map((item) => {
                              const isActive = item.key === selectedKey;
                              const isSelected = selectedTaskKeySet.has(item.key);
                              const canBulkSelect = item.canApprove || item.canReject;
                              return (
                                <tr
                                  key={item.key}
                                  className={cn(
                                    "cursor-pointer border-t border-[var(--border)]/60 text-sm transition hover:bg-[rgba(255,255,255,0.02)]",
                                    isActive ? "bg-[rgba(34,211,238,0.08)]" : "bg-transparent",
                                  )}
                                  onClick={() => openItem(item.key)}
                                >
                                  <td className="px-6 py-4 align-top">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 rounded border-[var(--border)] bg-transparent"
                                      checked={isSelected}
                                      disabled={!canBulkSelect}
                                      onChange={() => toggleTaskSelection(item.key)}
                                      onClick={(event) => event.stopPropagation()}
                                      aria-label={`Select ${item.title}`}
                                    />
                                  </td>
                                  <td className="px-6 py-4 align-top">
                                    <div className="flex flex-col gap-2">
                                      <span className={cn("inline-flex w-fit rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", severityClasses(item.severity))}>{item.severity}</span>
                                      <span className={cn("inline-flex w-fit rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", typeClasses(item.kind))}>{item.typeLabel}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 align-top">
                                    <div className="font-semibold text-[var(--text)]">{item.title}</div>
                                    <div className="mt-1 text-xs text-[var(--muted)]">{item.headline}</div>
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                      <span className="rounded-full border border-[var(--border)] px-3 py-1 text-[var(--muted)]">
                                        {latestActivityLabel(item)}
                                      </span>
                                      {!item.canApprove && !item.canReject ? (
                                        <span className="rounded-full border border-amber-400/30 bg-[rgba(245,158,11,0.12)] px-3 py-1 text-amber-100">
                                          Escalation needed
                                        </span>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 align-top">
                                    <div className="max-w-[21rem] text-sm leading-6 text-[var(--text)]">{item.description}</div>
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                                      <span>{item.statusLabel}</span>
                                      <span>{item.canApprove || item.canReject ? "Decision ready" : "Needs higher role"}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 align-top">
                                    <div className={cn("text-sm font-semibold", ageClasses(item.ageBand))}>{item.ageLabel}</div>
                                    <div className="mt-1 text-xs text-[var(--muted)]">{formatDateTime(item.timestamp)}</div>
                                  </td>
                                  <td className="px-6 py-4 text-right align-top">
                                    <Button
                                      className="px-4 py-2 text-xs"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openItem(item.key);
                                      }}
                                    >
                                      Review
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-4 lg:hidden">
                      {filteredTasks.map((item) => (
                        <Card key={item.key} className="border-[var(--border)] bg-[rgba(18,22,34,0.92)]">
                          <CardContent className="space-y-4 px-5 py-5">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={cn("inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", typeClasses(item.kind))}>{item.typeLabel}</span>
                                  <span className={cn("inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", severityClasses(item.severity))}>{item.severity}</span>
                                </div>
                                <div className="mt-3 text-lg font-semibold text-[var(--text)]">{item.title}</div>
                                <div className="mt-1 text-sm text-[var(--muted)]">{item.headline}</div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-[var(--border)] bg-transparent"
                                  checked={selectedTaskKeySet.has(item.key)}
                                  disabled={!item.canApprove && !item.canReject}
                                  onChange={() => toggleTaskSelection(item.key)}
                                  aria-label={`Select ${item.title}`}
                                />
                                <div className={cn("text-xs font-semibold uppercase tracking-[0.14em]", ageClasses(item.ageBand))}>{item.ageLabel}</div>
                              </div>
                            </div>
                            <div className="text-sm leading-6 text-[var(--text)]">{item.description}</div>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full border border-[var(--border)] px-3 py-1 text-[var(--muted)]">
                                {latestActivityLabel(item)}
                              </span>
                              {!item.canApprove && !item.canReject ? (
                                <span className="rounded-full border border-amber-400/30 bg-[rgba(245,158,11,0.12)] px-3 py-1 text-amber-100">
                                  Escalation needed
                                </span>
                              ) : null}
                            </div>
                            <div className="grid gap-3 sm:flex sm:flex-wrap">
                              <Button className="w-full px-4 py-2 text-xs sm:w-auto" onClick={() => openItem(item.key, true)}>
                                Review
                              </Button>
                              <Link href={item.openHref} className="w-full sm:w-auto">
                                <Button variant="outline" className="w-full px-4 py-2 text-xs sm:w-auto">
                                  {item.openLabel}
                                </Button>
                              </Link>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="px-6 pb-6">
                    <EmptyState
                      title={searchTerm || taskFilter !== "all" || severityFilter !== "all" || ageFilter !== "all" ? "No tasks match these filters" : "No review tasks are waiting"}
                      body={
                        searchTerm || taskFilter !== "all" || severityFilter !== "all" || ageFilter !== "all"
                          ? "Try changing the type, severity, age, or search filters to find another review item."
                          : "The decision queue is clear right now. Attendance review, OCR review, and stock review work will appear here as soon as they need someone."
                      }
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-[var(--border)] bg-[rgba(18,22,34,0.92)]">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm text-[var(--muted)]">Signals</div>
                  <CardTitle className="text-xl">Investigations and acknowledgements</CardTitle>
                </div>
                <div className="text-sm text-[var(--muted)] sm:max-w-sm sm:text-right">Signals stay separate from approval work so the queue remains trustworthy.</div>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredSignals.length ? (
                  filteredSignals.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={cn(
                        "w-full rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-left transition hover:border-[var(--accent)]/30 hover:bg-[rgba(255,255,255,0.03)]",
                        selectedKey === item.key ? "border-[var(--accent)]/50 bg-[rgba(34,211,238,0.08)]" : "",
                      )}
                      onClick={() => openItem(item.key, typeof window !== "undefined" && window.innerWidth < 1024)}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", typeClasses(item.kind))}>{item.typeLabel}</span>
                            <span className={cn("rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]", severityClasses(item.severity))}>{item.severity}</span>
                          </div>
                          <div className="text-sm font-semibold text-[var(--text)]">{item.title}</div>
                          <div className="text-xs text-[var(--muted)]">{item.headline}</div>
                          <div className="text-xs text-[var(--muted)]">{latestActivityLabel(item)}</div>
                        </div>
                        <div className={cn("text-xs font-semibold uppercase tracking-[0.14em]", ageClasses(item.ageBand))}>{item.ageLabel}</div>
                      </div>
                    </button>
                  ))
                ) : (
                  <EmptyState title="No active signals" body="Unread alerts and steel anomaly signals will appear here when someone needs to route or acknowledge them." />
                )}
              </CardContent>
            </Card>
          </div>

          {showDetailPanel ? (
            <div className="hidden lg:block">
              <div className="sticky top-24 space-y-3">
                <div className="flex justify-end">
                  <Button variant="ghost" className="px-3 py-2 text-xs" onClick={toggleDetailPanel}>
                    Hide detail panel
                  </Button>
                </div>
                <QueueDetailPanel
                  item={selectedItem}
                  note={selectedNote}
                  onNoteChange={updateSelectedNote}
                  onApprove={handleApproveSelected}
                  onReject={handleRejectSelected}
                  onSignalAction={handleSignalAction}
                  busyKey={actionKey}
                />
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric label="Urgent reviews" value={urgentTaskCount} helper="Critical first" tone="border-red-400/30 bg-[rgba(239,68,68,0.12)] text-red-100" />
          <SummaryMetric label="Open review tasks" value={filteredTasks.length} helper="Decision queue" tone="border-sky-400/30 bg-[rgba(56,189,248,0.12)] text-sky-100" />
          <SummaryMetric label="24h breaches" value={staleTaskCount} helper="Oldest first" tone="border-amber-400/30 bg-[rgba(245,158,11,0.12)] text-amber-100" />
          <SummaryMetric label="Signals" value={signalCount} helper="Needs routing" tone="border-fuchsia-400/30 bg-[rgba(217,70,239,0.12)] text-fuchsia-100" />
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Card className="border-[var(--border)] bg-[rgba(18,22,34,0.92)]">
            <CardHeader className="space-y-2">
              <div className="text-sm text-[var(--muted)]">Backlog mix</div>
              <CardTitle className="text-xl">By type and urgency</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {([
                {
                  label: "Attendance",
                  total: taskItems.filter((item) => item.kind === "attendance").length,
                  urgent: taskItems.filter((item) => item.kind === "attendance" && (item.severity === "critical" || item.severity === "high")).length,
                  aging: taskItems.filter((item) => item.kind === "attendance" && item.ageBand !== "fresh").length,
                },
                {
                  label: "DPR",
                  total: taskItems.filter((item) => item.kind === "entry").length,
                  urgent: taskItems.filter((item) => item.kind === "entry" && (item.severity === "critical" || item.severity === "high")).length,
                  aging: taskItems.filter((item) => item.kind === "entry" && item.ageBand !== "fresh").length,
                },
                {
                  label: "OCR",
                  total: taskItems.filter((item) => item.kind === "ocr").length,
                  urgent: taskItems.filter((item) => item.kind === "ocr" && (item.severity === "critical" || item.severity === "high")).length,
                  aging: taskItems.filter((item) => item.kind === "ocr" && item.ageBand !== "fresh").length,
                },
                {
                  label: "Stock",
                  total: taskItems.filter((item) => item.kind === "reconciliation").length,
                  urgent: taskItems.filter((item) => item.kind === "reconciliation" && (item.severity === "critical" || item.severity === "high")).length,
                  aging: taskItems.filter((item) => item.kind === "reconciliation" && item.ageBand !== "fresh").length,
                },
              ] as Array<{ label: string; total: number; urgent: number; aging: number }>).map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{metric.label}</div>
                  <div className="mt-2 text-2xl font-semibold text-[var(--text)]">{metric.total}</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-3 py-1 text-red-100">
                      Urgent {metric.urgent}
                    </span>
                    <span className="rounded-full border border-amber-400/30 bg-[rgba(245,158,11,0.12)] px-3 py-1 text-amber-100">
                      8h+ {metric.aging}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-[var(--border)] bg-[rgba(18,22,34,0.92)]">
            <CardHeader className="space-y-2">
              <div className="text-sm text-[var(--muted)]">Queue SLA board</div>
              <CardTitle className="text-xl">8h / 24h breach lanes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="rounded-2xl border border-amber-400/30 bg-[rgba(245,158,11,0.08)] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">8h+ waiting</div>
                    <div className="mt-1 text-3xl font-semibold text-[var(--text)]">{sla8TaskCount}</div>
                  </div>
                  <div className="rounded-full border border-amber-400/30 bg-[rgba(245,158,11,0.14)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">
                    Urgent: {sla8UrgentCount}
                  </div>
                </div>
                <div className="mt-3 text-xs text-[var(--muted)]">
                  Mix A:{sla8AttendanceCount} | D:{sla8DprCount} | O:{sla8OcrCount} | S:{sla8StockCount}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button className="px-3 py-2 text-xs" onClick={() => applyPreset("sla8")}>
                    Focus 8h+ queue
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.1)] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-red-200">24h+ breached</div>
                    <div className="mt-1 text-3xl font-semibold text-[var(--text)]">{sla24TaskCount}</div>
                  </div>
                  <div className="rounded-full border border-red-400/30 bg-[rgba(239,68,68,0.16)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-red-100">
                    Urgent: {sla24UrgentCount}
                  </div>
                </div>
                <div className="mt-3 text-xs text-[var(--muted)]">
                  Mix A:{sla24AttendanceCount} | D:{sla24DprCount} | O:{sla24OcrCount} | S:{sla24StockCount}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button className="px-3 py-2 text-xs" onClick={() => applyPreset("stale")}>
                    Focus 24h+ queue
                  </Button>
                  <Button variant="outline" className="px-3 py-2 text-xs" onClick={() => applyPreset("all")}>
                    Clear SLA filter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      {bulkConfirmDecision ? (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-[rgba(5,10,18,0.84)] px-4 py-4">
          <Card className="w-full max-w-2xl border-[var(--border)] bg-[rgba(17,21,33,0.98)] shadow-2xl">
            <CardHeader className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Confirm bulk decision</div>
              <CardTitle className="text-2xl">
                {bulkConfirmDecision === "approve" ? "Approve selected tasks?" : "Reject selected tasks?"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card-strong)] px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Selected</div>
                  <div className="mt-1 text-xl font-semibold">{selectedTaskItems.length}</div>
                </div>
                <div className="rounded-xl border border-emerald-400/30 bg-[rgba(34,197,94,0.12)] px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-100">Will process</div>
                  <div className="mt-1 text-xl font-semibold text-emerald-100">{bulkConfirmEligibleItems.length}</div>
                </div>
                <div className="rounded-xl border border-amber-400/30 bg-[rgba(245,158,11,0.12)] px-3 py-3">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-amber-100">Restricted</div>
                  <div className="mt-1 text-xl font-semibold text-amber-100">{bulkConfirmRestrictedItems.length}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4">
                <div className="text-sm text-[var(--muted)]">
                  {bulkConfirmDecision === "approve"
                    ? "Eligible items will be approved, restricted items will remain untouched."
                    : "Rejection note is required and will be written to each eligible selected item."}
                </div>
                {bulkConfirmDecision === "approve" ? (
                  <div className={cn("mt-2 text-xs", bulkApproveReasonMissing ? "text-amber-200" : "text-emerald-200")}>
                    {bulkApproveReasonMissing
                      ? "High-risk approval note missing. Add one shared review note before confirming."
                      : "Approval note coverage is ready."}
                  </div>
                ) : (
                  <div className={cn("mt-2 text-xs", bulkRejectReasonMissing ? "text-red-200" : "text-emerald-200")}>
                    {bulkRejectReasonMissing ? "Reason note missing. Add it before confirming." : "Reason note ready."}
                  </div>
                )}
              </div>

              {bulkConfirmRestrictedItems.length ? (
                <div className="rounded-2xl border border-amber-400/30 bg-[rgba(245,158,11,0.1)] px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">
                    Restricted items (not processed)
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-amber-100">
                    {bulkConfirmRestrictedItems.slice(0, 5).map((item) => (
                      <div key={`restricted:${item.key}`}>
                        {item.typeLabel}: {item.title}
                      </div>
                    ))}
                    {bulkConfirmRestrictedItems.length > 5 ? (
                      <div>+{bulkConfirmRestrictedItems.length - 5} more</div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" className="px-4 py-2 text-xs" onClick={closeBulkDecisionConfirm} disabled={bulkBusy}>
                  Cancel
                </Button>
                <Button
                  className="px-4 py-2 text-xs"
                  onClick={confirmBulkDecision}
                  disabled={bulkBusy || !bulkConfirmEligibleItems.length || bulkApproveReasonMissing || bulkRejectReasonMissing}
                >
                  {bulkConfirmDecision === "approve"
                    ? bulkApproveBusy
                      ? "Approving..."
                      : "Confirm approve"
                    : bulkRejectBusy
                      ? "Rejecting..."
                      : "Confirm reject"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {mobileDetailOpen ? (
        <div
          className={cn(
            "fixed inset-0 z-50 overflow-y-auto bg-[rgba(4,8,16,0.96)] px-4 py-4",
            showDetailPanel ? "lg:hidden" : "",
          )}
        >
          <QueueDetailPanel
            item={selectedItem}
            note={selectedNote}
            onNoteChange={updateSelectedNote}
            onApprove={handleApproveSelected}
            onReject={handleRejectSelected}
            onSignalAction={handleSignalAction}
            busyKey={actionKey}
            mobile
            onClose={() => setMobileDetailOpen(false)}
          />
        </div>
      ) : null}
    </main>
  );
}
