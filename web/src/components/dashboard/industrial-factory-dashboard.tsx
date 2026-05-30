"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
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
const DASHBOARD_FILTER_PARAM_KEYS = ["plant", "process", "loss"] as const;

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

function formatDrilldownDate(value: Date) {
  const localDate = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  return localDate.toISOString().slice(0, 10);
}

function resolveDrilldownDate(meta: DrillDownMeta, selectedRange: DashboardRangeKey) {
  const today = new Date();
  const monthSequence = [3, 2, 1, 0].map((offset) => new Date(today.getFullYear(), today.getMonth() - offset, 1));

  if (meta.chartId === "dispatch-trend") {
    const [dayValue, monthValue] = meta.label.split(" ");
    const matchedMonth = monthSequence.find(
      (candidate) => candidate.toLocaleDateString("en-IN", { month: "short" }) === monthValue,
    );
    if (matchedMonth && Number(dayValue)) {
      return formatDrilldownDate(new Date(matchedMonth.getFullYear(), matchedMonth.getMonth(), Number(dayValue)));
    }
    return null;
  }

  if (meta.chartId === "revenue-chart") {
    const matchedMonth = monthSequence.find(
      (candidate) => candidate.toLocaleDateString("en-IN", { month: "short" }) === meta.label,
    );
    return matchedMonth ? formatDrilldownDate(matchedMonth) : null;
  }

  if (meta.chartId === "production-vs-loss") {
    if (selectedRange === "30d") return null;
    const visibleDays = selectedRange === "today" ? 5 : 7;
    for (let index = visibleDays - 1; index >= 0; index -= 1) {
      const candidate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - index);
      if (candidate.toLocaleDateString("en-IN", { weekday: "short" }) === meta.label) {
        return formatDrilldownDate(candidate);
      }
    }
  }

  return null;
}

function isDashboardRangeKey(value: string | null): value is DashboardRangeKey {
  return value === "today" || value === "7d" || value === "30d";
}

export function IndustrialFactoryDashboard({
  loading = false,
  industryType = "steel",
  dataByRange,
  initialRange = "7d",
  embedded = false,
  showOperationalKpis = true,
  showDecisionPrompts = true,
}: {
  loading?: boolean;
  industryType?: string;
  dataByRange?: Partial<Record<DashboardRangeKey, IndustrialDashboardData>>;
  initialRange?: DashboardRangeKey;
  embedded?: boolean;
  showOperationalKpis?: boolean;
  showDecisionPrompts?: boolean;
}) {
  const resolvedData = useMemo(
    () => ({
      today: dataByRange?.today || INDUSTRIAL_DASHBOARD_DATA.today,
      "7d": dataByRange?.["7d"] || INDUSTRIAL_DASHBOARD_DATA["7d"],
      "30d": dataByRange?.["30d"] || INDUSTRIAL_DASHBOARD_DATA["30d"],
    }),
    [dataByRange],
  );
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedRange = useMemo<DashboardRangeKey>(() => {
    const raw = searchParams.get("range");
    return isDashboardRangeKey(raw) ? raw : initialRange;
  }, [initialRange, searchParams]);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [lastDrillDown, setLastDrillDown] = useState<DrillDownMeta | null>(null);

  useEffect(() => {
    if (loading) return;
    setRangeLoading(true);
    const timer = window.setTimeout(() => setRangeLoading(false), 140);
    return () => window.clearTimeout(timer);
  }, [loading, selectedRange]);

  const activeData = resolvedData[selectedRange];
  const selectedFilters = useMemo(() => {
    const filters: Record<string, string> = {};
    activeData.filterPanels.forEach((panel) => {
      const raw = searchParams.get(panel.id);
      filters[panel.id] = raw && panel.options.includes(raw) ? raw : panel.options[0] || "";
    });
    return filters;
  }, [activeData, searchParams]);
  const filterStatus = useMemo(() => {
    const applied = activeData.filterPanels
      .map((panel) => {
        const value = selectedFilters[panel.id];
        return value ? `${panel.title}: ${value}` : "";
      })
      .filter(Boolean);
    return applied.length ? `Applied filters: ${applied.join(" · ")}` : "";
  }, [activeData, selectedFilters]);
  const smartInsights = useMemo(() => buildSmartInsights(activeData), [activeData]);
  const visualLoading = loading || rangeLoading;
  const drilldownAction = useMemo(
    () => (lastDrillDown ? resolveDrilldownAction(lastDrillDown) : null),
    [lastDrillDown],
  );
  const viewConfig = useMemo(() => resolveViewConfig(selectedFilters), [selectedFilters]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    let changed = false;

    if (nextParams.get("range") !== selectedRange) {
      nextParams.set("range", selectedRange);
      changed = true;
    }

    DASHBOARD_FILTER_PARAM_KEYS.forEach((key) => {
      const panel = activeData.filterPanels.find((item) => item.id === key);
      if (!panel) {
        if (nextParams.has(key)) {
          nextParams.delete(key);
          changed = true;
        }
        return;
      }
      const normalized = selectedFilters[key] || panel.options[0] || "";
      if (normalized && nextParams.get(key) !== normalized) {
        nextParams.set(key, normalized);
        changed = true;
      }
    });

    if (!changed) {
      return;
    }
    router.replace(`${pathname}?${nextParams.toString()}`);
  }, [activeData, pathname, router, searchParams, selectedFilters, selectedRange]);

  const handleDrillDown = (meta: DrillDownMeta) => {
    setLastDrillDown(meta);
    const params = new URLSearchParams({ source: "charts" });
    const activeFilter = selectedFilters.process || selectedFilters.plant || selectedFilters.loss;
    const resolvedDate = resolveDrilldownDate(meta, selectedRange);

    if (activeFilter) {
      params.set("filter", activeFilter);
    }
    if (resolvedDate) {
      params.set("date", resolvedDate);
    }

    let targetPath = "/steel/reconciliations";
    if (meta.chartId === "top-loss-batches") {
      targetPath = "/steel/batches";
      params.set("highlight", meta.label);
    } else if (meta.chartId === "production-vs-loss") {
      targetPath = "/steel/batches";
    } else if (meta.chartId === "dispatch-trend") {
      targetPath = "/steel/dispatches";
    } else if (meta.chartId === "revenue-chart") {
      targetPath = "/steel/invoices";
    }

    router.push(`${targetPath}?${params.toString()}`);
  };

  const handleRangeSelect = (nextRange: DashboardRangeKey) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("range", nextRange);
    const nextData = resolvedData[nextRange];
    DASHBOARD_FILTER_PARAM_KEYS.forEach((key) => {
      const panel = nextData.filterPanels.find((item) => item.id === key);
      if (!panel) {
        nextParams.delete(key);
        return;
      }
      nextParams.set(key, panel.options[0] || "");
    });
    router.push(`${pathname}?${nextParams.toString()}`);
  };

  const handleFilterSelect = (panelId: string, option: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("range", selectedRange);
    nextParams.set(panelId, option);
    router.push(`${pathname}?${nextParams.toString()}`);
  };

  const leftRail = (
    <div className="space-y-6">
      {activeData.filterPanels.map((panel) => (
        <IndustrialFilterPanel
          key={panel.id}
          panel={panel}
          selected={selectedFilters[panel.id]}
          onSelect={handleFilterSelect}
        />
      ))}
      <Card className="shadow-xs">
        <CardHeader>
          <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Active Filters</div>
          <CardTitle className="mt-2 text-lg text-text-primary">Control context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm text-text-secondary">
          {activeData.filterPanels.map((panel) => (
            <div
              key={panel.id}
              className="flex flex-col gap-1 rounded-xl border border-border-default bg-surface-elevated px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <span>{panel.title}</span>
              <span className="font-semibold text-text-primary">{selectedFilters[panel.id] || "-"}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="shadow-xs">
        <CardHeader>
          <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Action Center</div>
          <CardTitle className="mt-2 text-lg text-text-primary">Next best step</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm text-text-secondary">
          {filterStatus ? (
            <div className="rounded-xl border border-border-default bg-surface-elevated px-3 py-2">{filterStatus}</div>
          ) : (
            <div className="rounded-xl border border-border-default bg-surface-elevated px-3 py-2">
              Pick a filter or tap a chart point to open the right steel workflow.
            </div>
          )}
          <div className="rounded-xl border border-border-default bg-surface-elevated px-3 py-2 text-xs">
            {viewConfig.note}
          </div>
          {drilldownAction ? (
            <div className="space-y-6 rounded-xl border border-border-default bg-surface-elevated px-3 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">{drilldownAction.context}</div>
              <div className="font-semibold text-text-primary">
                {lastDrillDown?.seriesName}: {lastDrillDown?.label} ({Math.round(lastDrillDown?.value || 0)})
              </div>
              <Link href={drilldownAction.href} className="block">
                <Button className="w-full sm:w-auto">
                  {drilldownAction.label}
                </Button>
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );

  if (industryType !== "steel") {
    return (
      <section className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="text-xs uppercase tracking-[0.28em] text-text-tertiary">Steel Dashboard</div>
            <CardTitle className="mt-3 text-3xl text-text-primary">Steel-first control board</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-7 text-text-secondary">
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
      <Card className="shadow-sm">
        <CardHeader className="space-y-6">
          {!embedded ? (
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-text-tertiary">Steel Control System</div>
                <CardTitle className="mt-3 text-2xl text-text-primary md:text-3xl">Steel performance overview</CardTitle>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">
                  Steel plant signals designed for managers and owners. The focus stays on stock trust, output, batch loss,
                  dispatch movement, and invoiced steel value instead of generic admin widgets.
                </p>
              </div>
            </div>
          ) : null}
          <ResponsiveScrollArea
            className="pb-1"
            debugLabel="industrial-dashboard-filters"
            innerClassName="flex min-w-max gap-3 pr-2"
          >
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => handleRangeSelect(filter.key)}
                className={
                  selectedRange === filter.key
                    ? "shrink-0 rounded-full !border-transparent !bg-[var(--action-primary)] px-4 py-2 text-sm font-semibold !text-[var(--action-primary-text)] shadow-sm transition hover:!bg-[var(--action-primary-hover)]"
                    : "shrink-0 rounded-full !border-[var(--action-secondary-border)] !bg-[var(--action-secondary)] px-4 py-2 text-sm font-semibold !text-[var(--action-secondary-text)] transition hover:!bg-[var(--action-secondary-hover)]"
                }
              >
                {filter.label}
              </button>
            ))}
          </ResponsiveScrollArea>
          <div className="surface-muted p-4">
            <div className="text-sm uppercase tracking-[0.18em] text-text-tertiary">Active Time Window</div>
            <div className="mt-2 text-xl font-semibold text-text-primary md:text-2xl">{activeData.title}</div>
            <div className="mt-2 text-sm leading-6 text-text-secondary">{activeData.subtitle}</div>
            <div className="mt-3 inline-flex rounded-full border border-border-default bg-surface-elevated px-3 py-1 text-xs font-semibold text-text-primary">
              KPI context {activeData.rangeComparisonLabel}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">

          {showOperationalKpis ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KPIBox {...activeData.kpis.totalStock} />
              <KPIBox {...activeData.kpis.todayProduction} />
              <KPIBox {...activeData.kpis.todayLoss} />
              <KPIBox {...activeData.kpis.todayRevenue} />
            </div>
          ) : null}

          {showDecisionPrompts ? <SmartInsightsPanel insights={smartInsights} loading={visualLoading} /> : null}

          <div className="grid gap-6 xl:grid-cols-[0.34fr_0.66fr]">
            <div className="order-2 xl:order-1">
              <details className="telemetry-rail xl:hidden">
                <summary className="cursor-pointer list-none px-5 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Filters and actions</div>
                  <div className="mt-1 text-lg font-semibold text-text-primary">Open chart controls</div>
                  <div className="mt-1 text-sm text-text-secondary">Choose plant/process lenses and see the next best step.</div>
                </summary>
                <div className="border-t border-border-subtle px-4 py-4">{leftRail}</div>
              </details>
              <div className="hidden xl:block">{leftRail}</div>
            </div>

            <div className="order-1 grid gap-6 xl:order-2">
              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                {viewConfig.showProduction ? (
                  <ProductionLossChart data={activeData.productionLoss} loading={visualLoading} onDrillDown={handleDrillDown} />
                ) : (
                  <Card className="rounded-[1.6rem] border border-dashed border-border-default !bg-none bg-surface-card">
                    <CardContent className="py-10 text-center text-sm text-text-secondary">
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
                    <Card className="rounded-[1.6rem] border border-dashed border-border-default !bg-none bg-surface-card">
                      <CardContent className="py-10 text-center text-sm text-text-secondary">
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
              <Card className="rounded-[1.6rem] border border-dashed border-border-default !bg-none bg-surface-card xl:col-span-2">
                <CardContent className="py-10 text-center text-sm text-text-secondary">
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
              <Card className="rounded-[1.6rem] border border-dashed border-border-default !bg-none bg-surface-card xl:col-span-2">
                <CardContent className="py-10 text-center text-sm text-text-secondary">
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
