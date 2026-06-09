import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type {
  KeyboardEventHandler,
  MouseEventHandler,
  ReactElement,
  Ref,
} from "react";
import { createPortal } from "react-dom";
import { getInteractionAttributes, getInteractionClassName } from "../Interaction";
import type {
  PopoverProps,
  PopoverRenderProps,
  PopoverTriggerRenderProps,
} from "../../../../types/datatable";
import { cx } from "../../../../lib/utils";
import { usePortalContainer } from "../shared/usePortalContainer";
import { useFocusTrap } from "./useFocusTrap";
import { usePopoverPosition } from "./usePopoverPosition";

interface PopoverTriggerElementProps {
  "aria-controls"?: string;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: "dialog" | "menu" | "grid" | "listbox" | "tree";
  onClick?: MouseEventHandler<HTMLElement>;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  ref?: Ref<HTMLElement>;
}

function mergeHandlers<E>(
  original?: ((event: E) => void) | undefined,
  next?: ((event: E) => void) | undefined
) {
  return (event: E) => {
    original?.(event);
    next?.(event);
  };
}

export function Popover({
  children,
  className,
  closeOnSelect = false,
  contentClassName,
  defaultOpen = false,
  disabled = false,
  id,
  offset = 10,
  onOpenChange,
  open: controlledOpen,
  placement = "bottom-start",
  trigger,
}: PopoverProps) {
  const generatedId = useId();
  const contentId = id ?? `fn-popover-${generatedId}`;
  const portalContainer = usePortalContainer();
  const triggerRef = useRef<HTMLElement | null>(null);
  const [contentNode, setContentNode] = useState<HTMLDivElement | null>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const position = usePopoverPosition(open, triggerRef.current, contentNode, placement, offset);

  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  };

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useFocusTrap(open, contentNode, close, triggerRef.current);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (
        target &&
        !contentNode?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        close();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [contentNode, open]);

  const renderProps: PopoverRenderProps = { close, open };
  const triggerProps: PopoverTriggerRenderProps = {
    "aria-controls": contentId,
    "aria-expanded": open,
    "aria-haspopup": "dialog",
    onClick: () => {
      if (disabled) {
        return;
      }

      setOpen(!open);
    },
    onKeyDown: (event) => {
      if (disabled) {
        return;
      }

      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setOpen(true);
      }

      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    },
    ref: (node) => {
      triggerRef.current = node;
    },
  };

  const resolvedTrigger =
    typeof trigger === "function" ? (
      trigger(triggerProps)
    ) : isValidElement(trigger) ? (
      cloneElement(trigger as ReactElement<PopoverTriggerElementProps>, {
        "aria-controls": contentId,
        "aria-expanded": open,
        "aria-haspopup": "dialog",
        onClick: mergeHandlers(
          (trigger as ReactElement<PopoverTriggerElementProps>).props.onClick,
          triggerProps.onClick
        ),
        onKeyDown: mergeHandlers(
          (trigger as ReactElement<PopoverTriggerElementProps>).props.onKeyDown,
          triggerProps.onKeyDown
        ),
        ref: (node: HTMLElement | null) => {
          triggerRef.current = node;

          const triggerElementRef = (trigger as ReactElement<PopoverTriggerElementProps>).props.ref;

          if (typeof triggerElementRef === "function") {
            triggerElementRef(node);
          } else if (triggerElementRef) {
            triggerElementRef.current = node;
          }
        },
      })
    ) : (
      <button
        ref={triggerProps.ref as Ref<HTMLButtonElement>}
        type="button"
        aria-controls={contentId}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={triggerProps.onClick}
        onKeyDown={triggerProps.onKeyDown}
      >
        {trigger}
      </button>
    );

  return (
    <>
      {resolvedTrigger}
      {open && portalContainer
        ? createPortal(
            <div
              ref={setContentNode}
              id={contentId}
              role="dialog"
              aria-modal="false"
              tabIndex={-1}
              {...getInteractionAttributes({ active: open })}
              className={cx(
                "fixed z-[var(--z-dropdown)] min-w-[220px] max-w-[min(360px,calc(100vw-24px))] rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] p-[var(--spacing-2)] text-[var(--color-text-primary)] shadow-[var(--shadow-lg)] outline-none",
                getInteractionClassName({ states: ["active"], target: "popover" }),
                className
              )}
              style={{
                left: position.left,
                top: position.top,
              }}
              onClick={
                closeOnSelect
                  ? (event) => {
                      const target = event.target as HTMLElement | null;

                      if (
                        target?.closest(
                          'button, [role="menuitem"], [data-popover-close="true"], a[href]'
                        )
                      ) {
                        close();
                      }
                    }
                  : undefined
              }
            >
              <div className={cx("flex max-h-[min(480px,calc(100vh-24px))] min-h-0 flex-col overflow-auto overscroll-contain", contentClassName)}>
                {typeof children === "function" ? children(renderProps) : children}
              </div>
            </div>,
            portalContainer
          )
        : null}
    </>
  );
}
