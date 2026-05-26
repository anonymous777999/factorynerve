import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { cx } from "../../../../../lib/utils";
import type { ProductionDataTableProps } from "../../../../../types/datatable";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeader,
  DataTableHeaderCell,
  DataTableRow,
} from "..";
import { ColumnResizeSystem } from "./ColumnResizeSystem";
import { mapDensityToFoundationDensity, mapDensityToRowHeight } from "./engine.utils";
import { useDataTableEngine } from "./hooks";
import { useProductionDataTable, flexRender } from "./useProductionDataTable";

export function ProductionDataTable<TData>({
  columns,
  data,
  density,
  emptySlot,
  getRowId,
}: ProductionDataTableProps<TData>) {
  const engine = useDataTableEngine();
  const resolvedDensity = density ?? engine.density;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { table } = useProductionDataTable({ columns, data, getRowId });
  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    estimateSize: () => mapDensityToRowHeight(resolvedDensity),
    getScrollElement: () => scrollRef.current,
    overscan: 12,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0;

  return (
    <div ref={scrollRef} className="h-full overflow-auto">
      <DataTable density={mapDensityToFoundationDensity(resolvedDensity)} aria-rowcount={table.getRowModel().rows.length}>
        <DataTableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <DataTableRow key={headerGroup.id} interactive={false}>
              {headerGroup.headers.map((header) => (
                <DataTableHeaderCell
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className="relative"
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getCanResize() ? <ColumnResizeSystem columnId={header.column.id} /> : null}
                </DataTableHeaderCell>
              ))}
            </DataTableRow>
          ))}
        </DataTableHeader>
        <DataTableBody empty={table.getRowModel().rows.length === 0}>
          {paddingTop > 0 ? (
            <DataTableRow interactive={false}>
              <DataTableCell colSpan={table.getAllLeafColumns().length} className="border-r-0 p-0" style={{ height: paddingTop }} />
            </DataTableRow>
          ) : null}
          {table.getRowModel().rows.length === 0 ? (
            <DataTableRow interactive={false}>
              <DataTableCell colSpan={table.getAllLeafColumns().length} className="border-r-0">
                {emptySlot ?? <div className="py-[var(--spacing-6)] text-center text-[var(--color-text-muted)]">No records available.</div>}
              </DataTableCell>
            </DataTableRow>
          ) : (
            virtualRows.map((virtualRow) => {
              const row = table.getRowModel().rows[virtualRow.index];
              if (!row) return null;

              const pinnedTop = engine.rowPinning.top.includes(row.id);
              const pinnedBottom = engine.rowPinning.bottom.includes(row.id);

              return (
                <DataTableRow
                  key={row.id}
                  selected={row.getIsSelected()}
                  className={cx(pinnedTop && "sticky top-[var(--toolbar-height)] z-[var(--z-raised)]", pinnedBottom && "sticky bottom-0 z-[var(--z-raised)]")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <DataTableCell
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className={cx(
                        cell.column.getIsPinned() === "left" && "sticky left-0 z-[var(--z-raised)] bg-[var(--table-bg)]",
                        cell.column.getIsPinned() === "right" && "sticky right-0 z-[var(--z-raised)] bg-[var(--table-bg)]"
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </DataTableCell>
                  ))}
                </DataTableRow>
              );
            })
          )}
          {paddingBottom > 0 ? (
            <DataTableRow interactive={false}>
              <DataTableCell colSpan={table.getAllLeafColumns().length} className="border-r-0 p-0" style={{ height: paddingBottom }} />
            </DataTableRow>
          ) : null}
        </DataTableBody>
      </DataTable>
    </div>
  );
}
