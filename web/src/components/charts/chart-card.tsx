"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ChartCard({
  title,
  description,
  loading = false,
  emptyState,
  children,
}: {
  title: string;
  description: string;
  loading?: boolean;
  emptyState?: {
    title: string;
    description: string;
  } | null;
  children: ReactNode;
}) {
  return (
    <Card className="h-full rounded-[1.9rem] border border-[#dce5ef] bg-white text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <CardHeader>
        <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Industrial Signal</div>
        <CardTitle className="mt-2 text-lg text-slate-800 md:text-xl">{title}</CardTitle>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-[280px] w-full" />
          </div>
        ) : emptyState ? (
          <div className="rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
            <div className="text-sm font-semibold text-slate-900">{emptyState.title}</div>
            <div className="mt-2 text-sm leading-6 text-slate-500">{emptyState.description}</div>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
