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
}> = [
  { key: "uploaded", label: "Image uploaded", progress: 14 },
  { key: "preprocess", label: "Pre-processing & deskewing", progress: 32 },
  { key: "detect", label: "Detecting tables & layout structure", progress: 56 },
  { key: "extract", label: "Extracting cell data", progress: 78 },
  { key: "confidence", label: "Running confidence check", progress: 96 },
];

function iconForState(state: "pending" | "active" | "done") {
  if (state === "done") {
    return (
      <span className="grid h-6 w-6 place-items-center rounded-full bg-[#185FA5] text-white">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
          <path d="m3.2 8.1 2.7 2.7 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (state === "active") {
    return <span className="h-6 w-6 rounded-full border-2 border-[#185FA5] border-t-transparent animate-spin" />;
  }
  return <span className="h-6 w-6 rounded-full border border-[#d5dde6] bg-white" />;
}

export function ProgressIndicator({ thumbnailSrc, stage, warning }: ProgressIndicatorProps) {
  const activeIndex = STAGES.findIndex((item) => item.key === stage);
  const activeStage = STAGES[Math.max(activeIndex, 0)];

  return (
    <div className="mx-auto grid max-w-6xl gap-6 rounded-[32px] border border-[#e3e8ef] bg-white p-5 shadow-[0_28px_80px_rgba(15,23,42,0.08)] lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] lg:p-8">
      <div className="overflow-hidden rounded-[28px] border border-[#e6ebf1] bg-[#f7f9fb]">
        <div className="border-b border-[#e6ebf1] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#667085]">
          Current image
        </div>
        <div className="grid min-h-[18rem] place-items-center bg-[linear-gradient(180deg,#f9fbfd_0%,#f3f6f9_100%)] p-4">
          {thumbnailSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailSrc} alt="OCR processing preview" className="max-h-[18rem] w-full object-contain" />
          ) : (
            <div className="text-sm text-[#667085]">Preparing preview</div>
          )}
        </div>
      </div>

      <div className="flex flex-col">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#667085]">
          Processing
        </div>
        <h2 className="mt-3 text-[2rem] font-semibold tracking-tight text-[#101828]">
          {activeStage.label}
        </h2>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#eaf0f5]">
          <div
            className="h-full rounded-full bg-[#185FA5] transition-[width] duration-300"
            style={{ width: `${activeStage.progress}%` }}
          />
        </div>

        {warning ? (
          <div className="mt-5 flex items-start justify-between gap-3 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div>
              <div className="font-medium">Low image quality detected - results may be less accurate</div>
              <div className="mt-1 text-amber-800/80">{warning}</div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          {STAGES.map((item, index) => {
            const state =
              index < activeIndex ? "done" : index === activeIndex ? "active" : "pending";
            return (
              <div
                key={item.key}
                className={cn(
                  "flex items-center gap-3 rounded-[20px] border px-4 py-4 transition duration-200",
                  state === "active"
                    ? "border-[#cfe0f0] bg-[#f7fbff]"
                    : "border-[#edf1f5] bg-[#fbfcfd]",
                )}
              >
                {iconForState(state)}
                <div className={cn("text-sm", state === "active" ? "font-medium text-[#101828]" : "text-[#667085]")}>
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-[24px] border border-[#e9eef4] bg-[#fbfcfd] p-4">
          <div className="h-4 w-40 animate-pulse rounded-full bg-[#e5ebf1]" />
          <div className="mt-4 grid gap-2">
            {Array.from({ length: 5 }, (_, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-4 gap-2">
                {Array.from({ length: 4 }, (_, columnIndex) => (
                  <div key={`${rowIndex}-${columnIndex}`} className="h-9 animate-pulse rounded-[12px] bg-white" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
