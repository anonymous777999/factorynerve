import { getCookie } from "@/lib/cookies";
import { warmBackendConnection } from "@/lib/auth";

import { ApiError, apiFetch } from "@/lib/api";

export type OcrStatus = {
  installed: boolean;
  message?: string;
  path?: string;
  version?: string;
  tessdata_prefix?: string | null;
  languages: string[];
};

export type OcrTemplate = {
  id: number;
  name: string;
  columns: number;
  header_mode: string;
  language: string;
  column_names: string[];
  column_keywords: string[][];
  raw_column_label: string;
  enable_raw_column: boolean;
  created_at?: string;
};

export type OcrTemplateCreatePayload = {
  name: string;
  columns: number;
  headerMode: string;
  language: string;
  rawColumnLabel?: string;
  enableRawColumn?: boolean;
  columnNames?: string[];
  columnKeywords?: string[][];
  samples: File[];
};

export type OcrTemplateCreateResult = {
  id: number;
  avg_confidence: number;
  warnings: string[];
  template: OcrTemplate;
};

export type OcrRoutingMeta = {
  clarity_score: number;
  score_reason?: string | null;
  model_tier: "fast" | "balanced" | "best";
  forced: boolean;
  scorer_used: boolean;
  actual_cost_usd: number;
  cost_saved_usd: number;
  provider_used?: string | null;
  provider_model?: string | null;
  ai_applied?: boolean;
};

export type OcrScanQuality = {
  confidence_band: "high" | "medium" | "low" | "unknown";
  quality_signals: string[];
  auto_processing?: string[];
  fallback_used?: boolean;
  correction_count?: number;
  page_count?: number;
  adjustment_count?: number;
  retake_count?: number;
  manual_review_recommended?: boolean;
  outcome?: "success" | "partial" | "failed";
  next_action?: string | null;
  notes?: string | null;
  cell_boxes?: Array<Array<{ x: number; y: number; width: number; height: number } | null>> | null;
};

export type OcrPreviewResult = {
  type: string;
  title: string;
  headers: string[];
  rows: string[][];
  raw_text?: string | null;
  language?: string | null;
  confidence?: number | null;
  routing?: OcrRoutingMeta | null;
  reused?: boolean;
  reused_verification_id?: number | null;
  columns: number;
  avg_confidence: number;
  warnings: string[];
  scan_quality?: OcrScanQuality | null;
  cell_confidence?: number[][];
  cell_boxes?: Array<Array<{ x: number; y: number; width: number; height: number } | null>> | null;
  used_language: string;
  fallback_used: boolean;
  raw_column_added: boolean;
  template?: OcrTemplate | null;
};

export type OcrJobPayload = {
  job_id: string;
  kind: "ocr_ledger_excel" | "ocr_table_excel";
  status: "queued" | "running" | "canceling" | "succeeded" | "failed" | "canceled";
  progress: number;
  message: string;
  created_at: string;
  updated_at: string;
  error?: string | null;
  can_cancel?: boolean;
  can_retry?: boolean;
  context?: {
    route?: string;
    mode?: "ledger" | "table";
    source_filename?: string;
  } | null;
  result?: {
    metadata?: Record<string, unknown>;
    file?: {
      filename: string;
      media_type: string;
      size_bytes: number;
    };
  } | null;
  status_url?: string;
  download_url?: string;
};

export type OcrJobStart = OcrJobPayload;

export type OcrJobDownload = {
  blob: Blob;
  filename: string;
};

export type OcrWarpResult = {
  blob: Blob;
  corners: number[][] | null;
};

export type OcrVerificationRecord = {
  id: number;
  org_id?: string | null;
  factory_id?: string | null;
  user_id: number;
  created_by_name?: string | null;
  template_id?: number | null;
  template_name?: string | null;
  source_filename?: string | null;
  has_source_image?: boolean;
  source_image_url?: string | null;
  columns: number;
  language: string;
  avg_confidence: number;
  warnings: string[];
  scan_quality?: OcrScanQuality | null;
  document_hash?: string | null;
  doc_type_hint?: string | null;
  routing_meta?: OcrRoutingMeta | null;
  raw_text?: string | null;
  headers: string[];
  original_rows: string[][];
  reviewed_rows: string[][];
  raw_column_added: boolean;
  status: "draft" | "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
  rejection_reason?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  approved_by?: number | null;
  approved_by_name?: string | null;
  rejected_by?: number | null;
  rejected_by_name?: string | null;
  trusted_export?: boolean;
  export_source?: string | null;
  export_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type OcrVerificationSavePayload = {
  templateId?: number | null;
  sourceFilename?: string | null;
  columns: number;
  language: string;
  avgConfidence?: number | null;
  warnings?: string[];
  scanQuality?: OcrScanQuality | null;
  documentHash?: string | null;
  docTypeHint?: string | null;
  routingMeta?: OcrRoutingMeta | null;
  rawText?: string | null;
  headers?: string[];
  originalRows?: string[][];
  reviewedRows?: string[][];
  rawColumnAdded?: boolean;
  reviewerNotes?: string | null;
  file?: File | null;
};

export type OcrVerificationSummary = {
  total_documents: number;
  trusted_documents: number;
  trusted_rows: number;
  pending_documents: number;
  pending_rows: number;
  rejected_documents: number;
  rejected_rows: number;
  draft_documents: number;
  draft_rows: number;
  untrusted_documents: number;
  untrusted_rows: number;
  export_ready_documents: number;
  avg_trusted_confidence?: number | null;
  approval_rate?: number | null;
  last_trusted_at?: string | null;
  trust_note: string;
};

export type OcrVerificationShareLink = {
  url: string;
  expires_at: string;
};

function toJsonOrText(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function withOcrWakeRetry<T>(operation: () => Promise<T>, retryMessage: string): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError && error.status === 503) {
      const woke = await warmBackendConnection(true);
      if (woke) {
        return operation();
      }
      throw new ApiError(retryMessage, 503, error.detail);
    }
    throw error;
  }
}

async function fetchBlob(path: string): Promise<OcrJobDownload> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
  });
  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = await response.json().catch(() => ({}));
      throw new ApiError(
        payload?.detail || "Download failed.",
        response.status,
        payload?.detail,
      );
    }
    throw new ApiError("Download failed.", response.status);
  }
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return {
    blob: await response.blob(),
    filename: match?.[1] || "ocr-export.xlsx",
  };
}

export async function getOcrStatus() {
  return apiFetch<OcrStatus>("/ocr/status");
}

export async function listOcrTemplates() {
  return apiFetch<OcrTemplate[]>("/ocr/templates");
}

export async function createOcrTemplate(payload: OcrTemplateCreatePayload) {
  const formData = new FormData();
  formData.set("name", payload.name);
  formData.set("columns", String(payload.columns));
  formData.set("header_mode", payload.headerMode);
  formData.set("language", payload.language);
  formData.set("raw_column_label", payload.rawColumnLabel || "Raw");
  formData.set(
    "enable_raw_column",
    payload.enableRawColumn === false ? "false" : "true",
  );
  if (payload.columnNames?.length) {
    formData.set("column_names", JSON.stringify(payload.columnNames));
  }
  if (payload.columnKeywords?.length) {
    formData.set("column_keywords", JSON.stringify(payload.columnKeywords));
  }
  payload.samples.forEach((file) => {
    formData.append("samples", file);
  });
  return apiFetch<OcrTemplateCreateResult>("/ocr/templates", {
    method: "POST",
    body: formData,
  });
}

export async function archiveOcrTemplate(templateId: number) {
  return apiFetch<{ message: string }>(`/ocr/templates/${templateId}`, {
    method: "DELETE",
  });
}

export async function previewOcrLogbook(payload: {
  file: File;
  columns: number;
  language: string;
  templateId?: number | null;
  docTypeHint?: string | null;
  forceModel?: "auto" | "fast" | "balanced" | "best";
  documentHash?: string | null;
}) {
  const formData = new FormData();
  formData.set("file", payload.file);
  formData.set("columns", String(payload.columns));
  formData.set("language", payload.language);
  if (payload.templateId) {
    formData.set("template_id", String(payload.templateId));
  }
  if (payload.docTypeHint) {
    formData.set("doc_type_hint", payload.docTypeHint);
  }
  if (payload.forceModel && payload.forceModel !== "auto") {
    formData.set("force_model", payload.forceModel);
  }
  if (payload.documentHash) {
    formData.set("document_hash", payload.documentHash);
  }
  return withOcrWakeRetry(
    () =>
      apiFetch<OcrPreviewResult>("/ocr/logbook", {
        method: "POST",
        body: formData,
      }, {
        timeoutMs: 90000,
      }),
    "DPR.ai is waking up. Please retry the scan in a few seconds.",
  );
}

export async function startOcrExcelJob(payload: {
  kind: "ledger" | "table";
  file: File;
  mock?: boolean;
}) {
  const formData = new FormData();
  formData.set("file", payload.file);
  if (payload.kind === "ledger") {
    formData.set("mock", payload.mock ? "true" : "false");
  }
  return apiFetch<OcrJobStart>(
    payload.kind === "ledger"
      ? "/ocr/logbook-excel-async"
      : "/ocr/table-excel-async",
    {
      method: "POST",
      body: formData,
    },
  );
}

export async function getOcrJob(jobId: string) {
  return apiFetch<OcrJobPayload>(`/ocr/jobs/${jobId}`);
}

export async function downloadOcrJob(jobId: string) {
  return fetchBlob(`/ocr/jobs/${jobId}/download`);
}

function csrfHeaders() {
  const headers = new Headers();
  const cookieName = process.env.NEXT_PUBLIC_CSRF_COOKIE || "dpr_csrf";
  const headerName = process.env.NEXT_PUBLIC_CSRF_HEADER || "X-CSRF-Token";
  const csrf = getCookie(cookieName);
  if (csrf) {
    headers.set(headerName, csrf);
  }
  return headers;
}

export async function warpOcrImage(payload: { file: File; corners?: number[][] | null }): Promise<OcrWarpResult> {
  const formData = new FormData();
  formData.set("file", payload.file);
  if (payload.corners && payload.corners.length) {
    formData.set("corners", JSON.stringify(payload.corners));
  }

  const response = await fetch("/api/ocr/warp", {
    method: "POST",
    body: formData,
    credentials: "include",
    headers: csrfHeaders(),
  });
  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payloadJson = await response.json().catch(() => ({}));
      throw new ApiError(
        payloadJson?.detail || "Could not fix perspective.",
        response.status,
        payloadJson?.detail,
      );
    }
    throw new ApiError("Could not fix perspective.", response.status);
  }

  const cornersHeader = response.headers.get("X-Warp-Corners");
  let corners: number[][] | null = null;
  if (cornersHeader) {
    try {
      const parsed = JSON.parse(cornersHeader);
      if (Array.isArray(parsed)) {
        corners = parsed as number[][];
      }
    } catch {
      corners = null;
    }
  }
  return { blob: await response.blob(), corners };
}

function buildVerificationFormData(payload: OcrVerificationSavePayload) {
  const formData = new FormData();
  formData.set("columns", String(payload.columns));
  formData.set("language", payload.language);
  formData.set(
    "raw_column_added",
    payload.rawColumnAdded ? "true" : "false",
  );
  if (payload.templateId) {
    formData.set("template_id", String(payload.templateId));
  }
  if (payload.sourceFilename) {
    formData.set("source_filename", payload.sourceFilename);
  }
  if (typeof payload.avgConfidence === "number") {
    formData.set("avg_confidence", String(payload.avgConfidence));
  }
  if (payload.warnings) {
    formData.set("warnings", JSON.stringify(payload.warnings));
  }
  if (payload.scanQuality) {
    formData.set("scan_quality", JSON.stringify(payload.scanQuality));
  }
  if (payload.documentHash) {
    formData.set("document_hash", payload.documentHash);
  }
  if (payload.docTypeHint) {
    formData.set("doc_type_hint", payload.docTypeHint);
  }
  if (payload.routingMeta) {
    formData.set("routing_meta", JSON.stringify(payload.routingMeta));
  }
  if (payload.rawText != null) {
    formData.set("raw_text", payload.rawText);
  }
  if (payload.headers) {
    formData.set("headers", JSON.stringify(payload.headers));
  }
  if (payload.originalRows) {
    formData.set("original_rows", JSON.stringify(payload.originalRows));
  }
  if (payload.reviewedRows) {
    formData.set("reviewed_rows", JSON.stringify(payload.reviewedRows));
  }
  if (payload.reviewerNotes != null) {
    formData.set("reviewer_notes", payload.reviewerNotes);
  }
  if (payload.file) {
    formData.set("file", payload.file);
  }
  return formData;
}

export async function listOcrVerifications(status?: string) {
  const params = status
    ? `?verification_status=${encodeURIComponent(status)}`
    : "";
  return apiFetch<OcrVerificationRecord[]>(`/ocr/verifications${params}`);
}

export async function getOcrVerificationSummary() {
  return apiFetch<OcrVerificationSummary>("/ocr/verifications/summary");
}

export async function getOcrVerification(verificationId: number) {
  return apiFetch<OcrVerificationRecord>(`/ocr/verifications/${verificationId}`);
}

export async function downloadOcrVerificationExport(verificationId: number) {
  return fetchBlob(`/ocr/verifications/${verificationId}/export`);
}

export async function createOcrVerificationShareLink(verificationId: number) {
  return apiFetch<OcrVerificationShareLink>(`/ocr/verifications/${verificationId}/share-link`, {
    method: "POST",
  });
}

export async function createOcrVerification(payload: OcrVerificationSavePayload) {
  return apiFetch<OcrVerificationRecord>("/ocr/verifications", {
    method: "POST",
    body: buildVerificationFormData(payload),
  });
}

export async function updateOcrVerification(
  verificationId: number,
  payload: Omit<OcrVerificationSavePayload, "file">,
) {
  return apiFetch<OcrVerificationRecord>(`/ocr/verifications/${verificationId}`, {
    method: "PUT",
    body: {
      template_id: payload.templateId ?? null,
      source_filename: payload.sourceFilename ?? null,
      columns: payload.columns,
      language: payload.language,
      avg_confidence:
        typeof payload.avgConfidence === "number" ? payload.avgConfidence : null,
      warnings: payload.warnings ?? [],
      scan_quality: payload.scanQuality ?? null,
      document_hash: payload.documentHash ?? null,
      doc_type_hint: payload.docTypeHint ?? null,
      routing_meta: payload.routingMeta ?? null,
      raw_text: payload.rawText ?? null,
      headers: payload.headers ?? [],
      original_rows: payload.originalRows ?? [],
      reviewed_rows: payload.reviewedRows ?? [],
      raw_column_added: payload.rawColumnAdded ?? false,
      reviewer_notes: payload.reviewerNotes ?? "",
    },
  });
}

export async function submitOcrVerification(
  verificationId: number,
  reviewerNotes?: string,
) {
  return apiFetch<OcrVerificationRecord>(
    `/ocr/verifications/${verificationId}/submit`,
    {
      method: "POST",
      body: { reviewer_notes: reviewerNotes ?? "" },
    },
  );
}

export async function approveOcrVerification(
  verificationId: number,
  reviewerNotes?: string,
) {
  return apiFetch<OcrVerificationRecord>(
    `/ocr/verifications/${verificationId}/approve`,
    {
      method: "POST",
      body: { reviewer_notes: reviewerNotes ?? "" },
    },
  );
}

export async function rejectOcrVerification(
  verificationId: number,
  rejectionReason: string,
  reviewerNotes?: string,
) {
  return apiFetch<OcrVerificationRecord>(
    `/ocr/verifications/${verificationId}/reject`,
    {
      method: "POST",
      body: {
        rejection_reason: rejectionReason,
        reviewer_notes: reviewerNotes ?? "",
      },
    },
  );
}

export function stringifyOcrCell(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function parseColumnKeywords(raw: string): string[][] | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = toJsonOrText(trimmed);
  if (!Array.isArray(parsed)) return undefined;
  const groups = parsed
    .map((item) =>
      Array.isArray(item)
        ? item.map((token) => String(token).trim()).filter(Boolean)
        : [],
    )
    .filter((group) => group.length);
  return groups.length ? groups : undefined;
}
