import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ConfidenceBadge,
  confidenceLevelFromScore,
  type ConfidenceLevel,
} from "@/components/ui/confidence-badge";
import type { OCRFields } from "@/components/ocr-scan/types";

type OCRResultFormProps = {
  fields: OCRFields;
  confidence: { date?: number; material?: number; quantity?: number };
  lowThreshold: number;
  onChange: (key: keyof OCRFields, value: string) => void;
  onSave: () => void;
  onEditImage: () => void;
  onRetry: () => void;
  saveBusy?: boolean;
};

// Sprint 2 Task 23: Surface AI confidence per field with calm color-coded badges.
// Confidence values from the OCR pipeline are 0-100 percentages.
function fieldConfidenceLevel(value: number | undefined): ConfidenceLevel | null {
  if (typeof value !== "number" || value <= 0) return null;
  return confidenceLevelFromScore(value);
}

export function OCRResultForm({
  fields,
  confidence,
  lowThreshold,
  onChange,
  onSave,
  onEditImage,
  onRetry,
  saveBusy,
}: OCRResultFormProps) {
  const inputClass = (value?: number) =>
    typeof value === "number" && value > 0 && value < lowThreshold
      ? "border-status-danger-border bg-status-danger-bg"
      : "";

  const renderConfidence = (value: number | undefined) => {
    const level = fieldConfidenceLevel(value);
    if (!level || typeof value !== "number") return null;
    return (
      <ConfidenceBadge
        level={level}
        label={`${level === "high" ? "High" : level === "medium" ? "Medium" : "Low"} · ${Math.round(value)}%`}
      />
    );
  };

  // Sprint 2 Task 24: Wrap AI-extracted fields in calm indigo ai-processing surface
  // so AI content is visually distinct from user-entered data. Padding 16px (p-4)
  // and internal spacing 12px (space-y-3 / gap-3) follow the visual doctrine.
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-ai-processing-border bg-ai-processing-bg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-ai-processing-fg"
          />
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-ai-processing-fg">
            AI extracted
          </span>
        </div>

        <div className="grid gap-3">
          <label className="block">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Date</div>
              {renderConfidence(confidence.date)}
            </div>
            <Input
              aria-label="Date"
              value={fields.date}
              onChange={(e) => onChange("date", e.target.value)}
              className={`mt-1 h-12 text-base ${inputClass(confidence.date)}`}
            />
          </label>
          <label className="block">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Material</div>
              {renderConfidence(confidence.material)}
            </div>
            <Input
              aria-label="Material"
              value={fields.material}
              onChange={(e) => onChange("material", e.target.value)}
              className={`mt-1 h-12 text-base ${inputClass(confidence.material)}`}
            />
          </label>
          <label className="block">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">Quantity</div>
              {renderConfidence(confidence.quantity)}
            </div>
            <Input
              aria-label="Quantity"
              value={fields.quantity}
              onChange={(e) => onChange("quantity", e.target.value)}
              className={`mt-1 h-12 text-base ${inputClass(confidence.quantity)}`}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button className="h-12 px-6 text-base" onClick={onSave} disabled={saveBusy}>
          {saveBusy ? "Saving..." : "Save"}
        </Button>
        <Button className="h-12" variant="outline" onClick={onEditImage}>
          Edit Image
        </Button>
        <Button className="h-12" variant="ghost" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
}
