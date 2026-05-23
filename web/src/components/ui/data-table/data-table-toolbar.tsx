import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DataTableToolbarProps = {
  actions?: React.ReactNode;
  className?: string;
  onClear?: () => void;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchValue?: string;
};

export function DataTableToolbar({
  actions,
  className,
  onClear,
  onSearchChange,
  searchPlaceholder = "Search records",
  searchValue = "",
}: DataTableToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-density-gap border-b border-border-subtle bg-surface-shell px-sm py-sm",
        className,
      )}
    >
      {onSearchChange ? (
        <div className="min-w-0 flex-1">
          <label className="ui-no-select ui-no-callout mb-xs block text-label-dense font-medium uppercase tracking-wide text-text-secondary">
            Search
          </label>
          <Input
            value={searchValue}
            className="mt-0 px-sm text-label-dense"
            placeholder={searchPlaceholder}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      ) : null}
      {actions ? <div className="flex flex-wrap items-center gap-sm">{actions}</div> : null}
      {onClear ? (
        <Button size="compact" variant="ghost" onClick={onClear}>
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
