"use client";

import dynamic from "next/dynamic";
import type { ApexAxisChartSeries, ApexNonAxisChartSeries, ApexOptions } from "apexcharts";
import type { CSSProperties } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { ChartThemeConfig } from "@/components/charts/industrial-chart-theme";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-[320px] w-full" />,
});

export function ApexChartClient({
  type,
  options,
  series,
  height = 320,
  theme,
}: {
  type: "bar" | "area" | "line" | "donut";
  options: ApexOptions;
  series: ApexAxisChartSeries | ApexNonAxisChartSeries;
  height?: number;
  theme?: ChartThemeConfig;
}) {
  return (
    <div
      data-chart-theme="industrial"
      style={
        theme
          ? ({
              "--chart-tooltip-bg": theme.apex.tooltipBackground,
              "--chart-tooltip-fg": theme.apex.tooltipTextColor,
              "--chart-tooltip-border": theme.apex.tooltipBorderColor,
              "--chart-surface": theme.apex.chartBackground,
            } as CSSProperties)
          : undefined
      }
    >
      {theme ? (
        <style jsx global>{`
          [data-chart-theme="industrial"] .apexcharts-tooltip,
          [data-chart-theme="industrial"] .apexcharts-xaxistooltip,
          [data-chart-theme="industrial"] .apexcharts-yaxistooltip {
            background: var(--chart-tooltip-bg) !important;
            color: var(--chart-tooltip-fg) !important;
            border: 1px solid var(--chart-tooltip-border) !important;
            box-shadow: var(--shadow-sm) !important;
          }

          [data-chart-theme="industrial"] .apexcharts-tooltip-title {
            background: color-mix(in srgb, var(--chart-tooltip-bg) 92%, var(--chart-surface)) !important;
            border-bottom: 1px solid var(--chart-tooltip-border) !important;
            color: var(--chart-tooltip-fg) !important;
          }

          [data-chart-theme="industrial"] .apexcharts-tooltip-text-y-label,
          [data-chart-theme="industrial"] .apexcharts-tooltip-text-y-value,
          [data-chart-theme="industrial"] .apexcharts-tooltip-text-z-label,
          [data-chart-theme="industrial"] .apexcharts-tooltip-text-z-value,
          [data-chart-theme="industrial"] .apexcharts-tooltip-text-x-label {
            color: var(--chart-tooltip-fg) !important;
          }
        `}</style>
      ) : null}
      <ReactApexChart type={type} options={options} series={series} height={height} />
    </div>
  );
}
