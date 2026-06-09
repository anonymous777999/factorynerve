"use client";

import type { OcrCell, OcrDebugPayload, OcrRoutingMeta, OcrScanQuality, OcrTokenUsage } from "@/lib/ocr";

const MAX_STORED_IMAGE_BYTES = 1_400_000;
const OCR_UI_STATE_STORAGE_KEY = "dpr:ocr-scan-ui-state:v2";
const MAX_STORED_STATE_BYTES = 550_000;

export type RawCell = OcrCell;

export type PersistedOcrUiState = {
  step: "entry" | "prepare" | "processing" | "result" | "upload" | "preview" | "export";
  fileName?: string;
  fileType?: string;
  imageDataUrl?: string | null;
  preparedImageDataUrl?: string | null;
  selectedFilter?: "original" | "clean" | "contrast";
  headers?: string[];
  rows?: RawCell[][];
  columnTypes?: Array<"text" | "number" | "date">;
  title?: string;
  resultType?: string;
  rawText?: string | null;
  language?: string | null;
  confidence?: number | null;
  warnings?: string[];
  scanQuality?: OcrScanQuality | null;
  routingMeta?: OcrRoutingMeta | null;
  tokenUsage?: OcrTokenUsage | null;
  debug?: OcrDebugPayload | null;
  documentHash?: string | null;
  savedId?: number | null;
  status?: string;
  selectedModel?: string | null;
  showLowConfidence?: boolean;
  headerRowEnabled?: boolean;
};

export function loadOcrUiState() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(OCR_UI_STATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as PersistedOcrUiState;
  } catch {
    return null;
  }
}

export function saveOcrUiState(value: PersistedOcrUiState) {
  if (typeof window === "undefined") {
    return;
  }

  const writeState = (state: PersistedOcrUiState) => {
    window.sessionStorage.setItem(OCR_UI_STATE_STORAGE_KEY, JSON.stringify(state));
  };

  try {
    writeState(value);
  } catch {
    const reduced: PersistedOcrUiState = {
      ...value,
      debug: null,
      imageDataUrl: null,
      preparedImageDataUrl: null,
      rawText: null,
      tokenUsage: null,
    };

    try {
      const serialized = JSON.stringify(reduced);
      if (serialized.length <= MAX_STORED_STATE_BYTES) {
        window.sessionStorage.setItem(OCR_UI_STATE_STORAGE_KEY, serialized);
      } else {
        clearOcrUiState();
      }
    } catch {
      clearOcrUiState();
    }
  }
}

export function clearOcrUiState() {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(OCR_UI_STATE_STORAGE_KEY);
}

export async function fileToDataUrl(file: File | null) {
  if (!file || file.size > MAX_STORED_IMAGE_BYTES) {
    return null;
  }

  return new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export async function dataUrlToFile(dataUrl: string, name: string, type: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], name, {
    type: type || blob.type || "image/jpeg",
    lastModified: Date.now(),
  });
}
