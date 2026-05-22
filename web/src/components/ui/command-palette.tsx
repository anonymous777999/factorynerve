"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { Badge, type BadgeStatus } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type CommandPaletteItem = {
  id: string;
  group: string;
  label: string;
  description?: string;
  keywords?: string[];
  shortcut?: string;
  status?: BadgeStatus;
  meta?: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect?: () => void;
};

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandPaletteItem[];
  title?: string;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  enableGlobalShortcut?: boolean;
  closeLabel?: string;
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

type CommandPaletteGroup = {
  id: string;
  label: string;
  items: CommandPaletteItem[];
};

const OPTION_SELECTOR = '[data-command-option="true"]';
const FOCUSABLE_SELECTOR =
  'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"]',
    ),
  );
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function getCommandSearchText(item: CommandPaletteItem) {
  return normalizeText(
    [item.group, item.label, item.description, item.meta, ...(item.keywords ?? [])]
      .filter(Boolean)
      .join(" "),
  );
}

function getVisibleCommands(groups: CommandPaletteGroup[]) {
  return groups.flatMap((group) => group.items);
}

function getResolvedActiveCommand(
  activeCommandId: string | null,
  visibleCommands: CommandPaletteItem[],
) {
  if (activeCommandId) {
    const currentCommand = visibleCommands.find(
      (item) => item.id === activeCommandId && !item.disabled,
    );
    if (currentCommand) {
      return currentCommand;
    }
  }

  return visibleCommands.find((item) => !item.disabled) ?? null;
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
  );
}

function highlightMatch(text: string, query: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return text;
  }

  const matchIndex = text.toLowerCase().indexOf(normalizedQuery);
  if (matchIndex === -1) {
    return text;
  }

  const matchEnd = matchIndex + normalizedQuery.length;

  return (
    <>
      {text.slice(0, matchIndex)}
      <span className="text-command-match">{text.slice(matchIndex, matchEnd)}</span>
      {text.slice(matchEnd)}
    </>
  );
}

function CommandPaletteEmptyState({
  emptyMessage,
  emptyTitle,
}: Pick<CommandPaletteProps, "emptyMessage" | "emptyTitle">) {
  return (
    <div className="rounded-panel border border-border-subtle bg-surface-shell px-md py-md">
      <p className="text-label font-semibold text-text-primary">{emptyTitle}</p>
      {emptyMessage ? <p className="mt-xs text-label-dense text-text-secondary">{emptyMessage}</p> : null}
    </div>
  );
}

export function CommandPalette({
  enableGlobalShortcut = false,
  onOpenChange,
  open,
  ...props
}: CommandPaletteProps) {
  React.useEffect(() => {
    if (!enableGlobalShortcut || typeof window === "undefined") {
      return;
    }

    function handleWindowKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
        return;
      }

      if (open || isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        onOpenChange(true);
      }
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [enableGlobalShortcut, onOpenChange, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return (
    <CommandPaletteDialog
      {...props}
      onOpenChange={onOpenChange}
    />
  );
}

function CommandPaletteDialog({
  className,
  closeLabel = "Close command palette",
  contentClassName,
  emptyMessage = "Try a broader term or use the grouped shortcuts below to reach the next operational action.",
  emptyTitle = "No matching commands",
  footer,
  items,
  onOpenChange,
  searchPlaceholder = "Search commands, routes, and workflow actions",
  title = "Command Palette",
}: Omit<CommandPaletteProps, "open">) {
  const titleId = React.useId();
  const listboxId = React.useId();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const panelRef = React.useRef<HTMLElement | null>(null);
  const previousActiveElementRef = React.useRef<HTMLElement | null>(null);
  const [query, setQuery] = React.useState("");
  const [activeCommandId, setActiveCommandId] = React.useState<string | null>(null);
  const deferredQuery = React.useDeferredValue(query);

  const groupedCommands = React.useMemo(() => {
    const filteredItems = items.filter((item) => {
      if (!deferredQuery.trim()) {
        return true;
      }

      return getCommandSearchText(item).includes(normalizeText(deferredQuery));
    });

    const groups = new Map<string, CommandPaletteGroup>();

    filteredItems.forEach((item) => {
      const existingGroup = groups.get(item.group);
      if (existingGroup) {
        existingGroup.items.push(item);
        return;
      }

      groups.set(item.group, {
        id: item.group.toLowerCase().replace(/\s+/g, "-"),
        label: item.group,
        items: [item],
      });
    });

    return Array.from(groups.values());
  }, [deferredQuery, items]);

  const visibleCommands = React.useMemo(() => getVisibleCommands(groupedCommands), [groupedCommands]);
  const activeCommand = React.useMemo(
    () => getResolvedActiveCommand(activeCommandId, visibleCommands),
    [activeCommandId, visibleCommands],
  );

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    previousActiveElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
      previousActiveElementRef.current?.focus();
    };
  }, []);

  React.useEffect(() => {
    if (!activeCommand || typeof document === "undefined") {
      return;
    }

    const activeElement = document.querySelector<HTMLElement>(`${OPTION_SELECTOR}[data-command-id="${activeCommand.id}"]`);
    activeElement?.scrollIntoView({ block: "nearest" });
  }, [activeCommand]);

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements(panelRef.current);
      if (focusableElements.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
      const lastIndex = focusableElements.length - 1;

      if (event.shiftKey) {
        if (currentIndex <= 0) {
          event.preventDefault();
          focusableElements[lastIndex]?.focus();
        }
        return;
      }

      if (currentIndex === lastIndex) {
        event.preventDefault();
        focusableElements[0]?.focus();
      }
    }

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown);
  }, [onOpenChange]);

  const handleSelect = React.useCallback(
    (item: CommandPaletteItem) => {
      if (item.disabled) {
        return;
      }

      item.onSelect?.();
      onOpenChange(false);
    },
    [onOpenChange],
  );

  const moveActiveCommand = React.useCallback(
    (direction: 1 | -1) => {
      const enabledCommands = visibleCommands.filter((item) => !item.disabled);
      if (enabledCommands.length === 0) {
        return;
      }

      const currentIndex = activeCommand
        ? enabledCommands.findIndex((item) => item.id === activeCommand.id)
        : -1;
      const nextIndex =
        currentIndex === -1
          ? 0
          : (currentIndex + direction + enabledCommands.length) % enabledCommands.length;

      setActiveCommandId(enabledCommands[nextIndex]?.id ?? null);
    },
    [activeCommand, visibleCommands],
  );

  const handleInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveActiveCommand(1);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveActiveCommand(-1);
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        setActiveCommandId(visibleCommands.find((item) => !item.disabled)?.id ?? null);
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        const enabledCommands = visibleCommands.filter((item) => !item.disabled);
        setActiveCommandId(enabledCommands.at(-1)?.id ?? null);
        return;
      }

      if (event.key === "Enter" && activeCommand) {
        event.preventDefault();
        handleSelect(activeCommand);
      }
    },
    [activeCommand, handleSelect, moveActiveCommand, onOpenChange, visibleCommands],
  );

  return createPortal(
    <div className="fixed inset-0 z-command">
      <button
        type="button"
        className="absolute inset-0 bg-command-bg"
        onClick={() => onOpenChange(false)}
        aria-label={closeLabel}
      />
      <div className="safe-top-inset safe-x-inset absolute inset-x-0 top-0 flex justify-center px-md py-lg">
        <section
          ref={panelRef}
          className={cn(
            "flex max-h-screen w-full max-w-3xl flex-col overflow-hidden rounded-overlay border border-command-border bg-command-panel shadow-xl",
            className,
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
        >
          <header className="border-b border-border-subtle px-md py-md">
            <div className="flex items-start justify-between gap-md">
              <div className="min-w-0 space-y-xs">
                <h2 id={titleId} className="text-panel-title font-semibold text-text-primary">
                  {title}
                </h2>
                <p className="text-label-dense text-text-secondary">
                  Search commands, move with arrow keys, and press Enter to execute.
                </p>
              </div>
              <Button size="compact" variant="ghost" onClick={() => onOpenChange(false)}>
                Esc
              </Button>
            </div>
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-controls={listboxId}
              aria-activedescendant={activeCommand ? `command-option-${activeCommand.id}` : undefined}
              role="combobox"
              aria-expanded="true"
              aria-autocomplete="list"
              className="mt-md border-command-border bg-surface-elevated"
            />
          </header>
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-md py-md", contentClassName)}>
            {visibleCommands.length === 0 ? (
              <CommandPaletteEmptyState emptyMessage={emptyMessage} emptyTitle={emptyTitle} />
            ) : (
              <div id={listboxId} role="listbox" aria-label="Operational commands" className="space-y-md">
                {groupedCommands.map((group) => (
                  <section key={group.id} aria-labelledby={`command-group-${group.id}`} className="space-y-sm">
                    <div className="px-sm text-label-dense font-semibold uppercase tracking-wide text-text-tertiary">
                      <span id={`command-group-${group.id}`}>{group.label}</span>
                    </div>
                    <div className="space-y-xs">
                      {group.items.map((item) => {
                        const isActive = item.id === activeCommand?.id;

                        return (
                          <button
                            key={item.id}
                            id={`command-option-${item.id}`}
                            type="button"
                            data-command-option="true"
                            data-command-id={item.id}
                            role="option"
                            aria-selected={isActive}
                            disabled={item.disabled}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setActiveCommandId(item.id)}
                            className={cn(
                              "flex w-full items-start justify-between gap-md rounded-panel border px-md py-sm text-left transition-[background-color,border-color,color,box-shadow] duration-fast ease-standard",
                              isActive
                                ? "border-border-focus bg-command-selected shadow-xs"
                                : "border-transparent bg-transparent hover:border-border-subtle hover:bg-command-hover",
                              item.disabled ? "cursor-not-allowed opacity-60" : "focus-visible:ring-2 focus-visible:ring-border-focus",
                            )}
                          >
                            <div className="min-w-0 space-y-xs">
                              <div className="flex flex-wrap items-center gap-sm">
                                <span
                                  className={cn(
                                    "text-body font-medium",
                                    item.danger ? "text-command-danger" : "text-text-primary",
                                  )}
                                >
                                  {highlightMatch(item.label, deferredQuery)}
                                </span>
                                {item.status ? <Badge status={item.status}>{item.status}</Badge> : null}
                              </div>
                              {item.description ? (
                                <p className="text-label-dense text-text-secondary">
                                  {highlightMatch(item.description, deferredQuery)}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-sm">
                              {item.meta ? (
                                <span className="text-label-dense text-text-tertiary">{item.meta}</span>
                              ) : null}
                              {item.shortcut ? (
                                <kbd className="rounded-badge border border-border-subtle bg-surface-shell px-badge-x py-badge-y font-mono text-label-dense text-command-shortcut">
                                  {item.shortcut}
                                </kbd>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
          <footer className="border-t border-border-subtle px-md py-sm">
            {footer ?? (
              <div className="flex flex-wrap items-center justify-between gap-sm text-label-dense text-text-secondary">
                <span>`Cmd/Ctrl + K` opens the palette from anywhere in the app.</span>
                <span>`/` opens search when focus is not inside an input.</span>
              </div>
            )}
          </footer>
        </section>
      </div>
    </div>,
    document.body,
  );
}
