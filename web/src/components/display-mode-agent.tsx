"use client";

import { useEffect } from "react";

import { useDisplayMode } from "@/lib/use-display-mode";

export function DisplayModeAgent() {
  const { standalone } = useDisplayMode();

  useEffect(() => {
    if (typeof document === "undefined") return;

    const mode = standalone ? "standalone" : "browser";
    document.documentElement.dataset.displayMode = mode;
    document.body.dataset.displayMode = mode;

    return () => {
      delete document.documentElement.dataset.displayMode;
      delete document.body.dataset.displayMode;
    };
  }, [standalone]);

  return null;
}
