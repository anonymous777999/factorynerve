"use client";

import type { ApexOptions } from "apexcharts";
import type { ChartThemeConfig } from "@/components/charts/industrial-chart-theme";

type DrillDownMeta = {
  chartId: string;
  label: string;
  seriesName: string;
  value: number;
};

type SharedConfig = {
  theme: ChartThemeConfig;
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
  theme,
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
      background: theme.apex.chartBackground,
      foreColor: theme.textPrimary,
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
      borderColor: theme.apex.gridColor,
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
      labels: { colors: theme.apex.legendTextColor },
      fontSize: "12px",
      itemMargin: {
        horizontal: 10,
        vertical: 8,
      },
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
          colors: theme.apex.axisLabelColor,
          fontSize: "12px",
        },
      },
      axisBorder: {
        show: true,
        color: theme.apex.axisLineColor,
      },
      axisTicks: {
        show: false,
      },
    },
    yaxis: {
      labels: {
        formatter: yFormatter,
        style: {
          colors: theme.apex.axisLabelColor,
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
        colors: [theme.apex.dataLabelColor],
      },
    },
    tooltip: {
      theme: theme.apex.tooltipMode,
      style: {
        fontSize: "12px",
        fontFamily: "IBM Plex Sans, sans-serif",
      },
      fillSeriesColor: false,
      marker: {
        show: true,
      },
      y: {
        formatter: tooltipFormatter,
      },
      custom: undefined,
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
          markers: {
            size: 6,
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
                colors: theme.apex.axisLabelColor,
                fontSize: "11px",
              },
            },
          },
          yaxis: {
            labels: {
              style: {
                colors: theme.apex.axisLabelColor,
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
  theme,
  chartId,
  categories,
  onDrillDown,
  yFormatter,
  tooltipFormatter,
}: Omit<SharedConfig, "horizontal" | "stacked" | "dataLabelFormatter">): ApexOptions {
  return {
    ...baseOptions({
      theme,
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
      colors: [theme.series.processing],
      strokeColors: theme.apex.markerFillColor,
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
