/**
 * features/ocr — OCR pipeline.
 *
 * The strategic feature: unstructured operational chaos in →
 * structured business intelligence out.
 */

export * from "./workspaces";
export * as ocrApi from "./api/ocr";

// Direct named re-exports for cross-feature consumers.
export { approveOcrVerification, rejectOcrVerification } from "./api/ocr";

export type {
    OcrHistoryItem,
    OcrVerificationRecord,
    OcrVerificationSummary,
    OcrConfidenceTier,
    OcrJobPayload,
} from "./api/ocr";
