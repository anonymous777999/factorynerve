"use client";

import { useMemo } from "react";

import { ApexChartClient } from "@/components/charts/apex-chart-client";
import { ChartCard } from "@/components/charts/chart-card";
import { buildBarChartOptions } from "@/components/charts/chart-config";
import { getChartTheme } from "@/components/charts/industrial-chart-theme";
import type { LossBatchDatum } from "@/lib/industrial-dashboard";
import { useUiPreferences } from "@/providers/ui-preferences-provider";

export function TopLossBatchesChart({
  data,
  loading = false,
  onDrillDown,
}: {
  data: LossBatchDatum[];
  loading?: boolean;
  onDrillDown?: (meta: { chartId: string; label: string; seriesName: string; value: number }) => void;
}) {
  const { theme: appTheme } = useUiPreferences();
  const chartTheme = useMemo(() => getChartTheme(), [appTheme]);
  const sorted = useMemo(() => [...data].sort((left, right) => right.lossKg - left.lossKg), [data]);
  const categories = useMemo(() => sorted.map((item) => item.batch), [sorted]);
  const series = useMemo(
    () => [
      {
        name: "Loss (KG)",
        data: sorted.map((item, index) => ({
          x: item.batch,
          y: item.lossKg,
          fillColor:
            index === 0
              ? chartTheme.series.danger
              : index === 1
                ? chartTheme.series.danger
                : index === 2
                  ? chartTheme.series.warning
                  : chartTheme.series.processing,
        })),
      },
    ],
    [chartTheme, sorted],
  );
  const options = useMemo(
    () =>
      buildBarChartOptions({
        theme: chartTheme,
        chartId: "top-loss-batches",
        categories,
        horizontal: true,
        onDrillDown,
        yFormatter: (value) => `${Math.round(value)}`,
        tooltipFormatter: (value) => `Loss ${Math.round(value)} KG`,
        dataLabelFormatter: (value) => `${Math.round(value)} KG`,
      }),
    [categories, chartTheme, onDrillDown],
  );
  const isEmpty = !sorted.length || sorted.every((item) => item.lossKg <= 0);

  return (
    <ChartCard
      title="Top Loss Batches"
      description="The worst-performing batches sorted by loss weight. The highest-loss batch is highlighted in red for immediate review."
      loading={loading}
      isEmpty={isEmpty}
      emptyTitle="No ranked loss batches yet"
      emptyDescription="Record steel batches with variance so the board can rank loss-heavy batches for review."
    >
      <ApexChartClient type="bar" options={options} series={series} height={320} theme={chartTheme} />
    </ChartCard>
  );
}
