"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";

import { DocumentViewport, OCRExecutionWorkspace, ResizeRegion, WorkflowBanner, WorkflowFeedbackPanel, WorkspaceLayoutRegion, type FeedbackItem } from "@/v2/_governed";
import { GovernedOcrActionPanel } from "@/v2/workspaces/ocr-execution/components/governed-ocr-action-panel";
import { GovernedOcrCorrectionRail } from "@/v2/workspaces/ocr-execution/components/governed-ocr-correction-rail";
import { GovernedOcrIntakeScreen } from "@/v2/workspaces/ocr-execution/components/governed-ocr-intake-screen";
import { useGovernedOcrVerificationController } from "@/v2/workspaces/ocr-execution/use-governed-ocr-verification-controller";

const QUEUE_SEARCH_INPUT_ID = "governed-ocr-queue-search";
const DOCUMENT_REGION_ID = "governed-ocr-document-region";
const CORRECTION_GRID_REGION_ID = "governed-ocr-correction-grid";
const CORRECTION_INPUT_PREFIX = "governed-ocr-input-";
const REVIEWER_NOTES_ID = "governed-ocr-reviewer-notes";
const REJECTION_REASON_ID = "governed-ocr-rejection-reason";

function buildLegacyHref(route: {
  id: number | null;
  pane: string;
  search: string;
  status: string;
  step: number;
  tab: string;
}) {
  const params = new URLSearchParams();
  params.set("workspace", "legacy");

  if (route.id != null) {
    params.set("id", String(route.id));
  }
  params.set("step", String(route.step));

  if (route.search) {
    params.set("q", route.search);
  }
  if (route.status !== "all") {
    params.set("status", route.status);
  }
  if (route.pane !== "queue") {
    params.set("pane", route.pane);
  }
  if (route.tab !== "issues") {
    params.set("tab", route.tab);
  }

  return `/ocr/verify?${params.toString()}`;
}

function focusWithinRegion(regionId: string) {
  const region = document.getElementById(regionId);
  if (!region) {
    return;
  }

  region.focus();
  const focusable = region.querySelector<HTMLElement>("input, textarea, button, [tabindex='0']");
  focusable?.focus();
}

export function GovernedOcrVerificationPage() {
  const controller = useGovernedOcrVerificationController();
  const {
    access,
    actions,
    draft,
    messages,
    review,
    route,
  } = controller;

  const legacyHref = buildLegacyHref(route);
  const workspaceRecordId = route.id != null ? String(route.id) : review.workspaceRecords[0]?.queue.id;

  const governedSignalItems = useMemo<FeedbackItem[]>(() => {
    if (review.reviewSignals.length === 0) {
      return [
        {
          id: "governed-clean",
          title: "Governed review surface is clear",
          description: "No blocking manual review signals are active in the current OCR draft.",
          priority: "operational",
          category: "workflow",
        },
      ];
    }

    return review.reviewSignals.map((signal) => ({
      id: signal.id,
      title: signal.message,
      description:
        signal.rowIndex != null && signal.columnIndex != null
          ? `Row ${signal.rowIndex + 1}, column ${signal.columnIndex + 1}`
          : "Document-level OCR signal",
      priority:
        signal.tone === "critical"
          ? "critical"
          : signal.tone === "warning"
            ? "warning"
            : "informational",
      category: "ocr",
    }));
  }, [review.reviewSignals]);

  const workflowFeedItems = useMemo<FeedbackItem[]>(() => {
    return [
      ...governedSignalItems,
      {
        id: "governed-shortcuts",
        title: "Operational keyboard flow",
        description: "Alt+1 queue, Alt+2 document, Alt+3 correction rail, Ctrl/Cmd+S save, Ctrl/Cmd+Enter advance workflow.",
        priority: "informational",
        category: "workflow",
      },
    ];
  }, [governedSignalItems]);

  useEffect(() => {
    if (!(route.step === 3 || route.step === 4) || !draft.activeRecord) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key === "1") {
        event.preventDefault();
        document.getElementById(QUEUE_SEARCH_INPUT_ID)?.focus();
        return;
      }

      if (event.altKey && event.key === "2") {
        event.preventDefault();
        focusWithinRegion(DOCUMENT_REGION_ID);
        return;
      }

      if (event.altKey && event.key === "3") {
        event.preventDefault();
        focusWithinRegion(CORRECTION_GRID_REGION_ID);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void actions.saveDraft();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (route.step === 4 && access.canApprove) {
          void actions.approveDraft();
          return;
        }
        void actions.submitDraft();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [access.canApprove, actions, draft.activeRecord, route.step]);

  const handleOpenDocument = (recordId: string) => {
    actions.openDocument(Number(recordId));
  };

  const handleEscalateDocument = (recordId: string) => {
    actions.openDocument(Number(recordId));
    route.setTab("fix", "replace");
    window.setTimeout(() => {
      document.getElementById(REJECTION_REASON_ID)?.focus();
    }, 180);
  };

  const handleCompleteReview = async () => {
    if (route.step === 4 && access.canApprove) {
      await actions.approveDraft();
      return;
    }
    await actions.submitDraft();
  };

  if (access.loading) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-text-secondary">Loading governed OCR workspace...</main>;
  }

  if (!access.user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <div className="space-y-4 rounded-3xl border border-white/10 bg-black/20 p-8">
          <h1 className="text-xl font-semibold">Document review requires sign-in</h1>
          <p className="text-sm text-text-secondary">{access.sessionError || "Open access to continue into the governed OCR workspace."}</p>
          <Link href="/access" className="inline-flex rounded-xl border px-4 py-2">
            Open Access
          </Link>
        </div>
      </main>
    );
  }

  if (!access.canVerify) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
        <div className="space-y-4 rounded-3xl border border-white/10 bg-black/20 p-8">
          <h1 className="text-xl font-semibold">Document review is not available for this role</h1>
          <p className="text-sm text-text-secondary">Review access is limited to supervisors, managers, admins, and owners.</p>
          <Link href="/dashboard" className="inline-flex rounded-xl border px-4 py-2">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (route.step === 2 && !draft.activeRecord) {
    return (
      <GovernedOcrIntakeScreen
        busy={review.workspaceBusy}
        columns={draft.columnCount}
        error={messages.error}
        language={draft.language}
        legacyHref={legacyHref}
        onColumnsChange={actions.setColumns}
        onCreateDraft={actions.createDraft}
        onFileChange={actions.setFile}
        onLanguageChange={actions.setLanguage}
        onOpenQueue={route.openQueue}
        onSelectedTemplateChange={actions.setSelectedTemplateId}
        previewLanguages={review.previewLanguages}
        selectedTemplateId={draft.selectedTemplateId}
        status={messages.status}
        templateOptions={draft.templates.map((template) => ({ id: template.id, name: template.name }))}
      />
    );
  }

  return (
    <main className="dpr-governed-ocr factory-ocr-scope min-h-screen px-4 py-4 md:px-6 md:py-5">
      {messages.error ? (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{messages.error}</div>
      ) : null}
      {messages.status ? (
        <div className="border-b border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{messages.status}</div>
      ) : null}
      <div className="border-b border-white/10 bg-black/20 px-4 py-3 text-xs uppercase tracking-[0.16em] text-white/60">
        Governed OCR workspace now owns correction, send-back, approval, and export actions.{" "}
        <Link href={legacyHref} className="text-amber-300 underline underline-offset-4">
          Open legacy rollback lane
        </Link>
      </div>
      <div className="factory-ocr-shell">
        <section className="factory-ocr-header">
          <div className="factory-ocr-header__meta">
            <div className="max-w-4xl">
              <div className="factory-ocr-header__eyebrow">Governed OCR Review Console</div>
              <h1 className="factory-ocr-header__title">Queue to preview to correction to approval</h1>
              <p className="factory-ocr-header__subtitle">
                Persistent queue context, live document preview, correction rail, and action lane stay on one industrial workstation so operators can clear OCR backlog without route switching.
              </p>
            </div>
            <div className="factory-ocr-telemetry">
              <div className="factory-ocr-telemetry__item">
                <div className="factory-ocr-telemetry__label">Queue slice</div>
                <div className="factory-ocr-telemetry__value">{review.workspaceRecords.length} records</div>
              </div>
              <div className="factory-ocr-telemetry__item">
                <div className="factory-ocr-telemetry__label">Active signals</div>
                <div className="factory-ocr-telemetry__value">{review.reviewSignals.length}</div>
              </div>
              <div className="factory-ocr-telemetry__item">
                <div className="factory-ocr-telemetry__label">Workflow stage</div>
                <div className="factory-ocr-telemetry__value">{route.step === 4 ? "Approval" : "Review"}</div>
              </div>
            </div>
          </div>
          <div className="factory-ocr-stagebar">
            <div className="factory-ocr-stagepill" data-state="done"><span className="factory-ocr-stagepill__index">1</span><span className="factory-ocr-stagepill__label">Upload</span></div>
            <div className="factory-ocr-stagepill" data-state="done"><span className="factory-ocr-stagepill__index">2</span><span className="factory-ocr-stagepill__label">Prepare</span></div>
            <div className="factory-ocr-stagepill" data-state={route.step === 4 ? "done" : "current"}><span className="factory-ocr-stagepill__index">3</span><span className="factory-ocr-stagepill__label">Review</span></div>
            <div className="factory-ocr-stagepill" data-state={route.step === 4 ? "current" : "idle"}><span className="factory-ocr-stagepill__index">4</span><span className="factory-ocr-stagepill__label">Export</span></div>
          </div>
        </section>

      <OCRExecutionWorkspace
        bannerSlot={(record) => (
          <WorkflowBanner
            title={`${record.queue.title} is under governed operational ownership`}
            description={
              review.reviewSignals.length > 0
                ? `${review.reviewSignals.length} manual review signal${review.reviewSignals.length === 1 ? "" : "s"} are active. Correction and workflow commands now live in the governed lane.`
                : `All remaining review actions for this draft are handled inside the governed workspace. Queue state, corrections, and approval stay route-owned.`
            }
            priority={review.reviewSignals.some((signal) => signal.tone === "critical") ? "warning" : "operational"}
            action={
              <button type="button" className="fn-btn fn-btn-primary fn-btn-sm" onClick={() => void handleCompleteReview()}>
                {route.step === 4 && access.canApprove ? "Approve Extraction" : "Submit for Approval"}
              </button>
            }
          />
        )}
        bottomRailSlot={({ escalationItems, record, workflowItems }) => (
          <WorkspaceLayoutRegion direction="horizontal" className="h-full">
            <ResizeRegion
              defaultSize={760}
              minSize={520}
              maxSize={980}
              position="left"
              className="border-r border-[var(--color-border-default)]"
            >
              <GovernedOcrCorrectionRail
                activeRecord={draft.activeRecord}
                busy={review.workspaceBusy}
                headers={draft.headers}
                inputIdPrefix={CORRECTION_INPUT_PREFIX}
                onApplySafeCleanup={actions.applySafeCleanup}
                onCellChange={actions.setCellValue}
                onHeaderChange={actions.setHeaderValue}
                onOpenDocument={handleOpenDocument}
                onRestoreRowFromSource={actions.restoreRowFromSource}
                record={record}
                reviewSignals={review.reviewSignals}
                rows={draft.rows}
                tableRegionId={CORRECTION_GRID_REGION_ID}
              />
            </ResizeRegion>
            <WorkspaceLayoutRegion grow className="border-r border-[var(--color-border-default)]">
              <WorkflowFeedbackPanel items={governedSignalItems} title="Governed review signals" className="h-full rounded-none border-none" />
            </WorkspaceLayoutRegion>
            <ResizeRegion defaultSize={360} minSize={320} maxSize={440} position="right">
              <WorkflowFeedbackPanel items={[...workflowItems, ...escalationItems, ...workflowFeedItems]} title="Workflow feed" className="h-full rounded-none border-none" />
            </ResizeRegion>
          </WorkspaceLayoutRegion>
        )}
        documentSlot={() => (
          <div id={DOCUMENT_REGION_ID} tabIndex={-1} className="h-full outline-none">
            <DocumentViewport />
          </div>
        )}
        emptyStateSlot={
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-[var(--color-text-muted)]">
            No OCR queue records are available in the current governed slice.
          </div>
        }
        loading={review.workspaceBusy}
        onApproveDocuments={actions.approveDocuments}
        onApplyFieldCorrection={actions.applySelectedFieldCorrection}
        onCompleteActiveReview={handleCompleteReview}
        onEscalateDocument={handleEscalateDocument}
        onSelectDocument={handleOpenDocument}
        queueSearchInputId={QUEUE_SEARCH_INPUT_ID}
        records={review.workspaceRecords}
        selectedDocumentId={workspaceRecordId}
        sidePanelSlot={({ aiItems, escalationItems, onApplyFieldCorrection, record }) => (
          <GovernedOcrActionPanel
            activeRecord={draft.activeRecord}
            aiItems={aiItems}
            busy={review.workspaceBusy}
            canApprove={access.canApprove}
            correctionInputIdPrefix={CORRECTION_INPUT_PREFIX}
            dirty={review.dirty}
            escalationItems={escalationItems}
            legacyHref={legacyHref}
            notesInputId={REVIEWER_NOTES_ID}
            onApplyFieldCorrection={onApplyFieldCorrection}
            onApplySafeCleanup={actions.applySafeCleanup}
            onApproveDraft={() => void actions.approveDraft()}
            onCopyMarkdown={actions.copyMarkdown}
            onDownloadCsv={actions.downloadCsv}
            onDownloadExcel={actions.downloadExcel}
            onDownloadPdf={actions.downloadPdf}
            onOpenDocument={handleOpenDocument}
            onRejectDraft={() => void actions.rejectDraft()}
            onReviewerNotesChange={actions.setReviewerNotesValue}
            onRejectionReasonChange={actions.setRejectionReasonValue}
            onSaveDraft={() => void actions.saveDraft()}
            onSubmitDraft={() => void actions.submitDraft()}
            onUpdateSelectedFieldValue={actions.updateSelectedFieldValue}
            record={record}
            rejectionReason={draft.rejectionReason}
            rejectionReasonInputId={REJECTION_REASON_ID}
            reviewSignals={review.reviewSignals}
            reviewerNotes={draft.reviewerNotes}
            routeStep={route.step}
          />
        )}
      />
      </div>
    </main>
  );
}
