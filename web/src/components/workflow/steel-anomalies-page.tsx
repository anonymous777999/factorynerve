"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getSteelAnomalies,
  type AnomalyDetection,
  type AnomalyItem,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { DashboardPageSkeleton } from "@/components/shared/page-skeletons";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";

function severityBadge(severity: string) {
  if (severity === "critical") return "border-rose-400/35 bg-rose-400/12 text-rose-200";
  if (severity === "high") return "border-orange-400/35 bg-orange-400/12 text-orange-200";
  if (severity === "warning") return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  return "border-[var(--accent-soft)] bg-[var(--accent-soft)] text-[var(--accent)]";
}

function typeIcon(type: string) {
  if (type.startsWith("invoice") || type.startsWith("payment") || type.startsWith("overdue"))
    return "💰";
  if (type.startsWith("large_reconciliation") || type.startsWith("negative_stock") || type.startsWith("large_manual"))
    return "📦";
  if (type.startsWith("duplicate_truck") || type.startsWith("impossible") || type.startsWith("weight"))
    return "🚛";
  return "⚠️";
}

export function SteelAnomaliesPage() {
  const { user, loading: sessionLoading } = useSession();
  const [data, setData] = useState<AnomalyDetection | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState<"all" | "financial" | "inventory" | "dispatch">("all");

  const refresh = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);
    try {
      const result = await getSteelAnomalies(days);
      setData(result);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load anomaly data.");
    } finally {
      setPageLoading(false);
    }
  }, [user, days]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (sessionLoading || pageLoading) {
    return <DashboardPageSkeleton />;
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 content-fade-in">
        <Card className="w-full">
          <CardHeader><CardTitle>Anomaly Detection</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">Please sign in to continue.</div>
            <Link href="/access"><Button>Open Access</Button></Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const summary = data?.summary || { critical_count: 0, high_count: 0, warning_count: 0 };

  let visibleAnomalies: AnomalyItem[] = data?.all_anomalies_sorted || [];
  if (activeTab === "financial") visibleAnomalies = data?.financial_anomalies || [];
  else if (activeTab === "inventory") visibleAnomalies = data?.inventory_anomalies || [];
  else if (activeTab === "dispatch") visibleAnomalies = data?.dispatch_fraud_alerts || [];

  const tabs = [
    { id: "all" as const, label: "All", count: data?.anomaly_count || 0 },
    { id: "financial" as const, label: "Financial", count: data?.financial_anomalies.length || 0 },
    { id: "inventory" as const, label: "Inventory", count: data?.inventory_anomalies.length || 0 },
    { id: "dispatch" as const, label: "Dispatch Fraud", count: data?.dispatch_fraud_alerts.length || 0 },
  ];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fafaf9_0%,#f5f5f4_48%,#fafaf9_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <section className="rounded-[2rem] border border-[#e7e5e4] bg-[linear-gradient(135deg,#ffffff,#fafaf9)] p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-prominent text-[#78716c]">Anomaly Detection</div>
              <h1 className="mt-2 text-3xl font-semibold text-[#111111] md:text-4xl">
                Catch what is wrong — financial, inventory, dispatch fraud
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#57534e]">
                Automated detection of unusual patterns: outlier invoices, large stock adjustments,
                negative balances, duplicate trucks, and impossible timelines.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="rounded-xl border border-[#e7e5e4] bg-white px-3 py-2 text-sm text-[#111111]"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <Button variant="outline" onClick={() => void refresh()} disabled={pageLoading}>
                {pageLoading ? "Loading..." : "Refresh"}
              </Button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
        ) : null}

        {/* Summary cards */}
        <section className="grid gap-4 md:grid-cols-4">
          <Card className="border border-[#e7e5e4] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="text-xs uppercase tracking-wider text-[#78716c]">Total Anomalies</div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[#111111]">{data?.anomaly_count || 0}</div>
              <div className="mt-1 text-xs text-[#57534e]">Over {data?.time_period_days || days} days</div>
            </CardContent>
          </Card>
          <Card className="border border-[#e7e5e4] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="text-xs uppercase tracking-wider text-[#78716c]">Critical</div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-rose-500">{summary.critical_count}</div>
              <div className="mt-1 text-xs text-[#57534e]">Immediate action needed</div>
            </CardContent>
          </Card>
          <Card className="border border-[#e7e5e4] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="text-xs uppercase tracking-wider text-[#78716c]">High</div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-500">{summary.high_count}</div>
              <div className="mt-1 text-xs text-[#57534e]">Needs investigation</div>
            </CardContent>
          </Card>
          <Card className="border border-[#e7e5e4] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="text-xs uppercase tracking-wider text-[#78716c]">Warnings</div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-500">{summary.warning_count}</div>
              <div className="mt-1 text-xs text-[#57534e]">Review recommended</div>
            </CardContent>
          </Card>
        </section>

        {/* Tab bar */}
        <section className="rounded-[1.4rem] border border-[#e7e5e4] bg-white p-3 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={
                  activeTab === tab.id
                    ? "rounded-2xl border border-[#111111] bg-[#111111] px-4 py-2 text-sm font-semibold text-white"
                    : "rounded-2xl border border-[#e7e5e4] bg-[#f5f5f4] px-4 py-2 text-sm text-[#57534e] hover:border-[#a8a29e]"
                }
              >
                {tab.label}
                <span className="ml-2 rounded-full bg-[#78716c]/20 px-2 py-0.5 text-xs">{tab.count}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Anomaly feed */}
        <Card className="border border-[#e7e5e4] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-[#111111]">
              Anomaly Feed
            </CardTitle>
          </CardHeader>
          <CardContent>
            {visibleAnomalies.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e7e5e4] px-4 py-10 text-center text-sm text-[#57534e]">
                No anomalies detected in this category for the selected time period.
              </div>
            ) : (
              <div className="space-y-3">
                {visibleAnomalies.map((anomaly, i) => (
                  <div
                    key={`${anomaly.type}-${anomaly.resource_id}-${i}`}
                    className="rounded-2xl border border-[#e7e5e4] bg-[#fafaf9] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{typeIcon(anomaly.type)}</span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-[#111111]">{anomaly.resource_label}</span>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs uppercase tracking-caption ${severityBadge(anomaly.severity)}`}>
                              {anomaly.severity}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-[#57534e]">{anomaly.detail}</div>
                          <div className="mt-1 text-xs text-[#78716c]">
                            Type: {anomaly.type.replace(/_/g, " ")}
                            {anomaly.detected_at ? ` · ${new Date(anomaly.detected_at).toLocaleDateString("en-IN")}` : ""}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
