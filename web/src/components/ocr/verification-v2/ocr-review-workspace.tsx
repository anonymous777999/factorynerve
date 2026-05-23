import type { RefObject } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecoveryBanner } from "@/components/ui/recovery-banner";
import { OcrReviewTable } from "@/components/ocr/ocr-review-table";
import { type OcrVerificationRecord } from "@/lib/ocr";

import { OcrReviewCompactForm } from "./ocr-review-compact-form";
import { OcrReviewPreviewPane } from "./ocr-review-preview-pane";

type OcrReviewWorkspaceProps = {
  activeRecord: OcrVerificationRecord;
  detailFetching: boolean;
  imageUrl: string;
  headers: string[];
  rows: string[][];
  reviewSignals: string[];
  reviewerNotes: string;
  rejectionReason: string;
  onHeaderChange: (columnIndex: number, value: string) => void;
  onCellChange: (rowIndex: number, columnIndex: number, value: string) => void;
  onReviewerNotesChange: (value: string) => void;
  onRejectionReasonChange: (value: string) => void;
  onFocusTable?: () => void;
  previewRef?: RefObject<HTMLDivElement | null>;
  notesRef?: RefObject<HTMLTextAreaElement | null>;
  tableRef?: RefObject<HTMLDivElement | null>;
};

export function OcrReviewWorkspace({
  activeRecord,
  detailFetching,
  imageUrl,
  headers,
  rows,
  reviewSignals,
  reviewerNotes,
  rejectionReason,
  onHeaderChange,
  onCellChange,
  onReviewerNotesChange,
  onRejectionReasonChange,
  onFocusTable,
  previewRef,
  notesRef,
  tableRef,
}: OcrReviewWorkspaceProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]">
      <OcrReviewPreviewPane
        activeRecord={activeRecord}
        imageUrl={imageUrl}
        reviewSignals={reviewSignals}
        isRefreshing={detailFetching}
        onFocusTable={onFocusTable}
        previewRef={previewRef}
      />

      <div className="space-y-4">
        {reviewSignals.length ? (
          <RecoveryBanner
            kind="offline"
            statusLabel="Review required"
            title={`${reviewSignals.length} OCR signal${reviewSignals.length === 1 ? "" : "s"} need attention`}
            description={reviewSignals.slice(0, 3).join(" ")}
            meta="Arrows move in grid. Save before submit."
          />
        ) : (
          <RecoveryBanner
            kind="reconnecting"
            statusLabel="Review clear"
            title="No OCR issues flagged"
            description="Review remaining edge cases."
          />
        )}

        <Card>
          <CardHeader className="px-md pt-md">
            <div className="flex flex-wrap items-center justify-between gap-sm">
              <div>
                <CardTitle className="text-lg">Compact verification form</CardTitle>
                <div className="mt-xs text-label-dense text-text-secondary">
                  Notes, rejection, and grid in one lane.
                </div>
              </div>
              <div className="text-label-dense text-text-secondary">Alt+1 queue | Alt+2 preview | Alt+3 grid</div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-md pb-md">
            <OcrReviewCompactForm
              activeRecord={activeRecord}
              reviewerNotes={reviewerNotes}
              rejectionReason={rejectionReason}
              onReviewerNotesChange={onReviewerNotesChange}
              onRejectionReasonChange={onRejectionReasonChange}
              notesRef={notesRef}
            />

            <div
              ref={tableRef}
              tabIndex={-1}
              className="rounded-panel outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <OcrReviewTable
                headers={headers}
                rows={rows}
                onHeaderChange={onHeaderChange}
                onCellChange={onCellChange}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
