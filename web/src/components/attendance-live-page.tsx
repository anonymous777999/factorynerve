"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createDataTableColumnHelper,
  type DataTableColumnDef,
} from "@/components/ui/data-table/data-table-types";
import { DataTable } from "@/components/ui/data-table/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { OperationalPageShell } from "@/components/ui/operational-page-shell";
import {
  formatAttendanceStatusLabel,
  getLiveAttendance,
  type AttendanceLiveRow,
} from "@/lib/attendance";
import { useI18n, useI18nNamespaces } from "@/lib/i18n";
import { queryKeys } from "@/lib/query-keys";
import { useSession } from "@/lib/use-session";

type AttendanceFilter = "all" | "working" | "not_punched" | "completed" | "missed_punch";

type AttendanceRow = AttendanceLiveRow & {
  rowId: string;
};

const columnHelper = createDataTableColumnHelper<AttendanceRow>();

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function canReviewAttendance(role?: string | null) {
  return ["supervisor", "manager", "admin", "owner"].includes(role || "");
}

function formatDateTime(value?: string | null, locale = "en-IN") {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutes(value: number) {
  if (!value) return "0h 0m";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours}h ${minutes}m`;
}

function statusToBadge(status: AttendanceLiveRow["status"]) {
  switch (status) {
    case "missed_punch":
      return "destructive";
    case "working":
      return "success";
    case "completed":
      return "info";
    default:
      return "warning";
  }
}

function shiftLabel(value?: string | null) {
  if (!value) return "-";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function AttendanceLivePage() {
  const { locale, t } = useI18n();
  useI18nNamespaces(["common", "attendance"]);

  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, activeFactory, loading, error: sessionError } = useSession();

  const attendanceDate = searchParams.get("attendance_date")?.trim() || todayValue();
  const filter = (searchParams.get("status")?.trim() as AttendanceFilter) || "all";
  const liveMode = searchParams.get("live") !== "false";
  const canReview = canReviewAttendance(user?.role);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (!value) {
          next.delete(key);
          return;
        }
        next.set(key, value);
      });
      const query = next.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const attendanceQuery = useQuery({
    queryKey: queryKeys.attendance.live({ attendanceDate }),
    queryFn: () => getLiveAttendance(attendanceDate),
    enabled: Boolean(user) && canReview,
    refetchInterval: liveMode ? 5_000 : false,
    refetchOnWindowFocus: liveMode,
    staleTime: liveMode ? 0 : 15_000,
  });

  const rows = useMemo<AttendanceRow[]>(
    () =>
      (attendanceQuery.data?.rows ?? []).map((row) => ({
        ...row,
        rowId: String(row.attendance_id ?? row.user_id),
      })),
    [attendanceQuery.data?.rows],
  );

  const filteredRows = useMemo(() => {
    if (filter === "all") {
      return rows;
    }
    return rows.filter((row) => row.status === filter);
  }, [filter, rows]);

  const nextAttentionRow = useMemo(
    () =>
      filteredRows.find((row) => row.status === "missed_punch") ||
      filteredRows.find((row) => row.status === "not_punched") ||
      filteredRows.find((row) => row.status === "working") ||
      filteredRows[0] ||
      null,
    [filteredRows],
  );

  const reviewQueueParams = new URLSearchParams();
  reviewQueueParams.set("attendance_date", attendanceQuery.data?.attendance_date || attendanceDate);
  if (nextAttentionRow?.attendance_id) {
    reviewQueueParams.set("focus", String(nextAttentionRow.attendance_id));
    reviewQueueParams.set("tab", "fix");
  }
  const reviewQueueQuery = reviewQueueParams.toString();
  const reviewQueueHref = reviewQueueQuery ? `/attendance/review?${reviewQueueQuery}` : "/attendance/review";

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor("name", {
          header: t("attendance.live.table.user", "User"),
          cell: (info) => (
            <div className="space-y-xs">
              <div className="font-semibold text-text-primary">{info.getValue()}</div>
              <div className="font-mono text-label-dense text-text-secondary">
                ID {info.row.original.user_code}
              </div>
            </div>
          ),
          meta: { isRowHeader: true },
        }),
        columnHelper.accessor("role", {
          header: t("attendance.live.table.role", "Role"),
        }),
        columnHelper.accessor("department", {
          header: t("attendance.live.table.department", "Department"),
          cell: (info) => info.getValue() || "-",
        }),
        columnHelper.accessor("shift", {
          header: t("attendance.live.table.shift", "Shift"),
          cell: (info) => shiftLabel(info.getValue()),
        }),
        columnHelper.accessor("status", {
          header: t("attendance.live.table.status", "Status"),
          cell: (info) => (
            <Badge status={statusToBadge(info.getValue())} size="compact">
              {formatAttendanceStatusLabel(info.getValue())}
            </Badge>
          ),
        }),
        columnHelper.accessor("punch_in_at", {
          header: t("attendance.live.table.punch_in", "Punch In"),
          cell: (info) => formatDateTime(info.getValue(), locale),
        }),
        columnHelper.accessor("punch_out_at", {
          header: t("attendance.live.table.punch_out", "Punch Out"),
          cell: (info) => formatDateTime(info.getValue(), locale),
        }),
        columnHelper.accessor("worked_minutes", {
          header: t("attendance.live.table.worked", "Worked"),
          cell: (info) => (
            <span className="font-mono tabular-nums text-text-primary">
              {formatMinutes(info.getValue())}
            </span>
          ),
        }),
      ] as DataTableColumnDef<AttendanceRow, unknown>[],
    [locale, t],
  );

  const liveMetrics = useMemo(
    () => [
      {
        id: "factory",
        label: t("attendance.live.cards.factory", "Factory"),
        value: attendanceQuery.data?.factory_name || activeFactory?.name || user?.factory_name || "-",
        detail: t("attendance.live.cards.date", "{{value}}", {
          value: attendanceQuery.data?.attendance_date || attendanceDate,
        }),
      },
      {
        id: "working",
        label: t("attendance.live.cards.working", "Working"),
        value: attendanceQuery.data?.totals.working || 0,
        detail: t("attendance.live.cards.working_detail", "Open punch."),
        tone: "success" as const,
      },
      {
        id: "closed",
        label: t("attendance.live.cards.closed", "Closed"),
        value: attendanceQuery.data?.totals.completed || 0,
        detail: t("attendance.live.cards.closed_detail", "Closed rows."),
        tone: "synced" as const,
      },
      {
        id: "not_punched",
        label: t("attendance.live.cards.not_punched", "Not Punched"),
        value: attendanceQuery.data?.totals.not_punched || 0,
        detail: t("attendance.live.cards.not_punched_detail", "Punch missing."),
        tone: "warning" as const,
      },
    ],
    [activeFactory?.name, attendanceDate, attendanceQuery.data, t, user?.factory_name],
  );

  const filterBar = (
    <FilterBar
      fields={[
        {
          id: "attendance_date",
          label: t("attendance.live.filters.date", "Attendance Date"),
          type: "date",
          value: attendanceDate,
          onValueChange: (value) => updateParams({ attendance_date: value }),
        },
        {
          id: "status",
          label: "Status",
          type: "select",
          value: filter,
          onValueChange: (value) => updateParams({ status: value === "all" ? null : value }),
          options: [
            { label: t("attendance.live.filters.working", "Working"), value: "working" },
            { label: t("attendance.live.filters.missed_punch", "Missed Punch"), value: "missed_punch" },
            { label: t("attendance.live.filters.not_punched", "Not Punched"), value: "not_punched" },
            { label: t("attendance.live.filters.completed", "Closed"), value: "completed" },
          ],
          placeholder: t("attendance.live.filters.all", "All"),
        },
      ]}
      activeFilters={[
        filter !== "all"
          ? {
              id: "status",
              label: "Status",
              value: filter.replaceAll("_", " "),
              onClear: () => updateParams({ status: null }),
            }
          : null,
        attendanceDate !== todayValue()
          ? {
              id: "attendance_date",
              label: "Date",
              value: attendanceDate,
              onClear: () => updateParams({ attendance_date: todayValue() }),
            }
          : null,
      ].filter(Boolean) as Array<{ id: string; label: string; value: string; onClear: () => void }>}
      onClearAll={() => updateParams({ attendance_date: todayValue(), status: null })}
    />
  );

  if (loading || (!attendanceQuery.data && attendanceQuery.isLoading && user && canReview)) {
    return (
      <OperationalPageShell
        eyebrow={t("attendance.live.title", "Attendance Board")}
        title={t("attendance.live.hero.title", "Live attendance")}
        description={t("attendance.live.hero.subtitle", "Next signal first.")}
        isLoading
        loadingTitle="Loading attendance board"
        metrics={[]}
      >
        <div />
      </OperationalPageShell>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{t("attendance.live.title", "Attendance Board")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-status-danger-fg">
              {sessionError || t("attendance.live.sign_in_required", "Please sign in to continue.")}
            </div>
            <Link href="/access">
              <Button>{t("dashboard.action.open_login", "Open Access")}</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!canReview) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{t("attendance.live.title", "Attendance Board")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-text-secondary">
              {t("attendance.live.restricted", "Live attendance is available to supervisor, manager, admin, and owner roles.")}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/attendance">
                <Button>{t("attendance.live.open_my_attendance", "Open My Attendance")}</Button>
              </Link>
              <Link href="/work-queue">
                <Button variant="outline">{t("attendance.live.work_queue", "Work Queue")}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <OperationalPageShell
      eyebrow={t("attendance.live.title", "Attendance Board")}
      title={t("attendance.live.hero.title", "Live attendance")}
      description={
        attendanceQuery.isFetching && attendanceQuery.data
          ? "Updating in the background."
          : liveMode
            ? "Automatic refresh every 5 seconds. Filters stay in the URL."
            : "Background refresh paused. Filters stay in the URL."
      }
      liveIndicator={liveMode}
      liveLabel={liveMode ? "Live mode on" : "Live mode off"}
      tone={liveMode ? undefined : "paused"}
      toneLabel={liveMode ? undefined : "Live mode off"}
      metrics={liveMetrics}
      filters={filterBar}
      actions={[
        {
          id: "open-review-queue",
          label: t("attendance.live.tools.review_queue", "Review Queue"),
          onAction: () => router.push(reviewQueueHref),
        },
        {
          id: "toggle-live",
          label: liveMode ? "Pause live" : "Resume live",
          variant: "outline",
          onAction: () => updateParams({ live: liveMode ? "false" : "true" }),
        },
        {
          id: "refresh-live",
          label: attendanceQuery.isFetching ? "Refreshing" : t("common.refresh", "Refresh"),
          variant: "ghost",
          onAction: () => {
            void attendanceQuery.refetch();
          },
        },
      ]}
    >
      <LoadingBoundary
        isLoading={attendanceQuery.isLoading}
        isFetching={attendanceQuery.isFetching}
        isError={attendanceQuery.isError}
        error={attendanceQuery.error ?? null}
        hasData={rows.length > 0}
        isEmpty={filteredRows.length === 0}
        onRetry={() => {
          void attendanceQuery.refetch();
        }}
        emptyFallback={
          <EmptyState
            title={t("attendance.live.table.no_rows", "No attendance rows match this filter yet.")}
            description="Clear the live filters or pick another date to widen the board."
            action={
              <Button variant="outline" onClick={() => updateParams({ attendance_date: todayValue(), status: null })}>
                Clear filters
              </Button>
            }
          />
        }
      >
        <DataTable<AttendanceRow>
          ariaLabel="Attendance live rows"
          columns={columns}
          data={filteredRows}
          activeRowId={nextAttentionRow?.rowId ?? null}
          getRowState={(row) => (row.status === "missed_punch" ? "processing" : null)}
          enableSorting
          emptyMessage={t("attendance.live.table.no_rows", "No attendance rows match this filter yet.")}
          emptyTitle="No matching rows"
          onRowClick={(row) => {
            const params = new URLSearchParams();
            params.set("attendance_date", attendanceQuery.data?.attendance_date || attendanceDate);
            if (row.attendance_id) {
              params.set("focus", String(row.attendance_id));
              params.set("tab", "fix");
            }
            router.push(`/attendance/review?${params.toString()}`);
          }}
        />
      </LoadingBoundary>
    </OperationalPageShell>
  );
}
