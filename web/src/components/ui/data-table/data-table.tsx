"use client";

import * as React from "react";
import {
  getFilteredRowModel,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  functionalUpdate,
  type ColumnFiltersState,
  type ColumnDef,
  type OnChangeFn,
  type Row,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

import { DataTableBulkToolbar } from "@/components/ui/data-table/data-table-bulk-toolbar";
import { DataTableFilterCell } from "@/components/ui/data-table/data-table-filter-cell";
import { DataTableSortButton } from "@/components/ui/data-table/data-table-sort-button";
import { DataTableToolbar } from "@/components/ui/data-table/data-table-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import type {
  DataTableAlignment,
  DataTableBulkAction,
  DataTableColumnDef,
  DataTableQueryState,
  DataTableRowState,
  DataTableViewportSize,
} from "@/components/ui/data-table/data-table-types";
import { useDataTableKeyboard } from "@/components/ui/data-table/use-data-table-keyboard";
import { useDensityMetric } from "@/components/ui/data-table/use-density-metric";
import { cn } from "@/lib/utils";

export type DataTableProps<TData extends RowData> = {
  ariaLabel?: string;
  caption?: string;
  className?: string;
  columns: DataTableColumnDef<TData, unknown>[];
  data: TData[];
  bulkActions?: DataTableBulkAction[];
  emptyMessage?: string;
  emptyTitle?: string;
  activeRowId?: string | null;
  enableBulkSelection?: boolean;
  enableColumnFilters?: boolean;
  enableGlobalSearch?: boolean;
  enableStickyFirstColumn?: boolean;
  enableSorting?: boolean;
  enableVirtualization?: boolean;
  getRowId?: (originalRow: TData, index: number, parent?: Row<TData>) => string;
  getRowState?: (row: TData, rowId: string) => DataTableRowState | DataTableRowState[] | null | undefined;
  getRowSelectionDisabled?: (row: TData, rowId: string) => boolean;
  manualFiltering?: boolean;
  manualSorting?: boolean;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
  onRowSelectionChange?: (rowId: string | null) => void;
  onSearchChange?: (value: string) => void;
  onSelectedRowIdsChange?: (rowIds: string[]) => void;
  onSortingChange?: OnChangeFn<SortingState>;
  overscan?: number;
  renderEmptyState?: React.ReactNode;
  renderToolbar?: React.ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  selectedRowIds?: string[];
  selectedRowId?: string | null;
  sorting?: SortingState;
  state?: Partial<DataTableQueryState>;
  viewportClassName?: string;
  viewportSize?: DataTableViewportSize;
};

const viewportSizeClassNames: Record<DataTableViewportSize, string> = {
  sm: "max-h-table-sm",
  md: "max-h-table-md",
  lg: "max-h-table-lg",
};

const alignmentClassNames: Record<DataTableAlignment, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

function getStickyCellClassName(
  isSticky: boolean,
  rowStates: Set<DataTableRowState>,
) {
  if (!isSticky) {
    return "";
  }

  const stickySurfaceClassName = rowStates.has("editing")
    ? "bg-surface-elevated group-hover:bg-surface-elevated"
    : rowStates.has("active")
      ? "bg-workflow-active-bg group-hover:bg-workflow-active-bg"
      : rowStates.has("selected")
        ? "bg-surface-selected group-hover:bg-surface-selected"
        : rowStates.has("processing")
          ? "bg-status-processing-bg group-hover:bg-status-processing-bg"
          : rowStates.has("paused")
            ? "bg-status-paused-bg group-hover:bg-status-paused-bg"
            : rowStates.has("synced")
              ? "bg-status-synced-bg group-hover:bg-status-synced-bg"
              : "bg-surface-card group-hover:bg-surface-hover";

  return cn(
    "sticky left-0 z-sticky border-r border-border-subtle",
    stickySurfaceClassName,
  );
}

function normalizeRowStates(states: Array<DataTableRowState | null | undefined>) {
  const normalizedStates = new Set<DataTableRowState>();

  states.forEach((state) => {
    if (state) {
      normalizedStates.add(state);
    }
  });

  return normalizedStates;
}

function getRowSurfaceClassName(rowStates: Set<DataTableRowState>) {
  if (rowStates.has("editing")) {
    return "bg-surface-elevated hover:bg-surface-elevated";
  }

  if (rowStates.has("active")) {
    return "bg-workflow-active-bg hover:bg-workflow-active-bg";
  }

  if (rowStates.has("selected")) {
    return "bg-surface-selected hover:bg-surface-selected";
  }

  if (rowStates.has("processing")) {
    return "bg-status-processing-bg hover:bg-status-processing-bg";
  }

  if (rowStates.has("paused")) {
    return "bg-status-paused-bg hover:bg-status-paused-bg";
  }

  if (rowStates.has("synced")) {
    return "bg-status-synced-bg hover:bg-status-synced-bg";
  }

  return "bg-surface-card hover:bg-surface-hover";
}

function getRowAccentClassName(rowStates: Set<DataTableRowState>) {
  if (rowStates.has("editing")) {
    return "ring-2 ring-inset ring-border-focus";
  }

  if (rowStates.has("active")) {
    return "ring-2 ring-inset ring-workflow-active";
  }

  if (rowStates.has("selected")) {
    return "ring-2 ring-inset ring-border-focus";
  }

  return "";
}

function getLeadingCellAccentClassName(
  rowStates: Set<DataTableRowState>,
  isFirstVisibleColumn: boolean,
) {
  if (!isFirstVisibleColumn) {
    return "";
  }

  if (rowStates.has("editing")) {
    return "border-l-2 border-l-border-focus";
  }

  if (rowStates.has("active")) {
    return "border-l-2 border-l-workflow-active";
  }

  if (rowStates.has("processing")) {
    return "border-l-2 border-l-status-processing-border";
  }

  if (rowStates.has("paused")) {
    return "border-l-2 border-l-status-paused-border";
  }

  if (rowStates.has("synced")) {
    return "border-l-2 border-l-status-synced-border";
  }

  if (rowStates.has("selected")) {
    return "border-l-2 border-l-border-focus";
  }

  return "";
}

export function DataTable<TData extends RowData>({
  activeRowId,
  ariaLabel,
  bulkActions = [],
  caption,
  className,
  columns,
  enableColumnFilters = false,
  enableBulkSelection = false,
  enableGlobalSearch = false,
  data,
  emptyMessage = "No records match the current workflow filters.",
  emptyTitle = "No records available",
  enableStickyFirstColumn = true,
  enableSorting = false,
  enableVirtualization,
  getRowId,
  getRowState,
  getRowSelectionDisabled,
  manualFiltering = false,
  manualSorting = false,
  onColumnFiltersChange,
  onRowSelectionChange,
  onSearchChange,
  onSelectedRowIdsChange,
  onSortingChange,
  overscan = 8,
  renderEmptyState,
  renderToolbar,
  searchPlaceholder = "Search records",
  searchValue = "",
  selectedRowIds,
  selectedRowId,
  sorting,
  state,
  viewportClassName,
  viewportSize = "lg",
}: DataTableProps<TData>) {
  const [internalColumnFilters, setInternalColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([]);
  const [internalSelectedRowIds, setInternalSelectedRowIds] = React.useState<string[]>([]);
  const rowsForSelectionRef = React.useRef<Array<{ disabled: boolean; id: string }>>([]);
  const activeColumnFilters = state?.columnFilters ?? internalColumnFilters;
  const activeSorting = state?.sorting ?? sorting ?? internalSorting;
  const activeSelectedRowIds = selectedRowIds ?? internalSelectedRowIds;
  const hasFilterRow =
    enableColumnFilters &&
    columns.some((column) => column.meta?.filterVariant || column.meta?.filterOptions);

  const setSelectedRowIdsState = React.useCallback(
    (nextRowIds: string[]) => {
      const normalizedRowIds = Array.from(new Set(nextRowIds));
      setInternalSelectedRowIds(normalizedRowIds);
      onSelectedRowIdsChange?.(normalizedRowIds);
    },
    [onSelectedRowIdsChange],
  );

  const handleColumnFiltersChange = React.useCallback<OnChangeFn<ColumnFiltersState>>(
    (updater) => {
      const nextState = functionalUpdate(updater, activeColumnFilters);
      setInternalColumnFilters(nextState);
      onColumnFiltersChange?.(nextState);
    },
    [activeColumnFilters, onColumnFiltersChange],
  );

  const handleSortingChange = React.useCallback<OnChangeFn<SortingState>>(
    (updater) => {
      const nextState = functionalUpdate(updater, activeSorting).slice(0, 1);
      setInternalSorting(nextState);
      onSortingChange?.(nextState);
    },
    [activeSorting, onSortingChange],
  );

  const bulkActionsByShortcut = React.useMemo(() => {
    const shortcuts = new Map<string, DataTableBulkAction>();
    bulkActions.forEach((action) => {
      if (!action.shortcutKey) {
        return;
      }

      shortcuts.set(action.shortcutKey.toLowerCase(), action);
    });
    return shortcuts;
  }, [bulkActions]);

  const toolbar = renderToolbar ?? (
    enableGlobalSearch || onSearchChange ? (
      <DataTableToolbar
        onClear={
          onSearchChange || onColumnFiltersChange
            ? () => {
                setInternalColumnFilters([]);
                setInternalSorting([]);
                onColumnFiltersChange?.([]);
                onSortingChange?.([]);
                onSearchChange?.("");
              }
            : undefined
        }
        onSearchChange={onSearchChange}
        searchPlaceholder={searchPlaceholder}
        searchValue={searchValue}
      />
    ) : null
  );

  const selectionColumn = React.useMemo<ColumnDef<TData, unknown> | null>(() => {
    if (!enableBulkSelection) {
      return null;
    }

    return {
      id: "__select__",
      header: () => {
        const visibleSelectableRowIds = rowsForSelectionRef.current.filter((row) => !row.disabled).map((row) => row.id);
        const allVisibleSelected =
          visibleSelectableRowIds.length > 0 &&
          visibleSelectableRowIds.every((rowId) => activeSelectedRowIds.includes(rowId));
        const someVisibleSelected =
          visibleSelectableRowIds.some((rowId) => activeSelectedRowIds.includes(rowId)) &&
          !allVisibleSelected;

        return (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              aria-label="Select visible rows"
              checked={allVisibleSelected}
              ref={(node) => {
                if (node) {
                  node.indeterminate = someVisibleSelected;
                }
              }}
              onChange={(event) => {
                if (event.target.checked) {
                  setSelectedRowIdsState(visibleSelectableRowIds);
                  return;
                }

                setSelectedRowIdsState([]);
              }}
              className="h-4 w-4 rounded border-border-default bg-surface-panel text-action-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </div>
        );
      },
      cell: ({ row }) => {
        const disabled = Boolean(getRowSelectionDisabled?.(row.original, row.id));
        const checked = activeSelectedRowIds.includes(row.id);

        return (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              aria-label={`Select row ${row.id}`}
              checked={checked}
              disabled={disabled}
              onChange={(event) => {
                if (disabled) {
                  return;
                }

                if (event.target.checked) {
                  setSelectedRowIdsState([...activeSelectedRowIds, row.id]);
                  return;
                }

                setSelectedRowIdsState(activeSelectedRowIds.filter((selectedId) => selectedId !== row.id));
              }}
              className="h-4 w-4 rounded border-border-default bg-surface-panel text-action-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-not-allowed disabled:border-border-subtle disabled:text-text-disabled"
            />
          </div>
        );
      },
      enableSorting: false,
      meta: {
        align: "center",
        cellClassName: "w-10",
        headerClassName: "w-10",
      },
    };
  }, [
    activeSelectedRowIds,
    enableBulkSelection,
    getRowSelectionDisabled,
    setSelectedRowIdsState,
  ]);

  const tableColumns = React.useMemo(
    () => (selectionColumn ? [selectionColumn, ...columns] : columns),
    [columns, selectionColumn],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: tableColumns,
    enableMultiSort: false,
    enableSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: manualFiltering ? undefined : getFilteredRowModel(),
    getRowId,
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    manualFiltering,
    manualSorting,
    onColumnFiltersChange: handleColumnFiltersChange,
    onSortingChange: handleSortingChange,
    state: {
      columnFilters: activeColumnFilters,
      sorting: activeSorting,
    },
  });

  const scrollViewportRef = React.useRef<HTMLDivElement | null>(null);
  const keyboardScopeRef = React.useRef<HTMLDivElement | null>(null);
  const rowHeight = useDensityMetric("--density-row-height", 36);

  const rows = table.getRowModel().rows;
  rowsForSelectionRef.current = rows.map((row) => ({
    disabled: Boolean(getRowSelectionDisabled?.(row.original, row.id)),
    id: row.id,
  }));
  const columnCount = table.getVisibleLeafColumns().length;
  const shouldVirtualize = enableVirtualization ?? rows.length > 100;
  const selectedRowIdSet = React.useMemo(() => new Set(activeSelectedRowIds), [activeSelectedRowIds]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    enabled: shouldVirtualize,
    getScrollElement: () => scrollViewportRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  const virtualRows = shouldVirtualize ? rowVirtualizer.getVirtualItems() : [];
  const virtualizedRows = shouldVirtualize ? virtualRows.map((item) => rows[item.index]) : rows;
  const paddingTop = shouldVirtualize && virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom =
    shouldVirtualize && virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0;

  const handleToggleRowSelection = React.useCallback(
    (rowId: string) => {
      if (enableBulkSelection) {
        const row = rows.find((candidate) => candidate.id === rowId);
        if (!row || getRowSelectionDisabled?.(row.original, row.id)) {
          return;
        }

        if (selectedRowIdSet.has(rowId)) {
          setSelectedRowIdsState(activeSelectedRowIds.filter((selectedId) => selectedId !== rowId));
          return;
        }

        setSelectedRowIdsState([...activeSelectedRowIds, rowId]);
        return;
      }

      if (!onRowSelectionChange) {
        return;
      }
      onRowSelectionChange(selectedRowId === rowId ? null : rowId);
    },
    [
      activeSelectedRowIds,
      enableBulkSelection,
      getRowSelectionDisabled,
      onRowSelectionChange,
      rows,
      selectedRowId,
      selectedRowIdSet,
      setSelectedRowIdsState,
    ],
  );

  const { getCellProps } = useDataTableKeyboard({
    columnCount,
    rowCount: rows.length,
    scopeRef: keyboardScopeRef,
    onToggleRowSelection:
      enableBulkSelection || onRowSelectionChange ? handleToggleRowSelection : undefined,
    scrollToRowIndex: shouldVirtualize
      ? (rowIndex) => rowVirtualizer.scrollToIndex(rowIndex, { align: "auto" })
      : undefined,
  });

  const clearBulkSelection = React.useCallback(() => {
    setSelectedRowIdsState([]);
  }, [setSelectedRowIdsState]);

  const runBulkAction = React.useCallback(
    (action: DataTableBulkAction) => {
      if (action.disabled || action.isBusy || activeSelectedRowIds.length === 0) {
        return;
      }

      action.onAction(activeSelectedRowIds);
    },
    [activeSelectedRowIds],
  );

  const handleKeyboardBulkActions = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? "";
      const isEditableTarget =
        tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target?.isContentEditable;

      if (!isEditableTarget && enableBulkSelection && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        const selectableRowIds = rowsForSelectionRef.current
          .filter((row) => !row.disabled)
          .map((row) => row.id);
        setSelectedRowIdsState(selectableRowIds);
        return;
      }

      if (!isEditableTarget && event.key === "Escape" && activeSelectedRowIds.length > 0) {
        event.preventDefault();
        clearBulkSelection();
        return;
      }

      if (isEditableTarget || activeSelectedRowIds.length === 0 || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const action = bulkActionsByShortcut.get(event.key.toLowerCase());
      if (!action) {
        return;
      }

      event.preventDefault();
      runBulkAction(action);
    },
    [
      activeSelectedRowIds.length,
      bulkActionsByShortcut,
      clearBulkSelection,
      enableBulkSelection,
      runBulkAction,
      setSelectedRowIdsState,
    ],
  );

  const bulkToolbar =
    enableBulkSelection && activeSelectedRowIds.length > 0 ? (
      <DataTableBulkToolbar
        actions={bulkActions.map((action) => ({
          ...action,
          onAction: () => runBulkAction(action),
        }))}
        onClear={clearBulkSelection}
        selectedCount={activeSelectedRowIds.length}
      />
    ) : null;

  if (rows.length === 0) {
    return (
      <div className={className}>
        {renderEmptyState ?? (
          <EmptyState
            title={emptyTitle}
            description={emptyMessage}
            status="draft"
            statusLabel="No records"
          />
        )}
      </div>
    );
  }

  return (
    <div
      ref={keyboardScopeRef}
      onKeyDownCapture={handleKeyboardBulkActions}
      className={cn(
        "overflow-hidden rounded-panel border border-border-default bg-surface-panel text-text-primary shadow-xs",
        className,
      )}
    >
      {bulkToolbar}
      {toolbar}
      <ResponsiveScrollArea
        className="w-full"
        viewportClassName={cn(
          "max-w-full overflow-y-auto overscroll-contain",
          viewportSizeClassNames[viewportSize],
          viewportClassName,
        )}
        innerClassName="min-w-full"
        debugLabel="dpr-data-table"
        viewportRef={scrollViewportRef}
      >
        <table
          aria-label={ariaLabel}
          className="min-w-full border-separate border-spacing-0 text-table-density"
        >
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="sticky top-0 z-raised bg-surface-shell">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, columnIndex) => {
                  const meta = header.column.columnDef.meta;
                  const align = meta?.align ?? (columnIndex === 0 ? "left" : "left");
                  const isSticky =
                    meta?.sticky === "left" ||
                    (enableStickyFirstColumn &&
                      columnIndex === (enableBulkSelection ? 1 : 0));
                  const sortState = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      className={cn(
                        "ui-no-select ui-no-callout border-b border-border-default bg-surface-shell px-cell-x py-cell-y text-table-header font-semibold uppercase tracking-wide text-text-secondary",
                        alignmentClassNames[align],
                        isSticky ? "sticky left-0 z-sticky border-r border-border-subtle" : "",
                        meta?.headerClassName,
                      )}
                    >
                      {header.isPlaceholder ? null : (
                        <DataTableSortButton
                          active={
                            sortState === "asc"
                              ? "asc"
                              : sortState === "desc"
                                ? "desc"
                                : "none"
                          }
                          canSort={enableSorting && header.column.getCanSort()}
                          onClick={header.column.getToggleSortingHandler() as () => void}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </DataTableSortButton>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
            {hasFilterRow ? (
              <tr>
                {table.getVisibleLeafColumns().map((column, columnIndex) => {
                  const meta = column.columnDef.meta;
                  const align = meta?.align ?? "left";
                  const isSticky =
                    meta?.sticky === "left" ||
                    (enableStickyFirstColumn &&
                      columnIndex === (enableBulkSelection ? 1 : 0));

                  return (
                    <th
                      key={`${column.id}-filter`}
                      scope="col"
                      className={cn(
                        "border-b border-border-default bg-surface-shell px-cell-x py-cell-y",
                        alignmentClassNames[align],
                        isSticky ? "sticky left-0 z-sticky border-r border-border-subtle" : "",
                      )}
                    >
                      {meta?.filterVariant || meta?.filterOptions ? (
                        <DataTableFilterCell column={column} />
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            ) : null}
          </thead>
          <tbody>
            {paddingTop > 0 ? (
              <tr aria-hidden="true">
                <td colSpan={columnCount} style={{ height: `${paddingTop}px` }} />
              </tr>
            ) : null}
            {virtualizedRows.map((row, visibleRowIndex) => {
              const rowIndex = shouldVirtualize ? virtualRows[visibleRowIndex]?.index ?? visibleRowIndex : visibleRowIndex;
              const derivedStates = getRowState?.(row.original, row.id);
              const rowStates = normalizeRowStates([
                selectedRowId === row.id || selectedRowIdSet.has(row.id) ? "selected" : null,
                activeRowId === row.id ? "active" : null,
                ...(Array.isArray(derivedStates)
                  ? derivedStates
                  : derivedStates
                    ? [derivedStates]
                    : []),
              ]);
              const isSelected = rowStates.has("selected");
              const rowSurfaceClassName = getRowSurfaceClassName(rowStates);
              const rowAccentClassName = getRowAccentClassName(rowStates);

              return (
                <tr
                  key={row.id}
                  aria-selected={isSelected || undefined}
                  data-state={Array.from(rowStates).join(" ") || undefined}
                  className={cn(
                    "group border-b border-border-subtle transition-[background-color,box-shadow] duration-fast ease-standard",
                    rowSurfaceClassName,
                    rowAccentClassName,
                  )}
                >
                  {row.getVisibleCells().map((cell, columnIndex) => {
                    const meta = cell.column.columnDef.meta;
                    const align = meta?.align ?? "left";
                    const isSticky =
                      meta?.sticky === "left" ||
                      (enableStickyFirstColumn &&
                        columnIndex === (enableBulkSelection ? 1 : 0));
                    const isRowHeader =
                      meta?.isRowHeader ?? columnIndex === (enableBulkSelection ? 1 : 0);
                    const cellProps = getCellProps(rowIndex, columnIndex, row.id);
                    const commonClassName = cn(
                      "border-b border-border-subtle px-cell-x py-cell-y align-middle text-table-density text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus",
                      alignmentClassNames[align],
                      meta?.wrap ? "whitespace-normal" : "whitespace-nowrap",
                      getStickyCellClassName(isSticky, rowStates),
                      getLeadingCellAccentClassName(
                        rowStates,
                        columnIndex === (enableBulkSelection ? 1 : 0),
                      ),
                      rowStates.has("editing") ? "text-text-primary" : "",
                      meta?.cellClassName,
                    );

                    if (isRowHeader) {
                      return (
                        <th
                          key={cell.id}
                          scope="row"
                          data-col-index={columnIndex}
                          data-dpr-table-cell="true"
                          data-row-index={rowIndex}
                          className={cn(commonClassName, "font-medium")}
                          {...cellProps}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </th>
                      );
                    }

                    return (
                      <td
                        key={cell.id}
                        data-col-index={columnIndex}
                        data-dpr-table-cell="true"
                        data-row-index={rowIndex}
                        className={commonClassName}
                        {...cellProps}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {paddingBottom > 0 ? (
              <tr aria-hidden="true">
                <td colSpan={columnCount} style={{ height: `${paddingBottom}px` }} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </ResponsiveScrollArea>
    </div>
  );
}
