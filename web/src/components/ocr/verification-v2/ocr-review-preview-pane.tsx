import type { RefObject } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { type OcrVerificationRecord } from "@/lib/ocr";

type OcrReviewPreviewPaneProps = {
  activeRecord: OcrVerificationRecord;
  imageUrl: string;
  reviewSignals: string[];
  isRefreshing: boolean;
  onFocusTable?: () => void;
  previewRef?: RefObject<HTMLDivElement | null>;
};

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

function getRecordStatusLabel(record: OcrVerificationRecord | null) {
  if (!record) {
    return "Draft";
  }

  switch (record.status) {
    case "approved":
      return "Approved";
    case "pending":
      return "Pending approval";
    case "rejected":
      return "Rejected";
    default:
      return "Draft";
  }
}

function getRecordStatusTone(record: OcrVerificationRecord | null) {
  if (!record) {
    return "draft" as const;
  }

  switch (record.status) {
    case "approved":
      return "synced" as const;
    case "pending":
      return "processing" as const;
    case "rejected":
      return "error" as const;
    default:
      return "draft" as const;
  }
}

export function OcrReviewPreviewPane({
  activeRecord,
  imageUrl,
  reviewSignals,
  isRefreshing,
  onFocusTable,
  previewRef,
}: OcrReviewPreviewPaneProps) {
  return (
    <div
      ref={previewRef}
      tabIndex={0}
      className="space-y-4 rounded-overlay outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
    >
      <Card className="xl:sticky xl:top-lg">
        <CardHeader className="px-md pt-md">
          <div className="flex items-start justify-between gap-sm">
            <div className="min-w-0 space-y-xs">
              <div className="flex flex-wrap items-center gap-sm">
                <Badge status={getRecordStatusTone(activeRecord)}>
                  {getRecordStatusLabel(activeRecord)}
                </Badge>
                {isRefreshing ? (
                  <span className="text-label-dense text-text-secondary">Refreshing draft...</span>
                ) : null}
              </div>
              <CardTitle className="text-lg">
                {activeRecord.source_filename || `Draft #${activeRecord.id}`}
              </CardTitle>
              <div className="text-label-dense text-text-secondary">
                Sticky visual reference for keyboard-led verification.
              </div>
            </div>
            <button
              type="button"
              onClick={onFocusTable}
              className="rounded-control border border-border-default bg-surface-shell px-sm py-xs text-label-dense text-text-secondary transition-colors duration-fast ease-standard hover:border-border-strong hover:bg-surface-hover hover:text-text-primary"
            >
              Focus table
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-md pb-md">
          <div className="grid gap-sm sm:grid-cols-3">
            <div className="rounded-panel border border-border-subtle bg-surface-shell px-sm py-sm">
              <div className="text-label-dense uppercase tracking-wide text-text-tertiary">Updated</div>
              <div className="mt-xs font-mono text-label text-text-primary">
                {formatTimestamp(activeRecord.updated_at)}
              </div>
            </div>
            <div className="rounded-panel border border-border-subtle bg-surface-shell px-sm py-sm">
              <div className="text-label-dense uppercase tracking-wide text-text-tertiary">Warnings</div>
              <div className="mt-xs font-mono text-label text-text-primary">{reviewSignals.length}</div>
            </div>
            <div className="rounded-panel border border-border-subtle bg-surface-shell px-sm py-sm">
              <div className="text-label-dense uppercase tracking-wide text-text-tertiary">Language</div>
              <div className="mt-xs font-mono text-label text-text-primary">
                {activeRecord.language || "-"}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-panel border border-border-default bg-surface-shell">
            {imageUrl ? (
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-surface-panel">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={activeRecord.source_filename || `OCR source ${activeRecord.id}`}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              </div>
            ) : (
              <EmptyState
                className="rounded-none border-0 bg-transparent shadow-none"
                title="Source preview unavailable"
                description="The reviewed draft does not expose a source image, so continue with the extracted table and reviewer notes."
                status="warning"
                statusLabel="No preview"
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
