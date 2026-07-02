import { apiFetch } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

export type WorkforceOverview = {
  as_of: string;
  period_days: number;
  date_range: { start: string; end: string };
  today: {
    total_workers: number;
    working: number;
    completed: number;
    absent: number;
    total_worked_minutes: number;
    total_overtime_minutes: number;
    overtime_earners_count: number;
  };
  period: {
    total_records: number;
    total_worked_hours: number;
    total_overtime_hours: number;
    total_late_hours: number;
    avg_worked_minutes_per_day: number;
    avg_overtime_minutes_per_day: number;
    presence_rate_percent: number;
    days_punched: number;
  };
  shift_comparison: {
    shifts: Array<{
      shift: string;
      total_records: number;
      working: number;
      completed: number;
      absent: number;
      total_worked_hours: number;
      total_overtime_hours: number;
      total_late_hours: number;
      avg_worked_minutes: number;
      avg_overtime_minutes: number;
      overtime_count: number;
      late_count: number;
    }>;
    best_performing_shift: string | null;
    best_avg_worked_minutes: number | null;
  };
  financial_access: boolean;
  cost_summary?: {
    worker_count: number;
    total_regular_hours: number;
    total_overtime_hours: number;
    regular_cost_inr: number;
    overtime_cost_inr: number;
    total_cost_inr: number;
    effective_hourly_rate_inr: number;
    overtime_multiplier: number;
    valuation_note: string;
  };
};

export type WorkerSummary = {
  user_id: number;
  name: string;
  role: string;
  department: string | null;
  designation: string | null;
  employee_code: string | null;
  attendance_days: number;
  total_worked_minutes: number;
  total_worked_hours: number;
  avg_worked_minutes: number;
  total_overtime_minutes: number;
  total_overtime_hours: number;
  overtime_days: number;
  total_late_minutes: number;
  late_days: number;
  estimated_productivity_score: number;
  hourly_rate_inr?: number;
  regular_cost_inr?: number;
  overtime_cost_inr?: number;
  total_cost_inr?: number;
};

export type WorkerTrend = {
  as_of: string;
  period_days: number;
  user_id: number;
  name: string;
  role: string;
  department: string | null;
  designation: string | null;
  employee_code: string | null;
  financial_access: boolean;
  summary: {
    days_present: number;
    days_absent: number;
    total_worked_hours: number;
    total_overtime_hours: number;
    total_late_hours: number;
    avg_worked_hours_per_day: number;
  };
  daily: Array<{
    date: string;
    shift: string;
    status: string;
    punch_in_at: string | null;
    punch_out_at: string | null;
    worked_minutes: number;
    overtime_minutes: number;
    late_minutes: number;
    regular_cost_inr?: number;
    overtime_cost_inr?: number;
    total_day_cost_inr?: number;
  }>;
};

// ── API Functions ──────────────────────────────────────────────────────────

export async function getWorkforceOverview(days = 30): Promise<WorkforceOverview> {
  return apiFetch(`/intelligence/workforce/overview?days=${days}`);
}

export async function getWorkforceWorkers(
  days = 30,
  sortBy = "worked_minutes",
  limit = 50,
): Promise<{
  as_of: string;
  period_days: number;
  total_workers_with_attendance: number;
  total_factory_workers: number;
  sort_by: string;
  financial_access: boolean;
  workers: WorkerSummary[];
}> {
  return apiFetch(
    `/intelligence/workforce/workers?days=${days}&sort_by=${encodeURIComponent(sortBy)}&limit=${limit}`,
  );
}

export async function getWorkforceWorkerTrend(
  userId: number,
  days = 30,
): Promise<WorkerTrend> {
  return apiFetch(`/intelligence/workforce/workers/${userId}/trend?days=${days}`);
}

export async function getWorkforceCostSummary(days = 30): Promise<{
  as_of: string;
  period_days: number;
  financial_access: boolean;
  worker_count: number;
  total_regular_hours: number;
  total_overtime_hours: number;
  regular_cost_inr: number;
  overtime_cost_inr: number;
  total_cost_inr: number;
  effective_hourly_rate_inr: number;
  overtime_multiplier: number;
  valuation_note: string;
}> {
  return apiFetch(`/intelligence/workforce/costs/summary?days=${days}`);
}

export async function listWorkforceCostRates(limit = 50): Promise<{
  items: Array<{
    id: number;
    user_id: number | null;
    role: string | null;
    department: string | null;
    effective_from: string;
    effective_to: string | null;
    regular_hourly_rate_inr: number;
    overtime_multiplier: number;
    notes: string | null;
    created_at: string;
  }>;
}> {
  return apiFetch(`/intelligence/workforce/costs/rates?limit=${limit}`);
}

export async function createWorkforceCostRate(payload: {
  user_id?: number | null;
  role?: string | null;
  department?: string | null;
  effective_from: string;
  effective_to?: string | null;
  regular_hourly_rate_inr: number;
  overtime_multiplier?: number;
  notes?: string | null;
}): Promise<{ rate: Record<string, unknown> }> {
  return apiFetch("/intelligence/workforce/costs/rates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
