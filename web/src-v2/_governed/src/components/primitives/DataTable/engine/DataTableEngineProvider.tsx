import { useCallback, useMemo, useRef, useState } from "react";
import type {
  DataTableColumnPin,
  DataTableEngineColumn,
  DataTableEngineProviderProps,
  DataTableEditingSession,
  DataTableEditingValue,
  DataTableSavedView,
  TableDensityMode,
  TableNavigationCell,
  TableNavigationContextValue,
  TableNavigationState,
} from "../../../../../types/datatable";
import { DataTableEngineContext } from "./DataTableEngineContext";
import { TableNavigationContext } from "./TableNavigationContext";
import { buildPinnedOffsets, clampValue } from "./engine.utils";
import { usePersistentEngineState } from "./hooks";

function createSavedViewId() {
  return `fn-view-${Math.random().toString(36).slice(2, 10)}`;
}

function getScopedKey(base: string | undefined, suffix: string) {
  return base ? `${base}.${suffix}` : undefined;
}

export function DataTableEngineProvider({
  children,
  columns,
  defaultActiveViewId = null,
  defaultDensity = "default",
  defaultExpandedRowIds = [],
  defaultHiddenColumnIds = [],
  defaultPinnedColumns = {},
  defaultPresets = {},
  defaultRowPinning = {},
  defaultSelectedRowIds = [],
  defaultSorting = [],
  defaultViews = [],
  defaultWidths = {},
  persistenceKey,
  rowIds = [],
}: DataTableEngineProviderProps) {
  const [density, setDensity] = usePersistentEngineState<TableDensityMode>(
    getScopedKey(persistenceKey, "density"),
    defaultDensity
  );
  const [hiddenColumnIds, setHiddenColumnIds] = usePersistentEngineState<string[]>(
    getScopedKey(persistenceKey, "hiddenColumns"),
    defaultHiddenColumnIds
  );
  const [widths, setWidths] = usePersistentEngineState<Record<string, number>>(
    getScopedKey(persistenceKey, "widths"),
    defaultWidths
  );
  const [pinning, setPinning] = usePersistentEngineState<Record<string, DataTableColumnPin>>(
    getScopedKey(persistenceKey, "pinning"),
    Object.fromEntries(columns.map((column) => [column.id, defaultPinnedColumns[column.id] ?? column.pinned ?? null]))
  );
  const [sorting, setSorting] = usePersistentEngineState<Array<{ desc: boolean; id: string }>>(
    getScopedKey(persistenceKey, "sorting"),
    defaultSorting
  );
  const [rowPinning, setRowPinning] = usePersistentEngineState<{ bottom: string[]; top: string[] }>(
    getScopedKey(persistenceKey, "rowPinning"),
    {
      bottom: defaultRowPinning.bottom ?? [],
      top: defaultRowPinning.top ?? [],
    }
  );
  const [savedViews, setSavedViews] = usePersistentEngineState<DataTableSavedView[]>(
    getScopedKey(persistenceKey, "savedViews"),
    defaultViews
  );
  const [activeViewId, setActiveViewId] = usePersistentEngineState<string | null>(
    getScopedKey(persistenceKey, "activeViewId"),
    defaultActiveViewId
  );
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set(defaultSelectedRowIds));
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(() => new Set(defaultExpandedRowIds));
  const [editingValues, setEditingValues] = useState<Record<string, DataTableEditingValue>>({});
  const [editingSession, setEditingSession] = useState<DataTableEditingSession | null>(null);
  const [navigationState, setNavigationState] = useState<TableNavigationState>({
    activeCellId: null,
    activeRowId: null,
    axis: "row",
  });
  const cellRegistryRef = useRef<Map<string, TableNavigationCell>>(new Map());

  const hiddenSet = useMemo(() => new Set(hiddenColumnIds), [hiddenColumnIds]);

  const normalizedColumns = useMemo<DataTableEngineColumn[]>(
    () =>
      columns.map((column) => ({
        ...column,
        pinned: pinning[column.id] ?? null,
        visible: column.visible ?? !hiddenSet.has(column.id),
      })),
    [columns, hiddenSet, pinning]
  );

  const pinnedOffsets = useMemo(
    () => buildPinnedOffsets(normalizedColumns, widths, hiddenSet),
    [hiddenSet, normalizedColumns, widths]
  );

  const registerCell = useCallback<TableNavigationContextValue["registerCell"]>((cell) => {
    cellRegistryRef.current.set(cell.cellId, cell);

    return () => {
      cellRegistryRef.current.delete(cell.cellId);
    };
  }, []);

  const focusCell = useCallback<TableNavigationContextValue["focusCell"]>((cellId) => {
    const cell = cellRegistryRef.current.get(cellId);

    setNavigationState({
      activeCellId: cellId,
      activeRowId: cell?.rowId ?? null,
      axis: "cell",
    });
  }, []);

  const focusRow = useCallback<TableNavigationContextValue["focusRow"]>((rowId) => {
    setNavigationState({
      activeCellId: null,
      activeRowId: rowId,
      axis: "row",
    });
  }, []);

  const getNextCellId = useCallback<TableNavigationContextValue["getNextCellId"]>((cellId, direction) => {
    const cells = Array.from(cellRegistryRef.current.values()).sort((left, right) => left.index - right.index);
    const currentIndex = cells.findIndex((cell) => cell.cellId === cellId);

    if (currentIndex === -1) {
      return null;
    }

    const current = cells[currentIndex];
    if (!current) {
      return null;
    }

    if (direction === "left" || direction === "right") {
      const rowCells = cells.filter((cell) => cell.rowId === current.rowId);
      const rowIndex = rowCells.findIndex((cell) => cell.cellId === cellId);
      const next = direction === "left" ? rowCells[rowIndex - 1] : rowCells[rowIndex + 1];
      return next?.cellId ?? null;
    }

    const sameColumnCells = cells.filter((cell) => cell.columnId === current.columnId);
    const columnIndex = sameColumnCells.findIndex((cell) => cell.cellId === cellId);
    const next = direction === "up" ? sameColumnCells[columnIndex - 1] : sameColumnCells[columnIndex + 1];
    return next?.cellId ?? null;
  }, []);

  const navigation = useMemo<TableNavigationContextValue>(
    () => ({
      activeCellId: navigationState.activeCellId,
      activeRowId: navigationState.activeRowId,
      axis: navigationState.axis,
      focusCell,
      focusRow,
      getNextCellId,
      registerCell,
    }),
    [focusCell, focusRow, getNextCellId, navigationState.activeCellId, navigationState.activeRowId, navigationState.axis, registerCell]
  );

  const setSelection = useCallback((updater: Set<string> | ((current: Set<string>) => Set<string>)) => {
    setSelectedRowIds((current) => {
      if (typeof updater === "function") {
        return updater(new Set(current));
      }

      return new Set(updater);
    });
  }, []);

  const setExpanded = useCallback((rowId: string, expanded: boolean) => {
    setExpandedRowIds((current) => {
      const next = new Set(current);
      if (expanded) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  }, []);

  const setColumnVisibility = useCallback((columnId: string, visible: boolean) => {
    setHiddenColumnIds((current) => {
      const next = new Set(current);
      if (visible) next.delete(columnId);
      else next.add(columnId);
      return Array.from(next);
    });
  }, [setHiddenColumnIds]);

  const updateColumnWidth = useCallback((columnId: string, width: number) => {
    const column = normalizedColumns.find((item) => item.id === columnId);
    const min = column?.minWidth ?? 72;
    const max = column?.maxWidth ?? 640;

    setWidths((current) => ({
      ...current,
      [columnId]: clampValue(width, min, max),
    }));
  }, [normalizedColumns, setWidths]);

  const setColumnPin = useCallback((columnId: string, pin: DataTableColumnPin) => {
    setPinning((current) => ({
      ...current,
      [columnId]: pin ?? null,
    }));
  }, [setPinning]);

  const setEditingValue = useCallback((cellId: string, value: DataTableEditingValue | null) => {
    setEditingValues((current) => {
      const next = { ...current };

      if (value == null) {
        delete next[cellId];
      } else {
        next[cellId] = value;
      }

      return next;
    });
  }, []);

  const clearEditingValue = useCallback((cellId: string) => {
    setEditingValue(cellId, null);
  }, [setEditingValue]);

  const pinRow = useCallback((rowId: string, position: "top" | "bottom" | null) => {
    setRowPinning((current) => {
      const next = {
        top: current.top.filter((id) => id !== rowId),
        bottom: current.bottom.filter((id) => id !== rowId),
      };

      if (position === "top") next.top.push(rowId);
      if (position === "bottom") next.bottom.push(rowId);

      return next;
    });
  }, [setRowPinning]);

  const saveView = useCallback((view: Omit<DataTableSavedView, "id"> & { id?: string }) => {
    const id = view.id ?? createSavedViewId();
    const nextView: DataTableSavedView = { ...view, id };

    setSavedViews((current) => {
      const existing = current.filter((item) => item.id !== id);
      return [...existing, nextView];
    });
    setActiveViewId(id);
    return id;
  }, [setActiveViewId, setSavedViews]);

  const applySavedView = useCallback((viewId: string) => {
    const view = savedViews.find((item) => item.id === viewId);
    if (!view) return;

    setActiveViewId(viewId);
    setDensity(view.density);
    setHiddenColumnIds(view.hiddenColumnIds);
    setPinning((current) => {
      const merged: Record<string, DataTableColumnPin> = { ...current };
      Object.entries(view.pinnedColumns ?? {}).forEach(([columnId, pin]) => {
        merged[columnId] = pin ?? null;
      });
      return merged;
    });
    setWidths((current) => ({ ...current, ...(view.widths ?? {}) }));
    setSorting(view.sorting ?? []);
    setRowPinning({
      top: view.rowPinning?.top ?? [],
      bottom: view.rowPinning?.bottom ?? [],
    });
  }, [savedViews, setActiveViewId, setDensity, setHiddenColumnIds, setPinning, setRowPinning, setSorting, setWidths]);

  const mergedSavedViews = useMemo(() => {
    const presetViews = Object.entries(defaultPresets).map(([presetId, preset]) => ({
      id: presetId,
      label: preset.label ?? presetId,
      density: preset.density ?? defaultDensity,
      hiddenColumnIds: preset.hiddenColumnIds ?? [],
      pinnedColumns: preset.pinnedColumns,
      rowPinning: preset.rowPinning,
      sorting: preset.sorting,
      widths: preset.widths,
    })) satisfies DataTableSavedView[];

    return [...presetViews, ...savedViews.filter((view) => !presetViews.some((preset) => preset.id === view.id))];
  }, [defaultDensity, defaultPresets, savedViews]);

  const contextValue = useMemo(
    () => ({
      activeViewId,
      applySavedView,
      clearEditingValue,
      columns: normalizedColumns,
      density,
      editingSession,
      editingValues,
      expandedRowIds,
      hiddenColumnIds: hiddenSet,
      navigation,
      pinRow,
      pinnedOffsets: {
        ...pinnedOffsets.left,
        ...Object.fromEntries(Object.entries(pinnedOffsets.right).map(([key, value]) => [`right:${key}`, value])),
      },
      rowIds,
      rowPinning,
      savedViews: mergedSavedViews,
      saveView,
      selectedRowIds,
      setColumnPin,
      setColumnVisibility,
      setDensity,
      setEditingSession,
      setEditingValue,
      setExpanded,
      setSelection,
      setSorting,
      sorting,
      updateColumnWidth,
      widths,
    }),
    [
      activeViewId,
      applySavedView,
      clearEditingValue,
      density,
      editingSession,
      editingValues,
      expandedRowIds,
      hiddenSet,
      mergedSavedViews,
      navigation,
      normalizedColumns,
      pinRow,
      pinnedOffsets.left,
      pinnedOffsets.right,
      rowIds,
      rowPinning,
      saveView,
      selectedRowIds,
      setColumnPin,
      setColumnVisibility,
      setEditingValue,
      setExpanded,
      setSelection,
      sorting,
      updateColumnWidth,
      widths,
    ]
  );

  return (
    <DataTableEngineContext.Provider value={contextValue}>
      <TableNavigationContext.Provider value={navigation}>{children}</TableNavigationContext.Provider>
    </DataTableEngineContext.Provider>
  );
}
