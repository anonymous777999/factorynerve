"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CameraCapture } from "@/components/ocr/camera-capture";
import { EditToolbar } from "@/components/ocr/edit-toolbar";
import { ExportPanel } from "@/components/ocr/export-panel";
import { KeyboardShortcutStrip } from "@/components/ocr/keyboard-shortcut-strip";
import { MobileEntry } from "@/components/ocr/mobile-entry";
import { ProgressIndicator } from "@/components/ocr/progress-indicator";
import { ShareLinkGenerator } from "@/components/ocr/share-link-generator";
import { UploadBox } from "@/components/ocr/upload-box";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatApiErrorMessage } from "@/lib/api";
import { transferBlob } from "@/lib/blob-transfer";
import { rasterizeDocumentForOcr } from "@/lib/document-rasterize";
import { prepareOcrUploadFile } from "@/lib/file-prep";
import { canUseOcrScan, validateOcrImageFile } from "@/lib/ocr-access";
import { useOcrDevice } from "@/lib/ocr-device";
import {
  createOcrVerification,
  createOcrVerificationShareLink,
  downloadOcrVerificationExport,
  getOcrVerification,
  listOcrVerifications,
  previewOcrLogbook,
  updateOcrVerification,
  warpOcrImage,
  type OcrPreviewResult,
  type OcrRoutingMeta,
  type OcrScanQuality,
  type OcrVerificationRecord,
} from "@/lib/ocr";
import {
  buildStructuredPdfBlob,
  exportRowsToClipboardText,
  exportRowsToCsv,
  exportRowsToJson,
} from "@/lib/ocr-export";
import {
  clearOcrUiState,
  dataUrlToFile,
  fileToDataUrl,
  loadOcrUiState,
  saveOcrUiState,
} from "@/lib/ocr-ui-state";
import { warmBackendConnection } from "@/lib/auth";
import { useSession } from "@/lib/use-session";
import { signalWorkflowRefresh } from "@/lib/workflow-sync";

const DataTableGrid = dynamic(
  () => import("@/components/ocr/data-table-grid").then((module) => module.DataTableGrid),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-[28px] border border-[#e3e8ef] bg-white p-6">
        <div className="h-5 w-36 animate-pulse rounded-full bg-[#e6ebf1]" />
        <div className="mt-5 grid gap-2">
          {Array.from({ length: 5 }, (_, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }, (_, columnIndex) => (
                <div key={`${rowIndex}-${columnIndex}`} className="h-10 animate-pulse rounded-[14px] bg-[#f4f6f8]" />
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
  },
);

type OcrFlowStep = "upload" | "processing" | "preview" | "export";
type ProcessingStage = "uploaded" | "preprocess" | "detect" | "extract" | "confidence";
type OcrColumnType = "text" | "number" | "date";
type ActiveCell = { row: number; column: number } | null;

type ResultPreview = {
  type: string;
  title: string;
  headers: string[];
  rows: string[][];
  rawText?: string | null;
  language: string;
  avgConfidence: number | null;
  warnings: string[];
  scanQuality?: OcrScanQuality | null;
  routingMeta?: OcrRoutingMeta | null;
  routingLabel?: string | null;
  reused?: boolean;
};

type TableSnapshot = {
  headers: string[];
  rows: string[][];
  columnTypes: OcrColumnType[];
  headerRowEnabled: boolean;
};

const STEP_LABELS: Array<{ key: OcrFlowStep; label: string }> = [
  { key: "upload", label: "Upload" },
  { key: "processing", label: "Processing" },
  { key: "preview", label: "Preview & Edit" },
  { key: "export", label: "Export" },
];

function cloneRows(rows: string[][]) {
  return rows.map((row) => [...row]);
}

function defaultHeaders(columnCount: number) {
  return Array.from({ length: Math.max(columnCount, 1) }, (_, index) => `Column ${index + 1}`);
}

function inferColumnTypes(rows: string[][], headerCount: number): OcrColumnType[] {
  return Array.from({ length: Math.max(headerCount, 1) }, (_, index) => {
    const values = rows.map((row) => (row[index] || "").trim()).filter(Boolean);
    if (!values.length) return "text";
    if (values.every((value) => /^-?\d+(?:[.,]\d+)?$/.test(value))) return "number";
    if (values.every((value) => !Number.isNaN(Date.parse(value)))) return "date";
    return "text";
  });
}

function buildWarpedFile(blob: Blob, originalName: string) {
  const base = originalName.replace(/\.[^.]+$/, "") || "ocr-scan";
  return new File([blob], `${base}-deskewed.png`, { type: blob.type || "image/png" });
}

function formatConfidence(value: number | null) {
  if (value == null || Number.isNaN(value)) return "Confidence unavailable";
  return `${Math.round(value)}% confidence`;
}

function lowConfidenceCount(matrix: number[][], visible: boolean) {
  if (!visible) return 0;
  return matrix.reduce(
    (sum, row) => sum + row.filter((value) => typeof value === "number" && value < 85).length,
    0,
  );
}

function countCorrections(originalRows: string[][], reviewedRows: string[][]) {
  const rowCount = Math.max(originalRows.length, reviewedRows.length);
  let changes = 0;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const original = originalRows[rowIndex] || [];
    const reviewed = reviewedRows[rowIndex] || [];
    const columnCount = Math.max(original.length, reviewed.length);
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      if ((original[columnIndex] || "") !== (reviewed[columnIndex] || "")) {
        changes += 1;
      }
    }
  }
  return changes;
}

function humanExtractError(error: unknown) {
  const message = formatApiErrorMessage(error, "Could not process this image.");
  const lowered = message.toLowerCase();
  if (lowered.includes("no table")) return "No table structure found in this image.";
  if (lowered.includes("no text")) return "The scan is too unclear to read.";
  if (lowered.includes("too large")) return "Max 20 MB. Try compressing the image.";
  if (lowered.includes("only image files are supported")) {
    return "This file could not be prepared for OCR. Try PNG, JPG, PDF, or TIFF.";
  }
  if (lowered.includes("anthropic") || lowered.includes("bytez") || lowered.includes("provider")) {
    return "The structured OCR provider is unavailable right now. Please retry in a moment.";
  }
  if (lowered.includes("tesseract") || lowered.includes("pytesseract")) {
    return "The OCR engine is unavailable right now. Please retry shortly.";
  }
  if (lowered.includes("timed out")) return "Extraction took too long. Please retry.";
  if (
    message &&
    message !== "Could not process this image." &&
    !lowered.includes("failed unexpectedly") &&
    !lowered.includes("request failed")
  ) {
    return message;
  }
  return "Extraction failed. Please retry.";
}

function humanDraftSaveError(error: unknown) {
  const message = formatApiErrorMessage(error, "Could not save this OCR draft.");
  const lowered = message.toLowerCase();
  if (lowered.includes("not authenticated") || lowered.includes("sign in")) {
    return "Your session expired. Sign in again to save this OCR draft.";
  }
  if (lowered.includes("too large")) {
    return "The extracted sheet is ready, but saving the draft failed because the upload is too large.";
  }
  return "The sheet was extracted, but saving the OCR draft failed. You can keep editing while we retry.";
}

function humanExportError(error: unknown) {
  const message = formatApiErrorMessage(error, "Could not prepare Excel.");
  if (message.toLowerCase().includes("authentication")) {
    return "Export is unavailable right now.";
  }
  return "Export could not be prepared.";
}

async function inspectImageWarning(file: File) {
  if (file.size < 110_000) {
    return "The source looks heavily compressed.";
  }
  const url = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("Could not inspect image."));
      image.src = url;
    });
    if (dimensions.width < 1100 || dimensions.height < 1100) {
      return "The source resolution is low, so OCR may need more corrections.";
    }
    return null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function buildApproximateBoundingBox(activeCell: ActiveCell, rowCount: number, columnCount: number) {
  if (!activeCell || rowCount <= 0 || columnCount <= 0) return null;
  const width = 100 / columnCount;
  const height = 100 / rowCount;
  return {
    left: `${activeCell.column * width}%`,
    top: `${activeCell.row * height}%`,
    width: `${width}%`,
    height: `${height}%`,
  };
}

function buildBoundingBox(
  activeCell: ActiveCell,
  scanQuality: OcrScanQuality | null | undefined,
  rowCount: number,
  columnCount: number,
) {
  const actual = activeCell
    ? scanQuality?.cell_boxes?.[activeCell.row]?.[activeCell.column] || null
    : null;
  if (actual) {
    return {
      left: `${actual.x * 100}%`,
      top: `${actual.y * 100}%`,
      width: `${actual.width * 100}%`,
      height: `${actual.height * 100}%`,
    };
  }
  return buildApproximateBoundingBox(activeCell, rowCount, columnCount);
}

function statusBannerClass(tone: "error" | "success" | "warning") {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-red-200 bg-red-50 text-red-900";
}

export default function OcrScanPage() {
  const { user, loading, error: sessionError } = useSession();
  const { isMobile, ready: deviceReady } = useOcrDevice();

  const [step, setStep] = useState<OcrFlowStep>("upload");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>("uploaded");
  const [busy, setBusy] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [excelBusy, setExcelBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"error" | "success" | "warning">("success");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [recentRecords, setRecentRecords] = useState<OcrVerificationRecord[]>([]);
  const [sourceFilename, setSourceFilename] = useState("");

  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [preparedPreviewFile, setPreparedPreviewFile] = useState<File | null>(null);
  const [preparedPreviewUrl, setPreparedPreviewUrl] = useState("");
  const [finalUploadFile, setFinalUploadFile] = useState<File | null>(null);
  const [processingWarning, setProcessingWarning] = useState<string | null>(null);

  const [resultPreview, setResultPreview] = useState<ResultPreview | null>(null);
  const [confidenceMatrix, setConfidenceMatrix] = useState<number[][]>([]);
  const [editableHeaders, setEditableHeaders] = useState<string[]>([]);
  const [editableRows, setEditableRows] = useState<string[][]>([]);
  const [columnTypes, setColumnTypes] = useState<OcrColumnType[]>([]);
  const [headerRowEnabled, setHeaderRowEnabled] = useState(false);
  const [showLowConfidence, setShowLowConfidence] = useState(true);
  const [activeCell, setActiveCell] = useState<ActiveCell>(null);
  const [zoom, setZoom] = useState(1);
  const [documentHash, setDocumentHash] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const historyRef = useRef<TableSnapshot[]>([]);
  const historyIndexRef = useRef(-1);
  const [, setHistoryVersion] = useState(0);

  const canUseOcr = canUseOcrScan(user?.role);
  const displayPreviewUrl = preparedPreviewUrl || originalUrl;
  const correctionCount = useMemo(
    () => countCorrections(resultPreview?.rows || [], editableRows),
    [editableRows, resultPreview?.rows],
  );
  const visibleLowConfidenceCount = useMemo(
    () => lowConfidenceCount(confidenceMatrix, showLowConfidence),
    [confidenceMatrix, showLowConfidence],
  );
  const boundingBox = useMemo(
    () =>
      buildBoundingBox(
        activeCell,
        resultPreview?.scanQuality,
        Math.max(editableRows.length, 1),
        Math.max(editableHeaders.length, 1),
      ),
    [activeCell, editableHeaders.length, editableRows.length, resultPreview?.scanQuality],
  );

  const applySnapshot = useCallback((snapshot: TableSnapshot) => {
    setEditableHeaders(snapshot.headers);
    setEditableRows(snapshot.rows);
    setColumnTypes(snapshot.columnTypes);
    setHeaderRowEnabled(snapshot.headerRowEnabled);
  }, []);

  const pushSnapshot = useCallback((snapshot: TableSnapshot) => {
    const serialized = JSON.stringify(snapshot);
    const base = historyRef.current.slice(0, historyIndexRef.current + 1);
    const previous = base[base.length - 1];
    if (previous && JSON.stringify(previous) === serialized) {
      applySnapshot(snapshot);
      return;
    }
    const next = [...base, snapshot];
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
    applySnapshot(snapshot);
    setDraftDirty(true);
    setHistoryVersion((value) => value + 1);
  }, [applySnapshot]);

  const resetHistory = useCallback((snapshot: TableSnapshot) => {
    historyRef.current = [snapshot];
    historyIndexRef.current = 0;
    applySnapshot(snapshot);
    setHistoryVersion((value) => value + 1);
  }, [applySnapshot]);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current >= 0 && historyIndexRef.current < historyRef.current.length - 1;

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
    if (!originalUrl || !originalUrl.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(originalUrl);
  }, [originalUrl]);

  useEffect(() => {
    if (!preparedPreviewUrl || !preparedPreviewUrl.startsWith("blob:")) return;
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
        setSourceFilename(snapshot.fileName || "");
        setOriginalFile(file);
        setOriginalUrl(snapshot.imageDataUrl);
      }
      if (snapshot.preparedImageDataUrl && snapshot.fileName && snapshot.fileType) {
        const file = await dataUrlToFile(snapshot.preparedImageDataUrl, snapshot.fileName, snapshot.fileType);
        if (cancelled) return;
        setPreparedPreviewFile(file);
        setPreparedPreviewUrl(snapshot.preparedImageDataUrl);
      }
      if (cancelled) return;
      const restoredStep =
        snapshot.step === "entry"
          ? "upload"
          : snapshot.step === "result"
            ? "preview"
            : snapshot.step === "prepare"
              ? "preview"
              : (snapshot.step as OcrFlowStep) || "upload";
      setStep(restoredStep);
      setStatus(snapshot.status || "");
      setDocumentHash(snapshot.documentHash || null);
      setSavedId(snapshot.savedId ?? null);
      setShowLowConfidence(snapshot.showLowConfidence ?? true);
      setHeaderRowEnabled(snapshot.headerRowEnabled ?? false);
      if (snapshot.title || snapshot.headers?.length || snapshot.rows?.length) {
        const headers = snapshot.headers || defaultHeaders((snapshot.rows?.[0] || []).length || 1);
        const rows = snapshot.rows || [];
        const nextTypes = snapshot.columnTypes || inferColumnTypes(rows, headers.length);
        setResultPreview({
          type: snapshot.resultType || "table",
          title: snapshot.title || "OCR Extraction",
          headers,
          rows,
          language: "auto",
          avgConfidence: snapshot.confidence ?? null,
          warnings: snapshot.warnings || [],
          routingMeta: null,
          routingLabel: null,
        });
        resetHistory({
          headers,
          rows,
          columnTypes: nextTypes,
          headerRowEnabled: snapshot.headerRowEnabled ?? false,
        });
      }
      setRestored(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [resetHistory, restored]);

  useEffect(() => {
    if (!restored) return;
    let cancelled = false;
    void (async () => {
      const imageDataUrl = await fileToDataUrl(originalFile);
      const preparedImageDataUrl = await fileToDataUrl(preparedPreviewFile);
      if (cancelled) return;
      saveOcrUiState({
        step,
        fileName: sourceFilename || originalFile?.name,
        fileType: originalFile?.type,
        imageDataUrl,
        preparedImageDataUrl,
        headers: editableHeaders,
        rows: editableRows,
        columnTypes,
        title: resultPreview?.title,
        resultType: resultPreview?.type,
        confidence: resultPreview?.avgConfidence ?? null,
        warnings: resultPreview?.warnings ?? [],
        documentHash,
        savedId,
        status,
        showLowConfidence,
        headerRowEnabled,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    columnTypes,
    documentHash,
    editableHeaders,
    editableRows,
    headerRowEnabled,
    originalFile,
    preparedPreviewFile,
    restored,
    resultPreview?.avgConfidence,
    resultPreview?.title,
    resultPreview?.type,
    resultPreview?.warnings,
    savedId,
    showLowConfidence,
    sourceFilename,
    status,
    step,
  ]);

  const resetFlow = useCallback(() => {
    setStep("upload");
    setBusy(false);
    setCameraOpen(false);
    setProcessingStage("uploaded");
    setStatus("");
    setRemoteUrl("");
    setSourceFilename("");
    setOriginalFile(null);
    setOriginalUrl("");
    setPreparedPreviewFile(null);
    setPreparedPreviewUrl("");
    setFinalUploadFile(null);
    setProcessingWarning(null);
    setResultPreview(null);
    setConfidenceMatrix([]);
    setEditableHeaders([]);
    setEditableRows([]);
    setColumnTypes([]);
    setHeaderRowEnabled(false);
    setShowLowConfidence(true);
    setActiveCell(null);
    setZoom(1);
    setDocumentHash(null);
    setSavedId(null);
    setDraftDirty(false);
    setShareLink(null);
    setShareExpiresAt(null);
    historyRef.current = [];
    historyIndexRef.current = -1;
    clearOcrUiState();
  }, []);

  const persistStructuredDraft = useCallback(async () => {
    if (!resultPreview) {
      return null;
    }
    const payload = {
      templateId: null,
      sourceFilename: sourceFilename || originalFile?.name || "ocr-image",
      columns: Math.max(editableHeaders.length, ...editableRows.map((row) => row.length), 1),
      language: resultPreview.language,
      avgConfidence: resultPreview.avgConfidence ?? null,
      warnings: resultPreview.warnings,
      scanQuality: resultPreview.scanQuality ?? null,
      documentHash,
      docTypeHint: resultPreview.type || "table",
      routingMeta: resultPreview.routingMeta ?? null,
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
            file: finalUploadFile || preparedPreviewFile || originalFile,
          });
      setSavedId(record.id);
      setDraftDirty(false);
      return record;
    } finally {
      setSavingDraft(false);
    }
  }, [
    documentHash,
    editableHeaders,
    editableRows,
    finalUploadFile,
    originalFile,
    preparedPreviewFile,
    resultPreview,
    savedId,
    sourceFilename,
  ]);

  useEffect(() => {
    if (!draftDirty || !resultPreview) return;
    const timer = window.setTimeout(() => {
      void persistStructuredDraft()
        .then(() => {
          setStatus("Edits saved.");
          setStatusTone("success");
          signalWorkflowRefresh("ocr-scan-autosave");
        })
        .catch((error) => {
          console.error("OCR draft autosave failed:", error);
        });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [draftDirty, persistStructuredDraft, resultPreview]);

  const processFile = useCallback(async (file: File, sourceName: string) => {
    setBusy(true);
    setStatus("");
    setShareLink(null);
    setShareExpiresAt(null);
    setStep("processing");
    setProcessingStage("uploaded");
    setStatusTone("success");
    setProcessingWarning(await inspectImageWarning(file));

    try {
      const backendWake = warmBackendConnection();
      setProcessingStage("preprocess");
      const normalizedSource = await prepareOcrUploadFile(file);
      const backendReady = await backendWake;
      if (!backendReady) {
        throw new Error("OCR service is waking up. Please retry in a few seconds.");
      }
      let deskewedFile = normalizedSource.file;
      let deskewedUrl = URL.createObjectURL(normalizedSource.file);
      let warpSkipped = false;

      try {
        const warped = await warpOcrImage({ file: normalizedSource.file });
        deskewedFile = buildWarpedFile(warped.blob, file.name);
        URL.revokeObjectURL(deskewedUrl);
        deskewedUrl = URL.createObjectURL(warped.blob);
      } catch {
        warpSkipped = true;
      }

      setPreparedPreviewFile(deskewedFile);
      setPreparedPreviewUrl(deskewedUrl);

      const prepared = await prepareOcrUploadFile(deskewedFile);
      setFinalUploadFile(prepared.file);
      setDocumentHash(prepared.sha256);
      setProcessingStage("detect");

      const extractTimer = window.setTimeout(() => setProcessingStage("extract"), 500);
      const confidenceTimer = window.setTimeout(() => setProcessingStage("confidence"), 1300);

      let result: OcrPreviewResult;
      try {
        result = await previewOcrLogbook({
          file: prepared.file,
          columns: 5,
          language: "auto",
          docTypeHint: "table",
          forceModel: "auto",
          documentHash: prepared.sha256,
        });
      } finally {
        window.clearTimeout(extractTimer);
        window.clearTimeout(confidenceTimer);
      }

      const headers =
        result.headers?.length
          ? result.headers
          : defaultHeaders(Math.max(result.columns || 0, ...(result.rows || []).map((row) => row.length), 1));
      const rows = (result.rows || []).map((row) =>
        Array.from({ length: headers.length }, (_, index) => String(row[index] ?? "")),
      );
      const nextPreview: ResultPreview = {
        type: result.type || "table",
        title: result.title || "OCR Extraction",
        headers,
        rows,
        rawText: result.raw_text ?? null,
        language: result.used_language || "auto",
        avgConfidence: result.avg_confidence ?? result.confidence ?? null,
        warnings: warpSkipped
          ? Array.from(new Set([...(result.warnings ?? []), "Perspective correction skipped."]))
          : (result.warnings ?? []),
        scanQuality: result.scan_quality ?? null,
        routingMeta: result.routing ?? null,
        routingLabel: result.routing?.model_tier ?? null,
        reused: result.reused ?? false,
      };

      setResultPreview(nextPreview);
      setConfidenceMatrix(result.cell_confidence || []);
      resetHistory({
        headers,
        rows,
        columnTypes: inferColumnTypes(rows, headers.length),
        headerRowEnabled: false,
      });
      setDraftDirty(false);
      setActiveCell(null);
      setZoom(1);
      setStep("preview");

      let draftSaveFailed = false;
      if (result.reused_verification_id) {
        setSavedId(result.reused_verification_id);
      } else {
        try {
          const saved = await createOcrVerification({
            templateId: null,
            sourceFilename: sourceName,
            columns: headers.length,
            language: nextPreview.language,
            avgConfidence: nextPreview.avgConfidence ?? null,
            warnings: nextPreview.warnings,
            scanQuality: nextPreview.scanQuality ?? null,
            documentHash: prepared.sha256,
            docTypeHint: nextPreview.type,
            routingMeta: result.routing ?? null,
            rawText: nextPreview.rawText ?? null,
            headers,
            originalRows: nextPreview.rows,
            reviewedRows: rows,
            rawColumnAdded: false,
            reviewerNotes: "",
            file: prepared.file,
          });
          setSavedId(saved.id);
        } catch (saveReason) {
          draftSaveFailed = true;
          setSavedId(null);
          setStatus(humanDraftSaveError(saveReason));
          setStatusTone("warning");
        }
      }

      if (!draftSaveFailed) {
        if (warpSkipped) {
          setStatus("Sheet ready to review. Perspective correction was skipped for this image.");
          setStatusTone("warning");
        } else if (result.scan_quality?.confidence_band === "low") {
          setStatus("Image quality may affect accuracy.");
          setStatusTone("warning");
        } else {
          setStatus(result.reused ? "Existing OCR draft reopened." : "Sheet ready to review.");
          setStatusTone("success");
        }
      }
      signalWorkflowRefresh("ocr-scan");
      void loadRecentRecords();
    } catch (reason) {
      console.error("OCR extraction error:", reason);
      setStatus(humanExtractError(reason));
      setStatusTone("error");
      setStep("upload");
    } finally {
      setBusy(false);
    }
  }, [loadRecentRecords, resetHistory]);

  const chooseFile = useCallback(async (file: File | null) => {
    if (!file) return;
    const validationError = validateOcrImageFile(file, "Document", { allowPdf: true });
    if (validationError) {
      setStatus(validationError);
      setStatusTone("error");
      return;
    }
    if (originalUrl && originalUrl.startsWith("blob:")) {
      URL.revokeObjectURL(originalUrl);
    }
    if (preparedPreviewUrl && preparedPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(preparedPreviewUrl);
    }
    let workingFile = file;
    try {
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        setStatus("Rendering first PDF page for OCR.");
        setStatusTone("warning");
        workingFile = await rasterizeDocumentForOcr(file);
      }
    } catch (reason) {
      setStatus(formatApiErrorMessage(reason, "Could not open this PDF for OCR."));
      setStatusTone("error");
      return;
    }

    const nextUrl = URL.createObjectURL(workingFile);
    setSourceFilename(file.name);
    setOriginalFile(workingFile);
    setOriginalUrl(nextUrl);
    setPreparedPreviewFile(null);
    setPreparedPreviewUrl("");
    setFinalUploadFile(null);
    setResultPreview(null);
    setConfidenceMatrix([]);
    setDraftDirty(false);
    void processFile(workingFile, file.name);
  }, [originalUrl, preparedPreviewUrl, processFile]);

  const openRecentRecord = useCallback(async (verificationId: number) => {
    try {
      setBusy(true);
      const record = await getOcrVerification(verificationId);
      const headers = record.headers?.length
        ? record.headers
        : defaultHeaders(Math.max(record.columns || 0, ...(record.reviewed_rows || []).map((row) => row.length), 1));
      const rows = cloneRows(record.reviewed_rows || record.original_rows || []);
      setOriginalFile(null);
      setSourceFilename(record.source_filename || "");
      setPreparedPreviewFile(null);
      setFinalUploadFile(null);
      setOriginalUrl(record.source_image_url ? `/api${record.source_image_url}` : "");
      setPreparedPreviewUrl("");
      setResultPreview({
        type: record.doc_type_hint || "table",
        title: record.template_name || record.source_filename || "OCR Extraction",
        headers,
        rows: cloneRows(record.original_rows || rows),
        rawText: record.raw_text ?? null,
        language: record.language || "auto",
        avgConfidence: record.avg_confidence ?? null,
        warnings: record.warnings || [],
        scanQuality: record.scan_quality ?? null,
        routingMeta: record.routing_meta ?? null,
        routingLabel: record.routing_meta?.model_tier ?? null,
        reused: true,
      });
      resetHistory({
        headers,
        rows,
        columnTypes: inferColumnTypes(rows, headers.length),
        headerRowEnabled: false,
      });
      setSavedId(record.id);
      setDocumentHash(record.document_hash ?? null);
      setConfidenceMatrix([]);
      setStep("preview");
      setStatus("Recent OCR draft loaded.");
      setStatusTone("success");
    } catch (reason) {
      setStatus(formatApiErrorMessage(reason, "Could not open this OCR draft."));
      setStatusTone("error");
    } finally {
      setBusy(false);
    }
  }, [resetHistory]);

  const handleImportUrl = useCallback(async () => {
    if (!remoteUrl.trim()) return;
    try {
      setBusy(true);
      const response = await fetch(remoteUrl.trim());
      if (!response.ok) {
        throw new Error("Could not download this image.");
      }
      const blob = await response.blob();
      const extension = blob.type.includes("png") ? "png" : blob.type === "application/pdf" ? "pdf" : "jpg";
      const file = new File(
        [blob],
        blob.type === "application/pdf" ? "remote-document.pdf" : `remote-image.${extension}`,
        { type: blob.type || "image/jpeg" },
      );
      void chooseFile(file);
      setRemoteUrl("");
    } catch (reason) {
      setStatus(formatApiErrorMessage(reason, "Could not import this image URL."));
      setStatusTone("error");
    } finally {
      setBusy(false);
    }
  }, [chooseFile, remoteUrl]);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    applySnapshot(historyRef.current[historyIndexRef.current]);
    setDraftDirty(true);
    setHistoryVersion((value) => value + 1);
  }, [applySnapshot]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    applySnapshot(historyRef.current[historyIndexRef.current]);
    setDraftDirty(true);
    setHistoryVersion((value) => value + 1);
  }, [applySnapshot]);

  const applyTableChange = useCallback((next: Partial<TableSnapshot>) => {
    pushSnapshot({
      headers: next.headers ?? editableHeaders,
      rows: next.rows ?? editableRows,
      columnTypes: next.columnTypes ?? columnTypes,
      headerRowEnabled: next.headerRowEnabled ?? headerRowEnabled,
    });
  }, [columnTypes, editableHeaders, editableRows, headerRowEnabled, pushSnapshot]);

  const handleAddRow = useCallback(() => {
    applyTableChange({
      rows: [...editableRows, Array.from({ length: Math.max(editableHeaders.length, 1) }, () => "")],
    });
  }, [applyTableChange, editableHeaders.length, editableRows]);

  const handleAddColumn = useCallback(() => {
    const nextHeaders = [...editableHeaders, `Column ${editableHeaders.length + 1}`];
    const nextRows = editableRows.map((row) => [...row, ""]);
    const nextTypes = [...columnTypes, "text" as OcrColumnType];
    applyTableChange({
      headers: nextHeaders,
      rows: nextRows,
      columnTypes: nextTypes,
    });
  }, [applyTableChange, columnTypes, editableHeaders, editableRows]);

  const handleDeleteSelectedRow = useCallback(() => {
    if (activeCell == null) return;
    const nextRows = editableRows.filter((_, index) => index !== activeCell.row);
    applyTableChange({
      rows: nextRows.length ? nextRows : [Array.from({ length: Math.max(editableHeaders.length, 1) }, () => "")],
    });
    setActiveCell(null);
  }, [activeCell, applyTableChange, editableHeaders.length, editableRows]);

  const handleToggleHeaderRow = useCallback(() => {
    const columnCount = Math.max(editableHeaders.length, ...editableRows.map((row) => row.length), 1);
    if (!headerRowEnabled && editableRows.length) {
      const firstRow = Array.from({ length: columnCount }, (_, index) => editableRows[0]?.[index] || editableHeaders[index] || `Column ${index + 1}`);
      applyTableChange({
        headers: firstRow,
        rows: editableRows.slice(1),
        headerRowEnabled: true,
      });
      return;
    }
    const nextHeaders = defaultHeaders(columnCount);
    applyTableChange({
      headers: nextHeaders,
      rows: [editableHeaders, ...editableRows],
      headerRowEnabled: false,
    });
  }, [applyTableChange, editableHeaders, editableRows, headerRowEnabled]);

  const handleDownloadExcel = useCallback(async () => {
    setExcelBusy(true);
    try {
      const record = draftDirty || !savedId ? await persistStructuredDraft() : null;
      const verificationId = record?.id ?? savedId;
      if (!verificationId) {
        throw new Error("Save the OCR draft before exporting.");
      }
      const download = await downloadOcrVerificationExport(verificationId);
      const result = await transferBlob(download.blob, download.filename);
      setStatus(result === "shared" ? "Excel shared." : "Excel downloaded.");
      setStatusTone("success");
      signalWorkflowRefresh("ocr-export");
    } catch (reason) {
      setStatus(humanExportError(reason));
      setStatusTone("error");
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
      setStatusTone("success");
    } catch {
      setStatus("CSV export could not be prepared.");
      setStatusTone("error");
    }
  }, [editableHeaders, editableRows]);

  const handleDownloadJson = useCallback(async () => {
    try {
      const blob = new Blob([exportRowsToJson(editableHeaders, editableRows)], {
        type: "application/json;charset=utf-8",
      });
      const result = await transferBlob(blob, "ocr-sheet.json");
      setStatus(result === "shared" ? "JSON shared." : "JSON downloaded.");
      setStatusTone("success");
    } catch {
      setStatus("JSON export could not be prepared.");
      setStatusTone("error");
    }
  }, [editableHeaders, editableRows]);

  const handleCopyClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exportRowsToClipboardText(editableHeaders, editableRows));
      setStatus("Copied for Sheets.");
      setStatusTone("success");
    } catch {
      setStatus("Clipboard copy failed.");
      setStatusTone("error");
    }
  }, [editableHeaders, editableRows]);

  const handleGenerateShareLink = useCallback(async () => {
    try {
      const record = draftDirty || !savedId ? await persistStructuredDraft() : null;
      const verificationId = record?.id ?? savedId;
      if (!verificationId) {
        throw new Error("Save the OCR draft before sharing.");
      }
      setShareBusy(true);
      const share = await createOcrVerificationShareLink(verificationId);
      const absoluteUrl = share.url.startsWith("http")
        ? share.url
        : `${window.location.origin}${share.url}`;
      setShareLink(absoluteUrl);
      setShareExpiresAt(share.expires_at);
      setStatus("Share link ready.");
      setStatusTone("success");
    } catch (reason) {
      setStatus(formatApiErrorMessage(reason, "Could not generate share link."));
      setStatusTone("error");
    } finally {
      setShareBusy(false);
    }
  }, [draftDirty, persistStructuredDraft, savedId]);

  const handleCopyShareLink = useCallback(async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setStatus("Share link copied.");
      setStatusTone("success");
    } catch {
      setStatus("Could not copy the share link.");
      setStatusTone("error");
    }
  }, [shareLink]);

  const handleDownloadPdf = useCallback(async () => {
    if (!resultPreview) return;
    try {
      const blob = await buildStructuredPdfBlob({
        title: resultPreview.title,
        headers: editableHeaders,
        rows: editableRows,
      });
      const result = await transferBlob(blob, "ocr-sheet.pdf");
      setStatus(result === "shared" ? "PDF shared." : "PDF downloaded.");
      setStatusTone("success");
    } catch {
      setStatus("PDF export could not be prepared.");
      setStatusTone("error");
    }
  }, [editableHeaders, editableRows, resultPreview]);

  if (loading || !deviceReady || !restored) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] text-sm text-[#667085]">
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
        accept="image/png,image/jpeg,image/jpg,image/tiff,image/heic,image/heif,application/pdf"
        className="hidden"
        onChange={(event) => {
          void chooseFile(event.target.files?.[0] || null);
          event.target.value = "";
        }}
      />

      <main className="min-h-screen bg-[#f4f7fb] px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="rounded-[28px] border border-[#e3e8ef] bg-white px-5 py-5 shadow-[0_24px_64px_rgba(15,23,42,0.06)] md:px-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#667085]">
                  OCR Workspace
                </div>
                <h1 className="mt-2 text-[2rem] font-semibold tracking-tight text-[#101828] md:text-[2.35rem]">
                  Image to structured data extraction
                </h1>
                <p className="mt-2 text-sm leading-6 text-[#667085]">
                  Upload, process, review, and export without the rest of the product getting in your way.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {STEP_LABELS.map((item, index) => {
                  const activeIndex = STEP_LABELS.findIndex((stepItem) => stepItem.key === step);
                  const state = index < activeIndex ? "done" : index === activeIndex ? "current" : "idle";
                  return (
                    <div
                      key={item.key}
                      className={[
                        "rounded-[18px] border px-3 py-3 text-center transition duration-200",
                        state === "done"
                          ? "border-[#cfe0f0] bg-[#f7fbff] text-[#185FA5]"
                          : state === "current"
                            ? "border-[#185FA5] bg-[#185FA5] text-white"
                            : "border-[#e7edf3] bg-[#f8fafc] text-[#98a2b3]",
                      ].join(" ")}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                        {index + 1}
                      </div>
                      <div className="mt-1 text-sm font-medium">{item.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {status ? (
            <div className={`rounded-[22px] border px-4 py-3 text-sm ${statusBannerClass(statusTone)}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{status}</span>
                {statusTone === "error" ? (
                  <button
                    type="button"
                    className="rounded-full border border-current/20 px-3 py-1.5 text-xs font-medium"
                    onClick={() => {
                      if (step === "upload") {
                        uploadInputRef.current?.click();
                      } else {
                        resetFlow();
                      }
                    }}
                  >
                    {step === "upload" ? "Upload again" : "Try another image"}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === "upload" ? (
            isMobile ? (
              <div className="mx-auto max-w-lg">
                <MobileEntry
                  recentCount={recentRecords.length}
                  onOpenCamera={() => setCameraOpen(true)}
                  onOpenUpload={() => uploadInputRef.current?.click()}
                />
                {recentRecords.length ? (
                  <div className="mt-4 rounded-[24px] border border-[#e3e8ef] bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                    <div className="text-sm font-medium text-[#101828]">Recent uploads</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {recentRecords.slice(0, 4).map((record) => (
                        <button
                          key={record.id}
                          type="button"
                          className="rounded-full border border-[#dbe3eb] bg-[#f8fafc] px-3 py-1.5 text-xs text-[#344054]"
                          onClick={() => void openRecentRecord(record.id)}
                        >
                          {record.source_filename || `Document #${record.id}`}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <UploadBox
                disabled={busy}
                fileName={sourceFilename || originalFile?.name || null}
                recentRecords={recentRecords}
                remoteUrl={remoteUrl}
                onRemoteUrlChange={setRemoteUrl}
                onUploadFile={chooseFile}
                onImportUrl={() => void handleImportUrl()}
                onOpenRecent={(verificationId) => void openRecentRecord(verificationId)}
              />
            )
          ) : null}

          {step === "processing" ? (
            <ProgressIndicator
              thumbnailSrc={displayPreviewUrl || originalUrl || null}
              stage={processingStage}
              warning={processingWarning}
            />
          ) : null}

          {(step === "preview" || step === "export") && resultPreview ? (
            <div className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-[28px] border border-[#e3e8ef] bg-white shadow-[0_20px_54px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center justify-between border-b border-[#edf1f5] px-5 py-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#667085]">
                        Source image
                      </div>
                      <div className="mt-1 text-sm text-[#667085]">
                        {resultPreview.routingLabel ? `${resultPreview.routingLabel} OCR` : formatConfidence(resultPreview.avgConfidence)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-[#d9e1e8] bg-white px-3 py-1.5 text-sm text-[#344054]"
                        onClick={() => setZoom((value) => Math.max(0.8, value - 0.1))}
                      >
                        -
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-[#d9e1e8] bg-white px-3 py-1.5 text-sm text-[#344054]"
                        onClick={() => setZoom((value) => Math.min(2.2, value + 0.1))}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="relative grid min-h-[28rem] place-items-center overflow-auto bg-[#f7f9fb] p-4">
                    {displayPreviewUrl ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={displayPreviewUrl}
                          alt="OCR source preview"
                          className="max-h-[72vh] w-auto rounded-[20px] object-contain shadow-[0_16px_36px_rgba(15,23,42,0.08)] transition duration-200"
                          style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
                        />
                        {boundingBox ? (
                          <div
                            className="pointer-events-none absolute border-2 border-[#185FA5] bg-[#185FA5]/12 shadow-[0_0_0_6px_rgba(24,95,165,0.12)] transition duration-150"
                            style={boundingBox}
                          />
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-sm text-[#667085]">Image preview unavailable</div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <EditToolbar
                    canUndo={canUndo}
                    canRedo={canRedo}
                    headerRowEnabled={headerRowEnabled}
                    showLowConfidence={showLowConfidence}
                    onAddRow={handleAddRow}
                    onAddColumn={handleAddColumn}
                    onUndo={undo}
                    onRedo={redo}
                    onToggleHeaderRow={handleToggleHeaderRow}
                    onToggleConfidence={() => setShowLowConfidence((value) => !value)}
                  />

                  <DataTableGrid
                    headers={editableHeaders}
                    rows={editableRows}
                    columnTypes={columnTypes}
                    confidenceMatrix={confidenceMatrix}
                    originalRows={resultPreview.rows}
                    showLowConfidence={showLowConfidence}
                    activeCell={activeCell}
                    onActiveCellChange={setActiveCell}
                    onChangeHeaders={(headers) => applyTableChange({ headers })}
                    onChangeRows={(rows) => applyTableChange({ rows })}
                    onChangeColumnTypes={(types) => applyTableChange({ columnTypes: types })}
                  />

                  <KeyboardShortcutStrip lowConfidenceCount={visibleLowConfidenceCount} />

                  {step === "preview" ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[#e3e8ef] bg-white p-4">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-[#667085]">
                        {resultPreview.scanQuality?.confidence_band === "low" ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">
                            Low quality
                          </span>
                        ) : null}
                        {resultPreview.warnings.map((warning) => (
                          <span key={warning} className="rounded-full border border-[#e4eaf0] bg-[#f8fafc] px-3 py-1">
                            {warning.replaceAll("_", " ")}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-[#d9e1e8] bg-white px-4 py-2 text-sm font-medium text-[#344054]"
                          disabled={!activeCell}
                          onClick={handleDeleteSelectedRow}
                        >
                          Delete row
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-[#d9e1e8] bg-white px-4 py-2 text-sm font-medium text-[#344054]"
                          onClick={resetFlow}
                        >
                          Try another image
                        </button>
                        <button
                          type="button"
                          className="rounded-full bg-[#185FA5] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(24,95,165,0.2)] transition hover:bg-[#164f8a]"
                          onClick={async () => {
                            if (draftDirty) {
                              await persistStructuredDraft();
                            }
                            setStep("export");
                          }}
                        >
                          Continue to export
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {step === "export" ? (
                <div className="rounded-[28px] border border-[#e3e8ef] bg-white p-5 shadow-[0_18px_54px_rgba(15,23,42,0.05)] md:p-6">
                  <ExportPanel
                    rowCount={editableRows.length}
                    columnCount={editableHeaders.length}
                    correctionCount={correctionCount}
                    busy={excelBusy || savingDraft}
                    status={draftDirty ? "Saving edits in the background." : "Ready to re-download anytime."}
                    onDownloadExcel={() => void handleDownloadExcel()}
                    onDownloadCsv={() => void handleDownloadCsv()}
                    onDownloadJson={() => void handleDownloadJson()}
                    onCopyClipboard={() => void handleCopyClipboard()}
                    shareCard={
                      <ShareLinkGenerator
                        busy={shareBusy}
                        link={shareLink}
                        expiresAt={shareExpiresAt}
                        onGenerate={() => void handleGenerateShareLink()}
                        onCopy={() => void handleCopyShareLink()}
                      />
                    }
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-[#d9e1e8] bg-white px-4 py-2 text-sm font-medium text-[#344054]"
                      onClick={() => setStep("preview")}
                    >
                      Back to edit
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-[#d9e1e8] bg-white px-4 py-2 text-sm font-medium text-[#344054]"
                      onClick={() => void handleDownloadPdf()}
                    >
                      Download PDF
                    </button>
                    {savedId ? (
                      <Link href={`/ocr/verify?verification_id=${savedId}`}>
                        <span className="inline-flex rounded-full border border-[#d9e1e8] bg-white px-4 py-2 text-sm font-medium text-[#344054]">
                          Open review workflow
                        </span>
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-full border border-[#d9e1e8] bg-white px-4 py-2 text-sm font-medium text-[#344054]"
                      onClick={resetFlow}
                    >
                      Scan another image
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
