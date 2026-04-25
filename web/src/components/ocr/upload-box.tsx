import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type UploadBoxProps = {
  disabled?: boolean;
  fileName?: string | null;
  remoteUrl: string;
  onRemoteUrlChange: (value: string) => void;
  onUploadFile: (file: File | null) => void;
  onImportUrl: () => void;
};

export function UploadBox({
  disabled = false,
  fileName,
  remoteUrl,
  onRemoteUrlChange,
  onUploadFile,
  onImportUrl,
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
      onUploadFile(item.getAsFile());
    },
    [onUploadFile],
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-center">
      <div
        className={cn(
          "group relative overflow-hidden rounded-[32px] border border-dashed p-6 transition duration-200 md:p-8",
          dragging
            ? "border-[#111827] bg-[#eef2f7]"
            : "border-[#d4d9df] bg-white hover:border-[#8d98a6] hover:bg-[#fbfbfa]",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          onUploadFile(event.dataTransfer.files?.[0] || null);
        }}
        onPaste={handlePaste}
        tabIndex={0}
      >
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#e5e7eb] bg-[#f7f7f6] text-[#111827]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
              <path d="M12 16V5m0 0L8 9m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 16.5v.5A2 2 0 0 0 7 19h10a2 2 0 0 0 2-2v-.5" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight text-[#101418]">
            Upload Image
          </h2>
          <p className="mt-2 text-sm text-[#6b7280]">PNG, JPG, JPEG</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              type="button"
              className="h-12 min-w-[10rem] bg-[#111827] text-white shadow-none hover:bg-[#1f2937]"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              Upload Image
            </Button>
            {fileName ? (
              <div className="flex h-12 items-center rounded-full border border-[#e5e7eb] bg-[#f8fafc] px-4 text-sm text-[#475467]">
                {fileName}
              </div>
            ) : null}
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/heic,image/heif"
          className="hidden"
          onChange={(event) => {
            onUploadFile(event.target.files?.[0] || null);
            event.target.value = "";
          }}
        />
      </div>

      <div className="rounded-[28px] border border-[#e7eaee] bg-white p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a93a0]">
          More ways in
        </div>
        <div className="mt-4 space-y-3">
          <Input
            value={remoteUrl}
            placeholder="Paste image URL"
            className="mt-0 h-11 rounded-[18px] border-[#e5e7eb] bg-[#fbfbfa] text-[#111827] placeholder:text-[#98a2b3] focus:border-[#111827] focus:bg-white focus:ring-[#111827]/10"
            onChange={(event) => onRemoteUrlChange(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-[18px] border-[#d4d9df] bg-[#f8fafc] text-[#111827] hover:bg-white"
            disabled={disabled || !remoteUrl.trim()}
            onClick={onImportUrl}
          >
            Import URL
          </Button>
          <div className="rounded-[18px] border border-[#eef1f4] bg-[#fbfbfa] px-4 py-3 text-sm text-[#6b7280]">
            Paste an image directly into the upload area.
          </div>
        </div>
      </div>
    </div>
  );
}

