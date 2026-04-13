"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "@/lib/api";
import { listEntries, type Entry } from "@/lib/entries";
import {
  downloadEntryReport,
  downloadReportJob,
  getMonthlyExport,
  getReportInsights,
  getReportJob,
  getWeeklyExport,
  startEntryPdfJob,
  startRangeExcelJob,
  triggerBlobDownload,
  type ReportInsights,
  type ReportJob,
} from "@/lib/reports";
import { getReportTrustSummary, type ReportTrustSummary } from "@/lib/report-trust";
import { getOcrVerificationSummary, type OcrVerificationSummary } from "@/lib/ocr";
import { getSteelOverview, type SteelOverview } from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { AiActivationNotice } from "@/components/ai-activation-notice";
import ReportInsightsBoard from "@/components/report-insights-board";
import { ReportsPageSkeleton } from "@/components/page-skeletons";
import { TrustChecklist } from "@/components/trust-checklist";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type IssueFilter = "any" | "yes" | "no";

type ReportFilters = {
  startDate: string;
  endDate: string;
  shift: string;
  hasIssues: IssueFilter;
  status: string;
  search: string;
};

type ReportHubCard = {
  eyebrow: string;
  title: string;
  metric: string;
  detail: string;
  href: string;
  action: string;
};

const AUTO_REFRESH_MS = 40_000;
const CHART_ROLES = ["supervisor", "manager", "admin", "owner"];

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const now = new Date();
  now.setDate(now.getDate() - days);
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function buildDefaultFilters(): ReportFilters {
  return {
    startDate: daysAgo(7),
    endDate: todayValue(),
    shift: "",
    hasIssues: "any",
    status: "any",
    search: "",
  };
}

function formatDateTime(value?: string) {
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

function toCsv(rows: Entry[], approvals: Map<number, { approvedBy?: string | null; approvedAt?: string | null }>) {
  const headers = [
    "id",
    "date",
    "shift",
    "department",
    "status",
    "approved_by_name",
    "approved_at",
    "units_target",
    "units_produced",
    "downtime_minutes",
    "notes",
  ];
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    headers.join(","),
    ...rows.map((row) => {
      const approval = approvals.get(row.id);
      const payload: Record<string, unknown> = {
        ...row,
        approved_by_name: approval?.approvedBy || "",
        approved_at: approval?.approvedAt || "",
      };
      return headers.map((header) => escape(payload[header])).join(",");
    }),
  ].join("\n");
}

function progressWidth(progress?: number) {
  return `${Math.max(4, Math.min(100, Number(progress || 0)))}%`;
}

function filtersEqual(a: ReportFilters, b: ReportFilters) {
  return (
    a.startDate === b.startDate
    && a.endDate === b.endDate
    && a.shift === b.shift
    && a.hasIssues === b.hasIssues
    && a.status === b.status
    && a.search === b.search
  );
}

export default function ReportsPage() {
  const searchParams = useSearchParams();
  const { user, activeFactory, loading, error: sessionError } = useSession();
  const [draftFilters, setDraftFilters] = useState<ReportFilters>(() => buildDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(() => buildDefaultFilters());
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingRows, setLoadingRows] = useState(false);
  const [hasLoadedRows, setHasLoadedRows] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [insights, setInsights] = useState<ReportInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [refreshingInsights, setRefreshingInsights] = useState(false);
  const [steelOverview, setSteelOverview] = useState<SteelOverview | null>(null);
  const [ocrSummary, setOcrSummary] = useState<OcrVerificationSummary | null>(null);
  const [rangeTrust, setRangeTrust] = useState<ReportTrustSummary | null>(null);
  const [weeklyTrust, setWeeklyTrust] = useState<ReportTrustSummary | null>(null);
  const [monthlyTrust, setMonthlyTrust] = useState<ReportTrustSummary | null>(null);
  const [loadingTrust, setLoadingTrust] = useState(false);
  const [trustError, setTrustError] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileAiExpanded, setMobileAiExpanded] = useState(false);
  const [reportJob, setReportJob] = useState<ReportJob | null>(null);
  const completedReportDownloads = useRef<Set<string>>(new Set());
  const presetAppliedRef = useRef(false);

  const isAccountant = user?.role === "accountant";
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const trustedOcrDocuments = ocrSummary?.trusted_documents ?? 0;
  const pendingOcrDocuments = ocrSummary?.pending_documents ?? 0;
  const pendingTrustedWork = pendingOcrDocuments + (steelOverview ? Number(steelOverview.confidence_counts.red || 0) : 0);
  const shiftApprovalMap = useMemo(
    () => new Map(
      (rangeTrust?.approval_register.shift_entries || []).map((record) => [
        record.id,
        {
          approvedBy: record.approved_by_name,
          approvedAt: record.approved_at,
        },
      ]),
    ),
    [rangeTrust],
  );

  const loadRows = useCallback(async (options?: { background?: boolean }) => {
    if (!user || isAccountant) {
      setLoadingRows(false);
      setRefreshing(false);
      return;
    }
    const shouldBackground = Boolean(options?.background) && hasLoadedRows;
    if (shouldBackground) {
      setRefreshing(true);
    } else {
      setLoadingRows(true);
    }
    setError("");
    try {
      const response = await listEntries({
        start_date: appliedFilters.startDate,
        end_date: appliedFilters.endDate,
        page,
        page_size: pageSize,
        shift: appliedFilters.shift ? [appliedFilters.shift as Entry["shift"]] : undefined,
        search: appliedFilters.search.trim() || undefined,
        has_issues: appliedFilters.hasIssues === "any" ? undefined : appliedFilters.hasIssues === "yes",
        status: appliedFilters.status === "any" ? undefined : [appliedFilters.status],
      });
      setRows(response.items);
      setTotal(response.total);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not load reports.");
      }
    } finally {
      setLastUpdatedAt(new Date().toISOString());
      setHasLoadedRows(true);
      setLoadingRows(false);
      setRefreshing(false);
    }
  }, [appliedFilters, hasLoadedRows, isAccountant, page, user]);

  const loadInsights = useCallback(async (options?: { background?: boolean }) => {
    if (!user) {
      setInsights(null);
      setSteelOverview(null);
      setLoadingInsights(false);
      setRefreshingInsights(false);
      return;
    }
    const canSeeCharts = CHART_ROLES.includes(user.role);
    if (!canSeeCharts) {
      setInsights(null);
      setSteelOverview(null);
      setLoadingInsights(false);
      setRefreshingInsights(false);
      return;
    }
    const shouldBackground = Boolean(options?.background) && hasLoadedRows;
    if (shouldBackground) {
      setRefreshingInsights(true);
    } else {
      setLoadingInsights(true);
    }
    setError("");
    try {
      const [insightsResult, steelResult, ocrSummaryResult] = await Promise.allSettled([
        getReportInsights({
          startDate: appliedFilters.startDate,
          endDate: appliedFilters.endDate,
          shift: appliedFilters.shift || undefined,
          hasIssues: appliedFilters.hasIssues,
          status: appliedFilters.status,
          search: appliedFilters.search,
        }),
        activeFactory?.industry_type === "steel" ? getSteelOverview() : Promise.resolve(null),
        getOcrVerificationSummary(),
      ]);

      if (insightsResult.status === "fulfilled") {
        setInsights(insightsResult.value);
      } else if (insightsResult.reason instanceof ApiError && insightsResult.reason.status !== 403) {
        setError(insightsResult.reason.message);
      } else if (insightsResult.reason instanceof Error) {
        setError(insightsResult.reason.message);
      } else {
        setInsights(null);
      }

      if (steelResult.status === "fulfilled") {
        setSteelOverview(steelResult.value);
      } else {
        setSteelOverview(null);
      }

      if (ocrSummaryResult.status === "fulfilled") {
        setOcrSummary(ocrSummaryResult.value);
      } else if (ocrSummaryResult.reason instanceof ApiError && ocrSummaryResult.reason.status === 403) {
        setOcrSummary(null);
      } else {
        setOcrSummary(null);
      }
    } finally {
      setLoadingInsights(false);
      setRefreshingInsights(false);
    }
  }, [activeFactory?.industry_type, appliedFilters, hasLoadedRows, user]);

  const loadTrustSummaries = useCallback(async () => {
    if (!user) {
      setRangeTrust(null);
      setWeeklyTrust(null);
      setMonthlyTrust(null);
      setLoadingTrust(false);
      return;
    }
    setLoadingTrust(true);
    setTrustError("");
    try {
      const weeklyStart = daysAgo(6);
      const monthlyStart = daysAgo(29);
      const [rangeResult, weeklyResult, monthlyResult] = await Promise.allSettled([
        getReportTrustSummary({
          startDate: appliedFilters.startDate,
          endDate: appliedFilters.endDate,
        }),
        getReportTrustSummary({
          startDate: weeklyStart,
          endDate: todayValue(),
        }),
        getReportTrustSummary({
          startDate: monthlyStart,
          endDate: todayValue(),
        }),
      ]);

      if (rangeResult.status === "fulfilled") {
        setRangeTrust(rangeResult.value);
      } else {
        setRangeTrust(null);
        throw rangeResult.reason;
      }

      if (weeklyResult.status === "fulfilled") {
        setWeeklyTrust(weeklyResult.value);
      } else {
        setWeeklyTrust(null);
      }

      if (monthlyResult.status === "fulfilled") {
        setMonthlyTrust(monthlyResult.value);
      } else {
        setMonthlyTrust(null);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setTrustError(err.message);
      } else if (err instanceof Error) {
        setTrustError(err.message);
      } else {
        setTrustError("Could not load the trust checklist.");
      }
    } finally {
      setLoadingTrust(false);
    }
  }, [appliedFilters.endDate, appliedFilters.startDate, user]);

  useEffect(() => {
    if (presetAppliedRef.current) return;
    const preset = searchParams.get("preset");
    const nextShift = searchParams.get("shift");
    const nextStatus = searchParams.get("status");
    const nextSearch = searchParams.get("search");
    const nextHasIssues = searchParams.get("hasIssues");

    if (!preset && !nextShift && !nextStatus && !nextSearch && !nextHasIssues) {
      presetAppliedRef.current = true;
      return;
    }

    presetAppliedRef.current = true;
    const nextFilters = buildDefaultFilters();
    if (preset === "today") {
      const today = todayValue();
      nextFilters.startDate = today;
      nextFilters.endDate = today;
    } else if (preset === "month") {
      const today = new Date();
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      nextFilters.startDate = first.toISOString().slice(0, 10);
      nextFilters.endDate = todayValue();
    } else if (preset === "week") {
      nextFilters.startDate = daysAgo(7);
      nextFilters.endDate = todayValue();
    }

    if (nextShift) nextFilters.shift = nextShift;
    if (nextStatus) nextFilters.status = nextStatus;
    if (nextSearch) nextFilters.search = nextSearch;
    if (nextHasIssues === "yes" || nextHasIssues === "no" || nextHasIssues === "any") {
      nextFilters.hasIssues = nextHasIssues;
    }

    setPage(1);
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
  }, [searchParams]);

  useEffect(() => {
    setError("");
    setStatus("");
    setTrustError("");
    setLastUpdatedAt(null);
    setHasLoadedRows(false);
    setRefreshing(false);
    setRefreshingInsights(false);
    setRangeTrust(null);
    setWeeklyTrust(null);
    setMonthlyTrust(null);
    if (!user || isAccountant) {
      setRows([]);
      setTotal(0);
    }
  }, [isAccountant, user]);

  useEffect(() => {
    if (!user || isAccountant) return;
    void loadRows();
  }, [isAccountant, loadRows, user]);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  useEffect(() => {
    void loadTrustSummaries();
  }, [loadTrustSummaries]);

  useEffect(() => {
    if (!user || isAccountant || !hasLoadedRows) return;
    const refreshAll = () => {
      if (!document.hidden) {
        void Promise.all([
          loadRows({ background: true }),
          loadInsights({ background: true }),
          loadTrustSummaries(),
        ]);
      }
    };
    const timer = window.setInterval(refreshAll, AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", refreshAll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshAll);
    };
  }, [hasLoadedRows, isAccountant, loadInsights, loadRows, loadTrustSummaries, user]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const filteredRows = useMemo(() => rows, [rows]);
  const reportHubCards = useMemo<ReportHubCard[]>(() => {
    const cards: ReportHubCard[] = [
      {
        eyebrow: "Operational Output",
        title: isAccountant ? "Keep business reporting clean" : "Move from filter to export fast",
        metric: isAccountant ? "Summary-first desk" : `${total.toLocaleString("en-IN")} records in range`,
        detail: isAccountant
          ? "Use this desk for trusted summaries, exports, and owner-ready reporting without exposing raw operator rows."
          : `Current range runs ${appliedFilters.startDate} to ${appliedFilters.endDate}. Use this page when management needs one trusted view instead of manual Excel cleanup.`,
        href: "/attendance/reports",
        action: "Open Attendance Reports",
      },
      {
        eyebrow: "Trust Gate",
        title: "Only approved OCR should enter reporting",
        metric: `${trustedOcrDocuments} trusted OCR docs`,
        detail: ocrSummary
          ? pendingOcrDocuments
            ? `${pendingOcrDocuments} OCR document${pendingOcrDocuments === 1 ? "" : "s"} still need review before they belong in owner summaries.`
            : "OCR trust is clear right now. Reviewed documents are safe to carry into reports and outbound updates."
          : "OCR trust summary is not available for this role or factory right now.",
        href: pendingOcrDocuments > 0 ? "/ocr/verify" : "/approvals",
        action: pendingOcrDocuments > 0 ? "Open Review Documents" : "Open Review Queue",
      },
      {
        eyebrow: "Distribution",
        title: "Finish with an owner-ready update",
        metric: "AI activation pending",
        detail:
          activeFactory?.industry_type === "steel"
            ? pendingTrustedWork > 0
              ? `Steel risk and pending trust checks are still active (${pendingTrustedWork.toLocaleString("en-IN")} items), so hold the owner update until those checks are acknowledged.`
              : "Use trusted exports and the owner update desk while AI insights finish activating for this factory."
            : "Use trusted exports and the owner update desk while AI insights finish activating for this factory.",
        href: "/email-summary",
        action: "Open Email Summary",
      },
    ];

    return cards;
  }, [
    activeFactory?.industry_type,
    appliedFilters.endDate,
    appliedFilters.startDate,
    isAccountant,
    ocrSummary,
    pendingOcrDocuments,
    pendingTrustedWork,
    total,
    trustedOcrDocuments,
  ]);

  const handleQuickRange = (mode: "today" | "week" | "month") => {
    let nextStart = draftFilters.startDate;
    let nextEnd = draftFilters.endDate;
    if (mode === "today") {
      const today = todayValue();
      nextStart = today;
      nextEnd = today;
    } else if (mode === "week") {
      nextStart = daysAgo(7);
      nextEnd = todayValue();
    } else {
      const today = new Date();
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      nextStart = first.toISOString().slice(0, 10);
      nextEnd = todayValue();
    }
    setPage(1);
    setDraftFilters((current) => ({ ...current, startDate: nextStart, endDate: nextEnd }));
    setAppliedFilters((current) => ({ ...current, startDate: nextStart, endDate: nextEnd }));
  };

  const applyFilters = () => {
    const normalized: ReportFilters = {
      ...draftFilters,
      search: draftFilters.search.trim(),
    };
    const filtersChanged = !filtersEqual(normalized, appliedFilters);
    const pageChanged = page !== 1;
    setPage(1);
    setAppliedFilters(normalized);
    if (!filtersChanged && !pageChanged) {
      void Promise.all([
        loadRows({ background: true }),
        loadInsights({ background: true }),
        loadTrustSummaries(),
      ]);
    }
  };

  const resetFilters = () => {
    const next = buildDefaultFilters();
    setPage(1);
    setDraftFilters(next);
    setAppliedFilters(next);
  };

  const handleRefreshAll = () => {
    void Promise.all([
      loadRows({ background: true }),
      loadInsights({ background: true }),
      loadTrustSummaries(),
    ]);
  };

  const ensureTrustReady = useCallback((summary: ReportTrustSummary | null, fallbackMessage: string) => {
    if (!summary) {
      setError(fallbackMessage);
      setStatus("");
      return false;
    }
    if (!summary.can_send) {
      setError(summary.blocking_reason || fallbackMessage);
      setStatus("");
      return false;
    }
    return true;
  }, []);

  const ensureEntryApproved = useCallback((entry: Entry) => {
    if (entry.status === "approved") {
      return true;
    }
    setError("This shift entry is not approved yet. Approve it before exporting.");
    setStatus("");
    return false;
  }, []);

  const handleDownloadCurrentPage = () => {
    if (!ensureTrustReady(rangeTrust, "Trust checklist is still loading. Refresh and try again.")) {
      return;
    }
    const blob = new Blob([toCsv(filteredRows, shiftApprovalMap)], { type: "text/csv;charset=utf-8" });
    triggerBlobDownload(blob, `reports-page-${page}.csv`);
  };

  const handleBinaryDownload = async (work: () => Promise<Blob>, filename: string) => {
    setBusy(true);
    setError("");
    setStatus(`Preparing ${filename} and keeping the page interactive...`);
    try {
      const blob = await work();
      triggerBlobDownload(blob, filename);
      setStatus(`Download started: ${filename}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Download failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleJsonExport = async (kind: "weekly" | "monthly") => {
    const trustSummary = kind === "weekly" ? weeklyTrust : monthlyTrust;
    const fallbackMessage = kind === "weekly"
      ? "Weekly trust status is still loading. Refresh and try again."
      : "Monthly trust status is still loading. Refresh and try again.";
    if (!ensureTrustReady(trustSummary, fallbackMessage)) {
      return;
    }
    setBusy(true);
    setError("");
    setStatus(`Preparing the ${kind} summary export...`);
    try {
      const payload = kind === "weekly" ? await getWeeklyExport() : await getMonthlyExport();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      triggerBlobDownload(blob, `${kind}-summary.json`);
      setStatus(`${kind} summary export started.`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Export failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRangeExcelJob = async () => {
    if (!ensureTrustReady(rangeTrust, "Trust checklist is still loading. Refresh and try again.")) {
      return;
    }
    setBusy(true);
    setError("");
    setStatus("Queueing the date-range Excel export...");
    try {
      const job = await startRangeExcelJob(appliedFilters.startDate, appliedFilters.endDate);
      setReportJob(job);
      setStatus("Range export queued. The Jobs drawer can now cancel, retry, or download it from anywhere.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not queue the range export.");
      }
      setBusy(false);
    }
  };

  const handleEntryPdfJob = async (entryId: number) => {
    const row = filteredRows.find((candidate) => candidate.id === entryId);
    if (!ensureTrustReady(rangeTrust, "Trust checklist is still loading. Refresh and try again.")) {
      return;
    }
    if (row && !ensureEntryApproved(row)) {
      return;
    }
    setBusy(true);
    setError("");
    setStatus(`Queueing the PDF export for entry #${entryId}...`);
    try {
      const job = await startEntryPdfJob(entryId);
      setReportJob(job);
      setStatus(`Entry #${entryId} PDF queued. We will download it as soon as it is ready.`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not queue the PDF export.");
      }
      setBusy(false);
    }
  };

  const handleEntryExcelDownload = (row: Entry) => {
    if (!ensureTrustReady(rangeTrust, "Trust checklist is still loading. Refresh and try again.")) {
      return;
    }
    if (!ensureEntryApproved(row)) {
      return;
    }
    void handleBinaryDownload(() => downloadEntryReport(row.id, "excel"), `entry-${row.id}.xlsx`);
  };

  useEffect(() => {
    if (!reportJob || ["succeeded", "failed", "canceled"].includes(reportJob.status)) {
      return undefined;
    }
    const interval = window.setInterval(async () => {
      try {
        const next = await getReportJob(reportJob.job_id);
        setReportJob(next);
        if (next.status === "succeeded" && !completedReportDownloads.current.has(next.job_id)) {
          completedReportDownloads.current.add(next.job_id);
          const blob = await downloadReportJob(next.job_id);
          const fallbackStart = next.context?.start_date || appliedFilters.startDate;
          const fallbackEnd = next.context?.end_date || appliedFilters.endDate;
          const filename = next.result?.file?.filename || `reports-${fallbackStart}-to-${fallbackEnd}.xlsx`;
          triggerBlobDownload(blob, filename);
          setStatus(`Download started: ${filename}`);
          setBusy(false);
        } else if (next.status === "failed") {
          setError(next.error || "Export failed.");
          setBusy(false);
        } else if (next.status === "canceled") {
          setStatus(next.message || "The export was canceled.");
          setBusy(false);
        } else {
          setStatus(next.message || "Export is still running...");
        }
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Could not track export progress.");
        }
        setBusy(false);
      }
    }, 1200);
    return () => window.clearInterval(interval);
  }, [appliedFilters.endDate, appliedFilters.startDate, reportJob]);

  if (loading || (user && !isAccountant && loadingRows && !hasLoadedRows)) {
    return <ReportsPageSkeleton />;
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 shell-bottom-clearance md:pb-8">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-color-danger">{sessionError || "Please login to continue."}</div>
            <Link href="/login">
              <Button>Open Login</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const defaultFilters = buildDefaultFilters();
  const appliedSearch = appliedFilters.search.trim();
  const activeFilterCount = [
    appliedFilters.startDate !== defaultFilters.startDate || appliedFilters.endDate !== defaultFilters.endDate,
    Boolean(appliedFilters.shift),
    appliedFilters.hasIssues !== "any",
    appliedFilters.status !== "any",
    Boolean(appliedSearch),
  ].filter(Boolean).length;
  const mobileFilterBadges = [
    appliedFilters.shift ? `Shift: ${appliedFilters.shift}` : null,
    appliedFilters.status !== "any" ? `Status: ${appliedFilters.status}` : null,
    appliedFilters.hasIssues !== "any"
      ? appliedFilters.hasIssues === "yes"
        ? "Issues only"
        : "No issues only"
      : null,
    appliedSearch ? `Search: ${appliedSearch}` : null,
  ].filter(Boolean) as string[];
  const trustActionHref = pendingOcrDocuments > 0 ? "/ocr/verify" : "/approvals";
  const trustActionLabel = pendingOcrDocuments > 0 ? "Review OCR" : "Open Review Queue";

  const renderFilterControls = (mobile = false) => (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        <Button variant="outline" onClick={() => handleQuickRange("today")}>Today</Button>
        <Button variant="outline" onClick={() => handleQuickRange("week")}>Last 7 Days</Button>
        <Button variant="outline" onClick={() => handleQuickRange("month")}>This Month</Button>
        <Button variant="outline" onClick={resetFilters}>Reset Filters</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className="text-sm text-text-muted">Start Date</label>
          <Input
            type="date"
            value={draftFilters.startDate}
            onChange={(e) => setDraftFilters((current) => ({ ...current, startDate: e.target.value }))}
            className="h-11"
          />
        </div>
        <div>
          <label className="text-sm text-text-muted">End Date</label>
          <Input
            type="date"
            value={draftFilters.endDate}
            onChange={(e) => setDraftFilters((current) => ({ ...current, endDate: e.target.value }))}
            className="h-11"
          />
        </div>
        <div>
          <label className="text-sm text-text-muted">Shift</label>
          <Select
            value={draftFilters.shift}
            onChange={(e) => setDraftFilters((current) => ({ ...current, shift: e.target.value }))}
          >
            <option value="">All Shifts</option>
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
            <option value="night">Night</option>
          </Select>
        </div>
        <div>
          <label className="text-sm text-text-muted">Has Issues</label>
          <Select
            value={draftFilters.hasIssues}
            onChange={(e) => setDraftFilters((current) => ({ ...current, hasIssues: e.target.value as IssueFilter }))}
          >
            <option value="any">Any</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </Select>
        </div>
        <div>
          <label className="text-sm text-text-muted">Status</label>
          <Select
            value={draftFilters.status}
            onChange={(e) => setDraftFilters((current) => ({ ...current, status: e.target.value }))}
          >
            <option value="any">Any</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </Select>
        </div>
        <div className="md:col-span-2">
          <label className="text-sm text-text-muted">Search notes / department</label>
          <Input
            value={draftFilters.search}
            onChange={(e) => setDraftFilters((current) => ({ ...current, search: e.target.value }))}
            placeholder="Search notes, downtime reason, department..."
            className="h-11"
          />
        </div>
        <div>
          <label className="text-sm text-text-muted">Page</label>
          <Input
            type="number"
            min={1}
            max={pageCount}
            value={page}
            onChange={(e) => setPage(Math.max(1, Math.min(pageCount, Number(e.target.value) || 1)))}
            className="h-11"
          />
        </div>
        <div className="grid gap-2 sm:flex sm:items-end">
          <Button
            variant="primary"
            onClick={() => {
              applyFilters();
              if (mobile) setMobileFiltersOpen(false);
            }}
            disabled={loadingRows || isAccountant}
            className="h-11 w-full sm:w-auto"
          >
            {loadingRows && !hasLoadedRows ? "Loading..." : "Apply Filters"}
          </Button>
          <Button
            variant="outline"
            onClick={resetFilters}
            disabled={loadingRows || isAccountant}
            className="h-11 w-full sm:w-auto"
          >
            Reset
          </Button>
        </div>
        <div className="text-xs text-text-muted md:col-span-2 xl:col-span-4">
          Applied range: {appliedFilters.startDate} to {appliedFilters.endDate}
        </div>
      </div>
    </div>
  );

  const exportActions = (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card-elevated p-4 text-sm text-text-muted">
        Use range Excel for shared plant files, JSON for system handoff, and the owner update desk when leadership needs the same reporting story in plain language.
      </div>
      <Button
        variant="outline"
        onClick={handleRangeExcelJob}
        disabled={busy || loadingTrust || !rangeTrust?.can_send}
        className="h-11 w-full sm:w-auto"
      >
        Export Date Range to Excel
      </Button>
      <Button
        variant="outline"
        onClick={() => handleJsonExport("weekly")}
        disabled={busy || loadingTrust || !weeklyTrust?.can_send}
        className="h-11 w-full sm:w-auto"
      >
        Export Weekly Summary JSON
      </Button>
      <Button
        variant="outline"
        onClick={() => handleJsonExport("monthly")}
        disabled={busy || loadingTrust || !monthlyTrust?.can_send}
        className="h-11 w-full sm:w-auto"
      >
        Export Monthly Summary JSON
      </Button>
      {!isAccountant ? (
        <Button
          variant="outline"
          onClick={handleDownloadCurrentPage}
          disabled={!filteredRows.length || loadingTrust || !rangeTrust?.can_send}
          className="h-11 w-full sm:w-auto"
        >
          Export Visible Page CSV
        </Button>
      ) : (
        <div className="rounded-2xl border border-border bg-card-elevated p-4 text-sm text-text-muted">
          Accountant view keeps raw entries hidden, but summary exports still work.
        </div>
      )}
      {!rangeTrust?.can_send && rangeTrust?.blocking_reason ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/12 px-4 py-3 text-xs text-amber-100">
          Range exports blocked: {rangeTrust.blocking_reason}
        </div>
      ) : null}
      {!weeklyTrust?.can_send && weeklyTrust?.blocking_reason ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/12 px-4 py-3 text-xs text-amber-100">
          Weekly JSON blocked: {weeklyTrust.blocking_reason}
        </div>
      ) : null}
      {!monthlyTrust?.can_send && monthlyTrust?.blocking_reason ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/12 px-4 py-3 text-xs text-amber-100">
          Monthly JSON blocked: {monthlyTrust.blocking_reason}
        </div>
      ) : null}
      <div className="grid gap-3 pt-1 sm:flex sm:flex-wrap">
        <Link href="/attendance/reports" className="w-full sm:w-auto">
          <Button variant="ghost" className="w-full sm:w-auto">Attendance Reports</Button>
        </Link>
        <Link href="/email-summary" className="w-full sm:w-auto">
          <Button variant="ghost" className="w-full sm:w-auto">Email Summary</Button>
        </Link>
      </div>
      {reportJob ? (
        <div className="rounded-2xl border border-border bg-card-elevated p-4">
          <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-[0.18em] text-text-muted">
            <span>Range Export Job</span>
            <span>{reportJob.progress}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-color-primary transition-all" style={{ width: progressWidth(reportJob.progress) }} />
          </div>
          <div className="mt-3 text-sm text-text-primary">{reportJob.message}</div>
          {reportJob.status === "failed" && reportJob.error ? (
            <div className="mt-2 text-sm text-color-danger">{reportJob.error}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <main className="min-h-screen bg-bg px-4 py-6 shell-bottom-clearance md:px-8 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="flex flex-col gap-3 rounded-[1.6rem] border border-border bg-card p-4 shadow-2xl backdrop-blur sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-color-primary">Reports</div>
            <h1 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl">Trusted reporting desk</h1>
            <p className="mt-2 hidden max-w-3xl text-sm text-text-muted sm:block">
              Pull daily operations, trusted OCR, and owner-facing summaries into one desk. This page should answer three things fast: what is safe to report, what still needs review, and what format should leave the factory next.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-color-primary/25 bg-color-primary/8 px-3 py-1 text-color-primary-light">
                Trusted outputs only
              </span>
              <span className="rounded-full border border-border bg-card-elevated px-3 py-1 text-text-muted">
                {activeFactory?.name || "Current factory"}
              </span>
              <span className="rounded-full border border-border bg-card-elevated px-3 py-1 text-text-muted">
                {isAccountant ? "Accounts-first view" : "Operations + management view"}
              </span>
            </div>
          </div>
          <div className="grid gap-2 lg:justify-items-end">
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <Link href="/email-summary" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto">Owner Update Desk</Button>
              </Link>
              <Link href="/dashboard" className="hidden sm:block">
                <Button variant="outline">Dashboard</Button>
              </Link>
              <Link href="/entry" className="hidden sm:block">
                <Button variant="outline">New Entry</Button>
              </Link>
            </div>
            {!isAccountant ? (
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Button
                  variant="outline"
                  className="px-4 py-2 text-xs"
                  onClick={handleRefreshAll}
                  disabled={loadingRows || loadingInsights || loadingTrust || refreshing || refreshingInsights}
                >
                  {refreshing || refreshingInsights || loadingTrust ? "Refreshing..." : "Refresh Reports"}
                </Button>
                <span className="hidden text-xs text-[var(--muted)] sm:inline">
                  {refreshing || refreshingInsights || loadingTrust
                    ? "Updating reports, charts, and trust..."
                    : lastUpdatedAt
                      ? `Updated ${formatDateTime(lastUpdatedAt)}`
                      : "Live updates every 40 seconds"}
                </span>
              </div>
            ) : null}
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-color-danger/30 bg-color-danger/10 px-4 py-3 text-sm text-color-danger-light">{error}</div> : null}
        {refreshing || refreshingInsights ? (
          <div className="rounded-2xl border border-border bg-card-elevated px-4 py-3 text-sm text-text-muted">
            Refreshing reports in the background...
          </div>
        ) : null}
        {sessionError ? <div className="rounded-2xl border border-color-danger/30 bg-color-danger/10 px-4 py-3 text-sm text-color-danger-light">{sessionError}</div> : null}

        <Card className="order-1 border border-border bg-card">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm uppercase tracking-[0.22em] text-color-primary-light">Trust status</div>
              <CardTitle className="mt-2 text-xl text-text-primary">Current report period must clear trust before export</CardTitle>
              <div className="mt-2 max-w-3xl text-sm text-text-muted">
                Review gates stay ahead of reporting. When the checklist passes, every exported file carries approver names and timestamps.
              </div>
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <Link href={trustActionHref} className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto">{trustActionLabel}</Button>
              </Link>
              <Link href="/email-summary" className="w-full sm:w-auto">
                <Button variant="ghost" className="w-full sm:w-auto">Owner Update Desk</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <TrustChecklist
              summary={rangeTrust}
              loading={loadingTrust}
              error={trustError}
              title="Current report period"
              description="Date-range exports and row downloads stay locked until OCR, shift entry, and attendance review are all complete."
            />
          </CardContent>
        </Card>

        <Card className="order-2 lg:hidden">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <div className="text-sm text-text-muted">Filters</div>
              <CardTitle className="text-xl text-text-primary">Current report scope</CardTitle>
            </div>
            <Button variant="outline" className="h-11 shrink-0" onClick={() => setMobileFiltersOpen(true)}>
              Filter{activeFilterCount ? ` (${activeFilterCount})` : ""}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border bg-card-elevated p-4 text-sm text-text-muted">
              Range: {appliedFilters.startDate} to {appliedFilters.endDate}
            </div>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <Button variant="outline" onClick={() => handleQuickRange("today")}>Today</Button>
              <Button variant="outline" onClick={() => handleQuickRange("week")}>Last 7 Days</Button>
              <Button variant="outline" onClick={() => handleQuickRange("month")}>This Month</Button>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {mobileFilterBadges.length ? (
                mobileFilterBadges.map((badge) => (
                  <span key={badge} className="rounded-full border border-border bg-card-elevated px-3 py-1 text-text-muted">
                    {badge}
                  </span>
                ))
              ) : (
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/12 px-3 py-1 text-emerald-100">
                  All shifts and statuses are visible
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <section className="order-3 hidden gap-5 lg:grid xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Filter Reports</CardTitle>
            </CardHeader>
            <CardContent>{renderFilterControls()}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Export Reports</CardTitle>
            </CardHeader>
            <CardContent>{exportActions}</CardContent>
          </Card>
        </section>

        <Card className="order-5 lg:hidden">
          <CardHeader>
            <div className="text-sm text-text-muted">Exports</div>
            <CardTitle className="text-xl text-text-primary">Send trusted output</CardTitle>
          </CardHeader>
          <CardContent>{exportActions}</CardContent>
        </Card>

        <div className="order-6">
          <ReportInsightsBoard insights={insights} loading={loadingInsights} role={user.role} steelOverview={steelOverview} />
        </div>

        {ocrSummary ? (
          <Card className="order-7 border border-border bg-card">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.22em] text-color-primary-light">OCR Trust Summary</div>
                <CardTitle className="mt-2 text-xl text-text-primary">Approved OCR is the reporting-safe layer</CardTitle>
                <div className="mt-2 max-w-3xl text-sm text-text-muted">
                  {ocrSummary.trust_note}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/ocr/verify">
                  <Button variant="outline">Open Review Documents</Button>
                </Link>
                <Link href="/approvals">
                  <Button variant="ghost">Open Review Queue</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-color-primary/20 bg-card-elevated p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-color-primary-light">Approved Docs</div>
                <div className="mt-2 text-2xl font-semibold text-text-primary">{ocrSummary.trusted_documents}</div>
              </div>
              <div className="rounded-2xl border border-color-primary/20 bg-card-elevated p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-color-primary-light">Trusted Rows</div>
                <div className="mt-2 text-2xl font-semibold text-text-primary">{ocrSummary.trusted_rows}</div>
              </div>
              <div className="rounded-2xl border border-color-warning/20 bg-card-elevated p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-color-warning-light">Pending Review</div>
                <div className="mt-2 text-2xl font-semibold text-text-primary">{ocrSummary.pending_documents}</div>
              </div>
              <div className="rounded-2xl border border-border bg-card-elevated p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-text-muted">Last Trusted Approval</div>
                <div className="mt-2 text-lg font-semibold text-text-primary">{formatDateTime(ocrSummary.last_trusted_at || undefined)}</div>
                <div className="mt-1 text-xs text-text-muted">
                  Approval rate: {ocrSummary.approval_rate != null ? `${ocrSummary.approval_rate}%` : "-"}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <section className="order-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {reportHubCards.map((card) => (
            <Card key={card.title} className="border border-border bg-card">
              <CardHeader>
                <div className="text-xs uppercase tracking-[0.22em] text-color-primary">{card.eyebrow}</div>
                <CardTitle className="text-xl text-text-primary">{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-2xl font-semibold text-text-primary">{card.metric}</div>
                <div className="text-sm leading-6 text-text-muted">{card.detail}</div>
                <Link href={card.href}>
                  <Button variant="outline">{card.action}</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="order-9">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm text-text-muted">Owner updates</div>
              <CardTitle className="text-xl text-text-primary">Executive AI Summary</CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="h-11 lg:hidden"
                onClick={() => setMobileAiExpanded((current) => !current)}
              >
                {mobileAiExpanded ? "Hide AI Summary" : "Show AI Summary"}
              </Button>
              <Link href="/email-summary" className="hidden lg:block">
                <Button variant="outline" className="h-11">Open Owner Update Desk</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className={mobileAiExpanded ? "block" : "hidden lg:block"}>
            <AiActivationNotice
              eyebrow="AI summary gate"
              support="Use trusted exports and the owner update desk while the executive AI summary lane finishes activating for this workspace."
              primaryAction={{ href: "/email-summary", label: "Open Owner Update Desk" }}
              secondaryAction={{ href: "/premium/dashboard?notice=ai-coming-soon", label: "Open Owner Desk", variant: "outline" }}
            />
          </CardContent>
        </Card>

      {!isAccountant ? (
        <Card className="order-4">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm text-text-muted">Results</div>
              <CardTitle className="text-xl text-text-primary">{filteredRows.length} rows on this page</CardTitle>
            </div>
            <div className="text-sm text-text-muted">
              Page {page} of {pageCount} - total {total}
            </div>
          </CardHeader>
          <CardContent>
            {loadingRows && hasLoadedRows ? (
              <div className="mb-3 rounded-2xl border border-border bg-card-elevated px-4 py-2 text-xs text-text-muted">
                Updating rows...
              </div>
            ) : null}
            {loadingRows && !hasLoadedRows ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : filteredRows.length ? (
              <>
                <div className="space-y-3 md:hidden">
                  {filteredRows.map((row) => (
                    <div key={`card:${row.id}`} className="rounded-2xl border border-border bg-card-elevated p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-text-primary">{row.date}</div>
                          <div className="mt-1 text-xs text-text-muted">
                            {row.shift} · {row.department || "-"}
                          </div>
                        </div>
                        <div className="rounded-full border border-border px-3 py-1 text-xs text-text-muted">
                          {row.status}
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="text-xs text-text-muted">Units</div>
                          <div className="mt-1 text-sm font-semibold text-text-primary">
                            {row.units_produced} / {row.units_target}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-text-muted">Submitted</div>
                          <div className="mt-1 text-sm text-text-primary">{formatDateTime(row.created_at)}</div>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:flex sm:flex-wrap">
                        <Link href={`/entry/${row.id}`} className="w-full sm:w-auto">
                          <Button variant="outline" className="w-full sm:w-auto">Open</Button>
                        </Link>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full sm:w-auto"
                          disabled={busy || loadingTrust || !rangeTrust?.can_send || row.status !== "approved"}
                          onClick={() => handleEntryPdfJob(row.id)}
                        >
                          PDF
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full sm:w-auto"
                          disabled={busy || loadingTrust || !rangeTrust?.can_send || row.status !== "approved"}
                          onClick={() => handleEntryExcelDownload(row)}
                        >
                          Excel
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full text-left text-sm">
                  <thead className="text-text-muted">
                    <tr className="border-b border-border">
                      <th className="px-3 py-3 font-medium">Date</th>
                      <th className="px-3 py-3 font-medium">Shift</th>
                      <th className="px-3 py-3 font-medium">Department</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 font-medium">Units</th>
                      <th className="px-3 py-3 font-medium">Submitted</th>
                      <th className="px-3 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.id} className="border-b border-border/60 hover:bg-card-elevated transition-colors">
                        <td className="px-3 py-3 text-text-primary">{row.date}</td>
                        <td className="px-3 py-3 text-text-primary">{row.shift}</td>
                        <td className="px-3 py-3 text-text-primary">{row.department || "-"}</td>
                        <td className="px-3 py-3 text-text-primary">{row.status}</td>
                        <td className="px-3 py-3 text-text-primary">
                          {row.units_produced} / {row.units_target}
                        </td>
                        <td className="px-3 py-3 text-text-muted">{formatDateTime(row.created_at)}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-3">
                            <Link href={`/entry/${row.id}`} className="text-color-primary underline underline-offset-4 hover:text-color-primary-light">
                              Open
                            </Link>
                            <button
                              type="button"
                              className="text-color-primary underline underline-offset-4 hover:text-color-primary-light disabled:cursor-not-allowed disabled:no-underline disabled:opacity-45"
                              disabled={busy || loadingTrust || !rangeTrust?.can_send || row.status !== "approved"}
                              onClick={() => handleEntryPdfJob(row.id)}
                            >
                              PDF
                            </button>
                            <button
                              type="button"
                              className="text-color-primary underline underline-offset-4 hover:text-color-primary-light disabled:cursor-not-allowed disabled:no-underline disabled:opacity-45"
                              disabled={busy || loadingTrust || !rangeTrust?.can_send || row.status !== "approved"}
                              onClick={() => handleEntryExcelDownload(row)}
                            >
                              Excel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="space-y-4 rounded-2xl border border-border bg-card-elevated p-4 text-sm text-text-muted">
                <div>No entries found for the selected filters.</div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={resetFilters} className="h-11">
                    Reset Filters
                  </Button>
                  <Button variant="outline" onClick={() => handleQuickRange("week")} className="h-11">
                    Last 7 Days
                  </Button>
                  <Link href="/entry">
                    <Button variant="outline" className="h-11">Open Entry Form</Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {mobileFiltersOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[51] bg-[rgba(4,8,16,0.78)] lg:hidden"
            aria-label="Close report filters"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Report filters"
            className="fixed inset-x-0 bottom-0 z-[52] max-h-[85vh] overflow-y-auto rounded-t-[2rem] border border-border bg-card px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-5 shadow-2xl lg:hidden"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-4">
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-[0.18em] text-text-muted">Filter reports</div>
                <div className="text-lg font-semibold text-text-primary">Adjust range and advanced filters</div>
                <div className="text-sm text-text-muted">
                  Date range, status, issue flags, and search stay in this drawer so trusted reporting actions remain above the fold.
                </div>
              </div>
              <Button variant="ghost" className="px-3 py-2 text-xs" onClick={() => setMobileFiltersOpen(false)}>
                Close
              </Button>
            </div>
            <div className="pt-4">
              {renderFilterControls(true)}
            </div>
          </div>
        </>
      ) : null}

      {status ? <div className="text-sm text-color-success">{status}</div> : null}
      {error || sessionError ? <div className="text-sm text-color-danger">{error || sessionError}</div> : null}
    </div>
    </main >
  );
}
