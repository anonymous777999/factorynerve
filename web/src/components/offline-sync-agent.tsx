"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { getMe } from "@/lib/auth";
import { createEntry, getEntryConflict } from "@/lib/entries";
import { countQueuedEntries, flushQueue } from "@/lib/offline-entries";
import { patchPwaSyncState } from "@/lib/pwa-sync-state";
import { pushAppToast } from "@/lib/toast";

export function OfflineSyncAgent() {
  const pathname = usePathname() || "/";
  const syncingRef = useRef(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      pathname === "/access" ||
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
      patchPwaSyncState({
        syncStatus: "checking",
        lastCheckedAt: new Date().toISOString(),
        lastOnlineAt: new Date().toISOString(),
        lastError: null,
      });
      try {
        const user = await getMe({ timeoutMs: 4000 });
        const queueCount = await countQueuedEntries(user.id);
        if (!queueCount) {
          const checkedAt = new Date().toISOString();
          patchPwaSyncState({
            queueCount: 0,
            syncStatus: "empty",
            lastCheckedAt: checkedAt,
            lastSyncAt: checkedAt,
            lastSummary: options?.announceReconnect
              ? "Back online. No queued entries are waiting."
              : "Queue clear. No offline entry sync needed.",
            lastError: null,
            lastOnlineAt: checkedAt,
          });
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

        patchPwaSyncState({
          queueCount: result.remaining,
          syncStatus: result.failed ? "partial" : "success",
          lastCheckedAt: new Date().toISOString(),
          lastSyncAt: new Date().toISOString(),
          lastSummary:
            parts.join(", ") ||
            (result.remaining ? `${result.remaining} queued entries still waiting.` : "Queue clear after sync."),
          lastError: result.failed ? `${result.failed} queued entr${result.failed === 1 ? "y is" : "ies are"} still waiting.` : null,
          lastOnlineAt: new Date().toISOString(),
        });
      } catch {
        patchPwaSyncState({
          syncStatus: "error",
          lastCheckedAt: new Date().toISOString(),
          lastSummary: "Sync attempt did not complete. The app will retry when the session is visible again.",
          lastError: "FactoryNerve could not finish the queued-entry sync attempt.",
          lastOnlineAt: new Date().toISOString(),
        });
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
      patchPwaSyncState({
        syncStatus: "offline",
        lastCheckedAt: new Date().toISOString(),
        lastOfflineAt: new Date().toISOString(),
        lastSummary: "Device is offline. Saved drafts and queued entries will wait on this device.",
      });
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
    patchPwaSyncState({
      syncStatus: navigator.onLine ? "idle" : "offline",
      lastCheckedAt: new Date().toISOString(),
      lastOnlineAt: navigator.onLine ? new Date().toISOString() : "",
      lastOfflineAt: navigator.onLine ? "" : new Date().toISOString(),
      lastSummary: navigator.onLine
        ? "Online. FactoryNerve can check queued entry sync."
        : "Offline. Queued entries stay on this device until the connection returns.",
    });

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
