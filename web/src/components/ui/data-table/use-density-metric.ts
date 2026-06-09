"use client";

import { useEffect, useState } from "react";

function readCssPixelVariable(variableName: string, fallback: number) {
  if (typeof document === "undefined") {
    return fallback;
  }

  const value = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();

  const parsed = Number.parseFloat(value.replace("px", ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function useDensityMetric(variableName: string, fallback: number) {
  const [metric, setMetric] = useState(() => readCssPixelVariable(variableName, fallback));

  useEffect(() => {
    const updateMetric = () => setMetric(readCssPixelVariable(variableName, fallback));

    updateMetric();

    if (typeof document === "undefined") {
      return;
    }

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes" && record.attributeName === "data-density") {
          updateMetric();
          break;
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-density"],
    });

    return () => observer.disconnect();
  }, [fallback, variableName]);

  return metric;
}
