"use client";

import { memo } from "react";
import { OcrVerificationSummary } from "@/lib/ocr";

interface OcrHistorySummaryStatsProps {
  summary: OcrVerificationSummary | undefined;
  isLoading: boolean;
}

export const OcrHistorySummaryStats = memo(function OcrHistorySummaryStats({
  summary,
  isLoading,
}: OcrHistorySummaryStatsProps) {
  if (isLoading && !summary) {
    return (
      <div className="factory-ocr-panel-grid factory-ocr-panel-grid--four">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="factory-ocr-data-card animate-pulse">
            <div className="h-4 w-24 bg-surface-shell rounded mb-2"></div>
            <div className="h-8 w-12 bg-surface-shell rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="factory-ocr-panel-grid factory-ocr-panel-grid--four">
      <div className="factory-ocr-data-card">
        <div className="factory-ocr-data-card__label">Documents tracked</div>
        <div className="factory-ocr-data-card__value">{summary?.total_documents ?? 0}</div>
      </div>
      <div className="factory-ocr-data-card">
        <div className="factory-ocr-data-card__label">Approved</div>
        <div className="factory-ocr-data-card__value">{summary?.trusted_documents ?? 0}</div>
      </div>
      <div className="factory-ocr-data-card">
        <div className="factory-ocr-data-card__label">Pending review</div>
        <div className="factory-ocr-data-card__value">{summary?.pending_documents ?? 0}</div>
      </div>
      <div className="factory-ocr-data-card">
        <div className="factory-ocr-data-card__label">Rejected</div>
        <div className="factory-ocr-data-card__value">{summary?.rejected_documents ?? 0}</div>
      </div>
    </div>
  );
});
