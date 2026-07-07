// web/src/components/ocr/DocumentTypeAdapter.tsx
"use client";

import { useMemo } from "react";
import { InvoiceReviewView } from "./InvoiceReviewView";
import { DeliveryNoteReviewView } from "./DeliveryNoteReviewView";
import { WeighbridgeReviewView } from "./WeighbridgeReviewView";
import { PurchaseOrderReviewView } from "./PurchaseOrderReviewView";
import { GRNReviewView } from "./GRNReviewView";
import { MaterialReceiptReviewView } from "./MaterialReceiptReviewView";
import { ProductionReportReviewView } from "./ProductionReportReviewView";
import { PackingListReviewView } from "./PackingListReviewView";
import { QuotationReviewView } from "./QuotationReviewView";
import { DispatchNoteReviewView } from "./DispatchNoteReviewView";
import { StockSheetReviewView } from "./StockSheetReviewView";
import { CreditNoteReviewView } from "./CreditNoteReviewView";
import { HandwrittenFormReviewView } from "./HandwrittenFormReviewView";
import { ChatTranscriptReviewView } from "./ChatTranscriptReviewView";
import { LedgerSheetReviewView } from "./LedgerSheetReviewView";
import { GenericTableReviewView } from "./GenericTableReviewView";
import { type OcrPreviewResult } from "@/lib/ocr";
import { CardFormLayout } from "@/components/workflow/layouts/CardFormLayout";
import { CompactTableLayout } from "@/components/workflow/layouts/CompactTableLayout";
import { SectionedTableLayout } from "@/components/workflow/layouts/SectionedTableLayout";
import { PaginatedTableLayout } from "@/components/workflow/layouts/PaginatedTableLayout";
import { SplitPanelLayout } from "@/components/workflow/layouts/SplitPanelLayout";
import { KeyValueFormLayout } from "@/components/workflow/layouts/KeyValueFormLayout";
import { MessageListLayout } from "@/components/workflow/layouts/MessageListLayout";
import { determineLayout, type LayoutMode } from "@/lib/adaptive-layout";

const COMPONENT_REGISTRY: Record<string, React.ComponentType<{data: OcrPreviewResult}>> = {
  gst_invoice: InvoiceReviewView,
  delivery_note: DeliveryNoteReviewView,
  weighbridge_slip: WeighbridgeReviewView,
  purchase_order: PurchaseOrderReviewView,
  goods_receipt_note: GRNReviewView,
  material_receipt: MaterialReceiptReviewView,
  production_report: ProductionReportReviewView,
  packing_list: PackingListReviewView,
  vendor_quotation: QuotationReviewView,
  dispatch_note: DispatchNoteReviewView,
  stock_sheet: StockSheetReviewView,
  credit_note: CreditNoteReviewView,
  handwritten_form: HandwrittenFormReviewView,
  chat_transcript: ChatTranscriptReviewView,
  ledger_sheet: LedgerSheetReviewView,
  generic_table: GenericTableReviewView,
  unknown_document: GenericTableReviewView,
};

const LAYOUT_REGISTRY: Record<LayoutMode, React.ComponentType<{data: OcrPreviewResult; onCellChange: (rowIndex: number, colIndex: number, value: string) => void; onHeaderChange?: (colIndex: number, value: string) => void; showRowNumbers?: boolean; rowsPerPage?: number; className?: string; leftPanelFields?: string[]}>> = {
  "card": CardFormLayout,
  "compact": CompactTableLayout,
  "sectioned": SectionedTableLayout,
  "paginated": PaginatedTableLayout,
  "split": SplitPanelLayout,
  "key-value": KeyValueFormLayout,
  "message-list": MessageListLayout,
};

export function DocumentTypeAdapter({ 
  data, 
  onSave, 
  onSubmit,
  onApprove,
  onReject 
}: { 
  data: OcrPreviewResult;
  onSave: (payload: any) => void;
  onSubmit: (id: number) => void;
  onApprove: (id: number) => void;
  onReject: (id: number, reason: string) => void;
}) {
  const typeId = data.document_type_config?.type_id || data.doc_type_hint || "generic_table";
  const Component = COMPONENT_REGISTRY[typeId] || GenericTableReviewView;
  const config = data.document_type_config;
   
  return (
    <div className="space-y-6">
      {/* Document Type Header */}
      <div className="flex items-center gap-3 p-4 bg-[var(--card)] rounded-[1.4rem] border border-[var(--border)]">
        <span className="text-2xl" data-lucide={config?.icon || "file-text"} />
        <div>
          <h2 className="text-lg font-semibold">{config?.display_name || "OCR Result"}</h2>
          <p className="text-sm text-[var(--muted)]">
            {config?.category ? `Category: ${config.category}` : ""}
            {data.validation?.errors?.length && ` • ${data.validation.errors.length} validation errors`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Confidence indicator with type-specific thresholds */}
          <ConfidenceBadge 
            confidence={data.avg_confidence} 
            thresholds={config?.confidence_thresholds}
          />
        </div>
      </div>
      
      {/* Validation Errors Banner */}
      {data.validation?.errors?.length > 0 && (
        <ErrorBanner 
          errors={data.validation.errors}
          warnings={data.validation.warnings}
        />
      )}
      
      {/* Type-Specific Review Component */}
      <Component
        data={data}
        onSave={onSave}
        onSubmit={onSubmit}
        onApprove={onApprove}
        onReject={onReject}
      />
      
      {/* Downstream Actions */}
      {config?.downstream_actions?.length > 0 && (
        <DownstreamActionsPanel 
          actions={config.downstream_actions}
          data={data.extraction}
        />
      )}
    </div>
  );
}

// ConfidenceBadge component (simplified)
function ConfidenceBadge({ confidence, thresholds }: { confidence: number; thresholds?: { auto_approve: number; review: number; block: number } }) {
  const getStatus = () => {
    if (!thresholds) return "gray";
    if (confidence >= thresholds.auto_approve) return "green";
    if (confidence >= thresholds.review) return "yellow";
    if (confidence >= thresholds.block) return "orange";
    return "red";
  };

  const status = getStatus();
  return (
    <span className={`px-2 py-1 text-xs rounded-full bg-${status}/20 text-${status}`}>
      {Math.round(confidence)}% Confidence
    </span>
  );
}

// ErrorBanner component (simplified)
function ErrorBanner({ errors, warnings }: { errors: string[]; warnings: string[] }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      {errors.length > 0 && (
        <div className="mb-2">
          <h3 className="text-red-600 font-medium">Validation Errors</h3>
          <ul className="list-disc list-inside text-sm text-red-600">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div>
          <h3 className="text-yellow-600 font-medium">Warnings</h3>
          <ul className="list-disc list-inside text-sm text-yellow-600">
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// DownstreamActionsPanel component (simplified)
function DownstreamActionsPanel({ actions, data }: { actions: Array<{key: string; label: string; description: string}>; data: any }) {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-4">Downstream Actions</h3>
      <div className="space-y-3">
        {actions.map((action, index) => (
          <button 
            key={index}
            className="w-full text-left bg-blue-50 hover:bg-blue-100 p-3 rounded-lg border border-blue-200"
          >
            <div className="font-medium">{action.label}</div>
            <p className="text-sm text-muted-foreground">{action.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}