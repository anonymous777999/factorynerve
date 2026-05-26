import type { KeyboardNavigationSystemProps } from "../../../../../types/datatable";
import { useTableNavigation } from "./hooks";

export function KeyboardNavigationSystem({ children, onKeyDown, ...props }: KeyboardNavigationSystemProps) {
  const navigation = useTableNavigation();

  return (
    <div
      onKeyDown={(event) => {
        if (navigation.activeCellId) {
          let nextCellId: string | null = null;

          if (event.key === "ArrowUp") nextCellId = navigation.getNextCellId(navigation.activeCellId, "up");
          if (event.key === "ArrowDown") nextCellId = navigation.getNextCellId(navigation.activeCellId, "down");
          if (event.key === "ArrowLeft") nextCellId = navigation.getNextCellId(navigation.activeCellId, "left");
          if (event.key === "ArrowRight") nextCellId = navigation.getNextCellId(navigation.activeCellId, "right");

          if (nextCellId) {
            event.preventDefault();
            navigation.focusCell(nextCellId);
          }
        }

        onKeyDown?.(event);
      }}
      {...props}
    >
      {children}
    </div>
  );
}
