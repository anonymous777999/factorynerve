"use client";

import type { ApexOptions } from "apexcharts";
import { INDUSTRIAL_CHART_THEME } from "@/components/charts/industrial-chart-theme";

type DrillDownMeta = {
  chartId: string;
  label: string;
  seriesName: string;
  value: number;
};

type SharedConfig = {
  chartId: string;
  categories: string[];
  horizontal?: boolean;
  stacked?: boolean;
  onDrillDown?: (meta: DrillDownMeta) => void;
  yFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number) => string;
  dataLabelFormatter?: (value: number) => string;
};

function baseOptions({
  chartId,
  categories,
  horizontal = false,
  stacked = false,
  onDrillDown,
  yFormatter,
  tooltipFormatter,
  dataLabelFormatter,
}: SharedConfig): ApexOptions {
  return {
    chart: {
      id: chartId,
      toolbar: { show: false },
      zoom: { enabled: false },
      stacked,
      background: "transparent",
      foreColor: INDUSTRIAL_CHART_THEME.text,
      animations: {
        enabled: false,
      },
      events: {
        dataPointSelection: (_event, _chartContext, config) => {
          if (!onDrillDown || !config) return;
          const eventConfig = config as unknown as {
            w?: { config?: { series?: unknown[] } };
            seriesIndex: number;
            dataPointIndex: number;
          };
          const series = Array.isArray(eventConfig.w?.config?.series) ? eventConfig.w?.config?.series : [];
          const selectedSeries = series[eventConfig.seriesIndex] as { name?: string; data?: Array<number | { x?: string; y?: number }> } | undefined;
          const point = selectedSeries?.data?.[eventConfig.dataPointIndex];
          const label =
            typeof point === "object" && point && "x" in point
              ? String(point.x ?? categories[eventConfig.dataPointIndex] ?? "Unknown")
              : String(categories[eventConfig.dataPointIndex] ?? "Unknown");
          const value =
            typeof point === "object" && point && "y" in point ? Number(point.y ?? 0) : Number(point ?? 0);
          onDrillDown({
            chartId,
            label,
            seriesName: selectedSeries?.name || "Series",
            value,
          });
        },
      },
    },
    grid: {
      borderColor: INDUSTRIAL_CHART_THEME.grid,
      strokeDashArray: 3,
      padding: {
        left: 8,
        right: 8,
        top: 8,
        bottom: 0,
      },
    },
    legend: {
      show: true,
      labels: { colors: INDUSTRIAL_CHART_THEME.text },
      fontSize: "12px",
    },
    stroke: {
      width: 2,
      curve: "smooth",
    },
    plotOptions: {
      bar: {
        borderRadius: 6,
        horizontal,
        columnWidth: horizontal ? "56%" : "58%",
        barHeight: horizontal ? "62%" : undefined,
        distributed: false,
      },
    },
    xaxis: {
      categories,
      labels: {
        style: {
          colors: INDUSTRIAL_CHART_THEME.muted,
          fontSize: "12px",
        },
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    yaxis: {
      labels: {
        formatter: yFormatter,
        style: {
          colors: INDUSTRIAL_CHART_THEME.muted,
          fontSize: "12px",
        },
      },
    },
    dataLabels: {
      enabled: Boolean(dataLabelFormatter),
      formatter: dataLabelFormatter,
      style: {
        fontSize: "11px",
        fontWeight: 600,
        colors: [INDUSTRIAL_CHART_THEME.text],
      },
    },
    tooltip: {
      theme: "light",
      y: {
        formatter: tooltipFormatter,
      },
    },
    responsive: [
      {
        breakpoint: 1024,
        options: {
          legend: { position: "bottom" },
        },
      },
      {
        breakpoint: 640,
        options: {
          dataLabels: {
            enabled: false,
          },
          plotOptions: {
            bar: {
              columnWidth: horizontal ? "70%" : "72%",
            },
          },
          xaxis: {
            labels: {
              rotate: -35,
              trim: true,
              hideOverlappingLabels: true,
              style: {
                colors: INDUSTRIAL_CHART_THEME.muted,
                fontSize: "11px",
              },
            },
          },
          yaxis: {
            labels: {
              style: {
                colors: INDUSTRIAL_CHART_THEME.muted,
                fontSize: "11px",
              },
            },
          },
        },
      },
    ],
  };
}

export function buildBarChartOptions(config: SharedConfig): ApexOptions {
  return baseOptions(config);
}

export function buildLineChartOptions({
  chartId,
  categories,
  onDrillDown,
  yFormatter,
  tooltipFormatter,
}: Omit<SharedConfig, "horizontal" | "stacked" | "dataLabelFormatter">): ApexOptions {
  return {
    ...baseOptions({
      chartId,
      categories,
      onDrillDown,
      yFormatter,
      tooltipFormatter,
    }),
    stroke: {
      width: 3,
      curve: "smooth",
    },
    markers: {
      size: 4,
      strokeWidth: 0,
      hover: { size: 6 },
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.28,
        opacityTo: 0.04,
        stops: [0, 90, 100],
      },
    },
  };
}
