"use client";

import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";

import { ApexChartClient } from "@/components/charts/apex-chart-client";
import { ChartCard } from "@/components/charts/chart-card";
import { buildLineChartOptions } from "@/components/charts/chart-config";
import { getChartTheme } from "@/components/charts/industrial-chart-theme";
import type { RevenueTrendDatum } from "@/lib/industrial-dashboard";
import { useUiPreferences } from "@/providers/ui-preferences-provider";

export function RevenueChart({
  data,
  loading = false,
  onDrillDown,
}: {
  data: RevenueTrendDatum[];
  loading?: boolean;
  onDrillDown?: (meta: { chartId: string; label: string; seriesName: string; value: number }) => void;
}) {
  const { theme: appTheme } = useUiPreferences();
  const chartTheme = useMemo(() => getChartTheme(), [appTheme]);
  const categories = useMemo(() => data.map((item) => item.label), [data]);
  const series = useMemo(
    () => [
      {
        name: "Revenue Bars",
        type: "column",
        data: data.map((item) => item.valueInr),
      },
      {
        name: "Revenue Run Rate",
        type: "line",
        data: data.map((item) => item.valueInr),
      },
    ],
    [data],
  );
  const options: ApexOptions = useMemo(
    () => ({
      ...buildLineChartOptions({
        theme: chartTheme,
        chartId: "revenue-chart",
        categories,
        onDrillDown,
        yFormatter: (value) => `Rs ${Math.round(value / 1000)}k`,
        tooltipFormatter: (value) =>
          new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
          }).format(value),
      }),
      colors: [chartTheme.series.primary, chartTheme.series.processing],
      stroke: {
        width: [0, 3],
        curve: "smooth" as const,
      },
      plotOptions: {
        bar: {
          borderRadius: 4,
          columnWidth: "42%",
        },
      },
      fill: {
        type: ["solid", "gradient"] as const,
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.28,
          opacityTo: 0.06,
          stops: [0, 90, 100],
        },
      },
      markers: {
        size: 6,
        colors: [chartTheme.apex.markerFillColor],
        strokeColors: chartTheme.series.processing,
        strokeWidth: 3,
      },
    }),
    [categories, chartTheme, onDrillDown],
  );
  const isEmpty = !data.length || data.every((item) => item.valueInr <= 0);

  return (
    <ChartCard
      title="Revenue Chart"
      description="Monthly realized revenue in rupees with a business-style run-rate overlay inspired by executive OPEX reviews."
      loading={loading}
      isEmpty={isEmpty}
      emptyTitle="No revenue trend yet"
      emptyDescription="Create steel invoices and dispatch-linked revenue records to unlock the commercial trend view."
    >
      <ApexChartClient type="line" options={options} series={series} height={320} theme={chartTheme} />
    </ChartCard>
  );
}
