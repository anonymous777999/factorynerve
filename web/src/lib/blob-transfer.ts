"use client";

export type BlobTransferResult = "shared" | "downloaded" | "cancelled";

type ShareNavigator = Navigator & {
  canShare?: (data?: ShareData) => boolean;
};

type BlobTransferOptions = {
  title?: string;
  text?: string;
};

function triggerAnchorDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canShareFile(navigatorValue: ShareNavigator, file: File) {
  if (typeof navigatorValue.share !== "function") return false;
  if (typeof navigatorValue.canShare !== "function") return true;
  try {
    return navigatorValue.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function transferBlob(
  blob: Blob,
  filename: string,
  options: BlobTransferOptions = {},
): Promise<BlobTransferResult> {
  if (typeof window === "undefined") {
    return "downloaded";
  }

  const mimeType = blob.type || "application/octet-stream";
  const file = new File([blob], filename, {
    type: mimeType,
    lastModified: Date.now(),
  });
  const shareNavigator = navigator as ShareNavigator;

  if (canShareFile(shareNavigator, file)) {
    try {
      await shareNavigator.share?.({
        files: [file],
        title: options.title || filename,
        text: options.text,
      });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  triggerAnchorDownload(blob, filename);
  return "downloaded";
}
