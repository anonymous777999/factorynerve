"use client";

import { useMemo } from "react";

import { useI18n } from "@/lib/i18n";
import { useSession } from "@/lib/use-session";

import { DashboardPageSkeleton } from "@/components/page-skeletons";

import {
    attendanceStatusTone,
    formatMinutes,
    formatShift,
    todayValue,
} from "../lib/dashboard-helpers";
import { useOperatorDashboardData } from "../hooks/use-operator-dashboard-data";
import { OperatorDashboardWorkspace } from "./operator-dashboard-workspace";

/**
 * OperatorDashboardRoute — standalone operator-only home.
 *
 * This is the entry point for operators landing on `/dashboard`. It uses the
 * minimal `useOperatorDashboardData` hook so we don't fetch management-only
 * payloads (weekly analytics, OCR summary, anomaly preview, monthly entries),
 * and wraps the presentational `OperatorDashboardWorkspace`.
 *
 * The management workspace is dynamic-imported in `app/dashboard/page.tsx`
 * so its bundle never lands on operator devices.
 */
export default function OperatorDashboardRoute() {
    const { t, locale } = useI18n();
    const { user, activeFactory, loading } = useSession();

    const data = useOperatorDashboardData(user?.id ?? null);

    const workerShiftLabel = useMemo(() => {
        const nextPending = data.todayShiftCards.find((card) => !card.entry)?.shift || "morning";
        return formatShift(data.attendanceToday?.shift || data.draft?.shift || nextPending);
    }, [data.attendanceToday?.shift, data.draft?.shift, data.todayShiftCards]);

    const nextPendingShift = useMemo(
        () => data.todayShiftCards.find((card) => !card.entry)?.shift || null,
        [data.todayShiftCards],
    );

    const workerStatus = useMemo(() => {
        if (data.attendanceToday?.status === "working") {
            return {
                label: "ACTIVE",
                tone: attendanceStatusTone("working"),
                title: workerShiftLabel,
                detail: `${formatMinutes(data.attendanceToday.worked_minutes || 0)} worked`,
            };
        }

        if (data.attendanceToday?.status === "late") {
            return {
                label: "LATE",
                tone: attendanceStatusTone("late"),
                title: workerShiftLabel,
                detail: `Punch in for ${workerShiftLabel} shift`,
            };
        }

        if (
            data.attendanceToday?.status === "missed_punch" ||
            data.attendanceToday?.status === "absent"
        ) {
            return {
                label: "MISSED",
                tone: attendanceStatusTone(data.attendanceToday.status),
                title: workerShiftLabel,
                detail: "Attendance needs attention",
            };
        }

        if (data.attendanceToday?.can_punch_in || nextPendingShift || data.draft) {
            return {
                label: "PENDING",
                tone: attendanceStatusTone(
                    data.attendanceToday?.status === "late" ? "late" : "half_day",
                ),
                title: workerShiftLabel,
                detail: data.draft
                    ? `Saved ${formatShift(data.draft.shift)} draft is waiting`
                    : `${workerShiftLabel} shift is ready`,
            };
        }

        return {
            label: "DONE",
            tone: attendanceStatusTone("completed"),
            title: "Today Complete",
            detail: "All shift work looks covered",
        };
    }, [data.attendanceToday, data.draft, nextPendingShift, workerShiftLabel]);

    const workerPrimaryAction = useMemo(() => {
        if (data.attendanceToday?.can_punch_in) {
            return {
                href: "/attendance",
                label: "Start Shift",
                detail: `${workerShiftLabel} shift is ready for punch-in.`,
            };
        }

        if (data.draft) {
            return {
                href: `/entry?date=${data.draft.date}&shift=${data.draft.shift}&focus=draft`,
                label: "Continue Shift",
                detail: `Resume the saved ${formatShift(data.draft.shift)} entry.`,
            };
        }

        if (nextPendingShift) {
            return {
                href: `/entry?date=${todayValue()}&shift=${nextPendingShift}`,
                label: data.completedShifts > 0 ? "Continue Shift" : "Complete Entry",
                detail: `${formatShift(nextPendingShift)} shift is still pending today.`,
            };
        }

        if (data.attendanceToday?.can_punch_out) {
            return {
                href: "/attendance",
                label: "Complete Shift",
                detail: `${workerShiftLabel} shift is ready for punch-out.`,
            };
        }

        if (data.queueCount > 0) {
            return {
                href: "/ocr/scan",
                label: "Scan Paper",
                detail: `${data.queueCount} saved item${data.queueCount === 1 ? "" : "s"} still need processing.`,
            };
        }

        if (data.alerts.length > 0) {
            return {
                href: "/tasks",
                label: "Open My Tasks",
                detail: `${data.alerts.length} follow-up item${data.alerts.length === 1 ? "" : "s"} are waiting.`,
            };
        }

        return {
            href: "/reports?preset=day&focus=production",
            label: "View Report",
            detail: "Today is covered. Open the daily report next.",
        };
    }, [
        data.alerts.length,
        data.attendanceToday,
        data.completedShifts,
        data.draft,
        data.queueCount,
        nextPendingShift,
        workerShiftLabel,
    ]);

    const workerQuickActions = useMemo(
        () => [
            {
                key: "attendance",
                href: "/attendance",
                label: "Attendance",
                meta: data.attendanceToday?.can_punch_in
                    ? "Start"
                    : data.attendanceToday?.can_punch_out
                        ? "Open"
                        : "View",
            },
            {
                key: "scan",
                href: "/ocr/scan",
                label: "Scan Paper",
                meta: data.queueCount > 0 ? `${data.queueCount} saved` : "Open",
            },
            {
                key: "tasks",
                href: "/tasks",
                label: "My Tasks",
                meta: data.alerts.length > 0 ? `${data.alerts.length} pending` : "Open",
            },
        ],
        [data.alerts.length, data.attendanceToday, data.queueCount],
    );

    if (loading || (data.loading && !data.todayEntries.length && !data.alerts.length)) {
        return <DashboardPageSkeleton />;
    }

    if (!user) {
        return null;
    }

    return (
        <OperatorDashboardWorkspace
            factoryName={activeFactory?.name || user.factory_name || "-"}
            online={data.online}
            status={data.status}
            error={data.error}
            workerStatus={workerStatus}
            workerPrimaryAction={workerPrimaryAction}
            workerQuickActions={workerQuickActions}
            completedShifts={data.completedShifts}
            pendingShifts={data.pendingShifts}
            queueCount={data.queueCount}
            onSync={data.onSync}
            syncing={data.syncing}
            alerts={data.alerts.slice(0, 3)}
            todayShiftCards={data.todayShiftCards}
            locale={locale}
            onMarkAlertRead={data.onMarkAlertRead}
        />
    );
}
