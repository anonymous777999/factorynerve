import {
  normalizeOcrConfidence,
  stringifyOcrCell,
  type OcrCell,
  type OcrVerificationRecord,
} from "@/lib/ocr";
import type {
  OCRBoundingBox,
  OCRExtractionField,
  OCRReviewState,
  QueueStateValue,
  WorkflowStateValue,
} from "@/v2/_governed/types/datatable";
import type { GovernedOcrWorkspaceRecord } from "@/v2/contracts";

const MAX_EXTRACTION_FIELDS = 80;

function toCellConfidence(value: OcrCell | undefined, fallback: number | null | undefined) {
  if (value && typeof value === "object" && "confidence" in value) {
    return normalizeOcrConfidence(value.confidence);
  }
  return normalizeOcrConfidence(fallback);
}

function toCellReviewState(confidence: number | null, hasWarning: boolean): OCRReviewState {
  if (hasWarning && confidence != null && confidence < 0.5) {
    return "failed";
  }
  if (hasWarning || (confidence != null && confidence < 0.72)) {
    return "flagged";
  }
  if (confidence != null && confidence >= 0.9) {
    return "reviewed";
  }
  return "unreviewed";
}

function toWorkflowState(record: OcrVerificationRecord): WorkflowStateValue {
  switch (record.status) {
    case "approved":
      return "approved";
    case "rejected":
      return "blocked";
    case "pending":
      return "in-review";
    default:
      return "pending";
  }
}

function toQueueState(record: OcrVerificationRecord, lowConfidenceCount: number): QueueStateValue {
  if (record.status === "approved") {
    return "ready";
  }
  if (record.status === "rejected" || lowConfidenceCount > 0 || (record.warnings?.length ?? 0) > 0) {
    return "blocked";
  }
  if (record.status === "pending") {
    return "processing";
  }
  return "queued";
}

function buildTimeline(record: OcrVerificationRecord) {
  return [
    {
      id: `${record.id}-created`,
      label: "Draft created",
      detail: record.source_filename || "OCR verification draft created",
      status: "done" as const,
      timestamp: record.created_at || "Created",
    },
    {
      id: `${record.id}-submitted`,
      label: "Review queue",
      detail:
        record.status === "draft"
          ? "Waiting for reviewer completion."
          : record.status === "pending"
            ? "Submitted into the approval queue."
            : record.status === "rejected"
              ? "Sent back for correction."
              : "Approved for trusted downstream usage.",
      status:
        record.status === "draft"
          ? ("current" as const)
          : record.status === "rejected"
            ? ("critical" as const)
            : ("done" as const),
      timestamp: record.submitted_at || record.updated_at || "Pending",
    },
    {
      id: `${record.id}-decision`,
      label: "Manager decision",
      detail:
        record.status === "approved"
          ? "Trusted OCR export is available."
          : record.status === "rejected"
            ? record.rejection_reason || "Correction required before approval."
            : "Awaiting operational decision.",
      status:
        record.status === "approved"
          ? ("done" as const)
          : record.status === "rejected"
            ? ("critical" as const)
            : ("pending" as const),
      timestamp: record.approved_at || record.rejected_at || "Pending",
    },
  ];
}

export function mapOcrVerificationToWorkspace(record: OcrVerificationRecord): GovernedOcrWorkspaceRecord {
  const rows = (record.reviewed_rows?.length ? record.reviewed_rows : record.original_rows || []) as OcrCell[][];
  const headers = record.headers?.length
    ? record.headers
    : Array.from({ length: record.columns || 1 }, (_, index) => `Column ${index + 1}`);
  const cellConfidence = record.cell_confidence || [];
  const cellBoxes = record.cell_boxes || [];
  const lowConfidenceCount = rows.reduce((count, row, rowIndex) => {
    return (
      count +
      row.reduce((rowCount, cell, columnIndex) => {
        const confidence = toCellConfidence(cell, cellConfidence[rowIndex]?.[columnIndex]);
        return rowCount + (confidence != null && confidence < 0.72 ? 1 : 0);
      }, 0)
    );
  }, 0);
  const anomalyCount = Math.max(record.warnings?.length ?? 0, lowConfidenceCount);

  const extractionFields: OCRExtractionField[] = [];
  const boundingBoxes: OCRBoundingBox[] = [];

  rows.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      if (extractionFields.length >= MAX_EXTRACTION_FIELDS) {
        return;
      }

      const value = stringifyOcrCell(cell);
      const confidence = toCellConfidence(cell, cellConfidence[rowIndex]?.[columnIndex]);
      const hasWarning = confidence != null && confidence < 0.72;
      const reviewState = toCellReviewState(confidence, hasWarning);
      const label = headers[columnIndex] || `Column ${columnIndex + 1}`;
      const box = cellBoxes[rowIndex]?.[columnIndex];
      const fieldId = `${record.id}-field-${rowIndex}-${columnIndex}`;

      extractionFields.push({
        id: fieldId,
        label,
        value: value || "—",
        confidence,
        reviewState,
        pageId: `${record.id}-page-1`,
        boundingBoxId: box ? `${record.id}-box-${rowIndex}-${columnIndex}` : undefined,
        meta: `Row ${rowIndex + 1} / ${label}`,
      });

      if (box) {
        boundingBoxes.push({
          id: `${record.id}-box-${rowIndex}-${columnIndex}`,
          pageId: `${record.id}-page-1`,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          confidence,
          label,
          anomaly: hasWarning,
          reviewState,
        });
      }
    });
  });

  const fieldCount = rows.reduce((count, row) => count + row.length, 0);
  const completedFields = rows.reduce(
    (count, row) => count + row.filter((cell) => stringifyOcrCell(cell).trim().length > 0).length,
    0,
  );
  const confidence = normalizeOcrConfidence(record.avg_confidence) ?? 0;

  return {
    verificationId: record.id,
    editableInLegacy: false,
    sourceRecord: record,
    queue: {
      id: String(record.id),
      title: record.source_filename || `OCR document #${record.id}`,
      supplier: record.template_name || "OCR review",
      source: record.doc_type_hint || "document intake",
      assignee:
        record.approved_by_name ||
        record.rejected_by_name ||
        record.created_by_name ||
        "Unassigned",
      pages: record.scan_quality?.page_count || 1,
      fieldCount,
      completedFields,
      confidence,
      anomalyCount,
      queueState: toQueueState(record, lowConfidenceCount),
      workflowState: toWorkflowState(record),
      reviewState:
        record.status === "approved"
          ? "reviewed"
          : anomalyCount > 0
            ? "anomaly"
            : confidence < 0.8
              ? "low-confidence"
              : "suggested",
      lastUpdated: record.updated_at || record.created_at || "",
      priority:
        record.status === "rejected" || anomalyCount > 0
          ? "critical"
          : confidence < 0.85
            ? "warning"
            : "normal",
    },
    document: {
      id: `ocr-doc-${record.id}`,
      title: record.source_filename || `OCR document #${record.id}`,
      pages: [
        {
          id: `${record.id}-page-1`,
          pageNumber: 1,
          title: record.template_name || "Source document",
          status: toWorkflowState(record),
          completeness: fieldCount > 0 ? completedFields / fieldCount : 0,
          imageSrc: record.source_image_url ? `/api${record.source_image_url}` : undefined,
        },
      ],
    },
    boundingBoxes,
    extractionFields,
    aiRecommendations:
      record.warnings?.length
        ? record.warnings
        : [
            confidence < 0.72
              ? "Low-confidence extraction requires manual review before trusted export."
              : "No blocking OCR warnings reported by the backend.",
          ],
    workflowTimeline: buildTimeline(record),
  };
}

export function mapOcrQueueToWorkspace(records: OcrVerificationRecord[]) {
  return records.map(mapOcrVerificationToWorkspace);
}
