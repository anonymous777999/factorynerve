"use client";

import {
  useMemo,
  useCallback,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";

type ActiveCell = {
  rowIndex: number;
  columnIndex: number;
};

type UseDataTableKeyboardOptions = {
  columnCount: number;
  rowCount: number;
  scopeRef: RefObject<HTMLElement | null>;
  onToggleRowSelection?: (rowId: string) => void;
  scrollToRowIndex?: (rowIndex: number) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function useDataTableKeyboard({
  columnCount,
  rowCount,
  scopeRef,
  onToggleRowSelection,
  scrollToRowIndex,
}: UseDataTableKeyboardOptions) {
  const [activeCell, setActiveCell] = useState<ActiveCell>({
    rowIndex: 0,
    columnIndex: 0,
  });
  const normalizedActiveCell = useMemo(
    () =>
      rowCount > 0 && columnCount > 0
        ? {
            rowIndex: clamp(activeCell.rowIndex, 0, rowCount - 1),
            columnIndex: clamp(activeCell.columnIndex, 0, columnCount - 1),
          }
        : null,
    [activeCell.columnIndex, activeCell.rowIndex, columnCount, rowCount],
  );

  const focusCell = useCallback(
    (rowIndex: number, columnIndex: number) => {
      const scope = scopeRef.current;
      if (!scope) {
        return;
      }

      const nextCell = scope.querySelector<HTMLElement>(
        `[data-dpr-table-cell="true"][data-row-index="${rowIndex}"][data-col-index="${columnIndex}"]`,
      );

      if (nextCell) {
        nextCell.focus();
      }
    },
    [scopeRef],
  );

  const moveFocus = useCallback(
    (nextRowIndex: number, nextColumnIndex: number) => {
      if (rowCount === 0 || columnCount === 0) {
        return;
      }

      const rowIndex = clamp(nextRowIndex, 0, rowCount - 1);
      const columnIndex = clamp(nextColumnIndex, 0, columnCount - 1);

      scrollToRowIndex?.(rowIndex);
      setActiveCell({ rowIndex, columnIndex });

      requestAnimationFrame(() => {
        focusCell(rowIndex, columnIndex);
      });
    },
    [columnCount, focusCell, rowCount, scrollToRowIndex],
  );

  const getCellProps = useCallback(
    (rowIndex: number, columnIndex: number, rowId: string) => ({
      tabIndex:
        normalizedActiveCell &&
        normalizedActiveCell.rowIndex === rowIndex &&
        normalizedActiveCell.columnIndex === columnIndex
          ? 0
          : -1,
      onFocus: () => setActiveCell({ rowIndex, columnIndex }),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        switch (event.key) {
          case "ArrowUp":
            event.preventDefault();
            moveFocus(rowIndex - 1, columnIndex);
            break;
          case "ArrowDown":
            event.preventDefault();
            moveFocus(rowIndex + 1, columnIndex);
            break;
          case "ArrowLeft":
            event.preventDefault();
            moveFocus(rowIndex, columnIndex - 1);
            break;
          case "ArrowRight":
            event.preventDefault();
            moveFocus(rowIndex, columnIndex + 1);
            break;
          case "Home":
            event.preventDefault();
            moveFocus(rowIndex, 0);
            break;
          case "End":
            event.preventDefault();
            moveFocus(rowIndex, columnCount - 1);
            break;
          case " ":
            if (!onToggleRowSelection) {
              break;
            }
            event.preventDefault();
            onToggleRowSelection(rowId);
            break;
          default:
            break;
        }
      },
    }),
    [columnCount, moveFocus, normalizedActiveCell, onToggleRowSelection],
  );

  return {
    activeCell,
    getCellProps,
    setActiveCell,
  };
}
