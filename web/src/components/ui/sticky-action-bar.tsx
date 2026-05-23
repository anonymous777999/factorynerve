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
  title?: string;
  description?: string;
  status?: BadgeStatus;
  statusLabel?: string;
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
  meta,
  primaryAction,
  secondaryAction,
  status = "draft",
  statusLabel = "Draft",
  tertiaryAction,
  title,
}: StickyActionBarProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-sticky border-t border-border-default bg-surface-panel/96 shadow-xs backdrop-blur supports-[backdrop-filter]:bg-surface-panel/92",
        "safe-bottom-inset",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-sm px-md py-sm lg:flex-row lg:items-center lg:justify-between",
          contentClassName,
        )}
      >
        <div className="min-w-0 space-y-xs">
          <div className="flex flex-wrap items-center gap-sm">
            <Badge status={status}>{statusLabel}</Badge>
            {title ? (
              <span className="text-label font-semibold text-text-primary">{title}</span>
            ) : null}
          </div>
          {description ? <p className="text-label-dense text-text-secondary">{description}</p> : null}
          {meta ? <div className="text-label-dense text-text-secondary">{meta}</div> : null}
        </div>
        <StickyActionBarActions
          primaryAction={primaryAction}
          secondaryAction={secondaryAction}
          tertiaryAction={tertiaryAction}
        />
      </div>
    </div>
  );
}
