"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";
import {
  approveAttendanceReview,
  listAttendanceReview,
  rejectAttendanceReview,
  type AttendanceReviewFinalStatus,
  type AttendanceReviewItem,
  type AttendanceReviewPayload,
} from "@/lib/attendance";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/use-session";
import { signalWorkflowRefresh, subscribeToWorkflowRefresh } from "@/lib/workflow-sync";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type DecisionForm = {
  punchInAt: string;
  punchOutAt: string;
  finalStatus: AttendanceReviewFinalStatus;
  note: string;
};

type ReviewIssueType =
  | "missed_punch"
  | "late_entry"
  | "early_exit"
  | "absent"
  | "overtime"
  | "timing_correction"
  | "status_correction"
  | "shift_correction";

type ReviewSeverity = "critical" | "warning" | "info";
type ReviewTab = "details" | "fix" | "history";

type DerivedReviewItem = {
  item: AttendanceReviewItem;
  issueType: ReviewIssueType;
  issueLabel: string;
  severity: ReviewSeverity;
  severityLabel: string;
  headline: string;
  actionLabel: string;
  suggestedFix: string;
};

type ReviewDetailPanelProps = {
  review: DerivedReviewItem | null;
  form: DecisionForm | null;
  detailTab: ReviewTab;
  onChangeTab: (tab: ReviewTab) => void;
  onUpdateForm: (attendanceId: number, patch: Partial<DecisionForm>) => void;
  onApprove: (item: AttendanceReviewItem) => Promise<void>;
  onReject: (item: AttendanceReviewItem) => Promise<void>;
  busyId: number | null;
  mobile?: boolean;
  onClose?: () => void;
};

const AUTO_REFRESH_MS = 25_000;
const FINAL_STATUS_OPTIONS: AttendanceReviewFinalStatus[] = ["completed", "working", "half_day", "absent"];
const DETAIL_TABS: Array<{ id: ReviewTab; label: string }> = [
  { id: "details", label: "Details" },
  { id: "fix", label: "Suggested Fix" },
  { id: "history", label: "History" },
];
const ISSUE_TYPE_LABELS: Record<ReviewIssueType, string> = {
  missed_punch: "Missed Punch",
  late_entry: "Late Entry",
  early_exit: "Early Exit",
  absent: "Absent",
  overtime: "Overtime",
  timing_correction: "Timing Correction",
  status_correction: "Status Correction",
  shift_correction: "Shift Correction",
};
const ISSUE_TYPE_OPTIONS: Array<{ value: "all" | ReviewIssueType; label: string }> = [
  { value: "all", label: "All issues" },
  { value: "missed_punch", label: "Missed punch" },
  { value: "late_entry", label: "Late entry" },
  { value: "early_exit", label: "Early exit" },
  { value: "absent", label: "Absent" },
  { value: "overtime", label: "Overtime" },
  { value: "timing_correction", label: "Timing correction" },
  { value: "status_correction", label: "Status correction" },
  { value: "shift_correction", label: "Shift correction" },
];
const SEVERITY_LABELS: Record<ReviewSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const offset = parsed.getTimezoneOffset() * 60000;
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16);
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

function formatMinutes(value?: number | null) {
  const safe = Math.max(value || 0, 0);
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

function formatShift(value?: string | null) {
  if (!value) return "-";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatRole(value?: string | null) {
  if (!value) return "-";
  return value
    .split("_")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function canReviewAttendance(role?: string | null) {
  return ["supervisor", "manager", "admin", "owner"].includes(role || "");
}

function canManageAttendance(role?: string | null) {
  return ["manager", "admin", "owner"].includes(role || "");
}

function buildDecisionForm(item: AttendanceReviewItem): DecisionForm {
  const finalStatus: AttendanceReviewFinalStatus =
    item.status === "working" || item.status === "missed_punch"
      ? "completed"
      : item.status === "half_day" || item.status === "absent"
        ? item.status
        : "completed";
  return {
    punchInAt: toDateTimeLocal(item.regularization?.requested_in_at || item.punch_in_at),
    punchOutAt: toDateTimeLocal(item.regularization?.requested_out_at || item.punch_out_at),
    finalStatus,
    note: item.regularization?.reason || item.note || "",
  };
}

function getAvatarLabel(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function issueTypeFromItem(item: AttendanceReviewItem): ReviewIssueType {
  const requestType = item.regularization?.request_type;
  if (requestType === "missed_punch") return "missed_punch";
  if (requestType === "shift_correction") return "shift_correction";
  if (requestType === "status_correction") return item.status === "absent" ? "absent" : "status_correction";
  if (requestType === "timing_correction") {
    if (item.status === "half_day") return "early_exit";
    return "timing_correction";
  }
  if (item.status === "absent") return "absent";
  if (!item.punch_in_at || !item.punch_out_at || item.status === "missed_punch") return "missed_punch";
  if (item.status === "half_day") return "early_exit";
  if (item.late_minutes > 0) return "late_entry";
  if (item.overtime_minutes > 0) return "overtime";
  return "timing_correction";
}

function severityFromItem(item: AttendanceReviewItem, issueType: ReviewIssueType): ReviewSeverity {
  if (issueType === "missed_punch" || issueType === "absent" || issueType === "status_correction") return "critical";
  if (issueType === "late_entry" || issueType === "early_exit" || issueType === "shift_correction") return "warning";
  if (item.regularization?.request_type === "missed_punch") return "critical";
  return "info";
}

function headlineFromItem(item: AttendanceReviewItem, issueType: ReviewIssueType) {
  switch (issueType) {
    case "missed_punch":
      return "Punch time is incomplete and needs a supervisor decision.";
    case "late_entry":
      return `Late arrival detected at ${item.late_minutes} minutes beyond shift start.`;
    case "early_exit":
      return "Shift looks shorter than expected and may need a time correction.";
    case "absent":
      return "Status is moving toward absent and should be verified before payroll.";
    case "overtime":
      return `Overtime recorded for ${formatMinutes(item.overtime_minutes)} and needs validation.`;
    case "shift_correction":
      return "Shift assignment has a correction request attached to this record.";
    case "status_correction":
      return "Status correction request is waiting for final approval.";
    case "timing_correction":
    default:
      return "Timing correction request is waiting for a final decision.";
  }
}

function suggestedFixFromItem(item: AttendanceReviewItem, issueType: ReviewIssueType) {
  switch (issueType) {
    case "missed_punch":
      return "Confirm the correct punch-out time and close the attendance day.";
    case "late_entry":
      return "Approve the late arrival or adjust the punch-in time if the worker was on time.";
    case "early_exit":
      return "Check the punch-out time and choose the right final status before closure.";
    case "absent":
      return "Confirm absence only if no valid punch exists. Otherwise edit the status and timings.";
    case "overtime":
      return "Validate overtime minutes before sending this record to payroll.";
    case "shift_correction":
      return "Review the requested shift and make sure the record belongs to the correct shift window.";
    case "status_correction":
      return "Compare requested status with the actual punch evidence before approval.";
    case "timing_correction":
    default:
      return "Use the requested timings if they match the actual shift evidence.";
  }
}

function buildDerivedReviewItem(item: AttendanceReviewItem): DerivedReviewItem {
  const issueType = issueTypeFromItem(item);
  const severity = severityFromItem(item, issueType);
  return {
    item,
    issueType,
    issueLabel: ISSUE_TYPE_LABELS[issueType],
    severity,
    severityLabel: SEVERITY_LABELS[severity],
    headline: headlineFromItem(item, issueType),
    actionLabel: item.regularization ? "Review Request" : "Review Record",
    suggestedFix: suggestedFixFromItem(item, issueType),
  };
}

function severityClasses(severity: ReviewSeverity) {
  if (severity === "critical") return "border border-red-400/35 bg-[rgba(239,68,68,0.16)] text-red-100";
  if (severity === "warning") return "border border-amber-400/35 bg-[rgba(245,158,11,0.14)] text-amber-100";
  return "border border-sky-400/35 bg-[rgba(56,189,248,0.14)] text-sky-100";
}

function infoCardClasses(severity: ReviewSeverity) {
  if (severity === "critical") return "border-red-400/25 bg-[rgba(239,68,68,0.07)]";
  if (severity === "warning") return "border-amber-400/25 bg-[rgba(245,158,11,0.07)]";
  return "border-sky-400/25 bg-[rgba(56,189,248,0.07)]";
}

function SummaryCard({ label, value, helper }: { label: string; value: number | string; helper: string }) {
  return (
    <Card className="border-[var(--border)] bg-[var(--card-strong)]">
      <CardHeader className="pb-2">
        <div className="text-sm text-[var(--muted)]">{label}</div>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-[var(--muted)]">{helper}</CardContent>
    </Card>
  );
}

function EmptyQueueState({ filtered }: { filtered: boolean }) {
  return (
    <Card className="border-dashed border-[var(--border)] bg-[var(--card-strong)]">
      <CardContent className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Attendance Review</div>
        <div className="text-2xl font-semibold text-[var(--text)]">
          {filtered ? "No issues match these filters" : "No attendance issues are waiting"}
        </div>
        <div className="max-w-xl text-sm leading-6 text-[var(--muted)]">
          {filtered
            ? "Try changing the issue, shift, or department filters to find another record."
            : "This review board is clear for the selected date range. New missed punches or regularization requests will appear here automatically."}
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewDetailPanel({
  review,
  form,
  detailTab,
  onChangeTab,
  onUpdateForm,
  onApprove,
  onReject,
  busyId,
  mobile = false,
  onClose,
}: ReviewDetailPanelProps) {
  if (!review || !form) {
    return (
      <Card className="border-dashed border-[var(--border)] bg-[var(--card-strong)]">
        <CardContent className="flex min-h-[22rem] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <div className="text-sm uppercase tracking-[0.26em] text-[var(--accent)]">Review Panel</div>
          <div className="text-2xl font-semibold text-[var(--text)]">Select an issue to review</div>
          <div className="max-w-sm text-sm leading-6 text-[var(--muted)]">
            Open any attendance issue from the queue to inspect the worker details, apply the suggested fix, and approve or reject the record.
          </div>
        </CardContent>
      </Card>
    );
  }

  const { item } = review;
  const isBusy = busyId === item.attendance_id;
  const canReject = form.note.trim().length > 0;
  const timeline = [
    item.regularization
      ? {
          title: "Request raised",
          timestamp: formatDateTime(item.regularization.created_at),
          body: item.regularization.reason,
        }
      : {
          title: "Attendance flagged",
          timestamp: formatDate(item.attendance_date),
          body: item.review_reason,
        },
    item.regularization?.requested_in_at || item.regularization?.requested_out_at
      ? {
          title: "Requested timing",
          timestamp: formatDate(item.attendance_date),
          body: `In ${formatDateTime(item.regularization?.requested_in_at)} | Out ${formatDateTime(item.regularization?.requested_out_at)}`,
        }
      : null,
    item.note
      ? {
          title: "Current note",
          timestamp: formatDate(item.attendance_date),
          body: item.note,
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; timestamp: string; body: string }>;

  return (
    <Card className="border-[var(--border)] bg-[rgba(17,21,33,0.96)] shadow-2xl">
      <CardHeader className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]", severityClasses(review.severity))}>
                {review.severityLabel}
              </span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--card-strong)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                {review.issueLabel}
              </span>
            </div>
            <div>
              <CardTitle className="text-2xl">{item.name}</CardTitle>
              <div className="mt-1 text-sm text-[var(--muted)]">
                {formatRole(item.role)} | {item.department || "No department"} | {formatShift(item.shift)}
              </div>
            </div>
          </div>
          {mobile && onClose ? (
            <Button variant="ghost" className="px-3 py-2 text-xs" onClick={onClose}>
              Close
            </Button>
          ) : null}
        </div>

        <div className={cn("rounded-[1.6rem] border p-4", infoCardClasses(review.severity))}>
          <div className="text-sm font-semibold text-[var(--text)]">{review.headline}</div>
          <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{review.suggestedFix}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {DETAIL_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                detailTab === tab.id
                  ? "bg-[var(--accent)] text-[#0b0e14]"
                  : "border border-[var(--border)] bg-[var(--card-strong)] text-[var(--muted)] hover:text-[var(--text)]",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {detailTab === "details" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Attendance date", value: formatDate(item.attendance_date) },
                { label: "Review status", value: item.review_status.replaceAll("_", " ") },
                { label: "Punch in", value: formatDateTime(item.punch_in_at) },
                { label: "Punch out", value: formatDateTime(item.punch_out_at) },
                { label: "Worked time", value: formatMinutes(item.worked_minutes) },
                { label: "Late / Overtime", value: `${formatMinutes(item.late_minutes)} / ${formatMinutes(item.overtime_minutes)}` },
              ].map((row) => (
                <div key={row.label} className="rounded-2xl border border-[var(--border)] bg-[rgba(10,14,24,0.78)] p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{row.label}</div>
                  <div className="mt-2 text-sm font-semibold text-[var(--text)]">{row.value}</div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[rgba(10,14,24,0.78)] p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Review reason</div>
              <div className="mt-2 text-sm leading-6 text-[var(--text)]">{item.review_reason}</div>
            </div>

            {item.regularization ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(10,14,24,0.78)] p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Requested correction</div>
                <div className="mt-2 text-sm leading-6 text-[var(--text)]">
                  {ISSUE_TYPE_LABELS[item.regularization.request_type as ReviewIssueType] || formatRole(item.regularization.request_type)}
                </div>
                <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.regularization.reason}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        {detailTab === "fix" ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-400/20 bg-[rgba(34,211,238,0.08)] p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-cyan-100/80">Suggested outcome</div>
              <div className="mt-2 text-sm font-semibold text-cyan-50">{review.suggestedFix}</div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm text-[var(--muted)]">Punch In</label>
                <Input
                  type="datetime-local"
                  value={form.punchInAt}
                  onChange={(event) => onUpdateForm(item.attendance_id, { punchInAt: event.target.value })}
                />
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Punch Out</label>
                <Input
                  type="datetime-local"
                  value={form.punchOutAt}
                  onChange={(event) => onUpdateForm(item.attendance_id, { punchOutAt: event.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-[var(--muted)]">Final Status</label>
              <Select
                value={form.finalStatus}
                onChange={(event) =>
                  onUpdateForm(item.attendance_id, { finalStatus: event.target.value as AttendanceReviewFinalStatus })
                }
              >
                {FINAL_STATUS_OPTIONS.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {statusOption.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-sm text-[var(--muted)]">Reviewer note</label>
              <Textarea
                rows={4}
                value={form.note}
                onChange={(event) => onUpdateForm(item.attendance_id, { note: event.target.value })}
                placeholder="Explain why this record is approved, edited, or rejected."
              />
            </div>
          </div>
        ) : null}

        {detailTab === "history" ? (
          <div className="space-y-3">
            {timeline.map((entry) => (
              <div key={`${entry.title}-${entry.timestamp}`} className="rounded-2xl border border-[var(--border)] bg-[rgba(10,14,24,0.78)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[var(--text)]">{entry.title}</div>
                  <div className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{entry.timestamp}</div>
                </div>
                <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{entry.body}</div>
              </div>
            ))}
          </div>
        ) : null}

        <div className={cn("border-t border-[var(--border)] pt-5", mobile ? "sticky bottom-0 bg-[rgba(17,21,33,0.96)] pb-2" : "")}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="flex-1" onClick={() => void onApprove(item)} disabled={isBusy}>
              {isBusy ? "Saving..." : "Approve & Close"}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => void onReject(item)} disabled={isBusy || !canReject}>
              {isBusy ? "Saving..." : "Reject"}
            </Button>
          </div>
          {!canReject ? (
            <div className="mt-3 text-xs text-amber-100/80">Add a note before rejecting this attendance record.</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AttendanceReviewPage() {
  const { user, activeFactory, loading, error: sessionError } = useSession();
  const [attendanceDate, setAttendanceDate] = useState(todayValue());
  const [payload, setPayload] = useState<AttendanceReviewPayload | null>(null);
  const [forms, setForms] = useState<Record<number, DecisionForm>>({});
  const [pageLoading, setPageLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [issueFilter, setIssueFilter] = useState<"all" | ReviewIssueType>("all");
  const [shiftFilter, setShiftFilter] = useState<"all" | string>("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<number | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<ReviewTab>("details");

  const deferredSearch = useDeferredValue(search);
  const canReview = canReviewAttendance(user?.role);
  const canManage = canManageAttendance(user?.role);

  const loadReview = useCallback(
    async (options?: { background?: boolean }) => {
      if (!user || !canReview) return;
      const shouldBackground = Boolean(options?.background);
      if (shouldBackground) {
        setRefreshing(true);
      } else {
        setPageLoading(true);
      }
      setError("");
      try {
        const next = await listAttendanceReview(attendanceDate);
        setPayload(next);
        setForms((current) => {
          const nextForms: Record<number, DecisionForm> = {};
          next.items.forEach((item) => {
            nextForms[item.attendance_id] = current[item.attendance_id] || buildDecisionForm(item);
          });
          return nextForms;
        });
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Could not load attendance review.");
        }
        if (!shouldBackground) {
          setPayload(null);
        }
      } finally {
        setLastUpdatedAt(new Date().toISOString());
        setHasLoadedOnce(true);
        setPageLoading(false);
        setRefreshing(false);
      }
    },
    [attendanceDate, canReview, user],
  );

  useEffect(() => {
    setStatus("");
    setError("");
    setLastUpdatedAt(null);
    setSelectedAttendanceId(null);
    setMobileDetailOpen(false);
    setDetailTab("details");
    if (!user || !canReview) {
      setPayload(null);
      setForms({});
      setHasLoadedOnce(false);
      setPageLoading(true);
      return;
    }
    setPayload(null);
    setForms({});
    setHasLoadedOnce(false);
  }, [canReview, user]);

  useEffect(() => {
    if (!user || !canReview) return;
    const timer = window.setTimeout(() => {
      void loadReview();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canReview, loadReview, user]);

  useEffect(() => {
    if (!user || !canReview) return;
    const refresh = () => {
      if (!document.hidden && !busyId) {
        void loadReview({ background: true });
      }
    };
    const timer = window.setInterval(refresh, AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [busyId, canReview, loadReview, user]);

  useEffect(() => {
    if (!user || !canReview) return;
    return subscribeToWorkflowRefresh(() => {
      if (!busyId) {
        void loadReview({ background: true });
      }
    });
  }, [busyId, canReview, loadReview, user]);

  const items = useMemo(() => payload?.items || [], [payload]);
  const derivedItems = useMemo(() => {
    const severityRank: Record<ReviewSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return items
      .map((item) => buildDerivedReviewItem(item))
      .sort((left, right) => {
        const severityDifference = severityRank[left.severity] - severityRank[right.severity];
        if (severityDifference !== 0) return severityDifference;
        if (Boolean(left.item.regularization) !== Boolean(right.item.regularization)) {
          return left.item.regularization ? -1 : 1;
        }
        const leftDate = new Date(left.item.attendance_date).getTime();
        const rightDate = new Date(right.item.attendance_date).getTime();
        if (leftDate !== rightDate) return rightDate - leftDate;
        return left.item.name.localeCompare(right.item.name);
      });
  }, [items]);

  const departmentOptions = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.department).filter((value): value is string => Boolean(value)))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [items],
  );

  const filteredItems = useMemo(() => {
    const searchTerm = normalizeSearchValue(deferredSearch);
    return derivedItems.filter((review) => {
      if (issueFilter !== "all" && review.issueType !== issueFilter) return false;
      if (shiftFilter !== "all" && review.item.shift !== shiftFilter) return false;
      if (departmentFilter !== "all" && (review.item.department || "") !== departmentFilter) return false;
      if (!searchTerm) return true;
      const haystack = normalizeSearchValue(
        [
          review.item.name,
          review.item.user_code,
          review.item.department,
          review.item.designation,
          review.item.role,
          review.issueLabel,
          review.item.review_reason,
        ]
          .filter(Boolean)
          .join(" "),
      );
      return haystack.includes(searchTerm);
    });
  }, [deferredSearch, departmentFilter, derivedItems, issueFilter, shiftFilter]);

  const selectedReview = useMemo(
    () => filteredItems.find((review) => review.item.attendance_id === selectedAttendanceId) || null,
    [filteredItems, selectedAttendanceId],
  );
  const selectedForm = selectedReview ? forms[selectedReview.item.attendance_id] || buildDecisionForm(selectedReview.item) : null;
  const highPriorityCount = derivedItems.filter((item) => item.severity === "critical").length;
  const regularizationCount = items.filter((item) => item.regularization).length;
  const lateSignals = items.filter((item) => item.late_minutes > 0).length;

  useEffect(() => {
    if (!filteredItems.length) {
      setSelectedAttendanceId(null);
      setMobileDetailOpen(false);
      return;
    }
    setSelectedAttendanceId((current) =>
      filteredItems.some((review) => review.item.attendance_id === current) ? current : filteredItems[0].item.attendance_id,
    );
  }, [filteredItems]);

  function updateForm(attendanceId: number, patch: Partial<DecisionForm>) {
    setForms((current) => ({
      ...current,
      [attendanceId]: {
        ...(current[attendanceId] || { punchInAt: "", punchOutAt: "", finalStatus: "completed", note: "" }),
        ...patch,
      },
    }));
  }

  function openReview(attendanceId: number, mobile = false) {
    setSelectedAttendanceId(attendanceId);
    setDetailTab("details");
    if (mobile) {
      setMobileDetailOpen(true);
    }
  }

  async function handleApprove(item: AttendanceReviewItem) {
    const form = forms[item.attendance_id] || buildDecisionForm(item);
    setBusyId(item.attendance_id);
    setStatus("");
    setError("");
    try {
      await approveAttendanceReview(item.attendance_id, {
        regularization_id: item.regularization?.id ?? null,
        punch_in_at: form.punchInAt || null,
        punch_out_at: form.punchOutAt || null,
        final_status: form.finalStatus || null,
        note: form.note || null,
      });
      setStatus(`Attendance review closed for ${item.name}.`);
      setMobileDetailOpen(false);
      await loadReview({ background: true });
      signalWorkflowRefresh("attendance-review-approved");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not approve attendance review.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(item: AttendanceReviewItem) {
    const form = forms[item.attendance_id] || buildDecisionForm(item);
    setBusyId(item.attendance_id);
    setStatus("");
    setError("");
    try {
      await rejectAttendanceReview(item.attendance_id, {
        regularization_id: item.regularization?.id ?? null,
        note: form.note,
      });
      setStatus(`Attendance review rejected for ${item.name}.`);
      setMobileDetailOpen(false);
      await loadReview({ background: true });
      signalWorkflowRefresh("attendance-review-rejected");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not reject attendance review.");
      }
    } finally {
      setBusyId(null);
    }
  }

  if (loading || (pageLoading && user && canReview && !hasLoadedOnce)) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-40 rounded-[2rem]" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-40 rounded-2xl" />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
            <Skeleton className="h-[36rem] rounded-2xl" />
            <Skeleton className="hidden h-[36rem] rounded-2xl lg:block" />
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Attendance Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Please login to continue."}</div>
            <Link href="/login">
              <Button>Open Login</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!canReview) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Attendance Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">
              Attendance review is available to supervisor, manager, admin, and owner roles.
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/attendance">
                <Button>Open My Attendance</Button>
              </Link>
              <Link href="/work-queue">
                <Button variant="outline">Work Queue</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.9)] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.3em] text-[var(--accent)]">Attendance Review</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Review exceptions before payroll and shift close</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Check missed punches, timing corrections, and attendance requests for{" "}
                {payload?.factory_name || activeFactory?.name || user.factory_name}. Desktop gives a full review board, and mobile keeps the same decisions in a focused issue-by-issue flow.
              </p>
            </div>

            <div className="space-y-3 xl:text-right">
              <div className="flex flex-wrap gap-3 xl:justify-end">
                <Link href="/attendance">
                  <Button variant="outline">My Attendance</Button>
                </Link>
                <Link href="/attendance/live">
                  <Button variant="outline">Live Board</Button>
                </Link>
                {canManage ? (
                  <Link href="/settings/attendance">
                    <Button variant="outline">Attendance Admin</Button>
                  </Link>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <Button
                  variant="outline"
                  className="px-4 py-2 text-xs"
                  onClick={() => {
                    void loadReview({ background: true });
                  }}
                  disabled={refreshing || busyId != null}
                >
                  {refreshing ? "Refreshing..." : "Refresh Queue"}
                </Button>
                <span className="text-xs text-[var(--muted)]">
                  {refreshing
                    ? "Updating review queue..."
                    : lastUpdatedAt
                      ? `Updated ${formatDateTime(lastUpdatedAt)}`
                      : "Live updates every 25 seconds"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {status ? (
          <div className="rounded-2xl border border-emerald-400/30 bg-[rgba(34,197,94,0.12)] px-4 py-3 text-sm text-emerald-100">
            {status}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}
        {sessionError ? (
          <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">
            {sessionError}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Pending Review"
            value={derivedItems.length}
            helper="Attendance rows still waiting for a supervisor decision."
          />
          <SummaryCard
            label="High Priority"
            value={highPriorityCount}
            helper="Critical issues that can affect payroll or shift closure."
          />
          <SummaryCard
            label="Regularizations"
            value={regularizationCount}
            helper="Worker-submitted requests that need final approval."
          />
          <SummaryCard
            label="Late Signals"
            value={lateSignals}
            helper="Records with late arrival data that should be confirmed."
          />
        </section>

        <Card className="border-[var(--border)] bg-[rgba(18,22,34,0.9)]">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-sm text-[var(--muted)]">Filters</div>
                <CardTitle className="text-xl">Find the right issue fast</CardTitle>
              </div>
              <div className="text-sm text-[var(--muted)]">
                Showing {filteredItems.length} of {derivedItems.length} review items
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="xl:col-span-2">
              <label className="text-sm text-[var(--muted)]">Search employee or issue</label>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, department, role, or issue"
              />
            </div>
            <div>
              <label className="text-sm text-[var(--muted)]">Review date</label>
              <Input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} />
            </div>
            <div>
              <label className="text-sm text-[var(--muted)]">Issue type</label>
              <Select value={issueFilter} onChange={(event) => setIssueFilter(event.target.value as "all" | ReviewIssueType)}>
                {ISSUE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm text-[var(--muted)]">Shift</label>
              <Select value={shiftFilter} onChange={(event) => setShiftFilter(event.target.value)}>
                <option value="all">All shifts</option>
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
              </Select>
            </div>
            <div>
              <label className="text-sm text-[var(--muted)]">Department</label>
              <Select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
                <option value="all">All departments</option>
                {departmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
          <div className="space-y-4">
            {filteredItems.length ? (
              <>
                <Card className="hidden border-[var(--border)] bg-[rgba(18,22,34,0.92)] lg:block">
                  <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-[var(--muted)]">Review board</div>
                      <CardTitle className="text-xl">Attendance issues by priority</CardTitle>
                    </div>
                    <div className="text-sm text-[var(--muted)]">Critical items stay at the top for faster closure.</div>
                  </CardHeader>
                  <CardContent className="px-0 pb-0">
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-separate border-spacing-0">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                            <th className="px-6 py-3">Employee</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Shift</th>
                            <th className="px-4 py-3">Punch In</th>
                            <th className="px-4 py-3">Punch Out</th>
                            <th className="px-4 py-3">Issue</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-6 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredItems.map((review) => {
                            const isActive = review.item.attendance_id === selectedAttendanceId;
                            return (
                              <tr
                                key={review.item.attendance_id}
                                className={cn(
                                  "cursor-pointer border-t border-[var(--border)]/60 text-sm transition hover:bg-[rgba(255,255,255,0.02)]",
                                  isActive ? "bg-[rgba(34,211,238,0.08)]" : "bg-transparent",
                                )}
                                onClick={() => openReview(review.item.attendance_id)}
                              >
                                <td className="px-6 py-4 align-top">
                                  <div className="flex items-start gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(34,211,238,0.16)] text-sm font-semibold text-cyan-50">
                                      {getAvatarLabel(review.item.name)}
                                    </div>
                                    <div>
                                      <div className="font-semibold text-[var(--text)]">{review.item.name}</div>
                                      <div className="mt-1 text-xs text-[var(--muted)]">
                                        ID {review.item.user_code} | {review.item.department || "No department"}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-[var(--text)]">{formatDate(review.item.attendance_date)}</td>
                                <td className="px-4 py-4 text-[var(--text)]">{formatShift(review.item.shift)}</td>
                                <td className="px-4 py-4 text-[var(--text)]">{formatDateTime(review.item.punch_in_at)}</td>
                                <td className="px-4 py-4 text-[var(--text)]">{formatDateTime(review.item.punch_out_at)}</td>
                                <td className="px-4 py-4">
                                  <div className="space-y-2">
                                    <span
                                      className={cn(
                                        "inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                                        severityClasses(review.severity),
                                      )}
                                    >
                                      {review.issueLabel}
                                    </span>
                                    <div className="max-w-[17rem] text-xs leading-5 text-[var(--muted)]">{review.headline}</div>
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="text-sm font-semibold text-[var(--text)]">
                                    {review.item.review_status.replaceAll("_", " ")}
                                  </div>
                                  <div className="mt-1 text-xs text-[var(--muted)]">{review.severityLabel}</div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <Button
                                    className="px-4 py-2 text-xs"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openReview(review.item.attendance_id);
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
                  </CardContent>
                </Card>

                <div className="space-y-4 lg:hidden">
                  {filteredItems.map((review) => (
                    <Card key={review.item.attendance_id} className="border-[var(--border)] bg-[rgba(18,22,34,0.92)]">
                      <CardContent className="space-y-4 px-5 py-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-lg font-semibold text-[var(--text)]">{review.item.name}</div>
                            <div className="mt-1 text-sm text-[var(--muted)]">
                              {review.item.department || "No department"} | {formatShift(review.item.shift)}
                            </div>
                          </div>
                          <span
                            className={cn(
                              "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                              severityClasses(review.severity),
                            )}
                          >
                            {review.severityLabel}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm font-semibold text-[var(--text)]">{review.issueLabel}</div>
                          <div className="text-sm leading-6 text-[var(--muted)]">{review.headline}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(10,14,24,0.78)] p-3">
                            <div className="text-[var(--muted)]">Date</div>
                            <div className="mt-1 font-semibold text-[var(--text)]">{formatDate(review.item.attendance_date)}</div>
                          </div>
                          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(10,14,24,0.78)] p-3">
                            <div className="text-[var(--muted)]">Worked</div>
                            <div className="mt-1 font-semibold text-[var(--text)]">{formatMinutes(review.item.worked_minutes)}</div>
                          </div>
                        </div>

                        <Button className="w-full" onClick={() => openReview(review.item.attendance_id, true)}>
                          {review.actionLabel}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <EmptyQueueState filtered={derivedItems.length > 0} />
            )}
          </div>

          <div className="hidden lg:block">
            <div className="sticky top-24">
              <ReviewDetailPanel
                review={selectedReview}
                form={selectedForm}
                detailTab={detailTab}
                onChangeTab={setDetailTab}
                onUpdateForm={updateForm}
                onApprove={handleApprove}
                onReject={handleReject}
                busyId={busyId}
              />
            </div>
          </div>
        </section>
      </div>

      {mobileDetailOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(4,8,16,0.96)] px-4 py-4 lg:hidden">
          <ReviewDetailPanel
            review={selectedReview}
            form={selectedForm}
            detailTab={detailTab}
            onChangeTab={setDetailTab}
            onUpdateForm={updateForm}
            onApprove={handleApprove}
            onReject={handleReject}
            busyId={busyId}
            mobile
            onClose={() => setMobileDetailOpen(false)}
          />
        </div>
      ) : null}
    </main>
  );
}
