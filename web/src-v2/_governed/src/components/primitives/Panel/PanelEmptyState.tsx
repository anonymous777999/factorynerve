import { cx } from "../../../../lib/utils";
import type { PanelEmptyStateProps } from "./panel.types";

function InboxIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect x="4" y="8" width="28" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 22h8l3 4h6l3-4h8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 16h12M12 12h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function PanelEmptyState({
  title,
  description,
  action,
  className,
  ...props
}: PanelEmptyStateProps) {
  return (
    <div
      className={cx(
        "flex min-h-[240px] flex-col items-center justify-center gap-[var(--spacing-3)] px-[var(--spacing-8)] py-[var(--spacing-16)] text-center",
        className
      )}
      {...props}
    >
      <div className="text-[var(--color-text-muted)] opacity-50">
        <InboxIcon />
      </div>
      <div className="flex max-w-[360px] flex-col gap-[var(--spacing-1)]">
        <div className="text-[14px] font-medium text-[var(--color-text-secondary)]">{title}</div>
        {description ? <div className="text-[12px] leading-[1.5] text-[var(--color-text-muted)]">{description}</div> : null}
      </div>
      {action}
    </div>
  );
}
