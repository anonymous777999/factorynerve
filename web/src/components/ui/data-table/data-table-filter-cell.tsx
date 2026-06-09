import * as React from "react";
import type { Column } from "@tanstack/react-table";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useThrottledCallback } from "@/hooks/use-interaction-timing";

type DataTableFilterCellProps<TData> = {
  column: Column<TData, unknown>;
};

export function DataTableFilterCell<TData>({
  column,
}: DataTableFilterCellProps<TData>) {
  const meta = column.columnDef.meta;
  const filterVariant = meta?.filterVariant ?? (meta?.filterOptions ? "select" : "text");
  const rawFilterValue = column.getFilterValue();
  const filterValue = typeof rawFilterValue === "string" ? rawFilterValue : "";
  const label = typeof column.columnDef.header === "string" ? column.columnDef.header : column.id;

  // Requirement 12.8: filter operations throttle at 150ms. Text filtering runs
  // over already-loaded rows on every keystroke, so we keep the input fully
  // responsive with local state and throttle the (potentially expensive)
  // column filter update that re-runs the filtered row model.
  const [localValue, setLocalValue] = React.useState(filterValue);
  const [lastSyncedValue, setLastSyncedValue] = React.useState(filterValue);

  // Adjust local state during render when the external filter value changes
  // (e.g. cleared via "Clear all filters") instead of in an effect.
  if (filterValue !== lastSyncedValue) {
    setLastSyncedValue(filterValue);
    setLocalValue(filterValue);
  }

  const throttledSetFilter = useThrottledCallback((next: string) => {
    column.setFilterValue(next);
  }, 150);

  if (filterVariant === "select") {
    return (
      <Select
        aria-label={`Filter ${label}`}
        className="mt-0 px-sm text-label-dense"
        value={filterValue}
        onChange={(event) => column.setFilterValue(event.target.value)}
      >
        <option value="">{meta?.filterPlaceholder ?? "All"}</option>
        {meta?.filterOptions?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    );
  }

  return (
    <Input
      aria-label={`Filter ${label}`}
      className="mt-0 px-sm text-label-dense"
      placeholder={meta?.filterPlaceholder ?? "Filter"}
      value={localValue}
      onChange={(event) => {
        const next = event.target.value;
        setLocalValue(next);
        throttledSetFilter(next);
      }}
    />
  );
}
