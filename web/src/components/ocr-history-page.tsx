"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { ErrorBanner } from "@/components/ocr/error-banner";
import { OcrShell } from "@/components/ocr/ocr-shell";
import { Button } from "@/components/ui/button";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import {
  useOcrHistoryInfiniteQuery,
  useOcrVerificationSummaryQuery,
  useOcrVerifyDetailQuery,
} from "@/hooks/use-ocr-verify-queries";
import { canUseOcrScan } from "@/lib/ocr-access";
import { type OcrVerifyQueueFilters } from "@/lib/query-keys";
import {
  downloadOcrVerificationExport,
} from "@/lib/ocr";
import { transferBlob } from "@/lib/blob-transfer";
import { useSession } from "@/lib/use-session";

// New Components
import { VirtualizedOcrHistoryTable } from "@/components/ocr/history/virtualized-ocr-history-table";
import { OcrHistoryFilters } from "@/components/ocr/history/ocr-history-filters";
import { OcrHistorySummaryStats } from "@/components/ocr/history/ocr-history-summary-stats";
import { OcrHistorySidePanel } from "@/components/ocr/history/ocr-history-side-panel";
import { EmptyState } from "@/components/ui/empty-state";

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

export default function OcrHistoryPage() {
  const { user, loading, error: sessionError } = useSession();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [localError, setLocalError] = useState("");

  // Filter States
  const [statusFilter, setStatusFilter] = useState<OcrVerifyQueueFilters["status"]>("all");
  const [exportStateFilter, setExportStateFilter] = useState<"all" | "pending" | "exported" | "failed" | "json_generated">("all");
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>("all");
  const [reviewerIdFilter, setReviewerIdFilter] = useState<number | null>(null);
  const [confidenceFilter, setConfidenceFilter] = useState<"all" | "low" | "medium" | "high">("all");
  const [updatedAfterFilter, setUpdatedAfterFilter] = useState("");
  const [updatedBeforeFilter, setUpdatedBeforeFilter] = useState("");

  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);

  const canAccess = canUseOcrScan(user?.role);
  const queryEnabled = Boolean(user) && canAccess;

  const confidenceRange = useMemo(() => {
    switch (confidenceFilter) {
      case "low":
        return { minConfidence: 0, maxConfidence: 60 };
      case "medium":
        return { minConfidence: 60, maxConfidence: 85 };
      case "high":
        return { minConfidence: 85, maxConfidence: undefined };
      default:
        return { minConfidence: undefined, maxConfidence: undefined };
    }
  }, [confidenceFilter]);

  const filters: OcrVerifyQueueFilters = useMemo(() => ({
    search,
    status: statusFilter,
    exportState: exportStateFilter,
    documentType: documentTypeFilter === "all" ? undefined : documentTypeFilter,
    reviewerId: reviewerIdFilter,
    minConfidence: confidenceRange.minConfidence ?? null,
    maxConfidence: confidenceRange.maxConfidence ?? null,
    updatedAfter: updatedAfterFilter || null,
    updatedBefore: updatedBeforeFilter || null,
  }), [search, statusFilter, exportStateFilter, documentTypeFilter, reviewerIdFilter, confidenceRange, updatedAfterFilter, updatedBeforeFilter]);

  // Infinite Query for the table
  const historyQuery = useOcrHistoryInfiniteQuery(filters, queryEnabled);

  // Summary query for the top stats
  const summaryQuery = useOcrVerificationSummaryQuery(queryEnabled);

  // Detail query for the selected record (Side Panel)
  const detailQuery = useOcrVerifyDetailQuery(selectedRecordId, queryEnabled);

  const allItems = useMemo(() =>
    historyQuery.data?.pages.flatMap(page => page.items) ?? [],
    [historyQuery.data]
  );

  const documentTypeOptions = useMemo(() => {
    // We only have options from the current loaded pages, but it's better than nothing
    // or we could have a dedicated endpoint if needed.
    const types = new Set<string>();
    allItems.forEach(item => {
      if (item.doc_type_hint) types.add(item.doc_type_hint.trim().toLowerCase());
    });
    return ["all", ...Array.from(types).sort()];
  }, [allItems]);

  const reviewerOptions = useMemo(() => {
    const reviewers = new Map<number, string>();
    allItems.forEach(item => {
      if (item.reviewed_by && item.reviewed_by_name) {
        reviewers.set(item.reviewed_by, item.reviewed_by_name);
      }
    });
    return Array.from(reviewers.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allItems]);

  const handleDownload = useCallback(async (recordId: number) => {
    setBusyId(recordId);
    setLocalError("");
    setStatusMessage("");
    try {
      const download = await downloadOcrVerificationExport(recordId);
      const result = await transferBlob(download.blob, download.filename);
      setStatusMessage(
        result === "shared"
          ? `Shared export for document #${recordId}.`
          : `Downloaded export for document #${recordId}.`,
      );
    } catch (reason) {
      setLocalError(reason instanceof Error ? reason.message : "Could not download OCR export.");
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleResetFilters = useCallback(() => {
    setStatusFilter("all");
    setExportStateFilter("all");
    setDocumentTypeFilter("all");
    setReviewerIdFilter(null);
    setConfidenceFilter("all");
    setUpdatedAfterFilter("");
    setUpdatedBeforeFilter("");
    setSearch("");
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-app text-label-dense text-text-secondary">
        Loading OCR history...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-md">
        <EmptyState
          className="w-full"
          title="OCR history requires sign-in"
          description={sessionError || "Open access to continue into the OCR workflow."}
          status="error"
          statusLabel="Access required"
          action={
            <Link href="/access">
              <Button>Open Access</Button>
            </Link>
          }
        />
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-md">
        <EmptyState
          className="w-full"
          title="OCR history is not available for this role"
          description="Return to the dashboard or open the OCR scan workflow if your role changes."
          status="warning"
          statusLabel="No access"
          action={
            <Link href="/dashboard">
              <Button>Back to Dashboard</Button>
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <OcrShell
      title="Recent OCR documents"
      subtitle="Reopen past runs, check their status, and download the latest export."
      step="result"
      sideContent={
        <OcrHistorySidePanel
          selectedRecord={detailQuery.data ?? null}
          totalTracked={summaryQuery.data?.total_documents ?? 0}
          latestUpdate={summaryQuery.data?.last_trusted_at ? formatTimestamp(summaryQuery.data.last_trusted_at) : "No activity"}
        />
      }
    >
      <div className="space-y-4">
        {statusMessage ? <ErrorBanner tone="success" message={statusMessage} /> : null}
        {localError ? (
          <ErrorBanner
            message={localError}
            actionLabel="Retry history"
            onAction={() => {
              setLocalError("");
              void historyQuery.refetch();
            }}
          />
        ) : null}

        <OcrHistorySummaryStats
          summary={summaryQuery.data}
          isLoading={summaryQuery.isLoading}
        />

        <div className="space-y-4">
          <div className="flex gap-3">
             <input
                className="input flex-1"
                placeholder="Search by file, type, status, or export"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button variant="outline" onClick={() => setSearch("")} disabled={!search}>Clear</Button>
          </div>

          <OcrHistoryFilters
            filters={filters}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            exportStateFilter={exportStateFilter}
            setExportStateFilter={setExportStateFilter}
            documentTypeFilter={documentTypeFilter}
            setDocumentTypeFilter={setDocumentTypeFilter}
            documentTypeOptions={documentTypeOptions}
            reviewerIdFilter={reviewerIdFilter}
            setReviewerIdFilter={setReviewerIdFilter}
            reviewerOptions={reviewerOptions}
            confidenceFilter={confidenceFilter}
            setConfidenceFilter={setConfidenceFilter}
            updatedAfterFilter={updatedAfterFilter}
            setUpdatedAfterFilter={setUpdatedAfterFilter}
            updatedBeforeFilter={updatedBeforeFilter}
            setUpdatedBeforeFilter={setUpdatedBeforeFilter}
            onReset={handleResetFilters}
          />
        </div>

        <LoadingBoundary
          hasData={allItems.length > 0}
          isLoading={historyQuery.isLoading}
          isError={historyQuery.isError}
          error={historyQuery.error}
          onRetry={() => void historyQuery.refetch()}
          emptyTitle="No OCR history yet"
          emptyMessage="Scanned and reviewed OCR documents will appear here automatically."
        >
          <div className="h-[calc(100vh-22rem)] min-h-112 overflow-hidden rounded-[0.45rem] border border-border-subtle bg-surface-shell">
            <VirtualizedOcrHistoryTable
              items={allItems}
              isLoading={historyQuery.isLoading}
              isFetchingNextPage={historyQuery.isFetchingNextPage}
              hasNextPage={!!historyQuery.hasNextPage}
              fetchNextPage={historyQuery.fetchNextPage}
              selectedId={selectedRecordId}
              onSelect={setSelectedRecordId}
              onDownload={handleDownload}
              busyId={busyId}
            />
          </div>
          {historyQuery.isFetchingNextPage && (
            <div className="py-2 text-center text-xs text-text-secondary animate-pulse">
              Loading more records...
            </div>
          )}
        </LoadingBoundary>
      </div>
    </OcrShell>
  );
}
