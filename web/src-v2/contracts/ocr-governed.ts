import type { OCRExecutionRecord } from "@/v2/_governed/src/workspaces/OCRExecutionWorkspace/ocrExecutionWorkspace.contracts";
import type { OcrVerificationRecord } from "@/lib/ocr";

export type GovernedOcrWorkspaceRecord = OCRExecutionRecord & {
  editableInLegacy: boolean;
  verificationId: number;
  sourceRecord: OcrVerificationRecord;
};

export type GovernedOcrWorkspaceBanner = {
  tone: "info" | "success" | "warning";
  title: string;
  detail: string;
};
