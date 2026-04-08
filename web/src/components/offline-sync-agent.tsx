"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { getMe } from "@/lib/auth";
import { createEntry, getEntryConflict } from "@/lib/entries";
import { countQueuedEntries, flushQueue } from "@/lib/offline-entries";
import { pushAppToast } from "@/lib/toast";

export function OfflineSyncAgent() {
  const pathname = usePathname() || "/";
  const syncingRef = useRef(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      pathname === "/login" ||
      pathname === "/register" ||
      pathname === "/forgot-password" ||
      pathname === "/reset-password"
    ) {
      return;
    }
    let cancelled = false;

    const syncQueuedEntries = async (options?: { announceReconnect?: boolean }) => {
      if (cancelled || syncingRef.current || !navigator.onLine) return;
      syncingRef.current = true;
      try {
        const user = await getMe({ timeoutMs: 4000 });
        const queueCount = await countQueuedEntries(user.id);
        if (!queueCount) {
          if (options?.announceReconnect) {
            pushAppToast({
              title: "Back online",
              description: "FactoryNerve is connected again. Live data and workspace refresh are available.",
              tone: "success",
              durationMs: 4200,
            });
          }
          return;
        }

        const result = await flushQueue(user.id, async (payload) => {
          try {
            const entry = await createEntry(payload);
            return { status: "sent" as const, entryId: entry.id };
          } catch (error) {
            const conflict = getEntryConflict(error);
            if (conflict) {
              return {
                status: "duplicate" as const,
                entryId: conflict.entryId ?? null,
                message: conflict.message,
              };
            }
            throw error;
          }
        });

        const parts: string[] = [];
        if (result.sent) parts.push(`${result.sent} synced`);
        if (result.duplicates) parts.push(`${result.duplicates} duplicate`);
        if (result.failed) parts.push(`${result.failed} still waiting`);

        if (parts.length) {
          pushAppToast({
            title: result.failed ? "Offline sync finished with issues" : "Offline work synced",
            description: parts.join(", "),
            tone: result.failed ? "error" : "success",
            durationMs: 5200,
          });
        }
      } catch {
        // Silent by design: page-level UI can surface explicit sync failures.
      } finally {
        syncingRef.current = false;
      }
    };

    const onOnline = () => {
      const announceReconnect = wasOfflineRef.current;
      wasOfflineRef.current = false;
      void syncQueuedEntries({ announceReconnect });
    };

    const onOffline = () => {
      if (wasOfflineRef.current) return;
      wasOfflineRef.current = true;
      pushAppToast({
        title: "You are offline",
        description: "Saved drafts and queued entries stay on this device until the connection returns.",
        tone: "info",
        durationMs: 5000,
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncQueuedEntries();
      }
    };

    wasOfflineRef.current = !navigator.onLine;

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncQueuedEntries();
      }
    }, 60000);

    void syncQueuedEntries();

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(timer);
    };
  }, [pathname]);

  return null;
}
