"use client";

import { buildFeedbackContext } from "@/lib/feedback-context";
import type {
  FeedbackChannel,
  FeedbackMood,
  FeedbackRating,
  FeedbackSource,
  FeedbackType,
  SubmitFeedbackPayload,
} from "@/lib/feedback";
import type { AppLanguage } from "@/lib/i18n";
import { withFeedbackClientRequestId } from "@/lib/offline-feedback";

const DEVANAGARI_RE = /[\u0900-\u097F]/;
const LATIN_RE = /[A-Za-z]/;

function normalizeHint(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

export function detectFeedbackLanguage(message: string, preferredHint?: string | null) {
  const trimmed = String(message || "").trim();
  if (DEVANAGARI_RE.test(trimmed)) {
    return "hi";
  }
  if (LATIN_RE.test(trimmed)) {
    return "en";
  }
  const hint = normalizeHint(preferredHint);
  return hint || "und";
}

export function buildSubmitFeedbackPayload(input: {
  type: FeedbackType;
  source: FeedbackSource;
  channel?: FeedbackChannel;
  mood?: FeedbackMood | null;
  rating?: FeedbackRating | null;
  messageOriginal: string;
  messageTranslated?: string | null;
  preferredLanguage?: string | null;
  pathname: string;
  appLanguage: AppLanguage;
  activeFactoryName?: string | null;
  organizationName?: string | null;
  role?: string | null;
  contextPatch?: Record<string, unknown> | null;
}): SubmitFeedbackPayload {
  const detectedLanguage = detectFeedbackLanguage(
    input.messageOriginal,
    input.preferredLanguage || input.appLanguage,
  );
  const context = {
    ...buildFeedbackContext({
      pathname: input.pathname,
      language: input.appLanguage,
      activeFactoryName: input.activeFactoryName,
      organizationName: input.organizationName,
      role: input.role,
    }),
    ...(input.contextPatch || {}),
  };
  const payload: SubmitFeedbackPayload = {
    type: input.type,
    source: input.source,
    channel: input.channel || "text",
    mood: input.mood || null,
    rating: input.rating || null,
    message_original: input.messageOriginal.trim(),
    message_translated: input.messageTranslated?.trim() || null,
    detected_language: detectedLanguage,
    translation_status: input.messageTranslated?.trim()
      ? "provided"
      : detectedLanguage === "en" || detectedLanguage === "hi"
        ? "pending"
        : "not_needed",
    context,
  };
  return withFeedbackClientRequestId(payload);
}
