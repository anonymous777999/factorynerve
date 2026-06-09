import { forwardRef } from "react";
import { cx } from "../../../../lib/utils";
import type { TagCellProps } from "./datatable.types";
import { DataTableCell } from "./DataTableCell";
import { DATA_TABLE_CELL_BADGE_CLASSNAME, DATA_TABLE_CELL_TONE_BADGE_CLASSNAME } from "./cell.tokens";

export const TagCell = forwardRef<HTMLTableCellElement, TagCellProps>(function TagCell(
  { tags, secondary, className, ...props },
  ref
) {
  return (
    <DataTableCell ref={ref} meta={secondary} stacked={Boolean(secondary)} className={className} {...props}>
      <div className="flex min-w-0 flex-wrap gap-[var(--spacing-1)]">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className={cx(
              DATA_TABLE_CELL_BADGE_CLASSNAME,
              DATA_TABLE_CELL_TONE_BADGE_CLASSNAME[tag.tone ?? "default"]
            )}
          >
            {tag.label}
          </span>
        ))}
      </div>
    </DataTableCell>
  );
});
