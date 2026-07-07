"""Generate lightweight type-specific OCR review view components."""
import os, json

VIEWS_DIR = "web/src/components/ocr"

TEMPLATE = '''// web/src/components/ocr/{NAME}.tsx
"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Separator } from "@/components/ui";
import { type OcrPreviewResult } from "@/lib/ocr";
import { CardFormLayout } from "@/components/workflow/layouts/CardFormLayout";
import { CompactTableLayout } from "@/components/workflow/layouts/CompactTableLayout";
import { SectionedTableLayout } from "@/components/workflow/layouts/SectionedTableLayout";
import { PaginatedTableLayout } from "@/components/workflow/layouts/PaginatedTableLayout";
import { SplitPanelLayout } from "@/components/workflow/layouts/SplitPanelLayout";
import { determineLayout } from "@/lib/adaptive-layout";

const HEADER_FIELDS = {FIELDS_JSON};

function getNestedValue(obj: any, path: string): string {
  const keys = path.split(".");
  let val = obj;
  for (const k of keys) {
    if (val && typeof val === "object") val = val[k];
    else return "";
  }
  return val ?? "";
}

function setNestedValue(obj: any, path: string, value: any): any {
  const keys = path.split(".");
  if (keys.length === 1) {
    return { ...obj, [keys[0]]: value };
  }
  const [first, ...rest] = keys;
  return {
    ...obj,
    [first]: setNestedValue(obj[first] || {}, rest.join("."), value),
  };
}

export function {NAME}({
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
  const [editedData, setEditedData] = useState(data.extraction || {});
  const [showHeaderEditor, setShowHeaderEditor] = useState(false);

  const layoutMode = useMemo(() => determineLayout(data), [data]);

  const LayoutComponent = useMemo(() => {
    switch (layoutMode) {
      case "card": return CardFormLayout;
      case "compact": return CompactTableLayout;
      case "split": return SplitPanelLayout;
      case "sectioned": return SectionedTableLayout;
      case "paginated": return PaginatedTableLayout;
      default: return CompactTableLayout;
    }
  }, [layoutMode]);

  const handleChange = (fieldPath: string, value: any) => {
    setEditedData(prev => setNestedValue(prev, fieldPath, value));
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    setEditedData(prev => ({
      ...prev,
      rows: (prev.rows || []).map((row: any[], i: number) =>
        i === rowIndex ? row.map((cell: any, j: number) => j === colIndex ? value : cell) : row
      ),
    }));
  };

  // Merge edited data back into the data prop so header/table edits are reflected in the layout
  const displayData = useMemo(() => ({
    ...data,
    headers: editedData.headers || data.headers,
    rows: editedData.rows || data.rows,
  }), [data, editedData]);

  return (
    <div className="space-y-6">
      <Card className="border-[var(--border-strong)]">
        <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowHeaderEditor(!showHeaderEditor)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{TITLE} Fields</CardTitle>
            <span className="text-xs text-[var(--muted)]">{showHeaderEditor ? "Hide" : "Edit"} fields</span>
          </div>
        </CardHeader>
        {showHeaderEditor && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {HEADER_FIELDS.map(field => (
                <div key={field.key}>
                  <Label className="text-xs text-[var(--muted)]">{field.label}</Label>
                  <Input
                    value={getNestedValue(editedData, field.key)}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="mt-1"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      <LayoutComponent
        data={displayData}
        onCellChange={handleCellChange}
      />

      <Separator />
      <div className="flex items-center justify-end gap-4">
        <Button variant="outline" onClick={() => onSave(editedData)}>
          Save Changes
        </Button>
        <Button onClick={() => onSubmit(0)} className="bg-primary text-primary-foreground">
          Submit for Approval
        </Button>
      </div>
    </div>
  );
}
'''

VIEWS = [
    ("PurchaseOrderReviewView", "Purchase Order", [
        {"key": "po_number", "label": "PO Number"},
        {"key": "po_date", "label": "PO Date"},
        {"key": "vendor.name", "label": "Vendor"},
        {"key": "vendor.gstin", "label": "Vendor GSTIN"},
        {"key": "delivery_date", "label": "Delivery Date"},
        {"key": "totals.total", "label": "Total Amount"},
    ]),
    ("GRNReviewView", "Goods Receipt Note", [
        {"key": "grn_number", "label": "GRN Number"},
        {"key": "grn_date", "label": "GRN Date"},
        {"key": "supplier.name", "label": "Supplier"},
        {"key": "supplier.gstin", "label": "Supplier GSTIN"},
        {"key": "po_reference.po_number", "label": "PO Reference"},
    ]),
    ("MaterialReceiptReviewView", "Material Receipt", [
        {"key": "mr_number", "label": "MR Number"},
        {"key": "mr_date", "label": "MR Date"},
        {"key": "supplier.name", "label": "Supplier"},
        {"key": "vehicle_details.vehicle_number", "label": "Vehicle No"},
    ]),
    ("ProductionReportReviewView", "Production Report", [
        {"key": "report_date", "label": "Report Date"},
        {"key": "shift", "label": "Shift"},
        {"key": "production_line.name", "label": "Production Line"},
        {"key": "machine_utilization.utilization_percentage", "label": "Utilization %"},
    ]),
    ("PackingListReviewView", "Packing List", [
        {"key": "pl_number", "label": "PL Number"},
        {"key": "pl_date", "label": "PL Date"},
        {"key": "exporter.name", "label": "Exporter"},
        {"key": "importer.name", "label": "Importer"},
    ]),
    ("QuotationReviewView", "Vendor Quotation", [
        {"key": "quotation_number", "label": "Quotation No"},
        {"key": "quotation_date", "label": "Quotation Date"},
        {"key": "vendor.name", "label": "Vendor"},
        {"key": "vendor.gstin", "label": "Vendor GSTIN"},
        {"key": "pricing_summary.total_amount", "label": "Total Amount"},
    ]),
    ("DispatchNoteReviewView", "Dispatch Note", [
        {"key": "dn_number", "label": "DN Number"},
        {"key": "dn_date", "label": "DN Date"},
        {"key": "dispatcher.name", "label": "Dispatcher"},
        {"key": "recipient.name", "label": "Recipient"},
    ]),
    ("StockSheetReviewView", "Stock Sheet", [
        {"key": "ss_date", "label": "Sheet Date"},
        {"key": "warehouse.name", "label": "Warehouse"},
        {"key": "summary.total_value", "label": "Total Value"},
    ]),
    ("CreditNoteReviewView", "Credit Note", [
        {"key": "note_number", "label": "Note Number"},
        {"key": "note_type", "label": "Note Type"},
        {"key": "note_date", "label": "Note Date"},
        {"key": "reference_invoice", "label": "Reference Invoice"},
        {"key": "supplier.name", "label": "Supplier"},
        {"key": "amount_details.total_amount", "label": "Total Amount"},
    ]),
    ("LedgerSheetReviewView", "Ledger Sheet", [
        {"key": "account_info.account_name", "label": "Account Name"},
        {"key": "account_info.opening_balance", "label": "Opening Balance"},
        {"key": "totals.total_debit", "label": "Total Debit"},
        {"key": "totals.total_credit", "label": "Total Credit"},
        {"key": "totals.closing_balance", "label": "Closing Balance"},
    ]),
]

for name, title, fields in VIEWS:
    content = TEMPLATE
    for placeholder, value in [("{NAME}", name), ("{TITLE}", title)]:
        content = content.replace(placeholder, value)
    # Use a sentinel to inject JSON fields
    content = content.replace("{FIELDS_JSON}", json.dumps(fields, indent=2))
    filepath = os.path.join(VIEWS_DIR, f"{name}.tsx")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Created: {name}.tsx")

# HandwrittenFormReviewView - uses KeyValueFormLayout directly
with open(os.path.join(VIEWS_DIR, "HandwrittenFormReviewView.tsx"), "w", encoding="utf-8") as f:
    f.write('''// web/src/components/ocr/HandwrittenFormReviewView.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Separator } from "@/components/ui";
import { type OcrPreviewResult } from "@/lib/ocr";
import { KeyValueFormLayout } from "@/components/workflow/layouts/KeyValueFormLayout";

export function HandwrittenFormReviewView({
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
  const [editedData, setEditedData] = useState(data.extraction || {});

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    setEditedData(prev => ({
      ...prev,
      rows: (prev.rows || []).map((row: any[], i: number) =>
        i === rowIndex ? row.map((cell: any, j: number) => j === colIndex ? value : cell) : row
      ),
    }));
  };

  return (
    <div className="space-y-6">
      <Card className="border-[var(--border-strong)]">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Handwritten Form</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--muted)]">
            This document was detected as handwritten. Fields are presented as key-value pairs.
            Review each field carefully and correct any transcription errors.
          </p>
        </CardContent>
      </Card>

      <KeyValueFormLayout data={data} onCellChange={handleCellChange} />

      <Separator />
      <div className="flex items-center justify-end gap-4">
        <Button variant="outline" onClick={() => onSave(editedData)}>Save Changes</Button>
        <Button onClick={() => onSubmit(0)} className="bg-primary text-primary-foreground">Submit for Approval</Button>
      </div>
    </div>
  );
}
''')
print("Created: HandwrittenFormReviewView.tsx")

# ChatTranscriptReviewView - uses MessageListLayout directly
with open(os.path.join(VIEWS_DIR, "ChatTranscriptReviewView.tsx"), "w", encoding="utf-8") as f:
    f.write('''// web/src/components/ocr/ChatTranscriptReviewView.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Separator } from "@/components/ui";
import { type OcrPreviewResult } from "@/lib/ocr";
import { MessageListLayout } from "@/components/workflow/layouts/MessageListLayout";

export function ChatTranscriptReviewView({
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
  const [editedData, setEditedData] = useState(data.extraction || {});

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    setEditedData(prev => ({
      ...prev,
      rows: (prev.rows || []).map((row: any[], i: number) =>
        i === rowIndex ? row.map((cell: any, j: number) => j === colIndex ? value : cell) : row
      ),
    }));
  };

  return (
    <div className="space-y-6">
      <Card className="border-[var(--border-strong)]">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Chat Transcript</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--muted)]">
            This document was detected as a chat or messaging screenshot.
            Messages are displayed chronologically with sender information.
          </p>
        </CardContent>
      </Card>

      <MessageListLayout data={data} onCellChange={handleCellChange} />

      <Separator />
      <div className="flex items-center justify-end gap-4">
        <Button variant="outline" onClick={() => onSave(editedData)}>Save Changes</Button>
        <Button onClick={() => onSubmit(0)} className="bg-primary text-primary-foreground">Submit for Approval</Button>
      </div>
    </div>
  );
}
''')
print("Created: ChatTranscriptReviewView.tsx")

print(f"\nAll {len(VIEWS) + 2} views created in {VIEWS_DIR}/")
