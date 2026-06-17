"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { getMe } from "@/lib/auth";
import { listMyFeedbackUpdates, submitFeedback } from "@/lib/feedback";
import { countQueuedFeedback, flushQueuedFeedback } from "@/lib/offline-feedback";
import { pushAppToast } from "@/lib/toast";

const RESOLUTION_SEEN_PREFIX = "dpr:feedback:resolved-seen:";

function storageKey(userId: number) {
  return `${RESOLUTION_SEEN_PREFIX}${userId}`;
}

function getLastSeenResolvedAt(userId: number) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

function setLastSeenResolvedAt(userId: number, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), value);
  } catch {
    // Ignore storage failures.
  }
}

export function FeedbackSyncAgent() {
  const pathname = usePathname() || "/";
  const syncingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      pathname === "/login" ||
      pathname === "/access" ||
      pathname === "/register" ||
      pathname === "/forgot-password" ||
      pathname === "/reset-password"
    ) {
      return;
    }

    let cancelled = false;

    const syncQueuedFeedback = async () => {
      if (cancelled || syncingRef.current || !navigator.onLine) return;
      syncingRef.current = true;
      try {
        const user = await getMe({ timeoutMs: 4000 });
        const queueCount = await countQueuedFeedback(user.id);
        if (queueCount) {
          await flushQueuedFeedback(user.id, async (payload) => {
            await submitFeedback(payload);
          });
        }

        const lastSeenResolvedAt = getLastSeenResolvedAt(user.id);
        const updates = await listMyFeedbackUpdates({
          since: lastSeenResolvedAt,
          limit: 5,
        });
        if (updates.items.length) {
          const ordered = [...updates.items].reverse();
          ordered.forEach((item) => {
            pushAppToast({
              title: "Feedback update",
              description:
                item.resolution_note ||
                `Your ${item.type.replaceAll("_", " ")} report was marked resolved.`,
              tone: "success",
            });
          });
          const newest = updates.items[0]?.resolved_at;
          if (newest) {
            setLastSeenResolvedAt(user.id, newest);
          }
        }
      } catch {
        // Silent by design: the queue and resolution poll will retry later.
      } finally {
        syncingRef.current = false;
      }
    };

    const onOnline = () => {
      void syncQueuedFeedback();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncQueuedFeedback();
      }
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncQueuedFeedback();
      }
    }, 60000);

    void syncQueuedFeedback();

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(timer);
    };
  }, [pathname]);

  return null;
}
