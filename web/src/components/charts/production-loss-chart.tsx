"use client";

import { useMemo } from "react";

import { ApexChartClient } from "@/components/charts/apex-chart-client";
import { ChartCard } from "@/components/charts/chart-card";
import { buildBarChartOptions } from "@/components/charts/chart-config";
import { getChartTheme } from "@/components/charts/industrial-chart-theme";
import type { ProductionLossDatum } from "@/lib/industrial-dashboard";
import { useUiPreferences } from "@/providers/ui-preferences-provider";

export function ProductionLossChart({
  data,
  loading = false,
  onDrillDown,
}: {
  data: ProductionLossDatum[];
  loading?: boolean;
  onDrillDown?: (meta: { chartId: string; label: string; seriesName: string; value: number }) => void;
}) {
  const { theme: appTheme } = useUiPreferences();
  const chartTheme = useMemo(() => getChartTheme(), [appTheme]);
  const categories = useMemo(() => data.map((item) => item.label), [data]);
  const series = useMemo(
    () => [
      {
        name: "Production",
        data: data.map((item) => ({
          x: item.label,
          y: item.production,
          fillColor: item.production >= 1500 ? chartTheme.series.success : chartTheme.series.primary,
        })),
      },
      {
        name: "Loss",
        data: data.map((item) => ({
          x: item.label,
          y: item.loss,
          fillColor: item.loss > 150 ? chartTheme.series.danger : chartTheme.series.warning,
        })),
      },
    ],
    [chartTheme, data],
  );

  const options = useMemo(
    () => ({
      ...buildBarChartOptions({
        theme: chartTheme,
        chartId: "production-vs-loss",
        categories,
        onDrillDown,
        yFormatter: (value) => `${Math.round(value)} KG`,
        tooltipFormatter: (value) => `${Math.round(value)} KG`,
      }),
      colors: [chartTheme.series.success, chartTheme.series.warning],
      annotations: {
        yaxis: [
          {
            y: 150,
            borderColor: chartTheme.series.danger,
            strokeDashArray: 4,
            label: {
              text: "High loss threshold",
              style: {
                background: chartTheme.series.danger,
                color: chartTheme.surfaceCard,
                fontSize: "10px",
              },
            },
          },
        ],
      },
    }),
    [categories, chartTheme, onDrillDown],
  );
  const isEmpty = !data.length || data.every((item) => item.production <= 0 && item.loss <= 0);

  return (
    <ChartCard
      title="Production vs Loss"
      description="Daily production output versus daily process loss. Darker red bars call out abnormal loss above 150 KG."
      loading={loading}
      isEmpty={isEmpty}
      emptyTitle="No production-loss pattern yet"
      emptyDescription="Record steel batches first so the board can compare production weight against process loss."
    >
      <ApexChartClient type="bar" options={options} series={series} height={320} theme={chartTheme} />
    </ChartCard>
  );
}
