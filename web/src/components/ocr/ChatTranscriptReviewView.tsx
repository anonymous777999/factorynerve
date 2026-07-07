// web/src/components/ocr/ChatTranscriptReviewView.tsx
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
    setEditedData((prev: Record<string, any>) => ({
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
