import { useId, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { cx } from "../../../../lib/utils";
import { getInteractionAttributes, getInteractionClassName } from "../Interaction";
import type { ToolbarSearchProps } from "./toolbar.types";
import { useControllableState } from "./hooks";

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <circle cx="5.75" cy="5.75" r="3.75" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8.75 8.75L11.25 11.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
      <path d="M8.5 2.5L2.5 8.5M2.5 2.5L8.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function ToolbarSearch({
  autoExpand = true,
  className,
  clearLabel = "Clear search",
  collapsedWidth = 208,
  defaultValue = "",
  disabled = false,
  expandedWidth = 320,
  inputClassName,
  inputId,
  name,
  onSubmit,
  onValueChange,
  placeholder = "Search records, IDs, or context",
  value,
  ...props
}: ToolbarSearchProps) {
  const generatedId = useId();
  const resolvedInputId = inputId ?? `fn-toolbar-search-${generatedId}`;
  const [searchValue, setSearchValue] = useControllableState({
    defaultValue,
    onChange: onValueChange,
    value,
  });
  const [focused, setFocused] = useState(false);
  const expanded = autoExpand && (focused || searchValue.length > 0);

  const widthStyle = useMemo(
    () => ({
      maxWidth: "min(360px, calc(100vw - (var(--spacing-4) * 2)))",
      width: expanded ? expandedWidth : collapsedWidth,
    }),
    [collapsedWidth, expanded, expandedWidth]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.(searchValue);
  };

  const interactionFlags = {
    aiActive: true,
    disabled,
    focus: focused,
    hover: !disabled,
    reviewed: searchValue.length > 0,
  } as const;

  return (
    <div className={cx("min-w-0 shrink-0", className)} style={widthStyle} {...props}>
      <form onSubmit={handleSubmit} className="w-full">
        <label htmlFor={resolvedInputId} className="sr-only">
          Search workspace records
        </label>
        <div
          {...getInteractionAttributes(interactionFlags)}
          className={cx(
            "flex h-8 min-w-0 items-center gap-[var(--spacing-2)] rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-[var(--spacing-2)] text-[var(--color-text-tertiary)] transition-[width,border-color,box-shadow] duration-[var(--transition-base)] ease-[var(--ease-smooth)]",
            getInteractionClassName({
              states: ["hover", "focus", "ai-active", "disabled", "reviewed"],
              target: "input",
              tone: "ai",
            }),
            disabled && "cursor-not-allowed opacity-60"
          )}
        >
          <span className="shrink-0 text-[var(--color-text-muted)]">
            <SearchIcon />
          </span>
          <input
            id={resolvedInputId}
            name={name}
            type="search"
            value={searchValue}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(event) => setSearchValue(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={cx(
              "h-full min-w-0 flex-1 bg-transparent text-[12px] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]",
              inputClassName
            )}
          />
          {searchValue ? (
            <button
              type="button"
              disabled={disabled}
              aria-label={clearLabel}
              onClick={() => setSearchValue("")}
              {...getInteractionAttributes({ disabled, hover: !disabled })}
              className={cx(
                "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] focus-visible:outline-none",
                getInteractionClassName({
                  states: ["hover", "disabled"],
                  target: "icon-button",
                })
              )}
            >
              <XIcon />
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
