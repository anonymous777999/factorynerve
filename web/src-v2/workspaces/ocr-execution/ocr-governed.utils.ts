import { normalizeOcrConfidence, stringifyOcrCell, type OcrVerificationRecord } from "@/lib/ocr";

export type GovernedReviewSignal = {
  id: string;
  message: string;
  rowIndex?: number;
  columnIndex?: number;
  tone: "critical" | "warning" | "info";
};

export type GovernedDraftState = {
  headers: string[];
  language: string;
  rejectionReason: string;
  reviewerNotes: string;
  rows: string[][];
  selectedTemplateId: string;
};

export function buildGovernedFieldId(recordId: number | string, rowIndex: number, columnIndex: number) {
  return `${recordId}-field-${rowIndex}-${columnIndex}`;
}

export function parseGovernedFieldId(fieldId: string | null | undefined) {
  if (!fieldId) {
    return null;
  }

  const match = /-field-(\d+)-(\d+)$/.exec(fieldId);
  if (!match) {
    return null;
  }

  return {
    columnIndex: Number(match[2]),
    rowIndex: Number(match[1]),
  };
}

export function normalizeGovernedValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function applyGovernedSafeCleanup(headers: string[], rows: string[][]) {
  return {
    headers: headers.map(normalizeGovernedValue),
    rows: rows.map((row) => row.map(normalizeGovernedValue)),
  };
}

export function fallbackGovernedHeaders(columnCount: number, template?: { column_names?: string[] | null } | null) {
  return Array.from({ length: Math.max(columnCount, 1) }, (_, index) => {
    return template?.column_names?.[index] || `Column ${index + 1}`;
  });
}

export function buildControlledVerificationRecord(
  record: OcrVerificationRecord,
  state: GovernedDraftState,
): OcrVerificationRecord {
  return {
    ...record,
    headers: state.headers,
    language: state.language,
    rejection_reason: state.rejectionReason,
    reviewed_rows: state.rows,
    reviewer_notes: state.reviewerNotes,
    template_id: state.selectedTemplateId ? Number(state.selectedTemplateId) : record.template_id ?? null,
    updated_at: record.updated_at || new Date().toISOString(),
  };
}

export function buildGovernedReviewSignals(
  record: OcrVerificationRecord | null,
  headers: string[],
  rows: string[][],
) {
  if (!record) {
    return [] as GovernedReviewSignal[];
  }

  const signals: GovernedReviewSignal[] = [];

  headers.forEach((header, columnIndex) => {
    if (!header.trim()) {
      signals.push({
        id: `header-${columnIndex}`,
        message: `Column ${columnIndex + 1} header is blank.`,
        columnIndex,
        tone: "warning",
      });
    }
  });

  rows.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      if (!cell.trim()) {
        signals.push({
          id: `blank-${rowIndex}-${columnIndex}`,
          message: `Row ${rowIndex + 1}, ${headers[columnIndex] || `Column ${columnIndex + 1}`} is blank.`,
          rowIndex,
          columnIndex,
          tone: "warning",
        });
      }

      const confidence = normalizeOcrConfidence(record.cell_confidence?.[rowIndex]?.[columnIndex]);
      if (confidence != null && confidence < 0.5) {
        signals.push({
          id: `critical-${rowIndex}-${columnIndex}`,
          message: `Row ${rowIndex + 1}, ${headers[columnIndex] || `Column ${columnIndex + 1}`} is low confidence.`,
          rowIndex,
          columnIndex,
          tone: "critical",
        });
      } else if (confidence != null && confidence < 0.8) {
        signals.push({
          id: `review-${rowIndex}-${columnIndex}`,
          message: `Row ${rowIndex + 1}, ${headers[columnIndex] || `Column ${columnIndex + 1}`} should be reviewed.`,
          rowIndex,
          columnIndex,
          tone: "info",
        });
      }
    });
  });

  (record.warnings || []).forEach((warning, index) => {
    signals.push({
      id: `backend-warning-${index}`,
      message: warning,
      tone: "critical",
    });
  });

  return signals.slice(0, 18);
}

export function buildDraftMutationPayload(
  record: OcrVerificationRecord,
  state: GovernedDraftState,
  columnCount: number,
) {
  return {
    avgConfidence: record.avg_confidence ?? null,
    columns: columnCount,
    docTypeHint: record.doc_type_hint ?? "table",
    documentHash: record.document_hash ?? null,
    headers: state.headers,
    language: state.language,
    originalRows: record.original_rows ?? state.rows,
    rawColumnAdded: record.raw_column_added ?? false,
    rawText: record.raw_text ?? null,
    reviewedRows: state.rows,
    reviewerNotes: state.reviewerNotes,
    routingMeta: record.routing_meta ?? null,
    sourceFilename: record.source_filename ?? null,
    templateId: state.selectedTemplateId ? Number(state.selectedTemplateId) : record.template_id ?? null,
    warnings: record.warnings ?? [],
  };
}

export function getSourceCellValue(record: OcrVerificationRecord | null, rowIndex: number, columnIndex: number) {
  return stringifyOcrCell(record?.original_rows?.[rowIndex]?.[columnIndex] ?? "");
}
