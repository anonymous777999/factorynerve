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
    <Card className="h-full">
      <CardHeader>
        <div className="text-xs uppercase tracking-header text-[var(--muted)]">Industrial Signal</div>
        <CardTitle className="mt-2 text-lg md:text-xl">{title}</CardTitle>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-[280px] w-full" />
          </div>
        ) : isEmpty ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card-strong)] px-5 py-10 text-center">
            <div className="text-sm font-semibold text-[var(--text)]">{emptyTitle || "No chart data yet"}</div>
            <div className="mt-2 text-sm leading-6 text-[var(--muted)]">
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
