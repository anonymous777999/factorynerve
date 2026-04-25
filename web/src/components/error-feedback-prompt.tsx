"use client";

import { useEffect, useState } from "react";

import { ApiError, formatApiErrorMessage } from "@/lib/api";
import { submitFeedback, type SubmitFeedbackPayload } from "@/lib/feedback";
import { buildSubmitFeedbackPayload } from "@/lib/feedback-submit";
import { enqueueFeedback } from "@/lib/offline-feedback";
import {
  FRONTEND_ERROR_RECORDED_EVENT,
  getRecentFrontendErrorSnapshot,
  type FrontendErrorSnapshot,
} from "@/lib/observability";
import { pushAppToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import type { AppLanguage } from "@/lib/i18n";

type Props = {
  pathname: string;
  userId: number | null;
  activeFactoryName?: string | null;
  organizationName?: string | null;
  role?: string | null;
  appLanguage: AppLanguage;
};

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

export function ErrorFeedbackPrompt({
  pathname,
  userId,
  activeFactoryName,
  organizationName,
  role,
  appLanguage,
}: Props) {
  const [snapshot, setSnapshot] = useState<FrontendErrorSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    const onErrorRecorded = (event: Event) => {
      const detail = (event as CustomEvent<FrontendErrorSnapshot>).detail;
      setSnapshot(detail || getRecentFrontendErrorSnapshot());
    };

    window.addEventListener(FRONTEND_ERROR_RECORDED_EVENT, onErrorRecorded as EventListener);
    return () => {
      window.removeEventListener(FRONTEND_ERROR_RECORDED_EVENT, onErrorRecorded as EventListener);
    };
  }, [userId]);

  if (!userId || !snapshot) {
    return null;
  }

  const close = () => {
    setSnapshot(null);
  };

  const queuePayload = async (payload: SubmitFeedbackPayload) => {
    await enqueueFeedback(userId, payload);
    pushAppToast({
      title: "Issue report saved offline",
      description: "We will send it automatically when the connection returns.",
      tone: "info",
    });
    close();
  };

  const handleReport = async () => {
    const payload = buildSubmitFeedbackPayload({
      type: "bug",
      source: "error_prompt",
      channel: "text",
      rating: "down",
      messageOriginal: `Error report: ${snapshot.message}`,
      preferredLanguage: appLanguage,
      pathname,
      appLanguage,
      activeFactoryName,
      organizationName,
      role,
      contextPatch: {
        triggered_by_frontend_error: true,
        recent_error: snapshot,
      },
    });

    setBusy(true);
    try {
      await submitFeedback(payload);
      pushAppToast({
        title: "Issue report sent",
        description: "The error context was attached automatically.",
        tone: "success",
      });
      close();
    } catch (submitError) {
      if (isOfflineLikeError(submitError)) {
        await queuePayload(payload);
        return;
      }
      pushAppToast({
        title: "Could not report the issue",
        description: formatApiErrorMessage(submitError, "Please try again."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="safe-fixed-right fixed right-4 top-[calc(env(safe-area-inset-top,0px)+5rem)] z-[72] w-[min(92vw,24rem)] rounded-[1.4rem] border border-red-400/20 bg-[rgba(24,10,12,0.97)] p-4 shadow-[0_18px_60px_rgba(3,8,20,0.45)] animate-[feedback-sheet-in_180ms_ease-out]"
      data-feedback-ignore-action="true"
    >
      <div className="text-sm font-semibold text-white">Report this issue?</div>
      <div className="mt-2 text-sm text-red-100">{snapshot.message}</div>
      <div className="mt-1 text-xs text-red-100/70">
        One click sends the route, device, and recent error details.
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={close} disabled={busy}>
          Dismiss
        </Button>
        <Button onClick={() => void handleReport()} disabled={busy}>
          {busy ? "Sending..." : "Report issue"}
        </Button>
      </div>
    </div>
  );
}
