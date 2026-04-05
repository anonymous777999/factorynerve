import { apiFetch } from "@/lib/api";

export type UsageSummary = {
  plan?: string;
  period?: string;
  requests_used?: number;
  max_requests?: number;
  credits_used?: number;
  max_credits?: number;
};

export type AlertItem = {
  id: number;
  alert_type: string;
  message: string;
  severity: string;
  created_at?: string;
  is_read?: boolean;
};

export type WeeklyAnalyticsPoint = {
  date: string;
  units: number;
  production_percent: number;
  attendance_percent: number;
};

export async function getUsage(): Promise<UsageSummary> {
  return apiFetch<UsageSummary>("/settings/usage", {}, { cacheTtlMs: 20_000 });
}

export async function listUnreadAlerts(): Promise<AlertItem[]> {
  return apiFetch<AlertItem[]>("/alerts", {}, { cacheTtlMs: 10_000 });
}

export async function markAlertRead(alertId: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/alerts/${alertId}/read`, { method: "PUT" });
}

export async function getWeeklyAnalytics(): Promise<WeeklyAnalyticsPoint[]> {
  return apiFetch<WeeklyAnalyticsPoint[]>("/analytics/weekly", {}, { cacheTtlMs: 20_000 });
}
