import type { Column } from "@tanstack/react-table";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type DataTableFilterCellProps<TData> = {
  column: Column<TData, unknown>;
};

export function DataTableFilterCell<TData>({
  column,
}: DataTableFilterCellProps<TData>) {
  const meta = column.columnDef.meta;
  const filterVariant = meta?.filterVariant ?? (meta?.filterOptions ? "select" : "text");
  const filterValue = typeof column.getFilterValue() === "string" ? column.getFilterValue() : "";
  const label = typeof column.columnDef.header === "string" ? column.columnDef.header : column.id;

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
      value={filterValue}
      onChange={(event) => column.setFilterValue(event.target.value)}
    />
  );
}
