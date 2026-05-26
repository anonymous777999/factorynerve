import type { Density, FooterProps, TableViewportProps } from "../../../types/datatable";
import { cx } from "../../../lib/utils";
import { getInteractionAttributes, getInteractionClassName } from "../primitives/Interaction";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeader,
  DataTableHeaderCell,
  DataTableRow,
} from "../primitives/DataTable";
import { PanelEmptyState } from "../primitives/Panel";
import { ScrollRegion } from "../primitives/Viewport";

function SkeletonRow({ columns = 6 }: { columns?: number }) {
  return (
    <DataTableRow loading interactive={false}>
      {Array.from({ length: columns }).map((_, index) => (
        <DataTableCell key={index} loading>
          <div className="relative h-[12px] overflow-hidden rounded-[2px] bg-[var(--color-surface-overlay)]">
            <div className="absolute inset-0 animate-[fn-shimmer_1200ms_linear_infinite] bg-[length:200%_100%] bg-gradient-to-r from-transparent via-[var(--color-surface-raised)] to-transparent" />
          </div>
        </DataTableCell>
      ))}
    </DataTableRow>
  );
}

export function TableLoadingState({
  rows = 8,
  columns = 6,
  density = "default",
}: {
  rows?: number;
  columns?: number;
  density?: Density;
}) {
  return (
    <DataTable density={density} aria-busy="true" aria-label="Loading data">
      <DataTableHeader>
        <DataTableRow interactive={false}>
          {Array.from({ length: columns }).map((_, index) => (
            <DataTableHeaderCell key={index}>Loading</DataTableHeaderCell>
          ))}
        </DataTableRow>
      </DataTableHeader>
      <DataTableBody>
        {Array.from({ length: rows }).map((_, index) => (
          <SkeletonRow key={index} columns={columns} />
        ))}
      </DataTableBody>
    </DataTable>
  );
}

export function TableEmptyState({
  title = "No records found",
  description = "No data matches your current filters. Try adjusting your search or filter criteria.",
  action,
}: {
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center">
      <PanelEmptyState
        title={title}
        description={description}
        action={
          action ? (
            <button
              type="button"
              onClick={action.onClick}
              {...getInteractionAttributes({ hover: true })}
              className={cx(
                "inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-surface-overlay)] px-[var(--spacing-3)] text-[12px] font-medium text-[var(--color-text-primary)]",
                getInteractionClassName({ states: ["hover"], target: "button" })
              )}
            >
              {action.label}
            </button>
          ) : undefined
        }
      />
    </div>
  );
}

export function TableViewport({
  children,
  isLoading,
  isEmpty,
  emptySlot,
  loadingSlot,
  density = "default",
  className,
}: TableViewportProps) {
  return (
    <ScrollRegion
      ownerId="table-viewport"
      data-density={density}
      orientation="both"
      className={cx("fn-dt-viewport min-h-0 min-w-0 flex-1 bg-[var(--table-bg)]", className)}
      viewportClassName="h-full"
      contentClassName="h-full"
    >
      {isLoading ? (
        loadingSlot ?? <div className="p-[var(--spacing-4)]"><TableLoadingState rows={6} density={density} /></div>
      ) : isEmpty ? (
        emptySlot ?? <TableEmptyState />
      ) : (
        children
      )}
    </ScrollRegion>
  );
}

export function TableFooter({ children, className }: FooterProps) {
  return (
    <div
      role="navigation"
      aria-label="Table pagination"
      className={cx(
        "sticky bottom-0 z-[var(--z-raised)] flex h-9 shrink-0 items-center border-t border-[var(--color-border-default)] bg-[var(--color-surface-primary)] px-[var(--spacing-4)]",
        className
      )}
    >
      {children}
    </div>
  );
}
