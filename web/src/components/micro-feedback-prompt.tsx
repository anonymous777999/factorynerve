"use client";

import { useEffect, useRef, useState } from "react";

import { ApiError, formatApiErrorMessage } from "@/lib/api";
import {
  getRecentFeedbackAction,
  RECENT_FEEDBACK_ACTION_EVENT,
  type RecentFeedbackAction,
} from "@/lib/feedback-context";
import { submitFeedback, type FeedbackRating, type SubmitFeedbackPayload } from "@/lib/feedback";
import { buildSubmitFeedbackPayload } from "@/lib/feedback-submit";
import { enqueueFeedback } from "@/lib/offline-feedback";
import { pushAppToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AppLanguage } from "@/lib/i18n";

type Props = {
  pathname: string;
  userId: number | null;
  activeFactoryName?: string | null;
  organizationName?: string | null;
  role?: string | null;
  appLanguage: AppLanguage;
};

const MICRO_COOLDOWN_KEY = "dpr:feedback:micro:last-shown";
const PROMPT_TTL_MS = 5000;
const ACTION_RE = /save|submit|approve|download|verify|send|refresh|sync|mark/i;

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

function shouldPrompt(action: RecentFeedbackAction | null) {
  if (!action) return false;
  if (action.kind === "submit") return true;
  return action.kind === "click" && ACTION_RE.test(action.label);
}

function recentlyShown() {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(MICRO_COOLDOWN_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < 90_000;
  } catch {
    return false;
  }
}

function markShownNow() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MICRO_COOLDOWN_KEY, String(Date.now()));
  } catch {
    // Ignore storage issues.
  }
}

export function MicroFeedbackPrompt({
  pathname,
  userId,
  activeFactoryName,
  organizationName,
  role,
  appLanguage,
}: Props) {
  const [action, setAction] = useState<RecentFeedbackAction | null>(null);
  const [visible, setVisible] = useState(false);
  const [comment, setComment] = useState("");
  const [selectedRating, setSelectedRating] = useState<FeedbackRating | null>(null);
  const [busy, setBusy] = useState(false);
  const dismissTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return;

    const openPrompt = (nextAction: RecentFeedbackAction | null) => {
      if (!shouldPrompt(nextAction) || recentlyShown()) return;
      markShownNow();
      setAction(nextAction);
      setVisible(true);
      setSelectedRating(null);
      setComment("");
      if (dismissTimerRef.current) {
        window.clearTimeout(dismissTimerRef.current);
      }
      dismissTimerRef.current = window.setTimeout(() => {
        setVisible(false);
      }, PROMPT_TTL_MS);
    };

    const onRecentAction = (event: Event) => {
      const detail = (event as CustomEvent<RecentFeedbackAction>).detail;
      openPrompt(detail);
    };

    window.addEventListener(RECENT_FEEDBACK_ACTION_EVENT, onRecentAction as EventListener);
    const latest = getRecentFeedbackAction();
    if (shouldPrompt(latest)) {
      // Do not auto-open from old stored actions on mount.
    }
    return () => {
      window.removeEventListener(RECENT_FEEDBACK_ACTION_EVENT, onRecentAction as EventListener);
      if (dismissTimerRef.current) {
        window.clearTimeout(dismissTimerRef.current);
      }
    };
  }, [userId]);

  if (!userId || !visible || !action) {
    return null;
  }

  const close = () => {
    setVisible(false);
    setSelectedRating(null);
    setComment("");
  };

  const queuePayload = async (payload: SubmitFeedbackPayload) => {
    await enqueueFeedback(userId, payload);
    pushAppToast({
      title: "Feedback saved offline",
      description: "We will send it when the connection comes back.",
      tone: "info",
    });
    close();
  };

  const sendMicroFeedback = async (rating: FeedbackRating, note?: string) => {
    const messageOriginal =
      note?.trim() ||
      (rating === "up"
        ? `Helpful after: ${action.label}`
        : `Not helpful after: ${action.label}`);
    const payload = buildSubmitFeedbackPayload({
      type: rating === "up" ? "suggestion" : "issue",
      source: "micro",
      channel: "text",
      rating,
      messageOriginal,
      pathname,
      appLanguage,
      activeFactoryName,
      organizationName,
      role,
      contextPatch: {
        micro_feedback_for_action: action.label,
        micro_feedback_action_kind: action.kind,
      },
    });

    setBusy(true);
    try {
      await submitFeedback(payload);
      pushAppToast({
        title: "Feedback sent",
        description: "Thanks for the quick signal.",
        tone: "success",
      });
      close();
    } catch (submitError) {
      if (isOfflineLikeError(submitError)) {
        await queuePayload(payload);
        return;
      }
      pushAppToast({
        title: "Could not send feedback",
        description: formatApiErrorMessage(submitError, "Please try again."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+8.75rem)] left-1/2 z-[60] w-[min(92vw,24rem)] -translate-x-1/2 rounded-[1.5rem] border border-[var(--border)] bg-[rgba(10,14,22,0.97)] p-4 shadow-[0_18px_60px_rgba(3,8,20,0.45)] animate-[feedback-sheet-in_180ms_ease-out] lg:bottom-6"
      data-feedback-ignore-action="true"
    >
      <div className="text-sm font-semibold text-white">Was this helpful?</div>
      <div className="mt-1 text-xs text-[var(--muted)]">{action.label}</div>

      <div className="mt-3 flex gap-2">
        <Button
          variant={selectedRating === "up" ? "primary" : "outline"}
          className="min-h-11 flex-1"
          onClick={() => {
            setSelectedRating("up");
            void sendMicroFeedback("up");
          }}
          disabled={busy}
        >
          Helpful
        </Button>
        <Button
          variant={selectedRating === "down" ? "primary" : "outline"}
          className="min-h-11 flex-1"
          onClick={() => setSelectedRating("down")}
          disabled={busy}
        >
          Not Helpful
        </Button>
      </div>

      {selectedRating === "down" ? (
        <div className="mt-3 space-y-3">
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Optional one-line comment"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close} disabled={busy}>
              Skip
            </Button>
            <Button onClick={() => void sendMicroFeedback("down", comment)} disabled={busy}>
              {busy ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" onClick={close} disabled={busy}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
