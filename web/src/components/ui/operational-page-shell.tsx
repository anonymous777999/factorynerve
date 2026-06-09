"use client";

import * as React from "react";

import { LoadingBoundary } from "@/components/ui/loading-boundary";
import type { MetricStripItem } from "@/components/ui/metric-strip";
import { WorkstationShell, type WorkstationShellProps } from "@/components/ui/workstation-shell";
import { cn } from "@/lib/utils";

export type OperationalPageShellProps = Omit<WorkstationShellProps, "children"> & {
  children: React.ReactNode;
  isLoading?: boolean;
  loadingTitle?: string;
  loadingRows?: number;
  liveIndicator?: boolean;
  liveLabel?: string;
  stagger?: boolean;
  contentClassName?: string;
};

/**
 * Standard Tier B page wrapper: WorkstationShell + optional loading + stagger enter.
 */
export function OperationalPageShell({
  children,
  isLoading = false,
  loadingTitle = "Loading workspace",
  loadingRows = 6,
  liveIndicator = false,
  liveLabel = "Live",
  stagger = true,
  contentClassName,
  tone,
  toneLabel,
  ...shellProps
}: OperationalPageShellProps) {
  const resolvedTone = liveIndicator ? "success" : tone;
  const resolvedToneLabel = liveIndicator ? liveLabel : toneLabel;

  if (isLoading) {
    return (
      <WorkstationShell
        {...shellProps}
        tone={resolvedTone}
        toneLabel={resolvedToneLabel}
        metrics={[]}
        filters={undefined}
      >
        <LoadingBoundary isLoading loadingTitle={loadingTitle} loadingRows={loadingRows}>
          <div />
        </LoadingBoundary>
      </WorkstationShell>
    );
  }

  return (
    <WorkstationShell
      {...shellProps}
      tone={resolvedTone}
      toneLabel={resolvedToneLabel}
    >
      <div
        className={cn(
          stagger && "stagger-children shell-content-enter",
          contentClassName,
        )}
      >
        {children}
      </div>
    </WorkstationShell>
  );
}

export type { MetricStripItem };
