import { cx } from "../../../../lib/utils";
import type { PageNavigatorProps } from "../../../../types/datatable";
import { getInteractionAttributes, getInteractionClassName } from "../Interaction";
import { useOCRWorkspace } from "./hooks";

export function PageNavigator({ pages, className, ...props }: PageNavigatorProps) {
  const { activePageId, document, setActivePageId } = useOCRWorkspace();
  const source = pages ?? document.pages;

  return (
    <nav className={cx("flex items-center gap-[var(--spacing-1)] overflow-x-auto", className)} {...props}>
      {source.map((page) => {
        const selected = activePageId === page.id;
        const complete = typeof page.completeness === "number" ? Math.round(page.completeness * 100) : null;

        return (
          <button
            key={page.id}
            type="button"
            onClick={() => setActivePageId(page.id)}
            {...getInteractionAttributes({ hover: true, selected })}
            className={cx(
              "inline-flex h-8 shrink-0 items-center gap-[var(--spacing-2)] rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-surface-primary)] px-[var(--spacing-3)] text-[11px] text-[var(--color-text-tertiary)]",
              getInteractionClassName({ states: ["hover", "selected"], target: "button" })
            )}
          >
            <span className="font-[var(--font-mono)] text-[var(--color-text-secondary)]">{page.pageNumber}</span>
            {complete != null ? <span className="text-[var(--color-text-muted)]">{complete}%</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
