import { apiFetch } from "@/lib/api";

export type AttendanceShift = "morning" | "evening" | "night" | string;
export type AttendanceRegularizationType =
  | "missed_punch"
  | "timing_correction"
  | "status_correction"
  | "shift_correction";
export type AttendanceReviewFinalStatus = "working" | "completed" | "half_day" | "absent";
export type AttendanceStatus =
  | "not_punched"
  | "working"
  | "completed"
  | "missed_punch"
  | "half_day"
  | "absent"
  | "late"
  | string;
export type AttendanceReviewStatus = "auto" | "pending_review" | "approved" | "rejected" | string;

export type AttendanceToday = {
  attendance_id: number | null;
  attendance_date: string;
  factory_id: string;
  factory_name: string;
  factory_code?: string | null;
  shift: AttendanceShift;
  shift_template_id?: number | null;
  status: AttendanceStatus;
  review_status: AttendanceReviewStatus;
  source?: string | null;
  note?: string | null;
  punch_in_at?: string | null;
  punch_out_at?: string | null;
  worked_minutes: number;
  late_minutes: number;
  overtime_minutes: number;
  can_punch_in: boolean;
  can_punch_out: boolean;
};

export type AttendanceShiftSummary = {
  shift: AttendanceShift;
  punched_count: number;
  working_count: number;
  completed_count: number;
  pending_review_count: number;
};

export type AttendanceLiveRow = {
  attendance_id?: number | null;
  user_id: number;
  user_code: number;
  name: string;
  role: string;
  department?: string | null;
  designation?: string | null;
  status: AttendanceStatus;
  review_status: AttendanceReviewStatus;
  shift?: AttendanceShift | null;
  source?: string | null;
  note?: string | null;
  punch_in_at?: string | null;
  punch_out_at?: string | null;
  worked_minutes: number;
  late_minutes: number;
  overtime_minutes: number;
};

export type AttendanceLive = {
  attendance_date: string;
  factory_id: string;
  factory_name: string;
  totals: {
    total_people: number;
    punched_in: number;
    working: number;
    completed: number;
    not_punched: number;
    pending_review: number;
    late: number;
  };
  shift_summary: AttendanceShiftSummary[];
  rows: AttendanceLiveRow[];
};

export type AttendanceRegularization = {
  id: number;
  status: string;
  request_type: string;
  reason: string;
  requested_in_at?: string | null;
  requested_out_at?: string | null;
  reviewer_note?: string | null;
  reviewed_by_user_id?: number | null;
  reviewed_at?: string | null;
  created_at: string;
};

export type AttendanceReviewItem = {
  attendance_id: number;
  attendance_date: string;
  user_id: number;
  user_code: number;
  name: string;
  role: string;
  department?: string | null;
  designation?: string | null;
  shift: AttendanceShift;
  status: AttendanceStatus;
  review_status: AttendanceReviewStatus;
  punch_in_at?: string | null;
  punch_out_at?: string | null;
  worked_minutes: number;
  late_minutes: number;
  overtime_minutes: number;
  note?: string | null;
  review_reason: string;
  regularization?: AttendanceRegularization | null;
};

export type AttendanceReviewPayload = {
  attendance_date: string;
  factory_id: string;
  factory_name: string;
  totals: {
    pending_records: number;
    pending_regularizations: number;
    missed_punch: number;
    late: number;
  };
  items: AttendanceReviewItem[];
};

export type EmployeeProfileItem = {
  profile_id?: number | null;
  user_id: number;
  user_code: number;
  name: string;
  email: string;
  role: string;
  employee_code?: string | null;
  department?: string | null;
  designation?: string | null;
  employment_type: string;
  reporting_manager_id?: number | null;
  default_shift: AttendanceShift;
  joining_date?: string | null;
  is_active: boolean;
};

export type ShiftTemplateItem = {
  id: number;
  shift_name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  overtime_after_minutes: number;
  cross_midnight: boolean;
  is_default: boolean;
  is_active: boolean;
};

export type AttendanceReportDay = {
  attendance_date: string;
  total_people: number;
  punched_in: number;
  completed: number;
  not_punched: number;
  pending_review: number;
  late: number;
  overtime: number;
};

export type AttendanceReportSummary = {
  factory_id: string;
  factory_name: string;
  date_from: string;
  date_to: string;
  totals: {
    total_people: number;
    present_records: number;
    completed_records: number;
    pending_review: number;
    late_records: number;
    overtime_records: number;
  };
  days: AttendanceReportDay[];
};

export async function getMyAttendanceToday() {
  return apiFetch<AttendanceToday>("/attendance/me/today", {}, { cacheTtlMs: 5_000, cacheKey: "attendance:me:today" });
}

export async function punchAttendance(payload: {
  action: "in" | "out";
  shift?: AttendanceShift;
  note?: string;
}) {
  return apiFetch<AttendanceToday>("/attendance/punch", {
    method: "POST",
    body: payload,
  });
}

export async function getLiveAttendance(attendanceDate?: string) {
  const query = attendanceDate ? `?attendance_date=${encodeURIComponent(attendanceDate)}` : "";
  return apiFetch<AttendanceLive>(`/attendance/live${query}`, {}, {
    cacheTtlMs: 5_000,
    cacheKey: `attendance:live:${attendanceDate || "today"}`,
  });
}

export async function listAttendanceReview(attendanceDate?: string, lookbackDays = 14) {
  const params = new URLSearchParams();
  if (attendanceDate) params.set("attendance_date", attendanceDate);
  params.set("lookback_days", String(lookbackDays));
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<AttendanceReviewPayload>(`/attendance/review${query}`, {}, {
    cacheTtlMs: 5_000,
    cacheKey: `attendance:review:${attendanceDate || "today"}:${lookbackDays}`,
  });
}

export async function approveAttendanceReview(
  attendanceId: number,
  payload: {
    regularization_id?: number | null;
    punch_in_at?: string | null;
    punch_out_at?: string | null;
    final_status?: AttendanceReviewFinalStatus | null;
    note?: string | null;
  },
) {
  return apiFetch<AttendanceReviewItem>(`/attendance/review/${attendanceId}/approve`, {
    method: "POST",
    body: payload,
  });
}

export async function rejectAttendanceReview(
  attendanceId: number,
  payload: {
    regularization_id?: number | null;
    note: string;
  },
) {
  return apiFetch<AttendanceReviewItem>(`/attendance/review/${attendanceId}/reject`, {
    method: "POST",
    body: payload,
  });
}

export async function createAttendanceRegularization(payload: {
  attendance_record_id: number;
  request_type?: AttendanceRegularizationType;
  requested_in_at?: string | null;
  requested_out_at?: string | null;
  reason: string;
}) {
  return apiFetch<AttendanceRegularization>("/attendance/me/regularizations", {
    method: "POST",
    body: payload,
  });
}

export async function listAttendanceEmployeeProfiles() {
  return apiFetch<EmployeeProfileItem[]>("/attendance/settings/employees");
}

export async function upsertAttendanceEmployeeProfile(payload: {
  user_id: number;
  employee_code?: string | null;
  department?: string | null;
  designation?: string | null;
  employment_type?: string;
  reporting_manager_id?: number | null;
  default_shift?: string;
  joining_date?: string | null;
  is_active?: boolean;
}) {
  return apiFetch<EmployeeProfileItem>("/attendance/settings/employees", {
    method: "POST",
    body: payload,
  });
}

export async function listShiftTemplates() {
  return apiFetch<ShiftTemplateItem[]>("/attendance/settings/shifts", {}, {
    cacheTtlMs: 15_000,
    cacheKey: "attendance:shift-templates",
  });
}

export async function upsertShiftTemplate(payload: {
  id?: number | null;
  shift_name: string;
  start_time: string;
  end_time: string;
  grace_minutes?: number;
  overtime_after_minutes?: number;
  cross_midnight?: boolean;
  is_default?: boolean;
  is_active?: boolean;
}) {
  return apiFetch<ShiftTemplateItem>("/attendance/settings/shifts", {
    method: "POST",
    body: payload,
  });
}

export async function getAttendanceReportSummary(dateFrom?: string, dateTo?: string) {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<AttendanceReportSummary>(`/attendance/reports/summary${query}`, {}, {
    cacheTtlMs: 5_000,
    cacheKey: `attendance:reports:${dateFrom || "default"}:${dateTo || "default"}`,
  });
}
