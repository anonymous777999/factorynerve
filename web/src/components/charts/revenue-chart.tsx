"use client";

import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";

import { ApexChartClient } from "@/components/charts/apex-chart-client";
import { ChartCard } from "@/components/charts/chart-card";
import { buildLineChartOptions } from "@/components/charts/chart-config";
import { INDUSTRIAL_CHART_THEME } from "@/components/charts/industrial-chart-theme";
import type { RevenueTrendDatum } from "@/lib/industrial-dashboard";

export function RevenueChart({
  data,
  loading = false,
  onDrillDown,
}: {
  data: RevenueTrendDatum[];
  loading?: boolean;
  onDrillDown?: (meta: { chartId: string; label: string; seriesName: string; value: number }) => void;
}) {
  const bookedPeriods = useMemo(
    () => data.filter((item) => item.valueInr > 0).length,
    [data],
  );
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
      colors: [INDUSTRIAL_CHART_THEME.navy, INDUSTRIAL_CHART_THEME.aqua],
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
        size: 4,
        colors: ["#ffffff"],
        strokeColors: INDUSTRIAL_CHART_THEME.aqua,
        strokeWidth: 3,
      },
    }),
    [categories, onDrillDown],
  );

  return (
    <ChartCard
      title="Revenue Chart"
      description="Monthly realized revenue in rupees with a business-style run-rate overlay inspired by executive OPEX reviews."
      loading={loading}
      emptyState={
        !loading && bookedPeriods < 2
          ? {
              title: "Not enough invoice coverage yet",
              description: "Close at least two billing periods before the revenue run-rate becomes useful.",
            }
          : null
      }
    >
      <ApexChartClient type="line" options={options} series={series} height={320} />
    </ChartCard>
  );
}
