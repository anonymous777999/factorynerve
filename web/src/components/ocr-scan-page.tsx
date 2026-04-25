"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { CameraCapture } from "@/components/ocr/camera-capture";
import { ErrorBanner } from "@/components/ocr/error-banner";
import { ExportPanel } from "@/components/ocr/export-panel";
import { ImagePreview } from "@/components/ocr/image-preview";
import { MobileEntry } from "@/components/ocr/mobile-entry";
import { OcrShell } from "@/components/ocr/ocr-shell";
import { PrepToolbar } from "@/components/ocr/prep-toolbar";
import { ProgressIndicator } from "@/components/ocr/progress-indicator";
import { RecentDocuments } from "@/components/ocr/recent-documents";
import { UploadBox } from "@/components/ocr/upload-box";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatApiErrorMessage } from "@/lib/api";
import { transferBlob } from "@/lib/blob-transfer";
import { createImageEnhancer } from "@/lib/image-enhance-client";
import { defaultEnhanceSettings, type CropBox, type EnhanceSettings } from "@/lib/image-enhance";
import { prepareOcrUploadFile } from "@/lib/file-prep";
import { canUseOcrScan, validateOcrImageFile } from "@/lib/ocr-access";
import { useOcrDevice } from "@/lib/ocr-device";
import {
  createOcrVerification,
  downloadOcrVerificationExport,
  listOcrVerifications,
  previewOcrLogbook,
  updateOcrVerification,
  warpOcrImage,
  type OcrRoutingMeta,
  type OcrVerificationRecord,
} from "@/lib/ocr";
import { exportRowsToCsv, exportRowsToJson } from "@/lib/ocr-export";
import {
  clearOcrUiState,
  dataUrlToFile,
  fileToDataUrl,
  loadOcrUiState,
  saveOcrUiState,
} from "@/lib/ocr-ui-state";
import { useSession } from "@/lib/use-session";
import { signalWorkflowRefresh } from "@/lib/workflow-sync";

const DataTableGrid = dynamic(
  () => import("@/components/ocr/data-table-grid").then((module) => module.DataTableGrid),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-[28px] border border-[#e7eaee] bg-white p-6">
        <div className="h-5 w-36 animate-pulse rounded-full bg-[#e4e8ed]" />
        <div className="mt-5 grid gap-2">
          {Array.from({ length: 5 }, (_, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }, (_, columnIndex) => (
                <div key={`${rowIndex}-${columnIndex}`} className="h-10 animate-pulse rounded-[14px] bg-[#f3f4f6]" />
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
  },
);

type OcrFlowStep = "entry" | "prepare" | "processing" | "result";
type FilterPreset = "original" | "clean" | "contrast";
type ProcessingStage = "uploading" | "extracting" | "detecting" | "preparing";
type CropPoint = { x: number; y: number };
type ResultPreview = {
  type: string;
  title: string;
  headers: string[];
  rows: string[][];
  rawText?: string | null;
  language: string;
  avgConfidence: number | null;
  warnings: string[];
  routing?: OcrRoutingMeta | null;
  reused?: boolean;
  columns: number;
};

const DEFAULT_CROP_POINTS: CropPoint[] = [
  { x: 0.12, y: 0.1 },
  { x: 0.88, y: 0.1 },
  { x: 0.88, y: 0.9 },
  { x: 0.12, y: 0.9 },
];
const FULL_CROP: CropBox = { left: 0, top: 0, right: 1, bottom: 1 };

function buildWarpedFile(blob: Blob, originalName: string) {
  const base = originalName.replace(/\.[^.]+$/, "") || "ocr-scan";
  return new File([blob], `${base}-warped.png`, { type: blob.type || "image/png" });
}

function buildEnhancedFile(blob: Blob, originalName: string) {
  const base = originalName.replace(/\.[^.]+$/, "") || "ocr-scan";
  return new File([blob], `${base}-enhanced.jpg`, { type: blob.type || "image/jpeg" });
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function defaultCropPoints() {
  return DEFAULT_CROP_POINTS.map((point) => ({ ...point }));
}

function toWarpCorners(points: CropPoint[], width: number, height: number) {
  return points.map((point) => [Math.round(point.x * width), Math.round(point.y * height)]);
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
      contrast: 36,
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

function formatConfidence(value: number | null) {
  if (value == null || Number.isNaN(value)) return "Confidence unavailable";
  return `${Math.round(value)}% confidence`;
}

function humanExtractError(error: unknown) {
  const message = formatApiErrorMessage(error, "Could not process this image.");
  const lowered = message.toLowerCase();
  if (lowered.includes("no table")) return "No table detected.";
  if (lowered.includes("no text")) return "The scan is too unclear to read.";
  if (lowered.includes("too large")) return "This image is too large to process.";
  if (lowered.includes("timed out")) return "Processing took too long.";
  return "OCR could not finish on this image.";
}

function humanExportError(error: unknown) {
  const message = formatApiErrorMessage(error, "Could not prepare Excel.");
  if (message.toLowerCase().includes("authentication")) {
    return "Excel export is unavailable right now.";
  }
  return "Excel export could not be prepared.";
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

export default function OcrScanPage() {
  const { user, loading, error: sessionError } = useSession();
  const { isMobile, ready: deviceReady } = useOcrDevice();

  const [step, setStep] = useState<OcrFlowStep>("entry");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterPreset>("clean");
  const [processingStage, setProcessingStage] = useState<ProcessingStage>("uploading");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [excelBusy, setExcelBusy] = useState(false);
  const [recentRecords, setRecentRecords] = useState<OcrVerificationRecord[]>([]);

  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [preparedPreviewFile, setPreparedPreviewFile] = useState<File | null>(null);
  const [preparedPreviewUrl, setPreparedPreviewUrl] = useState("");
  const [cropPoints, setCropPoints] = useState<CropPoint[]>(defaultCropPoints);
  const [activeHandle, setActiveHandle] = useState<number | null>(null);
  const [cropNaturalSize, setCropNaturalSize] = useState({ width: 0, height: 0 });

  const [resultPreview, setResultPreview] = useState<ResultPreview | null>(null);
  const [confidenceMatrix, setConfidenceMatrix] = useState<number[][]>([]);
  const [editableHeaders, setEditableHeaders] = useState<string[]>([]);
  const [editableRows, setEditableRows] = useState<string[][]>([]);
  const [documentHash, setDocumentHash] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [restored, setRestored] = useState(false);

  const cropSurfaceRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const canUseOcr = canUseOcrScan(user?.role);
  const displayPreviewUrl = preparedPreviewUrl || originalUrl;
  const activeImageFile = preparedPreviewFile || originalFile;

  const sideContent = useMemo(
    () =>
      recentRecords.length ? (
        <RecentDocuments records={recentRecords} compact />
      ) : null,
    [recentRecords],
  );

  const loadRecentRecords = useCallback(async () => {
    try {
      const records = await listOcrVerifications();
      setRecentRecords(records.slice(0, 8));
    } catch {
      setRecentRecords([]);
    }
  }, []);

  useEffect(() => {
    if (!canUseOcr) return;
    void loadRecentRecords();
  }, [canUseOcr, loadRecentRecords]);

  useEffect(() => {
    if (!originalUrl || originalUrl.startsWith("data:")) return;
    return () => URL.revokeObjectURL(originalUrl);
  }, [originalUrl]);

  useEffect(() => {
    if (!preparedPreviewUrl || preparedPreviewUrl.startsWith("data:")) return;
    return () => URL.revokeObjectURL(preparedPreviewUrl);
  }, [preparedPreviewUrl]);

  useEffect(() => {
    if (restored || typeof window === "undefined") return;
    const snapshot = loadOcrUiState();
    if (!snapshot) {
      setRestored(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      if (snapshot.imageDataUrl && snapshot.fileName && snapshot.fileType) {
        const file = await dataUrlToFile(snapshot.imageDataUrl, snapshot.fileName, snapshot.fileType);
        if (cancelled) return;
        setOriginalFile(file);
        setOriginalUrl(snapshot.imageDataUrl);
      }
      if (snapshot.preparedImageDataUrl && snapshot.fileName && snapshot.fileType) {
        const file = await dataUrlToFile(
          snapshot.preparedImageDataUrl,
          snapshot.fileName,
          snapshot.fileType,
        );
        if (cancelled) return;
        setPreparedPreviewFile(file);
        setPreparedPreviewUrl(snapshot.preparedImageDataUrl);
      }
      if (cancelled) return;
      setStep(snapshot.step || "entry");
      setSelectedFilter(snapshot.selectedFilter || "clean");
      setStatus(snapshot.status || "");
      setDocumentHash(snapshot.documentHash || null);
      setSavedId(snapshot.savedId ?? null);
      if (snapshot.title || snapshot.headers?.length || snapshot.rows?.length) {
        setResultPreview({
          type: snapshot.resultType || "table",
          title: snapshot.title || "OCR Extraction",
          headers: snapshot.headers || [],
          rows: snapshot.rows || [],
          language: "auto",
          avgConfidence: snapshot.confidence ?? null,
          warnings: snapshot.warnings || [],
          columns: Math.max(snapshot.headers?.length || 0, ...(snapshot.rows || []).map((row) => row.length), 1),
        });
        setEditableHeaders(snapshot.headers || []);
        setEditableRows(snapshot.rows || []);
      }
      setRestored(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [restored]);

  useEffect(() => {
    if (!restored) return;
    let cancelled = false;
    void (async () => {
      const imageDataUrl = await fileToDataUrl(originalFile);
      const preparedImageDataUrl = await fileToDataUrl(preparedPreviewFile);
      if (cancelled) return;
      saveOcrUiState({
        step,
        fileName: originalFile?.name,
        fileType: originalFile?.type,
        imageDataUrl,
        preparedImageDataUrl,
        selectedFilter,
        headers: editableHeaders,
        rows: editableRows,
        title: resultPreview?.title,
        resultType: resultPreview?.type,
        confidence: resultPreview?.avgConfidence ?? null,
        warnings: resultPreview?.warnings ?? [],
        documentHash,
        savedId,
        status,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    documentHash,
    editableHeaders,
    editableRows,
    originalFile,
    preparedPreviewFile,
    restored,
    resultPreview?.avgConfidence,
    resultPreview?.title,
    resultPreview?.type,
    resultPreview?.warnings,
    savedId,
    selectedFilter,
    status,
    step,
  ]);

  useEffect(() => {
    if (step !== "processing") return;
    setProcessingStage("uploading");
    const timers = [
      window.setTimeout(() => setProcessingStage("extracting"), 550),
      window.setTimeout(() => setProcessingStage("detecting"), 1400),
      window.setTimeout(() => setProcessingStage("preparing"), 2400),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [step]);

  const resetFlow = useCallback(() => {
    setStep("entry");
    setCameraOpen(false);
    setSelectedFilter("clean");
    setProcessingStage("uploading");
    setStatus("");
    setError("");
    setBusy(false);
    setSavingDraft(false);
    setExcelBusy(false);
    setOriginalFile(null);
    setOriginalUrl("");
    setPreparedPreviewFile(null);
    setPreparedPreviewUrl("");
    setCropPoints(defaultCropPoints());
    setCropNaturalSize({ width: 0, height: 0 });
    setResultPreview(null);
    setConfidenceMatrix([]);
    setEditableHeaders([]);
    setEditableRows([]);
    setDocumentHash(null);
    setSavedId(null);
    setDraftDirty(false);
    setRemoteUrl("");
    clearOcrUiState();
  }, []);

  const moveHandle = useCallback((index: number, clientX: number, clientY: number) => {
    const surface = cropSurfaceRef.current;
    if (!surface) return;
    const bounds = surface.getBoundingClientRect();
    const nextX = clamp01((clientX - bounds.left) / bounds.width);
    const nextY = clamp01((clientY - bounds.top) / bounds.height);
    setCropPoints((current) => {
      const next = current.map((point) => ({ ...point }));
      if (!next[index]) return current;
      next[index] = { x: nextX, y: nextY };
      return next;
    });
  }, []);

  const handleOverlayMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (activeHandle == null) return;
      moveHandle(activeHandle, event.clientX, event.clientY);
    },
    [activeHandle, moveHandle],
  );

  const chooseFile = useCallback((file: File | null) => {
    if (!file) return;
    const validationError = validateOcrImageFile(file, "Image");
    if (validationError) {
      setError(validationError);
      return;
    }

    if (originalUrl && !originalUrl.startsWith("data:")) {
      URL.revokeObjectURL(originalUrl);
    }
    if (preparedPreviewUrl && !preparedPreviewUrl.startsWith("data:")) {
      URL.revokeObjectURL(preparedPreviewUrl);
    }

    setOriginalFile(file);
    setOriginalUrl(URL.createObjectURL(file));
    setPreparedPreviewFile(null);
    setPreparedPreviewUrl("");
    setCropPoints(defaultCropPoints());
    setCropNaturalSize({ width: 0, height: 0 });
    setResultPreview(null);
    setConfidenceMatrix([]);
    setEditableHeaders([]);
    setEditableRows([]);
    setDocumentHash(null);
    setSavedId(null);
    setDraftDirty(false);
    setStatus("");
    setError("");
    setStep("prepare");
  }, [originalUrl, preparedPreviewUrl]);

  const handleImportUrl = useCallback(async () => {
    if (!remoteUrl.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(remoteUrl.trim());
      if (!response.ok) {
        throw new Error("Could not download this image.");
      }
      const blob = await response.blob();
      const type = blob.type || "image/jpeg";
      const extension = type.includes("png") ? "png" : "jpg";
      const file = new File([blob], `remote-image.${extension}`, { type });
      chooseFile(file);
      setRemoteUrl("");
    } catch (reason) {
      setError(formatApiErrorMessage(reason, "Could not import this image URL."));
    } finally {
      setBusy(false);
    }
  }, [chooseFile, remoteUrl]);

  const persistStructuredDraft = useCallback(async () => {
    if (!resultPreview || !originalFile) {
      return null;
    }
    const payload = {
      templateId: null,
      sourceFilename: originalFile.name,
      columns: Math.max(editableHeaders.length, ...editableRows.map((row) => row.length), 1),
      language: resultPreview.language,
      avgConfidence: resultPreview.avgConfidence ?? null,
      warnings: resultPreview.warnings,
      documentHash,
      docTypeHint: resultPreview.type || "table",
      routingMeta: resultPreview.routing ?? null,
      rawText: resultPreview.rawText ?? null,
      headers: editableHeaders,
      originalRows: resultPreview.rows,
      reviewedRows: editableRows,
      rawColumnAdded: false,
      reviewerNotes: "",
    };

    setSavingDraft(true);
    try {
      const record = savedId
        ? await updateOcrVerification(savedId, payload)
        : await createOcrVerification({
            ...payload,
            file: activeImageFile,
          });
      setSavedId(record.id);
      setDraftDirty(false);
      return record;
    } finally {
      setSavingDraft(false);
    }
  }, [
    activeImageFile,
    documentHash,
    editableHeaders,
    editableRows,
    originalFile,
    resultPreview,
    savedId,
  ]);

  useEffect(() => {
    if (!draftDirty || !resultPreview) return;
    const timer = window.setTimeout(() => {
      void persistStructuredDraft().then(() => {
        setStatus("Draft saved.");
        signalWorkflowRefresh("ocr-scan-autosave");
      }).catch(() => undefined);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [draftDirty, persistStructuredDraft, resultPreview]);

  const buildPreparedImage = useCallback(async () => {
    if (!originalFile) {
      throw new Error("Choose an image first.");
    }

    let workingFile = originalFile;
    let workingUrl = originalUrl;

    if (cropNaturalSize.width && cropNaturalSize.height) {
      const warped = await withTimeout(
        warpOcrImage({
          file: originalFile,
          corners: toWarpCorners(cropPoints, cropNaturalSize.width, cropNaturalSize.height),
        }),
        10000,
        "Perspective correction timed out.",
      );
      workingFile = buildWarpedFile(warped.blob, originalFile.name);
      workingUrl = URL.createObjectURL(warped.blob);
    }

    if (selectedFilter !== "original") {
      const enhancer = createImageEnhancer();
      try {
        const enhanced = await enhancer.enhance(
          workingFile,
          buildEnhanceSettings(selectedFilter, FULL_CROP),
        );
        if (workingUrl && workingUrl !== originalUrl && !workingUrl.startsWith("data:")) {
          URL.revokeObjectURL(workingUrl);
        }
        workingFile = buildEnhancedFile(enhanced.blob, workingFile.name);
        workingUrl = enhanced.previewUrl;
      } finally {
        enhancer.dispose();
      }
    }

    setPreparedPreviewFile(workingFile);
    setPreparedPreviewUrl(workingUrl);
    return workingFile;
  }, [cropNaturalSize.height, cropNaturalSize.width, cropPoints, originalFile, originalUrl, selectedFilter]);

  const handleProcess = useCallback(async () => {
    if (!originalFile) return;
    setBusy(true);
    setError("");
    setStatus("");
    setStep("processing");

    try {
      const preparedSource = await buildPreparedImage();
      const prepared = await prepareOcrUploadFile(preparedSource);
      const result = await withTimeout(
        previewOcrLogbook({
          file: prepared.file,
          columns: 5,
          language: "auto",
          docTypeHint: "table",
          forceModel: "auto",
          documentHash: prepared.sha256,
        }),
        25000,
        "OCR processing timed out.",
      );

      const headers =
        result.headers?.length
          ? result.headers
          : Array.from({ length: Math.max(result.columns || 0, ...(result.rows || []).map((row) => row.length), 1) }, (_, index) => `Column ${index + 1}`);
      const rows = (result.rows || []).map((row) =>
        Array.from({ length: headers.length }, (_, index) => String(row[index] ?? "")),
      );
      const preview: ResultPreview = {
        type: result.type || "table",
        title: result.title || "OCR Extraction",
        headers,
        rows,
        rawText: result.raw_text ?? null,
        language: result.used_language || "auto",
        avgConfidence: result.avg_confidence ?? result.confidence ?? null,
        warnings: result.warnings ?? [],
        routing: result.routing ?? null,
        reused: result.reused ?? false,
        columns: headers.length,
      };

      setDocumentHash(prepared.sha256);
      setResultPreview(preview);
      setConfidenceMatrix(result.cell_confidence || []);
      setEditableHeaders(headers);
      setEditableRows(rows);
      setDraftDirty(false);
      setStep("result");

      if (result.reused_verification_id) {
        setSavedId(result.reused_verification_id);
      } else {
        const saved = await createOcrVerification({
          templateId: null,
          sourceFilename: originalFile.name,
          columns: preview.columns,
          language: preview.language,
          avgConfidence: preview.avgConfidence ?? null,
          warnings: preview.warnings,
          documentHash: prepared.sha256,
          docTypeHint: preview.type,
          routingMeta: preview.routing ?? null,
          rawText: preview.rawText ?? null,
          headers,
          originalRows: preview.rows,
          reviewedRows: rows,
          rawColumnAdded: false,
          reviewerNotes: "",
          file: prepared.file,
        });
        setSavedId(saved.id);
      }

      setStatus(result.reused ? "Existing OCR draft reopened." : "Sheet ready to review.");
      signalWorkflowRefresh("ocr-scan");
      void loadRecentRecords();
    } catch (reason) {
      setError(humanExtractError(reason));
      setStep(originalFile ? "prepare" : "entry");
    } finally {
      setBusy(false);
    }
  }, [buildPreparedImage, loadRecentRecords, originalFile]);

  const handleDownloadExcel = useCallback(async () => {
    setExcelBusy(true);
    setError("");
    try {
      const record = draftDirty ? await persistStructuredDraft() : null;
      const verificationId = record?.id ?? savedId;
      if (!verificationId) {
        throw new Error("Save the OCR draft before exporting.");
      }
      const download = await downloadOcrVerificationExport(verificationId);
      const result = await transferBlob(download.blob, download.filename);
      setStatus(result === "shared" ? "Excel shared." : "Excel downloaded.");
      signalWorkflowRefresh("ocr-export");
    } catch (reason) {
      setError(humanExportError(reason));
    } finally {
      setExcelBusy(false);
    }
  }, [draftDirty, persistStructuredDraft, savedId]);

  const handleDownloadCsv = useCallback(async () => {
    try {
      const blob = new Blob([exportRowsToCsv(editableHeaders, editableRows)], {
        type: "text/csv;charset=utf-8",
      });
      const result = await transferBlob(blob, "ocr-sheet.csv");
      setStatus(result === "shared" ? "CSV shared." : "CSV downloaded.");
    } catch {
      setError("CSV export could not be prepared.");
    }
  }, [editableHeaders, editableRows]);

  const handleDownloadJson = useCallback(async () => {
    try {
      const blob = new Blob([exportRowsToJson(editableHeaders, editableRows)], {
        type: "application/json;charset=utf-8",
      });
      const result = await transferBlob(blob, "ocr-sheet.json");
      setStatus(result === "shared" ? "JSON shared." : "JSON downloaded.");
    } catch {
      setError("JSON export could not be prepared.");
    }
  }, [editableHeaders, editableRows]);

  const setHeadersWithDirtyState = useCallback((nextHeaders: string[]) => {
    setEditableHeaders(nextHeaders);
    setDraftDirty(true);
  }, []);

  const setRowsWithDirtyState = useCallback((nextRows: string[][]) => {
    setEditableRows(nextRows);
    setDraftDirty(true);
  }, []);

  if (loading || !deviceReady || !restored) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading OCR workspace...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>OCR Workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Please sign in to continue."}</div>
            <Link href="/access">
              <Button>Open Access</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!canUseOcr) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>OCR Workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">
              Your role does not have access to document scan.
            </div>
            <Link href="/dashboard">
              <Button>Back to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <>
      {cameraOpen ? (
        <CameraCapture
          onClose={() => setCameraOpen(false)}
          onCapture={chooseFile}
          onUploadInstead={() => uploadInputRef.current?.click()}
        />
      ) : null}

      <input
        ref={uploadInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/heic,image/heif"
        className="hidden"
        onChange={(event) => {
          chooseFile(event.target.files?.[0] || null);
          event.target.value = "";
        }}
      />

      <OcrShell
        title={isMobile ? "Scan paper into an editable sheet" : "Turn paper tables into a clean sheet"}
        subtitle={
          isMobile
            ? "Capture fast, check the extracted rows, and export the sheet without leaving the workflow."
            : "Drop one image, clean the crop, correct the rows, and download the export."
        }
        step={step}
        mobile={isMobile}
        sideContent={step === "entry" ? sideContent : null}
      >
        <div className="space-y-4">
          {error ? (
            <ErrorBanner
              message={error}
              actionLabel={step === "result" || step === "prepare" ? "Try another image" : "Upload instead"}
              onAction={() => {
                if (step === "entry") {
                  uploadInputRef.current?.click();
                } else {
                  resetFlow();
                }
              }}
            />
          ) : null}
          {!error && status ? <ErrorBanner tone="success" message={status} /> : null}

          {step === "entry" ? (
            isMobile ? (
              <MobileEntry
                recentCount={recentRecords.length}
                onOpenCamera={() => setCameraOpen(true)}
                onOpenUpload={() => uploadInputRef.current?.click()}
              />
            ) : (
              <UploadBox
                disabled={busy}
                fileName={originalFile?.name || null}
                remoteUrl={remoteUrl}
                onRemoteUrlChange={setRemoteUrl}
                onUploadFile={chooseFile}
                onImportUrl={() => void handleImportUrl()}
              />
            )
          ) : null}

          {step === "prepare" && displayPreviewUrl ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="overflow-hidden rounded-[28px] border border-[#e7eaee] bg-white">
                <div className="border-b border-[#eff2f5] px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a93a0]">
                    Prepare
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[#101418]">
                    Adjust once, then run extraction
                  </div>
                  <div className="mt-1 text-sm text-[#66707c]">
                    Crop the page and pick the enhancement preset.
                  </div>
                </div>
                <div className="grid min-h-[24rem] place-items-center bg-[#f6f7f8] p-4">
                  <div
                    ref={cropSurfaceRef}
                    className="relative inline-block touch-none overflow-hidden rounded-[24px]"
                    onPointerMove={handleOverlayMove}
                    onPointerUp={() => setActiveHandle(null)}
                    onPointerCancel={() => setActiveHandle(null)}
                    onPointerLeave={() => setActiveHandle(null)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={displayPreviewUrl}
                      alt="OCR preparation preview"
                      className="block max-h-[68vh] w-auto max-w-full object-contain"
                      onLoad={(event) => {
                        setCropNaturalSize({
                          width: event.currentTarget.naturalWidth,
                          height: event.currentTarget.naturalHeight,
                        });
                      }}
                    />
                    <svg
                      className="absolute inset-0 h-full w-full"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <mask id="ocr-crop-mask">
                          <rect width="100" height="100" fill="white" />
                          <polygon
                            points={cropPoints.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")}
                            fill="black"
                          />
                        </mask>
                      </defs>
                      <rect width="100" height="100" fill="rgba(17,24,39,0.42)" mask="url(#ocr-crop-mask)" />
                      <polygon
                        points={cropPoints.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")}
                        fill="rgba(255,255,255,0.08)"
                        stroke="#111827"
                        strokeWidth="0.9"
                      />
                    </svg>
                    {cropPoints.map((point, index) => (
                      <button
                        key={`${index}-${point.x}-${point.y}`}
                        type="button"
                        className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#111827] shadow-[0_0_0_6px_rgba(17,24,39,0.14)]"
                        style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          setActiveHandle(index);
                          cropSurfaceRef.current?.setPointerCapture?.(event.pointerId);
                          moveHandle(index, event.clientX, event.clientY);
                        }}
                        aria-label={`Move crop handle ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <PrepToolbar
                  selectedFilter={selectedFilter}
                  onFilterChange={setSelectedFilter}
                  onRetake={resetFlow}
                  disabled={busy}
                />
                <div className="rounded-[28px] border border-[#e7eaee] bg-white p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a93a0]">
                    Next
                  </div>
                  <div className="mt-1 text-sm text-[#66707c]">Run OCR on the prepared page.</div>
                  <Button
                    type="button"
                    className="mt-4 h-12 w-full rounded-[18px] bg-[#111827] text-white shadow-none hover:bg-[#1f2937]"
                    onClick={() => void handleProcess()}
                    disabled={busy}
                  >
                    {busy ? "Preparing sheet..." : "Extract Sheet"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {step === "processing" ? (
            <ProgressIndicator thumbnailSrc={displayPreviewUrl || null} stage={processingStage} />
          ) : null}

          {step === "result" && resultPreview ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="space-y-4">
                {displayPreviewUrl ? (
                  <ImagePreview
                    src={displayPreviewUrl}
                    alt="Processed OCR preview"
                    badge={resultPreview.reused ? "Preview • reused draft" : "Preview"}
                    title={resultPreview.title}
                    subtitle={formatConfidence(resultPreview.avgConfidence)}
                  />
                ) : null}

                <ExportPanel
                  canDownloadExcel={Boolean(savedId || originalFile)}
                  busy={excelBusy || savingDraft}
                  status={draftDirty ? "Saving edits in the background." : "Ready for export."}
                  onDownloadExcel={() => void handleDownloadExcel()}
                  onDownloadCsv={() => void handleDownloadCsv()}
                  onDownloadJson={() => void handleDownloadJson()}
                  secondaryAction={
                    <div className="space-y-3">
                      {savedId ? (
                        <Link href={`/ocr/verify?verification_id=${savedId}`} className="block">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-11 w-full rounded-[18px] border border-[#eef1f4] bg-[#fbfbfa] text-[#475467] hover:bg-white"
                          >
                            Open Review
                          </Button>
                        </Link>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-11 w-full rounded-[18px] border border-[#eef1f4] bg-[#fbfbfa] text-[#475467] hover:bg-white"
                        onClick={resetFlow}
                      >
                        Scan another image
                      </Button>
                    </div>
                  }
                />
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a93a0]">
                    {resultPreview.language}
                  </span>
                  {resultPreview.routing ? (
                    <span className="rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a93a0]">
                      {resultPreview.routing.model_tier}
                    </span>
                  ) : null}
                  {resultPreview.warnings.map((warning) => (
                    <span
                      key={warning}
                      className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700"
                    >
                      {warning.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>

                <DataTableGrid
                  headers={editableHeaders}
                  rows={editableRows}
                  confidenceMatrix={confidenceMatrix}
                  onChangeHeaders={setHeadersWithDirtyState}
                  onChangeRows={setRowsWithDirtyState}
                />
              </div>
            </div>
          ) : null}
        </div>
      </OcrShell>
    </>
  );
}
