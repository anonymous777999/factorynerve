import type { OcrPreviewResult } from "@/lib/ocr";

export type LayoutMode =
  | "card"
  | "compact"
  | "sectioned"
  | "paginated"
  | "split"
  | "key-value"
  | "message-list";

export function determineLayout(data: OcrPreviewResult): LayoutMode {
  const fieldCount = data.headers?.length ?? 0;
  const rowCount = data.rows?.length ?? 0;
  const totalCells = fieldCount * rowCount;
  const docType = data.document_type_config?.type_id;

  if (docType === "handwritten_form" || docType === "unknown_document") {
    return "key-value";
  }
  if (docType === "chat_transcript") {
    return "message-list";
  }
  if (docType === "weighbridge_slip") {
    return "card";
  }
  if (docType === "gst_invoice" || docType === "delivery_note") {
    return "split";
  }

  if (rowCount <= 3 && fieldCount <= 8) {
    return "card";
  }
  if (totalCells <= 50) {
    return "compact";
  }
  if (totalCells <= 200) {
    return "sectioned";
  }
  return "paginated";
}

export function getLayoutModeDisplayName(mode: LayoutMode): string {
  switch (mode) {
    case "card":
      return "Card Form";
    case "compact":
      return "Compact Table";
    case "sectioned":
      return "Sectioned Table";
    case "paginated":
      return "Paginated Table";
    case "split":
      return "Split Panel";
    case "key-value":
      return "Key-Value Form";
    case "message-list":
      return "Message List";
    default:
      return mode;
  }
}

export function getLayoutDescription(mode: LayoutMode): string {
  switch (mode) {
    case "card":
      return "Label-value pairs in styled cards for small documents";
    case "compact":
      return "Simple editable table with inline confidence badges";
    case "sectioned":
      return "Collapsible sections with summary rows";
    case "paginated":
      return "Virtual scrolling for large documents";
    case "split":
      return "Two-panel view: header fields on left, items table on right";
    case "key-value":
      return "Dynamic field listing with auto-detected key:value pairs";
    case "message-list":
      return "Chronological messages with sender, timestamp, content";
    default:
      return "";
  }
}

export function getSupportedDocTypes(mode: LayoutMode): string[] {
  switch (mode) {
    case "card":
      return ["weighbridge_slip", "small forms (<3 rows, <8 cols)"];
    case "compact":
      return ["simple tables (<50 cells)"];
    case "sectioned":
      return ["invoices", "delivery_notes", "purchase_orders", "grns (50-200 cells)"];
    case "paginated":
      return ["large tables (>200 cells)", "ledger sheets", "production reports"];
    case "split":
      return ["invoices", "delivery_notes", "purchase_orders"];
    case "key-value":
      return ["handwritten_form", "unknown", "chat_transcript"];
    case "message-list":
      return ["chat_transcript", "screenshots"];
    default:
      return [];
  }
}