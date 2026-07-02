"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import {
  getSteelMachineAlerts,
  type MachineAlertItem,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { DashboardPageSkeleton } from "@/components/shared/page-skeletons";

type SeverityFilter = "all" | "critical" | "high" | "warning";
type AlertTypeFilter = "all" | "mtbf_low" | "overdue_maintenance" | "maintenance_due_soon";
type SortField = "severity" | "machine_name" | "alert_type" | "downtime_minutes";
type SortDir = "asc" | "desc";

function formatMinutes(value: number | null | undefined) {
  const m = value || 0;
  if (m >= 60) return `${(m / 60).toFixed(1)}h`;
  return `${m.toFixed(0)}m`;
}

function alertSeverityBadge(severity: string) {
  if (severity === "critical") return "border-rose-400/35 bg-rose-400/12 text-rose-200";
  if (severity === "high") return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  return "border-amber-400/25 bg-amber-400/8 text-amber-200/80";
}

function alertTypeLabel(alertType: string) {
  switch (alertType) {
    case "mtbf_low": return "Low MTBF";
    case "overdue_maintenance": return "Overdue Maintenance";
    case "maintenance_due_soon": return "Maintenance Due";
    default: return alertType.replace(/_/g, " ");
  }
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) {
    return <span className="ml-1 text-[10px] text-[var(--muted)]">↕</span>;
  }
  return <span className="ml-1 text-[10px]">{sortDir === "asc" ? "↑" : "↓"}</span>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
      {message}
    </div>
  );
}

export function SteelMachineAlertsPage() {
  const { user, activeFactory, loading: sessionLoading } = useSession();
  const [alerts, setAlerts] = useState<MachineAlertItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [typeFilter, setTypeFilter] = useState<AlertTypeFilter>("all");
  const [sortField, setSortField] = useState<SortField>("severity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedAlertKey, setExpandedAlertKey] = useState<string | null>(null);

  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";

  const loadAlerts = useCallback(async () => {
    if (!isSteelFactory) {
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    setError("");
    try {
      const params: Record<string, string> = {};
      if (severityFilter !== "all") params.severity = severityFilter;
      if (typeFilter !== "all") params.alert_type = typeFilter;
      const result = await getSteelMachineAlerts(params);
      setAlerts(result.items || []);
      setTotal(result.total || 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load machine alerts.");
    } finally {
      setPageLoading(false);
    }
  }, [isSteelFactory, severityFilter, typeFilter]);

  useEffect(() => {
    if (!user || !isSteelFactory) {
      setPageLoading(false);
      return;
    }
    void loadAlerts();
  }, [isSteelFactory, loadAlerts, user]);

  // Local sorting (backend already sorts by severity, but we allow changing)
  const sortedAlerts = useMemo(() => {
    const sorted = [...alerts];
    sorted.sort((a, b) => {
      const severityRank: Record<string, number> = { critical: 0, high: 1, warning: 2 };
      let cmp = 0;
      switch (sortField) {
        case "severity":
          cmp = (severityRank[a.severity] ?? 99) - (severityRank[b.severity] ?? 99);
          break;
        case "machine_name":
          cmp = (a.machine_name || "").localeCompare(b.machine_name || "");
          break;
        case "alert_type":
          cmp = a.alert_type.localeCompare(b.alert_type);
          break;
        case "downtime_minutes":
          cmp = a.downtime_minutes - b.downtime_minutes;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [alerts, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  if (sessionLoading || pageLoading) {
    return <DashboardPageSkeleton />;
  }

  if (!isSteelFactory) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8 content-fade-in">
        <div className="mx-auto max-w-4xl text-center">
          <Card>
            <CardHeader>
              <CardTitle>Machine alerts are factory-aware</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-[var(--muted)]">
              <div>Switch into a steel factory from the sidebar to view machine alerts.</div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const highCount = alerts.filter((a) => a.severity === "high").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  const SEVERITY_TABS: Array<{ key: SeverityFilter; label: string; count: number }> = [
    { key: "all", label: "All", count: total },
    { key: "critical", label: "Critical", count: criticalCount },
    { key: "high", label: "High", count: highCount },
    { key: "warning", label: "Warning", count: warningCount },
  ];

  const TYPE_TABS: Array<{ key: AlertTypeFilter; label: string }> = [
    { key: "all", label: "All Types" },
    { key: "mtbf_low", label: "Low MTBF" },
    { key: "overdue_maintenance", label: "Overdue Maint." },
    { key: "maintenance_due_soon", label: "Due Soon" },
  ];

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-prominent text-[var(--accent)]">Machine Alerts</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Machine health alerts &amp; incidents</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Filter and sort machine alerts by severity and type. Alerts are computed from
                MTBF thresholds and maintenance schedules over the last 30 days.
              </p>
            </div>
            <Button variant="outline" onClick={() => void loadAlerts()} disabled={pageLoading}>
              {pageLoading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
        ) : null}

        {/* Severity Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {SEVERITY_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSeverityFilter(tab.key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                severityFilter === tab.key
                  ? "border border-[rgba(62,166,255,0.45)] bg-[rgba(62,166,255,0.14)] text-sky-100 shadow-[0_0_0_1px_rgba(62,166,255,0.15)]"
                  : "border border-[var(--border)] bg-[rgba(20,24,36,0.7)] text-[var(--muted)] hover:border-[rgba(62,166,255,0.28)] hover:bg-[rgba(28,34,51,0.82)]"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Type Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setTypeFilter(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                typeFilter === tab.key
                  ? "border border-[rgba(62,166,255,0.35)] bg-[rgba(62,166,255,0.1)] text-sky-200"
                  : "border border-[var(--border)] bg-[rgba(20,24,36,0.5)] text-[var(--muted)] hover:border-[rgba(62,166,255,0.2)] hover:bg-[rgba(28,34,51,0.72)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Alert Summary Cards */}
        {alerts.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardContent className="pt-4">
                <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Critical</div>
                <div className="mt-1 text-2xl font-bold text-rose-400">{criticalCount}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">MTBF below threshold</div>
              </CardContent>
            </Card>
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardContent className="pt-4">
                <div className="text-xs uppercase tracking-wider text-[var(--muted)]">High</div>
                <div className="mt-1 text-2xl font-bold text-amber-400">{highCount}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">Overdue maintenance</div>
              </CardContent>
            </Card>
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardContent className="pt-4">
                <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Warning</div>
                <div className="mt-1 text-2xl font-bold text-amber-200/80">{warningCount}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">Maintenance due soon</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alert Table */}
        <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
          <CardHeader>
            <CardTitle>Alert History</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedAlerts.length === 0 ? (
              <EmptyState message="No machine alerts for the current filter. All machines are healthy." />
            ) : (
              <ResponsiveScrollArea
                className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                debugLabel="machine-alerts-table"
              >
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[var(--muted)]">
                    <tr className="border-b border-[var(--border)]">
                      <th
                        className="cursor-pointer px-3 py-3 font-medium select-none"
                        onClick={() => toggleSort("severity")}
                      >
                        Severity<SortIcon field="severity" sortField={sortField} sortDir={sortDir} />
                      </th>
                      <th
                        className="cursor-pointer px-3 py-3 font-medium select-none"
                        onClick={() => toggleSort("alert_type")}
                      >
                        Type<SortIcon field="alert_type" sortField={sortField} sortDir={sortDir} />
                      </th>
                      <th
                        className="cursor-pointer px-3 py-3 font-medium select-none"
                        onClick={() => toggleSort("machine_name")}
                      >
                        Machine<SortIcon field="machine_name" sortField={sortField} sortDir={sortDir} />
                      </th>
                      <th className="px-3 py-3 font-medium">Message</th>
                      <th
                        className="cursor-pointer px-3 py-3 font-medium select-none"
                        onClick={() => toggleSort("downtime_minutes")}
                      >
                        Downtime<SortIcon field="downtime_minutes" sortField={sortField} sortDir={sortDir} />
                      </th>
                      <th className="px-3 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAlerts.map((alert) => {
                      const alertKey = `${alert.machine_id}-${alert.alert_type}`;
                      const isExpanded = expandedAlertKey === alertKey;
                      return (
                        <>
                        <tr key={alertKey} className="border-b border-[var(--border)]/60 hover:bg-[rgba(62,166,255,0.04)]">
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-caption ${alertSeverityBadge(alert.severity)}`}>
                              {alert.severity}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-xs text-[var(--muted)]">
                              {alertTypeLabel(alert.alert_type)}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-semibold text-white">{alert.machine_name}</div>
                            <div className="text-[10px] text-[var(--muted)] font-mono">{alert.machine_code}</div>
                          </td>
                          <td className="px-3 py-3 max-w-xs">
                            <span className="text-sm text-[var(--muted)]">{alert.message}</span>
                          </td>
                          <td className="px-3 py-3 font-mono text-[var(--muted)]">
                            {formatMinutes(alert.downtime_minutes)}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                onClick={() => setExpandedAlertKey(isExpanded ? null : alertKey)}
                              >
                                {isExpanded ? "Less" : "Details"}
                              </Button>
                              <Link href={`/steel/production/machines`}>
                                <Button variant="ghost">Machine</Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`detail-${alertKey}`}>
                            <td colSpan={6} className="px-6 py-4">
                              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(20,24,36,0.5)] px-4 py-3">
                                  <div className="text-[10px] uppercase tracking-caption text-[var(--muted)]">Machine Type</div>
                                  <div className="mt-1 text-sm font-semibold text-white">{alert.machine_type || "—"}</div>
                                </div>
                                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(20,24,36,0.5)] px-4 py-3">
                                  <div className="text-[10px] uppercase tracking-caption text-[var(--muted)]">MTBF</div>
                                  <div className="mt-1 text-sm font-semibold text-white">{alert.mtbf_hours != null ? `${alert.mtbf_hours.toFixed(1)}h` : "—"}</div>
                                </div>
                                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(20,24,36,0.5)] px-4 py-3">
                                  <div className="text-[10px] uppercase tracking-caption text-[var(--muted)]">Failures (30d)</div>
                                  <div className="mt-1 text-sm font-semibold text-white">{alert.failure_count}</div>
                                </div>
                                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(20,24,36,0.5)] px-4 py-3">
                                  <div className="text-[10px] uppercase tracking-caption text-[var(--muted)]">Overdue Maintenance</div>
                                  <div className="mt-1 text-sm font-semibold text-white">{alert.overdue_count}</div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </ResponsiveScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Data Quality Note */}
        <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
          <CardContent className="pt-4">
            <div className="text-xs text-[var(--muted)]">
              Alerts are computed from the machine intelligence snapshot (30-day window). 
              MTBF threshold is set at 2 hours. Click &ldquo;Refresh&rdquo; to get the latest data.
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
