import { apiFetch, ApiError } from "@/lib/api";
import { transferBlob, type BlobTransferResult } from "@/lib/blob-transfer";

export type ReportRangeSummary = {
  entry_id?: number;
  date: string;
  shift: string;
  status?: string;
  approved_by_name?: string | null;
  approved_at?: string | null;
  units_produced: number;
  units_target: number;
};

export type ReportInsightEmployee = {
  user_id: number;
  name: string;
  entries_count: number;
  units_produced: number;
  units_target: number;
  performance_percent: number;
  attendance_percent?: number;
  downtime_minutes: number;
  quality_issue_entries: number;
  attention_score: number;
  reason?: string;
};

export type ReportInsights = {
  range: {
    start_date: string;
    end_date: string;
    days: number;
  };
  totals: {
    entry_count: number;
    total_units_produced: number;
    total_units_target: number;
    performance_percent: number;
    total_downtime_minutes: number;
    quality_issue_entries: number;
    active_people: number;
    attendance_percent: number;
  };
  daily_series: Array<{
    date: string;
    units_produced: number;
    units_target: number;
    performance_percent: number;
    downtime_minutes: number;
    quality_issue_entries: number;
    reporter_count: number;
  }>;
  shift_breakdown: Array<{
    shift: string;
    units_produced: number;
    units_target: number;
    performance_percent: number;
    downtime_minutes: number;
    entry_count: number;
  }>;
  employee_leaderboard: ReportInsightEmployee[];
  support_signals: Array<ReportInsightEmployee & { reason: string }>;
  weekly_snapshots: Array<{
    week_start: string;
    week_end: string;
    total_units_produced: number;
    total_units_target: number;
    performance_percent: number;
    best_employee: ReportInsightEmployee | null;
    needs_support_employee: (ReportInsightEmployee & { reason: string }) | null;
  }>;
  employee_trend: Array<{
    user_id: number;
    name: string;
    points: Array<{
      week_start: string;
      week_end: string;
      units_produced: number;
      units_target: number;
      performance_percent: number;
      downtime_minutes: number;
      quality_issue_entries: number;
    }>;
  }>;
};

export type ReportJob = {
  job_id: string;
  kind: string;
  status: "queued" | "running" | "canceling" | "succeeded" | "failed" | "canceled";
  progress: number;
  message: string;
  created_at: string;
  updated_at: string;
  context?: {
    route?: string;
    entry_id?: number;
    start_date?: string;
    end_date?: string;
  } | null;
  result?: {
    file?: {
      filename: string;
      media_type: string;
      size_bytes: number;
    };
    row_count?: number;
    start_date?: string;
    end_date?: string;
  } | null;
  error?: string | null;
};

async function fetchBlob(path: string) {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
  });
  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = await response.json();
      throw new ApiError(payload?.detail || "Download failed.", response.status, payload?.detail);
    }
    throw new ApiError("Download failed.", response.status);
  }
  return response.blob();
}

export async function downloadEntryReport(entryId: number, kind: "pdf" | "excel") {
  return fetchBlob(`/reports/${kind}/${entryId}`);
}

export async function startEntryPdfJob(entryId: number) {
  return apiFetch<ReportJob>(`/reports/pdf/${entryId}/jobs`, {
    method: "POST",
  });
}

export async function downloadRangeExcel(startDate: string, endDate: string) {
  const query = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  return fetchBlob(`/reports/excel-range?${query.toString()}`);
}

export async function startRangeExcelJob(startDate: string, endDate: string) {
  const query = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  return apiFetch<ReportJob>(`/reports/excel-range/jobs?${query.toString()}`, {
    method: "POST",
  });
}

export async function getReportJob(jobId: string) {
  return apiFetch<ReportJob>(`/reports/export-jobs/${jobId}`);
}

export async function downloadReportJob(jobId: string) {
  return fetchBlob(`/reports/export-jobs/${jobId}/download`);
}

export async function getWeeklyExport(): Promise<ReportRangeSummary[]> {
  const response = await fetch(`/api/reports/weekly`, { credentials: "include" });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(payload?.detail || "Could not load weekly export.", response.status, payload?.detail);
  }
  return response.json();
}

export async function getMonthlyExport(): Promise<ReportRangeSummary[]> {
  const response = await fetch(`/api/reports/monthly`, { credentials: "include" });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(payload?.detail || "Could not load monthly export.", response.status, payload?.detail);
  }
  return response.json();
}

export async function getReportInsights(params: {
  startDate: string;
  endDate: string;
  shift?: string;
  hasIssues?: "any" | "yes" | "no";
  status?: string;
  search?: string;
}) {
  const query = new URLSearchParams({
    start_date: params.startDate,
    end_date: params.endDate,
  });
  if (params.shift) query.append("shift", params.shift);
  if (params.status && params.status !== "any") query.append("status", params.status);
  if (params.hasIssues === "yes") query.set("has_issues", "true");
  if (params.hasIssues === "no") query.set("has_issues", "false");
  if (params.search?.trim()) query.set("search", params.search.trim());
  return apiFetch<ReportInsights>(`/reports/insights?${query.toString()}`);
}

export function triggerBlobDownload(blob: Blob, filename: string): Promise<BlobTransferResult> {
  return transferBlob(blob, filename, {
    title: filename,
  });
}
