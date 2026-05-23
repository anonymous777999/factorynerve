"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type FieldValidationState } from "@/components/ui/field";

export type ComboboxOption = {
  value: string;
  label: string;
  keywords?: string[];
  meta?: string;
  disabled?: boolean;
};

export type ComboboxProps = {
  id?: string;
  value: string;
  options: ComboboxOption[];
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  validationState?: FieldValidationState;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  className?: string;
  inputClassName?: string;
  listboxClassName?: string;
};

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function getSearchText(option: ComboboxOption) {
  return normalizeText([option.label, option.meta, ...(option.keywords ?? [])].filter(Boolean).join(" "));
}

function getEnabledOptions(options: ComboboxOption[]) {
  return options.filter((option) => !option.disabled);
}

export const Combobox = React.forwardRef<HTMLInputElement, ComboboxProps>(function Combobox(
  {
    className,
    disabled = false,
    emptyMessage = "No matching options.",
    id,
    inputClassName,
    listboxClassName,
    onBlur,
    onValueChange,
    options,
    placeholder = "Search",
    validationState = "default",
    value,
    ...ariaProps
  },
  ref,
) {
  const listboxId = React.useId();
  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeOptionValue, setActiveOptionValue] = React.useState<string | null>(value || null);
  const blurTimeoutRef = React.useRef<number | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

  const resolvedQuery = open ? query : selectedOption?.label ?? "";
  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => getSearchText(option).includes(normalizedQuery));
  }, [options, query]);

  const enabledFilteredOptions = React.useMemo(
    () => getEnabledOptions(filteredOptions),
    [filteredOptions],
  );

  const activeOption = React.useMemo(() => {
    if (activeOptionValue) {
      const match = enabledFilteredOptions.find((option) => option.value === activeOptionValue);
      if (match) {
        return match;
      }
    }
    return enabledFilteredOptions[0] ?? null;
  }, [activeOptionValue, enabledFilteredOptions]);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveOptionValue(value || null);
    }
  }, [open, value]);

  React.useEffect(() => {
    if (!open || !activeOption) {
      return;
    }

    const optionNode = rootRef.current?.querySelector<HTMLElement>(
      `[data-combobox-option="${activeOption.value}"]`,
    );
    optionNode?.scrollIntoView({ block: "nearest" });
  }, [activeOption, open]);

  React.useEffect(() => {
    return () => {
      if (blurTimeoutRef.current != null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const commitValue = React.useCallback(
    (nextValue: string) => {
      onValueChange(nextValue);
      setActiveOptionValue(nextValue);
      setOpen(false);
      setQuery("");
    },
    [onValueChange],
  );

  const moveActiveOption = React.useCallback(
    (direction: 1 | -1) => {
      if (!enabledFilteredOptions.length) {
        return;
      }

      const currentIndex = activeOption
        ? enabledFilteredOptions.findIndex((option) => option.value === activeOption.value)
        : -1;
      const nextIndex =
        currentIndex === -1
          ? 0
          : (currentIndex + direction + enabledFilteredOptions.length) %
            enabledFilteredOptions.length;

      setActiveOptionValue(enabledFilteredOptions[nextIndex]?.value ?? null);
    },
    [activeOption, enabledFilteredOptions],
  );

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <Input
        {...ariaProps}
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        value={resolvedQuery}
        placeholder={placeholder}
        validationState={validationState}
        disabled={disabled}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={open && activeOption ? `${listboxId}-${activeOption.value}` : undefined}
        className={cn("pr-10", inputClassName)}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setActiveOptionValue(value || enabledFilteredOptions[0]?.value || null);
        }}
        onChange={(event) => {
          const nextQuery = event.target.value;
          setOpen(true);
          setQuery(nextQuery);
          setActiveOptionValue(
            getEnabledOptions(
              options.filter((option) =>
                getSearchText(option).includes(normalizeText(nextQuery)),
              ),
            )[0]?.value ?? null,
          );
        }}
        onBlur={() => {
          blurTimeoutRef.current = window.setTimeout(() => {
            setOpen(false);
            setQuery("");
            onBlur?.();
          }, 120);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              return;
            }
            moveActiveOption(1);
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              return;
            }
            moveActiveOption(-1);
            return;
          }

          if (event.key === "Enter" && open && activeOption) {
            event.preventDefault();
            commitValue(activeOption.value);
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            setQuery("");
            inputRef.current?.blur();
          }
        }}
      />
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-sm text-text-tertiary">
        <span aria-hidden="true" className="font-mono text-label-dense">
          v
        </span>
      </div>
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          className={cn(
            "absolute left-0 right-0 top-[calc(100%_+_var(--space-1))] z-overlay max-h-64 overflow-y-auto rounded-panel border border-border-default bg-surface-elevated shadow-md",
            listboxClassName,
          )}
        >
          {filteredOptions.length === 0 ? (
            <div className="px-md py-sm text-label-dense text-text-secondary">{emptyMessage}</div>
          ) : (
            filteredOptions.map((option) => {
              const isActive = option.value === activeOption?.value;
              const isSelected = option.value === value;

              return (
                <button
                  key={option.value}
                  id={`${listboxId}-${option.value}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-combobox-option={option.value}
                  disabled={option.disabled}
                  className={cn(
                    "flex w-full items-center justify-between gap-sm border-b border-border-subtle px-md py-sm text-left last:border-b-0",
                    isActive ? "bg-surface-selected" : "bg-transparent hover:bg-surface-hover",
                    option.disabled ? "cursor-not-allowed text-text-disabled" : "text-text-primary",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    if (blurTimeoutRef.current != null) {
                      window.clearTimeout(blurTimeoutRef.current);
                    }
                    commitValue(option.value);
                    onBlur?.();
                  }}
                  onMouseEnter={() => {
                    if (!option.disabled) {
                      setActiveOptionValue(option.value);
                    }
                  }}
                >
                  <span className="min-w-0 truncate text-body">{option.label}</span>
                  <div className="flex shrink-0 items-center gap-sm">
                    {option.meta ? (
                      <span className="font-mono text-label-dense text-text-tertiary">{option.meta}</span>
                    ) : null}
                    {isSelected ? (
                      <span className="font-mono text-label-dense text-text-secondary">Enter</span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
});
