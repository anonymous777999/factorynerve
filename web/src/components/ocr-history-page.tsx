"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ErrorBanner } from "@/components/ocr/error-banner";
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
  const [statusMessage, setStatusMessage] = useState("");
  const [localError, setLocalError] = useState("");
  const canAccess = canUseOcrScan(user?.role);

  const historyQuery = useOcrHistoryQuery(search, Boolean(user) && canAccess);
  const records = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);
  const summary = useMemo(() => {
    const approved = records.filter((record) => record.status === "approved").length;
    const pending = records.filter((record) => record.status === "pending").length;
    const rejected = records.filter((record) => record.status === "rejected").length;
    const latest = records[0]?.updated_at ? formatTimestamp(records[0].updated_at) : "No activity";
    return { approved, pending, rejected, latest };
  }, [records]);

  const handleDownload = async (recordId: number) => {
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
      sideContent={
        <div className="space-y-4">
          <div className="factory-ocr-console factory-ocr-console--subtle rounded-[0.45rem] p-4">
            <div className="factory-ocr-card-title">Archive telemetry</div>
            <div className="mt-3 factory-ocr-panel-grid">
              <div className="factory-ocr-data-card">
                <div className="factory-ocr-data-card__label">Approved exports</div>
                <div className="factory-ocr-data-card__value">{summary.approved}</div>
              </div>
              <div className="factory-ocr-data-card">
                <div className="factory-ocr-data-card__label">Pending review</div>
                <div className="factory-ocr-data-card__value">{summary.pending}</div>
              </div>
              <div className="factory-ocr-data-card">
                <div className="factory-ocr-data-card__label">Rejected drafts</div>
                <div className="factory-ocr-data-card__value">{summary.rejected}</div>
              </div>
              <div className="factory-ocr-data-card">
                <div className="factory-ocr-data-card__label">Last updated</div>
                <div className="factory-ocr-data-card__value">{summary.latest}</div>
              </div>
            </div>
          </div>

          <div className="factory-ocr-console factory-ocr-console--subtle rounded-[0.45rem] p-4">
            <div className="factory-ocr-card-title">Next action</div>
            <div className="mt-3 text-sm leading-6 text-text-secondary">
              Reopen a record to continue governed review, or start a fresh intake without leaving the OCR lifecycle.
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Link href="/ocr/scan">
                <Button size="compact" className="w-full">Open OCR scan</Button>
              </Link>
              <Link href="/ocr/verify">
                <Button size="compact" variant="outline" className="w-full">Open review queue</Button>
              </Link>
            </div>
          </div>

          <div className="factory-ocr-console factory-ocr-console--subtle rounded-[0.45rem] p-4">
            <div className="factory-ocr-card-title">Export posture</div>
            <div className="mt-3 space-y-3 text-sm leading-6 text-text-secondary">
              <div className="border border-border-subtle bg-surface-shell px-3 py-3">
                Use this archive surface for reopen, export download, and downstream audit checks.
              </div>
              <div className="border border-border-subtle bg-surface-shell px-3 py-3">
                Real export actions remain tied to stored OCR verification records only.
              </div>
            </div>
          </div>
        </div>
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

        <div className="factory-ocr-panel-grid factory-ocr-panel-grid--four">
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

        <LoadingBoundary
          hasData={records.length > 0}
          isLoading={historyQuery.isLoading}
          isError={historyQuery.isError}
          error={historyQuery.error}
          onRetry={() => void historyQuery.refetch()}
          emptyTitle="No OCR history yet"
          emptyMessage="Scanned and reviewed OCR documents will appear here automatically."
        >
          <DataTable<OcrVerificationRecord>
            ariaLabel="OCR history"
            columns={columns}
            data={records}
            enableGlobalSearch
            enableStickyFirstColumn
            enableVirtualization={records.length > 100}
            emptyTitle="No OCR documents match the current filters"
            emptyMessage="Adjust the search term or scan a new document to continue the workflow."
            renderToolbar={
              <DataTableToolbar
                searchPlaceholder="Search by file, type, or status"
                searchValue={search}
                onSearchChange={setSearch}
                onClear={() => setSearch("")}
              />
            }
            searchValue={search}
            onSearchChange={setSearch}
          />
        </LoadingBoundary>
      </div>
    </OcrShell>
  );
}
