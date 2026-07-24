"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listUnreadAlerts, markAlertRead, type AlertItem } from "@/lib/dashboard";
import { useSession } from "@/lib/use-session";
import { signalWorkflowRefresh } from "@/lib/workflow-sync";

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function severityColor(severity?: string | null) {
  switch ((severity || "").toLowerCase()) {
    case "critical":
    case "high":
      return "border-red-400/40 bg-[rgba(239,68,68,0.12)] text-red-100";
    case "medium":
    case "warning":
      return "border-amber-400/40 bg-[rgba(245,158,11,0.12)] text-amber-100";
    case "low":
    case "info":
      return "border-emerald-400/30 bg-[rgba(34,197,94,0.12)] text-emerald-100";
    default:
      return "border-[var(--border)] bg-[var(--card-strong)] text-[var(--muted)]";
  }
}

export default function AlertsPage() {
  const { user, loading: sessionLoading, error: sessionError } = useSession();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingIds, setMarkingIds] = useState<Record<number, boolean>>({});

  const loadAlerts = useCallback(async () => {
    if (!user) return;
    setError("");
    try {
      const items = await listUnreadAlerts();
      setAlerts(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load alerts.");
    } finally {
      setPageLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPageLoading(false);
      return;
    }
    loadAlerts().catch(() => setPageLoading(false));
  }, [loadAlerts, user]);

  const handleMarkRead = useCallback(
    async (alertId: number) => {
      if (markingIds[alertId]) return;
      setMarkingIds((prev) => ({ ...prev, [alertId]: true }));
      try {
        await markAlertRead(alertId);
        setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
        signalWorkflowRefresh("alerts");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("dpr:rail-counts-refresh"));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not mark alert as read.");
      } finally {
        setMarkingIds((prev) => {
          const next = { ...prev };
          delete next[alertId];
          return next;
        });
      }
    },
    [markingIds],
  );

  if (sessionLoading || (pageLoading && Boolean(user))) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-36 rounded-[2rem]" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <div className="text-sm uppercase tracking-prominent text-[var(--accent)]">Alerts</div>
              <CardTitle>Sign in to view alerts</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link href="/access">
                <Button>Open Access</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-wrap items-start justify-between gap-4 rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur">
          <div>
            <div className="text-sm uppercase tracking-prominent text-[var(--accent)]">Alerts</div>
            <h1 className="mt-2 text-3xl font-semibold">Factory signals &amp; notifications</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Review and acknowledge unread alerts. Cleared alerts disappear from this list.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--border)] bg-[var(--card-strong)] px-4 py-2 text-sm">
              {alerts.length} unread
            </span>
            <Button variant="outline" className="px-4 py-2 text-xs" onClick={() => loadAlerts()}>
              Refresh
            </Button>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {alerts.length === 0 ? (
          <Card className="border-dashed border-[var(--border)] bg-[var(--card-strong)]">
            <CardContent className="flex min-h-[12rem] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
              <div className="text-sm uppercase tracking-prominent text-[var(--accent)]">All Clear</div>
              <div className="text-2xl font-semibold text-[var(--text)]">No unread alerts</div>
              <div className="max-w-xl text-sm leading-6 text-[var(--muted)]">
                Factory signals and notifications will appear here when they need attention.
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard">
                  <Button>Open Dashboard</Button>
                </Link>
                <Link href="/work-queue">
                  <Button variant="outline">Open Work Queue</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-2xl border p-5 transition hover:opacity-90 ${severityColor(alert.severity)}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[var(--border)] bg-[rgba(0,0,0,0.2)] px-3 py-0.5 text-[11px] font-semibold uppercase tracking-label">
                        {alert.alert_type}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {formatDateTime(alert.created_at)}
                      </span>
                    </div>
                    <div className="text-base font-semibold text-[var(--text)]">{alert.message}</div>
                    <div className="text-xs text-[var(--muted)]">
                      Severity: {(alert.severity || "info").toUpperCase()}
                      {alert.is_read != null ? ` · ${alert.is_read ? "Read" : "Unread"}` : ""}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="shrink-0 px-4 py-2 text-xs"
                    onClick={() => void handleMarkRead(alert.id)}
                    disabled={markingIds[alert.id]}
                  >
                    {markingIds[alert.id] ? "Marking..." : "Mark Read"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
