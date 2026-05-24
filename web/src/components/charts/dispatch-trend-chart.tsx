"use client";

import { useMemo } from "react";

import { ApexChartClient } from "@/components/charts/apex-chart-client";
import { ChartCard } from "@/components/charts/chart-card";
import { buildLineChartOptions } from "@/components/charts/chart-config";
import { getChartTheme } from "@/components/charts/industrial-chart-theme";
import type { DispatchTrendDatum } from "@/lib/industrial-dashboard";
import { useUiPreferences } from "@/providers/ui-preferences-provider";

export function DispatchTrendChart({
  data,
  loading = false,
  onDrillDown,
}: {
  data: DispatchTrendDatum[];
  loading?: boolean;
  onDrillDown?: (meta: { chartId: string; label: string; seriesName: string; value: number }) => void;
}) {
  const { theme: appTheme } = useUiPreferences();
  const chartTheme = useMemo(() => getChartTheme(), [appTheme]);
  const categories = useMemo(() => data.map((item) => item.label), [data]);
  const series = useMemo(
    () => [
      {
        name: "Dispatch",
        data: data.map((item) => item.valueKg),
      },
    ],
    [data],
  );
  const options = useMemo(
    () => ({
      ...buildLineChartOptions({
        theme: chartTheme,
        chartId: "dispatch-trend",
        categories,
        onDrillDown,
        yFormatter: (value) => `${Math.round(value)} KG`,
        tooltipFormatter: (value) => `${Math.round(value)} KG`,
      }),
      colors: [chartTheme.series.processing],
      markers: {
        size: 7,
        colors: [chartTheme.apex.markerFillColor],
        strokeColors: chartTheme.series.processing,
        strokeWidth: 3,
        hover: { size: 9 },
      },
    }),
    [categories, chartTheme, onDrillDown],
  );
  const isEmpty = !data.length || data.every((item) => item.valueKg <= 0);

  return (
    <ChartCard
      title="Dispatch Trend"
      description="Outbound weight movement across the last seven dispatch windows. Smooth area shape helps managers spot transport slowdowns quickly."
      loading={loading}
      isEmpty={isEmpty}
      emptyTitle="No dispatch rhythm yet"
      emptyDescription="Post dispatch records so transport movement and closure pace become visible on the chart board."
    >
      <ApexChartClient type="area" options={options} series={series} height={320} theme={chartTheme} />
    </ChartCard>
  );
}
