"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import {
  acknowledgeSteelFraudAlert,
  dismissSteelFraudAlert,
  getSteelFraudAlerts,
  getSteelFraudAlertsCount,
  getSteelFraudIntelligence,
  investigateSteelFraudAlert,
  resolveSteelFraudAlert,
  type FraudAlert,
  type FraudIntelligence,
  type FraudInvestigationItem,
  type FraudSignal,
  type FraudUserProfile,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { DashboardPageSkeleton } from "@/components/shared/page-skeletons";

type Tab = "overview" | "inventory_loss" | "dispatch_transactions" | "approvals_users" | "investigation" | "alerts" | "confidence";

function formatNumber(value: number | null | undefined, decimals = 1) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: 0 }).format(value || 0);
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value.toFixed(1)}%`;
}

function formatKg(value: number | null | undefined) {
  const v = value || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(2)} T`;
  return `${v.toFixed(1)} KG`;
}

function formatInr(value: number | null | undefined) {
  if (value == null) return "—";
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(Math.round(value))}`;
}

function severityBadge(severity: string | null | undefined) {
  if (severity === "critical") return "border-rose-400/35 bg-rose-400/12 text-rose-200";
  if (severity === "high") return "border-orange-400/35 bg-orange-400/12 text-orange-200";
  if (severity === "medium") return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  return "border-emerald-400/25 bg-emerald-400/8 text-emerald-200/80";
}

function confidenceBadge(confidence: string | null | undefined) {
  if (confidence === "direct") return "border-emerald-400/35 bg-emerald-400/12 text-emerald-200";
  if (confidence === "derived") return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  if (confidence === "proxy") return "border-amber-400/25 bg-amber-400/8 text-amber-200/80";
  return "border-rose-400/35 bg-rose-400/12 text-rose-200";
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
        active
          ? "border border-[rgba(62,166,255,0.45)] bg-[rgba(62,166,255,0.14)] text-sky-100 shadow-[0_0_0_1px_rgba(62,166,255,0.15)]"
          : "border border-[var(--border)] bg-[rgba(20,24,36,0.7)] text-[var(--muted)] hover:border-[rgba(62,166,255,0.28)] hover:bg-[rgba(28,34,51,0.82)]"
      }`}
    >
      {label}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
      {message}
    </div>
  );
}

function DataChip({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] p-3">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className={`mt-1 text-lg font-bold ${color || "text-white"}`}>{value}</div>
    </div>
  );
}

export function SteelFraudIntelligencePage() {
  const { user, activeFactory, loading: sessionLoading } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [intel, setIntel] = useState<FraudIntelligence | null>(null);
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [activeAlertCount, setActiveAlertCount] = useState(0);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");

  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";

  const loadData = useCallback(async () => {
    if (!isSteelFactory) {
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    setError("");
    try {
      const [result, alertCount] = await Promise.all([
        getSteelFraudIntelligence(),
        getSteelFraudAlertsCount().catch(() => ({ active_count: 0 })),
      ]);
      setIntel(result);
      setActiveAlertCount(alertCount.active_count);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load fraud intelligence.");
    } finally {
      setPageLoading(false);
    }
  }, [isSteelFactory]);

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const result = await getSteelFraudAlerts({ status: "open", limit: 50 });
      setAlerts(result.items);
    } catch {
      // Silently fail — alerts are supplementary
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  const handleAcknowledge = useCallback(async (alertId: number) => {
    await acknowledgeSteelFraudAlert(alertId);
    await loadAlerts();
  }, [loadAlerts]);

  const handleInvestigate = useCallback(async (alertId: number) => {
    await investigateSteelFraudAlert(alertId);
    await loadAlerts();
  }, [loadAlerts]);

  const handleResolve = useCallback(async (alertId: number) => {
    await resolveSteelFraudAlert(alertId);
    await loadAlerts();
  }, [loadAlerts]);

  const handleDismiss = useCallback(async (alertId: number) => {
    await dismissSteelFraudAlert(alertId, "False positive — reviewed and cleared.");
    await loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    if (!user || !isSteelFactory) {
      setPageLoading(false);
      return;
    }
    void loadData();
  }, [isSteelFactory, loadData, user]);

  if (sessionLoading || pageLoading) {
    return <DashboardPageSkeleton />;
  }

  if (!isSteelFactory) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8 content-fade-in">
        <div className="mx-auto max-w-4xl text-center">
          <Card>
            <CardHeader>
              <CardTitle>Fraud Intelligence is factory-aware</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-[var(--muted)]">
              <div>Switch into a steel factory from the sidebar to open the fraud intelligence cockpit.</div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const summary = intel?.summary;
  const inventoryLoss = intel?.inventory_loss_signals;
  const dispatchMismatch = intel?.dispatch_mismatch_signals;
  const transactionAnomalies = intel?.transaction_anomalies;
  const approvalRisk = intel?.approval_risk_signals;
  const attendanceRisk = intel?.attendance_risk_signals;
  const userBehavior = intel?.user_behavior_signals || [];
  const investigationQueue = intel?.investigation_queue || [];
  const confidence = intel?.data_confidence;
  const canViewFinancials = intel?.financial_access;
  const canViewUsers = intel?.user_detail_access;

  const allSignalsCount = (summary?.total_signals || 0);
  const investigationCount = investigationQueue.length;
  const criticalCount = summary?.critical_count || 0;
  const highCount = summary?.high_count || 0;
  const mediumCount = summary?.medium_count || 0;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-prominent text-[var(--accent)]">Fraud Intelligence</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Theft detection, dispatch anomalies &amp; user behavior risk</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Read-only signals from existing data. No schema changes required.
                Signals are labeled as direct, derived, or proxy — never as confirmed theft.
                Investigation-level and financial data are role-restricted.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/steel/reconciliations">
                <Button variant="outline">Reconciliations</Button>
              </Link>
              <Button variant="outline" onClick={() => void loadData()} disabled={pageLoading}>
                {pageLoading ? "Loading..." : "Refresh"}
              </Button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
        ) : null}

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2">
          <TabButton label={`Overview (${allSignalsCount})`} active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
          <TabButton label={`Inventory Loss (${inventoryLoss?.total_signals || 0})`} active={activeTab === "inventory_loss"} onClick={() => setActiveTab("inventory_loss")} />
          <TabButton label={`Dispatch & Transactions (${(dispatchMismatch?.total_signals || 0) + (transactionAnomalies?.total_signals || 0)})`} active={activeTab === "dispatch_transactions"} onClick={() => setActiveTab("dispatch_transactions")} />
          <TabButton label={`Approvals & Users (${userBehavior.length})`} active={activeTab === "approvals_users"} onClick={() => setActiveTab("approvals_users")} />
          <TabButton label={`Investigation (${investigationCount})`} active={activeTab === "investigation"} onClick={() => setActiveTab("investigation")} />
          <TabButton label={`Alerts (${activeAlertCount})`} active={activeTab === "alerts"} onClick={() => { setActiveTab("alerts"); void loadAlerts(); }} />
          <TabButton label="Confidence" active={activeTab === "confidence"} onClick={() => setActiveTab("confidence")} />
        </div>

        {/* ── TAB 1: Overview ───────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <>
            {/* KPI Summary Cards */}
            <section className="grid gap-4 md:grid-cols-4">
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Total Signals</div>
                  <div className="mt-1 text-2xl font-bold text-white">{allSignalsCount}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">Across all domains</div>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Critical / High</div>
                  <div className="mt-1 text-2xl font-bold">
                    <span className="text-rose-400">{criticalCount}</span>
                    <span className="text-[var(--muted)]"> / </span>
                    <span className="text-orange-400">{highCount}</span>
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{mediumCount} medium severity</div>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Investigation Queue</div>
                  <div className={`mt-1 text-2xl font-bold ${investigationCount > 0 ? "text-rose-300" : "text-emerald-300"}`}>
                    {investigationCount}
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">Items needing review</div>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Data Quality</div>
                  <div className="mt-1 text-lg font-bold text-white capitalize">
                    {summary?.data_quality?.replace(/_/g, " ") || "—"}
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {intel?.period_days || 30}d analysis period
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Domain Breakdown */}
            <section className="grid gap-6 lg:grid-cols-2">
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardHeader>
                  <CardTitle>Signal Breakdown by Domain</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: "Inventory Loss", count: summary?.inventory_loss_count || 0, severity: criticalCount > 0 ? "critical" : "medium" },
                      { label: "Dispatch Mismatches", count: summary?.dispatch_mismatch_count || 0, severity: highCount > 0 ? "high" : "medium" },
                      { label: "Transaction Anomalies", count: summary?.transaction_anomaly_count || 0, severity: "medium" },            {label: "Approval Risk", count: summary?.approval_risk_count || 0, severity: "medium"},
            {label: "Attendance Risk", count: summary?.attendance_risk_count || 0, severity: attendanceRisk && attendanceRisk.signals.some(s => s.severity === "critical" || s.severity === "high") ? "high" : "medium"},
                    ].map((domain) => (
                      <div key={domain.label} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                        <div className="text-sm font-semibold text-white">{domain.label}</div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs uppercase tracking-caption ${severityBadge(domain.severity)}`}>
                          {domain.count} signal{(domain.count || 0) !== 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardHeader>
                  <CardTitle>Access Level</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
                      <span className="text-sm font-semibold text-white">Financial Data</span>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-caption ${canViewFinancials ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-200" : "border-amber-400/35 bg-amber-400/12 text-amber-200"}`}>
                        {canViewFinancials ? "Visible" : "Restricted"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
                      <span className="text-sm font-semibold text-white">User Detail</span>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-caption ${canViewUsers ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-200" : "border-amber-400/35 bg-amber-400/12 text-amber-200"}`}>
                        {canViewUsers ? "Visible" : "Restricted"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Top Risk Users */}
            {userBehavior.length > 0 && (
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardHeader>
                  <CardTitle>Highest Risk Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {userBehavior.slice(0, 5).map((u: FraudUserProfile) => (
                      <div key={u.user_id} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-3 last:border-none last:pb-0">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{u.display_name}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {u.top_signals.map((sig, i) => (
                              <span key={i} className="inline-flex rounded-full border border-amber-400/20 bg-amber-500/8 px-2 py-0.5 text-[10px] text-amber-200/80">
                                {sig}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${u.risk_band === "critical" ? "text-rose-400" : u.risk_band === "high" ? "text-orange-400" : "text-amber-400"}`}>
                            {u.risk_score}
                          </div>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${severityBadge(u.risk_band)}`}>
                            {u.risk_band}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ── TAB 2: Inventory Loss ─────────────────────────────────────── */}
        {activeTab === "inventory_loss" && (
          <section className="space-y-6">
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Inventory Loss Signals</CardTitle>
              </CardHeader>
              <CardContent>
                {inventoryLoss && inventoryLoss.signals.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <DataChip label="High Variance Reconciliations" value={Number((inventoryLoss as any).high_variance_reconciliation_count || 0)} color={Number((inventoryLoss as any).high_variance_reconciliation_count || 0) > 0 ? "text-rose-400" : "text-emerald-400"} />
                      <DataChip label="Items with Repeated Shortage" value={Number((inventoryLoss as any).items_with_repeated_shortage || 0)} color={Number((inventoryLoss as any).items_with_repeated_shortage || 0) > 0 ? "text-amber-400" : "text-emerald-400"} />
                      <DataChip label="Data Quality" value={inventoryLoss.data_quality?.replace(/_/g, " ") || "—"} />
                    </div>
                    <ResponsiveScrollArea
                      className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                      debugLabel="fraud-inventory-table"
                    >
                      <table className="min-w-full text-left text-sm">
                        <thead className="text-[var(--muted)]">
                          <tr className="border-b border-[var(--border)]">
                            <th className="px-3 py-3 font-medium">Item</th>
                            <th className="px-3 py-3 font-medium">Signal Type</th>
                            <th className="px-3 py-3 font-medium">Variance KG</th>
                            <th className="px-3 py-3 font-medium">Variance %</th>
                            <th className="px-3 py-3 font-medium">Occurrences</th>
                            {canViewFinancials && <th className="px-3 py-3 font-medium">Est. Loss</th>}
                            <th className="px-3 py-3 font-medium">Severity</th>
                            <th className="px-3 py-3 font-medium">Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryLoss.signals.map((s: FraudSignal, i: number) => (
                            <tr key={`inv-${i}`} className="border-b border-[var(--border)]/60 last:border-none">
                              <td className="px-3 py-3 font-semibold text-white">{(s as any).item_name || `Item #${(s as any).item_id}`}</td>
                              <td className="px-3 py-3 text-[var(--muted)]">{s.signal_type?.replace(/_/g, " ")}</td>
                              <td className="px-3 py-3 font-mono text-rose-400">{formatKg((s as any).variance_kg)}</td>
                              <td className="px-3 py-3 font-mono text-white">{(s as any).variance_percent != null ? formatPercent((s as any).variance_percent) : "—"}</td>
                              <td className="px-3 py-3 text-[var(--muted)]">{(s as any).occurrence_count_30d || 1}x</td>
                              {canViewFinancials && <td className="px-3 py-3 font-mono text-white">{formatInr(s.estimated_loss_inr)}</td>}
                              <td className="px-3 py-3">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${severityBadge(s.severity)}`}>
                                  {s.severity}
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${confidenceBadge(s.confidence)}`}>
                                  {s.confidence}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ResponsiveScrollArea>
                  </div>
                ) : (
                  <EmptyState message="No inventory loss signals detected. Record reconciliations to enable inventory shortage detection." />
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── TAB 3: Dispatch & Transactions ────────────────────────────── */}
        {activeTab === "dispatch_transactions" && (
          <section className="grid gap-6 lg:grid-cols-2">
            {/* Dispatch Mismatches */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Dispatch Mismatches</CardTitle>
              </CardHeader>
              <CardContent>
                {dispatchMismatch && dispatchMismatch.signals.length > 0 ? (
                  <div className="space-y-3">
                    {dispatchMismatch.signals.map((s: FraudSignal, i: number) => (
                      <div key={`disp-${i}`} className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs uppercase tracking-caption text-[var(--muted)]">
                              {(s as any).dispatch_number || `Dispatch #${i + 1}`}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-white">{s.signal_type?.replace(/_/g, " ")}</div>
                            <div className="mt-1 text-xs text-[var(--muted)]">{s.evidence_summary}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${severityBadge(s.severity)}`}>
                              {s.severity}
                            </span>
                            <span className={`ml-1 inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${confidenceBadge(s.confidence)}`}>
                              {s.confidence}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-amber-200/80">{s.recommended_action}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No dispatch mismatch signals detected." />
                )}
              </CardContent>
            </Card>

            {/* Transaction Anomalies */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Transaction Anomalies</CardTitle>
              </CardHeader>
              <CardContent>
                {transactionAnomalies && transactionAnomalies.signals.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <DataChip label="Reference-less Adjustments" value={Number((transactionAnomalies as any).reference_less_adjustment_count || 0)} color={Number((transactionAnomalies as any).reference_less_adjustment_count || 0) > 0 ? "text-rose-400" : "text-emerald-400"} />
                      <DataChip label="Adjustment Burst Users" value={Number((transactionAnomalies as any).adjustment_burst_users || 0)} color={Number((transactionAnomalies as any).adjustment_burst_users || 0) > 0 ? "text-amber-400" : "text-emerald-400"} />
                    </div>
                    {transactionAnomalies.signals.map((s: FraudSignal, i: number) => (
                      <div key={`txn-${i}`} className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs uppercase tracking-caption text-[var(--muted)]">
                              {s.signal_type?.replace(/_/g, " ")}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-white">
                              {(s as any).quantity_kg ? `${formatKg((s as any).quantity_kg)}` : ""}
                              {(s as any).adjustment_count ? `${(s as any).adjustment_count}x adjustments` : ""}
                            </div>
                            <div className="mt-1 text-xs text-[var(--muted)]">{s.evidence_summary}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${severityBadge(s.severity)}`}>
                              {s.severity}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-amber-200/80">{s.recommended_action}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No transaction anomalies detected." />
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── TAB 4: Approvals & Users ──────────────────────────────────── */}
        {activeTab === "approvals_users" && (
          <section className="space-y-6">
            {/* Attendance Risk Signals */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Attendance Risk Signals</CardTitle>
              </CardHeader>
              <CardContent>
                {attendanceRisk && attendanceRisk.signals.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-3">
                      <DataChip label="Ghost Attendance" value={Number((attendanceRisk as any).ghost_attendance_count || 0)} color={Number((attendanceRisk as any).ghost_attendance_count || 0) > 0 ? "text-rose-400" : "text-emerald-400"} />
                      <DataChip label="Self-Approvals" value={Number((attendanceRisk as any).self_approval_count || 0)} color={Number((attendanceRisk as any).self_approval_count || 0) > 0 ? "text-rose-400" : "text-emerald-400"} />
                      <DataChip label="Users Flagged" value={Number((attendanceRisk as any).unique_users_flagged || 0)} color={Number((attendanceRisk as any).unique_users_flagged || 0) > 0 ? "text-amber-400" : "text-emerald-400"} />
                    </div>
                    {attendanceRisk.signals.map((s: FraudSignal, i: number) => (
                      <div key={`att-${i}`} className="flex items-start justify-between rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-3">
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-caption text-[var(--muted)]">{s.signal_type?.replace(/_/g, " ")}</div>
                          <div className="mt-1 text-sm font-semibold text-white">{(s as any).shift ? `Shift: ${(s as any).shift}` : ""}</div>
                          <div className="mt-1 text-xs text-[var(--muted)]">{s.evidence_summary}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${severityBadge(s.severity)}`}>
                            {s.severity}
                          </span>
                          <span className={`ml-1 inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${confidenceBadge(s.confidence)}`}>
                            {s.confidence}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No attendance risk signals detected. Attendance data needed for pattern analysis." />
                )}
              </CardContent>
            </Card>

            {/* Approval Risk Signals */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Approval Risk Signals</CardTitle>
              </CardHeader>
              <CardContent>
                {approvalRisk && approvalRisk.signals.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <DataChip label="Too-Fast Approvals" value={Number((approvalRisk as any).fast_approval_count || 0)} color={Number((approvalRisk as any).fast_approval_count || 0) > 0 ? "text-amber-400" : "text-emerald-400"} />
                      <DataChip label="Dominant Maker-Checker Pairs" value={Number((approvalRisk as any).dominant_pair_count || 0)} color={Number((approvalRisk as any).dominant_pair_count || 0) > 0 ? "text-amber-400" : "text-emerald-400"} />
                    </div>
                    {approvalRisk.signals.map((s: FraudSignal, i: number) => (
                      <div key={`appr-${i}`} className="flex items-start justify-between rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-3">
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-caption text-[var(--muted)]">{s.signal_type?.replace(/_/g, " ")}</div>
                          <div className="mt-1 text-sm font-semibold text-white">{(s as any).workflow_key || ""}</div>
                          <div className="mt-1 text-xs text-[var(--muted)]">{s.evidence_summary}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${severityBadge(s.severity)}`}>
                            {s.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No approval risk signals detected. Approval data appears after approval workflows are used." />
                )}
              </CardContent>
            </Card>

            {/* User Behavior Profiles */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>User Behavior Risk Profiles</CardTitle>
              </CardHeader>
              <CardContent>
                {userBehavior.length > 0 ? (
                  <ResponsiveScrollArea
                    className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                    debugLabel="fraud-user-behavior-table"
                  >
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[var(--muted)]">
                        <tr className="border-b border-[var(--border)]">
                          <th className="px-3 py-3 font-medium">User</th>
                          <th className="px-3 py-3 font-medium">Risk Score</th>
                          <th className="px-3 py-3 font-medium">Band</th>
                          <th className="px-3 py-3 font-medium">Top Signals</th>
                          <th className="px-3 py-3 font-medium">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userBehavior.map((u: FraudUserProfile) => (
                          <tr key={u.user_id} className="border-b border-[var(--border)]/60 last:border-none">
                            <td className="px-3 py-3 font-semibold text-white">{u.display_name}</td>
                            <td className="px-3 py-3">
                              <span className={`font-bold ${u.risk_band === "critical" ? "text-rose-400" : u.risk_band === "high" ? "text-orange-400" : "text-amber-400"}`}>
                                {u.risk_score}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${severityBadge(u.risk_band)}`}>
                                {u.risk_band}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap gap-1">
                                {u.top_signals.map((sig, i) => (
                                  <span key={i} className="inline-flex rounded-full border border-amber-400/20 bg-amber-500/8 px-2 py-0.5 text-[10px] text-amber-200/80">
                                    {sig}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${confidenceBadge(u.confidence)}`}>
                                {u.confidence}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ResponsiveScrollArea>
                ) : (
                  <EmptyState message="No user behavior profiles generated. Profiles appear when users are linked to signals across domains." />
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── TAB 5: Investigation Queue ────────────────────────────────── */}
        {activeTab === "investigation" && (
          <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
            <CardHeader>
              <CardTitle>Investigation Queue</CardTitle>
            </CardHeader>
            <CardContent>
              {investigationQueue.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    <span className="inline-flex h-2 w-2 rounded-full bg-rose-400" /> Critical
                    <span className="ml-3 inline-flex h-2 w-2 rounded-full bg-orange-400" /> High
                  </div>
                  {investigationQueue.map((item: FraudInvestigationItem, i: number) => (
                    <div key={`invest-${i}`} className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${severityBadge(item.severity)}`}>
                              {item.severity}
                            </span>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${confidenceBadge(item.confidence)}`}>
                              {item.confidence}
                            </span>
                            <span className="text-[10px] uppercase tracking-caption text-[var(--muted)]">{item.domain}</span>
                          </div>
                          <div className="mt-2 text-sm font-semibold text-white">{item.signal_type?.replace(/_/g, " ")}</div>
                          <div className="mt-1 text-xs text-[var(--muted)]">{item.summary}</div>
                          <div className="mt-2 text-xs text-amber-200/80">{item.recommended_action}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No investigation items. Investigation queue populates when critical or high-severity signals are detected across any domain." />
              )}
            </CardContent>
          </Card>
        )}

        {/* ── TAB 6: Alerts ────────────────────────────────────────────── */}
        {activeTab === "alerts" && (
          <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
            <CardHeader>
              <CardTitle>Fraud Alert Center</CardTitle>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <EmptyState message="Loading alerts..." />
              ) : alerts.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    <span className="inline-flex h-2 w-2 rounded-full bg-rose-400" /> Active
                    <span className="ml-3 inline-flex h-2 w-2 rounded-full bg-amber-400" /> Acknowledged
                    <span className="ml-3 inline-flex h-2 w-2 rounded-full bg-blue-400" /> Investigating
                  </div>
                  {alerts.map((alert: FraudAlert) => (
                    <div key={alert.id} className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${severityBadge(alert.severity)}`}>
                              {alert.severity}
                            </span>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${confidenceBadge(alert.confidence)}`}>
                              {alert.confidence}
                            </span>
                            <span className="text-[10px] uppercase tracking-caption text-[var(--muted)]">{alert.domain}</span>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${
                              alert.status === "active" ? "border-rose-400/35 bg-rose-400/12 text-rose-200" :
                              alert.status === "acknowledged" ? "border-amber-400/35 bg-amber-400/12 text-amber-200" :
                              "border-blue-400/35 bg-blue-400/12 text-blue-200"
                            }`}>
                              {alert.status}
                            </span>
                          </div>
                          <div className="mt-2 text-sm font-semibold text-white">{alert.signal_type?.replace(/_/g, " ")}</div>
                          <div className="mt-1 text-xs text-[var(--muted)]">{alert.summary}</div>
                          {alert.recommended_action && (
                            <div className="mt-2 text-xs text-amber-200/80">{alert.recommended_action}</div>
                          )}
                        </div>
                      </div>
                      {/* Lifecycle actions */}
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border)]/60 pt-3">
                        {alert.status === "active" && (
                          <button
                            type="button"
                            onClick={() => void handleAcknowledge(alert.id)}
                            className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20"
                          >
                            Acknowledge
                          </button>
                        )}
                        {alert.status !== "investigating" && (
                          <button
                            type="button"
                            onClick={() => void handleInvestigate(alert.id)}
                            className="rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-200 transition hover:bg-blue-500/20"
                          >
                            Investigate
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleResolve(alert.id)}
                          className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDismiss(alert.id)}
                          className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No active fraud alerts. Critical/high signals from the fraud intelligence scan will appear here automatically." />
              )}
            </CardContent>
          </Card>
        )}

        {/* ── TAB 7: Confidence ─────────────────────────────────────────── */}
        {activeTab === "confidence" && (
          <section className="space-y-6">
            {/* Data Confidence Report */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Data Confidence Report</CardTitle>
              </CardHeader>
              <CardContent>
                {confidence ? (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-2">
                      {[
                        ["Inventory Reconciliation Signals", confidence.inventory_reconciliation_signals],
                        ["Dispatch Mismatch Signals", confidence.dispatch_mismatch_signals],
                        ["Transaction Reference Quality", confidence.transaction_reference_quality],
                        ["Approval Behavior Signals", confidence.approval_behavior_signals],
                      ].map(([label, val]) => (
                        <div key={String(label)} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                          <div className="text-sm font-semibold text-white">{String(label)}</div>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-caption ${val === "direct" || val === "available" ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-200" : val === "partial" || val === "derived" ? "border-amber-400/35 bg-amber-400/12 text-amber-200" : "border-rose-400/35 bg-rose-400/12 text-rose-200"}`}>
                            {String(val).replace(/_/g, " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {[
                        ["User Behavior Profiling", confidence.user_behavior_profiling],
                        ["Theft Confirmation", confidence.theft_confirmation],
                        ["Financial Valuation", confidence.financial_valuation],
                        ["Attendance Risk", confidence.attendance_risk_signals],
                      ].map(([label, val]) => (
                        <div key={String(label)} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                          <div className="text-sm font-semibold text-white">{String(label)}</div>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-caption ${val === "direct" || val === "available" ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-200" : val === "partial" || val === "derived" ? "border-amber-400/35 bg-amber-400/12 text-amber-200" : "border-rose-400/35 bg-rose-400/12 text-rose-200"}`}>
                            {String(val).replace(/_/g, " ")}
                          </span>
                        </div>
                      ))}
                      {confidence.missing_fields.length > 0 && (
                        <div className="pt-3">
                          <div className="mb-2 text-xs uppercase tracking-wider text-[var(--muted)]">Missing Capabilities</div>
                          <div className="flex flex-wrap gap-1">
                            {confidence.missing_fields.map((field) => (
                              <span key={field} className="inline-flex rounded-full border border-rose-400/25 bg-rose-500/8 px-2.5 py-1 text-[10px] text-rose-200/80">
                                {field.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <EmptyState message="No confidence data available." />
                )}
              </CardContent>
            </Card>

            {/* What's Possible vs Missing */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>What's Possible vs What's Missing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/8 p-4">
                    <div className="text-sm font-semibold text-emerald-300">Available Now (Direct)</div>
                    <ul className="mt-2 space-y-1 text-xs text-emerald-200/70">
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Inventory shortage from reconciliation variance</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Dispatch weight &amp; timing mismatches</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Reference-less stock adjustments</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Approval velocity &amp; concentration risk</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />User behavior scoring from risky events</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Attendance ghost/shift/anomaly detection (direct)</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />Self-approval &amp; reviewer concentration in attendance</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/8 p-4">
                    <div className="text-sm font-semibold text-amber-300">Derived / Proxy</div>
                    <ul className="mt-2 space-y-1 text-xs text-amber-200/70">
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />User risk profiles aggregated from signal weights</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />Suspected material loss from shortage patterns</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />Adjustment burst detection by user</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />Chronic lateness &amp; short attendance patterns</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-500/8 p-4">
                    <div className="text-sm font-semibold text-rose-300">Requires Schema Changes</div>
                    <ul className="mt-2 space-y-1 text-xs text-rose-200/70">
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />Weighbridge actual gross/net weight logs</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />Stock transfer entities &amp; bin locations</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />POD / photo verification audit chain</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />Approval MFA evidence trail</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />Attendance location / biometric confidence (schema change needed)</li>
                      <li className="flex items-center gap-1.5"><span className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />Persistent fraud alert case management</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </main>
  );
}
