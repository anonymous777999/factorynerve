"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOfflineStatus } from "./useOfflineStatus";
import {
  countPending,
  subscribe,
  flushAll,
  getQueueSummary,
  type QueuedMutation,
  type SendMutation,
} from "@/lib/offline-queue";

/**
 * P0-4: Hook that manages the offline mutation queue.
 *
 * Features:
 * - Auto-syncs when coming back online
 * - Periodic sync every 60s while visible
 * - Manual sync via `sync()` or keyboard shortcut (Ctrl+Shift+S)
 * - Returns queue count, last sync time, and sync state
 */

export type SyncState = "idle" | "syncing" | "error" | "success";

export function useSyncQueue(userId?: number | null) {
  const { isOnline } = useOfflineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const senderRef = useRef<SendMutation | null>(null);
  const syncingRef = useRef(false);
  const mountedRef = useRef(true);

  // Refresh count from IndexedDB
  const refreshCount = useCallback(async () => {
    try {
      const count = await countPending(userId);
      if (mountedRef.current) setPendingCount(count);
    } catch {
      // Ignore — IndexedDB may not be available
    }
  }, [userId]);

  // Subscribe to queue changes
  useEffect(() => {
    mountedRef.current = true;
    refreshCount();
    const unsub = subscribe(() => {
      void refreshCount();
    });
    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [refreshCount]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !syncingRef.current) {
      void doSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // Periodic sync every 60s while visible
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && isOnline && pendingCount > 0) {
        void doSync();
      }
    }, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, pendingCount]);

  // Keyboard shortcut: Ctrl+Shift+S to sync
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "S") {
        e.preventDefault();
        void doSync();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSync = useCallback(async () => {
    if (syncingRef.current || !senderRef.current) return;
    syncingRef.current = true;
    setSyncState("syncing");
    try {
      await flushAll(userId ?? null, senderRef.current);
      if (mountedRef.current) {
        setSyncState("success");
        setLastSyncAt(new Date());
        await refreshCount();
      }
    } catch {
      if (mountedRef.current) setSyncState("error");
    } finally {
      syncingRef.current = false;
    }
  }, [userId, refreshCount]);

  const registerSender = useCallback((sender: SendMutation) => {
    senderRef.current = sender;
  }, []);

  const sync = useCallback(() => {
    void doSync();
  }, [doSync]);

  return {
    pendingCount,
    lastSyncAt,
    syncState,
    sync,
    registerSender,
    refreshCount,
  };
}
