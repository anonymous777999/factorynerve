import { Skeleton } from "@/components/ui/skeleton";
import type { OCRFields } from "@/components/ocr-scan/types";

function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
        style={{ width: `${Math.max(3, Math.min(100, value))}%` }}
      />
    </div>
  );
}

type OCRProgressProps = {
  progress: number;
  statusText: string;
  stage: "fixing" | "detecting" | "extracting";
  imageUrl: string;
  fields: OCRFields;
  detectingText: string;
};

export function OCRProgress({
  progress,
  statusText,
  stage,
  imageUrl,
  fields,
  detectingText,
}: OCRProgressProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
        <div className="space-y-1 text-sm">
          <div className={stage === "fixing" ? "text-[var(--accent)]" : "text-[var(--muted)]"}>
            {stage === "fixing" ? "Fixing image" : "Fixing image"}
          </div>
          <div className={stage === "detecting" ? "text-[var(--accent)]" : "text-[var(--muted)]"}>
            {stage === "detecting" ? "Detecting text" : "Detecting text"}
          </div>
          <div className={stage === "extracting" ? "text-[var(--accent)]" : "text-[var(--muted)]"}>
            {stage === "extracting" ? "Extracting data" : "Extracting data"}
          </div>
        </div>
        <div className="mt-3">
          <Progress value={progress} />
        </div>
        <div className="mt-2 text-xs text-[var(--muted)]">{statusText}</div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3">
        {imageUrl ? (
          <div className="flex h-[58vh] min-h-[340px] max-h-[760px] items-center justify-center overflow-hidden rounded-xl bg-[rgba(6,10,20,0.55)] sm:h-[62vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Scan preview" className="h-full w-full object-contain" />
          </div>
        ) : (
          <Skeleton className="h-[58vh] min-h-[340px] w-full rounded-xl sm:h-[62vh]" />
        )}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
        <div className="grid gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Date</div>
            <div className="mt-1 min-h-6 text-sm transition-all duration-200">{fields.date || detectingText}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Material</div>
            <div className="mt-1 min-h-6 text-sm transition-all duration-200">{fields.material || detectingText}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Quantity</div>
            <div className="mt-1 min-h-6 text-sm transition-all duration-200">{fields.quantity || detectingText}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
