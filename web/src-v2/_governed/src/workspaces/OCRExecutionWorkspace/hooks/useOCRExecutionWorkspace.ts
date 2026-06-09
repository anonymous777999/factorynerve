import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { FeedbackContextValue, OCRExtractionField } from "../../../../types/datatable";
import { SEED_OCR_EXECUTION_RECORDS } from "../ocrExecutionWorkspace.data";
import {
  buildQueueFilterChips,
  deriveOCRExecutionKpis,
  deriveOCRExecutionPanels,
  filterOCRExecutionRecords,
} from "../ocrExecutionWorkspace.orchestration";
import type {
  OCRExecutionFilters,
  OCRExecutionQueueFilter,
  OCRExecutionRecord,
} from "../ocrExecutionWorkspace.contracts";

interface UseOCRExecutionWorkspaceOptions {
  onApplyFieldCorrection?: (recordId: string, fieldId: string) => void | Promise<void>;
  onApproveDocuments?: (recordIds: Iterable<string>) => void | Promise<void>;
  onCompleteActiveReview?: (recordId: string) => void | Promise<void>;
  onEscalateDocument?: (recordId: string) => void | Promise<void>;
  onSelectDocument?: (recordId: string) => void;
  records?: OCRExecutionRecord[];
  pushFeedback?: FeedbackContextValue["pushFeedback"];
  selectedDocumentId?: string;
}

function updateFieldReviewState(
  field: OCRExtractionField,
  state: OCRExtractionField["reviewState"],
  meta?: OCRExtractionField["meta"]
) {
  return {
    ...field,
    confidence: typeof field.confidence === "number" ? Math.max(field.confidence, 0.92) : 0.92,
    meta: meta ?? field.meta,
    reviewState: state,
  };
}

export function useOCRExecutionWorkspace({
  onApplyFieldCorrection,
  onApproveDocuments,
  onCompleteActiveReview,
  onEscalateDocument,
  onSelectDocument,
  pushFeedback,
  records: providedRecords,
  selectedDocumentId: controlledSelectedDocumentId,
}: UseOCRExecutionWorkspaceOptions = {}) {
  const [records, setRecords] = useState<OCRExecutionRecord[]>(SEED_OCR_EXECUTION_RECORDS);
  const sourceRecords = providedRecords ?? records;
  const [selectedDocumentId, setSelectedDocumentId] = useState(
    controlledSelectedDocumentId ?? providedRecords?.[0]?.queue.id ?? SEED_OCR_EXECUTION_RECORDS[0]?.queue.id ?? ""
  );
  const [filters, setFilters] = useState<OCRExecutionFilters>({
    anomaliesOnly: false,
    query: "",
    queueFilter: "all",
  });

  const deferredQuery = useDeferredValue(filters.query);
  const filteredRecords = useMemo(
    () =>
      filterOCRExecutionRecords(sourceRecords, {
        ...filters,
        query: deferredQuery,
      }),
    [deferredQuery, filters, sourceRecords]
  );

  const selectedRecord =
    filteredRecords.find((record) => record.queue.id === selectedDocumentId) ??
    sourceRecords.find((record) => record.queue.id === selectedDocumentId) ??
    filteredRecords[0] ??
    sourceRecords[0];

  useEffect(() => {
    // Sync the controlled prop into local state when it changes.
    // Prefer the controlled value; fall back to the first available record.
    // Do NOT include selectedDocumentId in deps — it's the value being set,
    // including it would create a ping-pong loop with the state update.
    const next =
      controlledSelectedDocumentId ||
      filteredRecords[0]?.queue.id ||
      sourceRecords[0]?.queue.id;
    if (next && next !== selectedDocumentId) {
      setSelectedDocumentId(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledSelectedDocumentId, filteredRecords, sourceRecords]);

  const kpis = useMemo(() => deriveOCRExecutionKpis(sourceRecords), [sourceRecords]);
  const panels = useMemo(
    () =>
      selectedRecord
        ? deriveOCRExecutionPanels(selectedRecord)
        : { aiItems: [], escalationItems: [], workflowItems: [] },
    [selectedRecord]
  );
  const filterChips = useMemo(() => buildQueueFilterChips(filters), [filters]);

  const updateRecord = (recordId: string, updater: (record: OCRExecutionRecord) => OCRExecutionRecord) => {
    if (providedRecords) {
      return;
    }
    setRecords((current) => current.map((record) => (record.queue.id === recordId ? updater(record) : record)));
  };

  const setQuery = (query: string) => {
    startTransition(() => {
      setFilters((current) => ({ ...current, query }));
    });
  };

  const setQueueFilter = (queueFilter: OCRExecutionQueueFilter) => {
    startTransition(() => {
      setFilters((current) => ({ ...current, queueFilter }));
    });
  };

  const toggleAnomaliesOnly = () => {
    startTransition(() => {
      setFilters((current) => ({ ...current, anomaliesOnly: !current.anomaliesOnly }));
    });
  };

  const selectDocument = (recordId: string) => {
    setSelectedDocumentId(recordId);
    onSelectDocument?.(recordId);
  };

  const approveDocuments = (recordIds: Iterable<string>) => {
    const ids = Array.from(recordIds);
    if (ids.length === 0) {
      return;
    }

    if (onApproveDocuments) {
      void onApproveDocuments(ids);
    } else {
      setRecords((current) =>
        current.map((record) =>
          ids.includes(record.queue.id)
            ? {
              ...record,
              extractionFields: record.extractionFields.map((field) =>
                field.reviewState === "reviewed"
                  ? field
                  : updateFieldReviewState(field, "reviewed", "Approved through OCR execution workflow")
              ),
              queue: {
                ...record.queue,
                completedFields: record.queue.fieldCount,
                confidence: Math.max(record.queue.confidence, 0.91),
                queueState: "ready",
                reviewState: "reviewed",
                workflowState: "approved",
              },
            }
            : record
        )
      );
    }

    pushFeedback?.({
      title: `${ids.length} OCR document${ids.length > 1 ? "s" : ""} approved`,
      description: "Approved extractions are ready for downstream operational posting.",
      priority: "operational",
      category: "approval",
      scope: "ocr-workflow",
    });
  };

  const escalateDocument = (recordId: string) => {
    if (onEscalateDocument) {
      void onEscalateDocument(recordId);
    } else {
      updateRecord(recordId, (record) => ({
        ...record,
        queue: {
          ...record.queue,
          anomalyCount: Math.max(record.queue.anomalyCount, 1),
          priority: "critical",
          queueState: "blocked",
          reviewState: "anomaly",
          workflowState: "blocked",
        },
        workflowTimeline: record.workflowTimeline.map((step) =>
          step.status === "current" ? { ...step, detail: "Escalated for anomaly handling", status: "critical" } : step
        ),
      }));
    }

    pushFeedback?.({
      title: "OCR escalation opened",
      description: "Operational anomaly routing was triggered for the active document.",
      priority: "escalation",
      category: "ocr",
      scope: "ocr-escalation",
    });
  };

  const applyFieldCorrection = (recordId: string, fieldId: string) => {
    if (onApplyFieldCorrection) {
      void onApplyFieldCorrection(recordId, fieldId);
    } else {
      updateRecord(recordId, (record) => ({
        ...record,
        extractionFields: record.extractionFields.map((field) =>
          field.id === fieldId
            ? updateFieldReviewState(field, "corrected", "AI-assisted correction accepted by reviewer")
            : field
        ),
        queue: {
          ...record.queue,
          completedFields: Math.min(record.queue.completedFields + 1, record.queue.fieldCount),
          confidence: Math.max(record.queue.confidence, 0.87),
          reviewState: "suggested",
        },
      }));
    }

    pushFeedback?.({
      title: "AI correction applied",
      description: "The selected extraction field has been promoted into the operational review state.",
      priority: "ai-review",
      category: "ai",
      scope: "ocr-ai",
    });
  };

  const completeActiveReview = () => {
    if (!selectedRecord) {
      return;
    }

    if (onCompleteActiveReview) {
      void onCompleteActiveReview(selectedRecord.queue.id);
    } else {
      approveDocuments([selectedRecord.queue.id]);
    }

    pushFeedback?.({
      title: "Review completion recorded",
      description: `${selectedRecord.queue.title} moved into the ready lane for downstream execution.`,
      priority: "informational",
      category: "workflow",
      scope: "ocr-workflow",
    });
  };

  return {
    filterChips,
    filteredRecords,
    filters,
    kpis,
    panels,
    records: sourceRecords,
    selectedRecord,
    actions: {
      approveDocuments,
      applyFieldCorrection,
      completeActiveReview,
      escalateDocument,
      selectDocument,
      setQuery,
      setQueueFilter,
      toggleAnomaliesOnly,
    },
  };
}
