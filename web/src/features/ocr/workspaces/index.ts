/**
 * features/ocr/workspaces — full-page compositions.
 *
 * /ocr           → OCR home (status + recent docs)
 * /ocr/scan      → upload + capture workspace
 * /ocr/verify    → verification workspace (V2 page is the active one)
 * /ocr/history   → audit log of past runs
 * /ocr/jobs/[id] → background job status (uses ocr-page wrapper)
 */

export { default as OcrHomeWorkspace } from "@/components/ocr-page";
export { default as OcrScanWorkspace } from "@/components/ocr-scan-page";
export { default as OcrHistoryWorkspace } from "@/components/ocr-history-page";
// /ocr/verify routing forks on feature flag in app/ocr/verify/page.tsx;
// the workspace itself lives in legacy-ui/ocr/ocr-verification-v2-page.
export { default as OcrVerifyV2Workspace } from "@/legacy-ui/ocr/ocr-verification-v2-page";
