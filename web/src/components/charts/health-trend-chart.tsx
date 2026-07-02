"use client";

import { useMemo } from "react";

import { ApexChartClient } from "@/components/charts/apex-chart-client";
import { ChartCard } from "@/components/charts/chart-card";
import { buildLineChartOptions } from "@/components/charts/chart-config";
import { INDUSTRIAL_CHART_THEME } from "@/components/charts/industrial-chart-theme";
import type { HealthTrendPoint } from "@/lib/ai";

export function HealthTrendChart({
  data,
  loading = false,
}: {
  data: HealthTrendPoint[];
  loading?: boolean;
}) {
  const categories = useMemo(() => data.map((item) => item.date), [data]);

  // Filter out no_data points for the chart
  const validScores = useMemo(
    () => data.filter((item) => item.label !== "no_data"),
    [data],
  );

  const series = useMemo(() => {
    const scoreData = data.map((item) =>
      item.label === "no_data" ? null : item.score,
    );
    return [
      {
        name: "Health Score",
        data: scoreData,
      },
    ];
  }, [data]);

  const options = useMemo(
    () => ({
      ...buildLineChartOptions({
        chartId: "health-trend",
        categories,
        yFormatter: (value) => `${Math.round(value)}/100`,
        tooltipFormatter: (value) => `${Math.round(value)}/100`,
      }),
      colors: [INDUSTRIAL_CHART_THEME.teal],
      markers: {
        size: 6,
        colors: ["#ffffff"],
        strokeColors: INDUSTRIAL_CHART_THEME.teal,
        strokeWidth: 3,
        hover: { size: 8 },
      },
      annotations: {
        yaxis: [
          {
            y: 80,
            y2: 100,
            fillColor: "rgba(16, 185, 129, 0.08)",
            borderColor: "rgba(16, 185, 129, 0.3)",
            label: {
              text: "Good",
              style: { color: "#10b981", fontSize: "10px", fontWeight: 600 },
              position: "right",
              offsetX: 0,
              offsetY: -8,
            },
          },
          {
            y: 60,
            y2: 80,
            fillColor: "rgba(245, 158, 11, 0.08)",
            borderColor: "rgba(245, 158, 11, 0.3)",
            label: {
              text: "Needs Attention",
              style: { color: "#f59e0b", fontSize: "10px", fontWeight: 600 },
              position: "right",
              offsetX: 0,
              offsetY: -8,
            },
          },
          {
            y: 40,
            y2: 60,
            fillColor: "rgba(249, 115, 22, 0.08)",
            borderColor: "rgba(249, 115, 22, 0.3)",
            label: {
              text: "At Risk",
              style: { color: "#f97316", fontSize: "10px", fontWeight: 600 },
              position: "right",
              offsetX: 0,
              offsetY: -8,
            },
          },
          {
            y: 0,
            y2: 40,
            fillColor: "rgba(239, 68, 68, 0.08)",
            borderColor: "rgba(239, 68, 68, 0.3)",
            label: {
              text: "Critical",
              style: { color: "#ef4444", fontSize: "10px", fontWeight: 600 },
              position: "right",
              offsetX: 0,
              offsetY: 0,
            },
          },
        ],
      },
    }),
    [categories],
  );

  const isEmpty = validScores.length === 0;

  return (
    <ChartCard
      title="Health Score Trend"
      description="Daily factory health score derived from DPR performance, downtime, absenteeism, and quality data."
      loading={loading}
      isEmpty={isEmpty}
      emptyTitle="No health data yet"
      emptyDescription="Start recording DPR entries to see the factory health trend chart."
    >
      <ApexChartClient type="area" options={options} series={series} height={320} />
    </ChartCard>
  );
}
