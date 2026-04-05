import type { EnhanceSettings } from "@/lib/image-enhance";

type EnhanceRequest = {
  id: string;
  fileBuffer: ArrayBuffer;
  fileType: string;
  settings: EnhanceSettings;
};

type EnhanceResponse =
  | { id: string; ok: true; blob: Blob }
  | { id: string; ok: false; error: string };

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function normalizeCrop(crop: EnhanceSettings["crop"]) {
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

function clamp255(value: number) {
  return Math.min(255, Math.max(0, value));
}

function applyBrightnessContrast(channel: number, brightness: number, contrast: number) {
  const b = brightness / 100;
  const c = contrast / 100;
  const x = channel / 255;
  const y = (x - 0.5) * (1 + c) + 0.5 + b;
  return clamp255(Math.round(y * 255));
}

function toGray(r: number, g: number, b: number) {
  return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
}

function inferMimeType(fileType: string) {
  if (fileType === "image/png") return "image/png";
  if (fileType === "image/webp") return "image/webp";
  return "image/jpeg";
}

async function enhanceInWorker(req: EnhanceRequest): Promise<EnhanceResponse> {
  try {
    if (typeof OffscreenCanvas === "undefined") {
      return { id: req.id, ok: false, error: "OffscreenCanvas is not available." };
    }

    const settings = { ...req.settings, crop: normalizeCrop(req.settings.crop) };
    const inputBlob = new Blob([req.fileBuffer], { type: req.fileType || "application/octet-stream" });
    const bitmap = await createImageBitmap(inputBlob);

    const cropW = Math.max(1, Math.round(bitmap.width * (settings.crop.right - settings.crop.left)));
    const cropH = Math.max(1, Math.round(bitmap.height * (settings.crop.bottom - settings.crop.top)));
    const cropX = Math.round(bitmap.width * settings.crop.left);
    const cropY = Math.round(bitmap.height * settings.crop.top);

    const rotate = settings.rotate;
    const rotatedW = rotate === 90 || rotate === 270 ? cropH : cropW;
    const rotatedH = rotate === 90 || rotate === 270 ? cropW : cropH;

    const canvas = new OffscreenCanvas(rotatedW, rotatedH);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { id: req.id, ok: false, error: "Canvas context unavailable." };

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (rotate === 0) {
      ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    } else {
      ctx.save();
      ctx.translate(rotatedW / 2, rotatedH / 2);
      ctx.rotate((rotate * Math.PI) / 180);
      ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, -cropW / 2, -cropH / 2, cropW, cropH);
      ctx.restore();
    }

    // Downscale for speed.
    const maxSide = 1600;
    let workCanvas: OffscreenCanvas = canvas;
    if (Math.max(workCanvas.width, workCanvas.height) > maxSide) {
      const ratio = maxSide / Math.max(workCanvas.width, workCanvas.height);
      const scaled = new OffscreenCanvas(
        Math.max(1, Math.round(workCanvas.width * ratio)),
        Math.max(1, Math.round(workCanvas.height * ratio)),
      );
      const scaledCtx = scaled.getContext("2d", { willReadFrequently: true });
      if (!scaledCtx) return { id: req.id, ok: false, error: "Canvas context unavailable." };
      scaledCtx.imageSmoothingEnabled = true;
      scaledCtx.imageSmoothingQuality = "high";
      scaledCtx.drawImage(workCanvas, 0, 0, scaled.width, scaled.height);
      workCanvas = scaled;
    }

    const wctx = workCanvas.getContext("2d", { willReadFrequently: true });
    if (!wctx) return { id: req.id, ok: false, error: "Canvas context unavailable." };

    const imageData = wctx.getImageData(0, 0, workCanvas.width, workCanvas.height);
    const data = imageData.data;

    const brightness = settings.autoFix ? 10 : settings.brightness;
    const contrast = settings.autoFix ? 18 : settings.contrast;
    const grayscale = settings.autoFix ? true : settings.grayscale;
    const threshold = settings.autoFix ? false : settings.threshold;

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

    wctx.putImageData(imageData, 0, 0);

    const mime = inferMimeType(req.fileType);
    const blob = await workCanvas.convertToBlob({
      type: mime,
      quality: mime === "image/jpeg" ? 0.88 : undefined,
    });
    return { id: req.id, ok: true, blob };
  } catch (err) {
    return {
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : "Enhancement failed.",
    };
  }
}

self.onmessage = async (event: MessageEvent<EnhanceRequest>) => {
  const response = await enhanceInWorker(event.data);
  (self as unknown as Worker).postMessage(response);
};

