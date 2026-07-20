import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      ? "border-red-400/50 bg-[rgba(239,68,68,0.10)]"
      : "";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
        <label>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Date</div>
          <Input
            value={fields.date}
            onChange={(e) => onChange("date", e.target.value)}
            className={`mt-1 h-12 text-base ${inputClass(confidence.date)}`}
          />
        </label>
        <label>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Material</div>
          <Input
            value={fields.material}
            onChange={(e) => onChange("material", e.target.value)}
            className={`mt-1 h-12 text-base ${inputClass(confidence.material)}`}
          />
        </label>
        <label>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Quantity</div>
          <Input
            value={fields.quantity}
            onChange={(e) => onChange("quantity", e.target.value)}
            className={`mt-1 h-12 text-base ${inputClass(confidence.quantity)}`}
          />
        </label>
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

