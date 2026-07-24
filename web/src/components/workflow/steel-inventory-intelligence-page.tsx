"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getSteelInventoryIntelligence,
  type InventoryIntelligence,
  type LowStockAlert,
  type DeadStockItem,
  type TurnoverItem,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { DashboardPageSkeleton } from "@/components/shared/page-skeletons";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";

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

function badgeTone(value: string) {
  if (value === "critical" || value === "red") return "border-rose-400/35 bg-rose-400/12 text-rose-200";
  if (value === "warning" || value === "yellow") return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  return "border-emerald-400/35 bg-emerald-400/12 text-emerald-200";
}

export function SteelInventoryIntelligencePage() {
  const { user, loading: sessionLoading } = useSession();
  const [data, setData] = useState<InventoryIntelligence | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);
    try {
      const result = await getSteelInventoryIntelligence();
      setData(result);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load inventory intelligence.");
    } finally {
      setPageLoading(false);
    }
  }, [user]);

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
          <CardHeader><CardTitle>Inventory Intelligence</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">Please sign in to continue.</div>
            <Link href="/access"><Button>Open Access</Button></Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const lowStockAlerts = data?.low_stock_alerts || [];
  const deadStock = data?.dead_stock || [];
  const turnoverItems = data?.turnover_analysis.items || [];
  const categorySummary = data?.turnover_analysis.category_summary || [];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fafaf9_0%,#f5f5f4_48%,#fafaf9_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <section className="rounded-[2rem] border border-[#e7e5e4] bg-[linear-gradient(135deg,#ffffff,#fafaf9)] p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-prominent text-[#78716c]">Inventory Intelligence</div>
              <h1 className="mt-2 text-3xl font-semibold text-[#111111] md:text-4xl">
                Know every KG — low stock, dead stock, turnover
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#57534e]">
                Monitor inventory health with automated low-stock alerts, dead-stock detection,
                and turnover velocity analysis to keep production flowing.
              </p>
            </div>
            <Button variant="outline" onClick={() => void refresh()} disabled={pageLoading}>
              {pageLoading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
        ) : null}

        {/* Summary cards */}
        <section className="grid gap-4 md:grid-cols-4">
          <Card className="border border-[#e7e5e4] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="text-xs uppercase tracking-wider text-[#78716c]">Low Stock Alerts</div>
              <CardTitle className="text-lg text-[#111111]">Items below threshold</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[#111111]">{lowStockAlerts.length}</div>
              <div className="mt-1 text-xs text-[#57534e]">
                {lowStockAlerts.filter((a) => a.severity === "critical").length} critical
              </div>
            </CardContent>
          </Card>
          <Card className="border border-[#e7e5e4] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="text-xs uppercase tracking-wider text-[#78716c]">Dead Stock</div>
              <CardTitle className="text-lg text-[#111111]">Inactive items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[#111111]">{deadStock.length}</div>
              <div className="mt-1 text-xs text-[#57534e]">
                Value at risk: {formatCurrency(deadStock.reduce((s, i) => s + i.estimated_value_inr, 0))}
              </div>
            </CardContent>
          </Card>
          <Card className="border border-[#e7e5e4] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="text-xs uppercase tracking-wider text-[#78716c]">Active Items</div>
              <CardTitle className="text-lg text-[#111111]">In turnover</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[#111111]">{turnoverItems.length}</div>
              <div className="mt-1 text-xs text-[#57534e]">
                {categorySummary.length} categories tracked
              </div>
            </CardContent>
          </Card>
          <Card className="border border-[#e7e5e4] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="text-xs uppercase tracking-wider text-[#78716c]">Categories</div>
              <CardTitle className="text-lg text-[#111111]">Stock by type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                {categorySummary.map((cat) => (
                  <div key={cat.category} className="flex justify-between">
                    <span className="text-[#57534e]">{cat.category.replace("_", " ")}</span>
                    <span className="font-semibold text-[#111111]">{formatKg(cat.total_balance_kg)} KG</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Low Stock Alerts */}
        <Card className="border border-[#e7e5e4] bg-white shadow-sm">
          <CardHeader>
            <div className="text-xs uppercase tracking-wider text-[#78716c]">Risk Alerts</div>
            <CardTitle className="text-xl text-[#111111]">Low Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockAlerts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e7e5e4] px-4 py-8 text-center text-sm text-[#57534e]">
                No items are currently below the low-stock threshold. All inventory levels are healthy.
              </div>
            ) : (
              <ResponsiveScrollArea
                className="rounded-3xl border border-[#e7e5e4]"
                debugLabel="inventory-intelligence-low-stock"
              >
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[#78716c]">
                    <tr className="border-b border-[#e7e5e4]">
                      <th className="px-3 py-3 font-medium">Item</th>
                      <th className="px-3 py-3 font-medium">Category</th>
                      <th className="px-3 py-3 font-medium">Balance KG</th>
                      <th className="px-3 py-3 font-medium">Avg Daily Usage</th>
                      <th className="px-3 py-3 font-medium">Days Remaining</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStockAlerts.map((alert) => (
                      <tr key={alert.item_id} className="border-b border-[#e7e5e4]/60 last:border-none">
                        <td className="px-3 py-3">
                          <div className="font-semibold text-[#111111]">{alert.name}</div>
                          <div className="text-xs text-[#78716c]">{alert.item_code}</div>
                        </td>
                        <td className="px-3 py-3 text-[#57534e]">{alert.category.replace("_", " ")}</td>
                        <td className="px-3 py-3 font-semibold text-[#111111]">{formatKg(alert.current_balance_kg)}</td>
                        <td className="px-3 py-3 text-[#57534e]">{formatKg(alert.avg_daily_usage_kg)}</td>
                        <td className="px-3 py-3">
                          <span className={alert.days_remaining < 3 ? "text-rose-500 font-semibold" : "text-[#57534e]"}>
                            {alert.days_remaining.toFixed(1)} days
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-caption ${badgeTone(alert.severity)}`}>
                            {alert.severity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Dead Stock */}
        <Card className="border border-[#e7e5e4] bg-white shadow-sm">
          <CardHeader>
            <div className="text-xs uppercase tracking-wider text-[#78716c]">Capital Trapped</div>
            <CardTitle className="text-xl text-[#111111]">Dead Stock</CardTitle>
          </CardHeader>
          <CardContent>
            {deadStock.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e7e5e4] px-4 py-8 text-center text-sm text-[#57534e]">
                No dead stock detected. All items have recent transaction activity.
              </div>
            ) : (
              <ResponsiveScrollArea
                className="rounded-3xl border border-[#e7e5e4]"
                debugLabel="inventory-intelligence-dead-stock"
              >
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[#78716c]">
                    <tr className="border-b border-[#e7e5e4]">
                      <th className="px-3 py-3 font-medium">Item</th>
                      <th className="px-3 py-3 font-medium">Category</th>
                      <th className="px-3 py-3 font-medium">Balance KG</th>
                      <th className="px-3 py-3 font-medium">Est. Value</th>
                      <th className="px-3 py-3 font-medium">Inactive Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deadStock.map((item) => (
                      <tr key={item.item_id} className="border-b border-[#e7e5e4]/60 last:border-none">
                        <td className="px-3 py-3">
                          <div className="font-semibold text-[#111111]">{item.name}</div>
                          <div className="text-xs text-[#78716c]">{item.item_code}</div>
                        </td>
                        <td className="px-3 py-3 text-[#57534e]">{item.category.replace("_", " ")}</td>
                        <td className="px-3 py-3 font-semibold text-[#111111]">{formatKg(item.current_balance_kg)}</td>
                        <td className="px-3 py-3 font-semibold text-[#111111]">{formatCurrency(item.estimated_value_inr)}</td>
                        <td className="px-3 py-3 text-[#57534e]">{item.inactive_days} days</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Turnover Analysis */}
        <Card className="border border-[#e7e5e4] bg-white shadow-sm">
          <CardHeader>
            <div className="text-xs uppercase tracking-wider text-[#78716c]">Velocity</div>
            <CardTitle className="text-xl text-[#111111]">Turnover Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            {turnoverItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e7e5e4] px-4 py-8 text-center text-sm text-[#57534e]">
                No turnover data available yet. Record inventory transactions to see velocity metrics.
              </div>
            ) : (
              <ResponsiveScrollArea
                className="rounded-3xl border border-[#e7e5e4]"
                debugLabel="inventory-intelligence-turnover"
              >
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[#78716c]">
                    <tr className="border-b border-[#e7e5e4]">
                      <th className="px-3 py-3 font-medium">Item</th>
                      <th className="px-3 py-3 font-medium">Balance KG</th>
                      <th className="px-3 py-3 font-medium">Avg Out/ Day</th>
                      <th className="px-3 py-3 font-medium">Days of Stock</th>
                      <th className="px-3 py-3 font-medium">30d Outflow</th>
                      <th className="px-3 py-3 font-medium">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {turnoverItems.map((item) => (
                      <tr key={item.item_id} className="border-b border-[#e7e5e4]/60 last:border-none">
                        <td className="px-3 py-3">
                          <div className="font-semibold text-[#111111]">{item.name}</div>
                          <div className="text-xs text-[#78716c]">{item.item_code} / {item.category.replace("_", " ")}</div>
                        </td>
                        <td className="px-3 py-3 font-semibold text-[#111111]">{formatKg(item.current_balance_kg)}</td>
                        <td className="px-3 py-3 text-[#57534e]">{formatKg(item.avg_daily_out_kg)}</td>
                        <td className="px-3 py-3 text-[#57534e]">
                          {item.days_of_stock_on_hand != null ? `${item.days_of_stock_on_hand.toFixed(1)} d` : "N/A"}
                        </td>
                        <td className="px-3 py-3 font-semibold text-[#111111]">{formatKg(item.total_outflow_kg_30d)}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-caption ${badgeTone(item.confidence_status)}`}>
                            {item.confidence_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
