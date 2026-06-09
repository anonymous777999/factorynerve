import {
  type ColumnDef,
  type ColumnPinningState,
  type ColumnSizingState,
  type OnChangeFn,
  type RowPinningState,
  type SortingState,
  type Table,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import type { ProductionDataTableColumn, ProductionDataTableProps } from "../../../../../types/datatable";
import { useDataTableEngine } from "./hooks";

export interface ProductionTableInstance<TData> {
  columnDefs: ColumnDef<TData>[];
  table: Table<TData>;
}

function createColumnDef<TData>(column: ProductionDataTableColumn<TData>): ColumnDef<TData> {
  return {
    accessorFn: column.accessorFn,
    accessorKey: column.accessorKey,
    cell: ({ row, getValue, column: tableColumn }) =>
      column.cell({
        columnId: tableColumn.id,
        isEditing: false,
        row: row.original,
        rowId: row.id,
        value: getValue(),
      }),
    enableColumnFilter: false,
    enablePinning: column.enablePinning ?? true,
    enableResizing: column.enableResizing ?? true,
    enableSorting: column.enableSorting ?? true,
    footer: column.footer ? () => column.footer : undefined,
    header: () => column.header,
    id: column.id,
    maxSize: column.maxSize,
    minSize: column.minSize,
    size: column.size,
  };
}

export function useProductionDataTable<TData>({
  columns,
  data,
  getRowId,
}: Pick<ProductionDataTableProps<TData>, "columns" | "data" | "getRowId">): ProductionTableInstance<TData> {
  const engine = useDataTableEngine();

  const columnDefs = useMemo(() => columns.map((column) => createColumnDef(column)), [columns]);

  const columnPinning = useMemo<ColumnPinningState>(() => {
    const left = engine.columns.filter((column) => column.pinned === "left").map((column) => column.id);
    const right = engine.columns.filter((column) => column.pinned === "right").map((column) => column.id);
    return { left, right };
  }, [engine.columns]);

  const columnSizing = useMemo<ColumnSizingState>(() => engine.widths, [engine.widths]);
  const rowSelection = useMemo(
    () => Object.fromEntries(Array.from(engine.selectedRowIds).map((id) => [id, true])),
    [engine.selectedRowIds]
  );
  const columnVisibility = useMemo(
    () => Object.fromEntries(engine.columns.map((column) => [column.id, !engine.hiddenColumnIds.has(column.id)])),
    [engine.columns, engine.hiddenColumnIds]
  );
  const rowPinning = useMemo<RowPinningState>(
    () => ({ top: engine.rowPinning.top, bottom: engine.rowPinning.bottom }),
    [engine.rowPinning.bottom, engine.rowPinning.top]
  );

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next =
      typeof updater === "function"
        ? updater(engine.sorting as SortingState)
        : updater;
    engine.setSorting(next.map((entry) => ({ desc: entry.desc, id: entry.id })));
  };

  const onColumnSizingChange: OnChangeFn<ColumnSizingState> = (updater) => {
    const next = typeof updater === "function" ? updater(columnSizing) : updater;
    Object.entries(next).forEach(([columnId, width]) => engine.updateColumnWidth(columnId, width));
  };

  const onColumnPinningChange: OnChangeFn<ColumnPinningState> = (updater) => {
    const next = typeof updater === "function" ? updater(columnPinning) : updater;
    engine.columns.forEach((column) => {
      if (next.left?.includes(column.id)) engine.setColumnPin(column.id, "left");
      else if (next.right?.includes(column.id)) engine.setColumnPin(column.id, "right");
      else engine.setColumnPin(column.id, null);
    });
  };

  const table = useReactTable<TData>({
    autoResetAll: false,
    columns: columnDefs,
    data,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowId,
    getSortedRowModel: getSortedRowModel(),
    onColumnPinningChange,
    onColumnSizingChange,
    onSortingChange,
    state: {
      columnPinning,
      columnSizing,
      columnVisibility,
      rowPinning,
      rowSelection,
      sorting: engine.sorting as SortingState,
    },
  });

  return { columnDefs, table };
}

export { flexRender };
