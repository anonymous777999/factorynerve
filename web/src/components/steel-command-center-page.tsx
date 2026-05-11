"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { IndustrialFactoryDashboard } from "@/components/dashboard/industrial-factory-dashboard";
import { KPIBox } from "@/components/dashboard/kpi-box";
import { SteelQuickActionRow, SteelStatusStrip, SteelTopPriorityCard } from "@/components/steel-summary-primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { buildSteelDashboardData, type IndustrialDashboardData } from "@/lib/industrial-dashboard";
import { deriveDataConfidence, deriveOverallStatusSummary, deriveSteelTopPriority } from "@/lib/steel-decision";
import {
  getSteelOverview,
  getSteelOwnerDailyPdfUrl,
  listSteelBatches,
  listSteelDispatches,
  listSteelInvoices,
  listSteelStock,
  type SteelBatch,
  type SteelDispatch,
  type SteelInvoice,
  type SteelOverview,
  type SteelStockItem,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";

type SteelControlTab = "overview" | "inventory" | "production" | "sales" | "risk";

const STEEL_CONTROL_TABS: Array<{ id: SteelControlTab; label: string; hint: string }> = [
  { id: "overview", label: "Overview", hint: "Live command view" },
  { id: "inventory", label: "Inventory", hint: "Stock trust + reconciliation" },
  { id: "production", label: "Production", hint: "Batch recording + traceability" },
  { id: "sales", label: "Sales", hint: "Invoices + dispatch flow" },
  { id: "risk", label: "Risk", hint: "Leakage + responsibility review" },
];

function isSteelControlTab(value: string | null): value is SteelControlTab {
  return value === "overview" || value === "inventory" || value === "production" || value === "sales" || value === "risk";
}

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

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

function formatPercent(value: number | null | undefined, digits = 2) {
  return `${(value || 0).toFixed(digits)}%`;
}

function deriveOperationalZone(category: string | null | undefined) {
  if (category === "raw_material") return "Yard";
  if (category === "wip") return "Production Line";
  return "Warehouse";
}

function badgeTone(value: string) {
  if (value === "green" || value === "normal") return "border-emerald-400/35 bg-emerald-400/12 text-emerald-200";
  if (value === "yellow" || value === "watch") return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  if (value === "high") return "border-orange-400/35 bg-orange-400/12 text-orange-200";
  return "border-rose-400/35 bg-rose-400/12 text-rose-200";
}

export function SteelCommandCenterPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, activeFactory, loading, error: sessionError } = useSession();
  const [overview, setOverview] = useState<SteelOverview | null>(null);
  const [stock, setStock] = useState<SteelStockItem[]>([]);
  const [batches, setBatches] = useState<SteelBatch[]>([]);
  const [steelDashboardData, setSteelDashboardData] = useState<Partial<Record<"today" | "7d" | "30d", IndustrialDashboardData>> | undefined>(undefined);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");

  const [ownerReportDate, setOwnerReportDate] = useState(todayValue());

  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";
  const canAccessSteelControl =
    user?.role === "owner" ||
    user?.role === "manager" ||
    user?.role === "supervisor";
  const [activeTab, setActiveTab] = useState<SteelControlTab>(() => {
    const requestedTab = searchParams.get("tab");
    return isSteelControlTab(requestedTab) ? requestedTab : "overview";
  });

  const navigateTab = useCallback((tab: SteelControlTab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "overview") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    const nextTab = isSteelControlTab(requestedTab) ? requestedTab : "overview";
    setActiveTab((current) => (current === nextTab ? current : nextTab));
  }, [searchParams]);

  const refreshAll = useCallback(async () => {
    if (!canAccessSteelControl) {
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    try {
      if (!isSteelFactory) {
        // Keep the chart board available with reference data even when a steel factory is not active.
        setOverview(null);
        setStock([]);
        setBatches([]);
        setSteelDashboardData(undefined);
        setError("");
      } else {
        const [nextOverview, nextStock, nextBatches, nextInvoices, nextDispatches] = await Promise.all([
          getSteelOverview(),
          listSteelStock(),
          listSteelBatches(60),
          listSteelInvoices(60),
          listSteelDispatches(60),
        ]);
        setOverview(nextOverview);
        setStock(nextStock.items || []);
        setBatches(nextBatches.items || []);
        setSteelDashboardData(
          buildSteelDashboardData({
            overview: nextOverview,
            batches: (nextBatches.items || []) as SteelBatch[],
            invoices: (nextInvoices.items || []) as SteelInvoice[],
            dispatches: (nextDispatches.items || []) as SteelDispatch[],
          }),
        );
        setError("");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load steel operations.");
    } finally {
      setPageLoading(false);
    }
  }, [canAccessSteelControl, isSteelFactory]);

  useEffect(() => {
    if (!user || !canAccessSteelControl) {
      setPageLoading(false);
      return;
    }
    void refreshAll();
  }, [canAccessSteelControl, refreshAll, user]);

  useEffect(() => {
    if (!isSteelFactory) {
      setActiveTab("overview");
    }
  }, [isSteelFactory]);

  const inventoryZones = useMemo(() => {
    return stock.reduce(
      (acc, row) => {
        const zone = deriveOperationalZone(row.category);
        acc[zone] = Number(acc[zone] || 0) + Number(row.stock_balance_kg || 0);
        return acc;
      },
      { Yard: 0, "Production Line": 0, Warehouse: 0 } as Record<string, number>,
    );
  }, [stock]);
  const profitSummary = overview?.profit_summary;
  const anomalySummary = overview?.anomaly_summary;
  const responsibility = overview?.responsibility_analytics;
  const rankedAnomalies = overview?.ranked_anomalies || [];
  const bestProfitBatch = profitSummary?.best_profit_batch;
  const highestRiskOperator = anomalySummary?.highest_risk_operator;
  const highestLossDay = anomalySummary?.highest_loss_day;
  const canSeeFinancials = Boolean(overview?.financial_access && user?.role === "owner");
  const chartRecordCoverage = batches.length + Number(profitSummary?.invoice_count || 0) + Number(profitSummary?.dispatch_count || 0);
  const summaryRange = steelDashboardData?.today || steelDashboardData?.["7d"] || steelDashboardData?.["30d"];
  const hasLiveDashboard = Boolean(overview && steelDashboardData);
  const overallStatus = deriveOverallStatusSummary({ overview, chartRecordCoverage, hasLiveDashboard });
  const confidenceSummary = deriveDataConfidence({ overview, chartRecordCoverage, hasLiveDashboard });
  const topPriority = deriveSteelTopPriority(overview);
  const criticalKpis = summaryRange
    ? [
      summaryRange.kpis.todayLoss,
      summaryRange.kpis.totalStock,
      summaryRange.kpis.todayProduction,
      ...(canSeeFinancials ? [summaryRange.kpis.todayRevenue] : []),
    ]
    : [];
  const quickActions = [
    topPriority.primaryAction,
    { href: "/steel/production/record", label: "Record Batch", variant: "primary" as const },
    { href: "/steel/inventory", label: "Inventory Desk", variant: "secondary" as const },
    { href: "/steel/invoices", label: "Invoices", variant: "secondary" as const },
    { href: "/steel/dispatches", label: "Dispatches", variant: "secondary" as const },
  ];
  const steelHubSections = useMemo(
    () => [
      {
        id: "stock-lane",
        tab: "inventory" as SteelControlTab,
        eyebrow: "Stock",
        title: "Trust the live ledger",
        detail: `${overview?.confidence_counts.red || 0} red item${(overview?.confidence_counts.red || 0) === 1 ? "" : "s"} and ${formatKg(overview?.inventory_totals.raw_material_kg || 0)} KG raw material in view.`,
        actionLabel: "Open Stock Lane",
      },
      {
        id: "production-lane",
        tab: "production" as SteelControlTab,
        eyebrow: "Production",
        title: "Record and trace batches",
        detail: `${overview?.batch_metrics.total_batches || 0} batch${(overview?.batch_metrics.total_batches || 0) === 1 ? "" : "es"} recorded with ${formatPercent(overview?.batch_metrics.average_loss_percent || 0)} average loss.`,
        actionLabel: "Open Production Lane",
      },
      {
        id: "sales-lane",
        tab: "sales" as SteelControlTab,
        eyebrow: "Sales",
        title: "Follow invoices and dispatch",
        detail: `${profitSummary?.invoice_count || 0} invoice${(profitSummary?.invoice_count || 0) === 1 ? "" : "s"} and ${profitSummary?.dispatch_count || 0} dispatch${(profitSummary?.dispatch_count || 0) === 1 ? "" : "es"} tied to steel movement.`,
        actionLabel: "Open Sales Lane",
      },
      {
        id: "risk-lane",
        tab: "risk" as SteelControlTab,
        eyebrow: "Risk",
        title: "Watch leakage and responsibility",
        detail: `${anomalySummary?.ranked_batch_count || 0} ranked anomaly batch${(anomalySummary?.ranked_batch_count || 0) === 1 ? "" : "es"} with ${formatKg(anomalySummary?.total_variance_kg || 0)} KG variance.`,
        actionLabel: "Open Risk Lane",
      },
    ],
    [
      anomalySummary?.ranked_batch_count,
      anomalySummary?.total_variance_kg,
      overview?.batch_metrics.average_loss_percent,
      overview?.batch_metrics.total_batches,
      overview?.confidence_counts.red,
      overview?.inventory_totals.raw_material_kg,
      profitSummary?.dispatch_count,
      profitSummary?.invoice_count,
    ],
  );

  if (loading || pageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading steel command center...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Steel Operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Please sign in to continue."}</div>
            <Link href="/access">
              <Button>Open Access</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!canAccessSteelControl) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Steel Control is restricted</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-[var(--muted)]">
              <div>
                This command center is available to authorized <span className="font-semibold text-[var(--text)]">owner/manager</span> roles only.
              </div>
              <div>You can still use daily workflows from Work Queue, Attendance, OCR, and role-specific steel pages.</div>
              <div className="flex flex-wrap gap-3">
                <Link href="/work-queue">
                  <Button>Open Work Queue</Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline">Open Today Board</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fafaf9_0%,#f5f5f4_48%,#fafaf9_100%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[#e7e5e4] bg-[linear-gradient(135deg,#ffffff,#fafaf9)] p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.28em] text-[#78716c]">Steel Operations</div>
              <h1 className="mt-2 text-3xl font-semibold text-[#111111] md:text-4xl">Run the steel desk from one trusted control lane</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#57534e]">
                Start with live stock trust, then move into batch, sales, and risk lanes without losing the factory context.
              </p>
            </div>
            <div className="rounded-3xl border border-[#e7e5e4] bg-[#f5f5f4] px-4 py-3 text-sm text-[#57534e]">
              <div className="text-xs uppercase tracking-[0.2em] text-[#78716c]">Active Steel Factory</div>
              <div className="mt-2 font-semibold text-[#111111]">{overview?.factory.name || activeFactory?.name}</div>
              <div className="mt-1">{overview?.factory.factory_code || activeFactory?.factory_code || "Code pending"}</div>
              {canSeeFinancials ? (
                <div className="mt-3 space-y-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-[#78716c]">Owner Report Date</div>
                  <Input type="date" value={ownerReportDate} onChange={(event) => setOwnerReportDate(event.target.value)} />
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <SteelStatusStrip
          overallStatus={overallStatus}
          topPriority={topPriority}
          confidence={confidenceSummary}
          timeContext={summaryRange?.rangeComparisonLabel || "vs yesterday"}
        />

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border border-[#e7e5e4] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="text-xs uppercase tracking-wider text-[#78716c]">Step 1: Production</div>
              <CardTitle className="text-lg">Batches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#111111]">{overview?.batch_metrics.total_batches || 0}</div>
              <div className="mt-1 text-xs text-[#57534e]">Total batches recorded</div>
              <Link href="/steel?tab=production" className="mt-3 inline-flex items-center text-xs font-medium text-[#78716c] hover:underline">
                Record new batch →
              </Link>
            </CardContent>
          </Card>
          <Card className="border border-[#e7e5e4] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="text-xs uppercase tracking-wider text-[#78716c]">Step 2: Commercial</div>
              <CardTitle className="text-lg">Open Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#111111]">{profitSummary?.invoice_count || 0}</div>
              <div className="mt-1 text-xs text-[#57534e]">Active sales invoices</div>
              <Link href="/steel/invoices" className="mt-3 inline-flex items-center text-xs font-medium text-[#78716c] hover:underline">
                Create invoice →
              </Link>
            </CardContent>
          </Card>
          <Card className="border border-[#e7e5e4] bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="text-xs uppercase tracking-wider text-[#78716c]">Step 3: Logistics</div>
              <CardTitle className="text-lg">Dispatches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#111111]">{profitSummary?.dispatch_count || 0}</div>
              <div className="mt-1 text-xs text-[#57534e]">Truck movements tracked</div>
              <Link href="/steel/dispatches" className="mt-3 inline-flex items-center text-xs font-medium text-[#78716c] hover:underline">
                Start dispatch →
              </Link>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <SteelTopPriorityCard priority={topPriority} />
          <div className="grid gap-4 sm:grid-cols-2">
            {criticalKpis.map((kpi) => (
              <KPIBox key={kpi.label} {...kpi} />
            ))}
          </div>
        </section>

        <section className="rounded-[1.7rem] border border-[#e7e5e4] bg-white p-5 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-[#78716c]">Quick Actions</div>
              <h2 className="mt-2 text-2xl font-semibold text-[#111111]">Move from signal to steel action fast</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#57534e]">
                What is happening: the summary strip and KPI cards show health, drift, and commercial movement. Is it good or bad: read the badge and comparison row. What should you do next: use one of the direct actions below.
              </p>
            </div>
            <SteelQuickActionRow
              actions={quickActions}
            />
          </div>
          {canSeeFinancials ? (
            <div className="mt-4">
              <Button
                id="owner-pdf"
                variant="outline"
                className="border-[#111111] bg-[#111111] text-white hover:border-[#2f2f2f] hover:bg-[#2f2f2f]"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.open(getSteelOwnerDailyPdfUrl(ownerReportDate), "_blank", "noopener,noreferrer");
                  }
                }}
              >
                Open Owner PDF
              </Button>
            </div>
          ) : null}
        </section>

        {!isSteelFactory ? (
          <Card className="border border-[#e7e5e4] bg-white text-[#111111] shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
            <CardHeader>
              <CardTitle className="text-xl">Steel module is factory-aware</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[#57534e]">
              <div>
                Your active factory is <span className="font-semibold text-[#111111]">{activeFactory?.name || "not selected"}</span>.
              </div>
              <div>Chart board is available below. Switch to a steel factory to unlock inventory, production, sales, and risk actions.</div>
              <div className="flex flex-wrap gap-3">
                <Link href="/settings">
                  <Button variant="outline" className="border-[#111111] bg-[#111111] text-white hover:border-[#2f2f2f] hover:bg-[#2f2f2f]">Open Settings</Button>
                </Link>
                <Link href="/control-tower">
                  <Button variant="ghost" className="border-[#d6d3d1] bg-[#f5f5f4] text-[#111111] hover:border-[#a8a29e] hover:bg-[#e7e5e4]">Open Control Tower</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <section className="rounded-[1.4rem] border border-[#e7e5e4] bg-white p-3 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {STEEL_CONTROL_TABS.map((tab) => {
              const active = activeTab === tab.id;
              const disabled = !isSteelFactory && tab.id !== "overview";
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (!disabled) {
                      navigateTab(tab.id);
                    }
                  }}
                  disabled={disabled}
                  className={
                    active
                      ? "rounded-2xl border border-[#111111] bg-[#111111] px-4 py-3 text-left text-white shadow-sm transition duration-150"
                      : "rounded-2xl border border-[#e7e5e4] bg-[#f5f5f4] px-4 py-3 text-left text-[#111111] transition duration-150 hover:-translate-y-0.5 hover:border-[#a8a29e] hover:bg-[#fafaf9] disabled:cursor-not-allowed disabled:opacity-45"
                  }
                >
                  <div className="text-sm font-semibold">{tab.label}</div>
                  <div className={`mt-1 text-xs ${active ? "text-[#d6d3d1]" : "text-[#57534e]"}`}>{tab.hint}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-4">
          {steelHubSections.map((section) => (
            <Card key={section.id} className="border border-[#e7e5e4] bg-white text-[#111111] shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
              <CardHeader>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#78716c]">{section.eyebrow}</div>
                <CardTitle className="text-xl">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm leading-6 text-[#57534e]">{section.detail}</div>
                <Button variant="outline" className="border-[#111111] bg-[#111111] text-white hover:border-[#2f2f2f] hover:bg-[#2f2f2f]" onClick={() => navigateTab(section.tab)}>
                  {section.actionLabel}
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        {activeTab === "overview" ? (
          <section>
            <IndustrialFactoryDashboard
              loading={pageLoading}
              industryType="steel"
              dataByRange={steelDashboardData}
            />
          </section>
        ) : null}

        {activeTab === "sales" ? (
          <>
            <section id="sales-lane" className="grid gap-4 md:grid-cols-3">
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
                <CardHeader>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Sales Lane</div>
                  <CardTitle className="text-xl">Invoices</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-[var(--muted)]">
                    {profitSummary?.invoice_count || 0} invoice{(profitSummary?.invoice_count || 0) === 1 ? "" : "s"} recorded for the active steel factory.
                  </div>
                  <Link href="/steel/invoices">
                    <Button variant="outline">Open Invoices</Button>
                  </Link>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
                <CardHeader>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Sales Lane</div>
                  <CardTitle className="text-xl">Dispatch</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-[var(--muted)]">
                    {profitSummary?.dispatch_count || 0} dispatch{(profitSummary?.dispatch_count || 0) === 1 ? "" : "es"} linked to steel movement and gate pass control.
                  </div>
                  <Link href="/steel/dispatches">
                    <Button variant="outline">Open Dispatch</Button>
                  </Link>
                </CardContent>
              </Card>
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
                <CardHeader>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Sales Lane</div>
                  <CardTitle className="text-xl">Customers & Collections</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-[var(--muted)]">
                    {canSeeFinancials
                      ? `${formatCurrency(profitSummary?.outstanding_invoice_amount_inr || 0)} still outstanding across current invoice exposure.`
                      : "Open customer ledger, invoice history, and payment tracking from one place."}
                  </div>
                  <Link href="/steel/customers">
                    <Button variant="outline">Open Customers</Button>
                  </Link>
                </CardContent>
              </Card>
            </section>

            {canSeeFinancials ? (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Realized Dispatch Revenue</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-semibold text-white">
                    {formatCurrency(profitSummary?.realized_dispatched_revenue_inr || 0)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Realized Gross Profit</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-semibold text-white">
                    {formatCurrency(profitSummary?.realized_dispatched_profit_inr || 0)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Leakage Exposure</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    <div className="text-2xl font-semibold text-white">
                      {formatCurrency(anomalySummary?.total_estimated_leakage_value_inr || 0)}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {formatKg(anomalySummary?.total_variance_kg || 0)} KG across {anomalySummary?.ranked_batch_count || 0} ranked batches
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Outstanding Invoice Value</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    <div className="text-2xl font-semibold text-white">
                      {formatCurrency(profitSummary?.outstanding_invoice_amount_inr || 0)}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {formatKg(profitSummary?.outstanding_invoice_weight_kg || 0)} KG still invoiced but not dispatched
                    </div>
                  </CardContent>
                </Card>
              </section>
            ) : null}
          </>
        ) : null}

        {activeTab === "inventory" ? (
          <section id="stock-lane" className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Live Stock Trust Board</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className={`rounded-2xl px-4 py-3 text-sm ${badgeTone("green")}`}>Green<div className="mt-1 text-2xl font-semibold text-white">{overview?.confidence_counts.green || 0}</div></div>
                    <div className={`rounded-2xl px-4 py-3 text-sm ${badgeTone("yellow")}`}>Review<div className="mt-1 text-2xl font-semibold text-white">{overview?.confidence_counts.yellow || 0}</div></div>
                    <div className={`rounded-2xl px-4 py-3 text-sm ${badgeTone("red")}`}>Mismatch<div className="mt-1 text-2xl font-semibold text-white">{overview?.confidence_counts.red || 0}</div></div>
                  </div>
                  <ResponsiveScrollArea
                    className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                    debugLabel="steel-command-center-batches"
                  >
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[var(--muted)]">
                        <tr className="border-b border-[var(--border)]">
                          <th className="px-3 py-3 font-medium">Item</th>
                          <th className="px-3 py-3 font-medium">Zone</th>
                          <th className="px-3 py-3 font-medium">KG</th>
                          <th className="px-3 py-3 font-medium">TON</th>
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
                              <div className="text-xs text-[var(--muted)]">Derived from material stage</div>
                            </td>
                            <td className="px-3 py-3">{formatKg(row.stock_balance_kg)}</td>
                            <td className="px-3 py-3">{formatKg(row.stock_balance_ton)}</td>
                            <td className="px-3 py-3">
                              <div className="font-medium text-white">
                                {row.last_variance_kg != null ? `${formatKg(row.last_variance_kg)} KG` : "No count yet"}
                              </div>
                              <div className="text-xs text-[var(--muted)]">
                                {row.last_variance_percent != null ? formatPercent(row.last_variance_percent) : "Variance pending"}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${badgeTone(row.confidence_status)}`}>
                                {row.confidence_status}
                              </span>
                              <div className="mt-2 max-w-[18rem] text-xs text-[var(--muted)]">{row.confidence_reason}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ResponsiveScrollArea>
                </CardContent>
              </Card>

            </div>

            <div className="space-y-6">
              {canSeeFinancials ? (
                <Card>
                  <CardHeader><CardTitle>Owner Control Board</CardTitle></CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Top loss batch</div>
                      {overview?.top_loss_batch ? (
                        <div className="mt-3 space-y-2">
                          <div className="text-lg font-semibold text-white">{overview.top_loss_batch.batch_code}</div>
                          <div className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${badgeTone(overview.top_loss_batch.severity)}`}>
                            {overview.top_loss_batch.severity}
                          </div>
                          <div className="text-[var(--muted)]">
                            Variance {formatKg(overview.top_loss_batch.variance_kg)} KG / {formatCurrency(overview.top_loss_batch.variance_value_inr)}
                          </div>
                          <div className="text-[var(--muted)]">
                            Estimated gross profit {formatCurrency(overview.top_loss_batch.estimated_gross_profit_inr)}
                          </div>
                          <Link href={`/steel/batches/${overview.top_loss_batch.id}`}>
                            <Button variant="outline">Open Trace</Button>
                          </Link>
                        </div>
                      ) : (
                        <div className="mt-3 text-[var(--muted)]">No batch data yet.</div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Highest risk operator</div>
                      <div className="mt-3 space-y-2">
                        {highestRiskOperator ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="font-semibold text-white">{highestRiskOperator.name}</div>
                                <div className="text-xs text-[var(--muted)]">
                                  {highestRiskOperator.batch_count} batches / {highestRiskOperator.high_risk_batches} high risk
                                </div>
                              </div>
                              <div className="text-right text-white">
                                {formatCurrency(highestRiskOperator.total_variance_value_inr)}
                              </div>
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {formatKg(highestRiskOperator.total_variance_kg)} KG at {formatPercent(highestRiskOperator.average_loss_percent)} avg loss.
                            </div>
                          </div>
                        ) : (
                          <div className="text-[var(--muted)]">Operator-level loss signals appear once batches are recorded.</div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Highest loss day</div>
                      {highestLossDay ? (
                        <div className="mt-3 space-y-2">
                          <div className="text-lg font-semibold text-white">{highestLossDay.date}</div>
                          <div className="text-[var(--muted)]">
                            {formatCurrency(highestLossDay.total_variance_value_inr)} / {formatKg(highestLossDay.total_variance_kg)} KG
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            {highestLossDay.batch_count} batches / {highestLossDay.high_risk_batches} high-risk / avg loss {formatPercent(highestLossDay.average_loss_percent)}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 text-[var(--muted)]">Daily responsibility trends appear once batches are recorded.</div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Best gross-profit batch</div>
                      {bestProfitBatch ? (
                        <div className="mt-3 space-y-2">
                          <div className="text-lg font-semibold text-white">{bestProfitBatch.batch_code}</div>
                          <div className="text-[var(--muted)]">
                            {formatCurrency(bestProfitBatch.estimated_gross_profit_inr)} / {formatCurrency(bestProfitBatch.estimated_output_value_inr)} output
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            {formatKg(bestProfitBatch.actual_output_kg)} KG actual / profit per KG {formatCurrency(bestProfitBatch.profit_per_kg_inr)}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 text-[var(--muted)]">Profit visibility appears once output and rates are recorded.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader><CardTitle>Stock Reconciliation</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4 text-sm">
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Operational zones</div>
                    <div className="mt-3 grid gap-3">
                      {Object.entries(inventoryZones).map(([zone, quantity]) => (
                        <div key={zone} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-3 py-3">
                          <div>
                            <div className="font-semibold text-white">{zone}</div>
                            <div className="text-xs text-[var(--muted)]">Derived from material category until exact yard/bin tracking is modeled.</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-white">{formatKg(quantity)} KG</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          </section>
        ) : null}

        {activeTab === "risk" ? (
          <section id="risk-lane" className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader><CardTitle>Leakage Alert Ladder</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {rankedAnomalies.length ? (
                  rankedAnomalies.map((entry) => (
                    <div key={entry.batch.id} className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Rank #{entry.rank}</div>
                          <div className="mt-1 text-lg font-semibold text-white">{entry.batch.batch_code}</div>
                          <div className="mt-1 text-xs text-[var(--muted)]">
                            {entry.batch.production_date} / {entry.batch.operator_name || "Operator not tagged"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${badgeTone(entry.batch.severity)}`}>
                            {entry.batch.severity}
                          </div>
                          <div className="mt-2 text-sm font-semibold text-white">Score {entry.anomaly_score.toFixed(2)}</div>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Variance</div>
                          <div className="mt-1 text-sm font-semibold text-white">{formatKg(entry.batch.variance_kg)} KG</div>
                          <div className="text-xs text-[var(--muted)]">{formatPercent(entry.batch.variance_percent)}</div>
                        </div>
                        {canSeeFinancials ? (
                          <>
                            <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Leakage Value</div>
                              <div className="mt-1 text-sm font-semibold text-white">{formatCurrency(entry.estimated_leakage_value_inr || 0)}</div>
                              <div className="text-xs text-[var(--muted)]">Potential margin erosion</div>
                            </div>
                            <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Gross Profit</div>
                              <div className="mt-1 text-sm font-semibold text-white">{formatCurrency(entry.batch.estimated_gross_profit_inr || 0)}</div>
                              <div className="text-xs text-[var(--muted)]">Profit after input cost snapshot</div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Loss</div>
                              <div className="mt-1 text-sm font-semibold text-white">{formatPercent(entry.batch.loss_percent)}</div>
                              <div className="text-xs text-[var(--muted)]">Operational deviation</div>
                            </div>
                            <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                              <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Signal</div>
                              <div className="mt-1 text-sm font-semibold text-white">{entry.batch.severity}</div>
                              <div className="text-xs text-[var(--muted)]">Investigate process drift</div>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="max-w-2xl text-sm text-[var(--muted)]">{entry.reason}</div>
                        <Link href={`/steel/batches/${entry.batch.id}`}>
                          <Button variant="outline">Open batch trace</Button>
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted)]">
                    Ranked leakage alerts appear after watch/high/critical steel batches are recorded.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Responsibility Analytics</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Loss by operator</div>
                  <div className="mt-3 space-y-3">
                    {responsibility?.by_operator?.length ? (
                      responsibility.by_operator.map((row) => (
                        <div key={row.user_id} className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-white">{row.name}</div>
                            <div className="text-xs text-[var(--muted)]">
                              {row.batch_count} batches / {row.high_risk_batches} high risk / avg loss {formatPercent(row.average_loss_percent)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-white">
                              {canSeeFinancials ? formatCurrency(row.total_variance_value_inr || 0) : `${formatKg(row.total_variance_kg)} KG`}
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {canSeeFinancials ? `${formatKg(row.total_variance_kg)} KG` : `${row.critical_batches} critical batches`}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-[var(--muted)]">Operator responsibility signals appear once batches are recorded.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Highest loss days</div>
                  <div className="mt-3 space-y-3">
                    {responsibility?.by_day?.length ? (
                      responsibility.by_day.slice(0, 4).map((row) => (
                        <div key={row.date} className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-white">{row.date}</div>
                            <div className="text-xs text-[var(--muted)]">
                              {row.batch_count} batches / {row.high_risk_batches} high risk
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-white">
                              {canSeeFinancials ? formatCurrency(row.total_variance_value_inr || 0) : `${formatKg(row.total_variance_kg)} KG`}
                            </div>
                            <div className="text-xs text-[var(--muted)]">{formatPercent(row.average_loss_percent)} avg loss</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-[var(--muted)]">Day-level responsibility trends appear once batches are recorded.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Loss by batch</div>
                  <div className="mt-3 space-y-3">
                    {responsibility?.by_batch?.length ? (
                      responsibility.by_batch.slice(0, 4).map((row) => (
                        <div key={row.id} className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-white">{row.batch_code}</div>
                            <div className="text-xs text-[var(--muted)]">
                              {row.production_date} / {row.operator_name || "Operator not tagged"}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-white">
                              {canSeeFinancials ? formatCurrency(row.variance_value_inr || 0) : `${formatKg(row.variance_kg)} KG`}
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {canSeeFinancials ? `Score ${row.anomaly_score.toFixed(2)}` : formatPercent(row.loss_percent)}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-[var(--muted)]">Batch responsibility signals appear once batches are recorded.</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        ) : null}

        {activeTab === "production" ? (
          <>
            <section id="production-lane" className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
                <CardHeader>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Production Snapshot</div>
                  <CardTitle className="text-xl">Latest batch signals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-[var(--muted)]">
                  <div>{overview?.batch_metrics.total_batches || 0} batches recorded in the active steel context.</div>
                  <div>Average loss is currently {formatPercent(overview?.batch_metrics.average_loss_percent || 0)}.</div>
                  <div>{overview?.batch_metrics.high_severity_batches || 0} high severity batches need follow-up.</div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Link href="/steel/reconciliations">
                      <Button variant="outline">Open Reconciliations</Button>
                    </Link>
                    <Button variant="ghost" onClick={() => navigateTab("risk")}>Open Risk Lane</Button>
                  </div>
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardHeader><CardTitle>Recent Batches and Variance Signals</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveScrollArea
                  className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                  debugLabel="steel-command-center-ledger"
                >
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-3 font-medium">Batch</th>
                        <th className="px-3 py-3 font-medium">Expected</th>
                        <th className="px-3 py-3 font-medium">Actual</th>
                        <th className="px-3 py-3 font-medium">Variance</th>
                        <th className="px-3 py-3 font-medium">Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map((batch) => (
                        <tr key={batch.id} className="border-b border-[var(--border)]/60 last:border-none">
                          <td className="px-3 py-3">
                            <div className="font-semibold text-white">{batch.batch_code}</div>
                            <div className="text-xs text-[var(--muted)]">{batch.production_date}</div>
                          </td>
                          <td className="px-3 py-3">{formatKg(batch.expected_output_kg)} KG</td>
                          <td className="px-3 py-3">{formatKg(batch.actual_output_kg)} KG</td>
                          <td className="px-3 py-3">
                            <div>{formatKg(batch.variance_kg)} KG</div>
                            <div className="text-xs text-[var(--muted)]">
                              {canSeeFinancials ? formatCurrency(batch.variance_value_inr || 0) : formatPercent(batch.variance_percent)}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${badgeTone(batch.severity)}`}>
                              {batch.severity}
                            </span>
                            <div className="mt-2">
                              <Link href={`/steel/batches/${batch.id}`} className="text-xs font-medium text-[var(--accent)] hover:underline">
                                Open traceability
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ResponsiveScrollArea>
              </CardContent>
            </Card>
          </>
        ) : null}

        {error || sessionError ? <div className="text-sm text-red-400">{error || sessionError}</div> : null}
      </div>
    </main>
  );
}
