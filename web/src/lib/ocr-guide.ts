"use client";

import { useCallback, useEffect, useState } from "react";

export type OcrGuidePageKey = "ocr-home" | "ocr-scan" | "ocr-verify";

type StoredGuideState = {
  visitCount: number;
  manualExpanded: boolean | null;
};

const STORAGE_KEY_PREFIX = "dpr:ocr:guide:";
const AUTO_OPEN_VISITS = 2;

function storageKey(pageKey: OcrGuidePageKey) {
  return `${STORAGE_KEY_PREFIX}${pageKey}`;
}

function normalizeState(value: unknown): StoredGuideState {
  if (!value || typeof value !== "object") {
    return { visitCount: 0, manualExpanded: null };
  }

  const candidate = value as Partial<StoredGuideState>;
  return {
    visitCount:
      typeof candidate.visitCount === "number" && Number.isFinite(candidate.visitCount)
        ? Math.max(0, Math.floor(candidate.visitCount))
        : 0,
    manualExpanded:
      typeof candidate.manualExpanded === "boolean" ? candidate.manualExpanded : null,
  };
}

function readGuideState(pageKey: OcrGuidePageKey): StoredGuideState {
  if (typeof window === "undefined") {
    return { visitCount: 0, manualExpanded: null };
  }
  try {
    const raw = window.localStorage.getItem(storageKey(pageKey));
    if (!raw) {
      return { visitCount: 0, manualExpanded: null };
    }
    return normalizeState(JSON.parse(raw));
  } catch {
    return { visitCount: 0, manualExpanded: null };
  }
}

function writeGuideState(pageKey: OcrGuidePageKey, state: StoredGuideState) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(storageKey(pageKey), JSON.stringify(state));
}

export function useOcrGuide(pageKey: OcrGuidePageKey) {
  const [expanded, setExpanded] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const current = readGuideState(pageKey);
    const nextVisitCount = current.visitCount + 1;
    const nextExpanded =
      nextVisitCount <= AUTO_OPEN_VISITS ? true : current.manualExpanded ?? false;

    writeGuideState(pageKey, {
      visitCount: nextVisitCount,
      manualExpanded: current.manualExpanded,
    });
    const frame = window.requestAnimationFrame(() => {
      setExpanded(nextExpanded);
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pageKey]);

  const onExpandedChange = useCallback(
    (nextExpanded: boolean) => {
      setExpanded(nextExpanded);
      setReady(true);
      const current = readGuideState(pageKey);
      writeGuideState(pageKey, {
        visitCount: current.visitCount,
        manualExpanded:
          current.visitCount > AUTO_OPEN_VISITS ? nextExpanded : current.manualExpanded,
      });
    },
    [pageKey],
  );

  return {
    expanded,
    ready,
    onExpandedChange,
  };
}
