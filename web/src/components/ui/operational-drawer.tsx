"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { Badge, type BadgeStatus } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type OperationalDrawerSide = "right" | "left" | "bottom";
type OperationalDrawerSize = "default" | "wide";

type OperationalDrawerAction = {
  id: string;
  label: string;
  onAction?: () => void;
  variant?: React.ComponentProps<typeof Button>["variant"];
  disabled?: boolean;
  isBusy?: boolean;
  shortcutHint?: string;
};

export type OperationalDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  status?: BadgeStatus;
  statusLabel?: string;
  side?: OperationalDrawerSide;
  size?: OperationalDrawerSize;
  closeLabel?: string;
  meta?: React.ReactNode;
  footer?: React.ReactNode;
  primaryAction?: OperationalDrawerAction;
  secondaryAction?: OperationalDrawerAction;
  tertiaryAction?: OperationalDrawerAction;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

const FOCUSABLE_SELECTOR =
  'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

const sideClassNames: Record<OperationalDrawerSide, string> = {
  right: "right-0 top-0 h-full border-l border-border-default",
  left: "left-0 top-0 h-full border-r border-border-default",
  bottom: "bottom-0 left-0 w-full border-t border-border-default",
};

const sizeClassNames: Record<OperationalDrawerSize, Record<OperationalDrawerSide, string>> = {
  default: {
    right: "w-full md:w-3/4 xl:w-1/3",
    left: "w-full md:w-3/4 xl:w-1/3",
    bottom: "max-h-screen",
  },
  wide: {
    right: "w-full lg:w-3/4 xl:w-1/2",
    left: "w-full lg:w-3/4 xl:w-1/2",
    bottom: "max-h-screen",
  },
};

function getFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
  );
}

function OperationalDrawerActions({
  primaryAction,
  secondaryAction,
  tertiaryAction,
}: Pick<
  OperationalDrawerProps,
  "primaryAction" | "secondaryAction" | "tertiaryAction"
>) {
  const actions = [primaryAction, secondaryAction, tertiaryAction].filter(Boolean) as OperationalDrawerAction[];

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-start gap-sm">
      {actions.map((action, index) => (
        <Button
          key={action.id}
          size="compact"
          variant={action.variant ?? (index === 0 ? "primary" : "outline")}
          disabled={action.disabled}
          isBusy={action.isBusy}
          busyLabel={action.label}
          onClick={action.onAction}
        >
          {action.shortcutHint ? `${action.label} (${action.shortcutHint})` : action.label}
        </Button>
      ))}
    </div>
  );
}

export function OperationalDrawer({
  children,
  className,
  closeLabel = "Close panel",
  contentClassName,
  description,
  footer,
  initialFocusRef,
  meta,
  onOpenChange,
  open,
  primaryAction,
  secondaryAction,
  side = "right",
  size = "default",
  status,
  statusLabel,
  tertiaryAction,
  title,
}: OperationalDrawerProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const drawerRef = React.useRef<HTMLDivElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const previousActiveElementRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    previousActiveElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTarget =
      initialFocusRef?.current ??
      getFocusableElements(drawerRef.current)[0] ??
      closeButtonRef.current;

    focusTarget?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
      previousActiveElementRef.current?.focus();
    };
  }, [initialFocusRef, open]);

  React.useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements(drawerRef.current);
      if (focusableElements.length === 0) {
        event.preventDefault();
        drawerRef.current?.focus();
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

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-overlay" aria-hidden={open ? undefined : "true"}>
      <button
        type="button"
        className="absolute inset-0 bg-surface-overlay/80"
        onClick={() => onOpenChange(false)}
        aria-label={closeLabel}
      />
      <aside
        ref={drawerRef}
        className={cn(
          "safe-bottom-inset safe-top-inset safe-x-inset absolute flex flex-col overflow-hidden bg-surface-panel text-text-primary shadow-xl outline-none",
          "transition-[transform,opacity] duration-base ease-standard",
          sideClassNames[side],
          sizeClassNames[size][side],
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        data-side={side}
        data-size={size}
      >
        <header className="border-b border-border-subtle px-md py-md">
          <div className="flex items-start justify-between gap-md">
            <div className="min-w-0 space-y-sm">
              <div className="flex flex-wrap items-center gap-sm">
                {status && statusLabel ? <Badge status={status}>{statusLabel}</Badge> : null}
                <h2 id={titleId} className="text-panel-title font-semibold text-text-primary">
                  {title}
                </h2>
              </div>
              {description ? (
                <p id={descriptionId} className="text-body text-text-secondary">
                  {description}
                </p>
              ) : null}
              {meta ? <div className="text-label-dense text-text-secondary">{meta}</div> : null}
            </div>
            <Button
              ref={closeButtonRef}
              variant="ghost"
              size="compact"
              onClick={() => onOpenChange(false)}
              aria-label={closeLabel}
            >
              Close
            </Button>
          </div>
          <div className="mt-md">
            <OperationalDrawerActions
              primaryAction={primaryAction}
              secondaryAction={secondaryAction}
              tertiaryAction={tertiaryAction}
            />
          </div>
        </header>
        <div className={cn("min-h-0 flex-1 overflow-y-auto px-md py-md", contentClassName)}>
          {children}
        </div>
        {footer ? <footer className="border-t border-border-subtle px-md py-md">{footer}</footer> : null}
      </aside>
    </div>,
    document.body,
  );
}
