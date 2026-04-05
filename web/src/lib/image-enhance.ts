export type CropBox = {
  left: number; // 0..1
  top: number; // 0..1
  right: number; // 0..1
  bottom: number; // 0..1
};

export type EnhanceSettings = {
  autoFix: boolean;
  rotate: 0 | 90 | 180 | 270;
  brightness: number; // -100..100
  contrast: number; // -100..100
  grayscale: boolean;
  threshold: boolean;
  crop: CropBox;
};

export function defaultEnhanceSettings(): EnhanceSettings {
  return {
    autoFix: true,
    rotate: 0,
    brightness: 10,
    contrast: 18,
    grayscale: true,
    threshold: false,
    crop: { left: 0, top: 0, right: 1, bottom: 1 },
  };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function clamp255(value: number) {
  return Math.min(255, Math.max(0, value));
}

function normalizeCrop(crop: CropBox): CropBox {
  const left = clamp01(crop.left);
  const top = clamp01(crop.top);
  const right = clamp01(crop.right);
  const bottom = clamp01(crop.bottom);
  return {
    left: Math.min(left, right),
    top: Math.min(top, bottom),
    right: Math.max(left, right),
    bottom: Math.max(top, bottom),
  };
}

function applyBrightnessContrast(channel: number, brightness: number, contrast: number) {
  // brightness: -100..100, contrast: -100..100
  const b = brightness / 100;
  const c = contrast / 100;
  const x = channel / 255;
  // Contrast curve around 0.5; keep cheap for mobile.
  const y = (x - 0.5) * (1 + c) + 0.5 + b;
  return clamp255(Math.round(y * 255));
}

function toGray(r: number, g: number, b: number) {
  // perceptual luminance
  return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
}

function inferMimeType(fileType: string) {
  if (fileType === "image/png") return "image/png";
  if (fileType === "image/webp") return "image/webp";
  return "image/jpeg";
}

export async function enhanceImageFile(
  file: File,
  settings: EnhanceSettings,
): Promise<{ blob: Blob; previewUrl: string }> {
  const normalized = {
    ...settings,
    crop: normalizeCrop(settings.crop),
  };

  const bitmap = await createImageBitmap(file);
  const cropW = Math.max(1, Math.round(bitmap.width * (normalized.crop.right - normalized.crop.left)));
  const cropH = Math.max(1, Math.round(bitmap.height * (normalized.crop.bottom - normalized.crop.top)));
  const cropX = Math.round(bitmap.width * normalized.crop.left);
  const cropY = Math.round(bitmap.height * normalized.crop.top);

  // Draw cropped region into a working canvas.
  const workCanvas = document.createElement("canvas");
  const ctx = workCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available on this device.");

  // Rotate by drawing onto a second canvas if needed.
  const rotate = normalized.rotate;
  const rotatedW = rotate === 90 || rotate === 270 ? cropH : cropW;
  const rotatedH = rotate === 90 || rotate === 270 ? cropW : cropH;

  workCanvas.width = rotatedW;
  workCanvas.height = rotatedH;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (rotate === 0) {
    ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  } else {
    // translate to center and rotate
    ctx.translate(rotatedW / 2, rotatedH / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, -cropW / 2, -cropH / 2, cropW, cropH);
  }
  ctx.restore();

  // Downscale very large images for speed, while keeping enough OCR detail.
  const maxSide = 1600;
  if (Math.max(workCanvas.width, workCanvas.height) > maxSide) {
    const ratio = maxSide / Math.max(workCanvas.width, workCanvas.height);
    const scaled = document.createElement("canvas");
    scaled.width = Math.max(1, Math.round(workCanvas.width * ratio));
    scaled.height = Math.max(1, Math.round(workCanvas.height * ratio));
    const scaledCtx = scaled.getContext("2d", { willReadFrequently: true });
    if (!scaledCtx) throw new Error("Canvas is not available on this device.");
    scaledCtx.imageSmoothingEnabled = true;
    scaledCtx.imageSmoothingQuality = "high";
    scaledCtx.drawImage(workCanvas, 0, 0, scaled.width, scaled.height);
    workCanvas.width = scaled.width;
    workCanvas.height = scaled.height;
    ctx.clearRect(0, 0, workCanvas.width, workCanvas.height);
    ctx.drawImage(scaled, 0, 0);
  }

  const imageData = ctx.getImageData(0, 0, workCanvas.width, workCanvas.height);
  const data = imageData.data;

  const brightness = normalized.autoFix ? 10 : normalized.brightness;
  const contrast = normalized.autoFix ? 18 : normalized.contrast;
  const grayscale = normalized.autoFix ? true : normalized.grayscale;
  const threshold = normalized.autoFix ? false : normalized.threshold;

  // Simple enhancement: grayscale + brightness/contrast + optional threshold.
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]!;
    let g = data[i + 1]!;
    let b = data[i + 2]!;

    r = applyBrightnessContrast(r, brightness, contrast);
    g = applyBrightnessContrast(g, brightness, contrast);
    b = applyBrightnessContrast(b, brightness, contrast);

    if (grayscale) {
      const gray = toGray(r, g, b);
      r = gray;
      g = gray;
      b = gray;
    }

    if (threshold) {
      const gray = toGray(r, g, b);
      const v = gray > 160 ? 255 : 0;
      r = v;
      g = v;
      b = v;
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

  const mime = inferMimeType(file.type);
  const blob: Blob = await new Promise((resolve, reject) => {
    workCanvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Could not export enhanced image."))),
      mime,
      mime === "image/jpeg" ? 0.88 : undefined,
    );
  });

  const previewUrl = URL.createObjectURL(blob);
  return { blob, previewUrl };
}

