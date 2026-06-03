"use client";

import Link from "next/link";
import { useMemo, useState, useCallback } from "react";

import { OcrNotificationDropdown } from "@/components/ocr/ocr-notification-dropdown";
import { AiDisclosureBanner } from "@/shared/ai";
import { FilterBar } from "@/components/ui/filter-bar";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { OperationalPageShell } from "@/components/ui/operational-page-shell";
import { PageMain } from "@/components/ui/page-main";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import {
  createDataTableColumnHelper,
  type DataTableColumnDef,
} from "@/components/ui/data-table/data-table-types";
import { DataTableToolbar } from "@/components/ui/data-table/data-table-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfidenceMeter } from "@/shared/ai";
import { useDebouncedValue } from "@/hooks/use-interaction-timing";
import { useOcrHistoryQuery, useOcrVerifyDetailQuery } from "@/hooks/use-ocr-verify-queries";
import { canUseOcrScan } from "@/lib/ocr-access";
import { type OcrVerifyQueueFilters } from "@/lib/query-keys";
import {
  downloadOcrVerificationExport,
  type OcrHistoryItem,
} from "@/lib/ocr";
import { transferBlob } from "@/lib/blob-transfer";
import { useSession } from "@/lib/use-session";

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

const columnHelper = createDataTableColumnHelper<OcrHistoryItem>();

function getStatusBadgeStatus(status: OcrHistoryItem["status"]) {
  switch (status) {
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

export default function OcrHistoryPage() {
  const { user, loading, error: sessionError } = useSession();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: "success" | "error" | "info" }>>([]);
  const [statusFilter, setStatusFilter] = useState<OcrVerifyQueueFilters["status"]>("all");
  const [exportStateFilter, setExportStateFilter] = useState<"all" | "pending" | "exported" | "failed" | "json_generated">("all");
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>("all");
  const [reviewerIdFilter, setReviewerIdFilter] = useState<number | null>(null);
  const [confidenceFilter, setConfidenceFilter] = useState<"all" | "low" | "medium" | "high">("all");
  const [updatedAfterFilter, setUpdatedAfterFilter] = useState("");
  const [updatedBeforeFilter, setUpdatedBeforeFilter] = useState("");
  const canAccess = canUseOcrScan(user?.role);

  const confidenceRange = useMemo(() => {
    switch (confidenceFilter) {
      case "low":
        return { minConfidence: 0, maxConfidence: 0.6 };
      case "medium":
        return { minConfidence: 0.6, maxConfidence: 0.85 };
      case "high":
        return { minConfidence: 0.85, maxConfidence: undefined };
      default:
        return { minConfidence: undefined, maxConfidence: undefined };
    }
  }, [confidenceFilter]);

  // Requirement 12.8: search drives a backend list query via the query key.
  // Debounce the value that feeds the query (300ms) so we issue one request per
  // pause instead of one per keystroke, while the input stays fully responsive.
  const debouncedSearch = useDebouncedValue(search, 300);

  const filters: OcrVerifyQueueFilters = {
    search: debouncedSearch,
    status: statusFilter,
    exportState: exportStateFilter,
    documentType: documentTypeFilter === "all" ? undefined : documentTypeFilter,
    reviewerId: reviewerIdFilter,
    minConfidence: confidenceRange.minConfidence ?? null,
    maxConfidence: confidenceRange.maxConfidence ?? null,
    updatedAfter: updatedAfterFilter || null,
    updatedBefore: updatedBeforeFilter || null,
  };

  const historyQuery = useOcrHistoryQuery(filters, Boolean(user) && canAccess);
  const records = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);

  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);

  const activeSelectedRecordId = useMemo(
    () => (records.some((record) => record.id === selectedRecordId) ? selectedRecordId : records[0]?.id ?? null),
    [records, selectedRecordId],
  );

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === activeSelectedRecordId) || records[0] || null,
    [records, activeSelectedRecordId],
  );

  // Fetch full details (including audit_events) only for the selected record
  const detailQuery = useOcrVerifyDetailQuery(activeSelectedRecordId, Boolean(user) && canAccess);
  const selectedRecordDetail = detailQuery.data ?? null;
  const selectedEvents = selectedRecordDetail?.audit_events ?? [];

  const summary = useMemo(() => {
    const approved = records.filter((record) => record.status === "approved").length;
    const pending = records.filter((record) => record.status === "pending").length;
    const rejected = records.filter((record) => record.status === "rejected").length;
    const latest = records[0]?.updated_at ? formatTimestamp(records[0].updated_at) : "No activity";
    return { approved, pending, rejected, latest };
  }, [records]);

  const documentTypeOptions = useMemo(
    () => [
      "all",
      ...Array.from(
        new Set(
          records
            .map((record) => record.doc_type_hint?.trim().toLowerCase() || "table")
            .filter(Boolean),
        ),
      ).sort(),
    ],
    [records],
  );

  const reviewerOptions = useMemo(
    () =>
      Array.from(
        new Map(
          records
            .filter((record) => record.reviewed_by && record.reviewed_by_name)
            .map((record) => [record.reviewed_by as number, record.reviewed_by_name as string]),
        ).entries(),
      ).sort((a, b) => a[1].localeCompare(b[1])),
    [records],
  );

  const auditTriage = useMemo(() => {
    const lowConfidence = records.filter((record) => record.avg_confidence < 0.6).length;
    const exportFailures = records.filter((record) => record.export_state === "failed").length;
    return { lowConfidence, exportFailures };
  }, [records]);

  const handleDownload = useCallback(async (recordId: number) => {
    setBusyId(recordId);
    try {
      const download = await downloadOcrVerificationExport(recordId);
      const result = await transferBlob(download.blob, download.filename);
      const message = result === "shared"
        ? `Shared export for document #${recordId}.`
        : `Downloaded export for document #${recordId}.`;
      setNotifications((prev) => [...prev, { id: Date.now().toString(), message, type: "success" }]);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Could not download OCR export.";
      setNotifications((prev) => [...prev, { id: Date.now().toString(), message, type: "error" }]);
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleDismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAllFilters = useCallback(() => {
    setStatusFilter("all");
    setExportStateFilter("all");
    setDocumentTypeFilter("all");
    setReviewerIdFilter(null);
    setConfidenceFilter("all");
    setUpdatedAfterFilter("");
    setUpdatedBeforeFilter("");
  }, []);

  const historyMetrics = useMemo(
    () => [
      { id: "total", label: "Documents tracked", value: records.length },
      { id: "approved", label: "Approved", value: summary.approved },
      { id: "pending", label: "Pending review", value: summary.pending },
      { id: "rejected", label: "Rejected", value: summary.rejected },
    ],
    [records.length, summary.approved, summary.pending, summary.rejected],
  );

  const historyFilterBar = useMemo(
    () => (
      <FilterBar
        title="History filters"
        resultCount={`${records.length} records`}
        fields={[
          {
            id: "status",
            label: "Status",
            type: "select" as const,
            value: statusFilter === "all" ? "" : statusFilter,
            options: [
              { label: "Pending", value: "pending" },
              { label: "Approved", value: "approved" },
              { label: "Rejected", value: "rejected" },
              { label: "Draft", value: "draft" },
            ],
            onValueChange: (value) =>
              setStatusFilter((value || "all") as OcrVerifyQueueFilters["status"]),
          },
          {
            id: "export",
            label: "Export",
            type: "select" as const,
            value: exportStateFilter === "all" ? "" : exportStateFilter,
            options: [
              { label: "Pending", value: "pending" },
              { label: "Exported", value: "exported" },
              { label: "Failed", value: "failed" },
              { label: "JSON", value: "json_generated" },
            ],
            onValueChange: (value) => setExportStateFilter((value || "all") as typeof exportStateFilter),
          },
          {
            id: "document-type",
            label: "Document type",
            type: "select" as const,
            value: documentTypeFilter === "all" ? "" : documentTypeFilter,
            options: documentTypeOptions
              .filter((type) => type !== "all")
              .map((type) => ({ label: type, value: type })),
            onValueChange: (value) => setDocumentTypeFilter(value || "all"),
          },
          {
            id: "reviewer",
            label: "Reviewer",
            type: "select" as const,
            value: reviewerIdFilter == null ? "" : String(reviewerIdFilter),
            options: reviewerOptions.map(([id, name]) => ({
              label: name,
              value: String(id),
            })),
            onValueChange: (value) =>
              setReviewerIdFilter(value ? Number(value) : null),
          },
          {
            id: "confidence",
            label: "Confidence",
            type: "select" as const,
            value: confidenceFilter === "all" ? "" : confidenceFilter,
            options: [
              { label: "High (85%+)", value: "high" },
              { label: "Medium (60–84%)", value: "medium" },
              { label: "Low (<60%)", value: "low" },
            ],
            onValueChange: (value) =>
              setConfidenceFilter((value || "all") as typeof confidenceFilter),
          },
          {
            id: "updated-after",
            label: "Updated after",
            type: "date" as const,
            value: updatedAfterFilter,
            onValueChange: setUpdatedAfterFilter,
          },
          {
            id: "updated-before",
            label: "Updated before",
            type: "date" as const,
            value: updatedBeforeFilter,
            onValueChange: setUpdatedBeforeFilter,
          },
        ]}
        onClearAll={clearAllFilters}
        activeFilters={[
          ...(statusFilter !== "all"
            ? [{ id: "status", label: "Status", value: statusFilter, onClear: () => setStatusFilter("all") }]
            : []),
          ...(exportStateFilter !== "all"
            ? [
                {
                  id: "export",
                  label: "Export",
                  value: exportStateFilter,
                  onClear: () => setExportStateFilter("all"),
                },
              ]
            : []),
          ...(documentTypeFilter !== "all"
            ? [
                {
                  id: "doc-type",
                  label: "Type",
                  value: documentTypeFilter,
                  onClear: () => setDocumentTypeFilter("all"),
                },
              ]
            : []),
          ...(reviewerIdFilter != null
            ? [
                {
                  id: "reviewer",
                  label: "Reviewer",
                  value: String(reviewerIdFilter),
                  onClear: () => setReviewerIdFilter(null),
                },
              ]
            : []),
          ...(confidenceFilter !== "all"
            ? [
                {
                  id: "confidence",
                  label: "Confidence",
                  value: confidenceFilter,
                  onClear: () => setConfidenceFilter("all"),
                },
              ]
            : []),
          ...(updatedAfterFilter
            ? [
                {
                  id: "after",
                  label: "After",
                  value: updatedAfterFilter,
                  onClear: () => setUpdatedAfterFilter(""),
                },
              ]
            : []),
          ...(updatedBeforeFilter
            ? [
                {
                  id: "before",
                  label: "Before",
                  value: updatedBeforeFilter,
                  onClear: () => setUpdatedBeforeFilter(""),
                },
              ]
            : []),
        ]}
        actions={
          <Button variant="outline" size="compact" onClick={() => void historyQuery.refetch()}>
            Refresh
          </Button>
        }
      />
    ),
    [
      clearAllFilters,
      confidenceFilter,
      documentTypeFilter,
      documentTypeOptions,
      exportStateFilter,
      historyQuery,
      records.length,
      reviewerIdFilter,
      reviewerOptions,
      statusFilter,
      updatedAfterFilter,
      updatedBeforeFilter,
    ],
  );

  const historyRail = useMemo(
    () => (
      <div className="space-y-md">
        <div className="flex justify-end">
          <OcrNotificationDropdown
            notifications={notifications}
            onDismiss={handleDismissNotification}
          />
        </div>
        <div className="rounded-panel border border-border-subtle bg-surface-shell p-md">
          <p className="text-label-dense font-semibold uppercase tracking-wide text-text-secondary">
            Audit workspace
          </p>
          <div className="mt-sm grid gap-sm sm:grid-cols-2">
            <div className="rounded-overlay border border-border-subtle bg-surface-card px-md py-sm">
              <p className="text-label-dense text-text-secondary">Records tracked</p>
              <p className="mt-xs text-title font-semibold tabular-nums text-text-primary">{records.length}</p>
            </div>
            <div className="rounded-overlay border border-border-subtle bg-surface-card px-md py-sm">
              <p className="text-label-dense text-text-secondary">Low confidence</p>
              <p className="mt-xs text-title font-semibold tabular-nums text-text-primary">
                {auditTriage.lowConfidence}
              </p>
            </div>
            <div className="rounded-overlay border border-border-subtle bg-surface-card px-md py-sm">
              <p className="text-label-dense text-text-secondary">Export failures</p>
              <p className="mt-xs text-title font-semibold tabular-nums text-text-primary">
                {auditTriage.exportFailures}
              </p>
            </div>
            <div className="rounded-overlay border border-border-subtle bg-surface-card px-md py-sm">
              <p className="text-label-dense text-text-secondary">Latest update</p>
              <p className="mt-xs text-body font-medium text-text-primary">{summary.latest}</p>
            </div>
          </div>
        </div>

        <div className="rounded-panel border border-border-subtle bg-surface-shell p-md">
          <p className="text-label-dense font-semibold uppercase tracking-wide text-text-secondary">
            Selected record
          </p>
          <div className="mt-sm space-y-sm text-body text-text-secondary">
            {selectedRecord ? (
              <>
                <div>
                  <p className="font-medium text-text-primary">
                    {selectedRecord.source_filename || `Document #${selectedRecord.id}`}
                  </p>
                  <p className="mt-xs text-label-dense text-text-tertiary">
                    Type: {selectedRecord.doc_type_hint || "table"} · Status: {selectedRecord.status}
                  </p>
                </div>
                <ConfidenceMeter
                  value={selectedRecord.avg_confidence || 0}
                  showLabel
                />
                {selectedRecord.reviewed_by_name ? (
                  <p className="text-label-dense text-text-tertiary">
                    Reviewed by {selectedRecord.reviewed_by_name}
                  </p>
                ) : null}
                {selectedEvents.length > 0 ? (
                  <div className="space-y-xs">
                    {selectedEvents.slice(0, 6).map((event) => (
                      <div
                        key={event.id}
                        className="rounded-overlay border border-border-subtle bg-surface-card px-sm py-sm text-label-dense"
                      >
                        <p className="font-medium text-text-primary">{event.event_type}</p>
                        <p>{event.actor || "System"}</p>
                        <p className="text-text-tertiary">{formatTimestamp(event.created_at)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-tertiary">No audit events for this record yet.</p>
                )}
              </>
            ) : (
              <p className="text-text-tertiary">Select a row to inspect audit detail.</p>
            )}
          </div>
        </div>
      </div>
    ),
    [
      auditTriage.exportFailures,
      auditTriage.lowConfidence,
      handleDismissNotification,
      notifications,
      records.length,
      selectedEvents,
      selectedRecord,
      summary.latest,
    ],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor((record) => record.source_filename || `Document #${record.id}`, {
        id: "document",
        header: "Document",
        cell: (info) => {
          const record = info.row.original;
          const statusColor =
            record.status === "approved"
              ? "var(--status-success-icon)"
              : record.status === "pending"
                ? "var(--status-warning-icon)"
                : record.status === "rejected"
                  ? "var(--status-danger-icon)"
                  : "var(--border-subtle)";
          return (
            <div className="flex min-w-0 items-stretch gap-3">
              <span
                aria-hidden="true"
                className="-my-1 w-0.5 rounded-full"
                style={{ background: statusColor }}
              />
              <div className="min-w-0">
                <div className="truncate text-body font-medium text-text-primary">
                  {info.getValue()}
                </div>
                <div className="mt-xs text-label-dense tabular-nums text-text-secondary">
                  {Math.round((record.avg_confidence || 0) * 100)}% confidence
                </div>
              </div>
            </div>
          );
        },
        meta: {
          isRowHeader: true,
          sticky: "left",
        },
      }),
      columnHelper.accessor("doc_type_hint", {
        id: "type",
        header: "Type",
        cell: (info) => info.getValue() || "table",
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => (
          <div className="flex justify-center">
            <Badge status={getStatusBadgeStatus(info.getValue())}>{info.getValue()}</Badge>
          </div>
        ),
        meta: {
          align: "center",
        },
      }),
      columnHelper.accessor("updated_at", {
        id: "updated",
        header: "Updated",
        cell: (info) => formatTimestamp(info.getValue()),
      }),
      columnHelper.display({
        id: "actions",
        header: "Action",
        cell: (info) => {
          const record = info.row.original;

          return (
            <div className="flex justify-end gap-sm">
              <Link href={`/ocr/verify?id=${record.id}&step=${record.status === "pending" || record.status === "approved" ? 4 : 3}&pane=workspace`}>
                <Button size="compact" variant="outline">
                  Open
                </Button>
              </Link>
              <Button
                size="compact"
                variant="outline"
                disabled={busyId === record.id}
                onClick={() => void handleDownload(record.id)}
              >
                {busyId === record.id ? "Downloading" : "Excel"}
              </Button>
            </div>
          );
        },
        meta: {
          align: "right",
        },
      }),
    ] as DataTableColumnDef<OcrHistoryItem>[],
    [busyId, handleDownload],
  );

  if (loading) {
    return (
      <OperationalPageShell
        eyebrow="Document"
        title="OCR history"
        description="Loading verification records..."
        isLoading
        loadingTitle="Loading OCR history"
      >
        <div />
      </OperationalPageShell>
    );
  }

  if (!user) {
    return (
      <PageMain maxWidth="3xl" innerClassName="flex min-h-[50vh] items-center justify-center px-md">
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
      </PageMain>
    );
  }

  if (!canAccess) {
    return (
      <PageMain maxWidth="3xl" innerClassName="flex min-h-[50vh] items-center justify-center px-md">
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
      </PageMain>
    );
  }

  return (
    <OperationalPageShell
      eyebrow="Document"
      title="OCR history"
      description="Reopen past runs, check their status, and download the latest export."
      tone="synced"
      toneLabel="Audit trail"
      metrics={historyMetrics}
      filters={historyFilterBar}
      rail={historyRail}
      actions={[
        {
          id: "scan",
          label: "New scan",
          variant: "outline",
          onAction: () => {
            window.location.href = "/ocr/scan";
          },
        },
      ]}
    >
      <AiDisclosureBanner
        source="AI-extracted OCR data"
        lowConfidenceCount={auditTriage.lowConfidence}
        totalCount={records.length}
        reviewHref="/ocr/verify"
      />

      <LoadingBoundary
        isLoading={historyQuery.isLoading}
        hasData={records.length > 0}
        isEmpty={!historyQuery.isLoading && records.length === 0}
        isError={historyQuery.isError}
        error={historyQuery.error instanceof Error ? historyQuery.error : null}
        loadingTitle="Loading OCR history"
        loadingRows={8}
        emptyTitle="No OCR records found"
        emptyMessage="Adjust filters or start a new scan to populate history."
        onRetry={() => void historyQuery.refetch()}
      >
        <div
          className="mt-md flex flex-col overflow-hidden rounded-panel border border-border-subtle bg-surface-shell"
          style={{ height: "calc(100vh - 28rem)", minHeight: "400px" }}
        >
          <DataTable<OcrHistoryItem>
            ariaLabel="OCR history"
            columns={columns}
            data={records}
            getRowId={(row) => String(row.id)}
            selectedRowId={activeSelectedRecordId ? String(activeSelectedRecordId) : null}
            onRowClick={(row) => setSelectedRecordId(Number(row.id))}
            enableGlobalSearch
            enableStickyFirstColumn
            enableVirtualization={records.length > 20}
            overscan={5}
            className="flex min-h-0 flex-1 flex-col"
            scrollAreaClassName="flex-1 min-h-0"
            viewportClassName="!max-h-none h-full overflow-y-auto"
            emptyTitle="No OCR documents match the current filters"
            emptyMessage="Adjust the search term or scan a new document to continue the workflow."
            renderToolbar={
              <DataTableToolbar
                searchPlaceholder="Search by file, type, status, or export"
                searchValue={search}
                onSearchChange={setSearch}
                onClear={() => setSearch("")}
              />
            }
            searchValue={search}
            onSearchChange={setSearch}
          />
        </div>
      </LoadingBoundary>
    </OperationalPageShell>
  );
}
