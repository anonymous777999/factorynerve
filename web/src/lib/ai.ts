import { apiFetch } from "@/lib/api";

export type AiUsage = {
  plan: string;
  period: string;
  summary_used: number;
  summary_limit: number;
  email_used: number;
  email_limit: number;
  smart_used: number;
  smart_limit: number;
  suggestion_min_plan: string;
  anomaly_min_plan: string;
  nlq_min_plan: string;
  executive_min_plan: string;
};

export type SuggestionResponse = {
  date: string;
  shift: "morning" | "evening" | "night";
  plan: string;
  min_plan: string;
  quota_feature: string;
  provider: string;
  ai_used: boolean;
  reference_entries: number;
  generated_at: string;
  suggestion: {
    units_target?: number;
    manpower_present?: number;
    manpower_absent?: number;
    downtime_minutes?: number;
    downtime_reason?: string;
    materials_used?: string;
    notes?: string;
  };
  recent_patterns: string[];
  rationale: string;
};

export type AnomalyItem = {
  entry_id: number;
  date: string;
  shift: string;
  severity: string;
  anomaly_type: string;
  message: string;
  value: number;
  baseline: number;
};

export type AnomalyResponse = {
  days: number;
  plan: string;
  min_plan: string;
  quota_feature: string;
  provider: string;
  ai_used: boolean;
  generated_at: string;
  summary: string;
  items: AnomalyItem[];
};

export type NaturalLanguageQueryResponse = {
  question: string;
  plan: string;
  min_plan: string;
  quota_feature: string;
  provider: string;
  ai_used: boolean;
  generated_at: string;
  structured_query: Record<string, unknown>;
  answer: string;
  data_points: Array<{ group: string; value: number }>;
};

export type ExecutiveSummaryResponse = {
  start_date: string;
  end_date: string;
  plan: string;
  min_plan: string;
  quota_feature: string;
  provider: string;
  ai_used: boolean;
  generated_at: string;
  metrics: Record<string, number | string | null>;
  summary: string;
};

export type AiJob = {
  job_id: string;
  kind: string;
  status: "queued" | "running" | "canceling" | "succeeded" | "failed" | "canceled";
  progress: number;
  message: string;
  created_at: string;
  updated_at: string;
  result?: ExecutiveSummaryResponse | null;
  error?: string | null;
};

export async function getAiUsage() {
  return apiFetch<AiUsage>("/ai/usage", {}, { cacheTtlMs: 15_000 });
}

export async function getDprSuggestions(params: {
  shift: "morning" | "evening" | "night";
  entryDate?: string;
  lookbackDays?: number;
}) {
  const query = new URLSearchParams({
    shift: params.shift,
  });
  if (params.entryDate) query.set("entry_date", params.entryDate);
  if (params.lookbackDays) query.set("lookback_days", String(params.lookbackDays));
  return apiFetch<SuggestionResponse>(`/ai/suggestions?${query.toString()}`);
}

export async function getAnomalies(days = 14) {
  return apiFetch<AnomalyResponse>(`/ai/anomalies?days=${days}`, {}, { cacheTtlMs: 15_000 });
}

export async function getAnomalyPreview(days = 14) {
  return apiFetch<AnomalyResponse>(`/ai/anomalies/preview?days=${days}`, {}, { cacheTtlMs: 15_000 });
}

export async function askNaturalLanguageQuery(question: string) {
  return apiFetch<NaturalLanguageQueryResponse>("/ai/query", {
    method: "POST",
    body: { question },
  });
}

export async function getExecutiveSummary(startDate?: string, endDate?: string) {
  const query = new URLSearchParams();
  if (startDate) query.set("start_date", startDate);
  if (endDate) query.set("end_date", endDate);
  return apiFetch<ExecutiveSummaryResponse>(`/ai/executive-summary?${query.toString()}`);
}

export async function startExecutiveSummaryJob(startDate?: string, endDate?: string) {
  const query = new URLSearchParams();
  if (startDate) query.set("start_date", startDate);
  if (endDate) query.set("end_date", endDate);
  return apiFetch<AiJob>(`/ai/executive-summary/jobs?${query.toString()}`, {
    method: "POST",
  });
}

export async function getAiJob(jobId: string) {
  return apiFetch<AiJob>(`/ai/jobs/${jobId}`);
}
