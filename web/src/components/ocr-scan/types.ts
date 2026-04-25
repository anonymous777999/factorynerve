export type OCRState =
  | "idle"
  | "uploading"
  | "processing"
  | "partial"
  | "completed"
  | "error";

export type OCRFields = {
  date: string;
  material: string;
  quantity: string;
};

export type StructuredOcrResultState = {
  type: string;
  title: string;
  headers: string[];
  rows: string[][];
  rawText?: string | null;
};

export const DETECTING_TEXT = "Detecting...";
