import type { ButtonProps } from "@/components/ui/button";
import type {
  ColumnFiltersState,
  RowData,
  SortingState,
} from "@tanstack/react-table";
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

// TanStack exposes column meta through declaration merging, so this interface is
// intentionally empty aside from the inherited DPR data-table metadata contract.
/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> extends DataTableCellMeta {}
}
/* eslint-enable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */

export type DataTableColumnDef<TData, TValue = unknown> = ColumnDef<TData, TValue>;

export const createDataTableColumnHelper = createColumnHelper;
