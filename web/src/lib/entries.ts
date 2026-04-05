import { ApiError, apiFetch } from "@/lib/api";
import type { JobRecord } from "@/lib/jobs";
import type { EntryPayload } from "@/lib/offline-entries";

export type Entry = {
  id: number;
  user_id?: number;
  submitted_by?: string | null;
  date: string;
  shift: "morning" | "evening" | "night";
  client_request_id?: string | null;
  units_target: number;
  units_produced: number;
  manpower_present: number;
  manpower_absent: number;
  downtime_minutes: number;
  downtime_reason?: string | null;
  department?: string | null;
  materials_used?: string | null;
  quality_issues: boolean;
  quality_details?: string | null;
  notes?: string | null;
  ai_summary?: string | null;
  summary_job_id?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
};

export type EntryListResponse = {
  items: Entry[];
  total: number;
  page: number;
  page_size: number;
};

export type EntryListParams = {
  date?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
  shift?: Array<Entry["shift"]>;
  search?: string;
  has_issues?: boolean;
  status?: string[];
  min_performance?: number;
  max_performance?: number;
};

export type SmartInputResponse = {
  extracted_fields: Partial<EntryPayload> & { date?: string; shift?: string };
  confidence?: number | null;
  ai_used: boolean;
  missing_fields: string[];
  ai_error?: string | null;
};

export type EntrySummaryMeta = {
  entry_id: number;
  last_regenerated_at?: string | null;
  estimated_tokens: number;
  provider: string;
  plan: string;
  can_regenerate: boolean;
  min_plan: string;
};

export type EntryConflict = {
  message: string;
  entryId?: number | null;
};

function buildQuery(params: EntryListParams = {}): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, String(item)));
      return;
    }
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function createEntry(payload: EntryPayload): Promise<Entry> {
  return apiFetch<Entry>("/entries", { method: "POST", body: payload });
}

export async function listEntries(params: EntryListParams = {}): Promise<EntryListResponse> {
  return apiFetch<EntryListResponse>(`/entries${buildQuery(params)}`, {}, { cacheTtlMs: 12_000 });
}

export async function getTodayEntries(): Promise<Entry[]> {
  return apiFetch<Entry[]>("/entries/today", {}, { cacheTtlMs: 10_000 });
}

export async function getEntry(entryId: number): Promise<Entry> {
  return apiFetch<Entry>(`/entries/${entryId}`, {}, { cacheTtlMs: 12_000 });
}

export async function getEntrySummaryMeta(entryId: number): Promise<EntrySummaryMeta> {
  return apiFetch<EntrySummaryMeta>(`/entries/${entryId}/summary-meta`, {}, { cacheTtlMs: 60_000 });
}

export async function regenerateEntrySummary(entryId: number): Promise<Entry> {
  return apiFetch<Entry>(`/entries/${entryId}/summary`, { method: "POST" });
}

export async function queueEntrySummaryJob(entryId: number): Promise<JobRecord> {
  return apiFetch<JobRecord>(`/entries/${entryId}/summary-jobs`, { method: "POST" });
}

export async function updateEntry(
  entryId: number,
  payload: Partial<Pick<EntryPayload, "units_target" | "units_produced" | "manpower_present" | "manpower_absent" | "downtime_minutes" | "downtime_reason" | "materials_used" | "quality_issues" | "quality_details" | "notes">>,
): Promise<Entry> {
  return apiFetch<Entry>(`/entries/${entryId}`, { method: "PUT", body: payload });
}

export async function approveEntry(entryId: number): Promise<Entry> {
  return apiFetch<Entry>(`/entries/${entryId}/approve`, { method: "POST" });
}

export async function rejectEntry(entryId: number, reason?: string | null): Promise<Entry> {
  return apiFetch<Entry>(`/entries/${entryId}/reject`, {
    method: "POST",
    body: { reason: reason || null },
  });
}

export async function deleteEntry(entryId: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/entries/${entryId}`, { method: "DELETE" });
}

export async function parseSmartInput(payload: {
  rawText?: string;
  uploadFile?: File | null;
}): Promise<SmartInputResponse> {
  const formData = new FormData();
  if (payload.rawText?.trim()) {
    formData.set("raw_text", payload.rawText.trim());
  }
  if (payload.uploadFile) {
    formData.set("upload_file", payload.uploadFile);
  }
  return apiFetch<SmartInputResponse>("/entries/smart", { method: "POST", body: formData });
}

export function getEntryConflict(error: unknown): EntryConflict | null {
  if (!(error instanceof ApiError) || error.status !== 409 || !error.detail || typeof error.detail !== "object") {
    return null;
  }

  const detail = error.detail as { message?: unknown; entry_id?: unknown };
  return {
    message:
      typeof detail.message === "string" && detail.message.trim()
        ? detail.message
        : "Entry already exists for this date and shift.",
    entryId:
      typeof detail.entry_id === "number" && Number.isFinite(detail.entry_id)
        ? detail.entry_id
        : null,
  };
}
