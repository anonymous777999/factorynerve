"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getSteelSalesIntelligence,
  type SalesIntelligence,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { DashboardPageSkeleton } from "@/components/shared/page-skeletons";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatKg(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value || 0);
}

function riskBadge(level: string) {
  if (level === "high" || level === "critical") return "border-rose-400/35 bg-rose-400/12 text-rose-200";
  if (level === "medium") return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  return "border-emerald-400/35 bg-emerald-400/12 text-emerald-200";
}

export function SteelSalesIntelligencePage() {
  const { user, loading: sessionLoading } = useSession();
  const [data, setData] = useState<SalesIntelligence | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;
    setPageLoading(true);
    try {
      const result = await getSteelSalesIntelligence();
      setData(result);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load sales intelligence.");
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
          <CardHeader><CardTitle>Sales Intelligence</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">Please sign in to continue.</div>
            <Link href="/access"><Button>Open Access</Button></Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const period = data?.sales_trends.period;
  const monthlyTrend = data?.sales_trends.monthly_trend || [];
  const topCustomers = data?.customer_analytics.top_by_revenue || [];
  const topOutstanding = data?.customer_analytics.top_by_outstanding || [];
  const riskLevels = data?.customer_analytics.by_risk_level || [];
  const volumeTiers = data?.customer_analytics.by_volume_tier || [];
  const funnel = data?.fulfillment_funnel;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fafaf9_0%,#f5f5f4_48%,#fafaf9_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <section className="rounded-[2rem] border border-[#e7e5e4] bg-[linear-gradient(135deg,#ffffff,#fafaf9)] p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-prominent text-[#78716c]">Sales Intelligence</div>
              <h1 className="mt-2 text-3xl font-semibold text-[#111111] md:text-4xl">
                Revenue, customers &amp; fulfilment at a glance
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#57534e]">
                Track sales trends, customer segments, and the fulfilment funnel — from invoice
                through dispatch and delivery to payment.
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

        {/* Period Summary Cards */}
        <section className="grid gap-4 md:grid-cols-4">
          <Card className="border border-[#e7e5e4] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="text-xs uppercase tracking-wider text-[#78716c]">Total Revenue</div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[#111111]">{formatCurrency(period?.total_revenue_inr)}</div>
              <div className="mt-1 text-xs text-[#57534e]">{period?.time_period_days}-day period</div>
            </CardContent>
          </Card>
          <Card className="border border-[#e7e5e4] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="text-xs uppercase tracking-wider text-[#78716c]">Total Volume</div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[#111111]">{formatKg(period?.total_weight_kg)} KG</div>
              <div className="mt-1 text-xs text-[#57534e]">{period?.invoice_count} invoices</div>
            </CardContent>
          </Card>
          <Card className="border border-[#e7e5e4] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="text-xs uppercase tracking-wider text-[#78716c]">Active Customers</div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[#111111]">{data?.customer_analytics.total_customers || 0}</div>
              <div className="mt-1 text-xs text-[#57534e]">
                {riskLevels.find((r) => r.risk_level === "high" || r.risk_level === "critical")?.count || 0} high-risk
              </div>
            </CardContent>
          </Card>
          <Card className="border border-[#e7e5e4] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="text-xs uppercase tracking-wider text-[#78716c]">Fulfilment Rate</div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-[#111111]">
                {funnel?.conversion_rates.invoice_to_dispatch_pct ?? 0}%
              </div>
              <div className="mt-1 text-xs text-[#57534e]">
                {funnel?.paid_invoices ?? 0} of {funnel?.invoiced_count ?? 0} paid
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Monthly Revenue Trend */}
        <Card className="border border-[#e7e5e4] bg-white shadow-sm">
          <CardHeader>
            <div className="text-xs uppercase tracking-wider text-[#78716c]">Trends</div>
            <CardTitle className="text-xl text-[#111111]">Monthly Revenue &amp; Volume</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyTrend.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e7e5e4] px-4 py-8 text-center text-sm text-[#57534e]">
                No monthly trend data available yet.
              </div>
            ) : (
              <ResponsiveScrollArea
                className="rounded-3xl border border-[#e7e5e4]"
                debugLabel="sales-monthly-trend"
              >
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[#78716c]">
                    <tr className="border-b border-[#e7e5e4]">
                      <th className="px-3 py-3 font-medium">Month</th>
                      <th className="px-3 py-3 font-medium">Revenue</th>
                      <th className="px-3 py-3 font-medium">Volume KG</th>
                      <th className="px-3 py-3 font-medium">Invoices</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyTrend.map((m) => (
                      <tr key={m.month} className="border-b border-[#e7e5e4]/60 last:border-none">
                        <td className="px-3 py-3 font-semibold text-[#111111]">{m.month}</td>
                        <td className="px-3 py-3 text-[#111111]">{formatCurrency(m.revenue_inr)}</td>
                        <td className="px-3 py-3 text-[#57534e]">{formatKg(m.weight_kg)}</td>
                        <td className="px-3 py-3 text-[#57534e]">{m.invoice_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Top Customers + Outstanding */}
        <section className="grid gap-6 md:grid-cols-2">
          {/* Top Customers by Revenue */}
          <Card className="border border-[#e7e5e4] bg-white shadow-sm">
            <CardHeader>
              <div className="text-xs uppercase tracking-wider text-[#78716c]">Top Accounts</div>
              <CardTitle className="text-xl text-[#111111]">By Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              {topCustomers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#e7e5e4] px-4 py-8 text-center text-sm text-[#57534e]">
                  No customer revenue data yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {topCustomers.map((c) => (
                    <div key={c.customer_id} className="flex items-center justify-between border-b border-[#e7e5e4]/60 pb-2 last:border-none last:pb-0">
                      <div>
                        <div className="font-semibold text-[#111111]">{c.customer_name}</div>
                        <div className="text-xs text-[#78716c]">
                          {c.invoice_count} invoices &middot; {formatKg(c.weight_kg)} KG
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-[#111111]">{formatCurrency(c.revenue_inr)}</div>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs uppercase tracking-caption ${riskBadge(c.risk_level)}`}>
                          {c.risk_level}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Outstanding */}
          <Card className="border border-[#e7e5e4] bg-white shadow-sm">
            <CardHeader>
              <div className="text-xs uppercase tracking-wider text-[#78716c]">Receivables</div>
              <CardTitle className="text-xl text-[#111111]">Top Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              {topOutstanding.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#e7e5e4] px-4 py-8 text-center text-sm text-[#57534e]">
                  All invoices appear paid. No outstanding amounts.
                </div>
              ) : (
                <div className="space-y-3">
                  {topOutstanding.map((c) => (
                    <div key={c.customer_id} className="flex items-center justify-between border-b border-[#e7e5e4]/60 pb-2 last:border-none last:pb-0">
                      <div>
                        <div className="font-semibold text-[#111111]">{c.customer_name}</div>
                        <div className="text-xs text-[#78716c]">
                          {c.overdue_days > 0 ? `${c.overdue_days} days overdue` : "Due soon"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-[#111111]">{formatCurrency(c.outstanding_inr)}</div>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs uppercase tracking-caption ${riskBadge(c.risk_level)}`}>
                          {c.risk_level}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Customer Segmentation */}
        <section className="grid gap-6 md:grid-cols-2">
          <Card className="border border-[#e7e5e4] bg-white shadow-sm">
            <CardHeader>
              <div className="text-xs uppercase tracking-wider text-[#78716c]">Risk Profile</div>
              <CardTitle className="text-xl text-[#111111]">By Risk Level</CardTitle>
            </CardHeader>
            <CardContent>
              {riskLevels.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#e7e5e4] px-4 py-8 text-center text-sm text-[#57534e]">
                  No customer risk data available.
                </div>
              ) : (
                <div className="space-y-3">
                  {riskLevels.map((r) => (
                    <div key={r.risk_level} className="flex items-center justify-between border-b border-[#e7e5e4]/60 pb-2 last:border-none last:pb-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex h-3 w-3 rounded-full ${r.risk_level === "critical" || r.risk_level === "high" ? "bg-rose-500" : r.risk_level === "medium" ? "bg-amber-500" : "bg-emerald-500"}`} />
                        <span className="font-semibold text-[#111111] capitalize">{r.risk_level}</span>
                      </div>
                      <span className="font-semibold text-[#111111]">{r.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-[#e7e5e4] bg-white shadow-sm">
            <CardHeader>
              <div className="text-xs uppercase tracking-wider text-[#78716c]">Volume Groups</div>
              <CardTitle className="text-xl text-[#111111]">By Volume Tier</CardTitle>
            </CardHeader>
            <CardContent>
              {volumeTiers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#e7e5e4] px-4 py-8 text-center text-sm text-[#57534e]">
                  No volume tier data available.
                </div>
              ) : (
                <div className="space-y-3">
                  {volumeTiers.map((t) => (
                    <div key={t.label} className="flex items-center justify-between border-b border-[#e7e5e4]/60 pb-2 last:border-none last:pb-0">
                      <div>
                        <div className="font-semibold text-[#111111]">{t.label}</div>
                        <div className="text-xs text-[#78716c]">
                          &ge;{formatKg(t.min_kg)} KG &middot; {t.count} customers
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-[#111111]">{formatCurrency(t.total_revenue_inr)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Fulfillment Funnel */}
        <Card className="border border-[#e7e5e4] bg-white shadow-sm">
          <CardHeader>
            <div className="text-xs uppercase tracking-wider text-[#78716c]">Funnel</div>
            <CardTitle className="text-xl text-[#111111]">Fulfillment Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {funnel ? (
              <div className="grid gap-6 md:grid-cols-4">
                <div className="rounded-2xl border border-[#e7e5e4] p-4 text-center">
                  <div className="text-3xl font-bold text-[#111111]">{funnel.invoiced_count}</div>
                  <div className="mt-1 text-xs text-[#78716c]">Invoiced</div>
                  <div className="mt-2 h-2 rounded-full bg-[#e7e5e4]">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: "100%" }} />
                  </div>
                </div>
                <div className="rounded-2xl border border-[#e7e5e4] p-4 text-center">
                  <div className="text-3xl font-bold text-[#111111]">{funnel.dispatched_count}</div>
                  <div className="mt-1 text-xs text-[#78716c]">Dispatched</div>
                  <div className="mt-2 h-2 rounded-full bg-[#e7e5e4]">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${funnel.conversion_rates.invoice_to_dispatch_pct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-[#57534e]">{funnel.conversion_rates.invoice_to_dispatch_pct}% of invoiced</div>
                </div>
                <div className="rounded-2xl border border-[#e7e5e4] p-4 text-center">
                  <div className="text-3xl font-bold text-[#111111]">{funnel.delivered_count}</div>
                  <div className="mt-1 text-xs text-[#78716c]">Delivered</div>
                  <div className="mt-2 h-2 rounded-full bg-[#e7e5e4]">
                    <div
                      className="h-full rounded-full bg-violet-500"
                      style={{ width: `${funnel.conversion_rates.dispatch_to_delivery_pct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-[#57534e]">{funnel.conversion_rates.dispatch_to_delivery_pct}% of dispatched</div>
                </div>
                <div className="rounded-2xl border border-[#e7e5e4] p-4 text-center">
                  <div className="text-3xl font-bold text-[#111111]">{funnel.paid_invoices}</div>
                  <div className="mt-1 text-xs text-[#78716c]">Paid</div>
                  <div className="mt-2 h-2 rounded-full bg-[#e7e5e4]">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${funnel.conversion_rates.invoice_to_paid_pct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-[#57534e]">{funnel.conversion_rates.invoice_to_paid_pct}% of invoiced</div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#e7e5e4] px-4 py-8 text-center text-sm text-[#57534e]">
                No fulfillment data available yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
