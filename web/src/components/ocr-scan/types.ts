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

export const DETECTING_TEXT = "Detecting...";

