"use client";

import { useMemo } from "react";

import { ApexChartClient } from "@/components/charts/apex-chart-client";
import { ChartCard } from "@/components/charts/chart-card";
import { buildBarChartOptions } from "@/components/charts/chart-config";
import { INDUSTRIAL_CHART_THEME } from "@/components/charts/industrial-chart-theme";
import type { ProductionLossDatum } from "@/lib/industrial-dashboard";

export function ProductionLossChart({
  data,
  loading = false,
  onDrillDown,
}: {
  data: ProductionLossDatum[];
  loading?: boolean;
  onDrillDown?: (meta: { chartId: string; label: string; seriesName: string; value: number }) => void;
}) {
  const categories = useMemo(() => data.map((item) => item.label), [data]);
  const series = useMemo(
    () => [
      {
        name: "Production",
        data: data.map((item) => ({
          x: item.label,
          y: item.production,
          fillColor: item.production >= 1500 ? INDUSTRIAL_CHART_THEME.teal : INDUSTRIAL_CHART_THEME.blue,
        })),
      },
      {
        name: "Loss",
        data: data.map((item) => ({
          x: item.label,
          y: item.loss,
          fillColor: item.loss > 150 ? INDUSTRIAL_CHART_THEME.redDeep : INDUSTRIAL_CHART_THEME.coral,
        })),
      },
    ],
    [data],
  );

  const options = useMemo(
    () => ({
      ...buildBarChartOptions({
        chartId: "production-vs-loss",
        categories,
        onDrillDown,
        yFormatter: (value) => `${Math.round(value)} KG`,
        tooltipFormatter: (value) => `${Math.round(value)} KG`,
      }),
      colors: [INDUSTRIAL_CHART_THEME.teal, INDUSTRIAL_CHART_THEME.coral],
      annotations: {
        yaxis: [
          {
            y: 150,
            borderColor: INDUSTRIAL_CHART_THEME.redDeep,
            strokeDashArray: 4,
            label: {
              text: "High loss threshold",
              style: {
                background: INDUSTRIAL_CHART_THEME.redDeep,
                color: "#fff",
                fontSize: "10px",
              },
            },
          },
        ],
      },
    }),
    [categories, onDrillDown],
  );

  return (
    <ChartCard
      title="Production vs Loss"
      description="Daily production output versus daily process loss. Darker red bars call out abnormal loss above 150 KG."
      loading={loading}
    >
      <ApexChartClient type="bar" options={options} series={series} height={320} />
    </ChartCard>
  );
}
