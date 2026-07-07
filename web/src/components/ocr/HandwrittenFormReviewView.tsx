// web/src/components/ocr/HandwrittenFormReviewView.tsx
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
