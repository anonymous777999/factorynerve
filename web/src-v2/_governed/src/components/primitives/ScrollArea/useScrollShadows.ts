import { useEffect, useState } from "react";
import { useIsomorphicLayoutEffect } from "../shared/useIsomorphicLayoutEffect";

export interface ScrollShadowState {
  bottom: boolean;
  left: boolean;
  right: boolean;
  top: boolean;
}

const INITIAL_STATE: ScrollShadowState = {
  bottom: false,
  left: false,
  right: false,
  top: false,
};

export function useScrollShadows(viewport: HTMLDivElement | null, disabled = false) {
  const [state, setState] = useState<ScrollShadowState>(INITIAL_STATE);

  useIsomorphicLayoutEffect(() => {
    if (!viewport || disabled) {
      setState(INITIAL_STATE);
      return;
    }

    const updateState = () => {
      const nextState = {
        bottom: viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - 1,
        left: viewport.scrollLeft > 0,
        right: viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1,
        top: viewport.scrollTop > 0,
      };

      setState((current) =>
        current.top === nextState.top &&
        current.right === nextState.right &&
        current.bottom === nextState.bottom &&
        current.left === nextState.left
          ? current
          : nextState
      );
    };

    updateState();
    viewport.addEventListener("scroll", updateState, { passive: true });

    const resizeObserver = new ResizeObserver(updateState);
    resizeObserver.observe(viewport);

    Array.from(viewport.children).forEach((child) => resizeObserver.observe(child));

    return () => {
      viewport.removeEventListener("scroll", updateState);
      resizeObserver.disconnect();
    };
  }, [viewport, disabled]);

  useEffect(() => {
    if (!viewport || disabled) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      viewport.dispatchEvent(new Event("scroll"));
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [viewport, disabled]);

  return state;
}
