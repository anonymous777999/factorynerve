import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FilterOption = {
  label: string;
  value: string;
};

type FilterField =
  | {
    id: string;
    label: string;
    type: "text" | "date";
    value: string;
    placeholder?: string;
    onValueChange: (value: string) => void;
  }
  | {
    id: string;
    label: string;
    type: "select";
    value: string;
    options: FilterOption[];
    placeholder?: string;
    onValueChange: (value: string) => void;
  };

type ActiveFilterPill = {
  id: string;
  label: string;
  value: string;
  onClear: () => void;
};

export type FilterBarProps = {
  fields: FilterField[];
  activeFilters?: ActiveFilterPill[];
  className?: string;
  onClearAll?: () => void;
  title?: string;
  resultCount?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
};

export function FilterBar({
  activeFilters = [],
  actions,
  className,
  footer,
  fields,
  onClearAll,
  resultCount,
  title,
}: FilterBarProps) {
  return (
    <div className={cn("rounded-panel border border-border-subtle bg-surface-shell", className)}>
      {title || resultCount != null || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-sm border-b border-border-subtle px-md py-sm">
          <div className="min-w-0">
            {title ? (
              <p className="text-label-dense font-semibold uppercase tracking-wide text-text-secondary">
                {title}
              </p>
            ) : null}
            {resultCount != null ? (
              <p className="text-label-dense text-text-secondary">{resultCount}</p>
            ) : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className="grid gap-sm px-md py-sm md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto] xl:items-end">
        {fields.map((field) => (
          <div key={field.id} className="min-w-0">
            <label className="ui-no-select ui-no-callout mb-xs block text-label-dense font-medium uppercase tracking-wide text-text-secondary">
              {field.label}
            </label>
            {field.type === "select" ? (
              <Select
                value={field.value}
                onChange={(event) => field.onValueChange(event.target.value)}
              >
                <option value="">{field.placeholder ?? `All ${field.label}`}</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                type={field.type === "date" ? "date" : "text"}
                value={field.value}
                placeholder={field.placeholder}
                onChange={(event) => field.onValueChange(event.target.value)}
              />
            )}
          </div>
        ))}
        {onClearAll ? (
          <Button size="compact" variant="ghost" onClick={onClearAll} className="xl:self-end">
            Clear all filters
          </Button>
        ) : null}
      </div>
      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-sm border-t border-border-subtle px-md py-sm">
          {activeFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className="inline-flex rounded-badge focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              onClick={filter.onClear}
            >
              <Badge status="secondary" size="compact">
                {filter.label}: {filter.value} x
              </Badge>
            </button>
          ))}
        </div>
      ) : null}
      {footer ? <div className="border-t border-border-subtle px-md py-sm">{footer}</div> : null}
    </div>
  );
}
