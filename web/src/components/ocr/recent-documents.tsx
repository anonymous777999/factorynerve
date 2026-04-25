import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { OcrVerificationRecord } from "@/lib/ocr";
import { cn } from "@/lib/utils";

type RecentDocumentsProps = {
  records: OcrVerificationRecord[];
  compact?: boolean;
};

function formatTimestamp(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RecentDocuments({
  records,
  compact = false,
}: RecentDocumentsProps) {
  return (
    <div className="rounded-[28px] border border-[#e7eaee] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a93a0]">
            Recent
          </div>
          <div className="mt-1 text-sm text-[#66707c]">Open the latest OCR drafts.</div>
        </div>
        <Link href="/ocr/history">
          <Button
            type="button"
            variant="ghost"
            className="h-10 rounded-[16px] border border-[#eef1f4] bg-[#fbfbfa] px-3 text-[#475467] hover:bg-white"
          >
            View all
          </Button>
        </Link>
      </div>
      <div className="mt-4 space-y-3">
        {records.length ? (
          records.slice(0, compact ? 4 : 6).map((record) => (
            <Link
              key={record.id}
              href={`/ocr/verify?verification_id=${record.id}`}
              className="flex items-center justify-between gap-3 rounded-[20px] border border-[#eef1f4] bg-[#fbfbfa] px-4 py-3 transition duration-200 hover:border-[#d4d9df] hover:bg-white"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-[#111827]">
                  {record.source_filename || `Document #${record.id}`}
                </div>
                <div className="mt-1 text-xs text-[#8a93a0]">
                  {record.doc_type_hint || "table"} • {formatTimestamp(record.updated_at)}
                </div>
              </div>
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                  record.status === "approved"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : record.status === "pending"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : record.status === "rejected"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-slate-200 bg-slate-50 text-slate-600",
                )}
              >
                {record.status}
              </span>
            </Link>
          ))
        ) : (
          <div className="rounded-[20px] border border-[#eef1f4] bg-[#fbfbfa] px-4 py-4 text-sm text-[#8a93a0]">
            No OCR documents yet.
          </div>
        )}
      </div>
    </div>
  );
}

