import * as React from "react";

import { Badge, type BadgeStatus } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StickyActionBarAction = {
  id: string;
  label: string;
  onAction?: () => void;
  variant?: React.ComponentProps<typeof Button>["variant"];
  disabled?: boolean;
  isBusy?: boolean;
  shortcutHint?: string;
};

export type StickyActionBarProps = {
  variant?: "page" | "drawer";
  title?: string;
  description?: string;
  status?: BadgeStatus;
  statusLabel?: string;
  selectedCount?: number;
  leftSlot?: React.ReactNode;
  centerSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  primaryAction?: StickyActionBarAction;
  secondaryAction?: StickyActionBarAction;
  tertiaryAction?: StickyActionBarAction;
  meta?: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

function StickyActionBarActions({
  primaryAction,
  secondaryAction,
  tertiaryAction,
}: Pick<
  StickyActionBarProps,
  "primaryAction" | "secondaryAction" | "tertiaryAction"
>) {
  const actions = [primaryAction, secondaryAction, tertiaryAction].filter(Boolean) as StickyActionBarAction[];

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-sm">
      {actions.map((action, index) => (
        <Button
          key={action.id}
          size="compact"
          variant={action.variant ?? (index === 0 ? "primary" : "outline")}
          disabled={action.disabled}
          isBusy={action.isBusy}
          busyLabel={action.label}
          onClick={action.onAction}
        >
          {action.shortcutHint ? `${action.label} (${action.shortcutHint})` : action.label}
        </Button>
      ))}
    </div>
  );
}

export function StickyActionBar({
  className,
  contentClassName,
  description,
  leftSlot,
  meta,
  centerSlot,
  primaryAction,
  rightSlot,
  secondaryAction,
  status = "draft",
  statusLabel = "Draft",
  selectedCount,
  tertiaryAction,
  title,
  variant = "drawer",
}: StickyActionBarProps) {
  const isPage = variant === "page";

  return (
    <div
      className={cn(
        isPage
          ? "sticky top-0 z-sticky border-b border-border-default bg-surface-panel"
          : "sticky bottom-0 z-sticky border-t border-border-default bg-surface-panel safe-bottom-inset",
        className,
      )}
    >
      <div
        className={cn(
          isPage
            ? "flex min-h-12 flex-col gap-sm px-md py-sm lg:flex-row lg:items-center lg:justify-between"
            : "operational-form-footer flex flex-col gap-sm px-md py-sm lg:flex-row lg:items-center lg:justify-between",
          contentClassName,
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-sm">
          {leftSlot ?? (
            <div className="min-w-0 space-y-xs">
              <div className="flex flex-wrap items-center gap-sm">
                <Badge status={status} size="compact">{statusLabel}</Badge>
                {selectedCount != null && selectedCount > 0 ? (
                  <span className="text-label font-semibold text-text-primary">{selectedCount} selected</span>
                ) : null}
                {title ? (
                  <span className="text-label font-semibold text-text-primary">{title}</span>
                ) : null}
              </div>
              {description ? <p className="text-label-dense text-text-secondary">{description}</p> : null}
              {meta ? <div className="text-label-dense text-text-secondary">{meta}</div> : null}
            </div>
          )}
        </div>
        {centerSlot ? (
          <div className="flex min-w-0 flex-1 items-center justify-center">
            {centerSlot}
          </div>
        ) : (
          <div className="hidden min-w-0 flex-1 lg:block" />
        )}
        <div className="flex flex-1 items-center justify-end gap-sm">
          {rightSlot}
          <StickyActionBarActions
            primaryAction={primaryAction}
            secondaryAction={secondaryAction}
            tertiaryAction={tertiaryAction}
          />
        </div>
      </div>
    </div>
  );
}
