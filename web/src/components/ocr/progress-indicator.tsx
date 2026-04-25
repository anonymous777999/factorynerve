import { cn } from "@/lib/utils";

type ProgressIndicatorProps = {
  thumbnailSrc?: string | null;
  stage: "uploading" | "extracting" | "detecting" | "preparing";
};

const STAGES: Array<{
  key: ProgressIndicatorProps["stage"];
  label: string;
  progress: number;
}> = [
  { key: "uploading", label: "Uploading", progress: 24 },
  { key: "extracting", label: "Extracting", progress: 54 },
  { key: "detecting", label: "Detecting tables", progress: 76 },
  { key: "preparing", label: "Preparing sheet", progress: 94 },
];

export function ProgressIndicator({ thumbnailSrc, stage }: ProgressIndicatorProps) {
  const activeStage = STAGES.find((item) => item.key === stage) || STAGES[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-[28px] border border-[#e7eaee] bg-white">
        <div className="border-b border-[#eff2f5] px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a93a0]">
            Current file
          </div>
        </div>
        <div className="grid h-full min-h-[14rem] place-items-center bg-[#f6f7f8]">
          {thumbnailSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailSrc} alt="OCR processing preview" className="max-h-60 w-full object-contain" />
          ) : (
            <div className="text-sm text-[#98a2b3]">Preparing preview</div>
          )}
        </div>
      </div>

      <div className="rounded-[28px] border border-[#e7eaee] bg-white p-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#e7eaee] bg-[#f8fafc] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7280]">
          Processing
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-[#101418]">
          {activeStage.label}
        </h2>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#edf1f5]">
          <div
            className="h-full rounded-full bg-[#111827] transition-[width] duration-300"
            style={{ width: `${activeStage.progress}%` }}
          />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {STAGES.map((item) => (
            <div
              key={item.key}
              className={cn(
                "rounded-[18px] border px-3 py-3 text-sm transition duration-200",
                item.key === stage
                  ? "border-[#111827] bg-[#111827] text-white"
                  : "border-[#eef1f4] bg-[#fbfbfa] text-[#8a93a0]",
              )}
            >
              {item.label}
            </div>
          ))}
        </div>
        <div className="mt-6 overflow-hidden rounded-[24px] border border-[#eef1f4] bg-[#fbfbfa] p-4">
          <div className="grid gap-3">
            <div className="h-5 w-36 animate-pulse rounded-full bg-[#e4e8ed]" />
            <div className="grid gap-2">
              {Array.from({ length: 5 }, (_, rowIndex) => (
                <div key={rowIndex} className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 4 }, (_, columnIndex) => (
                    <div
                      key={`${rowIndex}-${columnIndex}`}
                      className="h-10 animate-pulse rounded-[14px] bg-white"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

