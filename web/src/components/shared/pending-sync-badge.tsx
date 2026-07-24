"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useOfflineStatus } from "@/hooks/useOfflineStatus";
import { subscribe, getQueueSummary } from "@/lib/offline-queue";

type QueueSummary = {
  total: number;
  pending: number;
  syncing: number;
  failed: number;
};

/**
 * P0-4: Badge showing pending sync count and online/offline status.
 *
 * Renders as a floating badge in the bottom-right corner:
 * - Green dot + count: items queued, online
 * - Yellow dot + count: items queued, offline
 * - Red dot: items failed, click to clear
 * - No badge: nothing queued
 */
export function PendingSyncBadge() {
  const { isOnline } = useOfflineStatus();
  const router = useRouter();
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await getQueueSummary();
      setSummary(s);
    } catch {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const unsub = subscribe(() => void refresh());
    const interval = setInterval(() => void refresh(), 30000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [refresh]);

  if (!summary || summary.total === 0) return null;

  const total = summary.pending + summary.failed;
  const hasFailed = summary.failed > 0;

  const indicatorColor = isOnline ? (hasFailed ? "bg-red-500" : "bg-emerald-400") : "bg-amber-400";
  const pulseClass = isOnline && !hasFailed ? "animate-pulse" : "";

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Main badge */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 rounded-full border border-[var(--border)] bg-[rgba(20,24,36,0.95)] px-4 py-2 text-xs font-medium text-[var(--text)] shadow-lg backdrop-blur-sm transition-all hover:scale-105 active:scale-95 ${pulseClass}`}
        title={`${total} pending sync items${isOnline ? "" : " (offline)"}`}
      >
        {/* Status dot */}
        <span className={`h-2.5 w-2.5 rounded-full ${indicatorColor} shadow-sm`} />
        {/* Count */}
        <span className="tabular-nums">{total}</span>
        {hasFailed && <span className="text-red-400">⚠</span>}
        {!isOnline && <span className="text-amber-400">⊘</span>}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="w-64 rounded-xl border border-[var(--border)] bg-[rgba(20,24,36,0.97)] p-3 text-xs shadow-2xl backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-[var(--text)]">Sync Queue</span>
            <span className={isOnline ? "text-emerald-400" : "text-amber-400"}>
              {isOnline ? "● Online" : "○ Offline"}
            </span>
          </div>
          <div className="space-y-1 text-[var(--muted)]">
            <div className="flex justify-between">
              <span>Pending</span>
              <span className="tabular-nums text-[var(--text)]">{summary.pending}</span>
            </div>
            <div className="flex justify-between">
              <span>Failed</span>
              <span className={`tabular-nums ${hasFailed ? "text-red-400" : "text-[var(--text)]"}`}>
                {summary.failed}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total</span>
              <span className="tabular-nums text-[var(--text)]">{summary.total}</span>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={async () => {
                const { flushAll } = await import("@/lib/offline-queue");
                await flushAll(null, async (item) => {
                  try {
                    const res = await fetch(item.endpoint, {
                      method: item.method,
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(item.payload),
                    });
                    if (!res.ok) {
                      return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
                    }
                    return { ok: true };
                  } catch (err) {
                    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
                  }
                });
                await refresh();
              }}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--accent)]/10 px-2 py-1.5 text-center text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
            >
              Sync Now
            </button>
            {hasFailed && (
              <button
                type="button"
                onClick={async () => {
                  const { clearAllFailed } = await import("@/lib/offline-queue");
                  await clearAllFailed();
                  void refresh();
                }}
                className="flex-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1.5 text-center text-red-400 transition-colors hover:bg-red-500/20"
              >
                Clear Failed
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
