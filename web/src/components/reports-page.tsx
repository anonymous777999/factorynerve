"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getAiJob,
  startExecutiveSummaryJob,
  type AiJob,
  type ExecutiveSummaryResponse,
} from "@/lib/ai";
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
import { getOcrVerificationSummary, type OcrVerificationSummary } from "@/lib/ocr";
import { getSteelOverview, type SteelOverview } from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import ReportInsightsBoard from "@/components/report-insights-board";
import { ReportsPageSkeleton } from "@/components/page-skeletons";
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

function toCsv(rows: Entry[]) {
  const headers = ["id", "date", "shift", "department", "status", "units_target", "units_produced", "downtime_minutes", "notes"];
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape((row as Record<string, unknown>)[header])).join(","))].join("\n");
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
  const [executiveSummary, setExecutiveSummary] = useState<ExecutiveSummaryResponse | null>(null);
  const [executiveBusy, setExecutiveBusy] = useState(false);
  const [reportJob, setReportJob] = useState<ReportJob | null>(null);
  const [summaryJob, setSummaryJob] = useState<AiJob | null>(null);
  const completedReportDownloads = useRef<Set<string>>(new Set());
  const completedSummaryJobs = useRef<Set<string>>(new Set());
  const presetAppliedRef = useRef(false);

  const isAccountant = user?.role === "accountant";
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const trustedOcrDocuments = ocrSummary?.trusted_documents ?? 0;
  const pendingOcrDocuments = ocrSummary?.pending_documents ?? 0;
  const pendingTrustedWork = pendingOcrDocuments + (steelOverview ? Number(steelOverview.confidence_counts.red || 0) : 0);

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
    setLastUpdatedAt(null);
    setHasLoadedRows(false);
    setRefreshing(false);
    setRefreshingInsights(false);
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
    if (!user || isAccountant || !hasLoadedRows) return;
    const refreshAll = () => {
      if (!document.hidden) {
        void Promise.all([
          loadRows({ background: true }),
          loadInsights({ background: true }),
        ]);
      }
    };
    const timer = window.setInterval(refreshAll, AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", refreshAll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshAll);
    };
  }, [hasLoadedRows, isAccountant, loadInsights, loadRows, user]);

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
        metric: executiveSummary?.provider ? `${executiveSummary.provider} summary ready` : "Owner summary lane",
        detail:
          activeFactory?.industry_type === "steel"
            ? pendingTrustedWork > 0
              ? `Steel risk and pending trust checks are still active (${pendingTrustedWork.toLocaleString("en-IN")} items), so use the outbound summary after those are acknowledged.`
              : "Pair exports with owner risk wording so dispatch, stock, and leakage exposure are visible in the same story."
            : "Move from report filters to AI summary or outbound update without rewriting the same factory story by hand.",
        href: "/email-summary",
        action: "Open Email Summary",
      },
    ];

    return cards;
  }, [
    activeFactory?.industry_type,
    appliedFilters.endDate,
    appliedFilters.startDate,
    executiveSummary?.provider,
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
    ]);
  };
  const handleDownloadCurrentPage = () => {
    const blob = new Blob([toCsv(filteredRows)], { type: "text/csv;charset=utf-8" });
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

  const handleExecutiveSummary = async () => {
    setExecutiveBusy(true);
    setError("");
    setStatus("Queueing an executive summary for the selected date range...");
    try {
      const job = await startExecutiveSummaryJob(appliedFilters.startDate, appliedFilters.endDate);
      setSummaryJob(job);
      setStatus("Executive summary job queued. You can track or retry it from the Jobs drawer if needed.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not generate executive summary.");
      }
      setExecutiveBusy(false);
    }
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

  useEffect(() => {
    if (!summaryJob || ["succeeded", "failed", "canceled"].includes(summaryJob.status)) {
      return undefined;
    }
    const interval = window.setInterval(async () => {
      try {
        const next = await getAiJob(summaryJob.job_id);
        setSummaryJob(next);
        if (next.status === "succeeded" && next.result && !completedSummaryJobs.current.has(next.job_id)) {
          completedSummaryJobs.current.add(next.job_id);
          setExecutiveSummary(next.result);
          setStatus(`Executive summary generated with ${next.result.provider}.`);
          setExecutiveBusy(false);
        } else if (next.status === "failed") {
          setError(next.error || "Executive summary failed.");
          setExecutiveBusy(false);
        } else if (next.status === "canceled") {
          setStatus(next.message || "Executive summary was canceled.");
          setExecutiveBusy(false);
        } else {
          setStatus(next.message || "Executive summary is still running...");
        }
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("Could not track executive summary progress.");
        }
        setExecutiveBusy(false);
      }
    }, 1200);
    return () => window.clearInterval(interval);
  }, [summaryJob]);

  if (loading || (user && !isAccountant && loadingRows && !hasLoadedRows)) {
    return <ReportsPageSkeleton />;
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Reports</CardTitle>
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

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-wrap items-start justify-between gap-4 rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur">
          <div>
            <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Reports</div>
            <h1 className="mt-2 text-3xl font-semibold">Reporting hub for trusted factory output</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Pull daily operations, trusted OCR, and owner-facing summaries into one desk. This page should answer three things fast: what is safe to report, what still needs review, and what format should leave the factory next.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-cyan-400/25 bg-[rgba(34,211,238,0.08)] px-3 py-1 text-cyan-100">
                Trusted outputs only
              </span>
              <span className="rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[var(--muted)]">
                {activeFactory?.name || "Current factory"}
              </span>
              <span className="rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[var(--muted)]">
                {isAccountant ? "Accounts-first view" : "Operations + management view"}
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard">
                <Button variant="outline">Dashboard</Button>
              </Link>
              <Link href="/email-summary">
                <Button>Owner Update Desk</Button>
              </Link>
              <Link href="/entry">
                <Button variant="outline">New Entry</Button>
              </Link>
            </div>
            {!isAccountant ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="px-4 py-2 text-xs"
                  onClick={handleRefreshAll}
                  disabled={loadingRows || loadingInsights || refreshing || refreshingInsights}
                >
                  {refreshing || refreshingInsights ? "Refreshing..." : "Refresh Reports"}
                </Button>
                <span className="text-xs text-[var(--muted)]">
                  {refreshing || refreshingInsights
                    ? "Updating reports and charts..."
                    : lastUpdatedAt
                      ? `Updated ${formatDateTime(lastUpdatedAt)}`
                      : "Live updates every 40 seconds"}
                </span>
              </div>
            ) : null}
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{error}</div> : null}
        {refreshing || refreshingInsights ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-3 text-sm text-[var(--muted)]">
            Refreshing reports in the background...
          </div>
        ) : null}
        {sessionError ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{sessionError}</div> : null}

        <section className="grid gap-4 lg:grid-cols-3">
          {reportHubCards.map((card) => (
            <Card key={card.title} className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
              <CardHeader>
                <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">{card.eyebrow}</div>
                <CardTitle className="text-xl">{card.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-2xl font-semibold">{card.metric}</div>
                <div className="text-sm leading-6 text-[var(--muted)]">{card.detail}</div>
                <Link href={card.href}>
                  <Button variant="outline">{card.action}</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Quick Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => handleQuickRange("today")}>Today</Button>
            <Button variant="outline" onClick={() => handleQuickRange("week")}>Last 7 Days</Button>
            <Button variant="outline" onClick={() => handleQuickRange("month")}>This Month</Button>
            <Button variant="outline" onClick={resetFilters}>Reset Filters</Button>
          </CardContent>
        </Card>

        <ReportInsightsBoard insights={insights} loading={loadingInsights} role={user.role} steelOverview={steelOverview} />

        {ocrSummary ? (
          <Card className="border-cyan-400/20 bg-[rgba(18,24,36,0.92)]">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.22em] text-cyan-200">OCR Trust Summary</div>
                <CardTitle className="mt-2 text-xl">Approved OCR is the reporting-safe layer</CardTitle>
                <div className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
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
              <div className="rounded-2xl border border-cyan-400/20 bg-[rgba(6,14,22,0.55)] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Approved Docs</div>
                <div className="mt-2 text-2xl font-semibold text-white">{ocrSummary.trusted_documents}</div>
              </div>
              <div className="rounded-2xl border border-cyan-400/20 bg-[rgba(6,14,22,0.55)] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Trusted Rows</div>
                <div className="mt-2 text-2xl font-semibold text-white">{ocrSummary.trusted_rows}</div>
              </div>
              <div className="rounded-2xl border border-amber-400/20 bg-[rgba(28,20,8,0.42)] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-amber-100/80">Pending Review</div>
                <div className="mt-2 text-2xl font-semibold text-white">{ocrSummary.pending_documents}</div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Last Trusted Approval</div>
                <div className="mt-2 text-lg font-semibold text-white">{formatDateTime(ocrSummary.last_trusted_at || undefined)}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  Approval rate: {ocrSummary.approval_rate != null ? `${ocrSummary.approval_rate}%` : "-"}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Filter Reports</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="text-sm text-[var(--muted)]">Start Date</label>
                <Input
                  type="date"
                  value={draftFilters.startDate}
                  onChange={(e) => setDraftFilters((current) => ({ ...current, startDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">End Date</label>
                <Input
                  type="date"
                  value={draftFilters.endDate}
                  onChange={(e) => setDraftFilters((current) => ({ ...current, endDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Shift</label>
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
                <label className="text-sm text-[var(--muted)]">Has Issues</label>
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
                <label className="text-sm text-[var(--muted)]">Status</label>
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
                <label className="text-sm text-[var(--muted)]">Search notes / department</label>
                <Input
                  value={draftFilters.search}
                  onChange={(e) => setDraftFilters((current) => ({ ...current, search: e.target.value }))}
                  placeholder="Search notes, downtime reason, department..."
                />
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Page</label>
                <Input
                  type="number"
                  min={1}
                  max={pageCount}
                  value={page}
                  onChange={(e) => setPage(Math.max(1, Math.min(pageCount, Number(e.target.value) || 1)))}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={applyFilters} disabled={loadingRows || isAccountant}>
                  {loadingRows && !hasLoadedRows ? "Loading..." : "Apply Filters"}
                </Button>
                <Button variant="ghost" onClick={resetFilters} disabled={loadingRows || isAccountant}>
                  Reset
                </Button>
              </div>
              <div className="md:col-span-2 xl:col-span-4 text-xs text-[var(--muted)]">
                Applied range: {appliedFilters.startDate} to {appliedFilters.endDate}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Quick Exports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                Use range Excel for shared plant files, JSON for system handoff, and the executive summary or email desk when leadership needs the same reporting story in plain language.
              </div>
              <Button variant="outline" onClick={handleRangeExcelJob} disabled={busy}>
                Export Date Range to Excel
              </Button>
              <Button variant="outline" onClick={() => handleJsonExport("weekly")} disabled={busy}>
                Export Weekly Summary JSON
              </Button>
              <Button variant="outline" onClick={() => handleJsonExport("monthly")} disabled={busy}>
                Export Monthly Summary JSON
              </Button>
              {!isAccountant ? (
                <Button variant="ghost" onClick={handleDownloadCurrentPage} disabled={!filteredRows.length}>
                  Export Visible Page CSV
                </Button>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  Accountant view keeps raw entries hidden, but summary exports still work.
                </div>
              )}
              <div className="flex flex-wrap gap-3 pt-1">
                <Link href="/attendance/reports">
                  <Button variant="ghost">Attendance Reports</Button>
                </Link>
                <Link href="/email-summary">
                  <Button variant="ghost">Email Summary</Button>
                </Link>
              </div>
              {reportJob ? (
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-4">
                  <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    <span>Range Export Job</span>
                    <span>{reportJob.progress}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: progressWidth(reportJob.progress) }} />
                  </div>
                  <div className="mt-3 text-sm text-[var(--text)]">{reportJob.message}</div>
                  {reportJob.status === "failed" && reportJob.error ? (
                    <div className="mt-2 text-sm text-red-400">{reportJob.error}</div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm text-[var(--muted)]">Phase 7</div>
              <CardTitle className="text-xl">Executive AI Summary</CardTitle>
            </div>
            <Button variant="outline" onClick={handleExecutiveSummary} disabled={executiveBusy}>
              {executiveBusy ? "Generating..." : "Generate Executive Summary"}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Summary</div>
              <div className="mt-3 text-sm leading-7 text-[var(--text)]">
                {executiveSummary?.summary || "Generate a management summary for the currently selected date range."}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,16,26,0.72)] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Metrics</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-[var(--muted)]">Units</div>
                  <div className="mt-1 text-lg font-semibold">{executiveSummary?.metrics?.total_units ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--muted)]">Target</div>
                  <div className="mt-1 text-lg font-semibold">{executiveSummary?.metrics?.total_target ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--muted)]">Performance</div>
                  <div className="mt-1 text-lg font-semibold">
                    {executiveSummary?.metrics?.average_performance != null ? `${executiveSummary.metrics.average_performance}%` : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--muted)]">Downtime</div>
                  <div className="mt-1 text-lg font-semibold">{executiveSummary?.metrics?.total_downtime ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--muted)]">Best Shift</div>
                  <div className="mt-1 text-lg font-semibold capitalize">{String(executiveSummary?.metrics?.best_shift || "-")}</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--muted)]">Provider</div>
                  <div className="mt-1 text-lg font-semibold">{executiveSummary?.provider || "-"}</div>
                </div>
              </div>
              {summaryJob ? (
                <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-4">
                  <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    <span>Summary Job</span>
                    <span>{summaryJob.progress}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: progressWidth(summaryJob.progress) }} />
                  </div>
                  <div className="mt-3 text-sm text-[var(--text)]">{summaryJob.message}</div>
                  {summaryJob.status === "failed" && summaryJob.error ? (
                    <div className="mt-2 text-sm text-red-400">{summaryJob.error}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {!isAccountant ? (
          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm text-[var(--muted)]">Results</div>
                <CardTitle className="text-xl">{filteredRows.length} rows on this page</CardTitle>
              </div>
              <div className="text-sm text-[var(--muted)]">
                Page {page} of {pageCount} - total {total}
              </div>
            </CardHeader>
            <CardContent>
              {loadingRows && hasLoadedRows ? (
                <div className="mb-3 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-2 text-xs text-[var(--muted)]">
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
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
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
                        <tr key={row.id} className="border-b border-[var(--border)]/60">
                          <td className="px-3 py-3">{row.date}</td>
                          <td className="px-3 py-3">{row.shift}</td>
                          <td className="px-3 py-3">{row.department || "-"}</td>
                          <td className="px-3 py-3">{row.status}</td>
                          <td className="px-3 py-3">
                            {row.units_produced} / {row.units_target}
                          </td>
                          <td className="px-3 py-3 text-[var(--muted)]">{formatDateTime(row.created_at)}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-3">
                              <Link href={`/entry/${row.id}`} className="text-[var(--accent)] underline underline-offset-4">
                                Open
                              </Link>
                              <button
                                type="button"
                                className="text-[var(--accent)] underline underline-offset-4"
                                onClick={() => handleEntryPdfJob(row.id)}
                              >
                                PDF
                              </button>
                              <button
                                type="button"
                                className="text-[var(--accent)] underline underline-offset-4"
                                onClick={() => handleBinaryDownload(() => downloadEntryReport(row.id, "excel"), `entry-${row.id}.xlsx`)}
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
              ) : (
                <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  <div>No entries found for the selected filters.</div>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={resetFilters}>
                      Reset Filters
                    </Button>
                    <Button variant="ghost" onClick={() => handleQuickRange("week")}>
                      Last 7 Days
                    </Button>
                    <Link href="/entry">
                      <Button variant="ghost">Open Entry Form</Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {status ? <div className="text-sm text-green-400">{status}</div> : null}
        {error || sessionError ? <div className="text-sm text-red-400">{error || sessionError}</div> : null}
      </div>
    </main>
  );
}
