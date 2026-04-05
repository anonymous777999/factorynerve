import { apiFetch } from "@/lib/api";

export type JobStatus =
  | "queued"
  | "running"
  | "canceling"
  | "succeeded"
  | "failed"
  | "canceled";

export type JobRecord = {
  job_id: string;
  kind: string;
  owner_id: number;
  org_id?: string | null;
  status: JobStatus;
  progress: number;
  message: string;
  created_at: string;
  updated_at: string;
  context?: {
    route?: string;
    entry_id?: number;
    start_date?: string;
    end_date?: string;
    mode?: string;
    source_filename?: string;
  } | null;
  result?: Record<string, unknown> | null;
  error?: string | null;
  cancel_requested?: boolean;
  can_cancel?: boolean;
  can_retry?: boolean;
};

export async function listJobs(limit = 12) {
  return apiFetch<JobRecord[]>(`/jobs?limit=${limit}`, {}, { cacheTtlMs: 2_000 });
}

export async function getJob(jobId: string) {
  return apiFetch<JobRecord>(`/jobs/${jobId}`, {}, { cacheTtlMs: 1_000 });
}

export async function cancelJob(jobId: string) {
  return apiFetch<JobRecord>(`/jobs/${jobId}/cancel`, {
    method: "POST",
  });
}

export async function retryJob(jobId: string) {
  return apiFetch<JobRecord>(`/jobs/${jobId}/retry`, {
    method: "POST",
  });
}
