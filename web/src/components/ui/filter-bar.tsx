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
};

export function FilterBar({
  activeFilters = [],
  className,
  fields,
  onClearAll,
}: FilterBarProps) {
  return (
    <div className={cn("rounded-panel border border-border-subtle bg-surface-shell", className)}>
      <div className="flex flex-wrap items-end gap-sm px-md py-sm">
        {fields.map((field) => (
          <div key={field.id} className="min-w-[12rem] flex-1">
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
          <Button size="compact" variant="ghost" onClick={onClearAll}>
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
              className="inline-flex"
              onClick={filter.onClear}
            >
              <Badge status="secondary" size="compact">
                {filter.label}: {filter.value} x
              </Badge>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
