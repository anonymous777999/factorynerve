import type {
  DataTableColumnPin,
  DataTableEngineColumn,
  DataTableVirtualItem,
  TableDensityMode,
} from "../../../../../types/datatable";

export function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function mapDensityToRowHeight(density: TableDensityMode) {
  switch (density) {
    case "compact":
      return 32;
    case "comfortable":
      return 40;
    case "default":
    default:
      return 36;
  }
}

export function mapDensityToFoundationDensity(density: TableDensityMode) {
  switch (density) {
    case "comfortable":
      return "touch" as const;
    case "compact":
      return "compact" as const;
    case "default":
    default:
      return "default" as const;
  }
}

export function buildPinnedOffsets(
  columns: DataTableEngineColumn[],
  widths: Record<string, number>,
  hiddenColumnIds: Set<string>
) {
  const left: Record<string, number> = {};
  const right: Record<string, number> = {};
  let leftOffset = 0;
  let rightOffset = 0;

  for (const column of columns) {
    if (hiddenColumnIds.has(column.id) || column.pinned !== "left") {
      continue;
    }

    left[column.id] = leftOffset;
    leftOffset += widths[column.id] ?? column.width ?? column.minWidth ?? 160;
  }

  for (const column of [...columns].reverse()) {
    if (hiddenColumnIds.has(column.id) || column.pinned !== "right") {
      continue;
    }

    right[column.id] = rightOffset;
    rightOffset += widths[column.id] ?? column.width ?? column.minWidth ?? 160;
  }

  return { left, right };
}

export function resolvePinnedSide(
  columnId: string,
  columns: DataTableEngineColumn[],
  hiddenColumnIds: Set<string>
): DataTableColumnPin {
  const column = columns.find((item) => item.id === columnId);

  if (!column || hiddenColumnIds.has(columnId)) {
    return null;
  }

  return column.pinned ?? null;
}

export function buildVirtualItems(
  keys: string[],
  rowHeight: number,
  viewportHeight: number,
  scrollTop: number,
  overscan: number
) {
  const itemCount = keys.length;
  const totalSize = itemCount * rowHeight;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const end = Math.min(itemCount, start + visibleCount);
  const items: DataTableVirtualItem[] = [];

  for (let index = start; index < end; index += 1) {
    items.push({
      index,
      key: keys[index] ?? `${index}`,
      offset: index * rowHeight,
      size: rowHeight,
    });
  }

  return {
    items,
    totalSize,
  };
}
