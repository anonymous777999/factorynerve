import * as React from "react";

import { Button } from "@/components/ui/button";
import type { DataTableBulkAction } from "@/components/ui/data-table/data-table-types";
import { cn } from "@/lib/utils";

type DataTableBulkToolbarProps = {
  actions: Array<Omit<DataTableBulkAction, "onAction"> & { onAction: () => void }>;
  className?: string;
  onClear: () => void;
  selectedCount: number;
};

export function DataTableBulkToolbar({
  actions,
  className,
  onClear,
  selectedCount,
}: DataTableBulkToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-sm border-b border-border-focus bg-surface-selected px-md py-sm",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-center gap-sm">
        <span className="ui-no-select ui-no-callout text-label font-semibold text-text-primary">
          {selectedCount} selected
        </span>
        <span className="text-label-dense text-text-secondary">
          Use `Ctrl/Cmd + A` to select visible rows and `Esc` to clear.
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-sm">
        {actions.map((action) => (
          <Button
            key={action.id}
            size="compact"
            variant={action.variant ?? "secondary"}
            disabled={action.disabled}
            isBusy={action.isBusy}
            busyLabel={action.label}
            onClick={action.onAction}
          >
            {action.shortcutKey ? `${action.label} (${action.shortcutKey.toUpperCase()})` : action.label}
          </Button>
        ))}
        <Button size="compact" variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
