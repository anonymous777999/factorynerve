"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { type OcrPreviewResult, type OcrCell } from "@/lib/ocr";
import { confidenceBadgeClass, confidenceLabel, stringifyOcrCell } from "@/lib/ocr-review";

interface HandwrittenFormViewProps {
  data: OcrPreviewResult;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
  onAddRow?: () => void;
  onRemoveRow?: (rowIndex: number) => void;
  className?: string;
}

interface FormField {
  label: string;
  value: string;
  confidence?: number;
  rowIndex: number;
  colIndex: number;
}

function extractFormFields(data: OcrPreviewResult): FormField[] {
  const { headers = [], rows = [] } = data;
  const fields: FormField[] = [];

  if (headers.length > 0) {
    rows.forEach((row, rowIndex) => {
      headers.forEach((header, colIndex) => {
        const cell = row[colIndex];
        const value = stringifyOcrCell(cell);
        const confidence = cell && typeof cell === "object" ? cell.confidence : undefined;
        fields.push({ label: header, value, confidence, rowIndex, colIndex });
      });
    });
  } else if (rows.length > 0 && rows[0].length >= 2) {
    rows.forEach((row, rowIndex) => {
      const keyCell = row[0];
      const valueCell = row[1];
      if (keyCell) {
        const key = stringifyOcrCell(keyCell);
        const value = stringifyOcrCell(valueCell || "");
        const confidence = valueCell && typeof valueCell === "object" ? valueCell.confidence : undefined;
        fields.push({ label: key, value, confidence, rowIndex, colIndex: 1 });
      }
    });
  } else {
    rows.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const value = stringifyOcrCell(cell);
        const confidence = cell && typeof cell === "object" ? cell.confidence : undefined;
        fields.push({ label: `Field ${colIndex + 1}`, value, confidence, rowIndex, colIndex });
      });
    });
  }

  return fields;
}

function cellInputClass(value: string, confidence?: number | null): string {
  const tier = getOcrConfidenceTier(confidence ?? undefined);
  if (tier === "review_required") return "border-red-400/50 bg-[rgba(239,68,68,0.15)] text-red-50";
  if (tier === "medium") return "border-amber-400/40 bg-[rgba(245,158,11,0.08)] text-amber-50";
  if (!value.trim()) return "border-amber-400/20 bg-[rgba(245,158,11,0.05)]";
  return "";
}

function getOcrConfidenceTier(confidence: number | null | undefined): "high" | "medium" | "review_required" {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) return "medium";
  if (confidence > 1) confidence = Math.max(0, Math.min(1, confidence / 100));
  if (confidence < 0.5) return "review_required";
  if (confidence < 0.85) return "medium";
  return "high";
}

export function HandwrittenFormView({
  data,
  onCellChange,
  onAddRow,
  onRemoveRow,
  className,
}: HandwrittenFormViewProps) {
  const fields = useMemo(() => extractFormFields(data), [data]);
  const [localFields, setLocalFields] = useState<FormField[]>(fields);
  const [editingLabelIndex, setEditingLabelIndex] = useState<number | null>(null);

  if (localFields.length !== fields.length && fields.length > 0) {
    setLocalFields(fields);
  }

  const handleValueChange = (index: number, value: string) => {
    setLocalFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, value } : f))
    );
    const field = localFields[index];
    onCellChange(field.rowIndex, field.colIndex, value);
  };

  const handleLabelChange = (index: number, label: string) => {
    setLocalFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, label } : f))
    );
    onCellChange(localFields[index].rowIndex, 0, label);
  };

  const handleAddField = () => {
    const newIndex = localFields.length;
    setLocalFields((prev) => [
      ...prev,
      { label: `Field ${newIndex + 1}`, value: "", rowIndex: newIndex, colIndex: 1 },
    ]);
    onAddRow?.();
  };

  const handleRemoveField = (index: number) => {
    const field = localFields[index];
    setLocalFields((prev) => prev.filter((_, i) => i !== index));
    onRemoveRow?.(field.rowIndex);
  };

  return (
    <Card className={cn("border-[var(--border-strong)]", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Handwritten Form</CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {localFields.length > 0 ? (
          <div className="space-y-3">
            {localFields.map((field, index) => (
              <div
                key={`field-${index}`}
                className="rounded-lg border border-[var(--border)] bg-[var(--card-strong)] p-3 transition-colors hover:border-[var(--accent)]/30"
              >
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    {editingLabelIndex === index ? (
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => handleLabelChange(index, e.target.value)}
                        onBlur={() => setEditingLabelIndex(null)}
                        onKeyDown={(e) => e.key === "Enter" && setEditingLabelIndex(null)}
                        autoFocus
                        className="flex-1 rounded border bg-[var(--background)] px-2 py-1.5 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                      />
                    ) : (
                      <>
                        <span
                          className="font-medium text-[var(--text)] min-w-[120px] truncate cursor-pointer"
                          onDoubleClick={() => setEditingLabelIndex(index)}
                        >
                          {field.label}
                        </span>
                        <button
                          onClick={() => setEditingLabelIndex(index)}
                          className="p-1 rounded hover:bg-[var(--border)] text-[var(--muted)]"
                          aria-label="Edit label"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>

                  <span className="text-[var(--muted)] px-1 hidden sm:block">:</span>

                  <div className="flex-1 min-w-0 relative">
                    <input
                      type="text"
                      value={field.value}
                      onChange={(e) => handleValueChange(index, e.target.value)}
                      className={cn(
                        "w-full rounded border bg-[var(--background)] px-2 py-1.5 text-sm pr-20 transition-colors",
                        "focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]",
                        cellInputClass(field.value, field.confidence)
                      )}
                    />
                    {field.confidence !== undefined && (
                      <span
                        className={cn(
                          "pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
                          confidenceBadgeClass(field.confidence)
                        )}
                        title={confidenceLabel(field.confidence)}
                      >
                        {confidenceLabel(field.confidence)}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleRemoveField(index)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors"
                    aria-label="Remove field"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-[var(--muted)]">
            No form fields detected. Add a field to start.
          </div>
        )}

        <div className="pt-4 border-t border-[var(--border)]">
          <button
            onClick={handleAddField}
            className="inline-flex items-center gap-2 text-sm text-[var(--accent)] hover:underline"
          >
            <Plus className="h-4 w-4" />
            Add Field
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
