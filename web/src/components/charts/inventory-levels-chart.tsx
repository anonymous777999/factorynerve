"use client";

import { useMemo } from "react";

import { ApexChartClient } from "@/components/charts/apex-chart-client";
import { ChartCard } from "@/components/charts/chart-card";
import { buildBarChartOptions } from "@/components/charts/chart-config";
import { INDUSTRIAL_CHART_THEME } from "@/components/charts/industrial-chart-theme";
import type { InventoryLevelDatum } from "@/lib/industrial-dashboard";

const INVENTORY_COLORS = [INDUSTRIAL_CHART_THEME.blue, INDUSTRIAL_CHART_THEME.amber, INDUSTRIAL_CHART_THEME.teal];

export function InventoryLevelsChart({
  data,
  loading = false,
  onDrillDown,
}: {
  data: InventoryLevelDatum[];
  loading?: boolean;
  onDrillDown?: (meta: { chartId: string; label: string; seriesName: string; value: number }) => void;
}) {
  const trackedCategories = useMemo(
    () => data.filter((item) => item.valueKg > 0).length,
    [data],
  );
  const categories = useMemo(() => data.map((item) => item.category), [data]);
  const series = useMemo(
    () => [
      {
        name: "Inventory",
        data: data.map((item, index) => ({
          x: item.category,
          y: item.valueKg,
          fillColor: INVENTORY_COLORS[index] || "#3ea6ff",
        })),
      },
    ],
    [data],
  );
  const options = useMemo(
    () =>
      buildBarChartOptions({
        chartId: "inventory-levels",
        categories,
        horizontal: true,
        onDrillDown,
        yFormatter: (value) => `${Math.round(value)}`,
        tooltipFormatter: (value) => `${Math.round(value)} KG`,
        dataLabelFormatter: (value) => `${Math.round(value)} KG`,
      }),
    [categories, onDrillDown],
  );

  return (
    <ChartCard
      title="Inventory Levels"
      description="Live stock posture by stage. Raw material, WIP, and finished goods stay expressed in kilograms for plant-floor trust."
      loading={loading}
      emptyState={
        !loading && trackedCategories === 0
          ? {
              title: "Not enough stock positions yet",
              description: "Run at least one trusted stock update before the inventory chart can compare stages.",
            }
          : null
      }
    >
      <ApexChartClient type="bar" options={options} series={series} height={300} />
    </ChartCard>
  );
}
