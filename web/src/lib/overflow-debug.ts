type OverflowIssue = {
  path: string;
  className: string;
  route: string;
  component: string;
  debugLabel: string;
  scrollWidth: number;
  clientWidth: number;
  overflowDelta: number;
  rectLeft: number;
  rectRight: number;
};

function selectorForElement(element: Element) {
  const htmlElement = element as HTMLElement;
  const tag = element.tagName.toLowerCase();
  const id = htmlElement.id ? `#${htmlElement.id}` : "";
  const dataComponent = htmlElement.dataset.component ? `[data-component="${htmlElement.dataset.component}"]` : "";
  const className = typeof htmlElement.className === "string"
    ? htmlElement.className
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
        .map((token) => `.${token}`)
        .join("")
    : "";
  return `${tag}${id}${dataComponent}${className}`;
}

function domPath(element: Element) {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 8) {
    parts.unshift(selectorForElement(current));
    if ((current as HTMLElement).dataset.component) {
      break;
    }
    current = current.parentElement;
  }

  return parts.join(" > ");
}

function hasOffscreenFixedAncestor(element: HTMLElement, viewportWidth: number) {
  let current: HTMLElement | null = element;
  while (current) {
    const style = window.getComputedStyle(current);
    if (style.position === "fixed") {
      const rect = current.getBoundingClientRect();
      if (rect.right <= 0 || rect.left >= viewportWidth) {
        return true;
      }
    }
    current = current.parentElement;
  }
  return false;
}

export function collectOverflowIssues(route = typeof window !== "undefined" ? window.location.pathname : ""): OverflowIssue[] {
  if (typeof window === "undefined") return [];

  const viewportWidth = window.innerWidth;
  const issues = Array.from(document.querySelectorAll<HTMLElement>("body *"))
    .filter((element) => {
      if (!element.isConnected) return false;
      if (element.closest("[data-approved-horizontal-scroll='true']")) return false;
      if (element.closest("[data-overflow-debug-ignore='true']")) return false;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (element.clientWidth <= 0 && element.scrollWidth <= 0) return false;
      if (hasOffscreenFixedAncestor(element, viewportWidth)) return false;
      return true;
    })
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const scrollDelta = Math.max(0, element.scrollWidth - element.clientWidth);
      const rectOverflow = Math.max(0, rect.right - viewportWidth, -rect.left);
      const overflowDelta = Math.max(scrollDelta, Math.ceil(rectOverflow));
      const component =
        element.closest<HTMLElement>("[data-component]")?.dataset.component || "unknown";
      const debugLabel =
        element.closest<HTMLElement>("[data-scroll-debug-label]")?.dataset.scrollDebugLabel || "";
      return {
        path: domPath(element),
        className: typeof element.className === "string" ? element.className : "",
        route,
        component,
        debugLabel,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        overflowDelta,
        rectLeft: Math.round(rect.left),
        rectRight: Math.round(rect.right),
      };
    })
    .filter((issue) => issue.overflowDelta > 1);

  const deduped = new Map<string, OverflowIssue>();
  for (const issue of issues) {
    const key = `${issue.path}|${issue.overflowDelta}|${issue.rectRight}`;
    if (!deduped.has(key)) {
      deduped.set(key, issue);
    }
  }
  return Array.from(deduped.values());
}

export function logOverflowIssues(route?: string) {
  const issues = collectOverflowIssues(route);
  if (!issues.length) return issues;

  console.groupCollapsed(`[overflow-audit] ${issues.length} issue(s) on ${route || window.location.pathname}`);
  issues.forEach((issue) => {
    console.warn("Overflow issue", issue);
  });
  console.groupEnd();
  return issues;
}
