import * as React from "react";

import { DataTable } from "@/components/ui/data-table/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  createDataTableColumnHelper,
  type DataTableColumnDef,
} from "@/components/ui/data-table/data-table-types";

export type OcrVerificationQueueRow = {
  id: string;
  verificationId: number;
  document: string;
  template: string;
  status: "draft" | "pending" | "rejected" | "approved";
  warnings: string;
  updatedAt: string;
  reviewState: string;
};

type OcrVerificationQueueTableProps = {
  rows: OcrVerificationQueueRow[];
  activeVerificationId?: number | null;
  onOpenRecord?: (verificationId: number) => void;
};

const columnHelper = createDataTableColumnHelper<OcrVerificationQueueRow>();

const columns = [
  columnHelper.accessor("document", {
    header: "Document",
    cell: (info) => info.getValue(),
    meta: {
      isRowHeader: true,
      sticky: "left",
      wrap: true,
    },
  }),
  columnHelper.accessor("template", {
    header: "Template",
    cell: (info) => info.getValue(),
    meta: {
      wrap: true,
    },
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => (
      <div className="flex justify-center">
        <StatusBadge
          tone={
            info.getValue() === "approved"
              ? "synced"
              : info.getValue() === "pending"
                ? "processing"
                : info.getValue() === "rejected"
                  ? "error"
                  : "default"
          }
        >
          {info.getValue()}
        </StatusBadge>
      </div>
    ),
    meta: {
      align: "center",
    },
  }),
  columnHelper.accessor("reviewState", {
    header: "Review",
    cell: (info) => info.getValue(),
    meta: {
      wrap: true,
    },
  }),
  columnHelper.accessor("warnings", {
    header: "Signals",
    cell: (info) => info.getValue(),
    meta: {
      wrap: true,
    },
  }),
  columnHelper.accessor("updatedAt", {
    header: "Updated",
    cell: (info) => info.getValue(),
    meta: {
      align: "right",
      cellClassName: "font-mono",
    },
  }),
] as DataTableColumnDef<OcrVerificationQueueRow>[];

export function OcrVerificationQueueTable({
  activeVerificationId = null,
  onOpenRecord,
  rows,
}: OcrVerificationQueueTableProps) {
  return (
    <div
      className="overflow-hidden rounded-panel border border-border-subtle bg-surface-panel shadow-[var(--shadow-xs)] flex flex-col"
      style={{ height: "calc(100vh - 420px)", minHeight: "300px" }}
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border-subtle px-lg py-md">
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <div className="min-w-0 space-y-xs">
            <p className="text-label-dense font-semibold uppercase tracking-wide text-text-secondary">Review queue</p>
            <p className="text-sm font-semibold text-text-primary">OCR queue</p>
            <p className="text-label-dense text-text-secondary">Route-owned backlog for OCR review and approval continuity.</p>
          </div>
          <span className="text-label-dense text-text-secondary">{rows.length} records</span>
        </div>
      </div>
      {/* Table fills remaining height */}
      <div className="flex flex-col flex-1 min-h-0">
        <DataTable<OcrVerificationQueueRow>
          ariaLabel="OCR verification queue"
          caption="OCR review queue"
          columns={columns}
          data={rows}
          activeRowId={
            activeVerificationId != null
              ? rows.find((row) => row.verificationId === activeVerificationId)?.id ?? null
              : null
          }
          enableStickyFirstColumn
          enableVirtualization={rows.length > 8}
          className="flex flex-col flex-1 min-h-0"
          scrollAreaClassName="flex-1 min-h-0"
          viewportClassName="!max-h-none h-full overflow-y-auto"
          onRowClick={(row) => onOpenRecord?.(row.verificationId)}
          emptyTitle="No OCR drafts"
          emptyMessage="Adjust filters or create a new OCR intake draft."
        />
      </div>
    </div>
  );
}
