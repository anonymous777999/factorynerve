import type { SteelBatch, SteelDispatch, SteelInvoice, SteelOverview } from "@/lib/steel";

export type DashboardRangeKey = "today" | "7d" | "30d";

export type DashboardKpi = {
  label: string;
  value: string;
  trend?: number;
  trendLabel?: string;
  severity?: "good" | "watch" | "critical" | "stable";
  comparisonLabel?: string;
  priority?: "primary" | "secondary";
  action?: {
    href: string;
    label: string;
  };
  helperText?: string;
};

export type ProductionLossDatum = {
  label: string;
  production: number;
  loss: number;
};

export type InventoryLevelDatum = {
  category: "Raw Material" | "WIP" | "Finished Goods";
  valueKg: number;
};

export type LossBatchDatum = {
  batch: string;
  lossKg: number;
};

export type DispatchTrendDatum = {
  label: string;
  valueKg: number;
};

export type RevenueTrendDatum = {
  label: string;
  valueInr: number;
};

export type IndustrialFilterPanel = {
  id: string;
  title: string;
  options: string[];
};

export type DonutSliceDatum = {
  label: string;
  value: number;
};

export type KpiTableRow = {
  metric: string;
  current: string;
  previous: string;
  changePercent: number;
  status: "up" | "down" | "flat";
};

export type IndustrialDashboardData = {
  title: string;
  subtitle: string;
  rangeComparisonLabel: string;
  kpis: {
    totalStock: DashboardKpi;
    todayProduction: DashboardKpi;
    todayLoss: DashboardKpi;
    todayRevenue: DashboardKpi;
  };
  productionLoss: ProductionLossDatum[];
  inventoryLevels: InventoryLevelDatum[];
  topLossBatches: LossBatchDatum[];
  dispatchTrend: DispatchTrendDatum[];
  revenueTrend: RevenueTrendDatum[];
  filterPanels: IndustrialFilterPanel[];
  donutSummary: {
    title: string;
    subtitle: string;
    series: DonutSliceDatum[];
  };
  kpiRows: KpiTableRow[];
};

const STEEL_FILTERS: IndustrialFilterPanel[] = [
  { id: "plant", title: "Steel Area", options: ["Melt Shop", "Rolling Mill", "Dispatch Yard"] },
  { id: "process", title: "Steel Process", options: ["Scrap Receipt", "Melting", "Rolling", "Packing"] },
  { id: "loss", title: "Yield Lens", options: ["Material Yield", "Energy Loss", "Minor Stops", "Operator Effort"] },
];

export const INDUSTRIAL_DASHBOARD_DATA: Record<DashboardRangeKey, IndustrialDashboardData> = {
  today: {
    title: "Steel Shift Control View",
    subtitle: "Live steel-plant signals for stock trust, batch output, leakage pressure, and dispatch rhythm.",
    rangeComparisonLabel: "vs yesterday",
    kpis: {
      totalStock: { label: "Total Stock", value: "9,840 KG", trendLabel: "live steel balance", comparisonLabel: "vs yesterday", severity: "stable", action: { href: "/steel?tab=inventory", label: "Inventory Lane" } },
      todayProduction: { label: "Today Production", value: "1,480 KG", trend: 6.2, trendLabel: "output pace", comparisonLabel: "vs yesterday", severity: "good", action: { href: "/steel?tab=production", label: "Production Lane" } },
      todayLoss: { label: "Today Loss", value: "142 KG", trend: 9.7, trendLabel: "yield drift", comparisonLabel: "vs yesterday", severity: "watch", priority: "primary", action: { href: "/steel?tab=risk", label: "Risk Lane" } },
      todayRevenue: { label: "Today Revenue", value: "INR 78,400", trend: 4.9, trendLabel: "invoiced steel", comparisonLabel: "vs yesterday", severity: "stable", action: { href: "/steel/invoices", label: "Invoices" } },
    },
    productionLoss: [
      { label: "Mon", production: 1200, loss: 80 },
      { label: "Tue", production: 1400, loss: 120 },
      { label: "Wed", production: 1100, loss: 60 },
      { label: "Thu", production: 1600, loss: 200 },
      { label: "Fri", production: 1500, loss: 150 },
    ],
    inventoryLevels: [
      { category: "Raw Material", valueKg: 5000 },
      { category: "WIP", valueKg: 2000 },
      { category: "Finished Goods", valueKg: 3500 },
    ],
    topLossBatches: [
      { batch: "Batch A", lossKg: 200 },
      { batch: "Batch B", lossKg: 180 },
      { batch: "Batch C", lossKg: 150 },
      { batch: "Batch D", lossKg: 120 },
      { batch: "Batch E", lossKg: 100 },
    ],
    dispatchTrend: [
      { label: "Day 1", valueKg: 800 },
      { label: "Day 2", valueKg: 950 },
      { label: "Day 3", valueKg: 700 },
      { label: "Day 4", valueKg: 1100 },
      { label: "Day 5", valueKg: 1200 },
      { label: "Day 6", valueKg: 900 },
      { label: "Day 7", valueKg: 1300 },
    ],
    revenueTrend: [
      { label: "Jan", valueInr: 50000 },
      { label: "Feb", valueInr: 65000 },
      { label: "Mar", valueInr: 70000 },
      { label: "Apr", valueInr: 85000 },
    ],
    filterPanels: STEEL_FILTERS,
    donutSummary: {
      title: "Loss Severity Mix",
      subtitle: "Current ranked anomaly mix across steel batches.",
      series: [
        { label: "Watch", value: 45 },
        { label: "High", value: 33 },
        { label: "Critical", value: 22 },
      ],
    },
    kpiRows: [
      { metric: "Output KG", current: "1,480", previous: "1,394", changePercent: 6.2, status: "up" },
      { metric: "Loss KG", current: "142", previous: "129", changePercent: 9.7, status: "down" },
      { metric: "Dispatch KG", current: "1,300", previous: "1,120", changePercent: 16.1, status: "up" },
      { metric: "Invoice Value", current: "INR 78,400", previous: "INR 74,300", changePercent: 5.5, status: "up" },
    ],
  },
  "7d": {
    title: "Seven-Day Steel Control",
    subtitle: "A manager-ready steel board for output, loss, dispatch movement, and invoice flow across the last week.",
    rangeComparisonLabel: "vs previous 7 days",
    kpis: {
      totalStock: { label: "Total Stock", value: "10,500 KG", trendLabel: "live steel balance", comparisonLabel: "vs previous 7 days", severity: "stable", action: { href: "/steel?tab=inventory", label: "Inventory Lane" } },
      todayProduction: { label: "Today Production", value: "1,500 KG", trend: 7.8, trendLabel: "output pace", comparisonLabel: "vs previous 7 days", severity: "good", action: { href: "/steel?tab=production", label: "Production Lane" } },
      todayLoss: { label: "Today Loss", value: "150 KG", trend: 12.0, trendLabel: "needs review", comparisonLabel: "vs previous 7 days", severity: "critical", priority: "primary", action: { href: "/steel?tab=risk", label: "Risk Lane" } },
      todayRevenue: { label: "Today Revenue", value: "INR 85,000", trend: 11.1, trendLabel: "weekly close", comparisonLabel: "vs previous 7 days", severity: "good", action: { href: "/steel/invoices", label: "Invoices" } },
    },
    productionLoss: [
      { label: "Mon", production: 1200, loss: 80 },
      { label: "Tue", production: 1400, loss: 120 },
      { label: "Wed", production: 1100, loss: 60 },
      { label: "Thu", production: 1600, loss: 200 },
      { label: "Fri", production: 1500, loss: 150 },
    ],
    inventoryLevels: [
      { category: "Raw Material", valueKg: 5000 },
      { category: "WIP", valueKg: 2000 },
      { category: "Finished Goods", valueKg: 3500 },
    ],
    topLossBatches: [
      { batch: "Batch A", lossKg: 200 },
      { batch: "Batch B", lossKg: 180 },
      { batch: "Batch C", lossKg: 150 },
      { batch: "Batch D", lossKg: 120 },
      { batch: "Batch E", lossKg: 100 },
    ],
    dispatchTrend: [
      { label: "Day 1", valueKg: 800 },
      { label: "Day 2", valueKg: 950 },
      { label: "Day 3", valueKg: 700 },
      { label: "Day 4", valueKg: 1100 },
      { label: "Day 5", valueKg: 1200 },
      { label: "Day 6", valueKg: 900 },
      { label: "Day 7", valueKg: 1300 },
    ],
    revenueTrend: [
      { label: "Jan", valueInr: 50000 },
      { label: "Feb", valueInr: 65000 },
      { label: "Mar", valueInr: 70000 },
      { label: "Apr", valueInr: 85000 },
    ],
    filterPanels: STEEL_FILTERS,
    donutSummary: {
      title: "Loss Severity Mix",
      subtitle: "Weekly severity split used to monitor leakage pressure.",
      series: [
        { label: "Watch", value: 42 },
        { label: "High", value: 38 },
        { label: "Critical", value: 20 },
      ],
    },
    kpiRows: [
      { metric: "Output KG", current: "7,800", previous: "7,235", changePercent: 7.8, status: "up" },
      { metric: "Loss KG", current: "610", previous: "544", changePercent: 12.1, status: "down" },
      { metric: "Dispatch KG", current: "6,950", previous: "6,100", changePercent: 13.9, status: "up" },
      { metric: "Invoice Value", current: "INR 4,85,000", previous: "INR 4,11,000", changePercent: 18.0, status: "up" },
    ],
  },
  "30d": {
    title: "Thirty-Day Steel Executive View",
    subtitle: "Thirty-day steel operations board for owner review across stock trust, batch loss, dispatch momentum, and gross commercial movement.",
    rangeComparisonLabel: "vs previous 30 days",
    kpis: {
      totalStock: { label: "Total Stock", value: "12,900 KG", trendLabel: "live steel balance", comparisonLabel: "vs previous 30 days", severity: "stable", action: { href: "/steel?tab=inventory", label: "Inventory Lane" } },
      todayProduction: { label: "Today Production", value: "6,420 KG", trend: 13.4, trendLabel: "month pace", comparisonLabel: "vs previous 30 days", severity: "good", action: { href: "/steel?tab=production", label: "Production Lane" } },
      todayLoss: { label: "Today Loss", value: "610 KG", trend: -3.8, trendLabel: "loss improving", comparisonLabel: "vs previous 30 days", severity: "good", priority: "primary", action: { href: "/steel?tab=risk", label: "Risk Lane" } },
      todayRevenue: { label: "Today Revenue", value: "INR 3,12,000", trend: 18.9, trendLabel: "monthly realized", comparisonLabel: "vs previous 30 days", severity: "good", action: { href: "/steel/invoices", label: "Invoices" } },
    },
    productionLoss: [
      { label: "Week 1", production: 5600, loss: 410 },
      { label: "Week 2", production: 6100, loss: 530 },
      { label: "Week 3", production: 5900, loss: 460 },
      { label: "Week 4", production: 6800, loss: 620 },
      { label: "Week 5", production: 6420, loss: 610 },
    ],
    inventoryLevels: [
      { category: "Raw Material", valueKg: 6100 },
      { category: "WIP", valueKg: 2400 },
      { category: "Finished Goods", valueKg: 4400 },
    ],
    topLossBatches: [
      { batch: "Batch K", lossKg: 290 },
      { batch: "Batch J", lossKg: 250 },
      { batch: "Batch H", lossKg: 230 },
      { batch: "Batch F", lossKg: 190 },
      { batch: "Batch D", lossKg: 160 },
    ],
    dispatchTrend: [
      { label: "Week 1", valueKg: 4300 },
      { label: "Week 2", valueKg: 4650 },
      { label: "Week 3", valueKg: 3980 },
      { label: "Week 4", valueKg: 5100 },
      { label: "Week 5", valueKg: 5480 },
      { label: "Week 6", valueKg: 4920 },
      { label: "Week 7", valueKg: 5730 },
    ],
    revenueTrend: [
      { label: "Jan", valueInr: 50000 },
      { label: "Feb", valueInr: 65000 },
      { label: "Mar", valueInr: 70000 },
      { label: "Apr", valueInr: 85000 },
    ],
    filterPanels: STEEL_FILTERS,
    donutSummary: {
      title: "Loss Severity Mix",
      subtitle: "Thirty-day anomaly mix used for owner leakage review.",
      series: [
        { label: "Watch", value: 47 },
        { label: "High", value: 31 },
        { label: "Critical", value: 22 },
      ],
    },
    kpiRows: [
      { metric: "Output KG", current: "26,820", previous: "23,661", changePercent: 13.4, status: "up" },
      { metric: "Loss KG", current: "2,620", previous: "2,723", changePercent: -3.8, status: "up" },
      { metric: "Dispatch KG", current: "24,430", previous: "20,775", changePercent: 17.6, status: "up" },
      { metric: "Invoice Value", current: "INR 19,20,000", previous: "INR 16,14,000", changePercent: 18.9, status: "up" },
    ],
  },
};

export type SmartInsight = {
  id: string;
  headline: string;
  supportingText: string;
  tone: "neutral" | "good" | "warning";
  severity: "good" | "watch" | "critical" | "stable";
  impactScore: number;
  nextStep: string;
  primaryAction?: {
    href: string;
    label: string;
  };
};

export type SteelOverallStatusSummary = {
  label: "Good" | "Watch" | "Critical";
  tone: "good" | "watch" | "critical";
  reason: string;
  nextStep: string;
};

export type SteelTopPrioritySummary = {
  title: string;
  statusLabel: string;
  reason: string;
  nextStep: string;
};

export type SteelDataConfidenceSummary = {
  label: "Low" | "Medium" | "High";
  reason: string;
  nextStep: string;
};

function comparisonLabelForRange(range: DashboardRangeKey) {
  if (range === "today") return "vs yesterday";
  if (range === "7d") return "vs previous 7 days";
  return "vs previous 30 days";
}

function severityFromTrend(trend?: number, behavior: "higher_is_better" | "lower_is_better" = "higher_is_better"): DashboardKpi["severity"] {
  if (trend == null) return "stable";
  if (behavior === "higher_is_better") {
    if (trend >= 5) return "good";
    if (trend <= -5) return "watch";
    return "stable";
  }
  if (trend >= 10) return "critical";
  if (trend > 0) return "watch";
  if (trend <= -5) return "good";
  return "stable";
}

function toDateOnly(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function monthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value: Date) {
  return value.toLocaleDateString("en-IN", { month: "short" });
}

function formatCompactDay(value: Date) {
  return value.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function formatRangeLabel(value: Date, range: DashboardRangeKey) {
  if (range === "30d") return `W${Math.ceil(value.getDate() / 7)}`;
  return value.toLocaleDateString("en-IN", { weekday: "short" });
}

function safePercent(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function formatMetricValue(metric: "kg" | "inr", value: number) {
  if (metric === "kg") return `${Math.round(value).toLocaleString("en-IN")} KG`;
  return `INR ${Math.round(value).toLocaleString("en-IN")}`;
}

function buildRowsFromWindows(current: { output: number; loss: number; dispatch: number; revenue: number }, previous: { output: number; loss: number; dispatch: number; revenue: number }): KpiTableRow[] {
  const outputChange = safePercent(current.output, previous.output);
  const lossChange = safePercent(current.loss, previous.loss);
  const dispatchChange = safePercent(current.dispatch, previous.dispatch);
  const revenueChange = safePercent(current.revenue, previous.revenue);
  return [
    {
      metric: "Output KG",
      current: formatMetricValue("kg", current.output),
      previous: formatMetricValue("kg", previous.output),
      changePercent: outputChange,
      status: outputChange >= 0 ? "up" : "down",
    },
    {
      metric: "Loss KG",
      current: formatMetricValue("kg", current.loss),
      previous: formatMetricValue("kg", previous.loss),
      changePercent: lossChange,
      status: lossChange <= 0 ? "up" : "down",
    },
    {
      metric: "Dispatch KG",
      current: formatMetricValue("kg", current.dispatch),
      previous: formatMetricValue("kg", previous.dispatch),
      changePercent: dispatchChange,
      status: dispatchChange >= 0 ? "up" : "down",
    },
    {
      metric: "Invoice Value",
      current: formatMetricValue("inr", current.revenue),
      previous: formatMetricValue("inr", previous.revenue),
      changePercent: revenueChange,
      status: revenueChange >= 0 ? "up" : "down",
    },
  ];
}

export function buildSmartInsights(data: IndustrialDashboardData): SmartInsight[] {
  const latestLoss = data.productionLoss[data.productionLoss.length - 1]?.loss ?? 0;
  const previousLoss = data.productionLoss[data.productionLoss.length - 2]?.loss ?? latestLoss;
  const lossDelta = previousLoss ? ((latestLoss - previousLoss) / previousLoss) * 100 : 0;

  const rawMaterial = data.inventoryLevels.find((item) => item.category === "Raw Material");
  const lowStockCategory = data.inventoryLevels.reduce((lowest, current) =>
    current.valueKg < lowest.valueKg ? current : lowest,
  );

  const latestRevenue = data.revenueTrend[data.revenueTrend.length - 1]?.valueInr ?? 0;
  const previousRevenue = data.revenueTrend[data.revenueTrend.length - 2]?.valueInr ?? latestRevenue;
  const revenueDelta = previousRevenue ? ((latestRevenue - previousRevenue) / previousRevenue) * 100 : 0;

  const highestLossBatch = [...data.topLossBatches].sort((left, right) => right.lossKg - left.lossKg)[0];

  const insights: SmartInsight[] = [
    {
      id: "loss",
      headline:
        lossDelta >= 0
          ? `Steel loss increased by ${lossDelta.toFixed(1)}% in the latest window`
          : `Steel loss dropped by ${Math.abs(lossDelta).toFixed(1)}% in the latest window`,
      supportingText: `Yield loss closed at ${latestLoss} KG. The rolling and melt teams should review the last abnormal spike before the next batch closes.`,
      tone: lossDelta > 0 ? "warning" : "good",
      severity: lossDelta > 8 ? "critical" : lossDelta > 0 ? "watch" : "good",
      impactScore: lossDelta > 0 ? Math.round(Math.abs(lossDelta) + latestLoss) : Math.round(Math.abs(lossDelta)),
      nextStep: lossDelta > 0 ? "Open the risk lane and trace the latest loss spike before the next batch closes." : "Keep monitoring the production lane and confirm the improvement holds on the next shift.",
      primaryAction: { href: "/steel?tab=risk", label: "Open Risk Lane" },
    },
    {
      id: "stock",
      headline: `Low steel stock watch: ${lowStockCategory.category}`,
      supportingText: `${lowStockCategory.valueKg.toLocaleString("en-IN")} KG is the lowest live steel buffer. ${rawMaterial ? `Raw material now stands at ${rawMaterial.valueKg.toLocaleString("en-IN")} KG.` : ""}`,
      tone: lowStockCategory.valueKg <= 2500 ? "warning" : "neutral",
      severity: lowStockCategory.valueKg <= 2500 ? "watch" : "stable",
      impactScore: Math.round(10000 - lowStockCategory.valueKg),
      nextStep: lowStockCategory.valueKg <= 2500 ? "Check inventory confidence and replenish or recount the lowest buffer before production is squeezed." : "Keep inventory checks current so stock trust stays ahead of the next batch cycle.",
      primaryAction: { href: "/steel?tab=inventory", label: "Open Inventory Lane" },
    },
    {
      id: "revenue",
      headline:
        revenueDelta >= 0
          ? `Steel revenue increased by ${revenueDelta.toFixed(1)}% over the previous period`
          : `Steel revenue softened by ${Math.abs(revenueDelta).toFixed(1)}% over the previous period`,
      supportingText: `Current invoiced steel value stands at INR ${latestRevenue.toLocaleString("en-IN")}. Dispatch discipline is directly supporting this movement.`,
      tone: revenueDelta >= 0 ? "good" : "warning",
      severity: revenueDelta >= 0 ? "good" : "watch",
      impactScore: Math.round(Math.abs(revenueDelta) + latestRevenue / 1000),
      nextStep: revenueDelta >= 0 ? "Keep invoices and dispatch closure aligned to preserve the current commercial pace." : "Review invoices and dispatch closure so commercial leakage does not grow.",
      primaryAction: { href: "/steel/invoices", label: "Open Invoices" },
    },
    {
      id: "batch",
      headline: `Top steel loss batch: ${highestLossBatch.batch}`,
      supportingText: `${highestLossBatch.lossKg.toLocaleString("en-IN")} KG loss makes it the highest review priority in the current steel window.`,
      tone: highestLossBatch.lossKg >= 150 ? "warning" : "neutral",
      severity: highestLossBatch.lossKg >= 200 ? "critical" : highestLossBatch.lossKg >= 150 ? "watch" : "stable",
      impactScore: highestLossBatch.lossKg,
      nextStep: highestLossBatch.lossKg >= 150 ? "Open the production or risk lane and trace the batch before approving the next shift pattern." : "Keep the batch under review while monitoring whether another loss spike overtakes it.",
      primaryAction: { href: "/steel?tab=production", label: "Open Production Lane" },
    },
  ];

  return insights.sort((left, right) => right.impactScore - left.impactScore);
}

export function buildSteelDashboardData(params: {
  overview?: SteelOverview | null;
  batches?: SteelBatch[];
  invoices?: SteelInvoice[];
  dispatches?: SteelDispatch[];
}): Record<DashboardRangeKey, IndustrialDashboardData> {
  const overview = params.overview ?? null;
  const batches = params.batches ?? [];
  const invoices = params.invoices ?? [];
  const dispatches = params.dispatches ?? [];

  if (!overview && !batches.length && !invoices.length && !dispatches.length) {
    return INDUSTRIAL_DASHBOARD_DATA;
  }

  const today = startOfToday();
  const chartWindows: Record<DashboardRangeKey, number> = { today: 5, "7d": 7, "30d": 5 };
  const windowDays: Record<DashboardRangeKey, number> = { today: 1, "7d": 7, "30d": 30 };

  const buildRangeData = (range: DashboardRangeKey): IndustrialDashboardData => {
    const days = windowDays[range];
    const comparisonLabel = comparisonLabelForRange(range);
    const currentStart = addDays(today, -(days - 1));
    const previousStart = addDays(currentStart, -days);
    const previousEnd = addDays(currentStart, -1);

    const currentBatches = batches.filter((batch) => {
      const batchDate = toDateOnly(batch.production_date);
      return batchDate && batchDate >= currentStart && batchDate <= today;
    });
    const previousBatches = batches.filter((batch) => {
      const batchDate = toDateOnly(batch.production_date);
      return batchDate && batchDate >= previousStart && batchDate <= previousEnd;
    });
    const currentInvoices = invoices.filter((invoice) => {
      const invoiceDate = toDateOnly(invoice.invoice_date);
      return invoiceDate && invoiceDate >= currentStart && invoiceDate <= today;
    });
    const previousInvoices = invoices.filter((invoice) => {
      const invoiceDate = toDateOnly(invoice.invoice_date);
      return invoiceDate && invoiceDate >= previousStart && invoiceDate <= previousEnd;
    });
    const currentDispatches = dispatches.filter((dispatch) => {
      const dispatchDate = toDateOnly(dispatch.dispatch_date);
      return dispatchDate && dispatchDate >= currentStart && dispatchDate <= today;
    });
    const previousDispatches = dispatches.filter((dispatch) => {
      const dispatchDate = toDateOnly(dispatch.dispatch_date);
      return dispatchDate && dispatchDate >= previousStart && dispatchDate <= previousEnd;
    });

    const currentOutput = currentBatches.reduce((sum, batch) => sum + Number(batch.actual_output_kg || 0), 0);
    const currentLoss = currentBatches.reduce((sum, batch) => sum + Number(batch.loss_kg || 0), 0);
    const currentRevenue = currentInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);
    const currentDispatchWeight = currentDispatches.reduce((sum, dispatch) => sum + Number(dispatch.total_weight_kg || 0), 0);

    const previousOutput = previousBatches.reduce((sum, batch) => sum + Number(batch.actual_output_kg || 0), 0);
    const previousLoss = previousBatches.reduce((sum, batch) => sum + Number(batch.loss_kg || 0), 0);
    const previousRevenue = previousInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);
    const previousDispatchWeight = previousDispatches.reduce((sum, dispatch) => sum + Number(dispatch.total_weight_kg || 0), 0);

    const totalStockKg = Number(overview?.inventory_totals.total_kg || 0);
    const inventoryLevels: InventoryLevelDatum[] = [
      { category: "Raw Material", valueKg: Number(overview?.inventory_totals.raw_material_kg || 0) },
      { category: "WIP", valueKg: Number(overview?.inventory_totals.wip_kg || 0) },
      { category: "Finished Goods", valueKg: Number(overview?.inventory_totals.finished_goods_kg || 0) },
    ];

    const topLossBatches = [...batches]
      .sort((left, right) => Number(right.loss_kg || 0) - Number(left.loss_kg || 0))
      .slice(0, 5)
      .map((batch) => ({
        batch: batch.batch_code,
        lossKg: Number(batch.loss_kg || 0),
      }));

    const chartDays = chartWindows[range];
    const productionLossBuckets = new Map<string, { production: number; loss: number; date: Date }>();
    for (let index = chartDays - 1; index >= 0; index -= 1) {
      const day = addDays(today, -index);
      productionLossBuckets.set(day.toISOString(), { production: 0, loss: 0, date: day });
    }
    currentBatches.forEach((batch) => {
      const batchDate = toDateOnly(batch.production_date);
      if (!batchDate) return;
      const key = batchDate.toISOString();
      if (!productionLossBuckets.has(key) && range === "30d") {
        productionLossBuckets.set(key, { production: 0, loss: 0, date: batchDate });
      }
      const bucket = productionLossBuckets.get(key);
      if (!bucket) return;
      bucket.production += Number(batch.actual_output_kg || 0);
      bucket.loss += Number(batch.loss_kg || 0);
    });
    const productionLoss = [...productionLossBuckets.values()]
      .sort((left, right) => left.date.getTime() - right.date.getTime())
      .slice(-chartDays)
      .map((bucket) => ({
        label: formatRangeLabel(bucket.date, range),
        production: bucket.production,
        loss: bucket.loss,
      }));

    const dispatchBuckets = new Map<string, { valueKg: number; date: Date }>();
    for (let index = 6; index >= 0; index -= 1) {
      const day = addDays(today, -index);
      dispatchBuckets.set(day.toISOString(), { valueKg: 0, date: day });
    }
    dispatches.forEach((dispatch) => {
      const dispatchDate = toDateOnly(dispatch.dispatch_date);
      if (!dispatchDate) return;
      const key = dispatchDate.toISOString();
      if (!dispatchBuckets.has(key)) return;
      const bucket = dispatchBuckets.get(key);
      if (!bucket) return;
      bucket.valueKg += Number(dispatch.total_weight_kg || 0);
    });
    const dispatchTrend = [...dispatchBuckets.values()].map((bucket) => ({
      label: formatCompactDay(bucket.date),
      valueKg: bucket.valueKg,
    }));

    const invoiceByMonth = new Map<string, number>();
    invoices.forEach((invoice) => {
      const invoiceDate = toDateOnly(invoice.invoice_date);
      if (!invoiceDate) return;
      const key = monthKey(startOfMonth(invoiceDate));
      invoiceByMonth.set(key, (invoiceByMonth.get(key) || 0) + Number(invoice.total_amount || 0));
    });
    const monthSequence = [3, 2, 1, 0].map((offset) => startOfMonth(new Date(today.getFullYear(), today.getMonth() - offset, 1)));
    const revenueTrend = monthSequence.map((month) => ({
      label: monthLabel(month),
      valueInr: invoiceByMonth.get(monthKey(month)) || 0,
    }));

    const confidenceCounts = overview?.confidence_counts || { green: 0, yellow: 0, red: 0 };
    const totalConfidence = confidenceCounts.green + confidenceCounts.yellow + confidenceCounts.red;
    const greenConfidencePercent = totalConfidence ? (confidenceCounts.green * 100.0) / totalConfidence : 0;

    const severityMix = overview
      ? [
          { label: "Watch", value: Number(overview.anomaly_summary.watch_batches || 0) },
          { label: "High", value: Number(overview.anomaly_summary.high_batches || 0) },
          { label: "Critical", value: Number(overview.anomaly_summary.critical_batches || 0) },
        ]
      : INDUSTRIAL_DASHBOARD_DATA[range].donutSummary.series;

    const profitSummary = overview?.profit_summary;
    const lossPercent = currentOutput ? (currentLoss * 100.0) / currentOutput : 0;
    const revenueTrendPercent = safePercent(currentRevenue, previousRevenue);
    const productionTrendPercent = safePercent(currentOutput, previousOutput);
    const lossTrendPercent = safePercent(currentLoss, previousLoss);

    return {
      title:
        range === "today"
          ? "Steel Shift Control View"
          : range === "7d"
            ? "Seven-Day Steel Control"
            : "Thirty-Day Steel Executive View",
      subtitle:
        range === "today"
          ? "Live steel-plant signals for stock trust, batch output, leakage pressure, and dispatch rhythm."
          : range === "7d"
            ? "A manager-ready steel board for output, loss, dispatch movement, and invoice flow across the last week."
            : "Thirty-day steel operations board for owner review across stock trust, batch loss, dispatch momentum, and gross commercial movement.",
      rangeComparisonLabel: comparisonLabel,
      kpis: {
        totalStock: {
          label: "Total Stock",
          value: `${Math.round(totalStockKg).toLocaleString("en-IN")} KG`,
          trend: greenConfidencePercent ? greenConfidencePercent - 50 : undefined,
          trendLabel: "stock confidence green mix",
          comparisonLabel,
          severity:
            Number(overview?.confidence_counts.red || 0) > 0
              ? "critical"
              : Number(overview?.confidence_counts.yellow || 0) > 0
                ? "watch"
                : "good",
          action: { href: "/steel/reconciliations", label: "Stock Review" },
          helperText: `${Number(overview?.confidence_counts.green || 0)} green, ${Number(overview?.confidence_counts.yellow || 0)} watch, ${Number(overview?.confidence_counts.red || 0)} critical positions.`,
        },
        todayProduction: {
          label: "Today Production",
          value: `${Math.round(currentOutput).toLocaleString("en-IN")} KG`,
          trend: productionTrendPercent,
          trendLabel: "output pace",
          comparisonLabel,
          severity: severityFromTrend(productionTrendPercent, "higher_is_better"),
          action: { href: "/steel?tab=production", label: "Production Lane" },
          helperText: `${currentBatches.length} batch${currentBatches.length === 1 ? "" : "es"} contribute to this production view.`,
        },
        todayLoss: {
          label: "Today Loss",
          value: `${Math.round(currentLoss).toLocaleString("en-IN")} KG`,
          trend: lossTrendPercent,
          trendLabel: lossPercent ? `${lossPercent.toFixed(1)}% yield loss` : "yield loss",
          comparisonLabel,
          severity: severityFromTrend(lossTrendPercent, "lower_is_better"),
          priority:
            Number(overview?.anomaly_summary.critical_batches || 0) > 0 || Number(overview?.confidence_counts.red || 0) > 0
              ? "primary"
              : "secondary",
          action: { href: "/steel?tab=risk", label: "Risk Lane" },
          helperText: `${Number(overview?.anomaly_summary.high_batches || 0) + Number(overview?.anomaly_summary.critical_batches || 0)} high-risk batch signals are currently open.`,
        },
        todayRevenue: {
          label: "Today Revenue",
          value: `INR ${Math.round(currentRevenue).toLocaleString("en-IN")}`,
          trend: revenueTrendPercent,
          trendLabel: "commercial movement",
          comparisonLabel,
          severity: severityFromTrend(revenueTrendPercent, "higher_is_better"),
          action: { href: "/steel/invoices", label: "Invoices" },
          helperText: `${Math.round(currentDispatchWeight).toLocaleString("en-IN")} KG dispatch weight is tied to the current commercial window.`,
        },
      },
      productionLoss: productionLoss.some((item) => item.production || item.loss) ? productionLoss : INDUSTRIAL_DASHBOARD_DATA[range].productionLoss,
      inventoryLevels: inventoryLevels.some((item) => item.valueKg > 0) ? inventoryLevels : INDUSTRIAL_DASHBOARD_DATA[range].inventoryLevels,
      topLossBatches: topLossBatches.length ? topLossBatches : INDUSTRIAL_DASHBOARD_DATA[range].topLossBatches,
      dispatchTrend: dispatchTrend.some((item) => item.valueKg > 0) ? dispatchTrend : INDUSTRIAL_DASHBOARD_DATA[range].dispatchTrend,
      revenueTrend: revenueTrend.some((item) => item.valueInr > 0) ? revenueTrend : INDUSTRIAL_DASHBOARD_DATA[range].revenueTrend,
      filterPanels: STEEL_FILTERS,
      donutSummary: {
        title: "Loss Severity Mix",
        subtitle: "Ranked steel anomaly split across the active control window.",
        series: severityMix.some((item) => item.value > 0) ? severityMix : INDUSTRIAL_DASHBOARD_DATA[range].donutSummary.series,
      },
      kpiRows:
        currentOutput || currentLoss || currentRevenue || currentDispatchWeight
          ? buildRowsFromWindows(
              { output: currentOutput, loss: currentLoss, dispatch: currentDispatchWeight, revenue: currentRevenue },
              { output: previousOutput, loss: previousLoss, dispatch: previousDispatchWeight, revenue: previousRevenue },
            )
          : profitSummary
            ? [
                {
                  metric: "Realized Revenue",
                  current: formatMetricValue("inr", Number(profitSummary.realized_dispatched_revenue_inr || 0)),
                  previous: formatMetricValue("inr", Number(profitSummary.realized_invoiced_amount_inr || 0)),
                  changePercent: safePercent(
                    Number(profitSummary.realized_dispatched_revenue_inr || 0),
                    Number(profitSummary.realized_invoiced_amount_inr || 0),
                  ),
                  status: "up",
                },
                {
                  metric: "Realized Profit",
                  current: formatMetricValue("inr", Number(profitSummary.realized_dispatched_profit_inr || 0)),
                  previous: formatMetricValue("inr", Number(profitSummary.estimated_gross_profit_inr || 0)),
                  changePercent: safePercent(
                    Number(profitSummary.realized_dispatched_profit_inr || 0),
                    Number(profitSummary.estimated_gross_profit_inr || 0),
                  ),
                  status: Number(profitSummary.realized_dispatched_profit_inr || 0) >= 0 ? "up" : "down",
                },
                {
                  metric: "Dispatch Weight",
                  current: formatMetricValue("kg", Number(profitSummary.realized_dispatch_weight_kg || 0)),
                  previous: formatMetricValue("kg", Number(profitSummary.realized_invoiced_weight_kg || 0)),
                  changePercent: safePercent(
                    Number(profitSummary.realized_dispatch_weight_kg || 0),
                    Number(profitSummary.realized_invoiced_weight_kg || 0),
                  ),
                  status: "up",
                },
                {
                  metric: "Leakage Exposure",
                  current: formatMetricValue("inr", Number(overview?.anomaly_summary.total_estimated_leakage_value_inr || 0)),
                  previous: formatMetricValue("kg", Number(overview?.anomaly_summary.total_variance_kg || 0)),
                  changePercent: Number(overview?.batch_metrics.average_loss_percent || 0),
                  status: Number(overview?.batch_metrics.average_loss_percent || 0) <= 5 ? "up" : "down",
                },
              ]
            : INDUSTRIAL_DASHBOARD_DATA[range].kpiRows,
    };
  };

  return {
    today: buildRangeData("today"),
    "7d": buildRangeData("7d"),
    "30d": buildRangeData("30d"),
  };
}
