"use client";

import { useMemo } from "react";

import { ApexChartClient } from "@/components/charts/apex-chart-client";
import { ChartCard } from "@/components/charts/chart-card";
import { buildBarChartOptions } from "@/components/charts/chart-config";
import { getChartTheme } from "@/components/charts/industrial-chart-theme";
import type { InventoryLevelDatum } from "@/lib/industrial-dashboard";
import { useUiPreferences } from "@/providers/ui-preferences-provider";

export function InventoryLevelsChart({
  data,
  loading = false,
  onDrillDown,
}: {
  data: InventoryLevelDatum[];
  loading?: boolean;
  onDrillDown?: (meta: { chartId: string; label: string; seriesName: string; value: number }) => void;
}) {
  const { theme: appTheme } = useUiPreferences();
  const chartTheme = useMemo(() => getChartTheme(), [appTheme]);
  const inventoryColors = useMemo(
    () => [chartTheme.series.processing, chartTheme.series.warning, chartTheme.series.success],
    [chartTheme],
  );
  const categories = useMemo(() => data.map((item) => item.category), [data]);
  const series = useMemo(
    () => [
      {
        name: "Inventory",
        data: data.map((item, index) => ({
          x: item.category,
          y: item.valueKg,
          fillColor: inventoryColors[index] || chartTheme.series.primary,
        })),
      },
    ],
    [chartTheme, data, inventoryColors],
  );
  const options = useMemo(
    () =>
      buildBarChartOptions({
        theme: chartTheme,
        chartId: "inventory-levels",
        categories,
        horizontal: true,
        onDrillDown,
        yFormatter: (value) => `${Math.round(value)}`,
        tooltipFormatter: (value) => `${Math.round(value)} KG`,
        dataLabelFormatter: (value) => `${Math.round(value)} KG`,
      }),
    [categories, chartTheme, onDrillDown],
  );
  const isEmpty = !data.length || data.every((item) => item.valueKg <= 0);

  return (
    <ChartCard
      title="Inventory Levels"
      description="Live stock posture by stage. Raw material, WIP, and finished goods stay expressed in kilograms for plant-floor trust."
      loading={loading}
      isEmpty={isEmpty}
      emptyTitle="No inventory posture yet"
      emptyDescription="Add or sync steel stock records so the inventory confidence view can show live stage balances."
    >
      <ApexChartClient type="bar" options={options} series={series} height={300} theme={chartTheme} />
    </ChartCard>
  );
}
