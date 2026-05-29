"use client";

import { memo } from "react";
import { OcrVerificationRecord } from "@/lib/ocr";

interface OcrHistorySidePanelProps {
  selectedRecord: OcrVerificationRecord | null;
  totalTracked: number;
  latestUpdate: string;
}

function formatTimestamp(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const OcrHistorySidePanel = memo(function OcrHistorySidePanel({
  selectedRecord,
  totalTracked,
  latestUpdate,
}: OcrHistorySidePanelProps) {
  const selectedEvents = selectedRecord?.audit_events ?? [];

  return (
    <div className="space-y-4">
      <div className="factory-ocr-console factory-ocr-console--subtle rounded-[0.45rem] p-4">
        <div className="factory-ocr-card-title">Audit workspace</div>
        <div className="mt-3 factory-ocr-panel-grid">
          <div className="factory-ocr-data-card">
            <div className="factory-ocr-data-card__label">Records tracked</div>
            <div className="factory-ocr-data-card__value">{totalTracked}</div>
          </div>
          <div className="factory-ocr-data-card">
            <div className="factory-ocr-data-card__label">Latest update</div>
            <div className="factory-ocr-data-card__value">{latestUpdate}</div>
          </div>
        </div>
      </div>

      <div className="factory-ocr-console factory-ocr-console--subtle rounded-[0.45rem] p-4">
        <div className="factory-ocr-card-title">Selected record</div>
        <div className="mt-3 space-y-2 text-sm leading-6 text-text-secondary">
          {selectedRecord ? (
            <>
              <div className="font-medium text-text-primary">
                {selectedRecord.source_filename || `Document #${selectedRecord.id}`}
              </div>
              <div>Status: {selectedRecord.status}</div>
              <div>Type: {selectedRecord.doc_type_hint || "table"}</div>
              <div>Confidence: {Math.round(selectedRecord.avg_confidence ?? 0)}%</div>
              {selectedRecord.reviewed_by_name ? (
                <div>Reviewed by: {selectedRecord.reviewed_by_name}</div>
              ) : null}
            </>
          ) : (
            <div className="italic">No record selected</div>
          )}
        </div>
      </div>

      <div className="factory-ocr-console factory-ocr-console--subtle rounded-[0.45rem] p-4">
        <div className="factory-ocr-card-title">Review lineage</div>
        <div className="mt-3 space-y-3 text-sm leading-6 text-text-secondary">
          {selectedEvents.length > 0 ? (
            selectedEvents.slice(0, 6).map((event) => (
              <div
                key={event.id}
                className="rounded-[0.35rem] border border-border-subtle bg-surface-shell px-3 py-3"
              >
                <div className="font-medium text-text-primary">{event.event_type}</div>
                <div>{event.actor || "System"}</div>
                <div>{formatTimestamp(event.created_at)}</div>
              </div>
            ))
          ) : (
            <div className="rounded-[0.35rem] border border-border-subtle bg-surface-shell px-3 py-3">
              {selectedRecord
                ? "No audit events are available for the selected record."
                : "Select a record to see its audit lineage."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
