import { Button } from "@/components/ui/button";

type MobileEntryProps = {
  onOpenCamera: () => void;
  onOpenUpload: () => void;
  recentCount?: number;
};

export function MobileEntry({
  onOpenCamera,
  onOpenUpload,
  recentCount = 0,
}: MobileEntryProps) {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-[#e5e7eb] bg-[linear-gradient(180deg,#ffffff_0%,#f5f6f7_100%)] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(17,24,39,0.07),transparent_60%)]" />
      <div className="relative">
        <div className="inline-flex rounded-full border border-[#e5e7eb] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7280]">
          Mobile scan
        </div>
        <h2 className="mt-4 max-w-xs text-[2rem] font-semibold leading-tight tracking-tight text-[#101418]">
          Camera-first capture for paper sheets
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-6 text-[#66707c]">
          Open the camera, capture once, correct the table, and export the sheet.
        </p>

        <div className="mt-8 flex items-center justify-between rounded-[24px] border border-[#eceff3] bg-white px-4 py-4">
          <div>
            <div className="text-sm font-medium text-[#111827]">Recent documents</div>
            <div className="mt-1 text-sm text-[#6b7280]">{recentCount} available in history</div>
          </div>
          <button
            type="button"
            className="ocr-camera-fab h-16 w-16 rounded-full bg-[#111827] text-white"
            onClick={onOpenCamera}
            aria-label="Scan with camera"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mx-auto h-7 w-7">
              <path d="M6 8.5h2.1L9.5 6h5L16 8.5H18A2.5 2.5 0 0 1 20.5 11v5A2.5 2.5 0 0 1 18 18.5H6A2.5 2.5 0 0 1 3.5 16v-5A2.5 2.5 0 0 1 6 8.5Z" strokeLinejoin="round" />
              <circle cx="12" cy="13.3" r="3.5" />
            </svg>
          </button>
        </div>

        <Button
          type="button"
          variant="outline"
          className="mt-4 h-12 w-full rounded-[18px] border-[#d4d9df] bg-[#f8fafc] text-[#111827] hover:bg-white"
          onClick={onOpenUpload}
        >
          Upload from device
        </Button>
      </div>
    </div>
  );
}

