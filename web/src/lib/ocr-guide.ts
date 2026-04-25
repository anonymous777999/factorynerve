"use client";

import { useCallback } from "react";

import { useGuidancePreferences } from "@/lib/guidance";

export type OcrGuidePageKey = "ocr-home" | "ocr-scan" | "ocr-verify";

const SURFACE_KEYS: Record<OcrGuidePageKey, string> = {
  "ocr-home": "ocr-home-guide",
  "ocr-scan": "ocr-scan-guide",
  "ocr-verify": "ocr-verify-guide",
};

export function useOcrGuide(pageKey: OcrGuidePageKey) {
  const { expanded, ready, setExpanded, visible } = useGuidancePreferences(SURFACE_KEYS[pageKey], {
    autoOpenVisits: 2,
  });

  const onExpandedChange = useCallback(
    (nextExpanded: boolean) => {
      setExpanded(nextExpanded);
    },
    [setExpanded],
  );

  return {
    expanded,
    ready,
    visible,
    onExpandedChange,
  };
}
