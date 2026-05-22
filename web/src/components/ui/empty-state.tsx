import * as React from "react";

import { Badge, type BadgeStatus } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type EmptyStateProps = React.HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  status?: BadgeStatus;
  statusLabel?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
};

export function EmptyState({
  action,
  children,
  className,
  description,
  secondaryAction,
  status = "draft",
  statusLabel = "No records",
  title,
  ...props
}: EmptyStateProps) {
  return (
    <Card
      className={cn("border-border-subtle bg-surface-panel", className)}
      {...props}
    >
      <CardHeader className="pb-sm">
        <Badge status={status}>{statusLabel}</Badge>
      </CardHeader>
      <CardContent className="flex min-h-row-lg flex-col gap-md pt-0">
        <div className="space-y-sm">
          <CardTitle>{title}</CardTitle>
          {description ? <p className="text-body text-text-secondary">{description}</p> : null}
        </div>
        {children ? <div className="text-body text-text-secondary">{children}</div> : null}
        {action || secondaryAction ? (
          <div className="flex flex-wrap items-center gap-sm">{action}{secondaryAction}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
