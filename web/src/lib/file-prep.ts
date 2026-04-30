import { OCR_MAX_UPLOAD_BYTES } from "@/lib/ocr-access";

export type PreparedOcrFile = {
  file: File;
  sha256: string;
  steps: string[];
};

const HEIC_TYPES = new Set(["image/heic", "image/heif"]);
const OCR_SOFT_COMPRESSION_THRESHOLD = Math.floor(OCR_MAX_UPLOAD_BYTES * 0.95);

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

async function compressRasterImage(
  file: File,
  options?: {
    maxSizeBytes?: number;
    preservePng?: boolean;
  },
) {
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
  const preservePng = Boolean(options?.preservePng && file.type === "image/png");
  const targetBytes = options?.maxSizeBytes ?? OCR_MAX_UPLOAD_BYTES;
  const targetType = preservePng ? "image/png" : "image/jpeg";
  return compress(file, {
    maxSizeMB: Math.max(0.8, targetBytes / (1024 * 1024) - 0.1),
    maxWidthOrHeight: 3200,
    useWebWorker: true,
    fileType: targetType,
    initialQuality: preservePng ? 1 : 0.94,
  });
}

export async function prepareOcrUploadFile(input: File): Promise<PreparedOcrFile> {
  const steps: string[] = [];
  let workingFile = input;

  if (HEIC_TYPES.has(input.type) || hasHeicExtension(input)) {
    workingFile = await convertHeicToJpeg(input);
    steps.push("Converted HEIC to JPEG");
  }

  // Preserve OCR detail unless we are close to the upload cap.
  if (workingFile.size > OCR_SOFT_COMPRESSION_THRESHOLD) {
    const compressed = await compressRasterImage(workingFile, {
      maxSizeBytes: OCR_MAX_UPLOAD_BYTES,
      preservePng: true,
    });
    if (compressed.size < workingFile.size) {
      workingFile = compressed;
      steps.push("Compressed upload");
    }
  }

  if (workingFile.size > OCR_MAX_UPLOAD_BYTES) {
    const compressed = await compressRasterImage(workingFile, {
      maxSizeBytes: OCR_MAX_UPLOAD_BYTES,
      preservePng: true,
    });
    workingFile = compressed;
    steps.push("Reduced oversized upload");
  }

  const sha256 = await computeSha256(workingFile);
  steps.push("Hashed final upload");
  return { file: workingFile, sha256, steps };
}
