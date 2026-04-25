"use client";

import { useEffect } from "react";

import { recordRecentFeedbackAction } from "@/lib/feedback-context";

function compact(value: string | null | undefined, maxLength = 80) {
  const next = String(value || "").replace(/\s+/g, " ").trim();
  if (!next) return null;
  return next.slice(0, maxLength);
}

function describeElement(target: EventTarget | null) {
  const node = target instanceof Element ? target : null;
  if (!node) return null;
  if (node.closest("[data-feedback-ignore-action='true']")) {
    return null;
  }

  const actionable = node.closest(
    "[data-feedback-label],button,a,[role='button'],input[type='submit'],summary,label",
  );
  if (!actionable) return null;

  const explicit = actionable.getAttribute("data-feedback-label");
  const ariaLabel = actionable.getAttribute("aria-label");
  const title = actionable.getAttribute("title");
  const text = compact(actionable.textContent);
  const label = compact(explicit || ariaLabel || title || text);
  if (!label) return null;
  return label;
}

function describeForm(target: EventTarget | null) {
  const form = target instanceof HTMLFormElement ? target : null;
  if (!form || form.closest("[data-feedback-ignore-action='true']")) {
    return null;
  }

  const explicit = form.getAttribute("data-feedback-label") || form.getAttribute("aria-label");
  if (explicit) {
    return compact(explicit);
  }

  const submitter = form.querySelector(
    "button[type='submit'],input[type='submit']",
  ) as HTMLElement | null;
  return compact(submitter?.getAttribute("aria-label") || submitter?.textContent || "Submitted form");
}

export function FeedbackActivityTracker({ pathname }: { pathname: string }) {
  useEffect(() => {
    recordRecentFeedbackAction({
      kind: "navigation",
      label: `Opened ${pathname}`,
      route: pathname,
      timestamp: new Date().toISOString(),
    });
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const label = describeElement(event.target);
      if (!label) return;
      recordRecentFeedbackAction({
        kind: "click",
        label,
        route: window.location.pathname,
        timestamp: new Date().toISOString(),
      });
    };

    const onSubmit = (event: Event) => {
      const label = describeForm(event.target);
      if (!label) return;
      recordRecentFeedbackAction({
        kind: "submit",
        label,
        route: window.location.pathname,
        timestamp: new Date().toISOString(),
      });
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return null;
}
