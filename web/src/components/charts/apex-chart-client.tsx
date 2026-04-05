"use client";

import dynamic from "next/dynamic";
import type { ApexAxisChartSeries, ApexNonAxisChartSeries, ApexOptions } from "apexcharts";
import { Skeleton } from "@/components/ui/skeleton";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-[320px] w-full" />,
});

export function ApexChartClient({
  type,
  options,
  series,
  height = 320,
}: {
  type: "bar" | "area" | "line" | "donut";
  options: ApexOptions;
  series: ApexAxisChartSeries | ApexNonAxisChartSeries;
  height?: number;
}) {
  return <ReactApexChart type={type} options={options} series={series} height={height} />;
}
