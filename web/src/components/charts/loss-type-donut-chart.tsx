"use client";

import { useMemo } from "react";

import type { ApexOptions } from "apexcharts";

import { ApexChartClient } from "@/components/charts/apex-chart-client";
import { ChartCard } from "@/components/charts/chart-card";
import { INDUSTRIAL_CHART_THEME } from "@/components/charts/industrial-chart-theme";
import type { DonutSliceDatum } from "@/lib/industrial-dashboard";

export function LossTypeDonutChart({
  title,
  subtitle,
  data,
  loading = false,
  onDrillDown,
}: {
  title: string;
  subtitle: string;
  data: DonutSliceDatum[];
  loading?: boolean;
  onDrillDown?: (meta: { chartId: string; label: string; seriesName: string; value: number }) => void;
}) {
  const series = useMemo(() => data.map((item) => item.value), [data]);
  const labels = useMemo(() => data.map((item) => item.label), [data]);
  const total = useMemo(() => series.reduce((sum, value) => sum + value, 0), [series]);

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "donut",
        background: "transparent",
        toolbar: { show: false },
        events: {
          dataPointSelection: (_event, _chartContext, config) => {
            if (!onDrillDown || !config) return;
            onDrillDown({
              chartId: "loss-type-donut",
              label: labels[config.dataPointIndex] || "Unknown",
              seriesName: "Loss Type Mix",
              value: series[config.dataPointIndex] || 0,
            });
          },
        },
      },
      labels,
      legend: {
        position: "bottom",
        labels: {
          colors: INDUSTRIAL_CHART_THEME.text,
        },
      },
      colors: [INDUSTRIAL_CHART_THEME.blue, INDUSTRIAL_CHART_THEME.teal, INDUSTRIAL_CHART_THEME.coral],
      stroke: {
        colors: ["#ffffff"],
      },
      dataLabels: {
        enabled: true,
        formatter: (value) => `${Number(value).toFixed(0)}%`,
        style: {
          colors: ["#ffffff"],
        },
      },
      tooltip: {
        theme: "light",
        y: {
          formatter: (value) => `${value}%`,
        },
      },
      plotOptions: {
        pie: {
          expandOnClick: true,
          donut: {
            size: "62%",
            labels: {
              show: true,
              total: {
                show: true,
                label: "Total",
                formatter: () => `${total}%`,
              },
            },
          },
        },
      },
    }),
    [labels, onDrillDown, series, total],
  );
  const isEmpty = !data.length || data.every((item) => item.value <= 0);

  return (
    <ChartCard
      title={title}
      description={subtitle}
      loading={loading}
      isEmpty={isEmpty}
      emptyTitle="No severity mix yet"
      emptyDescription="Once anomaly batches are ranked, this chart will show whether the current mix is mostly watch, high, or critical."
    >
      <ApexChartClient type="donut" options={options} series={series} height={320} />
    </ChartCard>
  );
}
