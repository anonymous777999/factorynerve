// components/ui/data-table-header.tsx
// Professional table header with sorting and filtering hints

import React from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

interface DataTableHeaderProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
    sortable?: boolean;
    sortDirection?: "asc" | "desc" | null;
    onSort?: () => void;
}

export const DataTableHeader = React.forwardRef<HTMLTableCellElement, DataTableHeaderProps>(
    ({ className = "", sortable, sortDirection, onSort, children, ...props }, ref) => (
        <th
            ref={ref}
            className={`px-4 py-3 text-left text-xs font-semibold text-text-secondary bg-surface-shell border-b border-border-subtle ${sortable ? "cursor-pointer hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent" : ""
                } ${className}`}
            onClick={sortable ? onSort : undefined}
            onKeyDown={
                sortable
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSort?.();
                        }
                    }
                    : undefined
            }
            tabIndex={sortable ? 0 : undefined}
            role={sortable ? "button" : undefined}
            aria-sort={
                sortable
                    ? sortDirection === "asc"
                        ? "ascending"
                        : sortDirection === "desc"
                            ? "descending"
                            : "none"
                    : undefined
            }
            {...props}
        >
            <div className="flex items-center gap-2">
                <span>{children}</span>
                {sortable && (
                    <span className="text-text-tertiary">
                        {sortDirection === "asc" && <ArrowUp size={14} />}
                        {sortDirection === "desc" && <ArrowDown size={14} />}
                        {!sortDirection && <ArrowUpDown size={14} className="opacity-50" />}
                    </span>
                )}
            </div>
        </th>
    )
);

DataTableHeader.displayName = "DataTableHeader";

// Professional table row with proper spacing and hover effect
interface DataTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
    isSelected?: boolean;
}

export const DataTableRow = React.forwardRef<HTMLTableRowElement, DataTableRowProps>(
    ({ className = "", isSelected, ...props }, ref) => (
        <tr
            ref={ref}
            className={`border-b border-border-subtle hover:bg-surface-hover transition-colors ${isSelected ? "bg-surface-selected" : "bg-surface-card"
                } ${className}`}
            {...props}
        />
    )
);

DataTableRow.displayName = "DataTableRow";

// Professional table cell
interface DataTableCellProps extends React.TdHTMLAttributes<HTMLTableDataCellElement> {
    isNumeric?: boolean;
}

export const DataTableCell = React.forwardRef<HTMLTableDataCellElement, DataTableCellProps>(
    ({ className = "", isNumeric, ...props }, ref) => (
        <td
            ref={ref}
            className={`px-4 py-3 text-sm text-text-primary ${isNumeric ? "text-right font-mono" : ""} ${className}`}
            {...props}
        />
    )
);

DataTableCell.displayName = "DataTableCell";
