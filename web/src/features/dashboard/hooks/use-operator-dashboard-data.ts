"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getMyAttendanceToday, type AttendanceToday } from "@/lib/attendance";
import { listUnreadAlerts, markAlertRead, type AlertItem } from "@/lib/dashboard";
import { getTodayEntries, type Entry } from "@/lib/entries";
import { countQueuedEntries, flushQueue, loadDraft, subscribeToQueueUpdates, type EntryDraft } from "@/lib/offline-entries";
import { signalWorkflowRefresh, subscribeToWorkflowRefresh } from "@/lib/workflow-sync";
import { createEntry, getEntryConflict } from "@/lib/entries";
import { ApiError } from "@/lib/api";

import { ALL_SHIFTS } from "../lib/dashboard-helpers";

type Result = {
    attendanceToday: AttendanceToday | null;
    todayEntries: Entry[];
    alerts: AlertItem[];
    draft: EntryDraft | null;
    queueCount: number;
    loading: boolean;
    online: boolean;
    syncing: boolean;
    status: string;
    error: string;
    setStatus: (value: string) => void;
    setError: (value: string) => void;
    pendingShifts: number;
    completedShifts: number;
    todayShiftCards: Array<{ shift: typeof ALL_SHIFTS[number]; entry: Entry | null }>;
    onSync: () => void;
    onMarkAlertRead: (alertId: number) => void;
    reload: () => void;
};

/**
 * useOperatorDashboardData — minimal data hook for the operator dashboard.
 *
 * Fetches only what the operator workspace needs:
 *   - Today's entries (for shift status cards)
 *   - Unread alerts
 *   - Today's attendance
 *   - Offline queue count + active draft
 *
 * Skips: weekly analytics, OCR summary, anomaly preview, monthly entries,
 *        usage. Those are management-only.
 *
 * The hook also owns the queue sync handler and alert mark-read handler
 * so the workspace stays presentational.
 */
export function useOperatorDashboardData(userId: number | null) {
    const [attendanceToday, setAttendanceToday] = useState<AttendanceToday | null>(null);
    const [todayEntries, setTodayEntries] = useState<Entry[]>([]);
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [draft, setDraft] = useState<EntryDraft | null>(null);
    const [queueCount, setQueueCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [online, setOnline] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        if (userId == null) return;
        setLoading(true);
        setError("");
        try {
            const [todayResult, alertsResult, queueResult, attendanceResult, draftResult] =
                await Promise.allSettled([
                    getTodayEntries(),
                    listUnreadAlerts(),
                    countQueuedEntries(userId),
                    getMyAttendanceToday(),
                    loadDraft(userId),
                ]);

            if (todayResult.status === "fulfilled") setTodayEntries(todayResult.value);
            if (alertsResult.status === "fulfilled") setAlerts(alertsResult.value);
            if (queueResult.status === "fulfilled") setQueueCount(queueResult.value);
            if (attendanceResult.status === "fulfilled") setAttendanceToday(attendanceResult.value);
            if (draftResult.status === "fulfilled") setDraft(draftResult.value);

            const firstError = [todayResult, alertsResult, attendanceResult].find(
                (result) => result.status === "rejected",
            );
            if (firstError && firstError.status === "rejected") {
                setError(
                    firstError.reason instanceof Error
                        ? firstError.reason.message
                        : "Could not load operator dashboard.",
                );
            }
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (userId == null) return;
        void load();
    }, [load, userId]);

    useEffect(() => {
        if (typeof navigator === "undefined") return;
        setOnline(navigator.onLine);
        const onOnline = () => setOnline(true);
        const onOffline = () => setOnline(false);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, []);

    useEffect(() => {
        if (userId == null) return;
        const refreshQueueCount = () => {
            Promise.allSettled([countQueuedEntries(userId), loadDraft(userId)]).then(
                ([queueResult, draftResult]) => {
                    if (queueResult.status === "fulfilled") {
                        setQueueCount(queueResult.value);
                    } else {
                        setQueueCount(0);
                    }
                    if (draftResult.status === "fulfilled") {
                        setDraft(draftResult.value);
                    }
                },
            );
        };
        refreshQueueCount();
        return subscribeToQueueUpdates(refreshQueueCount);
    }, [userId]);

    useEffect(() => {
        if (userId == null) return;
        return subscribeToWorkflowRefresh(() => {
            void load();
        });
    }, [load, userId]);

    const onSync = useCallback(() => {
        if (userId == null) return;
        setSyncing(true);
        setError("");
        flushQueue(userId, async (payload) => {
            try {
                const entry = await createEntry(payload);
                return { status: "sent" as const, entryId: entry.id };
            } catch (err) {
                if (err instanceof ApiError) {
                    const conflict = getEntryConflict(err);
                    if (conflict) {
                        return {
                            status: "duplicate" as const,
                            entryId: conflict.entryId ?? null,
                            message: conflict.message,
                        };
                    }
                }
                throw err;
            }
        })
            .then((result) => {
                setQueueCount(result.remaining);
                if (result.sent || result.duplicates) {
                    setStatus(`Synced ${result.sent} entr${result.sent === 1 ? "y" : "ies"}.`);
                    signalWorkflowRefresh("operator-dashboard-sync");
                }
            })
            .catch((err) => {
                setError(err instanceof Error ? err.message : "Could not sync queued entries.");
            })
            .finally(() => {
                setSyncing(false);
            });
    }, [userId]);

    const onMarkAlertRead = useCallback(async (alertId: number) => {
        try {
            await markAlertRead(alertId);
            setAlerts((current) => current.filter((alert) => alert.id !== alertId));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not mark the alert as read.");
        }
    }, []);

    const completedShifts = todayEntries.length;
    const pendingShifts = useMemo(() => {
        const submitted = new Set(todayEntries.map((entry) => entry.shift));
        return ALL_SHIFTS.filter((shift) => !submitted.has(shift)).length;
    }, [todayEntries]);

    const todayShiftCards = useMemo(() => {
        const entryByShift = new Map(todayEntries.map((entry) => [entry.shift, entry]));
        return ALL_SHIFTS.map((shift) => ({
            shift,
            entry: entryByShift.get(shift) || null,
        }));
    }, [todayEntries]);

    const result: Result = {
        attendanceToday,
        todayEntries,
        alerts,
        draft,
        queueCount,
        loading,
        online,
        syncing,
        status,
        error,
        setStatus,
        setError,
        completedShifts,
        pendingShifts,
        todayShiftCards,
        onSync,
        onMarkAlertRead,
        reload: () => void load(),
    };
    return result;
}
