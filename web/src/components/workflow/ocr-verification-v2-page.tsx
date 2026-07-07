"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBanner } from "@/components/ocr/error-banner";
import { OcrShell } from "@/components/ocr/ocr-shell";
import { formatApiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { type OcrVerifyStatusFilter, type OcrVerifyStep } from "@/lib/ocr-verify-route";
import {
  canApproveOcrVerification,
  canUseOcrVerification,
  validateOcrImageFile,
} from "@/lib/ocr-access";
import {
  downloadOcrVerificationExport,
  previewOcrLogbook,
  stringifyOcrCell,
  getOcrConfidenceTier,
  type OcrTemplate,
  type OcrVerificationRecord,
  type OcrVerificationSavePayload,
} from "@/lib/ocr";
import { buildStructuredPdfBlob, exportRowsToCsv, exportRowsToMarkdown } from "@/lib/ocr-export";
import { useOcrVerifyRouteState } from "@/hooks/use-ocr-verify-route-state";
import {
  useApproveOcrVerificationMutation,
  useCreateOcrVerificationMutation,
  useOcrVerifyDetailQuery,
  useOcrVerifyQueueQuery,
  useOcrVerifyTemplatesQuery,
  useRejectOcrVerificationMutation,
  useSubmitOcrVerificationMutation,
  useUpdateOcrVerificationMutation,
} from "@/hooks/use-ocr-verify-queries";
import { triggerBlobDownload } from "@/lib/reports";
import { useSession } from "@/lib/use-session";
import { signalWorkflowRefresh } from "@/lib/workflow-sync";
import { DashboardPageSkeleton } from "@/components/shared/page-skeletons";
import { SkeletonText, SkeletonCard, SkeletonRect, SkeletonTableRow, SkeletonImage } from "@/components/skeleton";
import {
  applySafeCleanup,
  buildIssues,
  cellInputClass,
  confidenceBadgeClass,
  confidenceLabel,
  countSafeFixes,
  documentConfidenceLabel,
  formatTimestamp,
  impactLabel,
  impactTone,
  signalTone,
  type MobileReviewTab,
  type ReviewIssue,
  type ReviewIssueTone,
} from "@/lib/ocr-review";
import { DocumentTypeAdapter } from "@/components/workflow/layouts";

const PREVIEW_LANGUAGES = ["eng", "auto", "eng+hin+mar"] as const;

function fallbackHeaders(columnCount: number, template?: OcrTemplate | null) {
  return Array.from({ length: Math.max(columnCount, 1) }, (_, index) => {
    return template?.column_names?.[index] || `Column ${index + 1}`;
  });
}

function getStepLabel(step: OcrVerifyStep) {
  switch (step) {
    case 1:
      return "Select a queue document or start a new intake draft.";
    case 2:
      return "Upload the OCR source and create a durable draft before review.";
    case 3:
      return "Correct OCR rows in the draft-backed review workspace.";
    default:
      return "Submit, approve, reject, or export the current draft.";
  }
}

function buildVerificationPayload(input: {
  activeRecord: OcrVerificationRecord | null;
  selectedTemplateId: string;
  language: string;
  columnCount: number;
  headers: string[];
  rows: string[][];
  reviewerNotes: string;
  rejectionReason: string;
}) {
  const { activeRecord, selectedTemplateId, language, columnCount, headers, rows, reviewerNotes } = input;
  return {
    templateId: selectedTemplateId ? Number(selectedTemplateId) : activeRecord?.template_id ?? null,
    sourceFilename: activeRecord?.source_filename ?? null,
    columns: columnCount,
    language,
    avgConfidence: activeRecord?.avg_confidence ?? null,
    warnings: activeRecord?.warnings ?? [],
    documentHash: activeRecord?.document_hash ?? null,
    docTypeHint: activeRecord?.doc_type_hint ?? "table",
    routingMeta: activeRecord?.routing_meta ?? null,
    rawText: activeRecord?.raw_text ?? null,
    headers,
    originalRows: activeRecord?.original_rows ?? rows,
    reviewedRows: rows,
    rawColumnAdded: activeRecord?.raw_column_added ?? false,
    reviewerNotes,
    rejectionReason: input.rejectionReason,
  };
}

/* ── Sub-components ────────────────────────────────────── */

function SurfaceBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-label",
        className,
      )}
    >
      {children}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.4rem] border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4",
        className,
      )}
    >
      <div className="text-[11px] uppercase tracking-label text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-lg font-semibold text-[var(--text)]">{value}</div>
      {detail ? (
        <div className="mt-2 text-sm leading-6 text-[var(--muted)]">{detail}</div>
      ) : null}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  detail,
  className,
}: {
  eyebrow: string;
  title: string;
  detail?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-sm uppercase tracking-header text-[var(--accent)]">{eyebrow}</div>
      <div className="text-2xl font-semibold tracking-tight text-[var(--text)]">{title}</div>
      {detail ? (
        <div className="max-w-3xl text-sm leading-6 text-[var(--muted)]">{detail}</div>
      ) : null}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence?: number | null }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
        confidenceBadgeClass(confidence),
      )}
      title={confidenceLabel(confidence)}
    >
      {confidenceLabel(confidence)}
    </span>
  );
}

/* ── Main page ─────────────────────────────────────────── */

export default function OcrVerificationV2Page() {
  const route = useOcrVerifyRouteState();
  const { user, loading, error: sessionError } = useSession();
  const canVerify = canUseOcrVerification(user?.role);
  const canApprove = canApproveOcrVerification(user?.role);

  const templatesQuery = useOcrVerifyTemplatesQuery(canVerify);
  const queueQuery = useOcrVerifyQueueQuery(
    { search: route.search, status: route.status as OcrVerifyStatusFilter },
    canVerify,
  );
  const detailQuery = useOcrVerifyDetailQuery(route.id, canVerify);

  const createMutation = useCreateOcrVerificationMutation();
  const updateMutation = useUpdateOcrVerificationMutation();
  const submitMutation = useSubmitOcrVerificationMutation();
  const approveMutation = useApproveOcrVerificationMutation();
  const rejectMutation = useRejectOcrVerificationMutation();

  const [file, setFile] = useState<File | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [language, setLanguage] = useState<string>("eng");
  const [columns, setColumns] = useState(3);
  const [draftHeaders, setDraftHeaders] = useState<string[]>([]);
  const [draftRows, setDraftRows] = useState<string[][]>([]);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [localError, setLocalError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [hydratedRevision, setHydratedRevision] = useState("");

  // ── Issue tracking state ──
  const [selectedIssueKey, setSelectedIssueKey] = useState("");
  const [resolvedIssueKeys, setResolvedIssueKeys] = useState<string[]>([]);
  const [showAllRows, setShowAllRows] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [mobileTab, setMobileTab] = useState<MobileReviewTab>("issues");

  // Beforeunload guard
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const queue = queueQuery.data ?? [];
  const activeRecord = detailQuery.data ?? null;
  const activeTemplate = useMemo(
    () => templates.find((template) => String(template.id) === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  useEffect(() => {
    if (!activeTemplate) {
      return;
    }
    queueMicrotask(() => {
      setColumns(activeTemplate.columns);
      setLanguage(activeTemplate.language || "eng");
    });
  }, [activeTemplate]);

  useEffect(() => {
    if (!activeRecord) {
      if (route.id == null && !dirty) {
        queueMicrotask(() => {
          setDraftHeaders([]);
          setDraftRows([]);
          setReviewerNotes("");
          setRejectionReason("");
        });
      }
      return;
    }

    const revisionKey = `${activeRecord.id}:${activeRecord.updated_at || ""}`;
    if (dirty && hydratedRevision === revisionKey) {
      return;
    }

    const normalizedRows = (activeRecord.reviewed_rows?.length
      ? activeRecord.reviewed_rows
      : activeRecord.original_rows || []
    ).map((row) => row.map((cell) => stringifyOcrCell(cell)));
    const nextColumnCount = Math.max(
      activeRecord.columns || 0,
      activeRecord.headers?.length || 0,
      ...normalizedRows.map((row) => row.length),
      1,
    );

    queueMicrotask(() => {
      setSelectedTemplateId(activeRecord.template_id ? String(activeRecord.template_id) : "");
      setLanguage(activeRecord.language || "eng");
      setColumns(nextColumnCount);
      setDraftHeaders(
        activeRecord.headers?.length
          ? activeRecord.headers
          : fallbackHeaders(nextColumnCount, activeTemplate),
      );
      setDraftRows(
        normalizedRows.map((row) =>
          Array.from({ length: nextColumnCount }, (_, index) => row[index] || ""),
        ),
      );
      setReviewerNotes(activeRecord.reviewer_notes || "");
      setRejectionReason(activeRecord.rejection_reason || "");
      setDirty(false);
      setHydratedRevision(revisionKey);
      setResolvedIssueKeys([]);
    });
  }, [activeRecord, activeTemplate, dirty, hydratedRevision, route.id]);

  const columnCount = useMemo(() => {
    return Math.max(columns, draftHeaders.length, ...draftRows.map((row) => row.length), 1);
  }, [columns, draftHeaders.length, draftRows]);

  const headers = useMemo(() => {
    const base = fallbackHeaders(columnCount, activeTemplate);
    return Array.from({ length: columnCount }, (_, index) => draftHeaders[index] || base[index]);
  }, [activeTemplate, columnCount, draftHeaders]);

  const imageUrl = useMemo(() => {
    if (activeRecord?.source_image_url) return `/api${activeRecord.source_image_url}`;
    return "";
  }, [activeRecord?.source_image_url]);

  // ── Issue detection ──
  const reviewIssues = useMemo<ReviewIssue[]>(() => {
    return buildIssues({
      rows: draftRows,
      headers,
      cellConfidence: activeRecord?.cell_confidence ?? null,
      warnings: activeRecord?.warnings ?? [],
      rejectionReason: activeRecord?.rejection_reason ?? null,
      fallbackUsed: activeRecord?.cell_sources?.some(
        (row) => row.some((source) => source === "ocr"),
      ) ?? false,
    });
  }, [draftRows, headers, activeRecord?.cell_confidence, activeRecord?.warnings, activeRecord?.rejection_reason, activeRecord?.cell_sources]);

  // Sync resolved keys with current issues
  useEffect(() => {
    setResolvedIssueKeys((current) => current.filter((key) =>
      reviewIssues.some((issue) => issue.key === key),
    ));
  }, [reviewIssues]);

  // Auto-select first unresolved issue
  useEffect(() => {
    if (!reviewIssues.length) {
      setSelectedIssueKey("");
      return;
    }
    if (reviewIssues.some((issue) => issue.key === selectedIssueKey)) {
      return;
    }
    const next =
      reviewIssues.find((issue) => !resolvedIssueKeys.includes(issue.key)) || reviewIssues[0];
    setSelectedIssueKey(next.key);
  }, [resolvedIssueKeys, reviewIssues, selectedIssueKey]);

  const activeIssue = useMemo(
    () => reviewIssues.find((issue) => issue.key === selectedIssueKey) || reviewIssues[0] || null,
    [reviewIssues, selectedIssueKey],
  );

  // Scroll to active issue cell
  useEffect(() => {
    if (activeIssue?.rowIndex == null) return;
    const target = document.getElementById(
      `ocr-cell-${activeIssue.rowIndex}-${activeIssue.columnIndex ?? 0}`,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }, [activeIssue?.columnIndex, activeIssue?.key, activeIssue?.rowIndex]);

  const unresolvedIssues = useMemo(
    () => reviewIssues.filter((issue) => !resolvedIssueKeys.includes(issue.key)),
    [resolvedIssueKeys, reviewIssues],
  );

  const totalIssues = reviewIssues.length;
  const unresolvedIssueCount = unresolvedIssues.length;
  const criticalCount = reviewIssues.filter((i) => i.tone === "critical").length;
  const unresolvedCriticalCount = unresolvedIssues.filter((i) => i.tone === "critical").length;
  const warningCount = reviewIssues.filter((i) => i.tone === "warning").length;
  const checkedIssueCount = resolvedIssueKeys.length;
  const criticalResolvedCount = criticalCount - unresolvedCriticalCount;
  const approveNeedsOverride =
    unresolvedCriticalCount > 0 &&
    (reviewerNotes.trim().length < 40 || criticalResolvedCount < 3);

  const editableIssues = useMemo(
    () =>
      reviewIssues.flatMap((issue) =>
        issue.rowIndex != null && issue.columnIndex != null
          ? [issue as ReviewIssue & { rowIndex: number; columnIndex: number }]
          : [],
      ),
    [reviewIssues],
  );

  const safeFixCount = useMemo(
    () => countSafeFixes(headers, draftRows),
    [headers, draftRows],
  );

  const documentConfidence = useMemo(
    () => documentConfidenceLabel(activeRecord),
    [activeRecord],
  );

  const handleNextIssue = useCallback(() => {
    const next = reviewIssues.find(
      (issue) => !resolvedIssueKeys.includes(issue.key) && issue.key !== selectedIssueKey,
    );
    if (next) {
      setSelectedIssueKey(next.key);
      if (next.rowIndex != null) {
        setMobileTab("fix");
      }
    }
  }, [resolvedIssueKeys, reviewIssues, selectedIssueKey]);

  // Keyboard navigation — Alt+Up/Down
  useEffect(() => {
    if (!reviewIssues.length) return;
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        handleNextIssue();
      }
      if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        const prev = reviewIssues
          .slice()
          .reverse()
          .find(
            (issue) =>
              !resolvedIssueKeys.includes(issue.key) && issue.key !== selectedIssueKey,
          );
        if (prev) {
          setSelectedIssueKey(prev.key);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleNextIssue, resolvedIssueKeys, reviewIssues, selectedIssueKey]);

  const isBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    submitMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending;

  const queueError = queueQuery.error
    ? formatApiErrorMessage(queueQuery.error, "Could not load OCR verification queue.")
    : "";
  const detailError = detailQuery.error
    ? formatApiErrorMessage(detailQuery.error, "Could not load the requested OCR draft.")
    : "";
  const templatesError = templatesQuery.error
    ? formatApiErrorMessage(templatesQuery.error, "Could not load OCR templates.")
    : "";

  const activeStatus = activeRecord?.status || "draft";

  const persistDraft = async () => {
    if (!activeRecord) {
      throw new Error("Open a draft first so OCR review state belongs to a route-owned record.");
    }
    if (!draftRows.length) {
      throw new Error("There are no OCR rows to save yet.");
    }
    const payload = buildVerificationPayload({
      activeRecord,
      selectedTemplateId,
      language,
      columnCount,
      headers,
      rows: draftRows,
      reviewerNotes,
      rejectionReason,
    });

    return updateMutation.mutateAsync({
      id: activeRecord.id,
      payload: {
        templateId: payload.templateId,
        sourceFilename: payload.sourceFilename,
        columns: payload.columns,
        language: payload.language,
        avgConfidence: payload.avgConfidence,
        warnings: payload.warnings,
        documentHash: payload.documentHash,
        docTypeHint: payload.docTypeHint,
        routingMeta: payload.routingMeta,
        rawText: payload.rawText,
        headers: payload.headers,
        originalRows: payload.originalRows,
        reviewedRows: payload.reviewedRows,
        rawColumnAdded: payload.rawColumnAdded,
        reviewerNotes: payload.reviewerNotes,
      },
    });
  };

  const handleCreateDraft = async () => {
    const preflightError = validateOcrImageFile(file, "Document image", { required: true });
    if (preflightError) {
      setLocalError(preflightError);
      return;
    }

    setLocalError("");
    setStatusMessage("");

    try {
      const preview = await previewOcrLogbook({
        file: file as File,
        columns,
        language,
        templateId: selectedTemplateId ? Number(selectedTemplateId) : null,
      });

      const normalizedRows = preview.rows.map((row) => row.map((cell) => stringifyOcrCell(cell)));
      const nextColumnCount = Math.max(preview.columns || 0, ...normalizedRows.map((row) => row.length), 1);
      const created = await createMutation.mutateAsync({
        templateId: selectedTemplateId ? Number(selectedTemplateId) : null,
        sourceFilename: file?.name || "OCR draft",
        columns: nextColumnCount,
        language,
        avgConfidence: preview.avg_confidence,
        warnings: preview.warnings,
        rawText: preview.raw_text ?? null,
        headers: fallbackHeaders(nextColumnCount, activeTemplate),
        originalRows: preview.rows,
        reviewedRows: normalizedRows,
        rawColumnAdded: preview.raw_column_added,
        file,
      } satisfies OcrVerificationSavePayload);

      setFile(null);
      setStatusMessage(`Draft #${created.id} created. The workflow now survives refresh and deep linking.`);
      route.openVerification(created.id, 3);
      signalWorkflowRefresh("ocr-verify-created");
    } catch (error) {
      setLocalError(formatApiErrorMessage(error, "Could not create an OCR verification draft."));
    }
  };

  const handleSaveDraft = async () => {
    setLocalError("");
    setStatusMessage("");
    try {
      const saved = await persistDraft();
      setDirty(false);
      setStatusMessage(`Draft #${saved.id} saved.`);
      route.replaceVerification(saved.id, 3);
      signalWorkflowRefresh("ocr-verify-saved");
    } catch (error) {
      setLocalError(formatApiErrorMessage(error, "Could not save the OCR draft."));
    }
  };

  const handleSubmit = async () => {
    setLocalError("");
    setStatusMessage("");
    try {
      const saved = await persistDraft();
      const submitted = await submitMutation.mutateAsync({
        id: saved.id,
        reviewerNotes,
      });
      setDirty(false);
      setStatusMessage(`Draft #${submitted.id} moved into approval state.`);
      route.replaceVerification(submitted.id, 4);
      signalWorkflowRefresh("ocr-verify-submitted");
    } catch (error) {
      setLocalError(formatApiErrorMessage(error, "Could not submit the OCR draft."));
    }
  };

  const handleApprove = async () => {
    if (!activeRecord) {
      return;
    }
    if (approveNeedsOverride) {
      setLocalError(
        "Critical issues are still open. Check them first, or add a clear review note before approval.",
      );
      return;
    }
    setLocalError("");
    setStatusMessage("");
    try {
      const saved = dirty ? await persistDraft() : activeRecord;
      const approved = await approveMutation.mutateAsync({
        id: saved.id,
        reviewerNotes,
      });
      setDirty(false);
      setStatusMessage(`Draft #${approved.id} approved as trusted OCR output.`);
      route.replaceVerification(approved.id, 4);
      signalWorkflowRefresh("ocr-verify-approved");
    } catch (error) {
      setLocalError(formatApiErrorMessage(error, "Could not approve the OCR draft."));
    }
  };

  const handleReject = async () => {
    if (!activeRecord) {
      return;
    }
    if (!rejectionReason.trim()) {
      setLocalError("Add a rejection reason before sending the draft back.");
      return;
    }
    setLocalError("");
    setStatusMessage("");
    try {
      const saved = dirty ? await persistDraft() : activeRecord;
      const rejected = await rejectMutation.mutateAsync({
        id: saved.id,
        rejectionReason: rejectionReason.trim(),
        reviewerNotes,
      });
      setDirty(false);
      setStatusMessage(`Draft #${rejected.id} was sent back for correction.`);
      route.replaceVerification(rejected.id, 4);
      signalWorkflowRefresh("ocr-verify-rejected");
    } catch (error) {
      setLocalError(formatApiErrorMessage(error, "Could not reject the OCR draft."));
    }
  };

  const handleDownloadExcel = async () => {
    if (!activeRecord) {
      setLocalError("Open a draft before downloading a reviewed export.");
      return;
    }
    try {
      const target = dirty ? await persistDraft() : activeRecord;
      const download = await downloadOcrVerificationExport(target.id);
      triggerBlobDownload(download.blob, download.filename);
      setStatusMessage(`Downloaded the reviewed Excel for draft #${target.id}.`);
    } catch (error) {
      setLocalError(formatApiErrorMessage(error, "Could not download the reviewed Excel export."));
    }
  };

  const handleDownloadCsv = () => {
    try {
      triggerBlobDownload(
        new Blob([exportRowsToCsv(headers, draftRows)], { type: "text/csv;charset=utf-8" }),
        "ocr-reviewed.csv",
      );
      setStatusMessage("Downloaded the reviewed CSV export.");
    } catch (error) {
      setLocalError(formatApiErrorMessage(error, "Could not download the reviewed CSV export."));
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const pdf = await buildStructuredPdfBlob({
        title: activeRecord?.source_filename || "OCR Review Export",
        headers,
        rows: draftRows,
      });
      triggerBlobDownload(pdf, "ocr-reviewed.pdf");
      setStatusMessage("Downloaded the reviewed PDF export.");
    } catch (error) {
      setLocalError(formatApiErrorMessage(error, "Could not download the reviewed PDF export."));
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(exportRowsToMarkdown(headers, draftRows));
      setStatusMessage("Copied the reviewed Markdown table.");
    } catch (error) {
      setLocalError(formatApiErrorMessage(error, "Could not copy the reviewed Markdown table."));
    }
  };

  const handleApplySafeCleanup = () => {
    const cleaned = applySafeCleanup(draftHeaders, draftRows);
    setDraftHeaders(cleaned.headers);
    setDraftRows(cleaned.rows);
    setDirty(true);
    setStatusMessage("Safe cleanup applied. Recheck the highlighted values before approval.");
  };

  /* ── Render ── */

if (loading) {
     return (
       <main className="min-h-screen px-4 py-8 md:px-8 content-fade-in">
         <div className="mx-auto max-w-7xl space-y-6">
           {/* Three-column layout skeleton: templates | queue | detail */}
           <div className="hidden sm:flex flex-1 items-start gap-6">
             {/* Left: Templates column */}
             <div className="flex-1 min-w-0 space-y-4">
               <SkeletonRect className="h-4 w-24" /> {/* Label: "OCR template" */}
               <SkeletonRect className="mt-2 h-10 w-48" /> {/* Dropdown input */}
             </div>
             {/* Middle: Queue column */}
             <div className="flex-1 min-w-0 space-y-4">
               <SkeletonRect className="h-4 w-28" /> {/* Header: "OCR queue" */}
               {/* Queue cards skeleton: 3 items */}
               <div className="space-y-3">
                 {[1, 2, 3].map((i) => (
                   <SkeletonCard key={i} className="h-14 flex items-center space-x-3 p-3">
                     <SkeletonRect className="h-6 w-20" /> {/* File icon placeholder */}
                     <div className="flex-1 space-y-1">
                       <SkeletonRect className="h-4 w-32" /> {/* Filename */}
                       <SkeletonRect className="h-4 w-24" /> {/* Status */}
                     </div>
                   </SkeletonCard>
                 ))}
               </div>
             </div>
             {/* Right: Detail column */}
             <div className="flex-1 min-w-0 space-y-4">
               <SkeletonCard className="h-16 flex items-center space-x-3 p-3">
                 <SkeletonRect className="h-4 w-28" /> {/* Detail title */}
               </SkeletonCard>
               <SkeletonCard className="h-40"> {/* Detail body */}
                 <SkeletonRect className="h-4 w-full mb-2" /> {/* First line */}
                 <SkeletonRect className="h-4 w-full mb-2" /> {/* Second line */}
                 <SkeletonRect className="h-4 w-full" /> {/* Third line */}
               </SkeletonCard>
             </div>
           </div>
           {/* Mobile fallback: stacked columns */}
           <div className="block sm:hidden space-y-6">
             <div className="space-y-4">
               <SkeletonRect className="h-4 w-24" />
               <SkeletonRect className="mt-2 h-10 w-48" />
             </div>
             <div className="space-y-4">
               <SkeletonRect className="h-4 w-28" />
               <div className="space-y-3">
                 {[1, 2, 3].map((i) => (
                   <SkeletonCard key={i} className="h-14 flex items-center space-x-3 p-3">
                     <SkeletonRect className="h-6 w-20" />
                     <div className="flex-1 space-y-1">
                       <SkeletonRect className="h-4 w-32" />
                       <SkeletonRect className="h-4 w-24" />
                     </div>
                   </SkeletonCard>
                 ))}
               </div>
             </div>
             <div className="space-y-4">
               <SkeletonCard className="h-16 flex items-center space-x-3 p-3">
                 <SkeletonRect className="h-4 w-28" />
               </SkeletonCard>
               <SkeletonCard className="h-40">
                 <SkeletonRect className="h-4 w-full mb-2" />
                 <SkeletonRect className="h-4 w-full mb-2" />
                 <SkeletonRect className="h-4 w-full" />
               </SkeletonCard>
             </div>
           </div>
         </div>
       </main>
     );
   }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 content-fade-in">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Review Documents</CardTitle>
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

  if (!canVerify) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Review Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">
              Document review is available to supervisors, managers, admins, and owners.
            </div>
            <div className="flex gap-3">
              <Link href="/dashboard">
                <Button>Back to Dashboard</Button>
              </Link>
              <Link href="/ocr/scan">
                <Button variant="outline">Open OCR Scan</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <OcrShell
      title="Deterministic OCR verification"
      subtitle="The route owns the selected draft and workflow step so refresh, browser history, and deep links stay stable."
      step={
        route.step === 1
          ? "entry"
          : route.step === 2
            ? "prepare"
            : route.step === 3
              ? "processing"
              : "result"
      }
      sideContent={
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Route state</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[var(--muted)]">
              <div>Draft: {route.id ?? "new intake"}</div>
              <div>Step: {route.step}</div>
              <div>{getStepLabel(route.step)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Queue filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={route.search}
                onChange={(event) => route.setSearch(event.target.value)}
                placeholder="Search OCR queue"
              />
              <Select
                value={route.status}
                onChange={(event) => route.setStatus(event.target.value as OcrVerifyStatusFilter)}
              >
                <option value="all">All documents</option>
                <option value="draft">Drafts</option>
                <option value="pending">Pending approval</option>
                <option value="rejected">Rejected</option>
                <option value="approved">Approved</option>
              </Select>
            </CardContent>
          </Card>
        </div>
      }
    >
      <div className="space-y-4">
        {localError || queueError || detailError || templatesError ? (
          <ErrorBanner
            message={localError || queueError || detailError || templatesError}
            actionLabel="Retry"
            onAction={() => {
              setLocalError("");
              void queueQuery.refetch();
              void detailQuery.refetch();
              void templatesQuery.refetch();
            }}
          />
        ) : null}
        {statusMessage ? (
          <ErrorBanner
            message={statusMessage}
            tone="success"
            actionLabel="Open queue"
            onAction={() => route.openQueue()}
          />
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button variant={route.step === 1 ? "primary" : "outline"} onClick={() => route.openQueue()}>
            Step 1: Queue
          </Button>
          <Button variant={route.step === 2 ? "primary" : "outline"} onClick={() => route.openIntake()}>
            Step 2: Intake
          </Button>
          <Button
            variant={route.step === 3 ? "primary" : "outline"}
            onClick={() => activeRecord && route.openVerification(activeRecord.id, 3)}
            disabled={!activeRecord}
          >
            Step 3: Review
          </Button>
          <Button
            variant={route.step === 4 ? "primary" : "outline"}
            onClick={() => activeRecord && route.openVerification(activeRecord.id, 4)}
            disabled={!activeRecord}
          >
            Step 4: Decision
          </Button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
          {/* ── Queue sidebar ── */}
          <Card className="xl:sticky xl:top-6 xl:self-start">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>OCR queue</CardTitle>
              <Button variant="outline" onClick={() => void queueQuery.refetch()}>
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
{queueQuery.isLoading ? (
                 <div className="space-y-3">
                   {[1, 2, 3].map((i) => (
                     <SkeletonCard key={i} className="h-14 flex items-center space-x-3 p-3">
                       <SkeletonRect className="h-6 w-20" />
                       <div className="flex-1 space-y-1">
                         <SkeletonRect className="h-4 w-32" />
                         <SkeletonRect className="h-4 w-24" />
                       </div>
                     </SkeletonCard>
                   ))}
                 </div>
               ) : null}
              {!queueQuery.isLoading && queue.length === 0 ? (
                <div className="rounded-2xl border border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                  No OCR drafts match the current URL-owned filters.
                </div>
              ) : null}
              {queue.map((verification) => {
                const targetStep: OcrVerifyStep =
                  verification.status === "pending" || verification.status === "approved" ? 4 : 3;
                const isActive = verification.id === route.id;
                return (
                  <button
                    key={verification.id}
                    type="button"
                    onClick={() => route.openVerification(verification.id, targetStep)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isActive
                        ? "border-[var(--accent)] bg-[rgba(62,166,255,0.08)]"
                        : "border-[var(--border)] hover:border-[var(--accent)]/40"
                    }`}
                  >
                    <div className="font-semibold text-[var(--text)]">
                      {verification.source_filename || `Document #${verification.id}`}
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {verification.status} | {formatTimestamp(verification.updated_at)}
                    </div>
                    <div className="mt-2 text-xs text-[var(--muted)]">
                      {verification.warnings.length
                        ? `${verification.warnings.length} warning${verification.warnings.length === 1 ? "" : "s"}`
                        : "No current warnings"}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* ── Main content area ── */}
          <div className="space-y-4">
            {route.step === 1 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Select the route-owned workflow</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-[var(--muted)]">
                  <p>
                    Choose an OCR draft from the queue to resume it with refresh continuity, or
                    start a new intake draft.
                  </p>
                  <div className="flex gap-3">
                    <Button onClick={() => route.openIntake()}>Start intake</Button>
                    {queue[0] ? (
                      <Button
                        variant="outline"
                        onClick={() => route.openVerification(queue[0].id, 3)}
                      >
                        Open latest draft
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {route.step === 2 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Create a durable OCR draft</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm text-[var(--muted)]">
                        Document image
                      </label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(event) => setFile(event.target.files?.[0] || null)}
                      />
                    </div>
<div>
  <label className="mb-2 block text-sm text-[var(--muted)]">
    OCR template
  </label>
  {templatesQuery.isLoading ? (
    <SkeletonRect className="h-10 w-48" />
  ) : (
    <Select
      value={selectedTemplateId}
      onChange={(event) => setSelectedTemplateId(event.target.value)}
    >
      <option value="">No template</option>
      {templates.map((template) => (
        <option key={template.id} value={String(template.id)}>
          {template.name}
        </option>
      ))}
    </Select>
  )}
</div>
                    <div>
                      <label className="mb-2 block text-sm text-[var(--muted)]">
                        Expected columns
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={16}
                        value={columns}
                        onChange={(event) =>
                          setColumns(Math.max(1, Number(event.target.value) || 1))
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm text-[var(--muted)]">
                        Language hint
                      </label>
                      <Select
                        value={language}
                        onChange={(event) => setLanguage(event.target.value)}
                      >
                        {PREVIEW_LANGUAGES.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={() => void handleCreateDraft()} disabled={isBusy}>
                      {isBusy ? "Creating draft..." : "Read and create draft"}
                    </Button>
                    <Button variant="outline" onClick={() => route.openQueue()}>
                      Back to queue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* ── Steps 3 & 4: Review / Decision ── */}
            {route.step === 3 || route.step === 4 ? (
              <>
                {/* Status banners */}
                {activeStatus === "approved" ? (
                  <div className="rounded-[1.35rem] border border-emerald-400/30 bg-[rgba(34,197,94,0.08)] px-4 py-3 text-sm text-emerald-100">
                    Approved on {formatTimestamp(activeRecord?.approved_at)}. This approved review
                    is now the trusted Excel export source.
                  </div>
                ) : activeStatus === "rejected" ? (
                  <div className="rounded-[1.35rem] border border-red-400/30 bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-red-100">
                    This document was sent back on {formatTimestamp(activeRecord?.rejected_at)}. Fix
                    the flagged rows and resubmit.
                  </div>
                ) : activeStatus === "pending" ? (
                  <div className="rounded-[1.35rem] border border-amber-400/30 bg-[rgba(245,158,11,0.08)] px-4 py-3 text-sm text-amber-100">
                    Reviewed rows are ready and waiting for approval.
                  </div>
                ) : activeRecord ? (
                  <div className="rounded-[1.35rem] border border-cyan-400/30 bg-[rgba(34,211,238,0.08)] px-4 py-3 text-sm text-cyan-100">
                    This is still a working draft. Save your corrections here, then send the
                    document for approval.
                  </div>
                ) : null}

                {documentConfidence !== "Verified" && activeRecord ? (
                  <div className="rounded-[1.35rem] border border-orange-400/30 bg-[rgba(245,158,11,0.08)] px-4 py-3 text-sm text-orange-100 flex items-center gap-3">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <div className="font-semibold">Document needs reviewer attention</div>
                      <div>
                        This extraction is marked {documentConfidence.toLowerCase()}. Review the
                        flagged rows carefully before export.
                      </div>
                    </div>
                  </div>
                ) : null}

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
<CardTitle>
  {detailQuery.isFetching ? (
    <SkeletonRect className="h-4 w-28" />
  ) : (
    activeRecord?.source_filename || "OCR review workspace"
  )}
</CardTitle>
{detailQuery.isFetching ? (
                       <SkeletonRect className="h-4 w-32 mb-2" />
                     ) : null}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!activeRecord && !detailQuery.isLoading ? (
                      <div className="rounded-2xl border border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                        This step needs a route-owned draft id. Open a queue item or create a new
                        OCR draft first.
                      </div>
                    ) : null}

                    {activeRecord ? (
                      <>
                        {/* Quick stat cards */}
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="rounded-2xl border border-[var(--border)] p-4">
                            <div className="text-xs uppercase tracking-label text-[var(--muted)]">
                              Status
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-3 py-0.5 text-[11px] font-semibold uppercase tracking-label",
                                  statusBadgeClass(activeStatus),
                                )}
                              >
                                {activeStatus.replace("_", " ")}
                              </span>
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-3 py-0.5 text-[11px] font-semibold uppercase tracking-label",
                                  documentConfidence !== "Verified"
                                    ? "border-amber-400/30 bg-[rgba(245,158,11,0.1)] text-amber-100"
                                    : "border-emerald-400/30 bg-[rgba(34,197,94,0.1)] text-emerald-100",
                                )}
                              >
                                {documentConfidence}
                              </span>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-[var(--border)] p-4">
                            <div className="text-xs uppercase tracking-label text-[var(--muted)]">
                              Updated
                            </div>
                            <div className="mt-2 text-lg font-semibold text-[var(--text)]">
                              {formatTimestamp(activeRecord.updated_at)}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-[var(--border)] p-4">
                            <div className="text-xs uppercase tracking-label text-[var(--muted)]">
                              Issues
                            </div>
                            <div className="mt-2 text-lg font-semibold text-[var(--text)]">
                              {unresolvedIssueCount} unresolved
                            </div>
                            <div className="mt-1 text-xs text-[var(--muted)]">
                              {criticalCount} critical, {warningCount} warning,{" "}
                              {checkedIssueCount} checked
                            </div>
                          </div>
                        </div>

                        {/* ── Image viewer ── */}
                        {imageUrl ? (
                          <Card className="overflow-hidden border-[var(--border-strong)]">
                            <CardHeader className="flex flex-row items-center justify-between gap-4">
                              <SectionHeading
                                eyebrow="Document viewer"
                                title="Compare against the real paper"
                                detail="Keep the source image visible while you confirm the risky values."
                              />
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-label",
                                    "border-cyan-400/30 bg-[rgba(34,211,238,0.12)] text-cyan-100",
                                  )}
                                >
                                  {totalIssues
                                    ? `${Math.round((checkedIssueCount / totalIssues) * 100)}% reviewed`
                                    : "100% reviewed"}
                                </span>
                                <button
                                  type="button"
                                  className="rounded-full border border-[var(--border)] bg-[var(--card-strong)] px-3 py-1.5 text-xs text-[var(--muted)]"
                                  onClick={() => setZoom((v) => Math.max(0.5, v - 0.1))}
                                >
                                  −
                                </button>
                                <button
                                  type="button"
                                  className="rounded-full border border-[var(--border)] bg-[var(--card-strong)] px-3 py-1.5 text-xs text-[var(--muted)]"
                                  onClick={() => setZoom((v) => Math.min(3, v + 0.1))}
                                >
                                  +
                                </button>
                                <a href={imageUrl} target="_blank" rel="noreferrer">
                                  <Button variant="outline" className="px-3 py-1.5 text-xs">
                                    Open full image
                                  </Button>
                                </a>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="min-h-[16rem] max-h-[36rem] overflow-auto rounded-[1.2rem] bg-[#060811]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={imageUrl}
                                  alt={activeRecord?.source_filename || "OCR source"}
                                  className="mx-auto h-auto w-full object-contain transition duration-200"
                                  style={{
                                    transform: `scale(${zoom})`,
                                    transformOrigin: "center top",
                                  }}
                                />
                              </div>
                            </CardContent>
                          </Card>
                        ) : null}

                        {/* ── 2-column layout: issues + fix ── */}
                        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
                          {/* Left: Issues panel */}
                          <div className="min-w-0 space-y-4">
                            <Card className="border-[var(--border-strong)]">
                              <CardHeader>
                                <SectionHeading
                                  eyebrow="Issue priority"
                                  title="Check the risky values first"
                                  detail="Start with critical fields, then warnings, then clean up anything still blocking approval."
                                />
                              </CardHeader>
                              <CardContent className="space-y-4">
                                {/* Priority counts */}
                                <div className="grid gap-3 sm:grid-cols-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = reviewIssues.find(
                                        (i) =>
                                          i.tone === "critical" &&
                                          !resolvedIssueKeys.includes(i.key),
                                      );
                                      if (next) setSelectedIssueKey(next.key);
                                    }}
                                    className="rounded-[1.35rem] border border-red-400/30 bg-[rgba(239,68,68,0.1)] px-4 py-4 text-left text-red-100 transition hover:-translate-y-0.5 hover:bg-[rgba(239,68,68,0.14)]"
                                  >
                                    <div className="text-[11px] uppercase tracking-label">
                                      Critical
                                    </div>
                                    <div className="mt-2 text-2xl font-semibold">
                                      {criticalCount}
                                    </div>
                                    <div className="mt-2 text-sm text-red-50/80">
                                      Highest-risk values that can break operations or approvals.
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = reviewIssues.find(
                                        (i) =>
                                          i.tone === "warning" &&
                                          !resolvedIssueKeys.includes(i.key),
                                      );
                                      if (next) setSelectedIssueKey(next.key);
                                    }}
                                    className="rounded-[1.35rem] border border-amber-400/30 bg-[rgba(245,158,11,0.1)] px-4 py-4 text-left text-amber-100 transition hover:-translate-y-0.5 hover:bg-[rgba(245,158,11,0.14)]"
                                  >
                                    <div className="text-[11px] uppercase tracking-label">
                                      Warning
                                    </div>
                                    <div className="mt-2 text-2xl font-semibold">
                                      {warningCount}
                                    </div>
                                    <div className="mt-2 text-sm text-amber-50/80">
                                      Likely readable, but still worth a quick paper check.
                                    </div>
                                  </button>
                                  <div className="rounded-[1.35rem] border border-emerald-400/30 bg-[rgba(34,197,94,0.1)] px-4 py-4 text-emerald-100">
                                    <div className="text-[11px] uppercase tracking-label">
                                      Checked
                                    </div>
                                    <div className="mt-2 text-2xl font-semibold">
                                      {checkedIssueCount}
                                    </div>
                                    <div className="mt-2 text-sm text-emerald-50/80">
                                      Fields already reviewed and cleared for this pass.
                                    </div>
                                  </div>
                                </div>

                                {/* Issue list */}
                                {reviewIssues.length ? (
                                  <div className="space-y-3">
                                    {reviewIssues.map((issue) => {
                                      const resolved =
                                        resolvedIssueKeys.includes(issue.key);
                                      const isActive =
                                        activeIssue?.key === issue.key;
                                      return (
                                        <button
                                          key={issue.key}
                                          type="button"
                                          onClick={() =>
                                            setSelectedIssueKey(issue.key)
                                          }
                                          className={cn(
                                            "w-full rounded-[1.35rem] border px-4 py-4 text-left transition",
                                            isActive
                                              ? "border-[var(--accent)] bg-[linear-gradient(180deg,rgba(62,166,255,0.12),rgba(62,166,255,0.06))]"
                                              : "border-[var(--border)] bg-[var(--card-strong)] hover:-translate-y-0.5 hover:border-[var(--accent)]/30",
                                          )}
                                        >
                                          <div className="space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <span
                                                className={cn(
                                                  "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-label",
                                                  signalTone(issue.tone),
                                                )}
                                              >
                                                {issue.tone}
                                              </span>
                                              <span
                                                className={cn(
                                                  "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-label",
                                                  impactTone(issue.impact),
                                                )}
                                              >
                                                {impactLabel(issue.impact)}
                                              </span>
                                              {resolved ? (
                                                <span className="rounded-full border border-emerald-400/30 bg-[rgba(34,197,94,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-label text-emerald-100">
                                                  Checked
                                                </span>
                                              ) : null}
                                            </div>
                                            <div className="font-semibold text-[var(--text)]">
                                              {issue.title}
                                            </div>
                                            <div className="text-sm leading-6 text-[var(--muted)]">
                                              {issue.detail}
                                            </div>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="rounded-2xl border border-emerald-400/30 bg-[rgba(34,197,94,0.08)] px-4 py-4 text-sm text-emerald-100">
                                    No risky fields were found. A quick visual check should be
                                    enough before approval.
                                  </div>
                                )}

                                {/* Batch actions */}
                                {reviewIssues.length ? (
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      variant="outline"
                                      className="px-3 py-2 text-xs"
                                      disabled={
                                        !criticalCount ||
                                        criticalCount === resolvedIssueKeys.filter((key) => key.startsWith("confidence-") || key.startsWith("blank-")).length
                                      }
                                      onClick={() => {
                                        reviewIssues
                                          .filter(
                                            (i) =>
                                              i.tone === "critical" &&
                                              !resolvedIssueKeys.includes(i.key),
                                          )
                                          .forEach((i) =>
                                            setResolvedIssueKeys((keys) =>
                                              keys.includes(i.key) ? keys : [...keys, i.key],
                                            ),
                                          );
                                        const next = reviewIssues.find(
                                          (i) => !resolvedIssueKeys.includes(i.key),
                                        );
                                        if (next) setSelectedIssueKey(next.key);
                                      }}
                                    >
                                      ✓ Check all critical
                                    </Button>
                                    <Button
                                      variant="outline"
                                      className="px-3 py-2 text-xs"
                                      disabled={
                                        !warningCount ||
                                        warningCount === resolvedIssueKeys.filter((key) => key.startsWith("warning-")).length
                                      }
                                      onClick={() => {
                                        reviewIssues
                                          .filter(
                                            (i) =>
                                              i.tone === "warning" &&
                                              !resolvedIssueKeys.includes(i.key),
                                          )
                                          .forEach((i) =>
                                            setResolvedIssueKeys((keys) =>
                                              keys.includes(i.key) ? keys : [...keys, i.key],
                                            ),
                                          );
                                        const next = reviewIssues.find(
                                          (i) => !resolvedIssueKeys.includes(i.key),
                                        );
                                        if (next) setSelectedIssueKey(next.key);
                                      }}
                                    >
                                      ✓ Check all warnings
                                    </Button>
                                  </div>
                                ) : null}
                              </CardContent>
                            </Card>

                            {/* Active issue panel */}
                            <Card className="border-[var(--border-strong)]">
                              <CardHeader>
                                <SectionHeading
                                  eyebrow="Active issue"
                                  title={activeIssue ? activeIssue.title : "No issue selected"}
                                  detail={
                                    activeIssue
                                      ? "Use this panel as the reviewer brief."
                                      : "Select an item from the issue queue."
                                  }
                                />
                              </CardHeader>
                              <CardContent className="space-y-4">
                                {activeIssue ? (
                                  <>
                                    <div
                                      className={cn(
                                        "rounded-[1.35rem] border px-4 py-4",
                                        signalTone(activeIssue.tone),
                                      )}
                                    >
                                      <div className="text-xs font-semibold uppercase tracking-label">
                                        Suggested check
                                      </div>
                                      <div className="mt-2 text-sm leading-6">
                                        {activeIssue.detail}
                                      </div>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <MetricCard
                                        label="Detected value"
                                        value={activeIssue.affectedValue || "-"}
                                      />
                                      <MetricCard
                                        label="Expected review"
                                        value={activeIssue.expectedValue}
                                      />
                                    </div>
                                    <div className="rounded-[1.35rem] border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4">
                                      <div className="text-[11px] uppercase tracking-label text-[var(--muted)]">
                                        Why it matters
                                      </div>
                                      <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <SurfaceBadge
                                          className={impactTone(activeIssue.impact)}
                                        >
                                          {impactLabel(activeIssue.impact)}
                                        </SurfaceBadge>
                                        <span className="text-sm text-[var(--text)]">
                                          {activeIssue.helpText}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                      {resolvedIssueKeys.includes(activeIssue.key) ? (
                                        <div className="rounded-full border border-emerald-400/30 bg-[rgba(34,197,94,0.12)] px-4 py-2 text-xs font-semibold uppercase tracking-label text-emerald-100">
                                          Issue checked
                                        </div>
                                      ) : (
                                        <Button
                                          onClick={() =>
                                            setResolvedIssueKeys((keys) =>
                                              keys.includes(activeIssue.key)
                                                ? keys
                                                : [...keys, activeIssue.key],
                                            )
                                          }
                                          disabled={isBusy}
                                        >
                                          Mark checked
                                        </Button>
                                      )}
                                      {activeIssue.rowIndex != null &&
                                      activeIssue.columnIndex != null ? (
                                        <Button
                                          variant="outline"
                                          onClick={() => {
                                            const target = document.getElementById(
                                              `ocr-cell-${activeIssue.rowIndex}-${activeIssue.columnIndex}`,
                                            );
                                            target?.scrollIntoView({
                                              behavior: "smooth",
                                              block: "center",
                                            });
                                            target?.focus();
                                          }}
                                          disabled={isBusy}
                                        >
                                          Jump to field
                                        </Button>
                                      ) : null}
                                      <Button
                                        variant="ghost"
                                        onClick={handleNextIssue}
                                        disabled={isBusy || unresolvedIssueCount === 0}
                                      >
                                        Next issue
                                      </Button>
                                    </div>
                                  </>
                                ) : (
                                  <div className="rounded-[1.35rem] border border-[var(--border)] bg-[var(--card-strong)] px-4 py-4 text-sm text-[var(--muted)]">
                                    Select an issue from the list to focus the review.
                                  </div>
                                )}
                              </CardContent>
                            </Card>

                            {/* Review notes */}
                            <Card className="border-[var(--border-strong)]">
                              <CardHeader>
                                <SectionHeading
                                  eyebrow="Review notes"
                                  title="Capture what you checked"
                                  detail="Keep the note short but useful for the next approver."
                                />
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    variant="outline"
                                    className="px-3 py-2 text-xs"
                                    onClick={() => {
                                      const next = reviewIssues.find(
                                        (i) => i.tone === "critical",
                                      );
                                      if (next) setSelectedIssueKey(next.key);
                                    }}
                                    disabled={!criticalCount}
                                  >
                                    Show critical items
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="px-3 py-2 text-xs"
                                    onClick={() => {
                                      const next = reviewIssues.find(
                                        (i) =>
                                          i.actionLabel.toLowerCase().includes("fill"),
                                      );
                                      if (next) setSelectedIssueKey(next.key);
                                    }}
                                    disabled={!reviewIssues.some((i) =>
                                      i.actionLabel.toLowerCase().includes("fill"),
                                    )}
                                  >
                                    Show missing values
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="px-3 py-2 text-xs"
                                    onClick={handleApplySafeCleanup}
                                    disabled={isBusy || !safeFixCount}
                                  >
                                    Apply safe cleanup
                                  </Button>
                                </div>
                                <div>
                                  <label className="text-sm text-[var(--muted)]">
                                    Review note
                                  </label>
                                  <Textarea
                                    rows={4}
                                    value={reviewerNotes}
                                    onChange={(event) => {
                                      setReviewerNotes(event.target.value);
                                      setDirty(true);
                                    }}
                                    placeholder="Example: checked invoice total against the paper and corrected vehicle number."
                                    className="mt-3 rounded-[1.35rem] border-[var(--border-strong)] bg-[rgba(8,12,20,0.82)] px-4 py-3 leading-6"
                                  />
                                </div>
                                {canApprove ? (
                                  <div>
                                    <label className="text-sm text-[var(--muted)]">
                                      Reason for correction
                                    </label>
                                    <Textarea
                                      rows={3}
                                      value={rejectionReason}
                                      onChange={(event) => {
                                        setRejectionReason(event.target.value);
                                        setDirty(true);
                                      }}
                                      placeholder="Only needed when this document must go back for correction."
                                      className="mt-3 rounded-[1.35rem] border-[var(--border-strong)] bg-[rgba(8,12,20,0.82)] px-4 py-3 leading-6"
                                    />
                                  </div>
                                ) : null}
                                {approveNeedsOverride ? (
                                  <div className="rounded-2xl border border-amber-400/30 bg-[rgba(245,158,11,0.08)] px-4 py-4 text-sm text-amber-100">
                                    Critical issues are still open. Check them first, or add a clear
                                    review note before forcing approval.
                                  </div>
                                ) : null}
                                {activeRecord?.rejection_reason ? (
                                  <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.08)] px-4 py-4 text-sm text-red-200">
                                    Last correction reason: {activeRecord.rejection_reason}
                                  </div>
                                ) : null}
                              </CardContent>
                            </Card>
                          </div>

                          {/* Right: Fix fields */}
                          <div className="space-y-4">
                            <Card className="border-[var(--border-strong)]">
                              <CardHeader className="flex flex-col gap-3">
                                <SectionHeading
                                  eyebrow="Fix fields"
                                  title="Correct the flagged values"
                                  detail="Edit the extracted cells and mark issues as checked when done."
                                />
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    variant="outline"
                                    className="px-3 py-2 text-xs"
                                    onClick={() => setShowAllRows((v) => !v)}
                                    disabled={!draftRows.length}
                                  >
                                    {showAllRows
                                      ? "Hide full table"
                                      : "View all extracted rows"}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="px-3 py-2 text-xs"
                                    onClick={() => void handleDownloadExcel()}
                                    disabled={!draftRows.length || isBusy}
                                  >
                                    Download Excel
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="px-3 py-2 text-xs"
                                    onClick={handleDownloadCsv}
                                  >
                                    CSV
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="px-3 py-2 text-xs"
                                    onClick={() => void handleDownloadPdf()}
                                  >
                                    PDF
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="px-3 py-2 text-xs"
                                    onClick={() => void handleCopyMarkdown()}
                                  >
                                    Markdown
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-3">
                                  <MetricCard
                                    label="Flagged fields"
                                    value={editableIssues.length}
                                    detail="Items that need direct field review."
                                  />
                                  <MetricCard
                                    label="Rows loaded"
                                    value={draftRows.length}
                                    detail="Total extracted rows."
                                  />
                                  <MetricCard
                                    label="Safe cleanup"
                                    value={safeFixCount}
                                    detail="Whitespace-only fixes available."
                                  />
                                </div>

{/* Editable issues in focus */}
                                 <DocumentTypeAdapter
                                   data={activeRecord as OcrPreviewResult}
                                   onCellChange={(rowIndex, colIndex, value) => {
                                     setDraftRows((current) => {
                                       const newRows = [...current];
                                       if (!newRows[rowIndex]) {
                                         newRows[rowIndex] = [];
                                       }
                                       newRows[rowIndex][colIndex] = value;
                                       return newRows;
                                     });
                                     setDirty(true);
                                   }}
                                   onHeaderChange={(colIndex, value) => {
                                     setDraftHeaders((current) => {
                                       const newHeaders = [...current];
                                       newHeaders[colIndex] = value;
                                       return newHeaders;
                                     });
                                     setDirty(true);
                                   }}
                                   className="border-[var(--border-strong)]"
                                 />
                                        const confidence =
                                          activeRecord?.cell_confidence?.[
                                            issue.rowIndex
                                          
                                        
                                          
                                            issue.columnIndex
                                          


                                            issue.key,
                                          );
                                        return (
                                          <div
                                            key={issue.key}
                                            className={cn(
                                              "rounded-[1.35rem] border px-4 py-4",
                                              activeIssue?.key === issue.key
                                                ? "border-[var(--accent)] bg-[linear-gradient(180deg,rgba(62,166,255,0.12),rgba(62,166,255,0.05))]"
                                                : "border-[var(--border)] bg-[var(--card-strong)]",
                                            )}
                                          >
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                              <div className="flex flex-wrap items-center gap-2">
                                                <span
                                                  className={cn(
                                                    "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-label",
                                                    signalTone(issue.tone),
                                                  )}
                                                >
                                                  {issue.tone}
                                                </span>
                                                <span className="text-xs text-[var(--muted)]">
                                                  Row {issue.rowIndex + 1}
                                                </span>
                                                <span
                                                  className={cn(
                                                    "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-label",
                                                    confidenceBadgeClass(
                                                      confidence,
                                                    ),
                                                  )}
                                                >
                                                  {confidenceLabel(confidence)}
                                                </span>
                                              </div>
                                              <div className="flex gap-2">
                                                {resolved ? (
                                                  <div className="rounded-full border border-emerald-400/30 bg-[rgba(34,197,94,0.12)] px-3 py-2 text-[11px] font-semibold uppercase tracking-label text-emerald-100">
                                                    Checked
                                                  </div>
                                                ) : (
                                                  <Button
                                                    variant="outline"
                                                    className="px-3 py-2 text-xs"
                                                    onClick={() =>
                                                      setResolvedIssueKeys(
                                                        (keys) =>
                                                          keys.includes(
                                                            issue.key,
                                                          )
                                                            ? keys
                                                            : [
                                                                ...keys,

                                                              ],
                                                      )
                                                    }
                                                    disabled={isBusy}
                                                  >
                                                    Mark checked
                                                  </Button>
                                                )}
                                              </div>
                                            </div>
                                            <div className="mt-3">
                                              <div className="relative">
                                                <Input
                                                  id={`ocr-cell-${issue.rowIndex}-${issue.columnIndex}`}
                                                  value={value}
                                                  title={confidenceLabel(
                                                    confidence,
                                                  )}
                                                  onChange={(event) => {
                                                    setDraftRows((current) =>
                                                      current.map(
                                                        (row, ri) =>
                                                          ri ===

                                                            ? row.map(
                                                                (cell, ci) =>
                                                                  ci ===

                                                                    ? event
                                                                        .target
                                                                        .value
                                                                    : cell,
                                                              )
                                                            : row,
                                                      ),
                                                    );
                                                    setDirty(true);
                                                  }}
                                                  className={cn(
                                                    cellInputClass(
                                                      value,
                                                      confidence,
                                                    ),
                                                    activeIssue?.key ===
                                                      issue.key &&
                                                      "border-cyan-400/60 ring-2 ring-cyan-400/30",
                                                    "pr-20",
                                                  )}
                                                />
                                                <ConfidenceBadge
                                                  confidence={confidence}
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>
                                ) : (
                                  <div className="rounded-[1.35rem] border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                                    No flagged fields need direct correction right now.
                                  </div>
                                )}

                                {/* Full table */}
                                {showAllRows ? (
                                  <div className="overflow-x-auto rounded-[1.45rem] border border-[var(--border)] bg-[rgba(8,12,20,0.82)]">
                                    <table className="min-w-full text-left text-sm">
                                      <thead className="text-[var(--muted)]">
                                        <tr className="border-b border-[var(--border)]">
                                          <th className="px-3 py-3 font-medium">
                                            Row
                                          </th>
                                          {headers.map((header, columnIndex) => (
                                            <th
                                              key={`${header}-${columnIndex}`}
                                              className="px-3 py-3 font-medium"
                                            >
                                              <Input
                                                value={header}
                                                onChange={(event) => {
                                                  setDraftHeaders(
                                                    (current) => {
                                                      const next = [
                                                        ...current,
                                                      ];
                                                      next[columnIndex] =
                                                        event.target.value;
                                                      return next;
                                                    },
                                                  );
                                                  setDirty(true);
                                                }}
                                              />
                                            </th>
                                          ))}
                                          <th className="px-3 py-3 font-medium">
                                            Action
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {draftRows.map((row, rowIndex) => (
                                          <tr
                                            key={`row-${rowIndex}`}
                                            className={cn(
                                              "border-b border-[var(--border)]/60",
                                              activeIssue?.rowIndex ===
                                                rowIndex &&
                                                "bg-[rgba(62,166,255,0.05)]",
                                            )}
                                          >
                                            <td className="px-3 py-3 align-top font-semibold text-[var(--muted)]">
                                              {rowIndex + 1}
                                            </td>
                                            {headers.map(
                                              (header, columnIndex) => {


                                                    rowIndex
                                                  ]?.[columnIndex];
                                                const isActive =
                                                  activeIssue?.rowIndex ===
                                                    rowIndex &&
                                                  (activeIssue.columnIndex ??
                                                    columnIndex) ===
                                                    columnIndex;
                                                return (
                                                  <td
                                                    key={`${header}-${rowIndex}-${columnIndex}`}
                                                    className="px-3 py-3 align-top"
                                                  >
                                                    <div className="relative">
                                                      <Input
                                                        id={`ocr-cell-${rowIndex}-${columnIndex}`}
                                                        value={
                                                          row[columnIndex] ||
                                                          ""
                                                        }
                                                        title={confidenceLabel(
                                                          confidence,
                                                        )}
                                                        onChange={(
                                                          event,
                                                        ) => {
                                                          setDraftRows(
                                                            (current) =>
                                                              current.map(
                                                                (r, ri) =>
                                                                  ri ===
                                                                  rowIndex
                                                                    ? r.map(
                                                                        (
                                                                          cell,
                                                                          ci,
                                                                        ) =>
                                                                          ci ===
                                                                          columnIndex
                                                                            ? event
                                                                                .target
                                                                                .value
                                                                            : cell,
                                                                      )
                                                                    : r,
                                                              ),
                                                          );
                                                          setDirty(true);
                                                        }}
                                                        className={cn(
                                                          cellInputClass(
                                                            row[columnIndex] ||
                                                              "",
                                                            confidence,
                                                          ),
                                                          isActive &&
                                                            "border-cyan-400/60 ring-2 ring-cyan-400/30",
                                                          "pr-20",
                                                        )}
                                                      />
                                                      <ConfidenceBadge
                                                        confidence={
                                                          confidence
                                                        }
                                                      />
                                                    </div>
                                                  </td>
                                                );
                                              },
                                            )}
                                            <td className="px-3 py-3 align-top">
                                              <Button
                                                variant="ghost"
                                                onClick={() => {
                                                  setDraftRows((current) =>
                                                    current.filter(
                                                      (_, i) =>
                                                        i !== rowIndex,
                                                    ),
                                                  );
                                                  setDirty(true);
                                                }}
                                              >
                                                Remove
                                              </Button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : null}

                                <div className="flex flex-wrap gap-3">
                                  <Button
                                    variant="ghost"
                                    onClick={() => {
                                      setDraftRows((current) => [
                                        ...current,
                                        Array.from(
                                          { length: columnCount },
                                          () => "",
                                        ),
                                      ]);
                                      setDirty(true);
                                    }}
                                    disabled={!headers.length}
                                  >
                                    Add row
                                  </Button>
                                  {activeIssue ? (
                                    <Button
                                      variant="outline"
                                      onClick={() =>
                                        setResolvedIssueKeys((keys) =>
                                          keys.includes(activeIssue.key)
                                            ? keys
                                            : [...keys, activeIssue.key],
                                        )
                                      }
                                      disabled={
                                        isBusy ||
                                        resolvedIssueKeys.includes(
                                          activeIssue.key,
                                        )
                                      }
                                    >
                                      {resolvedIssueKeys.includes(
                                        activeIssue.key,
                                      )
                                        ? "Issue checked"
                                        : "Mark active issue checked"}
                                    </Button>
                                  ) : null}
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </section>

                        {/* ── Sticky action bar ── */}
                        <div className="sticky bottom-4 z-20 rounded-[1.5rem] border border-[var(--border)] bg-[rgba(10,14,24,0.94)] p-4 shadow-2xl backdrop-blur">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="text-sm text-[var(--muted)]">
                              {totalIssues
                                ? `${checkedIssueCount} of ${totalIssues} issues checked.`
                                : "No open issues detected."}
                              {unresolvedCriticalCount
                                ? ` ${unresolvedCriticalCount} critical issue${unresolvedCriticalCount === 1 ? "" : "s"} still need attention.`
                                : ""}
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <Button
                                variant="outline"
                                onClick={() => void handleSaveDraft()}
                                disabled={
                                  isBusy ||
                                  (!draftRows.length && !activeRecord)
                                }
                              >
                                {isBusy ? "Saving..." : "Save draft"}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={handleApplySafeCleanup}
                                disabled={isBusy || !safeFixCount}
                              >
                                Apply safe cleanup
                              </Button>
                              {!canApprove || activeStatus !== "pending" ? (
                                <Button
                                  onClick={() => void handleSubmit()}
                                  disabled={isBusy || !draftRows.length}
                                >
                                  Send for approval
                                </Button>
                              ) : null}
                              {canApprove ? (
                                <Button
                                  onClick={() => void handleApprove()}
                                  disabled={
                                    isBusy || !draftRows.length || approveNeedsOverride
                                  }
                                >
                                  Approve
                                </Button>
                              ) : null}
                              {canApprove ? (
                                <Button
                                  variant="ghost"
                                  onClick={() => void handleReject()}
                                  disabled={isBusy}
                                >
                                  Send for correction
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </OcrShell>
  );
}
