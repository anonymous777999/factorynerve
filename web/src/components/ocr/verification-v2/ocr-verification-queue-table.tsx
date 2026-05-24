import * as React from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import { OperationalTable } from "@/components/ui/operational-table";
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
    <OperationalTable<OcrVerificationQueueRow>
      title="OCR queue"
      description="Route-owned backlog for OCR review and approval continuity."
      eyebrow="Review queue"
      toneLabel={`${rows.length} records`}
      headerMeta="Tap a row to open review without losing queue placement."
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
      viewportSize="md"
      onRowClick={(row) => onOpenRecord?.(row.verificationId)}
      emptyTitle="No OCR drafts"
      emptyMessage="Adjust filters or create a new OCR intake draft."
    />
  );
}
