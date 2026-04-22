"use client";

import dynamic from "next/dynamic";
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
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { useSession } from "@/lib/use-session";
import { ReportsPageSkeleton } from "@/components/page-skeletons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const ReportInsightsBoard = dynamic(() => import("@/components/report-insights-board"), {
  loading: () => <Skeleton className="h-[36rem] w-full rounded-[2rem]" />,
});

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
  const { t } = useI18n();
  useI18nNamespaces(["common", "reports"]);
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
        action: "Attendance",
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
        action: pendingOcrDocuments > 0 ? "Review OCR" : "Review Queue",
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
        action: "Email Desk",
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

  const activeAdvancedFilterCount = useMemo(
    () =>
      [
        draftFilters.shift,
        draftFilters.search.trim(),
        draftFilters.status !== "any" ? draftFilters.status : "",
        draftFilters.hasIssues !== "any" ? draftFilters.hasIssues : "",
      ].filter(Boolean).length,
    [draftFilters.hasIssues, draftFilters.search, draftFilters.shift, draftFilters.status],
  );

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
            <CardTitle>{t("reports.title", "Reports")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || t("reports.sign_in_required", "Please sign in to continue.")}</div>
            {/* AUDIT: FLOW_BROKEN - Signed-out recovery should route through the current auth entry instead of a legacy login path. */}
            <Link href="/access">
              <Button>{t("dashboard.action.open_login", "Open Access")}</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8" data-component="reports-page">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* AUDIT: FLOW_BROKEN - Added a simple export journey so the page reads like pick range, export, then inspect secondary reporting lanes. */}
        <section className="grid gap-4 md:grid-cols-3">
          {[
            { step: "1", title: t("reports.steps.range", "Pick range"), detail: t("reports.steps.range_detail", "Set the window and apply the range you want to report.") },
            { step: "2", title: t("reports.steps.export", "Export report"), detail: t("reports.steps.export_detail", "Queue the main export first, then choose secondary formats if needed.") },
            { step: "3", title: t("reports.steps.share", "Share update"), detail: t("reports.steps.share_detail", "Use the connected summary lanes only after trust checks are clear.") },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] px-5 py-4 shadow-[var(--shadow-soft)]"
            >
              <div className="text-[0.65rem] uppercase tracking-[0.28em] text-[var(--accent)]">{t("common.step", "Step")} {item.step}</div>
              <div className="mt-2 font-semibold text-[var(--text)]">{item.title}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{item.detail}</div>
            </div>
          ))}
        </section>

        <section className="flex flex-wrap items-start justify-between gap-4 rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur">
          <div>
            <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">{t("reports.title", "Reports")}</div>
            <h1 className="mt-2 text-3xl font-semibold">{t("reports.hero.title", "Export trusted factory reports fast")}</h1>
            {/* AUDIT: TEXT_NOISE - The hero now states the outcome once and lets the step strip explain the workflow. */}
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              {t("reports.hero.subtitle", "Pull the reporting window, confirm trust, and queue the format that needs to leave the factory next.")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-cyan-400/25 bg-[rgba(34,211,238,0.08)] px-3 py-1 text-cyan-100">
                {t("reports.hero.trusted_outputs", "Trusted outputs only")}
              </span>
              <span className="rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] px-3 py-1 text-[var(--muted)]">
                {activeFactory?.name || t("reports.hero.current_factory", "Current factory")}
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              {/* AUDIT: BUTTON_CLUTTER - Kept the main export launch visible and moved route-jump utilities into a compact tray. */}
              <Button onClick={handleRangeExcelJob} disabled={busy}>
                {busy ? t("reports.actions.working", "Working...") : t("reports.actions.export_excel", "Export Excel")}
              </Button>
              <details className="rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--muted)]">
                <summary className="cursor-pointer list-none">{t("reports.actions.more", "More")}</summary>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/dashboard">
                    <Button variant="outline">{t("reports.actions.dashboard", "Dashboard")}</Button>
                  </Link>
                  <Link href="/email-summary">
                    <Button variant="outline">{t("reports.actions.email_desk", "Email Desk")}</Button>
                  </Link>
                  <Link href="/entry">
                    <Button variant="outline">{t("reports.actions.new_entry", "New Entry")}</Button>
                  </Link>
                </div>
              </details>
            </div>
            {!isAccountant ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className="px-4 py-2 text-xs"
                  onClick={handleRefreshAll}
                  disabled={loadingRows || loadingInsights || refreshing || refreshingInsights}
                >
                  {refreshing || refreshingInsights ? t("reports.actions.refreshing", "Refreshing...") : t("reports.actions.refresh", "Refresh")}
                </Button>
                <span className="text-xs text-[var(--muted)]">
                  {refreshing || refreshingInsights
                    ? t("reports.actions.updating", "Updating reports...")
                    : lastUpdatedAt
                      ? t("reports.actions.updated", "Updated {{value}}", { value: formatDateTime(lastUpdatedAt) })
                      : t("reports.actions.live_updates", "Live updates every 40 seconds")}
                </span>
              </div>
            ) : null}
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{error}</div> : null}
        {refreshing || refreshingInsights ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-3 text-sm text-[var(--muted)]">
            {t("reports.refreshing_background", "Refreshing reports in the background...")}
          </div>
        ) : null}
        {sessionError ? <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">{sessionError}</div> : null}

        {/* AUDIT: BUTTON_CLUTTER - Cross-product routes and deeper reporting lanes stay available, but they no longer compete with the export desk on first scan. */}
        <details className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-soft)]">
          <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)]">Connected lanes</summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
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
          </div>
        </details>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">{t("reports.step_one", "Step 1")}</div>
                <CardTitle className="mt-2 text-xl">{t("reports.pick_range", "Pick range")}</CardTitle>
              </div>
              {/* AUDIT: TEXT_NOISE - Quick range controls stay visible, but the labels are shortened so they scan as presets rather than helper text. */}
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => handleQuickRange("today")}>Today</Button>
                <Button variant="outline" onClick={() => handleQuickRange("week")}>Last 7d</Button>
                <Button variant="outline" onClick={() => handleQuickRange("month")}>This Month</Button>
                <Button variant="outline" onClick={resetFilters}>Reset</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
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
                <div className="flex items-end gap-2">
                  <Button onClick={applyFilters} disabled={loadingRows || isAccountant}>
                    {loadingRows && !hasLoadedRows ? "Loading..." : "Apply"}
                  </Button>
                  <Button variant="ghost" onClick={resetFilters} disabled={loadingRows || isAccountant}>
                    Reset
                  </Button>
                </div>
              </div>
              {/* AUDIT: DENSITY_OVERLOAD - Less common filters stay on the screen, but they now live in a compact advanced tray instead of crowding the main export range. */}
              <details className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)]">
                  Advanced filters{activeAdvancedFilterCount ? ` (${activeAdvancedFilterCount} active)` : ""}
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                  <div className="md:col-span-2 xl:col-span-1">
                    <label className="text-sm text-[var(--muted)]">Search</label>
                    <Input
                      value={draftFilters.search}
                      onChange={(e) => setDraftFilters((current) => ({ ...current, search: e.target.value }))}
                      placeholder="Notes, downtime, department"
                    />
                  </div>
                </div>
              </details>
              <div className="text-xs text-[var(--muted)]">
                Applied range: {appliedFilters.startDate} to {appliedFilters.endDate}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">{t("reports.step_two", "Step 2")}</div>
              <CardTitle className="mt-2 text-xl">{t("reports.export_report", "Export report")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* AUDIT: TEXT_NOISE - The export desk now leads with one short instruction instead of explaining every downstream reporting lane up front. */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                Queue the range Excel first, then use secondary formats only when that is the real need.
              </div>
              <Button onClick={handleRangeExcelJob} disabled={busy}>
                {busy ? "Working..." : "Export Excel"}
              </Button>
              {/* AUDIT: BUTTON_CLUTTER - Alternate export formats and follow-on routes stay available, but they no longer compete with the main range export. */}
              <details className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)]">{t("reports.more_exports", "More exports")}</summary>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="outline" onClick={() => handleJsonExport("weekly")} disabled={busy}>
                    Weekly JSON
                  </Button>
                  <Button variant="outline" onClick={() => handleJsonExport("monthly")} disabled={busy}>
                    Monthly JSON
                  </Button>
                  {!isAccountant ? (
                    <Button variant="ghost" onClick={handleDownloadCurrentPage} disabled={!filteredRows.length}>
                      Visible CSV
                    </Button>
                  ) : null}
                  <Link href="/attendance/reports">
                    <Button variant="ghost">Attendance</Button>
                  </Link>
                  <Link href="/email-summary">
                    <Button variant="ghost">Email Desk</Button>
                  </Link>
                </div>
                {isAccountant ? (
                  <div className="mt-4 text-sm text-[var(--muted)]">
                    Accountant view keeps raw entries hidden, but summary exports still work.
                  </div>
                ) : null}
              </details>
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

        {/* AUDIT: DENSITY_OVERLOAD - Trust and analysis surfaces remain available, but they now sit behind one reveal so the range and export desk lead the screen. */}
        <details className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-soft)]">
          <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)]">{t("reports.trust_insights", "Trust and insights")}</summary>
          <div className="mt-4 space-y-6">
            <ReportInsightsBoard insights={insights} loading={loadingInsights} role={user.role} steelOverview={steelOverview} />
            {ocrSummary ? (
              <Card className="border-cyan-400/20 bg-[rgba(18,24,36,0.92)]">
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm uppercase tracking-[0.22em] text-cyan-200">OCR Trust</div>
                    <CardTitle className="mt-2 text-xl">Approved OCR is reporting-safe</CardTitle>
                    <div className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
                      {ocrSummary.trust_note}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/ocr/verify">
                      <Button variant="outline">Review OCR</Button>
                    </Link>
                    <Link href="/approvals">
                      <Button variant="ghost">Review Queue</Button>
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
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Last Approval</div>
                    <div className="mt-2 text-lg font-semibold text-white">{formatDateTime(ocrSummary.last_trusted_at || undefined)}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      Approval rate: {ocrSummary.approval_rate != null ? `${ocrSummary.approval_rate}%` : "-"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </details>

        {/* AUDIT: BUTTON_CLUTTER - The AI summary stays available as a secondary reporting lane instead of competing with the main export action. */}
        <details className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-soft)]">
          <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)]">{t("reports.executive_summary", "Executive summary")}</summary>
          <div className="mt-4">
            <Card>
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-xl">AI summary</CardTitle>
                </div>
                <Button variant="outline" onClick={handleExecutiveSummary} disabled={executiveBusy}>
                  {executiveBusy ? "Generating..." : "Generate Summary"}
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
          </div>
        </details>

        {!isAccountant ? (
          <Card>
            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm text-[var(--muted)]">{t("reports.results", "Results")}</div>
                <CardTitle className="text-xl">{filteredRows.length} rows on this page</CardTitle>
              </div>
              {/* AUDIT: FLOW_BROKEN - Page navigation now lives with the result set instead of interrupting the main filter workflow above. */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-[var(--muted)]">Page {page} of {pageCount}</span>
                <Button
                  variant="outline"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                >
                  Prev
                </Button>
                <Input
                  className="w-20"
                  type="number"
                  min={1}
                  max={pageCount}
                  value={page}
                  onChange={(e) => setPage(Math.max(1, Math.min(pageCount, Number(e.target.value) || 1)))}
                />
                <Button
                  variant="outline"
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  disabled={page >= pageCount}
                >
                  Next
                </Button>
                <span className="text-sm text-[var(--muted)]">Total {total}</span>
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
                <ResponsiveScrollArea debugLabel="reports-results-table">
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
                </ResponsiveScrollArea>
              ) : (
                <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  <div>No entries match this range.</div>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={resetFilters}>
                      Reset
                    </Button>
                    <Button variant="ghost" onClick={() => handleQuickRange("week")}>
                      Last 7d
                    </Button>
                    <Link href="/entry">
                      <Button variant="ghost">Open Entry</Button>
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
