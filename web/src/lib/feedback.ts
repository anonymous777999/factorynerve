"use client";

import { API_BASE_URL, apiFetch } from "@/lib/api";

export type FeedbackType = "issue" | "bug" | "suggestion" | "alert_problem";
export type FeedbackSource = "floating" | "micro" | "error_prompt";
export type FeedbackChannel = "text" | "voice";
export type FeedbackMood = "frustrated" | "neutral" | "satisfied";
export type FeedbackRating = "up" | "down";
export type FeedbackStatus = "open" | "triaged" | "resolved";
export type FeedbackSort = "recency" | "frequency";

export type SubmitFeedbackPayload = {
  type: FeedbackType;
  message_original: string;
  source?: FeedbackSource;
  channel?: FeedbackChannel;
  mood?: FeedbackMood | null;
  rating?: FeedbackRating | null;
  message_translated?: string | null;
  detected_language?: string | null;
  translation_status?: string | null;
  context?: Record<string, unknown> | null;
  client_request_id?: string | null;
};

export type FeedbackSubmitResponse = {
  id: number;
  type: FeedbackType;
  status: FeedbackStatus;
  deduplicated: boolean;
  created_at: string;
};

export type FeedbackAdminItem = {
  id: number;
  org_id: string;
  factory_id?: string | null;
  factory_name?: string | null;
  user_id: number;
  user_name: string;
  user_role: string;
  type: FeedbackType;
  source: FeedbackSource;
  channel: FeedbackChannel;
  mood?: FeedbackMood | null;
  rating?: FeedbackRating | null;
  status: FeedbackStatus;
  message_original: string;
  message_translated?: string | null;
  detected_language?: string | null;
  translation_status: string;
  context?: Record<string, unknown> | null;
  resolution_note?: string | null;
  resolved_at?: string | null;
  resolved_by_user_id?: number | null;
  resolved_by_name?: string | null;
  created_at: string;
  group_key: string;
  group_occurrences: number;
  latest_similar_at?: string | null;
};

export type FeedbackReporterUpdateItem = {
  id: number;
  type: FeedbackType;
  message_original: string;
  resolution_note?: string | null;
  resolved_at: string;
};

export type FeedbackReporterUpdatesResponse = {
  items: FeedbackReporterUpdateItem[];
  total: number;
  limit: number;
};

export type FeedbackListResponse = {
  items: FeedbackAdminItem[];
  total: number;
  limit: number;
  offset: number;
};

export async function submitFeedback(payload: SubmitFeedbackPayload) {
  return apiFetch<FeedbackSubmitResponse>("/feedback", {
    method: "POST",
    body: payload,
  });
}

export async function listFeedbackAdmin(filters?: {
  status?: FeedbackStatus | "all";
  type?: FeedbackType | "all";
  sort?: FeedbackSort;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters?.type && filters.type !== "all") {
    params.set("type", filters.type);
  }
  if (filters?.sort) {
    params.set("sort", filters.sort);
  }
  if (typeof filters?.limit === "number") {
    params.set("limit", String(filters.limit));
  }
  if (typeof filters?.offset === "number") {
    params.set("offset", String(filters.offset));
  }
  const query = params.size ? `?${params.toString()}` : "";
  return apiFetch<FeedbackListResponse>(`/feedback${query}`);
}

export async function updateFeedbackRecord(
  feedbackId: number,
  payload: {
    status: FeedbackStatus;
    resolution_note?: string | null;
  },
) {
  return apiFetch<FeedbackAdminItem>(`/feedback/${feedbackId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function listMyFeedbackUpdates(filters?: {
  since?: string | null;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.since) {
    params.set("since", filters.since);
  }
  if (typeof filters?.limit === "number") {
    params.set("limit", String(filters.limit));
  }
  const query = params.size ? `?${params.toString()}` : "";
  return apiFetch<FeedbackReporterUpdatesResponse>(`/feedback/mine/updates${query}`);
}

export async function downloadFeedbackExport(filters?: {
  status?: FeedbackStatus | "all";
  type?: FeedbackType | "all";
  sort?: FeedbackSort;
}) {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters?.type && filters.type !== "all") {
    params.set("type", filters.type);
  }
  if (filters?.sort) {
    params.set("sort", filters.sort);
  }
  const query = params.size ? `?${params.toString()}` : "";
  const response = await fetch(`${API_BASE_URL}/feedback/export.csv${query}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("Could not export feedback.");
  }
  const blob = await response.blob();
  const headerName =
    response.headers
      .get("content-disposition")
      ?.split("filename=")[1]
      ?.replaceAll('"', "")
      ?.trim() || "feedback-export.csv";
  return { blob, filename: headerName };
}
