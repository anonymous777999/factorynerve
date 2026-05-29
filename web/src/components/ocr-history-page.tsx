"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { OcrShell } from "@/components/ocr/ocr-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import {
  createDataTableColumnHelper,
  type DataTableColumnDef,
} from "@/components/ui/data-table/data-table-types";
import { DataTableToolbar } from "@/components/ui/data-table/data-table-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { useOcrHistoryQuery } from "@/hooks/use-ocr-verify-queries";
import { canUseOcrScan } from "@/lib/ocr-access";
import { type OcrVerifyQueueFilters } from "@/lib/query-keys";
import {
  downloadOcrVerificationExport,
  type OcrVerificationRecord,
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

const columnHelper = createDataTableColumnHelper<OcrVerificationRecord>();

function getStatusBadgeStatus(status: OcrVerificationRecord["status"]) {
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
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const canAccess = canUseOcrScan(user?.role);

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

  const filters: OcrVerifyQueueFilters = {
    search,
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

  const activeSelectedRecordId = useMemo(
    () => (records.some((record) => record.id === selectedRecordId) ? selectedRecordId : records[0]?.id ?? null),
    [records, selectedRecordId],
  );

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === activeSelectedRecordId) || records[0] || null,
    [records, activeSelectedRecordId],
  );

  const auditTriage = useMemo(() => {
    const lowConfidence = records.filter((record) => record.avg_confidence < 60).length;
    const exportFailures = records.filter((record) => record.export_state === "failed").length;
    const reviewEvents = records.flatMap((record) => record.audit_events || []);
    const recentEvents = reviewEvents
      .sort((left, right) =>
        new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime(),
      )
      .slice(0, 5);
    return { lowConfidence, exportFailures, recentEvents };
  }, [records]);

  const selectedEvents = selectedRecord?.audit_events ?? [];

  const handleDownload = async (recordId: number) => {
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
  };

  const handleDismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor((record) => record.source_filename || `Document #${record.id}`, {
        id: "document",
        header: "Document",
        cell: (info) => {
          const record = info.row.original;
          return (
            <div className="min-w-0">
              <div className="truncate text-body font-medium text-text-primary">
                {info.getValue()}
              </div>
              <div className="mt-xs text-label-dense text-text-secondary">
                {Math.round(record.avg_confidence || 0)}% confidence
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
              <Link href={`/ocr/verify?verification_id=${record.id}`}>
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
    ] as DataTableColumnDef<OcrVerificationRecord>[],
    [busyId],
  );

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
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-md">
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
      notifications={notifications}
      onDismissNotification={handleDismissNotification}
      sideContent={
        <div className="space-y-4">
          <div className="factory-ocr-console factory-ocr-console--subtle rounded-[0.45rem] p-4">
            <div className="factory-ocr-card-title">Audit workspace</div>
            <div className="mt-3 factory-ocr-panel-grid">
              <div className="factory-ocr-data-card">
                <div className="factory-ocr-data-card__label">Records tracked</div>
                <div className="factory-ocr-data-card__value">{records.length}</div>
              </div>
              <div className="factory-ocr-data-card">
                <div className="factory-ocr-data-card__label">Low confidence</div>
                <div className="factory-ocr-data-card__value">{auditTriage.lowConfidence}</div>
              </div>
              <div className="factory-ocr-data-card">
                <div className="factory-ocr-data-card__label">Export failures</div>
                <div className="factory-ocr-data-card__value">{auditTriage.exportFailures}</div>
              </div>
              <div className="factory-ocr-data-card">
                <div className="factory-ocr-data-card__label">Latest update</div>
                <div className="factory-ocr-data-card__value">{summary.latest}</div>
              </div>
            </div>
          </div>

          <div className="factory-ocr-console factory-ocr-console--subtle rounded-[0.45rem] p-4">
            <div className="factory-ocr-card-title">Selected record</div>
            <div className="mt-3 space-y-2 text-sm leading-6 text-text-secondary">
              <div className="font-medium text-text-primary">{selectedRecord?.source_filename || `Document #${selectedRecord?.id}`}</div>
              <div>Status: {selectedRecord?.status || "—"}</div>
              <div>Type: {selectedRecord?.doc_type_hint || "table"}</div>
              <div>Confidence: {Math.round(selectedRecord?.avg_confidence ?? 0)}%</div>
              {selectedRecord?.reviewed_by_name ? <div>Reviewed by: {selectedRecord.reviewed_by_name}</div> : null}
            </div>
          </div>

          <div className="factory-ocr-console factory-ocr-console--subtle rounded-[0.45rem] p-4">
            <div className="factory-ocr-card-title">Review lineage</div>
            <div className="mt-3 space-y-3 text-sm leading-6 text-text-secondary">
              {selectedEvents.length > 0 ? (
                selectedEvents.slice(0, 6).map((event) => (
                  <div key={event.id} className="rounded-[0.35rem] border border-border-subtle bg-surface-shell px-3 py-3">
                    <div className="font-medium text-text-primary">{event.event_type}</div>
                    <div>{event.actor || "System"}</div>
                    <div>{formatTimestamp(event.created_at)}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-[0.35rem] border border-border-subtle bg-surface-shell px-3 py-3">
                  No audit events are available for the selected record.
                </div>
              )}
            </div>
          </div>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col space-y-4">
        <div className="factory-ocr-panel-grid factory-ocr-panel-grid--four flex-shrink-0">
          <div className="factory-ocr-data-card">
            <div className="factory-ocr-data-card__label">Documents tracked</div>
            <div className="factory-ocr-data-card__value">{records.length}</div>
          </div>
          <div className="factory-ocr-data-card">
            <div className="factory-ocr-data-card__label">Approved</div>
            <div className="factory-ocr-data-card__value">{summary.approved}</div>
          </div>
          <div className="factory-ocr-data-card">
            <div className="factory-ocr-data-card__label">Pending review</div>
            <div className="factory-ocr-data-card__value">{summary.pending}</div>
          </div>
          <div className="factory-ocr-data-card">
            <div className="factory-ocr-data-card__label">Rejected</div>
            <div className="factory-ocr-data-card__value">{summary.rejected}</div>
          </div>
        </div>

        <div className="flex-shrink-0 rounded-[0.45rem] border border-border-subtle bg-surface-shell p-4">
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
                onChange={(event) => setExportStateFilter(event.target.value as typeof exportStateFilter)}
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
                onChange={(event) => setConfidenceFilter(event.target.value as typeof confidenceFilter)}
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
                onClick={() => {
                  setStatusFilter("all");
                  setExportStateFilter("all");
                  setDocumentTypeFilter("all");
                  setReviewerIdFilter(null);
                  setConfidenceFilter("all");
                  setUpdatedAfterFilter("");
                  setUpdatedBeforeFilter("");
                }}
              >
                Reset filters
              </Button>
            </div>
          </div>
        </div>

        <LoadingBoundary
          hasData={records.length > 0}
          isLoading={historyQuery.isLoading}
          isError={historyQuery.isError}
          error={historyQuery.error}
          onRetry={() => void historyQuery.refetch()}
          emptyTitle="No OCR history yet"
          emptyMessage="Scanned and reviewed OCR documents will appear here automatically."
          className="min-h-0 flex flex-1 flex-col"
          contentClassName="min-h-0 flex flex-1 flex-col"
        >
          <div className="min-h-0 flex flex-1 flex-col overflow-y-auto overflow-x-hidden rounded-[0.45rem] border border-border-subtle bg-surface-shell">
            <DataTable<OcrVerificationRecord>
              ariaLabel="OCR history"
              columns={columns}
              data={records}
              getRowId={(row) => String(row.id)}
              selectedRowId={activeSelectedRecordId ? String(activeSelectedRecordId) : null}
              onRowClick={(row) => setSelectedRecordId(Number(row.id))}
              enableGlobalSearch
              enableStickyFirstColumn
              enableVirtualization={records.length > 100}
              className="min-h-0 h-full"
              viewportClassName="h-full"
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
      </div>
    </OcrShell>
  );
}
