import { apiFetch } from "@/lib/api";

export type WeeklyAnalyticsPoint = {
  date: string;
  units: number;
  production_percent: number;
  attendance_percent: number;
};

export type MonthlyAnalytics = {
  summary: Array<{
    date: string;
    units: number;
    performance: number;
  }>;
  best_day: { date: string; performance: number } | null;
  worst_day: { date: string; performance: number } | null;
  average: number;
};

export type TrendsAnalytics = {
  production_trend: "up" | "down" | "stable" | string;
  common_issues: {
    downtime: number;
    quality: number;
  };
  peak_performance_shift?: string | null;
};

export type ManagerAnalytics = {
  totals: {
    total_units: number;
    total_target: number;
    average_performance: number;
    total_downtime: number;
  };
  shift_summary: Array<{
    shift: string;
    production_percent: number;
  }>;
  supervisor_summary: Array<{
    name: string;
    production_percent: number;
    downtime_minutes: number;
  }>;
};

export async function getWeeklyAnalytics() {
  return apiFetch<WeeklyAnalyticsPoint[]>("/analytics/weekly");
}

export async function getMonthlyAnalytics() {
  return apiFetch<MonthlyAnalytics>("/analytics/monthly");
}

export async function getTrendAnalytics() {
  return apiFetch<TrendsAnalytics>("/analytics/trends");
}

export async function getManagerAnalytics(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<ManagerAnalytics>(`/analytics/manager${query}`);
}
