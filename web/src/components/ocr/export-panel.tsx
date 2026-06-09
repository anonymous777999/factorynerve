import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ExportPanelProps = {
  rowCount: number;
  columnCount: number;
  correctionCount: number;
  busy?: boolean;
  status?: string;
  primaryLabel?: string;
  onDownloadExcel: () => void;
  onDownloadCsv: () => void;
  onDownloadJson: () => void;
  onCopyClipboard: () => void;
  shareCard?: ReactNode;
};

function ActionCard({
  label,
  onClick,
  primary = false,
  busy = false,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "inline-flex min-h-10 items-center justify-center border px-4 py-2 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-60",
        primary
          ? "factory-ocr-button-primary"
          : "factory-ocr-button-secondary",
      )}
    >
      {label}
    </button>
  );
}

export function ExportPanel({
  rowCount,
  columnCount,
  correctionCount,
  busy = false,
  status,
  primaryLabel = "Download .xlsx",
  onDownloadExcel,
  onDownloadCsv,
  onDownloadJson,
  onCopyClipboard,
  shareCard,
}: ExportPanelProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="factory-ocr-status min-h-10" data-tone="success">
        <span className="font-medium">Extraction complete</span>
        <span className="opacity-90">{rowCount}r / {columnCount}c / {correctionCount} edits</span>
      </div>

      <ActionCard label={primaryLabel} onClick={onDownloadExcel} primary busy={busy} />
      <ActionCard label="Export CSV" onClick={onDownloadCsv} />
      <ActionCard label="Export JSON" onClick={onDownloadJson} />
      <ActionCard label="Copy data" onClick={onCopyClipboard} />
      {status ? <div className="text-xs text-text-secondary">{status}</div> : null}
      {shareCard ? <div className="min-w-[15rem] flex-1 border-l border-border-subtle pl-3">{shareCard}</div> : null}
    </div>
  );
}
