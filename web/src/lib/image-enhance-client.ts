import { enhanceImageFile, type EnhanceSettings } from "@/lib/image-enhance";

type WorkerResponse =
  | { id: string; ok: true; blob: Blob }
  | { id: string; ok: false; error: string };

function canUseWorkerEnhance() {
  return typeof window !== "undefined" && typeof Worker !== "undefined";
}

export type EnhanceResult = { blob: Blob; previewUrl: string };

export function createImageEnhancer() {
  const worker =
    canUseWorkerEnhance()
      ? new Worker(new URL("./image-enhance.worker.ts", import.meta.url), { type: "module" })
      : null;

  let activeId: string | null = null;
  let activeResolve: ((value: EnhanceResult) => void) | null = null;
  let activeReject: ((reason?: unknown) => void) | null = null;
  let lastPreviewUrl: string | null = null;

  if (worker) {
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const payload = event.data;
      if (!payload || payload.id !== activeId) return;
      const resolve = activeResolve;
      const reject = activeReject;
      activeId = null;
      activeResolve = null;
      activeReject = null;

      if (!resolve || !reject) return;
      if (!payload.ok) {
        reject(new Error(payload.error || "Enhancement failed."));
        return;
      }
      if (lastPreviewUrl) URL.revokeObjectURL(lastPreviewUrl);
      lastPreviewUrl = URL.createObjectURL(payload.blob);
      resolve({ blob: payload.blob, previewUrl: lastPreviewUrl });
    };
  }

  const enhance = async (file: File, settings: EnhanceSettings): Promise<EnhanceResult> => {
    // Cancel previous run (soft-cancel: ignore its response).
    activeId = crypto.randomUUID();
    const id = activeId;

    if (!worker) {
      // fallback to main thread enhancer
      if (lastPreviewUrl) URL.revokeObjectURL(lastPreviewUrl);
      const result = await enhanceImageFile(file, settings);
      lastPreviewUrl = result.previewUrl;
      return result;
    }

    const buffer = await file.arrayBuffer();
    return await new Promise<EnhanceResult>((resolve, reject) => {
      activeResolve = resolve;
      activeReject = reject;
      worker.postMessage(
        { id, fileBuffer: buffer, fileType: file.type, settings },
        [buffer],
      );
    });
  };

  const dispose = () => {
    if (lastPreviewUrl) URL.revokeObjectURL(lastPreviewUrl);
    lastPreviewUrl = null;
    activeId = null;
    activeResolve = null;
    activeReject = null;
    if (worker) worker.terminate();
  };

  return { enhance, dispose };
}

