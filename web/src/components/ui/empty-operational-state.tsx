import * as React from "react";

import { EmptyState, type EmptyStateProps } from "@/components/ui/empty-state";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";

export type EmptyOperationalStateProps = Omit<EmptyStateProps, "status" | "statusLabel"> & {
  eyebrow?: string;
  tone?: StatusBadgeTone;
  toneLabel?: string;
};

export function EmptyOperationalState({
  children,
  eyebrow,
  tone = "default",
  toneLabel,
  ...props
}: EmptyOperationalStateProps) {
  return (
    <EmptyState {...props}>
      {eyebrow || toneLabel ? (
        <div className="space-y-sm">
          {eyebrow ? (
            <p className="text-label-dense font-semibold uppercase tracking-wide text-text-secondary">
              {eyebrow}
            </p>
          ) : null}
          {toneLabel ? (
            <div className="flex justify-center">
              <StatusBadge tone={tone}>{toneLabel}</StatusBadge>
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
    </EmptyState>
  );
}
