import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type {
  FocusEventHandler,
  KeyboardEvent as ReactKeyboardEvent,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactElement,
  Ref,
} from "react";
import { createPortal } from "react-dom";
import type { TooltipProps } from "../../../../types/datatable";
import { cx } from "../../../../lib/utils";
import { usePortalContainer } from "../shared/usePortalContainer";
import { useTooltipPosition } from "./useTooltipPosition";

interface TooltipTriggerProps {
  "aria-describedby"?: string;
  onBlur?: FocusEventHandler<HTMLElement>;
  onFocus?: FocusEventHandler<HTMLElement>;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  onMouseEnter?: MouseEventHandler<HTMLElement>;
  onMouseLeave?: MouseEventHandler<HTMLElement>;
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

export function Tooltip({
  children,
  className,
  content,
  delay = 240,
  disabled = false,
  id,
  offset = 10,
  placement = "top",
}: TooltipProps) {
  const generatedId = useId();
  const tooltipId = id ?? `fn-tooltip-${generatedId}`;
  const portalContainer = usePortalContainer();
  const timerRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [contentNode, setContentNode] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const position = useTooltipPosition(open, triggerRef.current, contentNode, placement, offset);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const closeTooltip = () => {
    clearTimer();
    setOpen(false);
  };

  const scheduleOpen = () => {
    if (disabled || !content) {
      return;
    }

    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setOpen(true);
      timerRef.current = null;
    }, delay);
  };

  const child = Children.only(children);

  if (!isValidElement(child)) {
    return null;
  }

  const childElement = child as ReactElement<TooltipTriggerProps>;
  const trigger = cloneElement(childElement, {
    "aria-describedby": open ? tooltipId : undefined,
    onBlur: mergeHandlers(childElement.props.onBlur, closeTooltip),
    onFocus: mergeHandlers(childElement.props.onFocus, scheduleOpen),
    onKeyDown: mergeHandlers(childElement.props.onKeyDown, (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key === "Escape") {
        closeTooltip();
      }
    }),
    onMouseEnter: mergeHandlers(childElement.props.onMouseEnter, scheduleOpen),
    onMouseLeave: mergeHandlers(childElement.props.onMouseLeave, closeTooltip),
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;

      const childRef = childElement.props.ref;

      if (typeof childRef === "function") {
        childRef(node);
      } else if (childRef) {
        childRef.current = node;
      }
    },
  });

  return (
    <>
      {trigger}
      {open && portalContainer
        ? createPortal(
            <div
              id={tooltipId}
              ref={setContentNode}
              role="tooltip"
              className={cx(
                "pointer-events-none fixed z-[var(--z-overlay)] max-w-[280px] rounded-[var(--radius-sm)] border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] px-[var(--spacing-2)] py-[var(--spacing-1)] font-[var(--font-sans)] text-[11px] leading-[1.4] text-[var(--color-text-secondary)] shadow-[var(--shadow-md)]",
                className
              )}
              style={{
                left: position.left,
                top: position.top,
              }}
            >
              {content}
            </div>,
            portalContainer
          )
        : null}
    </>
  );
}
