import { Input } from "@/components/ui/input";
import type { OCRFields } from "@/components/ocr-scan/types";

type OCRPartialResultProps = {
  fields: OCRFields;
  detectingText: string;
};

export function OCRPartialResult({ fields, detectingText }: OCRPartialResultProps) {
  return (
    <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
      <label>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Date</div>
        <Input readOnly value={fields.date || detectingText} className="mt-1 h-11" />
      </label>
      <label>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Material</div>
        <Input readOnly value={fields.material || detectingText} className="mt-1 h-11" />
      </label>
      <label>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Quantity</div>
        <Input readOnly value={fields.quantity || detectingText} className="mt-1 h-11" />
      </label>
    </div>
  );
}

