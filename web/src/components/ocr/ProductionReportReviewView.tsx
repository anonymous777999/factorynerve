// web/src/components/ocr/ProductionReportReviewView.tsx
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

const HEADER_FIELDS = [
  {
    "key": "report_date",
    "label": "Report Date"
  },
  {
    "key": "shift",
    "label": "Shift"
  },
  {
    "key": "production_line.name",
    "label": "Production Line"
  },
  {
    "key": "machine_utilization.utilization_percentage",
    "label": "Utilization %"
  }
];

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

export function ProductionReportReviewView({
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
    setEditedData((prev: Record<string, any>) => setNestedValue(prev, fieldPath, value));
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    setEditedData((prev: Record<string, any>) => ({
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
            <CardTitle className="text-sm font-medium">Production Report Fields</CardTitle>
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
