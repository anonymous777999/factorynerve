import type { ButtonProps } from "@/components/ui/button";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";

export type DataTableAlignment = "left" | "center" | "right";

export type DataTableViewportSize = "sm" | "md" | "lg";

export type DataTableRowState =
  | "selected"
  | "active"
  | "processing"
  | "paused"
  | "synced"
  | "editing";

export type DataTableBulkAction = {
  id: string;
  label: string;
  onAction: (rowIds: string[]) => void;
  disabled?: boolean;
  isBusy?: boolean;
  shortcutKey?: string;
  variant?: ButtonProps["variant"];
};

export type DataTableCellMeta = {
  align?: DataTableAlignment;
  filterOptions?: Array<{ label: string; value: string }>;
  filterPlaceholder?: string;
  filterVariant?: "text" | "select";
  isRowHeader?: boolean;
  sortable?: boolean;
  sticky?: "left";
  headerClassName?: string;
  cellClassName?: string;
  wrap?: boolean;
};

export type DataTableQueryState = {
  columnFilters: ColumnFiltersState;
  search: string;
  sorting: SortingState;
};

export type DataTableColumnDef<TData, TValue = unknown> = ColumnDef<TData, TValue> & {
  meta?: DataTableCellMeta;
};

export const createDataTableColumnHelper = createColumnHelper;
