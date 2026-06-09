import { useEffect, useState } from "react";

const DEFAULT_PORTAL_ID = "factorynerve-operational-layer";

export function usePortalContainer(id = DEFAULT_PORTAL_ID) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const existing = document.getElementById(id);

    if (existing) {
      setContainer(existing);
      return;
    }

    const element = document.createElement("div");
    element.id = id;
    element.setAttribute("data-fn-layer", "portal");
    element.style.position = "relative";
    element.style.zIndex = "var(--z-top)";
    document.body.appendChild(element);
    setContainer(element);

    return () => {
      if (element.childElementCount === 0) {
        element.remove();
      }
    };
  }, [id]);

  return container;
}
