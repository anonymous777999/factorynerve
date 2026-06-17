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
          "w-full max-w-3xl rounded-[var(--radius-section)] border border-dashed bg-[var(--card)] px-6 py-10 text-center shadow-[var(--shadow-md)] transition duration-200 md:px-10 md:py-14",
          dragging
            ? "border-[var(--accent)] bg-[var(--accent-quiet)]"
            : "border-[var(--border)] hover:border-[var(--accent)]",
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
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card-strong)] text-[var(--accent)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
              <path d="M12 16V5m0 0L7.75 9.25M12 5l4.25 4.25" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4.5 16.5v1A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5v-1" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="mt-6 text-[2rem] font-semibold tracking-tight text-[var(--text)] md:text-[2.35rem]">
            Upload image
          </h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            PNG, JPG, JPEG, PDF, TIFF up to 20 MB
          </p>
          <button
            type="button"
            className="mt-8 inline-flex h-14 min-w-[13rem] items-center justify-center rounded-full bg-[var(--accent)] px-8 text-sm font-semibold text-[#06111c] shadow-[0_16px_36px_rgba(197,109,45,0.24)] transition duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            Upload image
          </button>
          {fileName ? (
            <div className="mt-4 rounded-full border border-[var(--border)] bg-[var(--card-strong)] px-4 py-2 text-sm text-[var(--text)]">
              {fileName}
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-3 text-sm text-[var(--muted)]">
            <button
              type="button"
              className="transition hover:text-[var(--accent)]"
              onClick={() => inputRef.current?.focus()}
            >
              Paste from clipboard
            </button>
            <span className="text-[var(--border)]">·</span>
            <div className="flex items-center gap-2">
              <input
                value={remoteUrl}
                placeholder="Enter image URL"
                className="h-10 w-[13rem] rounded-full border border-[var(--border)] bg-[var(--card-strong)] px-4 text-sm text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:bg-[var(--bg)]"
                onChange={(event) => onRemoteUrlChange(event.target.value)}
              />
              <button
                type="button"
                className="text-[var(--muted)] transition hover:text-[var(--accent)] disabled:opacity-40"
                disabled={disabled || !remoteUrl.trim()}
                onClick={onImportUrl}
              >
                Open
              </button>
            </div>
            {recentRecords.length ? (
              <>
                <span className="text-[var(--border)]">·</span>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-[var(--muted)]">Recent uploads</span>
                  {recentRecords.slice(0, 3).map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      className="rounded-full border border-[var(--border)] bg-[var(--card-strong)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
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
