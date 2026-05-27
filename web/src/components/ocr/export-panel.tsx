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
        "border px-5 py-5 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-60",
        primary
          ? "factory-ocr-button-primary"
          : "factory-ocr-button-secondary",
      )}
    >
      <div className={cn("font-mono text-[10px] font-semibold uppercase tracking-[0.14em]", primary ? "text-[var(--action-primary-text)]/70" : "text-text-tertiary")}>
        {primary ? "Primary export" : "Secondary export"}
      </div>
      <div className="mt-2 text-lg font-semibold tracking-tight text-inherit">
        {label}
      </div>
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
    <div className="space-y-5">
      <div className="factory-ocr-status" data-tone="success">
        <span className="font-medium">Extraction complete</span>
        <span className="opacity-90">
          {rowCount} rows / {columnCount} columns / {correctionCount} corrected cells
        </span>
      </div>

      <ActionCard label={primaryLabel} onClick={onDownloadExcel} primary busy={busy} />

      <div className="factory-ocr-panel-grid factory-ocr-panel-grid--four">
        <ActionCard label="CSV" onClick={onDownloadCsv} />
        <ActionCard label="JSON" onClick={onDownloadJson} />
        <ActionCard label="Copy to clipboard" onClick={onCopyClipboard} />
        {shareCard ? (
          <div className="factory-ocr-console--subtle border border-border-subtle p-4">{shareCard}</div>
        ) : (
          <div className="factory-ocr-console--subtle border border-border-subtle p-4" />
        )}
      </div>

      {status ? <div className="text-sm text-text-secondary">{status}</div> : null}
    </div>
  );
}
