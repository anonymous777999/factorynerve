import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type ExportPanelProps = {
  canDownloadExcel: boolean;
  busy?: boolean;
  status?: string;
  onDownloadExcel: () => void;
  onDownloadCsv: () => void;
  onDownloadJson: () => void;
  secondaryAction?: ReactNode;
};

export function ExportPanel({
  canDownloadExcel,
  busy = false,
  status,
  onDownloadExcel,
  onDownloadCsv,
  onDownloadJson,
  secondaryAction,
}: ExportPanelProps) {
  return (
    <div className="space-y-4 rounded-[28px] border border-[#e7eaee] bg-white p-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a93a0]">
          Export
        </div>
        <div className="mt-1 text-sm text-[#66707c]">Excel stays primary. CSV and JSON are lightweight fallbacks.</div>
      </div>

      <Button
        type="button"
        className="h-12 w-full rounded-[18px] bg-[#111827] text-white shadow-none hover:bg-[#1f2937]"
        onClick={onDownloadExcel}
        disabled={busy || !canDownloadExcel}
      >
        {busy ? "Preparing Excel..." : "Download Excel"}
      </Button>

      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-[18px] border-[#d4d9df] bg-[#f8fafc] text-[#111827] hover:bg-white"
          onClick={onDownloadCsv}
        >
          CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-[18px] border-[#d4d9df] bg-[#f8fafc] text-[#111827] hover:bg-white"
          onClick={onDownloadJson}
        >
          JSON
        </Button>
      </div>

      {secondaryAction}
      {status ? <div className="text-sm text-[#66707c]">{status}</div> : null}
    </div>
  );
}
