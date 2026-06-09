export type OcrScanStep = "upload" | "processing" | "preview" | "export";
export type OcrScanPanel = "camera" | "workspace";

const VALID_SCAN_STEPS = new Set<OcrScanStep>(["upload", "processing", "preview", "export"]);
const VALID_SCAN_PANELS = new Set<OcrScanPanel>(["camera", "workspace"]);

function toSingleValue(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function isValidOcrScanStep(value: string | null): value is OcrScanStep {
  return VALID_SCAN_STEPS.has((value as OcrScanStep) || "upload");
}

export function isValidOcrScanPanel(value: string | null): value is OcrScanPanel {
  return VALID_SCAN_PANELS.has((value as OcrScanPanel) || "workspace");
}

export function buildCanonicalOcrScanHref(input: Record<string, string | string[] | undefined>) {
  const requestedStep = toSingleValue(input.step);
  const verificationId = toSingleValue(input.verification_id);
  const panel = toSingleValue(input.panel);

  const params = new URLSearchParams();
  const normalizedStep = isValidOcrScanStep(requestedStep || null)
    ? (requestedStep as OcrScanStep)
    : "upload";
  params.set("step", normalizedStep);

  const parsedId = verificationId ? Number(verificationId) : Number.NaN;
  if (Number.isInteger(parsedId) && parsedId > 0) {
    params.set("verification_id", String(parsedId));
  }

  if (isValidOcrScanPanel(panel || null) && panel === "camera") {
    params.set("panel", "camera");
  }

  return `/ocr/scan?${params.toString()}`;
}
