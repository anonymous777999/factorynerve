import { useEffect } from "react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(
  open: boolean,
  container: HTMLElement | null,
  onClose: () => void,
  returnFocusTo?: HTMLElement | null
) {
  useEffect(() => {
    if (!open || !container) {
      return;
    }

    const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (element) => !element.hasAttribute("aria-hidden")
    );

    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];
    (firstFocusable ?? container).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        returnFocusTo?.focus();
        return;
      }

      if (event.key !== "Tab" || focusable.length === 0) {
        return;
      }

      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (activeElement === firstFocusable || activeElement === container) {
          event.preventDefault();
          lastFocusable?.focus();
        }

        return;
      }

      if (activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable?.focus();
      }
    };

    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
    };
  }, [container, onClose, open, returnFocusTo]);
}
