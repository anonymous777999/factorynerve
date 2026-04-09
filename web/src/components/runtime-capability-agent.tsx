"use client";

import { useEffect } from "react";

type RuntimeNavigator = Navigator & {
  deviceMemory?: number;
  hardwareConcurrency?: number;
};

function shouldUseSafeVisualMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const nav = navigator as RuntimeNavigator;
  const deviceMemory = nav.deviceMemory ?? 8;
  const hardwareConcurrency = nav.hardwareConcurrency ?? 8;
  const coarsePointer =
    window.matchMedia("(pointer: coarse)").matches || (nav.maxTouchPoints ?? 0) > 0;
  const compactViewport = window.innerWidth < 768;
  const isAndroid = /android/i.test(nav.userAgent);

  return (
    deviceMemory <= 4 ||
    hardwareConcurrency <= 4 ||
    (isAndroid && coarsePointer && compactViewport && (deviceMemory <= 6 || hardwareConcurrency <= 6))
  );
}

export function RuntimeCapabilityAgent() {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const mode = shouldUseSafeVisualMode() ? "safe" : "full";
    document.documentElement.dataset.runtimeTier = mode;
    document.body.dataset.runtimeTier = mode;

    return () => {
      delete document.documentElement.dataset.runtimeTier;
      delete document.body.dataset.runtimeTier;
    };
  }, []);

  return null;
}
