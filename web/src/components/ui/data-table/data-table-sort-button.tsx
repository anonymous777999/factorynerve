import * as React from "react";

import { cn } from "@/lib/utils";

type DataTableSortButtonProps = {
  active: "asc" | "desc" | "none";
  canSort: boolean;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
};

function getSortGlyph(active: DataTableSortButtonProps["active"]) {
  if (active === "asc") {
    return "\u2191";
  }

  if (active === "desc") {
    return "\u2193";
  }

  return "\u2195";
}

export function DataTableSortButton({
  active,
  canSort,
  children,
  className,
  onClick,
}: DataTableSortButtonProps) {
  if (!canSort) {
    return <span className={cn("inline-flex items-center gap-xs", className)}>{children}</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-xs rounded-control text-inherit transition-[background-color,color,box-shadow] duration-fast ease-standard hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-shell",
        className,
      )}
      aria-label={`Sort by ${typeof children === "string" ? children : "column"}`}
    >
      <span>{children}</span>
      <span
        aria-hidden="true"
        className={cn(
          "font-mono text-label-dense",
          active === "none" ? "text-text-tertiary" : "text-text-primary",
        )}
      >
        {getSortGlyph(active)}
      </span>
    </button>
  );
}
