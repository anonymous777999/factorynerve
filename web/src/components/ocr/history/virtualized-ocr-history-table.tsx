"use client";

import * as React from "react";
import { TableVirtuoso } from "react-virtuoso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type OcrHistoryItem } from "@/lib/ocr";
import Link from "next/link";

interface VirtualizedOcrHistoryTableProps {
  items: OcrHistoryItem[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDownload: (id: number) => void;
  busyId: number | null;
}

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

// Memoized Row to prevent re-renders of the entire list when a single row state changes
const HistoryRow = React.memo(({
  item,
  isSelected,
  onDownload,
  isBusy
}: {
  item: OcrHistoryItem;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onDownload: (id: number) => void;
  isBusy: boolean;
}) => {
  return (
    <>
      <td className={cn(
        "border-b border-border-subtle px-cell-x py-3 align-middle sticky left-0 z-10 bg-inherit",
        isSelected && "bg-surface-selected"
      )}>
        <div className="min-w-0">
          <div className="truncate text-body font-medium text-text-primary">
            {item.source_filename || `Document #${item.id}`}
          </div>
          <div className="mt-xs text-label-dense text-text-secondary">
            {Math.round(item.avg_confidence || 0)}% confidence
          </div>
        </div>
      </td>
      <td className="border-b border-border-subtle px-cell-x py-3 align-middle text-text-secondary">
        {item.doc_type_hint || "table"}
      </td>
      <td className="border-b border-border-subtle px-cell-x py-3 align-middle text-center">
        <Badge status={getStatusBadgeStatus(item.status)}>{item.status}</Badge>
      </td>
      <td className="border-b border-border-subtle px-cell-x py-3 align-middle text-text-secondary whitespace-nowrap">
        {formatTimestamp(item.updated_at)}
      </td>
      <td className="border-b border-border-subtle px-cell-x py-3 align-middle text-right">
        <div className="flex justify-end gap-sm">
          <Link href={`/ocr/verify?verification_id=${item.id}`}>
            <Button size="compact" variant="outline">
              Open
            </Button>
          </Link>
          <Button
            size="compact"
            variant="outline"
            disabled={isBusy}
            onClick={(e) => {
              e.stopPropagation();
              onDownload(item.id);
            }}
          >
            {isBusy ? "..." : "Excel"}
          </Button>
        </div>
      </td>
    </>
  );
});

HistoryRow.displayName = "HistoryRow";

export function VirtualizedOcrHistoryTable({
  items,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  selectedId,
  onSelect,
  onDownload,
  busyId,
}: VirtualizedOcrHistoryTableProps) {
  const loadMore = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <TableVirtuoso
      style={{ height: "100%" }}
      data={items}
      endReached={loadMore}
      increaseViewportBy={300}
      fixedHeaderContent={() => (
        <tr className="bg-surface-shell">
          <th className="sticky top-0 z-20 border-b border-border-subtle bg-surface-shell px-cell-x py-3 text-left text-xs font-medium uppercase tracking-wider text-text-tertiary sticky left-0">
            Document
          </th>
          <th className="sticky top-0 z-20 border-b border-border-subtle bg-surface-shell px-cell-x py-3 text-left text-xs font-medium uppercase tracking-wider text-text-tertiary">
            Type
          </th>
          <th className="sticky top-0 z-20 border-b border-border-subtle bg-surface-shell px-cell-x py-3 text-center text-xs font-medium uppercase tracking-wider text-text-tertiary">
            Status
          </th>
          <th className="sticky top-0 z-20 border-b border-border-subtle bg-surface-shell px-cell-x py-3 text-left text-xs font-medium uppercase tracking-wider text-text-tertiary">
            Updated
          </th>
          <th className="sticky top-0 z-20 border-b border-border-subtle bg-surface-shell px-cell-x py-3 text-right text-xs font-medium uppercase tracking-wider text-text-tertiary">
            Action
          </th>
        </tr>
      )}
      itemContent={(index, item) => (
        <HistoryRow
          item={item}
          isSelected={selectedId === item.id}
          onSelect={onSelect}
          onDownload={onDownload}
          isBusy={busyId === item.id}
        />
      )}
      components={{
        Table: (props) => (
          <table {...props} className="min-w-full border-separate border-spacing-0" />
        ),
        TableRow: (props) => {
          const item = props.item as OcrHistoryItem;
          const isSelected = selectedId === item?.id;
          return (
            <tr
              {...props}
              onClick={() => item && onSelect(item.id)}
              className={cn(
                "group transition-colors duration-fast ease-standard cursor-pointer bg-surface-card hover:bg-surface-hover",
                isSelected && "bg-surface-selected hover:bg-surface-selected"
              )}
            />
          );
        },
      }}
    />
  );
}
