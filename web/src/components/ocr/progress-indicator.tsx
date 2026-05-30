import { cn } from "@/lib/utils";

type ProcessingStage =
  | "uploaded"
  | "preprocess"
  | "detect"
  | "extract"
  | "confidence";

type ProgressIndicatorProps = {
  thumbnailSrc?: string | null;
  stage: ProcessingStage;
  warning?: string | null;
};

const STAGES: Array<{
  key: ProcessingStage;
  label: string;
  progress: number;
  detail: string;
}> = [
    { key: "uploaded", label: "Source locked", progress: 14, detail: "Image admitted to intake lane." },
    { key: "preprocess", label: "Pre-process", progress: 32, detail: "Deskewing, contrast pass, orientation checks." },
    { key: "detect", label: "Layout detect", progress: 56, detail: "Finding tables, fields, and document structure." },
    { key: "extract", label: "Cell extract", progress: 78, detail: "Reading rows, values, and OCR text blocks." },
    { key: "confidence", label: "Trust score", progress: 96, detail: "Computing review hotspots and low-confidence regions." },
  ];

function iconForState(state: "pending" | "active" | "done") {
  if (state === "done") {
    return (
      <span className="grid h-5 w-5 place-items-center rounded-full border border-[rgba(98,223,125,0.32)] bg-[rgba(98,223,125,0.16)] text-[var(--status-success-fg,#9ef0ae)]">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true" focusable="false">
          <path d="m3.2 8.1 2.7 2.7 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (state === "active") {
    // Calm indigo spinner instead of pulsing/glowing AI indicator (Task 22).
    return <span className="h-5 w-5 rounded-full border-2 border-ai-processing-fg border-t-transparent animate-spin" />;
  }
  return <span className="h-5 w-5 rounded-full border border-border-default bg-surface-shell" />;
}

export function ProgressIndicator({ thumbnailSrc, stage, warning }: ProgressIndicatorProps) {
  const activeIndex = STAGES.findIndex((item) => item.key === stage);
  const activeStage = STAGES[Math.max(activeIndex, 0)];

  return (
    <div className="factory-ocr-console grid gap-4 rounded-[0.45rem] p-5 lg:grid-cols-[minmax(19rem,24rem)_minmax(0,1fr)] lg:p-6">
      <div className="factory-ocr-console--subtle overflow-hidden rounded-[0.35rem] border border-border-subtle">
        <div className="border-b border-border-subtle px-4 py-3">
          <div className="factory-ocr-card-title">Current document</div>
          <div className="mt-2 text-sm text-text-secondary">Persistent source preview stays visible through extraction.</div>
        </div>
        <div className="grid min-h-[20rem] place-items-center bg-surface-shell p-4">
          {thumbnailSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailSrc} alt="OCR processing preview" className="max-h-[20rem] w-full object-contain" />
          ) : (
            <div className="text-sm text-text-secondary">Preparing preview</div>
          )}
        </div>
      </div>

      <div className="flex flex-col">
        <div className="factory-ocr-card-title">Processing stage</div>
        <h2 className="mt-3 text-[1.9rem] font-semibold tracking-tight text-text-primary">
          {activeStage.label}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{activeStage.detail}</p>

        <div className="mt-5 h-2 overflow-hidden bg-surface-shell">
          <div
            className="h-full bg-ai-processing-fg transition-[width] duration-300"
            style={{ width: `${activeStage.progress}%` }}
          />
        </div>

        {warning ? (
          <div className="factory-ocr-status mt-5" data-tone="warning">
            <div>
              <div className="font-medium">Low image quality detected</div>
              <div className="mt-1 text-sm opacity-90">{warning}</div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-3">
            {STAGES.map((item, index) => {
              const state =
                index < activeIndex ? "done" : index === activeIndex ? "active" : "pending";
              return (
                <div
                  key={item.key}
                  className={cn(
                    "flex items-start gap-3 border p-4 transition-colors duration-[120ms]",
                    state === "active"
                      ? "border-ai-processing-border bg-ai-processing-bg"
                      : "border-border-subtle bg-surface-shell",
                  )}
                >
                  {iconForState(state)}
                  <div className="min-w-0 space-y-1">
                    <div
                      className={cn(
                        "text-sm font-medium",
                        state === "active" ? "text-ai-processing-fg" : "text-text-secondary",
                      )}
                    >
                      {item.label}
                    </div>
                    <div className="text-xs leading-5 text-text-tertiary">{item.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="factory-ocr-console--subtle space-y-3 rounded-[0.35rem] border border-border-subtle p-4">
            <div className="factory-ocr-card-title">Pipeline telemetry</div>
            <div className="factory-ocr-panel-grid">
              <div className="factory-ocr-data-card">
                <div className="factory-ocr-data-card__label">Active lane</div>
                <div className="factory-ocr-data-card__value">{activeStage.label}</div>
              </div>
              <div className="factory-ocr-data-card">
                <div className="factory-ocr-data-card__label">Progress</div>
                <div className="factory-ocr-data-card__value">{activeStage.progress}%</div>
              </div>
              <div className="factory-ocr-data-card">
                <div className="factory-ocr-data-card__label">Review mode</div>
                <div className="factory-ocr-data-card__value">Queue-aware extraction</div>
              </div>
            </div>

            <div className="space-y-3 border border-ai-processing-border bg-ai-processing-bg p-4">
              <div className="factory-ocr-card-title text-ai-processing-fg">Extraction buffer</div>
              <div className="grid gap-2">
                {Array.from({ length: 5 }, (_, rowIndex) => (
                  <div key={rowIndex} className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 4 }, (_, columnIndex) => (
                      // No pulsing animation (Task 22 / anti-patterns): static calm placeholder.
                      <div
                        key={`${rowIndex}-${columnIndex}`}
                        className="h-8 bg-[rgba(99,102,241,0.06)]"
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
