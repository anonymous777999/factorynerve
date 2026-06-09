"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { Badge, type BadgeStatus } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FOCUSABLE_SELECTOR =
  'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function getFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
  );
}

export type ConfirmationModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  status?: BadgeStatus;
  statusLabel?: string;
  meta?: React.ReactNode;
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  onConfirm?: () => void;
  confirmShortcutHint?: string;
  cancelShortcutHint?: string;
  confirmDisabled?: boolean;
  confirmBusy?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

export function ConfirmationModal({
  cancelShortcutHint = "Esc",
  children,
  className,
  confirmBusy = false,
  confirmDisabled = false,
  confirmShortcutHint = "Cmd/Ctrl+Enter",
  contentClassName,
  description,
  footer,
  initialFocusRef,
  meta,
  onConfirm,
  onOpenChange,
  open,
  primaryActionLabel = "Confirm",
  secondaryActionLabel = "Cancel",
  status,
  statusLabel,
  title,
}: ConfirmationModalProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const modalRef = React.useRef<HTMLDivElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const previousActiveElementRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableElements = getFocusableElements(modalRef.current);
    const cancelButton = focusableElements.find((element) => element.dataset.confirmationCancel === "true");
    const focusTarget =
      initialFocusRef?.current ??
      cancelButton ??
      focusableElements[0] ??
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

      if (event.key === "Enter" && (document.activeElement as HTMLElement | null)?.dataset.confirmationCancel === "true") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (!confirmDisabled && !confirmBusy) {
          onConfirm?.();
        }
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements(modalRef.current);
      if (focusableElements.length === 0) {
        event.preventDefault();
        modalRef.current?.focus();
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
  }, [confirmBusy, confirmDisabled, onConfirm, onOpenChange, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: "var(--z-modal)" }}>
      <div className="absolute inset-0 bg-command-bg" aria-hidden="true" />
      <div className="safe-top-inset safe-x-inset absolute inset-0 flex items-center justify-center px-md py-lg">
        <section
          ref={modalRef}
          className={cn(
            "flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-overlay border border-border-default bg-surface-overlay text-text-primary shadow-xl outline-none",
            className,
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
        >
          <header className="border-b border-border-subtle px-lg py-md">
            <div className="flex items-start justify-between gap-md">
              <div className="min-w-0 space-y-xs">
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
                size="compact"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Esc
              </Button>
            </div>
          </header>
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-lg py-md", contentClassName)}>
            {children}
          </div>
          <footer className="border-t border-border-subtle px-lg py-md">
            {footer ?? (
              <div className="flex flex-wrap items-center justify-between gap-md">
                <div className="text-label-dense text-text-secondary">
                  {confirmShortcutHint} confirms and {cancelShortcutHint ?? "Esc"} cancels.
                </div>
                <div className="flex flex-wrap items-center gap-sm">
                  <Button
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                    data-confirmation-cancel="true"
                  >
                    {secondaryActionLabel}
                  </Button>
                  <Button
                    onClick={onConfirm}
                    disabled={confirmDisabled}
                    isBusy={confirmBusy}
                    busyLabel={primaryActionLabel}
                    variant="destructive"
                  >
                    {primaryActionLabel}
                  </Button>
                </div>
              </div>
            )}
          </footer>
        </section>
      </div>
    </div>,
    document.body,
  );
}
