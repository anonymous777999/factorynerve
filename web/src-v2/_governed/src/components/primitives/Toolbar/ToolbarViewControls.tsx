import type { Ref } from "react";
import { cx } from "../../../../lib/utils";
import type { Density } from "../../../../types/datatable";
import { getInteractionAttributes } from "../Interaction";
import { Popover } from "../Popover";
import { Tooltip } from "../Tooltip";
import type { ToolbarViewControlsProps } from "./toolbar.types";
import { TOOLBAR_BUTTON_CLASSNAME } from "./toolbar.tokens";

const DENSITY_LABELS: Record<Density, string> = {
  compact: "Compact",
  default: "Default",
  touch: "Touch",
};

function DensityIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function ToolbarViewControls({
  children,
  className,
  density,
  densityLabel,
  densityOptions = ["compact", "default", "touch"],
  displayModes,
  onDensityChange,
  ...props
}: ToolbarViewControlsProps) {
  return (
    <div className={cx("flex min-w-0 items-center gap-[var(--spacing-1)]", className)} {...props}>
      {displayModes?.map((mode) => {
        const button = (
          <button
            key={mode.id}
            type="button"
            onClick={mode.onSelect}
            aria-pressed={mode.active}
            {...getInteractionAttributes({ hover: true, selected: mode.active })}
            className={cx(
              TOOLBAR_BUTTON_CLASSNAME,
              mode.active &&
                "border-[var(--color-accent-operational-border)] bg-[var(--color-accent-operational-surface)] text-[var(--color-accent-operational-muted)]"
            )}
          >
            {mode.icon ? <span aria-hidden="true" className="flex">{mode.icon}</span> : null}
            <span>{mode.label}</span>
          </button>
        );

        return mode.tooltip ? <Tooltip key={mode.id} content={mode.tooltip}>{button}</Tooltip> : button;
      })}

      {onDensityChange ? (
        <Popover
          placement="bottom-end"
          closeOnSelect
          trigger={({ ref, onClick, onKeyDown, ...triggerProps }) => (
            <button
              ref={ref as Ref<HTMLButtonElement>}
              type="button"
              onClick={onClick}
              onKeyDown={onKeyDown}
              {...getInteractionAttributes({ hover: true, selected: Boolean(density) })}
              className={TOOLBAR_BUTTON_CLASSNAME}
              {...triggerProps}
            >
              <DensityIcon />
              <span>{densityLabel ?? DENSITY_LABELS[density ?? "default"]}</span>
            </button>
          )}
        >
          {() => (
            <div className="flex min-w-[168px] flex-col gap-[var(--spacing-1)]">
              {densityOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onDensityChange(option)}
                  {...getInteractionAttributes({ hover: true, selected: option === density })}
                  className={cx(
                    "flex h-8 items-center justify-between rounded-[var(--radius-sm)] px-[var(--spacing-2)] text-left text-[12px] transition-colors duration-[var(--transition-fast)] ease-[var(--ease-operational)] hover:bg-[var(--color-surface-overlay)] focus-visible:outline-none",
                    option === density
                      ? "bg-[var(--color-accent-operational-surface)] text-[var(--color-accent-operational-muted)]"
                      : "text-[var(--color-text-secondary)]"
                  )}
                >
                  <span>{DENSITY_LABELS[option]}</span>
                  {option === density ? (
                    <span className="font-[var(--font-mono)] text-[11px] uppercase tracking-[0.04em]">Active</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </Popover>
      ) : null}

      {children}
    </div>
  );
}
