"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ChartCard({
  title,
  description,
  loading = false,
  children,
  emptyTitle,
  emptyDescription,
  isEmpty = false,
}: {
  title: string;
  description: string;
  loading?: boolean;
  children: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  isEmpty?: boolean;
}) {
  return (
    <Card className="h-full rounded-[1.9rem] border border-[#e7e5e4] bg-white text-[#111111] shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <CardHeader>
        <div className="text-xs uppercase tracking-[0.22em] text-[#78716c]">Industrial Signal</div>
        <CardTitle className="mt-2 text-lg text-[#111111] md:text-xl">{title}</CardTitle>
        <p className="mt-2 text-sm leading-6 text-[#57534e]">{description}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-[280px] w-full" />
          </div>
        ) : isEmpty ? (
          <div className="rounded-[1.5rem] border border-dashed border-[#d6d3d1] bg-[#fafaf9] px-5 py-10 text-center">
            <div className="text-sm font-semibold text-[#111111]">{emptyTitle || "No chart data yet"}</div>
            <div className="mt-2 text-sm leading-6 text-[#57534e]">
              {emptyDescription || "Add the first steel records to unlock this view."}
            </div>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
