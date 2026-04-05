"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ProductionLossChart } from "@/components/charts/production-loss-chart";
import { InventoryLevelsChart } from "@/components/charts/inventory-levels-chart";
import { TopLossBatchesChart } from "@/components/charts/top-loss-batches-chart";
import { DispatchTrendChart } from "@/components/charts/dispatch-trend-chart";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { LossTypeDonutChart } from "@/components/charts/loss-type-donut-chart";
import { IndustrialFilterPanel } from "@/components/dashboard/industrial-filter-panel";
import { IndustrialKpiTable } from "@/components/dashboard/industrial-kpi-table";
import { KPIBox } from "@/components/dashboard/kpi-box";
import { SmartInsightsPanel } from "@/components/dashboard/smart-insights-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildSmartInsights,
  INDUSTRIAL_DASHBOARD_DATA,
  type DashboardRangeKey,
  type IndustrialDashboardData,
} from "@/lib/industrial-dashboard";

const FILTERS: Array<{ key: DashboardRangeKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
];

type DrillDownMeta = {
  chartId: string;
  label: string;
  seriesName: string;
  value: number;
};

type DrilldownAction = {
  href: string;
  label: string;
  context: string;
};

type DashboardViewConfig = {
  showProduction: boolean;
  showInventory: boolean;
  showLossDonut: boolean;
  showTopLoss: boolean;
  showDispatch: boolean;
  showRevenue: boolean;
  showKpiTable: boolean;
  note: string;
};

function resolveViewConfig(filters: Record<string, string>): DashboardViewConfig {
  const area = (filters.plant || "").toLowerCase();
  const process = (filters.process || "").toLowerCase();
  const lens = (filters.loss || "").toLowerCase();

  const config: DashboardViewConfig = {
    showProduction: true,
    showInventory: true,
    showLossDonut: true,
    showTopLoss: true,
    showDispatch: true,
    showRevenue: true,
    showKpiTable: true,
    note: "Balanced view across stock, production, dispatch, and risk.",
  };

  if (area.includes("dispatch")) {
    config.showProduction = false;
    config.showTopLoss = false;
    config.note = "Dispatch Yard focus: dispatch movement, revenue, and delivery pace.";
  } else if (area.includes("melt")) {
    config.showDispatch = false;
    config.showRevenue = false;
    config.note = "Melt Shop focus: input-output behavior and stock trust.";
  } else if (area.includes("rolling")) {
    config.showDispatch = false;
    config.showRevenue = false;
    config.note = "Rolling Mill focus: production loss and batch-level yield.";
  }

  if (process.includes("scrap")) {
    config.showProduction = false;
    config.showTopLoss = false;
    config.showDispatch = false;
    config.showRevenue = false;
    config.note = "Scrap Receipt focus: inventory confidence and stock inflow context.";
  } else if (process.includes("melting")) {
    config.showDispatch = false;
    config.showRevenue = false;
    config.note = "Melting focus: production-versus-loss signals.";
  } else if (process.includes("rolling")) {
    config.showDispatch = false;
    config.showRevenue = false;
    config.note = "Rolling focus: batch yield and loss visibility.";
  } else if (process.includes("packing")) {
    config.showProduction = false;
    config.showTopLoss = false;
    config.note = "Packing focus: dispatch readiness and revenue closure.";
  }

  if (lens.includes("material")) {
    config.note = "Material Yield lens: prioritize output, variance, and top loss batches.";
  } else if (lens.includes("energy")) {
    config.showDispatch = false;
    config.showRevenue = false;
    config.note = "Energy Loss lens: keep production and process-loss signals in focus.";
  } else if (lens.includes("minor")) {
    config.showLossDonut = false;
    config.note = "Minor Stops lens: operational flow and dispatch rhythm.";
  } else if (lens.includes("operator")) {
    config.showInventory = false;
    config.note = "Operator Effort lens: KPI and batch accountability view.";
  }

  if (!config.showProduction && !config.showInventory && !config.showDispatch && !config.showRevenue && !config.showTopLoss) {
    config.showProduction = true;
  }
  return config;
}

function resolveDrilldownAction(meta: DrillDownMeta): DrilldownAction {
  if (meta.chartId === "production-vs-loss" || meta.chartId === "top-loss-batches") {
    return { href: "/steel?tab=production", label: "Open Production Tab", context: "Batch and output review" };
  }
  if (meta.chartId === "inventory-levels") {
    return { href: "/steel?tab=inventory", label: "Open Inventory Tab", context: "Stock trust and reconciliation" };
  }
  if (meta.chartId === "dispatch-trend" || meta.chartId === "revenue-chart") {
    return { href: "/steel?tab=sales", label: "Open Sales Tab", context: "Invoices and dispatch flow" };
  }
  if (meta.chartId === "loss-type-donut") {
    return { href: "/steel?tab=risk", label: "Open Risk Tab", context: "Leakage and responsibility review" };
  }
  return { href: "/steel", label: "Open Steel Hub", context: "Steel control workflow" };
}

export function IndustrialFactoryDashboard({
  loading = false,
  industryType = "steel",
  dataByRange,
  initialRange = "7d",
  embedded = false,
}: {
  loading?: boolean;
  industryType?: string;
  dataByRange?: Partial<Record<DashboardRangeKey, IndustrialDashboardData>>;
  initialRange?: DashboardRangeKey;
  embedded?: boolean;
}) {
  const resolvedData = useMemo(
    () => ({
      today: dataByRange?.today || INDUSTRIAL_DASHBOARD_DATA.today,
      "7d": dataByRange?.["7d"] || INDUSTRIAL_DASHBOARD_DATA["7d"],
      "30d": dataByRange?.["30d"] || INDUSTRIAL_DASHBOARD_DATA["30d"],
    }),
    [dataByRange],
  );
  const [selectedRange, setSelectedRange] = useState<DashboardRangeKey>(initialRange);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [lastDrillDown, setLastDrillDown] = useState<DrillDownMeta | null>(null);
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    setSelectedRange(initialRange);
  }, [initialRange]);

  useEffect(() => {
    if (loading) return;
    setRangeLoading(true);
    const timer = window.setTimeout(() => setRangeLoading(false), 140);
    return () => window.clearTimeout(timer);
  }, [loading, selectedRange]);

  const activeData = resolvedData[selectedRange];
  const smartInsights = useMemo(() => buildSmartInsights(activeData), [activeData]);
  const visualLoading = loading || rangeLoading;
  const drilldownAction = useMemo(
    () => (lastDrillDown ? resolveDrilldownAction(lastDrillDown) : null),
    [lastDrillDown],
  );
  const viewConfig = useMemo(() => resolveViewConfig(selectedFilters), [selectedFilters]);

  const handleDrillDown = (meta: DrillDownMeta) => {
    setLastDrillDown(meta);
  };

  const handleFilterSelect = (panelId: string, option: string) => {
    setSelectedFilters((current) => ({
      ...current,
      [panelId]: option,
    }));
    setFilterStatus(`Applied ${panelId} filter: ${option}`);
  };

  const leftRail = (
    <div className="space-y-4">
      {activeData.filterPanels.map((panel) => (
        <IndustrialFilterPanel
          key={panel.id}
          panel={panel}
          selected={selectedFilters[panel.id]}
          onSelect={handleFilterSelect}
        />
      ))}
      <Card className="rounded-[1.6rem] border border-[#dce5ef] bg-white shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Active Filters</div>
          <CardTitle className="mt-2 text-lg text-slate-900">Control context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          {activeData.filterPanels.map((panel) => (
            <div
              key={panel.id}
              className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <span>{panel.title}</span>
              <span className="font-semibold text-slate-800">{selectedFilters[panel.id] || "-"}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="rounded-[1.6rem] border border-[#dce5ef] bg-white shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Action Center</div>
          <CardTitle className="mt-2 text-lg text-slate-900">Next best step</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          {filterStatus ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">{filterStatus}</div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              Pick a filter or tap a chart point to open the right steel workflow.
            </div>
          )}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            {viewConfig.note}
          </div>
          {drilldownAction ? (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{drilldownAction.context}</div>
              <div className="font-semibold text-slate-800">
                {lastDrillDown?.seriesName}: {lastDrillDown?.label} ({Math.round(lastDrillDown?.value || 0)})
              </div>
              <Link href={drilldownAction.href} className="block">
                <Button className="w-full sm:w-auto">{drilldownAction.label}</Button>
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );

  useEffect(() => {
    const defaults: Record<string, string> = {};
    activeData.filterPanels.forEach((panel) => {
      defaults[panel.id] = panel.options[0] || "";
    });
    setSelectedFilters(defaults);
    setFilterStatus("");
  }, [activeData]);

  if (industryType !== "steel") {
    return (
      <section className="space-y-6">
        <Card className="rounded-[2rem] border border-[#dce5ef] bg-[linear-gradient(180deg,#fbfcfe,#f3f7fb)] text-slate-900 shadow-[0_26px_60px_rgba(15,23,42,0.1)]">
          <CardHeader>
            <div className="text-xs uppercase tracking-[0.28em] text-sky-600">Steel Dashboard</div>
            <CardTitle className="mt-3 text-3xl text-slate-900">Steel-first control board</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-7 text-slate-600">
            The new reference-style operations dashboard is currently wired for steel factories only. Once the chemical
            module exists, we can bring the same system back and create a proper chemical variant instead of forcing a
            fake mixed-industry board now.
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <Card className="rounded-[2rem] border border-[#dce5ef] bg-[linear-gradient(180deg,#fbfcfe,#f3f7fb)] text-slate-900 shadow-[0_26px_60px_rgba(15,23,42,0.1)]">
        <CardHeader className="space-y-4">
          {!embedded ? (
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-sky-600">Steel Control System</div>
                <CardTitle className="mt-3 text-2xl text-slate-900 md:text-3xl">Steel Operations Dashboard</CardTitle>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  Steel plant signals designed for managers and owners. The focus stays on stock trust, output, batch loss,
                  dispatch movement, and invoiced steel value instead of generic admin widgets.
                </p>
              </div>
            </div>
          ) : null}
          <div className="flex gap-3 overflow-x-auto pb-1">
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setSelectedRange(filter.key)}
                className={
                  selectedRange === filter.key
                    ? "shrink-0 rounded-full border border-sky-500 bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
                    : "shrink-0 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                }
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="rounded-[1.4rem] border border-[#dce5ef] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
            <div className="text-sm uppercase tracking-[0.18em] text-slate-500">Active Time Window</div>
            <div className="mt-2 text-xl font-semibold text-slate-900 md:text-2xl">{activeData.title}</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">{activeData.subtitle}</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KPIBox {...activeData.kpis.totalStock} />
            <KPIBox {...activeData.kpis.todayProduction} />
            <KPIBox {...activeData.kpis.todayLoss} />
            <KPIBox {...activeData.kpis.todayRevenue} />
          </div>

          <SmartInsightsPanel insights={smartInsights} loading={visualLoading} />

          <div className="grid gap-6 xl:grid-cols-[0.34fr_0.66fr]">
            <div className="order-2 xl:order-1">
              <details className="rounded-[1.6rem] border border-[#dce5ef] bg-white shadow-[0_14px_30px_rgba(15,23,42,0.06)] xl:hidden">
                <summary className="cursor-pointer list-none px-5 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Filters and actions</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">Open chart controls</div>
                  <div className="mt-1 text-sm text-slate-600">Choose plant/process lenses and see the next best step.</div>
                </summary>
                <div className="border-t border-slate-100 px-4 py-4">{leftRail}</div>
              </details>
              <div className="hidden xl:block">{leftRail}</div>
            </div>

            <div className="order-1 grid gap-6 xl:order-2">
              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                {viewConfig.showProduction ? (
                  <ProductionLossChart data={activeData.productionLoss} loading={visualLoading} onDrillDown={handleDrillDown} />
                ) : (
                  <Card className="rounded-[1.6rem] border border-dashed border-[#dce5ef] bg-white">
                    <CardContent className="py-10 text-center text-sm text-slate-500">
                      Production trend is hidden for the current filter combination.
                    </CardContent>
                  </Card>
                )}
                <div className="grid gap-6">
                  {viewConfig.showInventory ? (
                    <InventoryLevelsChart data={activeData.inventoryLevels} loading={visualLoading} onDrillDown={handleDrillDown} />
                  ) : null}
                  {viewConfig.showLossDonut ? (
                    <LossTypeDonutChart
                      title={activeData.donutSummary.title}
                      subtitle={activeData.donutSummary.subtitle}
                      data={activeData.donutSummary.series}
                      loading={visualLoading}
                      onDrillDown={handleDrillDown}
                    />
                  ) : null}
                  {!viewConfig.showInventory && !viewConfig.showLossDonut ? (
                    <Card className="rounded-[1.6rem] border border-dashed border-[#dce5ef] bg-white">
                      <CardContent className="py-10 text-center text-sm text-slate-500">
                        Inventory and severity panels are hidden for this lens.
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            {viewConfig.showTopLoss ? (
              <TopLossBatchesChart data={activeData.topLossBatches} loading={visualLoading} onDrillDown={handleDrillDown} />
            ) : null}
            {viewConfig.showDispatch ? (
              <DispatchTrendChart data={activeData.dispatchTrend} loading={visualLoading} onDrillDown={handleDrillDown} />
            ) : null}
            {!viewConfig.showTopLoss && !viewConfig.showDispatch ? (
              <Card className="rounded-[1.6rem] border border-dashed border-[#dce5ef] bg-white xl:col-span-2">
                <CardContent className="py-10 text-center text-sm text-slate-500">
                  Top-loss and dispatch trends are hidden for the selected process focus.
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            {viewConfig.showRevenue ? (
              <RevenueChart data={activeData.revenueTrend} loading={visualLoading} onDrillDown={handleDrillDown} />
            ) : null}
            {viewConfig.showKpiTable ? <IndustrialKpiTable rows={activeData.kpiRows} /> : null}
            {!viewConfig.showRevenue && !viewConfig.showKpiTable ? (
              <Card className="rounded-[1.6rem] border border-dashed border-[#dce5ef] bg-white xl:col-span-2">
                <CardContent className="py-10 text-center text-sm text-slate-500">
                  Revenue and KPI table are hidden for this filter combination.
                </CardContent>
              </Card>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
