import { OCR_MAX_UPLOAD_BYTES } from "@/lib/ocr-access";

export type PreparedOcrFile = {
  file: File;
  sha256: string;
  steps: string[];
};

const HEIC_TYPES = new Set(["image/heic", "image/heif"]);

function hasHeicExtension(file: File) {
  return /\.(heic|heif)$/i.test(file.name);
}

async function computeSha256(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function blobToFile(blob: Blob, name: string, type: string) {
  const extension = type.includes("png") ? "png" : "jpg";
  const baseName = name.replace(/\.[^.]+$/, "") || "ocr-upload";
  return new File([blob], `${baseName}.${extension}`, { type, lastModified: Date.now() });
}

async function convertHeicToJpeg(file: File) {
  const heic2anyModule = await import("heic2any");
  const converter = (heic2anyModule.default ?? heic2anyModule) as (options: {
    blob: Blob;
    toType: string;
    quality: number;
  }) => Promise<Blob | Blob[]>;
  const converted = await converter({
    blob: file,
    toType: "image/jpeg",
    quality: 0.9,
  });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  return blobToFile(blob, file.name, "image/jpeg");
}

async function compressRasterImage(file: File) {
  const compressionModule = await import("browser-image-compression");
  const compress = (compressionModule.default ?? compressionModule) as (
    input: File,
    options: {
      maxSizeMB: number;
      maxWidthOrHeight: number;
      useWebWorker: boolean;
      fileType: string;
      initialQuality: number;
    },
  ) => Promise<File>;
  return compress(file, {
    maxSizeMB: Math.max(0.5, OCR_MAX_UPLOAD_BYTES / (1024 * 1024) - 0.25),
    maxWidthOrHeight: 2200,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.86,
  });
}

export async function prepareOcrUploadFile(input: File): Promise<PreparedOcrFile> {
  const steps: string[] = [];
  let workingFile = input;

  if (HEIC_TYPES.has(input.type) || hasHeicExtension(input)) {
    workingFile = await convertHeicToJpeg(input);
    steps.push("Converted HEIC to JPEG");
  }

  if (workingFile.size > OCR_MAX_UPLOAD_BYTES * 0.72 || workingFile.type === "image/png") {
    const compressed = await compressRasterImage(workingFile);
    if (compressed.size < workingFile.size) {
      workingFile = compressed;
      steps.push("Compressed upload");
    }
  }

  if (workingFile.size > OCR_MAX_UPLOAD_BYTES) {
    const compressed = await compressRasterImage(workingFile);
    workingFile = compressed;
    steps.push("Reduced oversized upload");
  }

  const sha256 = await computeSha256(workingFile);
  steps.push("Hashed final upload");
  return { file: workingFile, sha256, steps };
}
