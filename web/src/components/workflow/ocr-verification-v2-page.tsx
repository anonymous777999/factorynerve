"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBanner } from "@/components/ocr/error-banner";
import { OcrShell } from "@/components/ocr/ocr-shell";
import { formatApiErrorMessage } from "@/lib/api";
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

const PREVIEW_LANGUAGES = ["eng", "auto", "eng+hin+mar"] as const;

function fallbackHeaders(columnCount: number, template?: OcrTemplate | null) {
  return Array.from({ length: Math.max(columnCount, 1) }, (_, index) => {
    return template?.column_names?.[index] || `Column ${index + 1}`;
  });
}

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
  const [hydratedRevision, setHydratedRevision] = useState<string>("");

  // Beforeunload guard — warn on unsaved edits
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
    });
  }, [activeRecord, activeTemplate, dirty, hydratedRevision, route.id]);

  const columnCount = useMemo(() => {
    return Math.max(columns, draftHeaders.length, ...draftRows.map((row) => row.length), 1);
  }, [columns, draftHeaders.length, draftRows]);

  const headers = useMemo(() => {
    const base = fallbackHeaders(columnCount, activeTemplate);
    return Array.from({ length: columnCount }, (_, index) => draftHeaders[index] || base[index]);
  }, [activeTemplate, columnCount, draftHeaders]);

  const reviewSignals = useMemo(() => {
    if (!activeRecord) {
      return [];
    }
    const issues: string[] = [];
    for (let rowIndex = 0; rowIndex < draftRows.length; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex < headers.length; columnIndex += 1) {
        const value = draftRows[rowIndex]?.[columnIndex]?.trim() ?? "";
        if (!value) {
          issues.push(`Row ${rowIndex + 1}, ${headers[columnIndex]} is blank.`);
          if (issues.length >= 8) {
            return issues;
          }
        }
      }
    }
    return [...issues, ...(activeRecord.warnings ?? []).slice(0, Math.max(0, 8 - issues.length))];
  }, [activeRecord, draftRows, headers]);

  const isBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    submitMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending;

  const queueError = queueQuery.error ? formatApiErrorMessage(queueQuery.error, "Could not load OCR verification queue.") : "";
  const detailError = detailQuery.error ? formatApiErrorMessage(detailQuery.error, "Could not load the requested OCR draft.") : "";
  const templatesError = templatesQuery.error ? formatApiErrorMessage(templatesQuery.error, "Could not load OCR templates.") : "";

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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading OCR verification access...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
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
      step={route.step === 1 ? "entry" : route.step === 2 ? "prepare" : route.step === 3 ? "processing" : "result"}
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
          <Card className="xl:sticky xl:top-6 xl:self-start">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>OCR queue</CardTitle>
              <Button variant="outline" onClick={() => void queueQuery.refetch()}>
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {queueQuery.isLoading ? <div className="text-sm text-[var(--muted)]">Loading OCR queue...</div> : null}
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

          <div className="space-y-4">
            {route.step === 1 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Select the route-owned workflow</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-[var(--muted)]">
                  <p>Choose an OCR draft from the queue to resume it with refresh continuity, or start a new intake draft.</p>
                  <div className="flex gap-3">
                    <Button onClick={() => route.openIntake()}>Start intake</Button>
                    {queue[0] ? (
                      <Button variant="outline" onClick={() => route.openVerification(queue[0].id, 3)}>
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
                      <label className="mb-2 block text-sm text-[var(--muted)]">Document image</label>
                      <Input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm text-[var(--muted)]">OCR template</label>
                      <Select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
                        <option value="">No template</option>
                        {templates.map((template) => (
                          <option key={template.id} value={String(template.id)}>
                            {template.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm text-[var(--muted)]">Expected columns</label>
                      <Input
                        type="number"
                        min={1}
                        max={16}
                        value={columns}
                        onChange={(event) => setColumns(Math.max(1, Number(event.target.value) || 1))}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm text-[var(--muted)]">Language hint</label>
                      <Select value={language} onChange={(event) => setLanguage(event.target.value)}>
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

            {(route.step === 3 || route.step === 4) ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle>
                    {activeRecord?.source_filename || "OCR review workspace"}
                  </CardTitle>
                  {detailQuery.isFetching ? <div className="text-sm text-[var(--muted)]">Refreshing draft...</div> : null}
                </CardHeader>
                <CardContent className="space-y-4">
                  {!activeRecord && !detailQuery.isLoading ? (
                    <div className="rounded-2xl border border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                      This step needs a route-owned draft id. Open a queue item or create a new OCR draft first.
                    </div>
                  ) : null}
                  {activeRecord ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-[var(--border)] p-4">
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Status</div>
                          <div className="mt-2 text-lg font-semibold text-[var(--text)]">{activeRecord.status}</div>
                        </div>
                        <div className="rounded-2xl border border-[var(--border)] p-4">
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Updated</div>
                          <div className="mt-2 text-lg font-semibold text-[var(--text)]">{formatTimestamp(activeRecord.updated_at)}</div>
                        </div>
                        <div className="rounded-2xl border border-[var(--border)] p-4">
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Warnings</div>
                          <div className="mt-2 text-lg font-semibold text-[var(--text)]">{reviewSignals.length}</div>
                        </div>
                      </div>

                      {reviewSignals.length ? (
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-50">
                          {reviewSignals.slice(0, 5).map((signal) => (
                            <div key={signal}>{signal}</div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-50">
                          No immediate OCR issues are flagged in the current draft snapshot.
                        </div>
                      )}

                      <div className="space-y-3 overflow-x-auto">
                        <div className="min-w-[48rem] space-y-2">
                          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(120px, 1fr))` }}>
                            {headers.map((header, columnIndex) => (
                              <Input
                                key={`header-${columnIndex}`}
                                value={header}
                                onChange={(event) => {
                                  setDraftHeaders((current) => {
                                    const next = [...current];
                                    next[columnIndex] = event.target.value;
                                    return next;
                                  });
                                  setDirty(true);
                                }}
                              />
                            ))}
                          </div>
                          {draftRows.map((row, rowIndex) => (
                            <div key={`row-${rowIndex}`} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(120px, 1fr))` }}>
                              {Array.from({ length: columnCount }, (_, columnIndex) => (
                                <Input
                                  key={`cell-${rowIndex}-${columnIndex}`}
                                  value={row[columnIndex] || ""}
                                  onChange={(event) => {
                                    setDraftRows((current) =>
                                      current.map((currentRow, index) =>
                                        index === rowIndex
                                          ? currentRow.map((cell, cellIndex) =>
                                              cellIndex === columnIndex ? event.target.value : cell,
                                            )
                                          : currentRow,
                                      ),
                                    );
                                    setDirty(true);
                                  }}
                                />
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm text-[var(--muted)]">Reviewer notes</label>
                          <Textarea
                            value={reviewerNotes}
                            onChange={(event) => {
                              setReviewerNotes(event.target.value);
                              setDirty(true);
                            }}
                            rows={4}
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm text-[var(--muted)]">Rejection reason</label>
                          <Textarea
                            value={rejectionReason}
                            onChange={(event) => {
                              setRejectionReason(event.target.value);
                              setDirty(true);
                            }}
                            rows={4}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button onClick={() => void handleSaveDraft()} disabled={isBusy}>
                          Save draft
                        </Button>
                        <Button variant="outline" onClick={() => void handleSubmit()} disabled={isBusy}>
                          Submit for approval
                        </Button>
                        {canApprove ? (
                          <>
                            <Button variant="outline" onClick={() => void handleApprove()} disabled={isBusy}>
                              Approve
                            </Button>
                            <Button variant="outline" onClick={() => void handleReject()} disabled={isBusy}>
                              Reject
                            </Button>
                          </>
                        ) : null}
                        <Button variant="outline" onClick={() => void handleDownloadExcel()} disabled={isBusy}>
                          Download Excel
                        </Button>
                        <Button variant="outline" onClick={handleDownloadCsv}>
                          Download CSV
                        </Button>
                        <Button variant="outline" onClick={() => void handleDownloadPdf()}>
                          Download PDF
                        </Button>
                        <Button variant="outline" onClick={() => void handleCopyMarkdown()}>
                          Copy Markdown
                        </Button>
                      </div>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </OcrShell>
  );
}
