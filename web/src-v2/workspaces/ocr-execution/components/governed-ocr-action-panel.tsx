"use client";

import Link from "next/link";
import { useMemo } from "react";

import type { OcrVerificationRecord } from "@/lib/ocr";
import {
  AINotificationCenter,
  OperationalAlert,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelSection,
  ScrollRegion,
  type FeedbackItem,
  type OCRExecutionRecord,
  useOCRWorkspace,
} from "@/v2/_governed";
import {
  buildGovernedFieldId,
  getSourceCellValue,
  parseGovernedFieldId,
  type GovernedReviewSignal,
} from "@/v2/workspaces/ocr-execution/ocr-governed.utils";

type GovernedOcrActionPanelProps = {
  activeRecord: OcrVerificationRecord | null;
  aiItems: FeedbackItem[];
  busy: boolean;
  canApprove: boolean;
  correctionInputIdPrefix: string;
  dirty: boolean;
  escalationItems: FeedbackItem[];
  legacyHref: string;
  notesInputId: string;
  onApplyFieldCorrection: (recordId: string, fieldId: string) => void;
  onApplySafeCleanup: () => void;
  onApproveDraft: () => void | Promise<void>;
  onCopyMarkdown: () => void | Promise<void>;
  onDownloadCsv: () => void | Promise<void>;
  onDownloadExcel: () => void | Promise<void>;
  onDownloadPdf: () => void | Promise<void>;
  onOpenDocument: (recordId: string) => void;
  onRejectDraft: () => void | Promise<void>;
  onReviewerNotesChange: (value: string) => void;
  onRejectionReasonChange: (value: string) => void;
  onSaveDraft: () => void | Promise<void>;
  onSubmitDraft: () => void | Promise<void>;
  onUpdateSelectedFieldValue: (fieldId: string, value: string) => void;
  record: OCRExecutionRecord;
  rejectionReason: string;
  rejectionReasonInputId: string;
  reviewSignals: GovernedReviewSignal[];
  reviewerNotes: string;
  routeStep: number;
};

function areaInputClassName() {
  return "min-h-[112px] w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] px-[var(--spacing-3)] py-[var(--spacing-3)] text-[13px] text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-accent-operational-border)] focus:ring-2 focus:ring-[var(--color-accent-operational-border)]/30";
}

function fieldInputClassName(accent: "critical" | "warning" | "default") {
  if (accent === "critical") {
    return "w-full rounded-[var(--radius-md)] border border-[var(--color-status-critical-border)] bg-[var(--color-status-critical-surface)] px-[var(--spacing-3)] py-[var(--spacing-2)] text-[13px] text-[var(--color-status-critical-text)] outline-none transition focus:ring-2 focus:ring-[var(--color-status-critical-border)]/30";
  }
  if (accent === "warning") {
    return "w-full rounded-[var(--radius-md)] border border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-surface)] px-[var(--spacing-3)] py-[var(--spacing-2)] text-[13px] text-[var(--color-status-warning-text)] outline-none transition focus:ring-2 focus:ring-[var(--color-status-warning-border)]/30";
  }
  return "w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] px-[var(--spacing-3)] py-[var(--spacing-2)] text-[13px] text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-accent-operational-border)] focus:ring-2 focus:ring-[var(--color-accent-operational-border)]/30";
}

export function GovernedOcrActionPanel({
  activeRecord,
  aiItems,
  busy,
  canApprove,
  correctionInputIdPrefix,
  dirty,
  escalationItems,
  legacyHref,
  notesInputId,
  onApplyFieldCorrection,
  onApplySafeCleanup,
  onApproveDraft,
  onCopyMarkdown,
  onDownloadCsv,
  onDownloadExcel,
  onDownloadPdf,
  onOpenDocument,
  onRejectDraft,
  onReviewerNotesChange,
  onRejectionReasonChange,
  onSaveDraft,
  onSubmitDraft,
  onUpdateSelectedFieldValue,
  record,
  rejectionReason,
  rejectionReasonInputId,
  reviewSignals,
  reviewerNotes,
  routeStep,
}: GovernedOcrActionPanelProps) {
  const workspace = useOCRWorkspace();
  const ownsRecord = activeRecord != null && String(activeRecord.id) === record.queue.id;
  const selectedField =
    record.extractionFields.find((field) => field.id === workspace.selectedFieldId) ?? record.extractionFields[0] ?? null;
  const selectedAddress = parseGovernedFieldId(selectedField?.id);
  const fieldSignals = useMemo(() => {
    if (!selectedAddress) {
      return [] as GovernedReviewSignal[];
    }
    return reviewSignals.filter(
      (signal) => signal.rowIndex === selectedAddress.rowIndex && signal.columnIndex === selectedAddress.columnIndex,
    );
  }, [reviewSignals, selectedAddress]);
  const sourceValue = selectedAddress
    ? getSourceCellValue(activeRecord, selectedAddress.rowIndex, selectedAddress.columnIndex)
    : "";
  const selectedValue = selectedField ? String(selectedField.value ?? "").replaceAll("—", "") : "";
  const selectedTone =
    fieldSignals.some((signal) => signal.tone === "critical")
      ? "critical"
      : fieldSignals.some((signal) => signal.tone === "warning")
        ? "warning"
        : "default";

  const primaryAction =
    routeStep === 4 && canApprove
      ? {
        label: "Approve extraction",
        onAction: onApproveDraft,
      }
      : {
        label: "Submit for approval",
        onAction: onSubmitDraft,
      };

  const jumpToSignal = (signal: GovernedReviewSignal) => {
    if (!activeRecord || signal.rowIndex == null || signal.columnIndex == null) {
      return;
    }

    const fieldId = buildGovernedFieldId(activeRecord.id, signal.rowIndex, signal.columnIndex);
    workspace.setSelectedFieldId(fieldId);
    window.setTimeout(() => {
      document.getElementById(`${correctionInputIdPrefix}${signal.rowIndex}-${signal.columnIndex}`)?.focus();
    }, 40);
  };

  if (!ownsRecord) {
    return (
      <Panel variant="ai" padding="none" className="h-full rounded-none border-none">
        <PanelHeader title="Governed command lane" subtitle="Route-owned review state required" meta={record.queue.id} />
        <PanelBody padding="none" className="min-h-0">
          <ScrollRegion ownerId="governed-ocr-command-idle" className="h-full" viewportClassName="h-full">
            <div className="flex min-h-full flex-col gap-[var(--spacing-4)] p-[var(--spacing-4)]">
              <PanelSection inset title="Open the governed draft" description="Queue selection is visible, but editing only activates after the route owns the selected verification.">
                <div className="flex flex-wrap gap-[var(--spacing-2)]">
                  <button type="button" className="fn-btn fn-btn-primary fn-btn-sm" onClick={() => onOpenDocument(record.queue.id)}>
                    Open document
                  </button>
                  <Link href={legacyHref} className="fn-btn fn-btn-secondary fn-btn-sm">
                    Legacy rollback lane
                  </Link>
                </div>
              </PanelSection>
              {aiItems.length > 0 ? <AINotificationCenter items={aiItems} className="min-h-[220px]" /> : null}
            </div>
          </ScrollRegion>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel variant="ai" padding="none" className="h-full rounded-none border-none">
      <PanelHeader
        title="Governed command lane"
        subtitle="Corrections, notes, send-back, and approval now live in this workspace"
        meta={dirty ? "Unsaved changes" : record.queue.id}
      />
      <PanelBody padding="none" className="min-h-0">
        <ScrollRegion ownerId="governed-ocr-command-scroll" className="h-full" viewportClassName="h-full">
          <div className="flex min-h-full flex-col gap-[var(--spacing-4)] p-[var(--spacing-4)]">
            <PanelSection
              inset
              title="Selected extraction"
              description={selectedField?.label ?? "Select a field in the correction rail or extraction list"}
              action={
                selectedField ? (
                  <button
                    type="button"
                    className="fn-btn fn-btn-ai fn-btn-sm"
                    onClick={() => onApplyFieldCorrection(record.queue.id, selectedField.id)}
                  >
                    Restore OCR text
                  </button>
                ) : null
              }
            >
              {selectedField ? (
                <div className="space-y-[var(--spacing-3)]">
                  <input
                    className={fieldInputClassName(selectedTone)}
                    value={selectedValue}
                    onChange={(event) => onUpdateSelectedFieldValue(selectedField.id, event.target.value)}
                  />
                  <div className="grid gap-[var(--spacing-2)] text-[12px] text-[var(--color-text-muted)]">
                    <div>
                      Source: <span className="text-[var(--color-text-primary)]">{sourceValue || "No source text captured"}</span>
                    </div>
                    <div>
                      Confidence:{" "}
                      <span className="text-[var(--color-text-primary)]">
                        {typeof selectedField.confidence === "number"
                          ? `${Math.round(selectedField.confidence * 100)}%`
                          : "Not available"}
                      </span>
                    </div>
                    <div>
                      Field lane:{" "}
                      <span className="text-[var(--color-text-primary)]">
                        {selectedAddress ? `Row ${selectedAddress.rowIndex + 1}, column ${selectedAddress.columnIndex + 1}` : "No address"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-[12px] text-[var(--color-text-muted)]">
                  Use the governed correction rail to select a field and take ownership of the edit.
                </div>
              )}
            </PanelSection>

            <PanelSection
              inset
              title="Governed quick actions"
              description="Low-risk cleanup and correction helpers stay in the governed lane."
            >
              <div className="flex flex-wrap gap-[var(--spacing-2)]">
                <button type="button" className="fn-btn fn-btn-secondary fn-btn-sm" onClick={onApplySafeCleanup}>
                  Safe cleanup
                </button>
                <button type="button" className="fn-btn fn-btn-secondary fn-btn-sm" onClick={() => void onSaveDraft()} disabled={busy}>
                  Save draft
                </button>
                <Link href={legacyHref} className="fn-btn fn-btn-secondary fn-btn-sm">
                  Rollback lane
                </Link>
              </div>
            </PanelSection>

            <PanelSection inset title="Review notes" description="Notes and send-back reasons stay attached to the verification record.">
              <div className="space-y-[var(--spacing-3)]">
                <div className="space-y-[var(--spacing-2)]">
                  <label htmlFor={notesInputId} className="text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                    Reviewer notes
                  </label>
                  <textarea
                    id={notesInputId}
                    className={areaInputClassName()}
                    value={reviewerNotes}
                    onChange={(event) => onReviewerNotesChange(event.target.value)}
                  />
                </div>
                <div className="space-y-[var(--spacing-2)]">
                  <label htmlFor={rejectionReasonInputId} className="text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                    Send-back reason
                  </label>
                  <textarea
                    id={rejectionReasonInputId}
                    className={areaInputClassName()}
                    value={rejectionReason}
                    onChange={(event) => onRejectionReasonChange(event.target.value)}
                  />
                </div>
              </div>
            </PanelSection>

            {reviewSignals.length > 0 ? (
              <PanelSection inset title="Review signals" description="Click a signal to move the governed correction focus to that field.">
                <div className="flex flex-col gap-[var(--spacing-2)]">
                  {reviewSignals.slice(0, 8).map((signal) => (
                    <button
                      key={signal.id}
                      type="button"
                      className="flex w-full flex-col items-start rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-surface-elevated)] px-[var(--spacing-3)] py-[var(--spacing-3)] text-left transition hover:border-[var(--color-accent-operational-border)]"
                      onClick={() => jumpToSignal(signal)}
                    >
                      <span className="text-[12px] font-medium text-[var(--color-text-primary)]">{signal.message}</span>
                      <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                        {signal.rowIndex != null && signal.columnIndex != null
                          ? `Row ${signal.rowIndex + 1} / column ${signal.columnIndex + 1}`
                          : "Document-level signal"}
                      </span>
                    </button>
                  ))}
                </div>
              </PanelSection>
            ) : null}

            {aiItems.length > 0 ? <AINotificationCenter items={aiItems} className="min-h-[220px]" /> : null}

            {escalationItems.length > 0 ? (
              <PanelSection inset title="Operational alerts" description="Route-owned alerts now sit beside the workflow actions they drive.">
                <div className="flex flex-col gap-[var(--spacing-3)]">
                  {escalationItems.map((item) => (
                    <OperationalAlert
                      key={item.id}
                      title={item.title}
                      description={item.description}
                      priority={item.priority}
                      action={
                        <button type="button" className="fn-btn fn-btn-secondary fn-btn-sm" onClick={() => void onRejectDraft()}>
                          Send back
                        </button>
                      }
                    />
                  ))}
                </div>
              </PanelSection>
            ) : null}
          </div>
        </ScrollRegion>
      </PanelBody>
      <PanelFooter className="justify-between">
        <div className="flex flex-wrap gap-[var(--spacing-2)]">
          <button type="button" className="fn-btn fn-btn-secondary fn-btn-sm" onClick={() => void onDownloadExcel()} disabled={busy}>
            Excel
          </button>
          <button type="button" className="fn-btn fn-btn-secondary fn-btn-sm" onClick={() => void onDownloadCsv()} disabled={busy}>
            CSV
          </button>
          <button type="button" className="fn-btn fn-btn-secondary fn-btn-sm" onClick={() => void onDownloadPdf()} disabled={busy}>
            PDF
          </button>
          <button type="button" className="fn-btn fn-btn-secondary fn-btn-sm" onClick={() => void onCopyMarkdown()} disabled={busy}>
            Markdown
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-[var(--spacing-2)]">
          <button type="button" className="fn-btn fn-btn-ai fn-btn-sm" onClick={() => void onRejectDraft()} disabled={busy}>
            Send back
          </button>
          <button type="button" className="fn-btn fn-btn-primary fn-btn-sm" onClick={() => void primaryAction.onAction()} disabled={busy}>
            {primaryAction.label}
          </button>
        </div>
      </PanelFooter>
    </Panel>
  );
}
