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

import { Button } from "@/components/ui/button";
import { formatApiErrorMessage } from "@/lib/api";
import { transferBlob } from "@/lib/blob-transfer";
import { createImageEnhancer } from "@/lib/image-enhance-client";
import { defaultEnhanceSettings, type CropBox, type EnhanceSettings } from "@/lib/image-enhance";
import { canUseOcrScan, validateOcrImageFile } from "@/lib/ocr-access";
import {
  createOcrVerification,
  downloadOcrVerificationExport,
  previewOcrLogbook,
  warpOcrImage,
  type OcrPreviewResult,
} from "@/lib/ocr";
import { useOnlineStatus } from "@/lib/use-online-status";
import { useMobileRouteFunnel } from "@/lib/mobile-route-funnel";
import { useSession } from "@/lib/use-session";
import { signalWorkflowRefresh } from "@/lib/workflow-sync";
import { cn } from "@/lib/utils";

type ScanScreen = "camera" | "crop" | "enhance" | "output" | "processing" | "result";
type FilterPreset = "original" | "clean" | "contrast";
type OutputChoice = "excel" | "pdf";
type ProcessingStage = "analyzing" | "extracting" | "formatting";
type OCRFields = {
  date: string;
  material: string;
  quantity: string;
};
type LastFields = OCRFields & { updatedAt: number };
type CropPoint = { x: number; y: number };
type ResultPreview = {
  rows: string[][];
  columns: number;
  language: string;
  avgConfidence: number | null;
  rawColumnAdded: boolean;
};

const LAST_FIELD_STORAGE_KEY = "dpr:ocr:last-fields:v2";
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
const SCAN_TIPS = [
  "Keep the full page inside the frame and avoid cutting off the top or bottom edge.",
  "Use flash only when the page is dim. If you see glare, turn it off and step back slightly.",
  "If the page looks tilted or cropped, retake it before review so the trust path starts with a clean document.",
] as const;

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

function normalizeRows(result: OcrPreviewResult, lastFields: LastFields | null) {
  const columns = Math.max(result.columns || 0, ...result.rows.map((row) => row.length), 3);
  const normalized = (result.rows.length ? result.rows : [Array.from({ length: columns }, () => "")]).map((row) =>
    Array.from({ length: columns }, (_, index) => String(row[index] ?? "")),
  );
  if (lastFields && normalized[0]) {
    if (!normalized[0][0]?.trim()) normalized[0][0] = lastFields.date;
    if (!normalized[0][1]?.trim()) normalized[0][1] = lastFields.material;
    if (!normalized[0][2]?.trim()) normalized[0][2] = lastFields.quantity;
  }
  return normalized;
}

function extractFields(rows: string[][], lastFields: LastFields | null): OCRFields {
  const firstRow = rows[0] || [];
  return {
    date: firstRow[0]?.trim() || lastFields?.date || "",
    material: firstRow[1]?.trim() || lastFields?.material || "",
    quantity: firstRow[2]?.trim() || lastFields?.quantity || "",
  };
}

function applyFieldsToRows(rows: string[][], fields: OCRFields) {
  const next = rows.map((row) => [...row]);
  if (!next.length) next.push(["", "", ""]);
  while (next[0].length < 3) next[0].push("");
  next[0][0] = fields.date;
  next[0][1] = fields.material;
  next[0][2] = fields.quantity;
  return next;
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

async function blobToUint8Array(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

function concatUint8Arrays(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function buildPdfBlobFromImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is unavailable.");
  }
  context.drawImage(bitmap, 0, 0);
  const jpegBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not prepare PDF preview."))),
      "image/jpeg",
      0.9,
    );
  });

  const imageBytes = await blobToUint8Array(jpegBlob);
  const pageWidth = bitmap.width >= bitmap.height ? 841.89 : 595.28;
  const pageHeight = bitmap.width >= bitmap.height ? 595.28 : 841.89;
  const margin = 24;
  const scale = Math.min((pageWidth - margin * 2) / bitmap.width, (pageHeight - margin * 2) / bitmap.height);
  const drawWidth = bitmap.width * scale;
  const drawHeight = bitmap.height * scale;
  const originX = (pageWidth - drawWidth) / 2;
  const originY = (pageHeight - drawHeight) / 2;

  const encoder = new TextEncoder();
  const header = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]);
  const contentStream = encoder.encode(
    `q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${originX.toFixed(2)} ${originY.toFixed(2)} cm\n/Im0 Do\nQ\n`,
  );

  const objects: Uint8Array[] = [
    encoder.encode("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"),
    encoder.encode("2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n"),
    encoder.encode(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /ProcSet [/PDF /ImageC] /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
    ),
    concatUint8Arrays([
      encoder.encode(
        `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${bitmap.width} /Height ${bitmap.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
      ),
      imageBytes,
      encoder.encode("\nendstream\nendobj\n"),
    ]),
    concatUint8Arrays([
      encoder.encode(`5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n`),
      contentStream,
      encoder.encode("endstream\nendobj\n"),
    ]),
  ];

  let offset = header.length;
  const offsets = [0];
  for (const object of objects) {
    offsets.push(offset);
    offset += object.length;
  }

  const xrefOffset = offset;
  const xrefLines = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((value) => `${String(value).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  ];

  return new Blob([header.slice(), ...objects.map((object) => object.slice()), encoder.encode(`${xrefLines.join("\n")}\n`).slice()], {
    type: "application/pdf",
  });
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
  const trackPrimaryAction = useMobileRouteFunnel("/ocr/scan", user?.role, Boolean(user));
  const online = useOnlineStatus();

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
  const [showScanTips, setShowScanTips] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [perspectiveFile, setPerspectiveFile] = useState<File | null>(null);
  const [perspectiveUrl, setPerspectiveUrl] = useState("");
  const [enhancedFile, setEnhancedFile] = useState<File | null>(null);
  const [enhancedUrl, setEnhancedUrl] = useState("");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  const [fields, setFields] = useState<OCRFields>({ date: "", material: "", quantity: "" });
  const [qualityHints, setQualityHints] = useState<string[]>([]);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [resultPreview, setResultPreview] = useState<ResultPreview | null>(null);
  const [lastFields, setLastFields] = useState<LastFields | null>(null);

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
  const ocrOfflineNotice = !online
    ? screen === "result"
      ? "This draft is already prepared on this device, but Review Documents and fresh Excel export still need a connection."
      : "You can capture, crop, and enhance offline. AI extraction, saving the review draft, and Excel export need a live connection."
    : null;

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
    setShowScanTips(false);
    setError("");
    setStatus("");
    setOriginalFile(null);
    setOriginalUrl("");
    setPerspectiveFile(null);
    setPerspectiveUrl("");
    setEnhancedFile(null);
    setEnhancedUrl("");
    setPdfBlob(null);
    setFields({ date: "", material: "", quantity: "" });
    setQualityHints([]);
    setSavedId(null);
    setResultPreview(null);
    setCropPoints(defaultCropPoints());
    setActiveHandle(null);
    setCropNaturalSize({ width: 0, height: 0 });
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LAST_FIELD_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<LastFields>;
      if (typeof parsed.date === "string" && typeof parsed.material === "string" && typeof parsed.quantity === "string") {
        setLastFields({
          date: parsed.date,
          material: parsed.material,
          quantity: parsed.quantity,
          updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
        });
      }
    } catch {
      // ignore local cache issues
    }
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

  const persistLastFields = useCallback((nextFields: OCRFields) => {
    const nextLast = { ...nextFields, updatedAt: Date.now() };
    setLastFields(nextLast);
    window.localStorage.setItem(LAST_FIELD_STORAGE_KEY, JSON.stringify(nextLast));
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
    setFields({ date: "", material: "", quantity: "" });
    setQualityHints([]);
    setSavedId(null);
    setResultPreview(null);
    setCropPoints(defaultCropPoints());
    setCropNaturalSize({ width: 0, height: 0 });
    setSelectedFilter("clean");
    setOutputChoice("excel");
    setShowInsights(false);
    setError("");
    setStatus("");
    setScreen("crop");
    trackPrimaryAction("capture_scan");
  }, [trackPrimaryAction]);

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
    setFields({ date: "", material: "", quantity: "" });
    setQualityHints([]);
    setSavedId(null);
    setResultPreview(null);
    setCropPoints(defaultCropPoints());
    setCropNaturalSize({ width: 0, height: 0 });
    setSelectedFilter("clean");
    setOutputChoice("excel");
    setShowInsights(false);
    setError("");
    setStatus("");
    setScreen("crop");
    trackPrimaryAction("capture_scan");
  }, [trackPrimaryAction]);

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

  const handleProcess = useCallback(async () => {
    if (!processFile || !originalFile) return;
    if (!online) {
      setError("Reconnect to extract and save this OCR draft.");
      setStatus("");
      return;
    }
    setBusyAction(true);
    setError("");
    setStatus("");
    setShowInsights(false);
    setScreen("processing");

    try {
      const pdfPromise = buildPdfBlobFromImage(processFile);
      const result = await withTimeout(
        previewOcrLogbook({
          file: processFile,
          columns: 5,
          language: "auto",
          templateId: null,
        }),
        15000,
        "Processing timed out.",
      );
      const normalizedRows = normalizeRows(result, lastFields);
      const nextFields = extractFields(normalizedRows, lastFields);
      const reviewedRows = applyFieldsToRows(normalizedRows, nextFields);

      setFields(nextFields);
      setQualityHints(hintsFromWarnings(result.warnings));
      setResultPreview({
        rows: reviewedRows,
        columns: result.columns || Math.max(...reviewedRows.map((row) => row.length), 1),
        language: result.used_language || "auto",
        avgConfidence: result.avg_confidence ?? null,
        rawColumnAdded: result.raw_column_added ?? false,
      });

      const saved = await createOcrVerification({
        columns: result.columns || Math.max(...reviewedRows.map((row) => row.length), 1),
        language: result.used_language || "auto",
        avgConfidence: result.avg_confidence ?? null,
        warnings: result.warnings ?? [],
        headers: [],
        originalRows: result.rows ?? reviewedRows,
        reviewedRows,
        rawColumnAdded: result.raw_column_added ?? false,
        reviewerNotes: "",
        templateId: null,
        sourceFilename: originalFile.name,
        file: processFile,
      });

      setSavedId(saved.id);
      signalWorkflowRefresh("ocr-verification-created");
      persistLastFields(nextFields);
      setPdfBlob(await pdfPromise);
      setStatus(
        outputChoice === "excel"
          ? `Draft #${saved.id} saved. Excel export will use these corrected rows. Approve it in Review Documents to make the export trusted.`
          : `Draft #${saved.id} saved.`,
      );

      setScreen("result");
    } catch (reason) {
      setError(humanExtractError(reason));
      setScreen("output");
    } finally {
      setBusyAction(false);
    }
  }, [lastFields, online, originalFile, outputChoice, persistLastFields, processFile]);

  const handleDownloadPdf = useCallback(async () => {
    if (!pdfBlob || !originalFile) return;
    await transferBlob(pdfBlob, `${fileBaseName(originalFile.name)}.pdf`, {
      title: "OCR PDF export",
      text: "Processed factory scan ready to share or save.",
    });
  }, [originalFile, pdfBlob]);

  const handleDownloadExcel = useCallback(async () => {
    if (!savedId) return;
    setBusyAction(true);
    try {
      const download = await downloadOcrVerificationExport(savedId);
      await transferBlob(download.blob, download.filename, {
        title: "OCR Excel export",
        text: "Reviewed OCR file ready to share or save.",
      });
      setStatus(`Downloaded corrected Excel from draft #${savedId}.`);
    } catch (reason) {
      setStatus(humanExportError(reason));
    } finally {
      setBusyAction(false);
    }
  }, [savedId]);

  const handleRetake = () => {
    resetFlow();
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-sm text-text-muted pb-20 md:pb-8">
        Loading scanner...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-6 text-text-primary pb-20 md:pb-8">
        <div className="w-full max-w-sm space-y-4 rounded-[2rem] border border-border bg-card p-6 text-center">
          <div className="text-lg font-semibold text-text-primary">Login required</div>
          <div className="text-sm text-text-muted">{sessionError || "Open login to use Document Desk."}</div>
          <div className="flex justify-center">
            <Link href="/access">
              <Button>Open Login</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!canUseOcr) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-6 text-text-primary pb-20 md:pb-8">
        <div className="w-full max-w-sm space-y-4 rounded-[2rem] border border-border bg-card p-6 text-center">
          <div className="text-lg font-semibold text-text-primary">Scanner access unavailable</div>
          <div className="text-sm text-text-muted">Your role does not have access to Document Desk.</div>
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
    <main className="relative min-h-screen overflow-hidden bg-bg text-text-primary pb-20 md:pb-8">
      {ocrOfflineNotice ? (
        <div className="relative z-20 px-4 pt-4 sm:px-6">
          <div className="mx-auto max-w-5xl rounded-[1.4rem] border border-amber-400/24 bg-[rgba(120,53,15,0.72)] px-4 py-3 text-sm text-amber-50 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200">Offline-safe OCR</div>
            <div className="mt-1 leading-6">{ocrOfflineNotice}</div>
          </div>
        </div>
      ) : null}
      {screen === "camera" ? (
        <section className="relative flex min-h-screen flex-col overflow-x-hidden bg-bg pb-20 md:pb-8">
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

          <div className="relative z-10 px-4 pt-3 sm:px-7 sm:pt-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100">
                  OCR Capture Desk
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[rgba(8,14,24,0.62)] px-3 py-1 text-[11px] font-semibold text-slate-100 md:hidden">
                  <span>Camera</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cameraReady ? "bg-emerald-400/16 text-emerald-100" : "bg-amber-400/16 text-amber-100")}>
                    {cameraReady ? "Live" : "Upload fallback"}
                  </span>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem] md:items-start">
                <div className="hidden md:block">
                  <h1 className="max-w-2xl text-[2rem] font-semibold tracking-[-0.04em] text-white sm:text-[2.8rem]">
                    Scan registers with a calmer, cleaner capture flow.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200/82 sm:text-base sm:leading-7">
                    Capture from the camera or upload from the gallery, then crop, enhance, review, and export the same trusted draft to Excel or PDF.
                  </p>
                </div>
                <div className="hidden rounded-[1.6rem] border border-white/10 bg-[rgba(8,14,24,0.62)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.26)] backdrop-blur-xl md:block">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Live readiness</div>
                  <div className="mt-3 space-y-3 text-sm text-slate-200">
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5">
                      <span>Camera</span>
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", cameraReady ? "bg-emerald-400/16 text-emerald-100" : "bg-amber-400/16 text-amber-100")}>
                        {cameraReady ? "Live" : "Upload fallback"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5">
                      <span>Export formats</span>
                      <span className="text-xs text-slate-300">Excel + PDF</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5">
                      <span>Review path</span>
                      <span className="text-xs text-slate-300">Draft before trust</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex flex-1 items-start justify-center px-4 pb-4 pt-3 sm:px-6 md:items-center md:py-10">
            <div className="pointer-events-none relative aspect-[0.72] w-full max-w-[19.5rem] rounded-[2.35rem] border border-white/45 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_32px_100px_rgba(0,0,0,0.42)] sm:max-w-[22rem] sm:rounded-[2.7rem] md:max-w-[28rem]">
              <div className="absolute inset-0 rounded-[2.35rem] border border-cyan-300/30 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] sm:rounded-[2.7rem]" />
              <div className="absolute left-4 top-4 h-8 w-8 rounded-tl-[1rem] border-l-[3px] border-t-[3px] border-cyan-300 sm:left-5 sm:top-5 sm:h-10 sm:w-10 sm:rounded-tl-[1.2rem]" />
              <div className="absolute right-4 top-4 h-8 w-8 rounded-tr-[1rem] border-r-[3px] border-t-[3px] border-cyan-300 sm:right-5 sm:top-5 sm:h-10 sm:w-10 sm:rounded-tr-[1.2rem]" />
              <div className="absolute bottom-4 left-4 h-8 w-8 rounded-bl-[1rem] border-b-[3px] border-l-[3px] border-cyan-300 sm:bottom-5 sm:left-5 sm:h-10 sm:w-10 sm:rounded-bl-[1.2rem]" />
              <div className="absolute bottom-4 right-4 h-8 w-8 rounded-br-[1rem] border-b-[3px] border-r-[3px] border-cyan-300 sm:bottom-5 sm:right-5 sm:h-10 sm:w-10 sm:rounded-br-[1.2rem]" />
              <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-white/12 bg-[rgba(8,14,24,0.68)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-200 sm:top-4 sm:px-3 sm:text-[11px] sm:tracking-[0.22em]">
                Align the full page
              </div>
              <div className="absolute inset-x-6 top-1/2 h-px -translate-y-1/2 bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.95),transparent)] shadow-[0_0_24px_rgba(34,211,238,0.7)] animate-pulse" />
            </div>
          </div>

          <div
            className="relative z-10 border-t border-white/10 bg-[rgba(8,11,18,0.74)] backdrop-blur-2xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
          >
            <div className="mx-auto w-full max-w-5xl px-4 pt-3 sm:px-6">
              <div className="rounded-[1.75rem] border border-white/10 bg-[rgba(8,14,24,0.68)] p-3 shadow-[0_22px_70px_rgba(0,0,0,0.26)] sm:rounded-[2rem] sm:p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="hidden md:block">
                    <div className="text-lg font-semibold tracking-[-0.02em] text-white">Capture or upload</div>
                    <div className="mt-1 text-sm text-slate-300">
                      Use the live camera for the cleanest result, or jump straight to gallery upload if you already have the image.
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-200 md:hidden">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Review path</div>
                      <div className="mt-1 text-slate-100">Draft before trust</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Input</div>
                      <div className="mt-1 text-slate-100">Camera or gallery</div>
                    </div>
                  </div>
                  <div className="hidden flex-wrap items-center gap-2 text-xs text-slate-400 md:flex">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">PNG / JPG / HEIC</span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">Factory-safe review flow</span>
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3 sm:mt-5 sm:gap-5">
                  <button
                    type="button"
                    aria-label="Open gallery"
                    className="group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-[1.2rem] border border-white/10 bg-white/[0.04] px-2.5 py-3 text-slate-100 transition hover:border-sky-300/20 hover:bg-sky-400/10 sm:rounded-[1.4rem] sm:px-3 sm:py-4"
                    onClick={() => galleryInputRef.current?.click()}
                  >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/6 transition group-hover:bg-white/10 sm:h-14 sm:w-14">
                      <GalleryIcon />
                    </span>
                    <span className="text-sm font-semibold">Gallery</span>
                    <span className="text-center text-[11px] text-slate-400">Use an existing photo</span>
                  </button>

                  <button
                    type="button"
                    aria-label="Capture scan"
                    className="relative -mt-5 inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/8 shadow-[0_0_0_10px_rgba(255,255,255,0.06),0_24px_48px_rgba(0,0,0,0.32)] transition hover:scale-[1.02] sm:-mt-8 sm:h-24 sm:w-24 sm:shadow-[0_0_0_14px_rgba(255,255,255,0.06),0_28px_55px_rgba(0,0,0,0.32)]"
                    onClick={() => void captureCurrentFrame()}
                  >
                    <span className="absolute inset-[10px] rounded-full border border-white/25 sm:inset-[11px]" />
                    <span className="h-14 w-14 rounded-full bg-white sm:h-16 sm:w-16" />
                  </button>

                  <button
                    type="button"
                    aria-label="Toggle flash"
                    className={cn(
                      "group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-[1.2rem] border px-2.5 py-3 text-slate-100 transition sm:rounded-[1.4rem] sm:px-3 sm:py-4",
                      flashEnabled
                        ? "border-cyan-300/35 bg-cyan-300/12"
                        : "border-white/10 bg-white/[0.04] hover:border-sky-300/20 hover:bg-sky-400/10",
                    )}
                    onClick={() => void handleFlashToggle()}
                  >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/6 sm:h-14 sm:w-14">
                      <FlashIcon active={flashEnabled} />
                    </span>
                    <span className="text-sm font-semibold">Flash</span>
                    <span className="text-center text-[11px] text-slate-400">{flashEnabled ? "Torch requested" : "Use in low light"}</span>
                  </button>
                </div>
                <div className="mt-3 border-t border-white/10 pt-3 md:hidden">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-[1.2rem] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left text-sm font-semibold text-slate-100"
                    onClick={() => setShowScanTips((current) => !current)}
                  >
                    <span>How to scan</span>
                    <span className="text-xs text-slate-400">{showScanTips ? "Hide tips" : "Show tips"}</span>
                  </button>
                  {showScanTips ? (
                    <div className="mt-3 space-y-2 rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-3 text-sm leading-6 text-slate-200">
                      {SCAN_TIPS.map((tip) => (
                        <div key={tip} className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.03)] px-3 py-2.5">
                          {tip}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
  ) : null
}

{
  screen === "crop" ? (
    <section className="flex min-h-screen flex-col bg-bg px-4 py-6 pb-20 sm:px-6 sm:py-8 md:pb-8">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div>
            <div className="inline-flex rounded-lg border border-color-primary/20 bg-color-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-color-primary">
              Step 2 of 4
            </div>

            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">Set the crop frame</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:leading-7">
              Drag the four corners to keep only the page. We will use this frame for perspective correction before enhancement and extraction.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:hidden">
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Coverage</div>
                <div className="mt-1 text-base font-semibold text-white">{cropSummary.coverage}%</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Width</div>
                <div className="mt-1 text-base font-semibold text-white">{cropSummary.width}%</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Height</div>
                <div className="mt-1 text-base font-semibold text-white">{cropSummary.height}%</div>
              </div>
            </div>
          </div>
          <div className="hidden rounded-[1.6rem] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4 lg:block">
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

        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-5">
          <div className="flex min-h-[23rem] items-center justify-center rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(5,10,18,0.92),rgba(12,19,31,0.94))] p-2.5 shadow-[0_26px_80px_rgba(0,0,0,0.28)] sm:min-h-[26rem] sm:p-4">
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
                className="block max-h-[58vh] max-w-full object-contain sm:max-h-[76vh]"
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
  ) : null
}

{
  screen === "enhance" ? (
    <section className="flex min-h-screen flex-col bg-[#0B0F19] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div>
            <div className="inline-flex rounded-lg border border-color-primary/20 bg-color-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-color-primary">
              Step 3 of 4
            </div>

            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">Tune the scan for extraction</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:leading-7">
              Pick the version that gives the clearest rows and handwriting. We keep the OCR logic the same, but this step improves what we send into it.
            </p>
            <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 lg:hidden">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Current preset</div>
              <div className="mt-1 text-base font-semibold text-white">
                {FILTER_OPTIONS.find((item) => item.value === selectedFilter)?.label || "Clean"}
              </div>
              <div className="mt-2 text-sm text-slate-300">
                {busyEnhance ? "Refreshing preview..." : FILTER_OPTIONS.find((item) => item.value === selectedFilter)?.detail}
              </div>
            </div>
          </div>
          <div className="hidden rounded-[1.6rem] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4 lg:block">
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

        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-5">
          <div className="relative flex min-h-[23rem] items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(5,10,18,0.92),rgba(12,19,31,0.94))] p-2.5 shadow-[0_26px_80px_rgba(0,0,0,0.28)] sm:min-h-[26rem] sm:p-4">
            <div className="absolute left-5 top-5 z-10 rounded-full border border-white/10 bg-[rgba(8,14,24,0.74)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
              {selectedFilter === "original" ? "Raw view" : "Enhanced preview"}
            </div>
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[1.7rem] border border-white/10 bg-black/35">
              {displayEnhanceUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displayEnhanceUrl} alt="Enhanced preview" className="max-h-[58vh] w-full object-contain sm:max-h-[76vh]" />
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
  ) : null
}

{
  screen === "output" ? (
    <section className="flex min-h-screen items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
      <div className="w-full max-w-5xl rounded-[2rem] border border-border bg-card p-4 shadow-[0_26px_80px_rgba(0,0,0,0.34)] sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
          <div className="order-2 space-y-4 lg:order-1">
            <div className="inline-flex rounded-full border border-border bg-color-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-color-primary">
              Step 4 of 4
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-text-primary sm:text-3xl">Choose the final output</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary sm:leading-7">
                We already cleaned the image. Now choose whether this draft should leave the scan desk as an Excel sheet for correction workflows or as a PDF snapshot for sharing.
              </p>
            </div>
            <div className="overflow-hidden rounded-[1.7rem] border border-border bg-card-elevated">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-text-primary">{processFile?.name || "Current scan"}</div>
                  <div className="text-xs text-text-muted">Prepared after crop and enhancement</div>
                </div>
                <div className="rounded-full border border-border bg-card-elevated px-3 py-1 text-xs text-text-secondary">
                  {selectedFilter === "original" ? "Original tone" : `${selectedFilter} filter`}
                </div>
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_15rem]">
                <div className="overflow-hidden rounded-[1.4rem] border border-border bg-bg">
                  {displayEnhanceUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={displayEnhanceUrl} alt="Prepared scan preview" className="max-h-[22rem] w-full object-contain sm:max-h-[28rem]" />
                  ) : null}
                </div>
                <div className="space-y-3">
                  {[
                    "Crop corrections are already applied.",
                    "The first row will prefill date, material, and quantity.",
                    "Exports still route through the review draft for trust.",
                  ].map((item) => (
                    <div key={item} className="rounded-2xl border border-border bg-card-elevated px-4 py-3 text-sm text-text-secondary">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 space-y-4 rounded-[1.7rem] border border-border bg-card-elevated p-4 sm:p-5 lg:order-2">
            <div>
              <div className="text-lg font-semibold text-text-primary">Output destination</div>
              <div className="mt-1 text-sm text-text-muted">Choose what the operator needs next.</div>
            </div>
            <div className="space-y-3">
              {[
                { value: "excel" as const, label: "Generate Excel", icon: <ExcelIcon /> },
                { value: "pdf" as const, label: "Generate PDF", icon: <PdfIcon /> },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-4 rounded-[1.6rem] border px-5 py-5 text-left transition",
                    outputChoice === item.value
                      ? "border-color-primary bg-color-primary/10 shadow-[0_18px_40px_rgba(59,130,246,0.12)]"
                      : "border-border bg-card-elevated hover:bg-card",
                  )}
                  onClick={() => setOutputChoice(item.value)}
                >
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-bg text-color-primary">
                    {item.icon}
                  </span>
                  <span>
                    <span className="block text-lg font-semibold text-text-primary">{item.label}</span>
                    <span className="mt-1 block text-sm text-text-muted">
                      {item.value === "excel"
                        ? "Best for corrected rows, handoff, and downstream review."
                        : "Best for quick sharing and frozen visual output."}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-full bg-color-primary px-6 py-4 text-base font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busyAction || !processFile || !online}
              onClick={() => void handleProcess()}
            >
              {online ? "Start extraction" : "Reconnect to extract"}
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
  ) : null
}

{
  screen === "processing" ? (
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
  ) : null
}

{
  screen === "result" ? (
    <section className="flex min-h-screen items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
      <div className="w-full max-w-5xl rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(11,17,27,0.94),rgba(8,13,22,0.97))] p-4 shadow-[0_26px_80px_rgba(0,0,0,0.34)] sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]">
          <div className="order-2 space-y-5 lg:order-1">
            <div className="text-center lg:text-left">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-[1.6rem] border border-emerald-400/25 bg-emerald-400/10 text-emerald-200 lg:mx-0">
                <CheckIcon />
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">Conversion complete</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:leading-7">Draft ready.</p>
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
              <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-[1.4rem] border border-white/8 bg-black/30">
                    {displayEnhanceUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={displayEnhanceUrl} alt="Processed scan preview" className="max-h-[22rem] w-full object-contain sm:max-h-[28rem]" />
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Language</div>
                      <div className="mt-2 text-sm font-medium text-white">{resultPreview?.language || "auto"}</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Confidence</div>
                      <div className="mt-2 text-sm font-medium text-white">{formatConfidence(resultPreview?.avgConfidence ?? null)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Columns</div>
                      <div className="mt-2 text-sm font-medium text-white">{resultPreview?.columns || 0}</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Raw helper column</div>
                      <div className="mt-2 text-sm font-medium text-white">{resultPreview?.rawColumnAdded ? "Added" : "Not needed"}</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    ["Date", fields.date || "Not detected"],
                    ["Material", fields.material || "Not detected"],
                    ["Quantity", fields.quantity || "Not detected"],
                    ["Hints", qualityHints.length ? qualityHints.join(", ") : "No scan warnings"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
                      <div className="mt-2 text-sm font-medium text-white">{value}</div>
                    </div>
                  ))}
                  <div className="overflow-hidden rounded-[1.4rem] border border-white/8 bg-white/[0.04]">
                    <div className="border-b border-white/8 px-4 py-3">
                      <div className="text-sm font-semibold text-white">Extracted preview</div>
                      <div className="mt-1 text-xs text-slate-400">First rows from the corrected draft that will feed review and export.</div>
                    </div>
                    <div className="space-y-3 px-4 py-4 sm:hidden">
                      {(resultPreview?.rows.slice(0, 3) || []).map((row, rowIndex) => (
                        <div key={`mobile-preview-row-${rowIndex}`} className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Row {rowIndex + 1}</div>
                          <div className="mt-3 space-y-2">
                            {row.slice(0, Math.min(resultPreview?.columns || row.length, 4)).map((cell, cellIndex) => (
                              <div key={`mobile-preview-cell-${rowIndex}-${cellIndex}`} className="flex items-start justify-between gap-3 text-sm">
                                <span className="text-slate-400">Col {cellIndex + 1}</span>
                                <span className="max-w-[65%] text-right text-slate-200">{cell || "-"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {!resultPreview?.rows.length ? (
                        <div className="text-sm text-slate-400">Preview rows are not available yet.</div>
                      ) : null}
                    </div>
                    <div className="hidden overflow-x-auto sm:block">
                      <table className="min-w-full text-left text-sm">
                        <tbody>
                          {(resultPreview?.rows.slice(0, 4) || []).map((row, rowIndex) => (
                            <tr key={`preview-row-${rowIndex}`} className="border-b border-white/6 last:border-b-0">
                              {row.slice(0, Math.min(resultPreview?.columns || row.length, 5)).map((cell, cellIndex) => (
                                <td key={`preview-cell-${rowIndex}-${cellIndex}`} className="max-w-[9rem] px-4 py-3 align-top text-slate-200">
                                  <div className="truncate">{cell || "-"}</div>
                                </td>
                              ))}
                            </tr>
                          ))}
                          {!resultPreview?.rows.length ? (
                            <tr>
                              <td className="px-4 py-4 text-slate-400">Preview rows are not available yet.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 space-y-4 rounded-[1.7rem] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4 sm:p-5 lg:order-2">
            <div>
              <div className="text-lg font-semibold text-white">Export or continue review</div>
              <div className="mt-1 text-sm text-slate-400">Choose the next action for this OCR draft.</div>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-[1.5rem] border px-5 py-4 text-left transition",
                  savedId
                    ? "border-cyan-300/30 bg-cyan-300/10 hover:bg-cyan-300/14"
                    : "border-white/10 bg-white/[0.04]",
                )}
                disabled={busyAction || !savedId || !online}
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
            </div>

            {savedId ? (
              online ? (
                <Link
                  href={`/ocr/verify?verification_id=${savedId}`}
                  className="inline-flex w-full items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                >
                  Open this draft in Review Documents
                </Link>
              ) : (
                <div className="inline-flex w-full items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-400 opacity-70">
                  Reconnect to open in Review Documents
                </div>
              )
            ) : null}

            <button
              type="button"
              className="w-full text-sm font-medium text-cyan-300 transition hover:text-cyan-100"
              onClick={() => setShowInsights((current) => !current)}
            >
              {showInsights ? "Hide detailed insights" : "Show detailed insights"}
            </button>

            {showInsights ? (
              <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 text-left">
                {[
                  ["Draft", savedId ? `#${savedId}` : "Not saved"],
                  ["Excel source", savedId ? "Corrected review draft rows" : "Not ready"],
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
  ) : null
}

{
  (error || status) && screen !== "processing" ? (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-50 mx-auto w-[min(92vw,34rem)] rounded-[1.4rem] border px-4 py-3 text-sm shadow-[0_18px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl",
        error ? "border-red-400/25 bg-[rgba(127,29,29,0.85)] text-red-50" : "border-cyan-300/20 bg-[rgba(8,19,30,0.86)] text-cyan-50",
      )}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
    >
      {error || status}
    </div>
  ) : null
}

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
    </main >
  );
}
