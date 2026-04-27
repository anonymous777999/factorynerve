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
        "rounded-[24px] border px-5 py-5 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-60",
        primary
          ? "border-[#185FA5] bg-[#185FA5] text-white shadow-[0_20px_42px_rgba(24,95,165,0.24)] hover:bg-[#164f8a]"
          : "border-[#dfe6ed] bg-white text-[#101828] hover:border-[#185FA5]/35 hover:shadow-[0_14px_30px_rgba(15,23,42,0.06)]",
      )}
    >
      <div className={cn("text-sm", primary ? "text-white/85" : "text-[#667085]")}>
        {primary ? "Primary export" : "Secondary export"}
      </div>
      <div className="mt-2 text-lg font-semibold tracking-tight">
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
      <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
        <span className="font-medium">Extraction complete</span>
        <span className="text-emerald-900/80">
          {" "}
          - {rowCount} rows, {columnCount} columns, {correctionCount} corrections made
        </span>
      </div>

      <ActionCard label={primaryLabel} onClick={onDownloadExcel} primary busy={busy} />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ActionCard label="CSV" onClick={onDownloadCsv} />
        <ActionCard label="JSON" onClick={onDownloadJson} />
        <ActionCard label="Copy to clipboard" onClick={onCopyClipboard} />
        {shareCard ? <div>{shareCard}</div> : <div className="rounded-[24px] border border-[#dfe6ed] bg-white px-5 py-5" />}
      </div>

      {status ? <div className="text-sm text-[#667085]">{status}</div> : null}
    </div>
  );
}
