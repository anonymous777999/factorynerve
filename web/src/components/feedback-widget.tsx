"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ApiError, formatApiErrorMessage } from "@/lib/api";
import { buildSubmitFeedbackPayload } from "@/lib/feedback-submit";
import {
  submitFeedback,
  type FeedbackMood,
  type FeedbackType,
  type SubmitFeedbackPayload,
} from "@/lib/feedback";
import {
  countQueuedFeedback,
  enqueueFeedback,
  subscribeToFeedbackQueueUpdates,
} from "@/lib/offline-feedback";
import { pushAppToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AppLanguage } from "@/lib/i18n";

type Props = {
  pathname: string;
  immersiveScannerRoute: boolean;
  userId: number | null;
  activeFactoryName?: string | null;
  organizationName?: string | null;
  role?: string | null;
  appLanguage: AppLanguage;
};

type FollowUpOption = {
  value: string;
  label: string;
};

type FeedbackFollowUp = {
  question: string;
  options: FollowUpOption[];
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: {
    transcript: string;
  };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const TYPE_OPTIONS: Array<{
  value: FeedbackType;
  label: string;
  helper: string;
}> = [
  {
    value: "issue",
    label: "Issue",
    helper: "What were you trying to do when it got stuck?",
  },
  {
    value: "bug",
    label: "Bug",
    helper: "What broke, crashed, or behaved unexpectedly?",
  },
  {
    value: "suggestion",
    label: "Suggestion",
    helper: "What would make this faster or easier?",
  },
  {
    value: "alert_problem",
    label: "Alert Problem",
    helper: "Which alert felt wrong, missing, or confusing?",
  },
];

const FOLLOW_UP_OPTIONS: Record<FeedbackType, FeedbackFollowUp> = {
  issue: {
    question: "How often does this happen?",
    options: [
      { value: "every_time", label: "Every time" },
      { value: "sometimes", label: "Sometimes" },
      { value: "just_once", label: "Just once" },
    ],
  },
  bug: {
    question: "What happened?",
    options: [
      { value: "freeze", label: "Screen froze" },
      { value: "wrong_data", label: "Wrong data" },
      { value: "crash", label: "App crashed" },
    ],
  },
  suggestion: {
    question: "What would help most?",
    options: [
      { value: "fewer_steps", label: "Fewer steps" },
      { value: "faster", label: "Faster screen" },
      { value: "clearer", label: "Clearer words" },
    ],
  },
  alert_problem: {
    question: "What was wrong with the alert?",
    options: [
      { value: "wrong_person", label: "Wrong person" },
      { value: "wrong_timing", label: "Wrong timing" },
      { value: "missing_alert", label: "Alert missing" },
    ],
  },
};

const MOOD_OPTIONS: Array<{ value: FeedbackMood; label: string }> = [
  { value: "frustrated", label: "Frustrated" },
  { value: "neutral", label: "Neutral" },
  { value: "satisfied", label: "Satisfied" },
];

const LANGUAGE_OPTIONS: Array<{ value: "auto" | "en" | "hi"; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
];

function isOfflineLikeError(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }
  if (error instanceof ApiError && error.status === 0) {
    return true;
  }
  if (error instanceof TypeError) {
    return true;
  }
  if (error instanceof Error) {
    return /network|failed to fetch/i.test(error.message);
  }
  return false;
}

function trimJoin(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
}

function speechLang(value: "auto" | "en" | "hi", appLanguage: AppLanguage) {
  if (value === "hi") return "hi-IN";
  if (value === "en") return "en-IN";
  return appLanguage === "hi" ? "hi-IN" : "en-IN";
}

function recognitionConstructor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function FeedbackWidget({
  pathname,
  immersiveScannerRoute,
  userId,
  activeFactoryName,
  organizationName,
  role,
  appLanguage,
}: Props) {
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("issue");
  const [mood, setMood] = useState<FeedbackMood | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [queuedCount, setQueuedCount] = useState(0);
  const [followUpAnswer, setFollowUpAnswer] = useState("");
  const [languageHint, setLanguageHint] = useState<"auto" | "en" | "hi">("auto");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState("");
  const [usedVoiceInput, setUsedVoiceInput] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const activeType = useMemo(
    () => TYPE_OPTIONS.find((option) => option.value === feedbackType) || TYPE_OPTIONS[0],
    [feedbackType],
  );
  const followUp = FOLLOW_UP_OPTIONS[feedbackType];

  useEffect(() => {
    setVoiceSupported(Boolean(recognitionConstructor()));
  }, []);

  useEffect(() => {
    if (!userId) {
      setQueuedCount(0);
      return;
    }

    const refreshCount = () => {
      void countQueuedFeedback(userId).then(setQueuedCount).catch(() => undefined);
    };

    refreshCount();
    return subscribeToFeedbackQueueUpdates(refreshCount);
  }, [userId]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
      recognitionRef.current = null;
    };
  }, []);

  if (!userId) {
    return null;
  }

  const resetForm = () => {
    setFeedbackType("issue");
    setMood(null);
    setMessage("");
    setError("");
    setFollowUpAnswer("");
    setLanguageHint("auto");
    setVoiceDraft("");
    setUsedVoiceInput(false);
    setListening(false);
  };

  const close = () => {
    recognitionRef.current?.stop();
    setOpen(false);
    setError("");
    setVoiceDraft("");
  };

  const queuePayload = async (payload: SubmitFeedbackPayload) => {
    await enqueueFeedback(userId, payload);
    pushAppToast({
      title: "Feedback saved offline",
      description: "We will send it automatically when the connection comes back.",
      tone: "info",
    });
    resetForm();
    setOpen(false);
  };

  const startVoiceCapture = () => {
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      setError("Voice input is not available on this device.");
      return;
    }
    setError("");
    setVoiceDraft("");
    const recognition = new Constructor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = speechLang(languageHint, appLanguage);
    recognition.onstart = () => {
      setListening(true);
      setUsedVoiceInput(true);
    };
    recognition.onend = () => {
      setListening(false);
      setVoiceDraft("");
    };
    recognition.onerror = (event) => {
      setListening(false);
      setVoiceDraft("");
      setError(
        event.error === "not-allowed"
          ? "Microphone access is blocked. Allow it in the browser to use voice input."
          : "Voice input stopped before finishing.",
      );
    };
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript || "";
        if (result.isFinal) {
          finalText += ` ${transcript}`;
        } else {
          interimText += ` ${transcript}`;
        }
      }
      if (finalText.trim()) {
        setMessage((current) => trimJoin([current, finalText]));
      }
      setVoiceDraft(interimText.trim());
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopVoiceCapture = () => {
    recognitionRef.current?.stop();
  };

  const handleSubmit = async () => {
    const trimmedMessage = trimJoin([message, voiceDraft]);
    if (!trimmedMessage) {
      setError("Please share a short note before sending.");
      return;
    }

    const payload = buildSubmitFeedbackPayload({
      type: feedbackType,
      source: "floating",
      channel: usedVoiceInput ? "voice" : "text",
      mood,
      messageOriginal: trimmedMessage,
      preferredLanguage: languageHint === "auto" ? appLanguage : languageHint,
      pathname,
      appLanguage,
      activeFactoryName,
      organizationName,
      role,
      contextPatch: {
        follow_up_question: followUp.question,
        follow_up_answer: followUpAnswer || null,
        input_language_hint: languageHint,
        input_mode: usedVoiceInput ? "voice" : "text",
        adaptive_position: immersiveScannerRoute ? "top-right" : "default",
      },
    });

    setSubmitting(true);
    setError("");
    try {
      const result = await submitFeedback(payload);
      pushAppToast({
        title: result.deduplicated ? "Feedback already received" : "Feedback sent",
        description: result.deduplicated
          ? "We already captured a very similar note just now."
          : "Thanks. Route, action, and device context were attached automatically.",
        tone: "success",
      });
      resetForm();
      close();
    } catch (submitError) {
      if (isOfflineLikeError(submitError)) {
        await queuePayload(payload);
        return;
      }
      setError(formatApiErrorMessage(submitError, "Could not send feedback right now."));
    } finally {
      setSubmitting(false);
    }
  };

  const buttonClassName = immersiveScannerRoute
    ? "safe-fixed-right safe-top-inset fixed right-3 top-3 z-[58] inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[rgba(62,166,255,0.28)] bg-[rgba(12,16,26,0.96)] px-3 py-2 text-sm font-semibold text-[var(--text)] shadow-[0_12px_30px_rgba(3,8,20,0.35)] transition hover:border-[rgba(62,166,255,0.48)] hover:bg-[rgba(20,24,36,0.98)]"
    : "fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] left-[calc(env(safe-area-inset-left,0px)+1rem)] z-[45] inline-flex min-h-11 items-center gap-2 rounded-full border border-[rgba(62,166,255,0.28)] bg-[rgba(12,16,26,0.96)] px-4 py-2 text-sm font-semibold text-[var(--text)] shadow-[0_12px_30px_rgba(3,8,20,0.35)] transition hover:border-[rgba(62,166,255,0.48)] hover:bg-[rgba(20,24,36,0.98)] lg:bottom-[7rem] lg:left-auto lg:right-6";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName}
        data-feedback-ignore-action="true"
        aria-label="Open feedback"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(62,166,255,0.16)] text-xs">
          ?
        </span>
        {!immersiveScannerRoute ? <span>Help</span> : null}
        {queuedCount > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-[#08101D]">
            {queuedCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[75] flex items-end justify-center bg-[rgba(3,8,20,0.72)] px-3 py-0 backdrop-blur-sm animate-[feedback-fade-in_160ms_ease-out] lg:items-center lg:px-4 lg:py-6">
          <button
            type="button"
            className="absolute inset-0"
            onClick={close}
            aria-label="Close feedback"
            data-feedback-ignore-action="true"
          />
          <div
            className="relative z-10 w-full max-w-xl rounded-t-[2rem] border border-[var(--border)] bg-[rgba(11,16,25,0.98)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-5 shadow-2xl animate-[feedback-sheet-in_190ms_ease-out] lg:rounded-[2rem] lg:p-6"
            data-feedback-ignore-action="true"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                  Feedback
                </div>
                <h2 className="mt-2 text-xl font-semibold text-white">Tell us what happened</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Under 10 seconds. We attach page, action, timezone, and recent error context automatically.
                </p>
              </div>
              <Button variant="ghost" onClick={close} className="px-3 py-2 text-xs">
                Close
              </Button>
            </div>

            <div className="mt-5">
              <div className="text-sm font-semibold text-white">Type</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "min-h-11 rounded-[1.25rem] border px-3 py-3 text-left text-sm transition",
                      feedbackType === option.value
                        ? "border-[rgba(62,166,255,0.45)] bg-[rgba(62,166,255,0.12)] text-white"
                        : "border-[var(--border)] bg-[var(--card-strong)] text-[var(--muted)] hover:border-[rgba(62,166,255,0.28)] hover:text-white",
                    )}
                    onClick={() => {
                      setFeedbackType(option.value);
                      setFollowUpAnswer("");
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <div className="text-sm font-semibold text-white">Mood</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {MOOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "min-h-11 rounded-full border px-3 py-2 text-sm transition",
                      mood === option.value
                        ? "border-[rgba(62,166,255,0.45)] bg-[rgba(62,166,255,0.12)] text-white"
                        : "border-[var(--border)] bg-[rgba(20,24,36,0.86)] text-[var(--muted)] hover:text-white",
                    )}
                    onClick={() => setMood(mood === option.value ? null : option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <div className="text-sm font-semibold text-white">{followUp.question}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {followUp.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "min-h-11 rounded-full border px-3 py-2 text-sm transition",
                      followUpAnswer === option.value
                        ? "border-[rgba(62,166,255,0.45)] bg-[rgba(62,166,255,0.12)] text-white"
                        : "border-[var(--border)] bg-[rgba(20,24,36,0.86)] text-[var(--muted)] hover:text-white",
                    )}
                    onClick={() => setFollowUpAnswer(followUpAnswer === option.value ? "" : option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <label className="text-sm font-semibold text-white">{activeType.helper}</label>
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={4}
                  maxLength={4000}
                  placeholder="Example: I opened the report, changed the date, and the screen stopped responding."
                  className="min-h-[7rem]"
                />
                {voiceDraft ? (
                  <div className="mt-2 text-xs text-[var(--accent)]">Listening: {voiceDraft}</div>
                ) : null}
                <div className="mt-2 flex items-center justify-between text-xs text-[var(--muted)]">
                  <span>Hindi and English notes are auto-detected. Translation runs when available.</span>
                  <span>{trimJoin([message, voiceDraft]).length}/4000</span>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    Voice Language
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {LANGUAGE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          "min-h-11 rounded-full border px-3 py-2 text-sm transition",
                          languageHint === option.value
                            ? "border-[rgba(62,166,255,0.45)] bg-[rgba(62,166,255,0.12)] text-white"
                            : "border-[var(--border)] bg-[rgba(20,24,36,0.86)] text-[var(--muted)] hover:text-white",
                        )}
                        onClick={() => setLanguageHint(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  variant={listening ? "outline" : "primary"}
                  onClick={listening ? stopVoiceCapture : startVoiceCapture}
                  disabled={!voiceSupported}
                  className="min-h-11 w-full sm:min-w-[10rem]"
                >
                  {voiceSupported
                    ? listening
                      ? "Stop voice"
                      : "Use voice"
                    : "Voice unavailable"}
                </Button>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-[var(--muted)]">
                {queuedCount > 0
                  ? `${queuedCount} feedback item(s) waiting to sync.`
                  : "Usually under 10 seconds."}
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="outline" onClick={close} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={() => void handleSubmit()} disabled={submitting}>
                  {submitting ? "Sending..." : "Send feedback"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
