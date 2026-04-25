"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { OcrGuideCard } from "@/components/ocr-guide-card";
import { OcrResultsGrid } from "@/components/ocr-scan/ocr-results-grid";
import { OcrRoutingBadge } from "@/components/ocr-scan/ocr-routing-badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatApiErrorMessage } from "@/lib/api";
import { transferBlob } from "@/lib/blob-transfer";
import { prepareOcrUploadFile } from "@/lib/file-prep";
import { createImageEnhancer } from "@/lib/image-enhance-client";
import { defaultEnhanceSettings, type CropBox, type EnhanceSettings } from "@/lib/image-enhance";
import { canUseOcrScan, validateOcrImageFile } from "@/lib/ocr-access";
import {
  createOcrVerification,
  downloadOcrVerificationExport,
  previewOcrLogbook,
  updateOcrVerification,
  warpOcrImage,
  type OcrPreviewResult,
  type OcrRoutingMeta,
} from "@/lib/ocr";
import { buildStructuredPdfBlob, exportRowsToCsv, exportRowsToMarkdown } from "@/lib/ocr-export";
import { useSession } from "@/lib/use-session";
import { signalWorkflowRefresh } from "@/lib/workflow-sync";
import { cn } from "@/lib/utils";

type ScanScreen = "camera" | "crop" | "enhance" | "output" | "processing" | "result";
type FilterPreset = "original" | "clean" | "contrast";
type OutputChoice = "excel" | "pdf" | "csv";
type ProcessingStage = "analyzing" | "extracting" | "formatting";
type CropPoint = { x: number; y: number };
type ResultPreview = {
  type: string;
  title: string;
  headers: string[];
  rows: string[][];
  columns: number;
  language: string;
  avgConfidence: number | null;
  rawColumnAdded: boolean;
  rawText?: string | null;
  routing?: OcrRoutingMeta | null;
  reused?: boolean;
  warnings?: string[];
};

const OUTPUT_FILE_NAME = "factory-scan";
const FULL_CROP: CropBox = { left: 0, top: 0, right: 1, bottom: 1 };
const DEFAULT_CROP_POINTS: CropPoint[] = [
  { x: 0.14, y: 0.16 },
  { x: 0.86, y: 0.14 },
  { x: 0.84, y: 0.86 },
  { x: 0.16, y: 0.88 },
];
const PROCESSING_STAGE_COPY: Record<ProcessingStage, { label: string; detail: string; progress: number }> = {
  analyzing: {
    label: "Analyzing image",
    detail: "Checking layout, sharpness, and document boundaries before extraction.",
    progress: 32,
  },
  extracting: {
    label: "Extracting data",
    detail: "Reading rows, rebuilding structure, and preparing review-ready values.",
    progress: 68,
  },
  formatting: {
    label: "Formatting output",
    detail: "Saving the draft and preparing exports for Excel or PDF.",
    progress: 96,
  },
};
const FILTER_OPTIONS: Array<{ value: FilterPreset; label: string; detail: string }> = [
  { value: "original", label: "Original", detail: "Keep the raw capture for manual review or lightly marked pages." },
  { value: "clean", label: "Clean", detail: "Best default for paper registers, moderate shadows, and standard handwriting." },
  { value: "contrast", label: "Contrast", detail: "Pushes row separation harder for faded ink, glare, or low-contrast pages." },
];

function buildEnhancedFile(blob: Blob, originalName: string) {
  const base = originalName.replace(/\.[^.]+$/, "");
  const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
  return new File([blob], `${base || OUTPUT_FILE_NAME}-enhanced.${ext}`, { type: blob.type });
}

function buildWarpedFile(blob: Blob, originalName: string) {
  const base = originalName.replace(/\.[^.]+$/, "");
  return new File([blob], `${base || OUTPUT_FILE_NAME}-warped.png`, { type: blob.type || "image/png" });
}

function fileBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || OUTPUT_FILE_NAME;
}

function defaultCropPoints() {
  return DEFAULT_CROP_POINTS.map((point) => ({ ...point }));
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function sortPoints(points: CropPoint[]) {
  return points.map((point) => ({ ...point }));
}

function cropBounds(points: CropPoint[]): CropBox {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    left: clamp01(Math.min(...xs)),
    top: clamp01(Math.min(...ys)),
    right: clamp01(Math.max(...xs)),
    bottom: clamp01(Math.max(...ys)),
  };
}

function toWarpCorners(points: CropPoint[], naturalWidth: number, naturalHeight: number) {
  return points.map((point) => [
    Math.round(clamp01(point.x) * naturalWidth),
    Math.round(clamp01(point.y) * naturalHeight),
  ]);
}

function buildEnhanceSettings(preset: FilterPreset, crop: CropBox): EnhanceSettings {
  const base = defaultEnhanceSettings();
  if (preset === "original") {
    return {
      ...base,
      autoFix: false,
      brightness: 0,
      contrast: 0,
      grayscale: false,
      threshold: false,
      crop,
    };
  }
  if (preset === "contrast") {
    return {
      ...base,
      autoFix: false,
      brightness: 12,
      contrast: 34,
      grayscale: true,
      threshold: true,
      crop,
    };
  }
  return {
    ...base,
    autoFix: true,
    brightness: 10,
    contrast: 18,
    grayscale: true,
    threshold: false,
    crop,
  };
}

function humanExtractError(error: unknown) {
  const message = formatApiErrorMessage(error, "Could not process this scan.");
  const lowered = message.toLowerCase();
  if (lowered.includes("timed out")) return "Processing took too long. Try another capture.";
  if (lowered.includes("no text")) return "The document was unclear. Try with better lighting.";
  if (lowered.includes("too large") || lowered.includes("8 mb") || lowered.includes("8mb")) {
    return "The image is too large. Keep it under 8 MB.";
  }
  return "The scan was not clear enough. Try again or retake it.";
}

function humanExportError(error: unknown) {
  const message = formatApiErrorMessage(error, "Could not prepare corrected Excel.");
  const lowered = message.toLowerCase();
  if (lowered.includes("api key") || lowered.includes("authentication")) {
    return "Excel export is unavailable right now.";
  }
  if (lowered.includes("timed out")) return "Excel export is delayed. Try again in a moment.";
  return "Corrected Excel could not be prepared.";
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

function hintsFromWarnings(warnings: string[] | undefined) {
  const hints: string[] = [];
  for (const warning of warnings || []) {
    if (warning === "blur_detected") hints.push("Low sharpness");
    if (warning === "low_light") hints.push("Low light");
    if (warning === "glare") hints.push("Glare detected");
  }
  return hints;
}

function summarizeCrop(points: CropPoint[]) {
  const bounds = cropBounds(points);
  return {
    coverage: Math.max(0, Math.min(100, Math.round((bounds.right - bounds.left) * (bounds.bottom - bounds.top) * 100))),
    width: Math.round((bounds.right - bounds.left) * 100),
    height: Math.round((bounds.bottom - bounds.top) * 100),
  };
}

function formatConfidence(value: number | null) {
  if (value == null || Number.isNaN(value)) return "Not available";
  return `${Math.round(value)}%`;
}

function GalleryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
      <rect x="3.5" y="5" width="17" height="14" rx="3" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m7.5 16 3.2-3.1 2.7 2.2 2.8-2.9 2.3 3.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FlashIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
      <path d="M13 2 6.5 12h4l-.5 10L17.5 12h-4L13 2Z" strokeLinejoin="round" />
    </svg>
  );
}

function ExcelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
      <path d="M7 3.8h8l4 4v12.4H7z" strokeLinejoin="round" />
      <path d="M15 3.8v4h4M10 10.2l4 5.6M14 10.2 10 15.8" strokeLinecap="round" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
      <path d="M7 3.8h8l4 4v12.4H7z" strokeLinejoin="round" />
      <path d="M15 3.8v4h4M9.4 16v-4.8h1.4c.9 0 1.5.5 1.5 1.3 0 .9-.6 1.4-1.5 1.4H9.4M14.2 16v-4.8h1.4c1.2 0 2 .9 2 2.4 0 1.5-.8 2.4-2 2.4h-1.4Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-8 w-8">
      <path d="m5 12.5 4.2 4.2L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 animate-spin text-cyan-300">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function OcrScanPage() {
  const { user, loading, error: sessionError } = useSession();

  const [screen, setScreen] = useState<ScanScreen>("camera");
  const [selectedFilter, setSelectedFilter] = useState<FilterPreset>("clean");
  const [outputChoice, setOutputChoice] = useState<OutputChoice>("excel");
  const [processingStage, setProcessingStage] = useState<ProcessingStage>("analyzing");
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [busyCrop, setBusyCrop] = useState(false);
  const [busyEnhance, setBusyEnhance] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [docTypeHint, setDocTypeHint] = useState("logbook");
  const [languageHint, setLanguageHint] = useState("auto");
  const [forceModel, setForceModel] = useState<"auto" | "fast" | "balanced" | "best">("auto");

  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [perspectiveFile, setPerspectiveFile] = useState<File | null>(null);
  const [perspectiveUrl, setPerspectiveUrl] = useState("");
  const [enhancedFile, setEnhancedFile] = useState<File | null>(null);
  const [enhancedUrl, setEnhancedUrl] = useState("");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  const [qualityHints, setQualityHints] = useState<string[]>([]);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [resultPreview, setResultPreview] = useState<ResultPreview | null>(null);
  const [editableHeaders, setEditableHeaders] = useState<string[]>([]);
  const [editableRows, setEditableRows] = useState<string[][]>([]);
  const [documentHash, setDocumentHash] = useState<string | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [prepSteps, setPrepSteps] = useState<string[]>([]);

  const [cropPoints, setCropPoints] = useState<CropPoint[]>(defaultCropPoints);
  const [activeHandle, setActiveHandle] = useState<number | null>(null);
  const [cropNaturalSize, setCropNaturalSize] = useState({ width: 0, height: 0 });

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const enhancerRef = useRef<ReturnType<typeof createImageEnhancer> | null>(null);
  const cropSurfaceRef = useRef<HTMLDivElement | null>(null);

  const canUseOcr = canUseOcrScan(user?.role);
  const basePreviewUrl = perspectiveUrl || originalUrl;
  const basePreviewFile = perspectiveFile || originalFile;
  const cropBox = useMemo(() => cropBounds(cropPoints), [cropPoints]);
  const cropSummary = useMemo(() => summarizeCrop(cropPoints), [cropPoints]);
  const enhanceSettings = useMemo(
    () => buildEnhanceSettings(selectedFilter, perspectiveFile ? FULL_CROP : cropBox),
    [cropBox, perspectiveFile, selectedFilter],
  );
  const displayEnhanceUrl =
    selectedFilter === "original" ? basePreviewUrl : enhancedUrl || basePreviewUrl;
  const processFile =
    selectedFilter === "original"
      ? perspectiveFile || originalFile
      : enhancedFile || perspectiveFile || originalFile;

  const resetFlow = useCallback(() => {
    setScreen("camera");
    setSelectedFilter("clean");
    setOutputChoice("excel");
    setProcessingStage("analyzing");
    setFlashEnabled(false);
    setBusyCrop(false);
    setBusyEnhance(false);
    setBusyAction(false);
    setShowInsights(false);
    setError("");
    setStatus("");
    setOriginalFile(null);
    setOriginalUrl("");
    setPerspectiveFile(null);
    setPerspectiveUrl("");
    setEnhancedFile(null);
    setEnhancedUrl("");
    setPdfBlob(null);
    setQualityHints([]);
    setSavedId(null);
    setResultPreview(null);
    setEditableHeaders([]);
    setEditableRows([]);
    setDocumentHash(null);
    setDraftDirty(false);
    setPrepSteps([]);
    setCropPoints(defaultCropPoints());
    setActiveHandle(null);
    setCropNaturalSize({ width: 0, height: 0 });
  }, []);

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
    };
  }, [originalUrl]);

  useEffect(() => {
    return () => {
      if (perspectiveUrl) URL.revokeObjectURL(perspectiveUrl);
    };
  }, [perspectiveUrl]);

  useEffect(() => {
    return () => {
      if (enhancedUrl) URL.revokeObjectURL(enhancedUrl);
    };
  }, [enhancedUrl]);

  const stopCamera = useCallback(async () => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
    setFlashEnabled(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || originalFile) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1440 },
          height: { ideal: 2560 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraReady(true);
    } catch {
      setCameraReady(false);
    }
  }, [originalFile]);

  useEffect(() => {
    if (screen !== "processing") return;
    setProcessingStage("analyzing");
    const timers = [
      window.setTimeout(() => setProcessingStage("extracting"), 1100),
      window.setTimeout(() => setProcessingStage("formatting"), 2450),
    ];
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [screen]);

  useEffect(() => {
    if (screen !== "camera") {
      void stopCamera();
      return;
    }
    void startCamera();
    return () => {
      void stopCamera();
    };
  }, [screen, startCamera, stopCamera]);

  useEffect(() => {
    if (screen !== "enhance" || !basePreviewFile) return;
    if (selectedFilter === "original") {
      setBusyEnhance(false);
      return;
    }
    let cancelled = false;
    if (!enhancerRef.current) enhancerRef.current = createImageEnhancer();
    setBusyEnhance(true);
    void enhancerRef.current
      .enhance(basePreviewFile, enhanceSettings)
      .then((enhanced) => {
        if (cancelled) {
          URL.revokeObjectURL(enhanced.previewUrl);
          return;
        }
        setEnhancedFile(buildEnhancedFile(enhanced.blob, basePreviewFile.name));
        setEnhancedUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return enhanced.previewUrl;
        });
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(formatApiErrorMessage(reason, "Could not apply this filter."));
        }
      })
      .finally(() => {
        if (!cancelled) setBusyEnhance(false);
      });
    return () => {
      cancelled = true;
    };
  }, [basePreviewFile, enhanceSettings, screen, selectedFilter]);

  useEffect(() => {
    return () => {
      enhancerRef.current?.dispose();
      enhancerRef.current = null;
    };
  }, []);

  const moveHandle = useCallback((index: number, clientX: number, clientY: number) => {
    const surface = cropSurfaceRef.current;
    if (!surface) return;
    const bounds = surface.getBoundingClientRect();
    const nextX = clamp01((clientX - bounds.left) / bounds.width);
    const nextY = clamp01((clientY - bounds.top) / bounds.height);
    setCropPoints((current) => {
      const next = sortPoints(current);
      if (!next[index]) return current;
      const gap = 0.08;
      if (index === 0) {
        next[index] = { x: Math.min(nextX, next[1].x - gap), y: Math.min(nextY, next[3].y - gap) };
      } else if (index === 1) {
        next[index] = { x: Math.max(nextX, next[0].x + gap), y: Math.min(nextY, next[2].y - gap) };
      } else if (index === 2) {
        next[index] = { x: Math.max(nextX, next[3].x + gap), y: Math.max(nextY, next[1].y + gap) };
      } else {
        next[index] = { x: Math.min(nextX, next[2].x - gap), y: Math.max(nextY, next[0].y + gap) };
      }
      return next;
    });
  }, []);

  const handleOverlayMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activeHandle == null) return;
    moveHandle(activeHandle, event.clientX, event.clientY);
  };

  const handleOverlayRelease = () => {
    setActiveHandle(null);
  };

  const captureCurrentFrame = useCallback(async () => {
    if (!videoRef.current || !videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      cameraInputRef.current?.click();
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      cameraInputRef.current?.click();
      return;
    }
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      cameraInputRef.current?.click();
      return;
    }
    const file = new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" });
    setOriginalFile(file);
    setOriginalUrl(URL.createObjectURL(file));
    setPerspectiveFile(null);
    setPerspectiveUrl("");
    setEnhancedFile(null);
    setEnhancedUrl("");
    setPdfBlob(null);
    setQualityHints([]);
    setSavedId(null);
    setResultPreview(null);
    setEditableHeaders([]);
    setEditableRows([]);
    setDocumentHash(null);
    setDraftDirty(false);
    setPrepSteps([]);
    setCropPoints(defaultCropPoints());
    setCropNaturalSize({ width: 0, height: 0 });
    setSelectedFilter("clean");
    setOutputChoice("excel");
    setShowInsights(false);
    setError("");
    setStatus("");
    setScreen("crop");
  }, []);

  const handleFlashToggle = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    const next = !flashEnabled;
    try {
      const rawCapabilities = (track as MediaStreamTrack & { getCapabilities?: () => MediaTrackCapabilities })
        ?.getCapabilities?.();
      const supportsTorch = Boolean((rawCapabilities as Record<string, unknown> | undefined)?.torch);
      if (track && supportsTorch) {
        await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      }
    } catch {
      // UI toggle only when torch is unavailable
    }
    setFlashEnabled(next);
  }, [flashEnabled]);

  const handlePickedFile = useCallback((file: File | null) => {
    if (!file) return;
    const validationError = validateOcrImageFile(file, "Image");
    if (validationError) {
      setError(validationError);
      return;
    }
    setOriginalFile(file);
    setOriginalUrl(URL.createObjectURL(file));
    setPerspectiveFile(null);
    setPerspectiveUrl("");
    setEnhancedFile(null);
    setEnhancedUrl("");
    setPdfBlob(null);
    setQualityHints([]);
    setSavedId(null);
    setResultPreview(null);
    setEditableHeaders([]);
    setEditableRows([]);
    setDocumentHash(null);
    setDraftDirty(false);
    setPrepSteps([]);
    setCropPoints(defaultCropPoints());
    setCropNaturalSize({ width: 0, height: 0 });
    setSelectedFilter("clean");
    setOutputChoice("excel");
    setShowInsights(false);
    setError("");
    setStatus("");
    setScreen("crop");
  }, []);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handlePickedFile(event.target.files?.[0] || null);
    event.target.value = "";
  };

  const handleContinueFromCrop = useCallback(async () => {
    if (!originalFile) return;
    setBusyCrop(true);
    setError("");
    const nextCrop = cropBounds(cropPoints);
    try {
      if (cropNaturalSize.width && cropNaturalSize.height) {
        const warped = await withTimeout(
          warpOcrImage({
            file: originalFile,
            corners: toWarpCorners(cropPoints, cropNaturalSize.width, cropNaturalSize.height),
          }),
          9000,
          "Crop correction timed out.",
        );
        const warpedFile = buildWarpedFile(warped.blob, originalFile.name);
        setPerspectiveFile(warpedFile);
        setPerspectiveUrl(URL.createObjectURL(warped.blob));
      }
      setSelectedFilter("clean");
      setScreen("enhance");
      setStatus("");
      setError("");
      if (!perspectiveFile) {
        setCropPoints([
          { x: nextCrop.left, y: nextCrop.top },
          { x: nextCrop.right, y: nextCrop.top },
          { x: nextCrop.right, y: nextCrop.bottom },
          { x: nextCrop.left, y: nextCrop.bottom },
        ]);
      }
    } catch {
      setStatus("Auto crop was skipped. Using your selected frame.");
      setSelectedFilter("clean");
      setScreen("enhance");
    } finally {
      setBusyCrop(false);
    }
  }, [cropNaturalSize.height, cropNaturalSize.width, cropPoints, originalFile, perspectiveFile]);

  const persistStructuredDraft = useCallback(async () => {
    if (!resultPreview || !originalFile) {
      throw new Error("Process a document first.");
    }
    const payload = {
      templateId: null,
      sourceFilename: originalFile.name,
      columns: Math.max(editableHeaders.length, ...editableRows.map((row) => row.length), resultPreview.columns, 1),
      language: resultPreview.language,
      avgConfidence: resultPreview.avgConfidence ?? null,
      warnings: resultPreview.warnings ?? [],
      documentHash,
      docTypeHint,
      routingMeta: resultPreview.routing ?? null,
      rawText: resultPreview.rawText ?? null,
      headers: editableHeaders,
      originalRows: resultPreview.rows,
      reviewedRows: editableRows,
      rawColumnAdded: resultPreview.rawColumnAdded,
      reviewerNotes: "",
    };
    if (savedId) {
      return updateOcrVerification(savedId, payload);
    }
    return createOcrVerification({
      ...payload,
      file: processFile,
    });
  }, [
    docTypeHint,
    documentHash,
    editableHeaders,
    editableRows,
    originalFile,
    processFile,
    resultPreview,
    savedId,
  ]);

  const handleProcess = useCallback(async () => {
    if (!processFile || !originalFile) return;
    setBusyAction(true);
    setError("");
    setStatus("");
    setShowInsights(false);
    setScreen("processing");

    try {
      const prepared = await prepareOcrUploadFile(processFile);
      const result = await withTimeout(
        previewOcrLogbook({
          file: prepared.file,
          columns: 5,
          language: languageHint,
          templateId: null,
          docTypeHint,
          forceModel,
          documentHash: prepared.sha256,
        }),
        25000,
        "Processing timed out.",
      );
      const reviewedRows = (result.rows || []).map((row) => row.map((cell) => String(cell ?? "")));
      const headers =
        result.headers?.length
          ? result.headers
          : Array.from(
              { length: result.columns || Math.max(...reviewedRows.map((row) => row.length), 1) },
              (_, index) => `Column ${index + 1}`,
            );

      const nextPreview: ResultPreview = {
        type: result.type || docTypeHint,
        title: result.title || "OCR Extraction",
        headers,
        rows: reviewedRows,
        columns: result.columns || Math.max(headers.length, ...reviewedRows.map((row) => row.length), 1),
        language: result.used_language || languageHint || "auto",
        avgConfidence: result.avg_confidence ?? result.confidence ?? null,
        rawColumnAdded: result.raw_column_added ?? false,
        rawText: result.raw_text ?? null,
        routing: result.routing ?? null,
        reused: result.reused ?? false,
        warnings: result.warnings ?? [],
      };

      setQualityHints(hintsFromWarnings(result.warnings));
      setResultPreview(nextPreview);
      setEditableHeaders(headers);
      setEditableRows(reviewedRows);
      setDocumentHash(prepared.sha256);
      setPrepSteps(prepared.steps);

      let nextSavedId = result.reused_verification_id ?? null;
      if (!nextSavedId) {
        const saved = await createOcrVerification({
          columns: nextPreview.columns,
          language: nextPreview.language,
          avgConfidence: nextPreview.avgConfidence ?? null,
          warnings: nextPreview.warnings ?? [],
          documentHash: prepared.sha256,
          docTypeHint,
          routingMeta: result.routing ?? null,
          rawText: result.raw_text ?? null,
          headers,
          originalRows: result.rows ?? reviewedRows,
          reviewedRows,
          rawColumnAdded: result.raw_column_added ?? false,
          reviewerNotes: "",
          templateId: null,
          sourceFilename: originalFile.name,
          file: prepared.file,
        });
        nextSavedId = saved.id;
        signalWorkflowRefresh("ocr-verification-created");
      }

      setSavedId(nextSavedId);
      setDraftDirty(false);
      setPdfBlob(
        await buildStructuredPdfBlob({
          title: nextPreview.title,
          headers,
          rows: reviewedRows,
        }),
      );
      setStatus(
        result.reused && nextSavedId
          ? `Reused OCR draft #${nextSavedId}. Existing extraction data was loaded for review.`
          : outputChoice === "excel"
            ? `Draft #${nextSavedId} saved. Excel export still depends on review for trust.`
            : `Draft #${nextSavedId} saved.`,
      );
      setScreen("result");
    } catch (reason) {
      setError(humanExtractError(reason));
      setScreen("output");
    } finally {
      setBusyAction(false);
    }
  }, [docTypeHint, forceModel, languageHint, originalFile, outputChoice, processFile]);

  const handleSaveDraftUpdates = useCallback(async () => {
    if (!resultPreview) return;
    setBusyAction(true);
    setError("");
    setStatus("");
    try {
      const saved = await persistStructuredDraft();
      setSavedId(saved.id);
      setDraftDirty(false);
      signalWorkflowRefresh("ocr-verification-updated");
      setPdfBlob(
        await buildStructuredPdfBlob({
          title: resultPreview.title,
          headers: editableHeaders,
          rows: editableRows,
        }),
      );
      setStatus(`Draft #${saved.id} updated.`);
    } catch (reason) {
      setError(humanExtractError(reason));
    } finally {
      setBusyAction(false);
    }
  }, [editableHeaders, editableRows, persistStructuredDraft, resultPreview]);

  const handleDownloadPdf = useCallback(async () => {
    if (!pdfBlob || !originalFile) return;
    if (draftDirty) {
      try {
        await persistStructuredDraft();
        setDraftDirty(false);
      } catch (reason) {
        setError(humanExtractError(reason));
        return;
      }
    }
    await transferBlob(pdfBlob, `${fileBaseName(originalFile.name)}.pdf`, {
      title: "OCR PDF export",
      text: "Structured OCR review export ready to share or save.",
    });
  }, [draftDirty, originalFile, pdfBlob, persistStructuredDraft]);

  const handleDownloadCsv = useCallback(async () => {
    if (!originalFile || !editableHeaders.length) return;
    if (draftDirty) {
      try {
        await persistStructuredDraft();
        setDraftDirty(false);
      } catch (reason) {
        setError(humanExtractError(reason));
        return;
      }
    }
    const csv = exportRowsToCsv(editableHeaders, editableRows);
    await transferBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${fileBaseName(originalFile.name)}.csv`, {
      title: "OCR CSV export",
      text: "Structured OCR rows ready to share or save.",
    });
    setStatus("CSV export downloaded.");
  }, [draftDirty, editableHeaders, editableRows, originalFile, persistStructuredDraft]);

  const handleCopyMarkdown = useCallback(async () => {
    if (!editableHeaders.length) return;
    const markdown = exportRowsToMarkdown(editableHeaders, editableRows);
    await navigator.clipboard.writeText(markdown);
    setStatus("Markdown table copied.");
  }, [editableHeaders, editableRows]);

  const handleDownloadExcel = useCallback(async () => {
    if (!savedId) return;
    setBusyAction(true);
    try {
      let targetId = savedId;
      if (draftDirty) {
        const saved = await persistStructuredDraft();
        targetId = saved.id;
        setSavedId(saved.id);
        setDraftDirty(false);
      }
      const download = await downloadOcrVerificationExport(targetId);
      await transferBlob(download.blob, download.filename, {
        title: "OCR Excel export",
        text: "Reviewed OCR file ready to share or save.",
      });
      setStatus(`Downloaded corrected Excel from draft #${targetId}.`);
    } catch (reason) {
      setStatus(humanExportError(reason));
    } finally {
      setBusyAction(false);
    }
  }, [draftDirty, persistStructuredDraft, savedId]);

  const handleRetake = () => {
    resetFlow();
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B0F19] text-sm text-slate-300">
        Loading scanner...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B0F19] px-6 text-white">
        <div className="w-full max-w-sm space-y-4 rounded-[2rem] border border-white/10 bg-[rgba(14,18,28,0.92)] p-6 text-center">
          <div className="text-lg font-semibold">Login required</div>
          <div className="text-sm text-slate-400">{sessionError || "Open access to use Document Desk."}</div>
          <div className="flex justify-center">
            {/* AUDIT: FLOW_BROKEN - send signed-out users to the live auth entry instead of the stale login route */}
            <Link href="/access">
              <Button>Open Access</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!canUseOcr) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B0F19] px-6 text-white">
        <div className="w-full max-w-sm space-y-4 rounded-[2rem] border border-white/10 bg-[rgba(14,18,28,0.92)] p-6 text-center">
          <div className="text-lg font-semibold">Scanner access unavailable</div>
          <div className="text-sm text-slate-400">Your role does not have access to Document Desk.</div>
          <div className="flex justify-center">
            <Link href="/dashboard">
              <Button>Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0B0F19] text-white">
      {screen === "camera" ? (
        <section className="relative flex min-h-screen flex-col overflow-hidden">
          <div className="absolute inset-0">
            {cameraReady ? (
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                autoPlay
                muted
                playsInline
              />
            ) : (
              <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.18),transparent_38%),linear-gradient(180deg,#111827,#05070d)]" />
            )}
            {flashEnabled ? <div className="absolute inset-0 bg-white/10" /> : null}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,8,18,0.28),rgba(0,0,0,0.02),rgba(3,8,18,0.7))]" />
          </div>

          <div className="relative z-10 px-5 pt-6 sm:px-7 sm:pt-7">
            <div className="mx-auto w-full max-w-5xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100">
                OCR Capture Desk
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem] md:items-start">
                <div>
                  <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-[2.8rem]">
                    Scan registers with a calmer, cleaner capture flow.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200/82 sm:text-base">
                    Capture first, then clean and review only when the page needs it.
                  </p>
                </div>
                <OcrGuideCard
                  pageKey="ocr-scan"
                  title="Capture tips"
                  summary="The camera stays primary. Open this only when you want the full capture path."
                  steps={[
                    {
                      label: "Capture",
                      detail: cameraReady
                        ? "Use the live camera for the cleanest page edge and fastest next step."
                        : "Upload from gallery when the camera is unavailable or the page is already saved.",
                    },
                    {
                      label: "Clean",
                      detail: "Crop the page, apply the right filter, and keep only the surface that should be read.",
                    },
                    {
                      label: "Review",
                      detail: "Save the result as a draft, then use verification only for risky fields or trust checks.",
                    },
                  ]}
                  className="border-white/10 bg-[rgba(8,14,24,0.62)] text-white shadow-[0_20px_60px_rgba(0,0,0,0.26)] backdrop-blur-xl"
                  summaryClassName="text-slate-400"
                  titleClassName="text-white"
                  bodyClassName="text-slate-300"
                  stepClassName="border-white/8 bg-white/[0.04] text-slate-300"
                />
              </div>
            </div>
          </div>

          <div className="relative flex flex-1 items-center justify-center px-5 py-8 sm:px-6 md:py-10">
            <div className="pointer-events-none relative aspect-[0.72] w-full max-w-[28rem] rounded-[2.7rem] border border-white/45 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_32px_100px_rgba(0,0,0,0.42)]">
              <div className="absolute inset-0 rounded-[2.7rem] border border-cyan-300/30 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))]" />
              <div className="absolute left-5 top-5 h-10 w-10 rounded-tl-[1.2rem] border-l-[3px] border-t-[3px] border-cyan-300" />
              <div className="absolute right-5 top-5 h-10 w-10 rounded-tr-[1.2rem] border-r-[3px] border-t-[3px] border-cyan-300" />
              <div className="absolute bottom-5 left-5 h-10 w-10 rounded-bl-[1.2rem] border-b-[3px] border-l-[3px] border-cyan-300" />
              <div className="absolute bottom-5 right-5 h-10 w-10 rounded-br-[1.2rem] border-b-[3px] border-r-[3px] border-cyan-300" />
              <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-white/12 bg-[rgba(8,14,24,0.68)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-200">
                Align the full page
              </div>
              <div className="absolute inset-x-6 top-1/2 h-px -translate-y-1/2 bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.95),transparent)] shadow-[0_0_24px_rgba(34,211,238,0.7)] animate-pulse" />
            </div>
          </div>

          <div
            className="relative z-10 border-t border-white/10 bg-[rgba(8,11,18,0.74)] backdrop-blur-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
          >
            <div className="mx-auto w-full max-w-5xl px-5 pt-5 sm:px-6">
              <div className="rounded-[2rem] border border-white/10 bg-[rgba(8,14,24,0.68)] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.26)]">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-lg font-semibold tracking-[-0.02em] text-white">Capture or upload</div>
                    {/* AUDIT: TEXT_NOISE - shorten capture guidance so the three actions stay easier to scan */}
                    <div className="mt-1 text-sm text-slate-300">Use the camera for the cleanest result, or jump straight to gallery upload.</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">PNG / JPG / HEIC</span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Draft before trust</span>
                  </div>
                </div>
                <div className="mt-5 flex items-end justify-between gap-3 sm:gap-5">
                  <button
                    type="button"
                    aria-label="Open gallery"
                    className="group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-3 py-4 text-slate-100 transition hover:border-sky-300/20 hover:bg-sky-400/10"
                    onClick={() => galleryInputRef.current?.click()}
                  >
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/12 bg-white/6 transition group-hover:bg-white/10">
                      <GalleryIcon />
                    </span>
                    <span className="text-sm font-semibold">Gallery</span>
                    <span className="text-center text-[11px] text-slate-400">Use an existing photo</span>
                  </button>

                  <button
                    type="button"
                    aria-label="Capture scan"
                    className="relative -mt-8 inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/8 shadow-[0_0_0_14px_rgba(255,255,255,0.06),0_28px_55px_rgba(0,0,0,0.32)] transition hover:scale-[1.02]"
                    onClick={() => void captureCurrentFrame()}
                  >
                    <span className="absolute inset-[11px] rounded-full border border-white/25" />
                    <span className="h-16 w-16 rounded-full bg-white" />
                  </button>

                  <button
                    type="button"
                    aria-label="Toggle flash"
                    className={cn(
                      "group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-[1.4rem] border px-3 py-4 text-slate-100 transition",
                      flashEnabled
                        ? "border-cyan-300/35 bg-cyan-300/12"
                        : "border-white/10 bg-white/[0.04] hover:border-sky-300/20 hover:bg-sky-400/10",
                    )}
                    onClick={() => void handleFlashToggle()}
                  >
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/12 bg-white/6">
                      <FlashIcon active={flashEnabled} />
                    </span>
                    <span className="text-sm font-semibold">Flash</span>
                    <span className="text-center text-[11px] text-slate-400">{flashEnabled ? "Torch requested" : "Use in low light"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {screen === "crop" ? (
        <section className="flex min-h-screen flex-col bg-[#0B0F19] px-5 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
              <div>
                <div className="inline-flex rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100">
                  Step 2 of 4
                </div>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">Set the crop frame</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                  Drag the four corners to keep only the page. We will use this frame for perspective correction before enhancement and extraction.
                </p>
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Crop health</div>
                <div className="mt-3 space-y-3">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                    <div className="text-xs text-slate-400">Coverage</div>
                    <div className="mt-1 text-lg font-semibold text-white">{cropSummary.coverage}%</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                      <div className="text-xs text-slate-400">Width</div>
                      <div className="mt-1 text-lg font-semibold text-white">{cropSummary.width}%</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                      <div className="text-xs text-slate-400">Height</div>
                      <div className="mt-1 text-lg font-semibold text-white">{cropSummary.height}%</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
                    Keep the corners tight to the page edge. If the crop feels off, retake the capture instead of forcing a bad frame.
                  </div>
                </div>
              </div>
            </div>

            <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="flex min-h-[26rem] items-center justify-center rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(5,10,18,0.92),rgba(12,19,31,0.94))] p-3 shadow-[0_26px_80px_rgba(0,0,0,0.28)] sm:p-4">
                <div
                  ref={cropSurfaceRef}
                  className="relative inline-block touch-none overflow-hidden rounded-[1.7rem] border border-white/10 bg-black/35"
                  onPointerMove={handleOverlayMove}
                  onPointerUp={handleOverlayRelease}
                  onPointerCancel={handleOverlayRelease}
                  onPointerLeave={handleOverlayRelease}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={originalUrl}
                    alt="Crop preview"
                    className="block max-h-[76vh] max-w-full object-contain"
                    onLoad={(event) => {
                      setCropNaturalSize({
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight,
                      });
                    }}
                  />
                  <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="crop-line" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#67e8f9" />
                        <stop offset="100%" stopColor="#60a5fa" />
                      </linearGradient>
                      <mask id="crop-mask">
                        <rect width="100" height="100" fill="white" />
                        <polygon points={cropPoints.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")} fill="black" />
                      </mask>
                    </defs>
                    <rect width="100" height="100" fill="rgba(3,8,18,0.52)" mask="url(#crop-mask)" />
                    <polygon
                      points={cropPoints.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")}
                      fill="rgba(14,165,233,0.1)"
                      stroke="url(#crop-line)"
                      strokeWidth="0.8"
                    />
                  </svg>
                  {cropPoints.map((point, index) => (
                    <button
                      key={`${index}-${point.x}-${point.y}`}
                      type="button"
                      aria-label={`Move crop handle ${index + 1}`}
                      className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-cyan-300 shadow-[0_0_0_6px_rgba(6,182,212,0.18)]"
                      style={{
                        left: `${point.x * 100}%`,
                        top: `${point.y * 100}%`,
                      }}
                      onPointerDown={(event) => {
                        setActiveHandle(index);
                        cropSurfaceRef.current?.setPointerCapture?.(event.pointerId);
                        moveHandle(index, event.clientX, event.clientY);
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-4 rounded-[1.7rem] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4 sm:p-5">
                <div>
                  <div className="text-lg font-semibold text-white">Crop guidance</div>
                  <div className="mt-1 text-sm text-slate-400">Make extraction easier before filters run.</div>
                </div>
                <div className="space-y-3">
                  {[
                    "Line the crop corners with the real paper edges, not the table edges only.",
                    "Keep labels, dates, and quantity columns inside the frame.",
                    "If the page is badly tilted or cut off, retake the photo now.",
                  ].map((item) => (
                    <div key={item} className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
                      {item}
                    </div>
                  ))}
                </div>
                <div className="rounded-[1.5rem] border border-cyan-300/18 bg-cyan-300/10 p-4 text-sm text-cyan-50">
                  After this step we attempt perspective correction automatically. A clean crop usually makes the filter stage much more accurate.
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#67e8f9,#60a5fa)] px-6 py-3.5 text-base font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={busyCrop || !cropNaturalSize.width}
                    onClick={() => void handleContinueFromCrop()}
                  >
                    {busyCrop ? "Correcting perspective..." : "Continue to enhancement"}
                  </button>
                  <button
                    type="button"
                    className="w-full text-sm font-medium text-slate-400 transition hover:text-white"
                    onClick={handleRetake}
                  >
                    Retake capture
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {screen === "enhance" ? (
        <section className="flex min-h-screen flex-col bg-[#0B0F19] px-5 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
              <div>
                <div className="inline-flex rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100">
                  Step 3 of 4
                </div>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">Tune the scan for extraction</h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                  Pick the version that gives the clearest rows and handwriting. We keep the OCR logic the same, but this step improves what we send into it.
                </p>
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Current enhancement</div>
                <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                  <div className="text-xs text-slate-400">Preset</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {FILTER_OPTIONS.find((item) => item.value === selectedFilter)?.label || "Clean"}
                  </div>
                </div>
                <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
                  {FILTER_OPTIONS.find((item) => item.value === selectedFilter)?.detail}
                </div>
                <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
                  {busyEnhance ? "Refreshing preview..." : "Preview is ready. Compare contrast before moving to output."}
                </div>
              </div>
            </div>

            <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="relative flex min-h-[26rem] items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(5,10,18,0.92),rgba(12,19,31,0.94))] p-3 shadow-[0_26px_80px_rgba(0,0,0,0.28)] sm:p-4">
                <div className="absolute left-5 top-5 z-10 rounded-full border border-white/10 bg-[rgba(8,14,24,0.74)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                  {selectedFilter === "original" ? "Raw view" : "Enhanced preview"}
                </div>
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[1.7rem] border border-white/10 bg-black/35">
                  {displayEnhanceUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={displayEnhanceUrl} alt="Enhanced preview" className="max-h-[76vh] w-full object-contain" />
                  ) : null}
                </div>
                {busyEnhance ? (
                  <div className="absolute inset-0 grid place-items-center bg-[rgba(11,15,25,0.42)] backdrop-blur-sm">
                    <div className="rounded-[1.5rem] border border-white/10 bg-[rgba(8,14,24,0.78)] px-5 py-4 text-center shadow-[0_18px_55px_rgba(0,0,0,0.28)]">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-cyan-200">
                        <SpinnerIcon />
                      </div>
                      <div className="mt-3 text-sm font-semibold text-white">Applying {selectedFilter} preset</div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4 rounded-[1.7rem] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4 sm:p-5">
                <div>
                  <div className="text-lg font-semibold text-white">Filter presets</div>
                  <div className="mt-1 text-sm text-slate-400">Choose the preview that gives the best table separation.</div>
                </div>
                <div className="space-y-3">
                  {FILTER_OPTIONS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={cn(
                        "w-full rounded-[1.4rem] border px-4 py-4 text-left transition",
                        selectedFilter === item.value
                          ? "border-cyan-300/35 bg-cyan-300/12 shadow-[0_18px_40px_rgba(34,211,238,0.12)]"
                          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]",
                      )}
                      onClick={() => setSelectedFilter(item.value)}
                    >
                      <div className="text-base font-semibold text-white">{item.label}</div>
                      <div className="mt-1 text-sm text-slate-400">{item.detail}</div>
                    </button>
                  ))}
                </div>
                <div className="rounded-[1.5rem] border border-cyan-300/18 bg-cyan-300/10 p-4 text-sm text-cyan-50">
                  If the cleaned version starts hiding faint handwriting, switch back to Original. If rows still blend together, try Contrast.
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#67e8f9,#60a5fa)] px-6 py-3.5 text-base font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={busyEnhance}
                    onClick={() => setScreen("output")}
                  >
                    Continue to output
                  </button>
                  <button
                    type="button"
                    className="w-full text-sm font-medium text-slate-400 transition hover:text-white"
                    onClick={() => setScreen("crop")}
                  >
                    Back to crop
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {screen === "output" ? (
        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-6">
          <div className="w-full max-w-5xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(11,17,27,0.92),rgba(8,13,22,0.96))] p-5 shadow-[0_26px_80px_rgba(0,0,0,0.34)] sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
              <div className="space-y-4">
                <div className="inline-flex rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100">
                  Step 4 of 4
                </div>
                <div>
                  <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white">Choose the final output</h2>
                  {/* AUDIT: TEXT_NOISE - shorten the output explanation so the actual output choice stays more visible */}
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">Choose the export path that matches the next handoff.</p>
                </div>
                <div className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-[rgba(255,255,255,0.03)]">
                  <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{processFile?.name || "Current scan"}</div>
                      <div className="text-xs text-slate-400">Prepared after crop and enhancement</div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                      {selectedFilter === "original" ? "Original tone" : `${selectedFilter} filter`}
                    </div>
                  </div>
                  <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_15rem]">
                    <div className="overflow-hidden rounded-[1.4rem] border border-white/8 bg-black/30">
                      {displayEnhanceUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={displayEnhanceUrl} alt="Prepared scan preview" className="max-h-[28rem] w-full object-contain" />
                      ) : null}
                    </div>
                    {/* AUDIT: DENSITY_OVERLOAD - move preparation notes into a secondary reveal so the output cards remain primary */}
                    <details className="rounded-[1.4rem] border border-white/8 bg-white/[0.04] px-4 py-4">
                      <summary className="cursor-pointer list-none text-sm font-semibold text-white">Preparation notes</summary>
                      <div className="mt-3 space-y-3">
                        {[
                          "Crop corrections are already applied.",
                          "The final upload will be compressed and hashed before OCR.",
                          "Exports still route through the review draft for trust.",
                        ].map((item) => (
                          <div key={item} className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-slate-300">
                            {item}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-[1.7rem] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4 sm:p-5">
                <div>
                  <div className="text-lg font-semibold text-white">Output destination</div>
                  <div className="mt-1 text-sm text-slate-400">Choose what the operator needs next.</div>
                </div>
                <div className="grid gap-3">
                  <label className="grid gap-1 text-sm text-slate-300">
                    <span>Document type</span>
                    <Select value={docTypeHint} onChange={(event) => setDocTypeHint(event.target.value)}>
                      <option value="logbook">Logbook</option>
                      <option value="register">Register</option>
                      <option value="dispatch-note">Dispatch note</option>
                      <option value="invoice">Invoice</option>
                      <option value="table">General table</option>
                    </Select>
                  </label>
                  <label className="grid gap-1 text-sm text-slate-300">
                    <span>OCR language</span>
                    <Select value={languageHint} onChange={(event) => setLanguageHint(event.target.value)}>
                      <option value="auto">Auto detect</option>
                      <option value="eng">English</option>
                      <option value="eng+hin+mar">English + Hindi + Marathi</option>
                    </Select>
                  </label>
                  <label className="grid gap-1 text-sm text-slate-300">
                    <span>Extraction tier</span>
                    <Select value={forceModel} onChange={(event) => setForceModel(event.target.value as "auto" | "fast" | "balanced" | "best")}>
                      <option value="auto">Auto</option>
                      <option value="fast">Fast</option>
                      <option value="balanced">Balanced</option>
                      <option value="best">Best</option>
                    </Select>
                  </label>
                </div>
                <div className="space-y-3">
              {[
                { value: "excel" as const, label: "Generate Excel", icon: <ExcelIcon /> },
                { value: "pdf" as const, label: "Generate PDF", icon: <PdfIcon /> },
                { value: "csv" as const, label: "Generate CSV", icon: <ExcelIcon /> },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-4 rounded-[1.6rem] border px-5 py-5 text-left transition",
                    outputChoice === item.value
                      ? "border-cyan-300/35 bg-cyan-300/12 shadow-[0_18px_40px_rgba(34,211,238,0.12)]"
                      : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]",
                  )}
                  onClick={() => setOutputChoice(item.value)}
                >
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-cyan-200">
                    {item.icon}
                  </span>
                  <span>
                    <span className="block text-lg font-semibold">{item.label}</span>
                    <span className="mt-1 block text-sm text-slate-400">
                      {item.value === "excel"
                        ? "Best for corrected rows, handoff, and downstream review."
                        : item.value === "pdf"
                          ? "Best for quick sharing and frozen visual output."
                          : "Best for lightweight structured handoff."}
                    </span>
                  </span>
                </button>
              ))}
                </div>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#67e8f9,#60a5fa)] px-6 py-4 text-base font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={busyAction || !processFile}
                  onClick={() => void handleProcess()}
                >
                  Start extraction
                </button>
                <button
                  type="button"
                  className="w-full text-sm font-medium text-slate-400 transition hover:text-white"
                  onClick={() => setScreen("enhance")}
                >
                  Back to filters
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {screen === "processing" ? (
        <section className="grid min-h-screen place-items-center px-5 py-10 sm:px-6">
          <div className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(11,17,27,0.94),rgba(8,13,22,0.97))] p-6 text-center shadow-[0_26px_80px_rgba(0,0,0,0.34)] sm:p-8">
            <div className="inline-flex rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100">
              AI Processing
            </div>
            <div className="mx-auto mt-6 w-full max-w-sm">
              <div className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="relative overflow-hidden rounded-[1.3rem] bg-[linear-gradient(180deg,rgba(5,10,18,0.95),rgba(14,21,33,0.95))] px-4 py-12">
                  <div className="absolute inset-y-0 left-0 w-full bg-[linear-gradient(180deg,transparent,rgba(76,176,255,0.08),transparent)]" />
                  <div className="absolute left-0 right-0 top-0 h-0.5 bg-[linear-gradient(90deg,transparent,rgba(76,176,255,0.95),transparent)] animate-[pulse_2s_ease-in-out_infinite]" />
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-cyan-200">
                    <SpinnerIcon />
                  </div>
                  <div className="mt-4 truncate text-sm font-medium text-slate-300">
                    {processFile?.name || "Current scan"}
                  </div>
                </div>
              </div>
            </div>
            <h2 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-white">
              {PROCESSING_STAGE_COPY[processingStage].label}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-300">
              {PROCESSING_STAGE_COPY[processingStage].detail}
            </p>
            <div className="mx-auto mt-6 h-2.5 w-full max-w-xl overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#67e8f9,#60a5fa)] transition-[width] duration-500 ease-out"
                style={{ width: `${PROCESSING_STAGE_COPY[processingStage].progress}%` }}
              />
            </div>
            <div className="mx-auto mt-6 grid w-full max-w-xl gap-3 text-left sm:grid-cols-3">
              {(Object.entries(PROCESSING_STAGE_COPY) as Array<[ProcessingStage, { label: string; detail: string; progress: number }]>).map(([key, item], index) => (
                <div
                  key={key}
                  className={cn(
                    "rounded-[1.35rem] border px-4 py-3",
                    key === processingStage
                      ? "border-cyan-300/30 bg-cyan-300/12"
                      : "border-white/8 bg-white/[0.03]",
                  )}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">0{index + 1}</div>
                  <div className="mt-2 text-sm font-semibold text-white">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {screen === "result" ? (
        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-6">
          <div className="w-full max-w-5xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(11,17,27,0.94),rgba(8,13,22,0.97))] p-5 shadow-[0_26px_80px_rgba(0,0,0,0.34)] sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]">
              <div className="space-y-5">
                <div className="text-center lg:text-left">
                  <div className="mx-auto grid h-20 w-20 place-items-center rounded-[1.6rem] border border-emerald-400/25 bg-emerald-400/10 text-emerald-200 lg:mx-0">
                    <CheckIcon />
                  </div>
                  <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">Conversion complete</h2>
                  {/* AUDIT: TEXT_NOISE - shorten the completion message so the next action area reads faster */}
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">Your scan is saved as a review-safe draft. Download it now or open the draft for trust checks.</p>
                </div>

                <div className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-[rgba(255,255,255,0.03)]">
                  <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{processFile?.name || "Current scan"}</div>
                      <div className="text-xs text-slate-400">Saved as a review draft before export</div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                      {savedId ? `Draft #${savedId}` : "Draft pending"}
                    </div>
                  </div>
                  <div className="space-y-4 p-4">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                      <div className="space-y-4">
                        <div className="overflow-hidden rounded-[1.4rem] border border-white/8 bg-black/30">
                          {displayEnhanceUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={displayEnhanceUrl} alt="Processed scan preview" className="max-h-[28rem] w-full object-contain" />
                          ) : null}
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-white">{resultPreview?.title || "OCR Extraction"}</div>
                              <div className="mt-1 text-xs text-slate-400">{resultPreview?.type || docTypeHint}</div>
                            </div>
                            <OcrRoutingBadge routing={resultPreview?.routing} />
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Language</div>
                              <div className="mt-2 text-sm font-medium text-white">{resultPreview?.language || "auto"}</div>
                            </div>
                            <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Confidence</div>
                              <div className="mt-2 text-sm font-medium text-white">{formatConfidence(resultPreview?.avgConfidence ?? null)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {[
                          ["Columns", String(editableHeaders.length || resultPreview?.columns || 0)],
                          ["Rows", String(editableRows.length || resultPreview?.rows.length || 0)],
                          ["Hints", qualityHints.length ? qualityHints.join(", ") : "No scan warnings"],
                          ["Prepared", prepSteps.length ? prepSteps.join(", ") : "No extra preprocessing"],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
                            <div className="mt-2 text-sm font-medium text-white">{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-[1.4rem] border border-white/8 bg-white/[0.04]">
                      <div className="border-b border-white/8 px-4 py-3">
                        <div className="text-sm font-semibold text-white">Structured result</div>
                        <div className="mt-1 text-xs text-slate-400">Edit the extracted table before review or export.</div>
                      </div>
                      <div className="p-4">
                        <OcrResultsGrid
                          headers={editableHeaders}
                          rows={editableRows}
                          onChangeHeaders={(headers) => {
                            setEditableHeaders(headers);
                            setDraftDirty(true);
                          }}
                          onChangeRows={(rows) => {
                            setEditableRows(rows);
                            setDraftDirty(true);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-[1.7rem] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4 sm:p-5">
                <div>
                  <div className="text-lg font-semibold text-white">Export or continue review</div>
                  <div className="mt-1 text-sm text-slate-400">Choose the next action for this OCR draft.</div>
                </div>
                <div className="space-y-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-5 py-4 text-left transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={busyAction || !resultPreview || !draftDirty}
                    onClick={() => void handleSaveDraftUpdates()}
                  >
                    <span>
                      <span className="block text-base font-semibold text-white">Save Draft Updates</span>
                      <span className="mt-1 block text-sm text-slate-400">Persist header and row edits back into the verification draft.</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between rounded-[1.5rem] border px-5 py-4 text-left transition",
                      savedId
                        ? "border-cyan-300/30 bg-cyan-300/10 hover:bg-cyan-300/14"
                        : "border-white/10 bg-white/[0.04]",
                    )}
                    disabled={busyAction || !savedId}
                    onClick={() => void handleDownloadExcel()}
                  >
                    <span className="flex items-center gap-3">
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-cyan-200">
                        <ExcelIcon />
                      </span>
                      <span>
                        <span className="block text-base font-semibold text-white">Download Excel</span>
                        <span className="mt-1 block text-sm text-slate-400">Corrected rows ready for spreadsheet workflow.</span>
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-5 py-4 text-left transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!pdfBlob}
                    onClick={handleDownloadPdf}
                  >
                    <span className="flex items-center gap-3">
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-cyan-200">
                        <PdfIcon />
                      </span>
                      <span>
                        <span className="block text-base font-semibold text-white">Download PDF</span>
                        <span className="mt-1 block text-sm text-slate-400">Frozen visual export for easy sharing.</span>
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-5 py-4 text-left transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!editableHeaders.length}
                    onClick={() => void handleDownloadCsv()}
                  >
                    <span>
                      <span className="block text-base font-semibold text-white">Download CSV</span>
                      <span className="mt-1 block text-sm text-slate-400">Structured rows for quick handoff outside Excel.</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-5 py-4 text-left transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!editableHeaders.length}
                    onClick={() => void handleCopyMarkdown()}
                  >
                    <span>
                      <span className="block text-base font-semibold text-white">Copy Markdown Table</span>
                      <span className="mt-1 block text-sm text-slate-400">Paste the structured result into chat, notes, or tickets.</span>
                    </span>
                  </button>
                </div>

                {savedId ? (
                  <Link
                    href={`/ocr/verify?verification_id=${savedId}`}
                    className="inline-flex w-full items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                  >
                    Review draft
                  </Link>
                ) : null}

                <button
                  type="button"
                  className="w-full text-sm font-medium text-cyan-300 transition hover:text-cyan-100"
                  onClick={() => setShowInsights((current) => !current)}
                >
                  {showInsights ? "Hide details" : "More details"}
                </button>

                {showInsights ? (
                  <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 text-left">
                    {[
                      ["Draft", savedId ? `#${savedId}` : "Not saved"],
                      ["Excel source", savedId ? "Corrected review draft rows" : "Not ready"],
                      ["Dedupe", resultPreview?.reused ? "Reused prior extraction" : "Fresh extraction"],
                      ["Next step", savedId ? "Review, approve, and export trusted output" : "Save the draft first"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-4">
                        <span className="text-sm text-slate-400">{label}</span>
                        <span className="max-w-[60%] text-right text-sm font-medium text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                <button
                  type="button"
                  className="w-full text-sm font-medium text-slate-400 transition hover:text-white"
                  onClick={resetFlow}
                >
                  Scan another document
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {(error || status) && screen !== "processing" ? (
        <div
          className={cn(
            "pointer-events-none fixed inset-x-0 z-50 mx-auto w-[min(92vw,34rem)] rounded-[1.4rem] border px-4 py-3 text-sm shadow-[0_18px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl",
            error ? "border-red-400/25 bg-[rgba(127,29,29,0.85)] text-red-50" : "border-cyan-300/20 bg-[rgba(8,19,30,0.86)] text-cyan-50",
          )}
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
        >
          {error || status}
        </div>
      ) : null}

      <input
        ref={cameraInputRef}
        className="hidden"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
      />
      <input
        ref={galleryInputRef}
        className="hidden"
        type="file"
        accept="image/*"
        onChange={handleInputChange}
      />
    </main>
  );
}
