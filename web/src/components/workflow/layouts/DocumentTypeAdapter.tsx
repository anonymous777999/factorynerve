"use client";

import { useMemo } from "react";
import { type OcrPreviewResult } from "@/lib/ocr";
import {
  determineLayout,
  type LayoutMode,
} from "@/lib/adaptive-layout";

// Import specific views
import {
  InvoiceReviewView,
  DeliveryNoteReviewView,
  WeighbridgeReviewView,
  PurchaseOrderReviewView,
  GRNReviewView,
  MaterialReceiptView,
  ProductionReportView,
  HandwrittenFormView,
  ChatTranscriptView,
  LedgerSheetView,
  GenericTableReviewView,
} from "../views";

interface DocumentTypeAdapterProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onHeaderChange?: (colIndex: number, value: string) => void;
  onAddRow?: () => void;
  onRemoveRow?: (rowIndex: number) => void;
  className?: string;
  forceLayout?: LayoutMode;
}

export function DocumentTypeAdapter({
  data,
  onCellChange,
  onHeaderChange,
  onAddRow,
  onRemoveRow,
  className,
  forceLayout,
}: DocumentTypeAdapterProps) {
  const docType = data.document_type_config?.type_id;

  // Computed unconditionally so the hook runs in the same order every render
  // (React rules-of-hooks). Only consumed by the `default` branch below.
  const layoutMode = useMemo(
    () => forceLayout || determineLayout(data),
    [data, forceLayout]
  );

  // Route to specific views based on document type
  switch (docType) {
    case "gst_invoice":
      return (
        <InvoiceReviewView
          data={data}
          onCellChange={onCellChange}
          onHeaderChange={onHeaderChange}
          className={className}
        />
      );
    case "delivery_note":
      return (
        <DeliveryNoteReviewView
          data={data}
          onCellChange={onCellChange}
          onHeaderChange={onHeaderChange}
          className={className}
        />
      );
    case "weighbridge_slip":
      return (
        <WeighbridgeReviewView
          data={data}
          onCellChange={onCellChange}
          onHeaderChange={onHeaderChange}
          className={className}
        />
      );
    case "purchase_order":
      return (
        <PurchaseOrderReviewView
          data={data}
          onCellChange={onCellChange}
          onHeaderChange={onHeaderChange}
          className={className}
        />
      );
    case "goods_receipt_note":
      return (
        <GRNReviewView
          data={data}
          onCellChange={onCellChange}
          onHeaderChange={onHeaderChange}
          className={className}
        />
      );
    case "material_receipt":
      return (
        <MaterialReceiptView
          data={data}
          onCellChange={onCellChange}
          onHeaderChange={onHeaderChange}
          className={className}
        />
      );
    case "production_report":
      return (
        <ProductionReportView
          data={data}
          onCellChange={onCellChange}
          onHeaderChange={onHeaderChange}
          className={className}
        />
      );
    case "handwritten_form":
      return (
        <HandwrittenFormView
          data={data}
          onCellChange={onCellChange}
          onAddRow={onAddRow}
          onRemoveRow={onRemoveRow}
          className={className}
        />
      );
    case "chat_transcript":
      return (
        <ChatTranscriptView
          data={data}
          onCellChange={onCellChange}
          className={className}
        />
      );
    case "ledger_sheet":
      return (
        <LedgerSheetView
          data={data}
          onCellChange={onCellChange}
          onHeaderChange={onHeaderChange}
          className={className}
        />
      );
    case "packing_list":
    case "vendor_quotation":
    case "dispatch_note":
    case "stock_sheet":
    case "credit_note":
    case "generic_table":
    case "unknown_document":
      return (
        <GenericTableReviewView
          data={data}
          onCellChange={onCellChange}
          onHeaderChange={onHeaderChange}
          className={className}
        />
      );
    default:
      // For unknown document types or when no specific type is detected,
      // fall back to the layout-based approach (layoutMode computed above).
      // Map layout modes to appropriate generic views
      switch (layoutMode) {
        case "card":
        case "compact":
        case "sectioned":
        case "paginated":
        case "split":
          return (
            <div className={className}>
              <GenericTableReviewView
                data={data}
                onCellChange={onCellChange}
                onHeaderChange={onHeaderChange}
                className="border-[var(--border-strong)]"
              />
            </div>
          );
        case "key-value":
          return (
            <HandwrittenFormView
              data={data}
              onCellChange={onCellChange}
              onAddRow={onAddRow}
              onRemoveRow={onRemoveRow}
              className={className}
            />
          );
        case "message-list":
          return (
            <ChatTranscriptView
              data={data}
              onCellChange={onCellChange}
              className={className}
            />
          );
        default:
          return (
            <GenericTableReviewView
              data={data}
              onCellChange={onCellChange}
              onHeaderChange={onHeaderChange}
              className={className}
            />
          );
      }
  }
}

export { determineLayout, type LayoutMode } from "@/lib/adaptive-layout";
