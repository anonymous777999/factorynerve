import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type OcrShellProps = {
  title: string;
  subtitle: string;
  step: "entry" | "prepare" | "processing" | "result";
  children: ReactNode;
  sideContent?: ReactNode;
  mobile?: boolean;
  className?: string;
};

const STEP_LABELS: Array<{ key: OcrShellProps["step"]; label: string }> = [
  { key: "entry", label: "Upload" },
  { key: "prepare", label: "Prepare" },
  { key: "processing", label: "Process" },
  { key: "result", label: "Export" },
];

export function OcrShell({
  title,
  subtitle,
  step,
  children,
  sideContent,
  mobile = false,
  className,
}: OcrShellProps) {
  const activeIndex = STEP_LABELS.findIndex((item) => item.key === step);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#0d1218_0%,#111820_100%)] px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <section className="surface-panel-strong rounded-[32px] px-5 py-5 text-[var(--text)] md:px-7 md:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                OCR Workspace
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--text)] md:text-[2.1rem]">
                {title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{subtitle}</p>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:min-w-[26rem]">
              {STEP_LABELS.map((item, index) => {
                const state =
                  index < activeIndex ? "done" : index === activeIndex ? "current" : "idle";
                return (
                  <div
                    key={item.key}
                    className={cn(
                      "rounded-[18px] border px-3 py-3 text-center transition duration-200",
                      state === "done"
                        ? "border-[rgba(197,109,45,0.26)] bg-[rgba(197,109,45,0.14)] text-[var(--text)]"
                        : state === "current"
                          ? "border-[rgba(197,109,45,0.46)] bg-[linear-gradient(135deg,rgba(197,109,45,0.34),rgba(140,66,24,0.74))] text-[#fff7ef] shadow-[0_18px_36px_rgba(140,66,24,0.24)]"
                          : "border-[var(--border)] bg-[rgba(10,15,24,0.62)] text-[var(--text-tertiary)]",
                    )}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                      {index + 1}
                    </div>
                    <div className="mt-1 text-sm font-medium">{item.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section
          className={cn(
            "grid gap-4",
            sideContent
              ? "xl:grid-cols-[minmax(0,1fr)_20rem]"
              : "",
            mobile ? "" : "",
            className,
          )}
        >
          <div className="surface-panel rounded-[32px] p-4 md:p-6">
            {children}
          </div>
          {sideContent ? (
            <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">{sideContent}</aside>
          ) : null}
        </section>
      </div>
    </main>
  );
}
