import { useCallback, useRef, useState } from "react";

import type { OcrVerificationRecord } from "@/lib/ocr";
import { cn } from "@/lib/utils";

type UploadBoxProps = {
  disabled?: boolean;
  fileName?: string | null;
  remoteUrl: string;
  recentRecords?: OcrVerificationRecord[];
  onRemoteUrlChange: (value: string) => void;
  onUploadFile: (file: File | null) => void | Promise<void>;
  onImportUrl: () => void;
  onOpenRecent: (verificationId: number) => void;
};

function shortLabel(record: OcrVerificationRecord) {
  return record.source_filename || `Document #${record.id}`;
}

export function UploadBox({
  disabled = false,
  fileName,
  remoteUrl,
  recentRecords = [],
  onRemoteUrlChange,
  onUploadFile,
  onImportUrl,
  onOpenRecent,
}: UploadBoxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      const item = Array.from(event.clipboardData.items).find((entry) =>
        entry.type.startsWith("image/"),
      );
      if (!item) return;
      event.preventDefault();
      void onUploadFile(item.getAsFile());
    },
    [onUploadFile],
  );

  return (
    <div className="mx-auto flex min-h-[72vh] w-full max-w-4xl items-center justify-center px-4">
      <div
        className={cn(
          "w-full max-w-3xl rounded-[32px] border border-dashed bg-white px-6 py-10 text-center shadow-[0_24px_64px_rgba(15,23,42,0.08)] transition duration-200 md:px-10 md:py-14",
          dragging
            ? "border-[#185FA5] bg-[#f5faff] shadow-[0_24px_70px_rgba(24,95,165,0.16)]"
            : "border-[#d9e0e7] hover:border-[#b8c7d6]",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void onUploadFile(event.dataTransfer.files?.[0] || null);
        }}
        onPaste={handlePaste}
        tabIndex={0}
        aria-label="Upload OCR document"
      >
        <div className="mx-auto flex max-w-xl flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#e5ebf1] bg-[#f7fafc] text-[#185FA5]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
              <path d="M12 16V5m0 0L7.75 9.25M12 5l4.25 4.25" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4.5 16.5v1A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5v-1" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="mt-6 text-[2rem] font-semibold tracking-tight text-[#101828] md:text-[2.35rem]">
            Upload image
          </h1>
          <p className="mt-3 text-sm text-[#667085]">
            PNG, JPG, JPEG, PDF, TIFF up to 20 MB
          </p>
          <button
            type="button"
            className="mt-8 inline-flex h-14 min-w-[13rem] items-center justify-center rounded-full bg-[#185FA5] px-8 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(24,95,165,0.24)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#164f8a] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            Upload image
          </button>
          {fileName ? (
            <div className="mt-4 rounded-full border border-[#dbe5ee] bg-[#f7fafc] px-4 py-2 text-sm text-[#344054]">
              {fileName}
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-3 text-sm text-[#667085]">
            <button
              type="button"
              className="transition hover:text-[#185FA5]"
              onClick={() => inputRef.current?.focus()}
            >
              Paste from clipboard
            </button>
            <span className="text-[#c2cad3]">·</span>
            <div className="flex items-center gap-2">
              <input
                value={remoteUrl}
                placeholder="Enter image URL"
                className="h-10 w-[13rem] rounded-full border border-[#d9e0e7] bg-[#f9fbfd] px-4 text-sm text-[#101828] outline-none transition focus:border-[#185FA5] focus:bg-white"
                onChange={(event) => onRemoteUrlChange(event.target.value)}
              />
              <button
                type="button"
                className="text-[#667085] transition hover:text-[#185FA5] disabled:opacity-40"
                disabled={disabled || !remoteUrl.trim()}
                onClick={onImportUrl}
              >
                Open
              </button>
            </div>
            {recentRecords.length ? (
              <>
                <span className="text-[#c2cad3]">·</span>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-[#667085]">Recent uploads</span>
                  {recentRecords.slice(0, 3).map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      className="rounded-full border border-[#dde4eb] bg-[#f9fbfd] px-3 py-1.5 text-xs font-medium text-[#344054] transition hover:border-[#185FA5]/30 hover:text-[#185FA5]"
                      onClick={() => onOpenRecent(record.id)}
                    >
                      {shortLabel(record)}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/tiff,image/heic,image/heif,application/pdf"
          className="hidden"
          onChange={(event) => {
            void onUploadFile(event.target.files?.[0] || null);
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
