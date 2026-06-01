"use client";

import { useEffect, useMemo, useState } from "react";

import { formatApiErrorMessage } from "@/lib/api";
import { canApproveOcrVerification, canUseOcrVerification, validateOcrImageFile } from "@/lib/ocr-access";
import {
  downloadOcrVerificationExport,
  previewOcrLogbook,
  stringifyOcrCell,
  type OcrVerificationRecord,
  type OcrVerificationSavePayload,
} from "@/lib/ocr";
import { buildStructuredPdfBlob, exportRowsToCsv, exportRowsToMarkdown } from "@/lib/ocr-export";
import { triggerBlobDownload } from "@/lib/reports";
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
import { useSession } from "@/lib/use-session";
import { signalWorkflowRefresh, subscribeToWorkflowRefresh } from "@/lib/workflow-sync";
import { mapOcrQueueToWorkspace, mapOcrVerificationToWorkspace } from "@/v2/adapters";
import {
  applyGovernedSafeCleanup,
  buildControlledVerificationRecord,
  buildDraftMutationPayload,
  buildGovernedReviewSignals,
  fallbackGovernedHeaders,
  getSourceCellValue,
  normalizeGovernedValue,
  parseGovernedFieldId,
} from "@/v2/workspaces/ocr-execution/ocr-governed.utils";

const PREVIEW_LANGUAGES = ["eng", "auto", "eng+hin+mar"] as const;

export function useGovernedOcrVerificationController() {
  const route = useOcrVerifyRouteState();
  const { user, loading, error: sessionError } = useSession();
  const canVerify = canUseOcrVerification(user?.role);
  const canApprove = canApproveOcrVerification(user?.role);

  const templatesQuery = useOcrVerifyTemplatesQuery(canVerify);
  const queueQuery = useOcrVerifyQueueQuery({ search: route.search, status: route.status }, canVerify);
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
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [dirty, setDirty] = useState(false);
  const [hydratedRevision, setHydratedRevision] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [localError, setLocalError] = useState("");

  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const queueRecords = queueQuery.data ?? [];
  const activeRecord = detailQuery.data ?? null;
  const activeTemplate = useMemo(
    () => templates.find((template) => String(template.id) === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  // Extract stable refetch references — the query objects themselves are new
  // references on every render, so using them directly in deps would re-run
  // this effect on every render and re-subscribe on every render.
  const refetchQueue = queueQuery.refetch;
  const refetchDetail = detailQuery.refetch;

  useEffect(() => {
    if (!canVerify) {
      return;
    }
    return subscribeToWorkflowRefresh(() => {
      void refetchQueue();
      if (route.id != null) {
        void refetchDetail();
      }
    });
  }, [canVerify, refetchDetail, refetchQueue, route.id]);

  useEffect(() => {
    if (!activeTemplate || activeRecord) {
      return;
    }
    setColumns(activeTemplate.columns);
    setLanguage(activeTemplate.language || "eng");
  }, [activeRecord, activeTemplate]);

  useEffect(() => {
    if (!activeRecord) {
      if (route.id == null && !dirty) {
        setHeaders([]);
        setRows([]);
        setReviewerNotes("");
        setRejectionReason("");
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

    setSelectedTemplateId(activeRecord.template_id ? String(activeRecord.template_id) : "");
    setLanguage(activeRecord.language || "eng");
    setColumns(nextColumnCount);
    setHeaders(
      activeRecord.headers?.length
        ? activeRecord.headers
        : fallbackGovernedHeaders(nextColumnCount, activeTemplate),
    );
    setRows(
      normalizedRows.map((row) =>
        Array.from({ length: nextColumnCount }, (_, index) => row[index] || ""),
      ),
    );
    setReviewerNotes(activeRecord.reviewer_notes || "");
    setRejectionReason(activeRecord.rejection_reason || "");
    setDirty(false);
    setHydratedRevision(revisionKey);
  }, [activeRecord, activeTemplate, dirty, hydratedRevision, route.id]);

  const columnCount = useMemo(() => {
    return Math.max(columns, headers.length, ...rows.map((row) => row.length), 1);
  }, [columns, headers.length, rows]);

  const normalizedHeaders = useMemo(() => {
    const base = fallbackGovernedHeaders(columnCount, activeTemplate);
    return Array.from({ length: columnCount }, (_, index) => headers[index] || base[index]);
  }, [activeTemplate, columnCount, headers]);

  const controlledRecord = useMemo(() => {
    if (!activeRecord) {
      return null;
    }
    return buildControlledVerificationRecord(activeRecord, {
      headers: normalizedHeaders,
      language,
      rejectionReason,
      reviewerNotes,
      rows,
      selectedTemplateId,
    });
  }, [activeRecord, language, normalizedHeaders, rejectionReason, reviewerNotes, rows, selectedTemplateId]);

  const reviewSignals = useMemo(
    () => buildGovernedReviewSignals(controlledRecord, normalizedHeaders, rows),
    [controlledRecord, normalizedHeaders, rows],
  );

  const workspaceRecords = useMemo(() => {
    const mapped = mapOcrQueueToWorkspace(queueRecords);
    if (!controlledRecord) {
      return mapped;
    }

    const detailed = mapOcrVerificationToWorkspace(controlledRecord);
    return mapped.some((record) => record.verificationId === controlledRecord.id)
      ? mapped.map((record) => (record.verificationId === controlledRecord.id ? detailed : record))
      : [detailed, ...mapped];
  }, [controlledRecord, queueRecords]);

  const workspaceBusy =
    queueQuery.isFetching ||
    detailQuery.isFetching ||
    templatesQuery.isFetching ||
    createMutation.isPending ||
    updateMutation.isPending ||
    submitMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending;

  const combinedError =
    localError ||
    (queueQuery.error ? formatApiErrorMessage(queueQuery.error, "Could not load OCR verification queue.") : "") ||
    (detailQuery.error ? formatApiErrorMessage(detailQuery.error, "Could not load the OCR verification draft.") : "") ||
    (templatesQuery.error ? formatApiErrorMessage(templatesQuery.error, "Could not load OCR templates.") : "");

  const sourceImageUrl = controlledRecord?.source_image_url ? `/api${controlledRecord.source_image_url}` : "";

  const persistDraft = async () => {
    if (!activeRecord) {
      throw new Error("Open a draft first so OCR review state belongs to a route-owned record.");
    }
    if (!rows.length) {
      throw new Error("There are no OCR rows to save yet.");
    }

    return updateMutation.mutateAsync({
      id: activeRecord.id,
      payload: buildDraftMutationPayload(
        activeRecord,
        {
          headers: normalizedHeaders,
          language,
          rejectionReason,
          reviewerNotes,
          rows,
          selectedTemplateId,
        },
        columnCount,
      ),
    });
  };

  const openDocument = (verificationId: number) => {
    const target = queueRecords.find((record) => record.id === verificationId);
    const targetStep = target?.status === "pending" || target?.status === "approved" ? 4 : 3;
    route.openVerification(verificationId, targetStep, "workspace");
  };

  const createDraft = async () => {
    const preflightError = validateOcrImageFile(file, "Document image", { required: true });
    if (preflightError) {
      setLocalError(preflightError);
      return;
    }
    if (!file) {
      return;
    }

    setLocalError("");
    setStatusMessage("");

    try {
      const preview = await previewOcrLogbook({
        columns,
        file,
        language,
        templateId: selectedTemplateId ? Number(selectedTemplateId) : null,
      });

      const normalizedRows = preview.rows.map((row) => row.map((cell) => stringifyOcrCell(cell)));
      const nextColumnCount = Math.max(preview.columns || 0, ...normalizedRows.map((row) => row.length), 1);
      const created = await createMutation.mutateAsync({
        templateId: selectedTemplateId ? Number(selectedTemplateId) : null,
        sourceFilename: file.name || "OCR draft",
        columns: nextColumnCount,
        language,
        avgConfidence: preview.avg_confidence,
        warnings: preview.warnings,
        rawText: preview.raw_text ?? null,
        headers: fallbackGovernedHeaders(nextColumnCount, activeTemplate),
        originalRows: preview.rows,
        reviewedRows: normalizedRows,
        rawColumnAdded: preview.raw_column_added,
        file,
      } satisfies OcrVerificationSavePayload);

      setFile(null);
      setStatusMessage(`Governed intake created draft #${created.id}.`);
      route.openVerification(created.id, 3, "workspace");
      signalWorkflowRefresh("ocr-governed-created");
    } catch (error) {
      setLocalError(formatApiErrorMessage(error, "Could not create an OCR verification draft."));
    }
  };

  const saveDraft = async () => {
    setLocalError("");
    setStatusMessage("");
    try {
      const saved = await persistDraft();
      setDirty(false);
      setStatusMessage(`Draft #${saved.id} saved from the governed workspace.`);
      route.replaceVerification(saved.id, 3, "workspace");
      signalWorkflowRefresh("ocr-governed-saved");
      return saved;
    } catch (error) {
      setLocalError(formatApiErrorMessage(error, "Could not save the OCR draft."));
      throw error;
    }
  };

  const submitDraft = async () => {
    setLocalError("");
    setStatusMessage("");
    try {
      const saved = dirty ? await persistDraft() : activeRecord;
      if (!saved) {
        throw new Error("Open a draft first.");
      }
      const submitted = await submitMutation.mutateAsync({
        id: saved.id,
        reviewerNotes,
      });
      setDirty(false);
      setStatusMessage(`Draft #${submitted.id} moved into approval state.`);
      route.replaceVerification(submitted.id, 4, "workspace");
      signalWorkflowRefresh("ocr-governed-submitted");
      return submitted;
    } catch (error) {
      setLocalError(formatApiErrorMessage(error, "Could not submit the OCR draft."));
      throw error;
    }
  };

  const approveDraft = async () => {
    setLocalError("");
    setStatusMessage("");
    try {
      const saved = dirty ? await persistDraft() : activeRecord;
      if (!saved) {
        throw new Error("Open a draft first.");
      }
      const approved = await approveMutation.mutateAsync({
        id: saved.id,
        reviewerNotes,
      });
      setDirty(false);
      setStatusMessage(`Draft #${approved.id} approved as trusted OCR output.`);
      route.replaceVerification(approved.id, 4, "workspace");
      signalWorkflowRefresh("ocr-governed-approved");
      return approved;
    } catch (error) {
      setLocalError(formatApiErrorMessage(error, "Could not approve the OCR draft."));
      throw error;
    }
  };

  const rejectDraft = async () => {
    if (!rejectionReason.trim()) {
      const error = new Error("Add a rejection reason before sending the draft back.");
      setLocalError(error.message);
      throw error;
    }

    setLocalError("");
    setStatusMessage("");
    try {
      const saved = dirty ? await persistDraft() : activeRecord;
      if (!saved) {
        throw new Error("Open a draft first.");
      }
      const rejected = await rejectMutation.mutateAsync({
        id: saved.id,
        rejectionReason: rejectionReason.trim(),
        reviewerNotes,
      });
      setDirty(false);
      setStatusMessage(`Draft #${rejected.id} was sent back for correction.`);
      route.replaceVerification(rejected.id, 4, "workspace");
      signalWorkflowRefresh("ocr-governed-rejected");
      return rejected;
    } catch (error) {
      setLocalError(formatApiErrorMessage(error, "Could not reject the OCR draft."));
      throw error;
    }
  };

  const approveDocuments = async (recordIds: Iterable<string>) => {
    setLocalError("");
    setStatusMessage("");
    const ids = Array.from(recordIds).map((value) => Number(value));

    try {
      for (const id of ids) {
        let record = queueRecords.find((item) => item.id === id) ?? null;
        if (activeRecord?.id === id) {
          record = dirty ? await persistDraft() : activeRecord;
        }
        if (!record) {
          continue;
        }
        if (record.status === "draft" || record.status === "rejected") {
          record = await submitMutation.mutateAsync({
            id: record.id,
            reviewerNotes: activeRecord?.id === id ? reviewerNotes : record.reviewer_notes || undefined,
          });
        }
        if (canApprove && record.status !== "approved") {
          await approveMutation.mutateAsync({
            id: record.id,
            reviewerNotes: activeRecord?.id === id ? reviewerNotes : record.reviewer_notes || undefined,
          });
        }
      }

      setDirty(false);
      await queueQuery.refetch();
      await detailQuery.refetch();
      setStatusMessage(
        canApprove
          ? `Governed workflow approved ${ids.length} document${ids.length === 1 ? "" : "s"}.`
          : `Governed workflow submitted ${ids.length} document${ids.length === 1 ? "" : "s"} for approval.`,
      );
      signalWorkflowRefresh("ocr-governed-bulk-advanced");
    } catch (error) {
      setLocalError(formatApiErrorMessage(error, "Could not advance the selected OCR document(s)."));
      throw error;
    }
  };

  const setHeaderValue = (columnIndex: number, value: string) => {
    setHeaders((current) => {
      const next = [...current];
      next[columnIndex] = value;
      return next;
    });
    setDirty(true);
  };

  const setCellValue = (rowIndex: number, columnIndex: number, value: string) => {
    setRows((current) =>
      current.map((row, index) =>
        index === rowIndex
          ? row.map((cell, cellIndex) => (cellIndex === columnIndex ? value : cell))
          : row,
      ),
    );
    setDirty(true);
  };

  const updateSelectedFieldValue = (fieldId: string, value: string) => {
    const address = parseGovernedFieldId(fieldId);
    if (!address) {
      return;
    }
    setCellValue(address.rowIndex, address.columnIndex, value);
  };

  const applySelectedFieldCorrection = (recordId: string, fieldId: string) => {
    if (activeRecord && String(activeRecord.id) !== recordId) {
      openDocument(Number(recordId));
      return;
    }

    const address = parseGovernedFieldId(fieldId);
    if (!address) {
      return;
    }

    const currentValue = rows[address.rowIndex]?.[address.columnIndex] || "";
    const sourceValue = getSourceCellValue(activeRecord, address.rowIndex, address.columnIndex);
    const cleanedValue = normalizeGovernedValue(sourceValue || currentValue);
    if (cleanedValue !== currentValue) {
      setCellValue(address.rowIndex, address.columnIndex, cleanedValue);
      setStatusMessage(`Applied governed cleanup to row ${address.rowIndex + 1}, column ${address.columnIndex + 1}.`);
      return;
    }

    if (!currentValue && sourceValue) {
      setCellValue(address.rowIndex, address.columnIndex, sourceValue);
      setStatusMessage(`Restored OCR source text to row ${address.rowIndex + 1}, column ${address.columnIndex + 1}.`);
    }
  };

  const applySafeCleanup = () => {
    const cleaned = applyGovernedSafeCleanup(normalizedHeaders, rows);
    setHeaders(cleaned.headers);
    setRows(cleaned.rows);
    setDirty(true);
    setStatusMessage("Governed safe cleanup applied. Recheck the flagged values before approval.");
  };

  const restoreRowFromSource = (rowIndex: number) => {
    if (!activeRecord) {
      return;
    }

    setRows((current) =>
      current.map((row, index) =>
        index === rowIndex
          ? Array.from({ length: columnCount }, (_, columnIndex) => {
            const sourceValue = getSourceCellValue(activeRecord, rowIndex, columnIndex);
            return sourceValue || row[columnIndex] || "";
          })
          : row,
      ),
    );
    setDirty(true);
    setStatusMessage(`Restored OCR source text for row ${rowIndex + 1}.`);
  };

  const downloadExcel = async () => {
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

  const downloadCsv = () => {
    triggerBlobDownload(
      new Blob([exportRowsToCsv(normalizedHeaders, rows)], { type: "text/csv;charset=utf-8" }),
      "ocr-reviewed.csv",
    );
    setStatusMessage("Downloaded the reviewed CSV export.");
  };

  const downloadPdf = async () => {
    try {
      const pdf = await buildStructuredPdfBlob({
        title: activeRecord?.source_filename || "OCR Review Export",
        headers: normalizedHeaders,
        rows,
      });
      triggerBlobDownload(pdf, "ocr-reviewed.pdf");
      setStatusMessage("Downloaded the reviewed PDF export.");
    } catch (error) {
      setLocalError(formatApiErrorMessage(error, "Could not download the reviewed PDF export."));
    }
  };

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(exportRowsToMarkdown(normalizedHeaders, rows));
      setStatusMessage("Copied the reviewed Markdown table.");
    } catch (error) {
      setLocalError(formatApiErrorMessage(error, "Could not copy the reviewed Markdown table."));
    }
  };

  const setReviewerNotesValue = (value: string) => {
    setReviewerNotes(value);
    setDirty(true);
  };

  const setRejectionReasonValue = (value: string) => {
    setRejectionReason(value);
    setDirty(true);
  };

  return {
    access: {
      canApprove,
      canVerify,
      loading,
      sessionError,
      user,
    },
    actions: {
      applySafeCleanup,
      approveDocuments,
      approveDraft,
      applySelectedFieldCorrection,
      copyMarkdown,
      createDraft,
      downloadCsv,
      downloadExcel,
      downloadPdf,
      openDocument,
      rejectDraft,
      restoreRowFromSource,
      saveDraft,
      setCellValue,
      setHeaderValue,
      setLanguage,
      setLocalError,
      setColumns,
      setFile,
      setReviewerNotesValue,
      setRejectionReasonValue,
      setSelectedTemplateId,
      submitDraft,
      updateSelectedFieldValue,
    },
    draft: {
      activeRecord: controlledRecord,
      activeTemplate,
      columnCount,
      headers: normalizedHeaders,
      language,
      rejectionReason,
      reviewerNotes,
      rows,
      selectedTemplateId,
      sourceImageUrl,
      templates,
    },
    messages: {
      error: combinedError,
      status: statusMessage,
    },
    query: {
      detailQuery,
      queueQuery,
      templatesQuery,
    },
    review: {
      dirty,
      previewLanguages: PREVIEW_LANGUAGES,
      reviewSignals,
      workspaceBusy,
      workspaceRecords,
    },
    route,
    setters: {
      clearStatus() {
        setStatusMessage("");
      },
    },
    state: {
      file,
    },
  };
}
