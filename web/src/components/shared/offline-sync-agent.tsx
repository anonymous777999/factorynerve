"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { getMe } from "@/lib/auth";
import { createEntry, getEntryConflict } from "@/lib/entries";
import { countQueuedEntries, flushQueue } from "@/lib/offline-entries";

export function OfflineSyncAgent() {
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

    const syncQueuedEntries = async () => {
      if (cancelled || syncingRef.current || !navigator.onLine) return;
      syncingRef.current = true;
      try {
        const user = await getMe({ timeoutMs: 4000 });
        const queueCount = await countQueuedEntries(user.id);
        if (!queueCount) return;

        await flushQueue(user.id, async (payload) => {
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
      } catch {
        // Silent by design: page-level UI can surface explicit sync failures.
      } finally {
        syncingRef.current = false;
      }
    };

    const onOnline = () => {
      void syncQueuedEntries();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncQueuedEntries();
      }
    };

    window.addEventListener("online", onOnline);
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
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(timer);
    };
  }, [pathname]);

  return null;
}
