"use client";

import { useMemo } from "react";

import { ApexChartClient } from "@/components/charts/apex-chart-client";
import { ChartCard } from "@/components/charts/chart-card";
import { buildLineChartOptions } from "@/components/charts/chart-config";
import { INDUSTRIAL_CHART_THEME } from "@/components/charts/industrial-chart-theme";
import type { DispatchTrendDatum } from "@/lib/industrial-dashboard";

export function DispatchTrendChart({
  data,
  loading = false,
  onDrillDown,
}: {
  data: DispatchTrendDatum[];
  loading?: boolean;
  onDrillDown?: (meta: { chartId: string; label: string; seriesName: string; value: number }) => void;
}) {
  const populatedWindows = useMemo(
    () => data.filter((item) => item.valueKg > 0).length,
    [data],
  );
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
        chartId: "dispatch-trend",
        categories,
        onDrillDown,
        yFormatter: (value) => `${Math.round(value)} KG`,
        tooltipFormatter: (value) => `${Math.round(value)} KG`,
      }),
      colors: [INDUSTRIAL_CHART_THEME.aqua],
      markers: {
        size: 5,
        colors: ["#ffffff"],
        strokeColors: INDUSTRIAL_CHART_THEME.aqua,
        strokeWidth: 3,
        hover: { size: 7 },
      },
    }),
    [categories, onDrillDown],
  );

  return (
    <ChartCard
      title="Dispatch Trend"
      description="Outbound weight movement across the last seven dispatch windows. Smooth area shape helps managers spot transport slowdowns quickly."
      loading={loading}
      emptyState={
        !loading && populatedWindows < 2
          ? {
              title: "Not enough dispatch history yet",
              description: "Record at least two dispatch windows before reading trend direction here.",
            }
          : null
      }
    >
      <ApexChartClient type="area" options={options} series={series} height={320} />
    </ChartCard>
  );
}
