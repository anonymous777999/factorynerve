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
    <div className="factory-ocr-upload-grid">
      <div
        className={cn(
          "factory-ocr-dropzone flex flex-col justify-center overflow-hidden rounded-[0.45rem] px-8 py-10 text-center transition duration-200 md:px-10 md:py-14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
          dragging ? "factory-ocr-console" : "",
        )}
        data-dragging={dragging ? "true" : "false"}
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
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border-default bg-surface-shell text-[var(--action-primary)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7" aria-hidden="true" focusable="false">
              <path d="M12 16V5m0 0L7.75 9.25M12 5l4.25 4.25" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4.5 16.5v1A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5v-1" strokeLinecap="round" />
            </svg>
          </div>
          <div className="mt-6 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--action-primary)]">
            Stage 1: Intake & Routing
          </div>
          <h1 className="mt-3 text-[2rem] font-semibold tracking-tight text-text-primary md:text-[2.35rem]">
            Load source document
          </h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Drop, paste, or import a production log so the OCR lane can classify, extract, and route it into governed review.
          </p>
          <button
            type="button"
            className="factory-ocr-button-primary mt-8 inline-flex h-12 min-w-[13rem] items-center justify-center px-8 text-sm font-semibold uppercase tracking-[0.14em] transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            Initialize Intake
          </button>
          {fileName ? (
            <div className="mt-4 rounded-[0.25rem] border border-border-default bg-surface-shell px-4 py-2 text-sm text-text-primary">
              {fileName}
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-3 text-sm text-text-secondary">
            <button
              type="button"
              className="rounded-control transition hover:text-[var(--action-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              onClick={() => inputRef.current?.focus()}
            >
              Paste from clipboard
            </button>
            <span className="text-text-tertiary">/</span>
            <div className="flex items-center gap-2">
              <input
                value={remoteUrl}
                placeholder="Enter image URL"
                className="h-10 w-[13rem] border border-border-default bg-surface-shell px-4 text-sm text-text-primary outline-none transition focus:border-[var(--action-primary)]"
                onChange={(event) => onRemoteUrlChange(event.target.value)}
              />
              <button
                type="button"
                className="rounded-control text-text-secondary transition hover:text-[var(--action-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-40"
                disabled={disabled || !remoteUrl.trim()}
                onClick={onImportUrl}
              >
                Open
              </button>
            </div>
            {recentRecords.length ? (
              <>
                <span className="text-text-tertiary">/</span>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-text-secondary">Recent uploads</span>
                  {recentRecords.slice(0, 3).map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      className="border border-border-default bg-surface-shell px-3 py-1.5 text-xs font-medium text-text-primary transition hover:border-[var(--action-primary)]/40 hover:text-[var(--action-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
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

      <aside className="factory-ocr-console factory-ocr-console--subtle rounded-[0.45rem] p-5">
        <div className="factory-ocr-card-title">Queue telemetry</div>
        <div className="mt-3 factory-ocr-panel-grid">
          <div className="factory-ocr-data-card">
            <div className="factory-ocr-data-card__label">Accepted sources</div>
            <div className="factory-ocr-data-card__value">PNG / JPG / PDF / TIFF</div>
          </div>
          <div className="factory-ocr-data-card">
            <div className="factory-ocr-data-card__label">Document throughput</div>
            <div className="factory-ocr-data-card__value">{recentRecords.length} recent drafts</div>
          </div>
          <div className="factory-ocr-data-card">
            <div className="factory-ocr-data-card__label">Workflow order</div>
            <div className="factory-ocr-data-card__value">Queue to extract to correct to export</div>
          </div>
        </div>

        <div className="mt-6 factory-ocr-card-title">Operational guidance</div>
        <div className="mt-3 space-y-3 text-sm leading-6 text-text-secondary">
          <div className="rounded-[0.35rem] border border-border-subtle bg-surface-shell px-4 py-3">
            Use the cleanest source first. Higher resolution and flatter paper reduce correction time downstream.
          </div>
          <div className="rounded-[0.35rem] border border-border-subtle bg-surface-shell px-4 py-3">
            Remote URL intake is useful for supplier-shared scans, but local upload gives the fastest operator feedback.
          </div>
        </div>

        {recentRecords.length ? (
          <>
            <div className="mt-6 factory-ocr-card-title">Recent queue re-entry</div>
            <div className="mt-3 space-y-2">
              {recentRecords.slice(0, 5).map((record) => (
                <button
                  key={record.id}
                  type="button"
                  className="flex w-full items-center justify-between border border-border-subtle bg-surface-shell px-3 py-3 text-left transition hover:border-[var(--action-primary)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  onClick={() => onOpenRecent(record.id)}
                >
                  <span className="truncate pr-3 text-sm font-medium text-text-primary">{shortLabel(record)}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--action-primary)]">
                    Reopen
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}
