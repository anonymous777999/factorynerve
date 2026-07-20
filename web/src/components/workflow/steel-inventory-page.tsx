"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import {
  createSteelItem,
  getSteelInventoryIntelligence,
  listSteelStock,
  type SteelStockItem,
  type ExpandedInventoryIntelligence,
  type LowStockAlert,
  type DeadStockItem,
  type SlowMovingItem,
  type OverstockedItem,
  type TurnoverItem,
  type SuspiciousMovement,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { DashboardPageSkeleton } from "@/components/shared/page-skeletons";
import { EmptyState, TabButton } from "@/components/shared";

type Tab = "stock" | "alerts" | "turnover" | "slow_dead_overstock" | "value_abc" | "reconciliation_risk";

function formatKg(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatPercent(value: number | null | undefined) {
  return `${(value || 0).toFixed(1)}%`;
}

function badgeTone(value: string | null | undefined) {
  if (value === "green" || value === "approved") return "border-emerald-400/35 bg-emerald-400/12 text-emerald-200";
  if (value === "yellow" || value === "pending" || value === "review" || value === "watch" || value === "warning") return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  return "border-rose-400/35 bg-rose-400/12 text-rose-200";
}

function severityBadge(severity: string) {
  if (severity === "critical") return "border-rose-400/35 bg-rose-400/12 text-rose-200";
  if (severity === "high" || severity === "warning") return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  return "border-emerald-400/35 bg-emerald-400/12 text-emerald-200";
}

function deriveOperationalZone(category: string) {
  const cat = category.toLowerCase();
  if (cat.includes("scrap")) return "Scrap Yard";
  if (cat.includes("ingot") || cat.includes("billet")) return "Melt Shop WIP";
  if (cat.includes("finished") || cat.includes("tmt") || cat.includes("round") || cat.includes("section")) return "Dispatch Yard";
  return "Process Floor";
}

export function SteelInventoryPage() {
  const { user, activeFactory, loading, error: sessionError } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("stock");
  const [stock, setStock] = useState<SteelStockItem[]>([]);
  const [intel, setIntel] = useState<ExpandedInventoryIntelligence | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    item_code: "",
    name: "",
    category: "finished_goods",
    display_unit: "kg",
    current_rate_per_kg: "",
    reorder_point_kg: "",
    safety_stock_kg: "",
    lead_time_days: "",
  });

  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";
  const canManage = Boolean(user && ["owner", "admin", "manager"].includes(user.role));

  const loadData = useCallback(async () => {
    if (!isSteelFactory) {
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    setError("");
    try {
      const [stockPayload, intelPayload] = await Promise.all([
        listSteelStock(),
        getSteelInventoryIntelligence(),
      ]);
      setStock(stockPayload.items || []);
      setIntel(intelPayload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load steel inventory.");
    } finally {
      setPageLoading(false);
    }
  }, [isSteelFactory]);

  useEffect(() => {
    if (!user || !isSteelFactory) {
      setPageLoading(false);
      return;
    }
    void loadData();
  }, [isSteelFactory, loadData, user]);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    setError("");
    try {
      await createSteelItem({
        item_code: form.item_code,
        name: form.name,
        category: form.category,
        display_unit: form.display_unit,
        current_rate_per_kg: form.current_rate_per_kg ? Number(form.current_rate_per_kg) : null,
        reorder_point_kg: form.reorder_point_kg ? Number(form.reorder_point_kg) : null,
        safety_stock_kg: form.safety_stock_kg ? Number(form.safety_stock_kg) : null,
        lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : null,
      });
      setStatus("New material added to master.");
      setForm({
        item_code: "",
        name: "",
        category: "finished_goods",
        display_unit: "kg",
        current_rate_per_kg: "",
        reorder_point_kg: "",
        safety_stock_kg: "",
        lead_time_days: "",
      });
      await loadData();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not add material.");
    } finally {
      setBusy(false);
    }
  };

  if (loading || pageLoading) {
    return <DashboardPageSkeleton />;
  }

  if (!isSteelFactory) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8 content-fade-in">
        <div className="mx-auto max-w-4xl text-center">
          <Card>
            <CardHeader>
              <CardTitle>Steel inventory is factory-aware</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-[var(--muted)]">
              <div>Switch into a steel factory from the sidebar to open the stock board.</div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const alerts = intel?.low_stock_alerts || [];
  const deadStock = intel?.dead_stock || [];
  const slowMoving = intel?.slow_moving_items || [];
  const overstocked = intel?.overstocked_items || [];
  const turnoverItems = intel?.turnover_analysis.items || [];
  const valuation = intel?.inventory_valuation;
  const abc = intel?.abc_analysis;
  const suspicious = intel?.suspicious_movements || [];
  const recRisk = intel?.reconciliation_risk;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-prominent text-[var(--accent)]">Inventory Management</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Stock Balance &amp; Intelligence Cockpit</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Live stock levels, low-stock alerts, turnover analysis, inventory valuation, and reconciliation health.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/steel/inventory/transactions">
                <Button variant="outline">Transaction History</Button>
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

        {status ? (
          <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{status}</div>
        ) : null}

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2">
          <TabButton label="Live Stock" active={activeTab === "stock"} onClick={() => setActiveTab("stock")} />
          <TabButton label={`Alerts & Reorder (${alerts.length})`} active={activeTab === "alerts"} onClick={() => setActiveTab("alerts")} />
          <TabButton label="Turnover" active={activeTab === "turnover"} onClick={() => setActiveTab("turnover")} />
          <TabButton label={`Slow / Dead / Overstock`} active={activeTab === "slow_dead_overstock"} onClick={() => setActiveTab("slow_dead_overstock")} />
          <TabButton label="Value & ABC" active={activeTab === "value_abc"} onClick={() => setActiveTab("value_abc")} />
          <TabButton label={`Reconciliation Risk`} active={activeTab === "reconciliation_risk"} onClick={() => setActiveTab("reconciliation_risk")} />
        </div>

        {/* ── TAB: Live Stock ─────────────────────────────────────────────── */}
        {activeTab === "stock" && (
          <section className="grid gap-6 xl:grid-cols-[1fr_350px]">
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                  <CardContent className="pt-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Total Items</div>
                    <div className="mt-1 text-2xl font-bold">{stock.length}</div>
                  </CardContent>
                </Card>
                <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                  <CardContent className="pt-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Estimated Value</div>
                    <div className="mt-1 text-2xl font-bold">{formatCurrency(valuation?.total_estimated_value_inr)}</div>
                  </CardContent>
                </Card>
                <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                  <CardContent className="pt-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Low Stock Alerts</div>
                    <div className={`mt-1 text-2xl font-bold ${alerts.filter(a => a.severity === "critical").length > 0 ? "text-rose-400" : "text-amber-400"}`}>
                      {alerts.length}
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">{alerts.filter(a => a.severity === "critical").length} critical</div>
                  </CardContent>
                </Card>
                <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                  <CardContent className="pt-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Pending Reviews</div>
                    <div className="mt-1 text-2xl font-bold">{recRisk?.pending_reviews ?? 0}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">{recRisk?.stale_items.length ?? 0} stale items</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Live Stock Trust Board</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveScrollArea
                    className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                    debugLabel="steel-inventory-board"
                    viewportClassName="max-h-[65vh] overflow-y-auto"
                  >
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[var(--muted)]">
                        <tr className="border-b border-[var(--border)]">
                          <th className="px-3 py-3 font-medium">Item</th>
                          <th className="px-3 py-3 font-medium">Zone</th>
                          <th className="px-3 py-3 font-medium">Balance (KG)</th>
                          <th className="px-3 py-3 font-medium">Last Variance</th>
                          <th className="px-3 py-3 font-medium">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stock.map((row) => (
                          <tr key={row.item_id} className="border-b border-[var(--border)]/60 last:border-none">
                            <td className="px-3 py-3">
                              <div className="font-semibold text-white">{row.name}</div>
                              <div className="text-xs text-[var(--muted)]">{row.item_code} / {row.category.replace("_", " ")}</div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="font-medium text-white">{deriveOperationalZone(row.category)}</div>
                            </td>
                            <td className="px-3 py-3 font-mono text-white">{formatKg(row.stock_balance_kg)}</td>
                            <td className="px-3 py-3">
                              <div className="text-white">
                                {row.last_variance_kg != null ? `${formatKg(row.last_variance_kg)} KG` : "-"}
                              </div>
                              <div className="text-xs text-[var(--muted)]">
                                {row.last_variance_percent != null ? formatPercent(row.last_variance_percent) : ""}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex rounded-full px-3 py-1 text-[10px] uppercase tracking-caption ${badgeTone(row.confidence_status)}`}>
                                {row.confidence_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {!stock.length ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)]">No inventory items found.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </ResponsiveScrollArea>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {canManage && (
                <Card>
                  <CardHeader>
                    <CardTitle>Add Material</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateItem} className="space-y-4">
                      <div>
                        <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Item Code</label>
                        <Input
                          value={form.item_code}
                          onChange={(e) => setForm({ ...form, item_code: e.target.value.toUpperCase() })}
                          placeholder="e.g. TMT-12MM"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Name</label>
                        <Input
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          placeholder="Full description"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Category</label>
                        <Select
                          value={form.category}
                          onChange={(e) => setForm({ ...form, category: e.target.value })}
                        >
                          <option value="raw_material">Raw Material (Scrap)</option>
                          <option value="wip">WIP (Ingot/Billet)</option>
                          <option value="finished_goods">Finished Goods</option>
                          <option value="consumable">Consumable</option>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Rate per KG (INR)</label>
                        <Input
                          type="number"
                          value={form.current_rate_per_kg}
                          onChange={(e) => setForm({ ...form, current_rate_per_kg: e.target.value })}
                          placeholder="Optional"
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Reorder Point (KG)</label>
                        <Input
                          type="number"
                          value={form.reorder_point_kg}
                          onChange={(e) => setForm({ ...form, reorder_point_kg: e.target.value })}
                          placeholder="Optional — auto-calculated if blank"
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Safety Stock (KG)</label>
                        <Input
                          type="number"
                          value={form.safety_stock_kg}
                          onChange={(e) => setForm({ ...form, safety_stock_kg: e.target.value })}
                          placeholder="Optional — minimum cushion before critical"
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Lead Time (Days)</label>
                        <Input
                          type="number"
                          value={form.lead_time_days}
                          onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })}
                          placeholder="Optional — days to replenish"
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={busy}>
                        {busy ? "Creating..." : "Add to Master"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Quick Navigation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link href="/steel/reconciliations" className="block">
                    <Button variant="outline" className="w-full justify-start text-sm">Stock Reconciliations</Button>
                  </Link>
                  <Link href="/steel/batches" className="block">
                    <Button variant="outline" className="w-full justify-start text-sm">Batch Traceability</Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        {/* ── TAB: Alerts & Reorder ───────────────────────────────────────── */}
        {activeTab === "alerts" && (
          <section className="grid gap-6 lg:grid-cols-2">
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Low Stock Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                {alerts.length === 0 ? (
                  <EmptyState message="No low-stock items. All stock levels are healthy." />
                ) : (
                  <div className="space-y-3">
                    {alerts.map((a) => (
                      <div key={a.item_id} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-3 last:border-none last:pb-0">
                        <div className="min-w-0">
                          <div className="font-semibold text-white">{a.name}</div>
                          <div className="text-xs text-[var(--muted)]">{a.item_code} / {a.category.replace("_", " ")}</div>
                          <div className="mt-1 text-xs text-[var(--muted)]">
                            Balance: {formatKg(a.current_balance_kg)} KG · Usage: {formatKg(a.avg_daily_usage_kg)} KG/day
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-semibold ${a.severity === "critical" ? "text-rose-400" : "text-amber-400"}`}>
                            {a.days_remaining.toFixed(1)} days left
                          </div>
                          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${severityBadge(a.severity)}`}>
                            {a.severity}
                          </span>
                          <div className="mt-1 text-xs text-[var(--muted)]">
                            Value: {formatCurrency(a.estimated_value_inr)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Reconciliation Pending</CardTitle>
              </CardHeader>
              <CardContent>
                {recRisk && (recRisk.pending_reviews > 0 || recRisk.stale_items.length > 0) ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
                      <div className="text-sm font-semibold">Pending Reviews</div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${(recRisk.pending_reviews ?? 0) > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                        {recRisk.pending_reviews}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
                      <div className="text-sm font-semibold">Stale Items (&gt;{recRisk.stale_sla_days}d SLA)</div>
                      <span className="inline-flex rounded-full px-3 py-1 text-sm font-semibold text-rose-400">
                        {recRisk.stale_items.length}
                      </span>
                    </div>
                    {recRisk.stale_items.slice(0, 5).map((item) => (
                      <div key={item.item_id} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{item.name}</div>
                          <div className="text-xs text-[var(--muted)]">{item.reason}</div>
                        </div>
                        <div className="text-right text-xs text-[var(--muted)]">
                          {formatKg(item.current_balance_kg)} KG
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No pending or stale reconciliations. Stock confidence is up to date." />
                )}
              </CardContent>
            </Card>

            {/* Suspicious Movements */}
            {suspicious.length > 0 && (
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm lg:col-span-2">
                <CardHeader>
                  <CardTitle>Suspicious Movements ({suspicious.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {suspicious.map((m, i) => (
                      <div key={`${m.type}-${m.item_id}-${i}`} className="flex items-start justify-between border-b border-[var(--border)]/60 pb-3 last:border-none last:pb-0">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{m.item_name} — {m.type.replace(/_/g, " ")}</div>
                          <div className="text-xs text-[var(--muted)]">{m.detail}</div>
                        </div>
                        <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${severityBadge(m.severity)}`}>
                          {m.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {/* ── TAB: Turnover ────────────────────────────────────────────────── */}
        {activeTab === "turnover" && (
          <section className="grid gap-6 lg:grid-cols-2">
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Fast Movers (Top 10)</CardTitle>
              </CardHeader>
              <CardContent>
                {turnoverItems.filter(t => t.avg_daily_out_kg > 0).slice(0, 10).length === 0 ? (
                  <EmptyState message="No usage data available yet." />
                ) : (
                  <div className="space-y-3">
                    {turnoverItems.filter(t => t.avg_daily_out_kg > 0).slice(0, 10).map((t) => (
                      <div key={t.item_id} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{t.name}</div>
                          <div className="text-xs text-[var(--muted)]">{t.category.replace("_", " ")}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-emerald-400">{formatKg(t.avg_daily_out_kg)} KG/day</div>
                          <div className="text-xs text-[var(--muted)]">{formatKg(t.total_outflow_kg_30d)} KG / 30d</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Days of Stock on Hand</CardTitle>
              </CardHeader>
              <CardContent>
                {turnoverItems.filter(t => t.days_of_stock_on_hand != null).length === 0 ? (
                  <EmptyState message="No stock coverage data available." />
                ) : (
                  <div className="space-y-3">
                    {turnoverItems
                      .filter(t => t.days_of_stock_on_hand != null)
                      .sort((a, b) => (b.days_of_stock_on_hand ?? 0) - (a.days_of_stock_on_hand ?? 0))
                      .slice(0, 10)
                      .map((t) => {
                        const dosh = t.days_of_stock_on_hand ?? 0;
                        const isHigh = dosh > 180;
                        const isMedium = dosh > 90;
                        return (
                          <div key={t.item_id} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white">{t.name}</div>
                              <div className="text-xs text-[var(--muted)]">{t.category.replace("_", " ")}</div>
                            </div>
                            <div className="text-right">
                              <div className={`font-semibold ${isHigh ? "text-rose-400" : isMedium ? "text-amber-400" : "text-emerald-400"}`}>
                                {dosh.toFixed(0)} days
                              </div>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${isHigh ? "border-rose-400/35 bg-rose-400/12 text-rose-200" : isMedium ? "border-amber-400/35 bg-amber-400/12 text-amber-200" : "border-emerald-400/35 bg-emerald-400/12 text-emerald-200"}`}>
                                {isHigh ? "Overstocked" : isMedium ? "Slow mover" : "Healthy"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Full turnover table */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm lg:col-span-2">
              <CardHeader>
                <CardTitle>All Items — Turnover Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveScrollArea
                  className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                  debugLabel="steel-turnover-table"
                >
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-3 font-medium">Item</th>
                        <th className="px-3 py-3 font-medium">Category</th>
                        <th className="px-3 py-3 font-medium">Balance KG</th>
                        <th className="px-3 py-3 font-medium">Avg Out KG/day</th>
                        <th className="px-3 py-3 font-medium">Days of Stock</th>
                        <th className="px-3 py-3 font-medium">30d Outflow KG</th>
                        <th className="px-3 py-3 font-medium">Value</th>
                        <th className="px-3 py-3 font-medium">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {turnoverItems.map((t) => (
                        <tr key={t.item_id} className="border-b border-[var(--border)]/60 last:border-none">
                          <td className="px-3 py-3 font-semibold text-white">{t.name}</td>
                          <td className="px-3 py-3 text-[var(--muted)]">{t.category.replace("_", " ")}</td>
                          <td className="px-3 py-3 font-mono text-white">{formatKg(t.current_balance_kg)}</td>
                          <td className="px-3 py-3 font-mono text-white">{formatKg(t.avg_daily_out_kg)}</td>
                          <td className="px-3 py-3 font-mono text-white">{t.days_of_stock_on_hand != null ? t.days_of_stock_on_hand.toFixed(0) : "-"}</td>
                          <td className="px-3 py-3 font-mono text-white">{formatKg(t.total_outflow_kg_30d)}</td>
                          <td className="px-3 py-3 font-mono text-white">{formatCurrency(t.estimated_value_inr)}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-caption ${badgeTone(t.confidence_status)}`}>
                              {t.confidence_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ResponsiveScrollArea>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── TAB: Slow / Dead / Overstock ────────────────────────────────── */}
        {activeTab === "slow_dead_overstock" && (
          <section className="grid gap-6 lg:grid-cols-3">
            {/* Dead Stock */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Dead Stock <span className="text-xs font-normal text-[var(--muted)]">(no transactions)</span></CardTitle>
              </CardHeader>
              <CardContent>
                {deadStock.length === 0 ? (
                  <EmptyState message="No dead stock detected." />
                ) : (
                  <div className="space-y-3">
                    <div className="text-2xl font-bold text-rose-400">{deadStock.length} items</div>
                    <div className="text-sm text-[var(--muted)]">
                      Total value at risk: {formatCurrency(deadStock.reduce((s, d) => s + d.estimated_value_inr, 0))}
                    </div>
                    {deadStock.slice(0, 8).map((d) => (
                      <div key={d.item_id} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{d.name}</div>
                          <div className="text-xs text-[var(--muted)]">{d.inactive_days} days inactive</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-white">{formatKg(d.current_balance_kg)} KG</div>
                          <div className="text-xs text-rose-400">{formatCurrency(d.estimated_value_inr)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Slow Moving */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Slow Moving <span className="text-xs font-normal text-[var(--muted)]">(&lt;10 KG/day)</span></CardTitle>
              </CardHeader>
              <CardContent>
                {slowMoving.length === 0 ? (
                  <EmptyState message="No slow-moving items detected." />
                ) : (
                  <div className="space-y-3">
                    <div className="text-2xl font-bold text-amber-400">{slowMoving.length} items</div>
                    <div className="text-sm text-[var(--muted)]">
                      Total value tied up: {formatCurrency(slowMoving.reduce((s, d) => s + d.estimated_value_inr, 0))}
                    </div>
                    {slowMoving.slice(0, 8).map((s) => (
                      <div key={s.item_id} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{s.name}</div>
                          <div className="text-xs text-[var(--muted)]">{formatKg(s.avg_daily_out_kg)} KG/day</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-white">{formatKg(s.current_balance_kg)} KG</div>
                          <div className="text-xs text-amber-400">{s.days_of_stock_on_hand?.toFixed(0) ?? "-"} days coverage</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Overstocked */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Overstocked <span className="text-xs font-normal text-[var(--muted)]">(&gt;180 days cover)</span></CardTitle>
              </CardHeader>
              <CardContent>
                {overstocked.length === 0 ? (
                  <EmptyState message="No overstocked items detected." />
                ) : (
                  <div className="space-y-3">
                    <div className="text-2xl font-bold text-rose-400">{overstocked.length} items</div>
                    <div className="text-sm text-[var(--muted)]">
                      Excess value: {formatCurrency(overstocked.reduce((s, d) => s + d.estimated_value_inr, 0))}
                    </div>
                    {overstocked.slice(0, 8).map((o) => (
                      <div key={o.item_id} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{o.name}</div>
                          <div className="text-xs text-[var(--muted)]">{formatKg(o.avg_daily_out_kg)} KG/day</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-white">{formatKg(o.current_balance_kg)} KG</div>
                          <div className="text-xs text-rose-400">{o.days_of_stock_on_hand.toFixed(0)} days</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── TAB: Value & ABC Analysis ──────────────────────────────────── */}
        {activeTab === "value_abc" && (
          <section className="space-y-6">
            {/* Valuation Summary */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Total Inventory Value</div>
                  <div className="mt-1 text-2xl font-bold">{formatCurrency(valuation?.total_estimated_value_inr)}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{valuation?.method}</div>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">A Items (80% value)</div>
                  <div className="mt-1 text-2xl font-bold text-emerald-400">{abc?.summary.a_count ?? 0}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{formatCurrency(abc?.summary.a_value_inr)}</div>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">B Items (15% value)</div>
                  <div className="mt-1 text-2xl font-bold text-amber-400">{abc?.summary.b_count ?? 0}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{formatCurrency(abc?.summary.b_value_inr)}</div>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardContent className="pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)]">C Items (5% value)</div>
                  <div className="mt-1 text-2xl font-bold text-amber-400">{abc?.summary.c_count ?? 0}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{formatCurrency(abc?.summary.c_value_inr)}</div>
                </CardContent>
              </Card>
            </div>

            {/* Category Value Breakdown */}
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Value by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {valuation && valuation.by_category.length > 0 ? (
                  <div className="space-y-3">
                    {valuation.by_category.map((cat) => {
                      const pct = valuation.total_estimated_value_inr > 0
                        ? (cat.value_inr / valuation.total_estimated_value_inr) * 100
                        : 0;
                      return (
                        <div key={cat.category}>
                          <div className="mb-1 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white">{cat.category.replace(/_/g, " ")}</span>
                              <span className="text-xs text-[var(--muted)]">({cat.item_count} items)</span>
                            </div>
                            <div className="text-right">
                              <span className="font-semibold text-white">{formatCurrency(cat.value_inr)}</span>
                              <span className="ml-2 text-xs text-[var(--muted)]">({formatPercent(pct)})</span>
                            </div>
                          </div>
                          <div className="h-2.5 rounded-full bg-[rgba(255,255,255,0.08)]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState message="No valuation data available." />
                )}
              </CardContent>
            </Card>

            {/* ABC Detail */}
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="border border-emerald-400/20 bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardHeader>
                  <CardTitle className="text-emerald-400">A Items — High Value</CardTitle>
                </CardHeader>
                <CardContent>
                  {abc && abc.a_items.length > 0 ? (
                    <div className="space-y-2">
                      {abc.a_items.map((a) => (
                        <div key={a.item_id} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white">{a.name}</div>
                            <div className="text-xs text-[var(--muted)]">{a.category.replace("_", " ")}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-white">{formatCurrency(a.estimated_value_inr)}</div>
                            <div className="text-xs text-emerald-400">{formatPercent(a.contribution_percent)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState message="No A-class items." />
                  )}
                </CardContent>
              </Card>

              <Card className="border border-amber-400/20 bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardHeader>
                  <CardTitle className="text-amber-400">B Items — Medium Value</CardTitle>
                </CardHeader>
                <CardContent>
                  {abc && abc.b_items.length > 0 ? (
                    <div className="space-y-2">
                      {abc.b_items.map((b) => (
                        <div key={b.item_id} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white">{b.name}</div>
                            <div className="text-xs text-[var(--muted)]">{b.category.replace("_", " ")}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-white">{formatCurrency(b.estimated_value_inr)}</div>
                            <div className="text-xs text-amber-400">{formatPercent(b.contribution_percent)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState message="No B-class items." />
                  )}
                </CardContent>
              </Card>

              <Card className="border border-rose-400/20 bg-[rgba(20,24,36,0.7)] shadow-sm">
                <CardHeader>
                  <CardTitle className="text-rose-400">C Items — Low Value</CardTitle>
                </CardHeader>
                <CardContent>
                  {abc && abc.c_items.length > 0 ? (
                    <div className="space-y-2">
                      {abc.c_items.map((c) => (
                        <div key={c.item_id} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white">{c.name}</div>
                            <div className="text-xs text-[var(--muted)]">{c.category.replace("_", " ")}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-white">{formatCurrency(c.estimated_value_inr)}</div>
                            <div className="text-xs text-rose-400">{formatPercent(c.contribution_percent)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState message="No C-class items." />
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        {/* ── TAB: Reconciliation Risk ───────────────────────────────────── */}
        {activeTab === "reconciliation_risk" && (
          <section className="grid gap-6 lg:grid-cols-2">
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>Stale Reconciliations <span className="text-xs font-normal text-[var(--muted)]">(&gt;{recRisk?.stale_sla_days ?? 14}d SLA)</span></CardTitle>
              </CardHeader>
              <CardContent>
                {recRisk && recRisk.stale_items.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
                      <div className="text-sm font-semibold">Total stale items</div>
                      <span className="text-xl font-bold text-rose-400">{recRisk.stale_items.length}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] p-3">
                      <div className="text-sm font-semibold">Pending reviews</div>
                      <span className={`text-xl font-bold ${(recRisk.pending_reviews ?? 0) > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                        {recRisk.pending_reviews}
                      </span>
                    </div>
                    <div className="mt-4 space-y-2">
                      {recRisk.stale_items.map((item) => (
                        <div key={item.item_id} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-2 last:border-none last:pb-0">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white">{item.name}</div>
                            <div className="text-xs text-[var(--muted)]">{item.reason}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-sm text-white">{formatKg(item.current_balance_kg)} KG</div>
                            <div className="text-xs text-[var(--muted)]">{formatCurrency(item.estimated_value_inr)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <EmptyState message="All reconciliations are up to date." />
                )}
              </CardContent>
            </Card>

            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.7)] shadow-sm">
              <CardHeader>
                <CardTitle>High Variance Items <span className="text-xs font-normal text-[var(--muted)]">(&gt;5% variance)</span></CardTitle>
              </CardHeader>
              <CardContent>
                {recRisk && recRisk.high_variance_items.length > 0 ? (
                  <div className="space-y-3">
                    {recRisk.high_variance_items.map((item) => (
                      <div key={item.item_id} className="flex items-center justify-between border-b border-[var(--border)]/60 pb-3 last:border-none last:pb-0">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{item.name}</div>
                          <div className="text-xs text-[var(--muted)]">{item.item_code} / {item.category.replace("_", " ")}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-rose-400">{formatPercent(item.variance_percent ?? 0)}</div>
                          <div className="text-xs text-[var(--muted)]">{formatKg(item.variance_kg ?? 0)} KG variance</div>
                          {item.mismatch_cause && (
                            <div className="text-xs text-amber-400">{item.mismatch_cause.replace(/_/g, " ")}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No high-variance items. All stock records are within tolerance." />
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </main>
  );
}
