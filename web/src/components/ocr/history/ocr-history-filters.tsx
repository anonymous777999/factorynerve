"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { OcrVerifyQueueFilters } from "@/lib/query-keys";

interface OcrHistoryFiltersProps {
  filters: OcrVerifyQueueFilters;
  statusFilter: OcrVerifyQueueFilters["status"];
  setStatusFilter: (val: OcrVerifyQueueFilters["status"]) => void;
  exportStateFilter: string;
  setExportStateFilter: (val: string) => void;
  documentTypeFilter: string;
  setDocumentTypeFilter: (val: string) => void;
  documentTypeOptions: string[];
  reviewerIdFilter: number | null;
  setReviewerIdFilter: (val: number | null) => void;
  reviewerOptions: [number, string][];
  confidenceFilter: string;
  setConfidenceFilter: (val: string) => void;
  updatedAfterFilter: string;
  setUpdatedAfterFilter: (val: string) => void;
  updatedBeforeFilter: string;
  setUpdatedBeforeFilter: (val: string) => void;
  onReset: () => void;
}

export const OcrHistoryFilters = memo(function OcrHistoryFilters({
  statusFilter,
  setStatusFilter,
  exportStateFilter,
  setExportStateFilter,
  documentTypeFilter,
  setDocumentTypeFilter,
  documentTypeOptions,
  reviewerIdFilter,
  setReviewerIdFilter,
  reviewerOptions,
  confidenceFilter,
  setConfidenceFilter,
  updatedAfterFilter,
  setUpdatedAfterFilter,
  updatedBeforeFilter,
  setUpdatedBeforeFilter,
  onReset,
}: OcrHistoryFiltersProps) {
  return (
    <div className="rounded-[0.45rem] border border-border-subtle bg-surface-shell p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2 text-sm text-text-secondary">
          <span className="text-text-primary">Status</span>
          <select
            className="input w-full"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as OcrVerifyQueueFilters["status"])}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="draft">Draft</option>
          </select>
        </label>

        <label className="space-y-2 text-sm text-text-secondary">
          <span className="text-text-primary">Export</span>
          <select
            className="input w-full"
            value={exportStateFilter}
            onChange={(event) => setExportStateFilter(event.target.value)}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="exported">Exported</option>
            <option value="failed">Failed</option>
            <option value="json_generated">JSON</option>
          </select>
        </label>

        <label className="space-y-2 text-sm text-text-secondary">
          <span className="text-text-primary">Document type</span>
          <select
            className="input w-full"
            value={documentTypeFilter}
            onChange={(event) => setDocumentTypeFilter(event.target.value)}
          >
            {documentTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type === "all" ? "All" : type}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm text-text-secondary">
          <span className="text-text-primary">Reviewer</span>
          <select
            className="input w-full"
            value={reviewerIdFilter ?? "all"}
            onChange={(event) =>
              setReviewerIdFilter(event.target.value === "all" ? null : Number(event.target.value))
            }
          >
            <option value="all">All</option>
            {reviewerOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2 text-sm text-text-secondary">
          <span className="text-text-primary">Confidence</span>
          <select
            className="input w-full"
            value={confidenceFilter}
            onChange={(event) => setConfidenceFilter(event.target.value)}
          >
            <option value="all">All</option>
            <option value="high">High (85%+)</option>
            <option value="medium">Medium (60–84%)</option>
            <option value="low">Low (&lt;60%)</option>
          </select>
        </label>
        <label className="space-y-2 text-sm text-text-secondary">
          <span className="text-text-primary">Updated after</span>
          <input
            className="input w-full"
            type="date"
            value={updatedAfterFilter}
            onChange={(event) => setUpdatedAfterFilter(event.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm text-text-secondary">
          <span className="text-text-primary">Updated before</span>
          <input
            className="input w-full"
            type="date"
            value={updatedBeforeFilter}
            onChange={(event) => setUpdatedBeforeFilter(event.target.value)}
          />
        </label>
        <div className="flex items-end">
          <Button
            size="compact"
            variant="outline"
            className="w-full"
            onClick={onReset}
          >
            Reset filters
          </Button>
        </div>
      </div>
    </div>
  );
});
