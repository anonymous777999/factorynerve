"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ChartCard({
  title,
  description,
  loading = false,
  children,
}: {
  title: string;
  description: string;
  loading?: boolean;
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
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
