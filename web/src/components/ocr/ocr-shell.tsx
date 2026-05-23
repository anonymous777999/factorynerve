import type { ReactNode } from "react";

import { Badge, type BadgeStatus } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

const stepStatusClassNames: Record<"done" | "current" | "idle", string> = {
  done: "border-status-synced-border bg-status-synced-bg text-status-synced-fg",
  current: "border-workflow-active bg-workflow-active-bg text-workflow-active",
  idle: "border-border-default bg-surface-shell text-text-secondary",
};

const shellStatusMap: Record<OcrShellProps["step"], { label: string; status: BadgeStatus }> = {
  entry: { label: "Intake ready", status: "draft" },
  prepare: { label: "Draft setup", status: "paused" },
  processing: { label: "Review active", status: "processing" },
  result: { label: "Output ready", status: "synced" },
};

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
  const shellStatus = shellStatusMap[step];

  return (
    <main className="operational-page bg-surface-app">
      <div className="operational-page__inner max-w-[88rem]">
        <Card className="border-border-default bg-surface-panel shadow-xs">
          <CardContent className="px-md py-md md:px-lg md:py-lg">
            <div className="flex flex-col gap-md lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-sm">
                <span className="ui-no-select ui-no-callout text-label-dense font-semibold uppercase tracking-wide text-text-secondary">
                OCR Workspace
                </span>
                <Badge status={shellStatus.status}>{shellStatus.label}</Badge>
              </div>
              <h1 className="mt-sm text-page-title font-semibold tracking-tight text-text-primary">
                {title}
              </h1>
              <p className="mt-sm max-w-2xl text-body text-text-secondary">{subtitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-sm sm:min-w-[26rem] sm:grid-cols-4">
              {STEP_LABELS.map((item, index) => {
                const state =
                  index < activeIndex ? "done" : index === activeIndex ? "current" : "idle";
                return (
                  <div
                    key={item.key}
                    className={cn(
                      "rounded-panel border px-sm py-sm text-center transition-[background-color,border-color,color] duration-fast ease-standard",
                      stepStatusClassNames[state],
                    )}
                  >
                    <div className="text-label-dense font-semibold uppercase tracking-wide">
                      {index + 1}
                    </div>
                    <div className="mt-xs text-label font-medium">{item.label}</div>
                  </div>
                );
              })}
            </div>
            </div>
          </CardContent>
        </Card>

        <section
          className={cn(
            "grid gap-density-gap",
            sideContent
              ? "xl:grid-cols-[minmax(0,1fr)_20rem]"
              : "",
            mobile ? "" : "",
            className,
          )}
        >
          <div className="rounded-overlay border border-border-default bg-surface-panel p-md shadow-xs md:p-lg">
            {children}
          </div>
          {sideContent ? <aside className="space-y-md xl:sticky xl:top-lg xl:self-start">{sideContent}</aside> : null}
        </section>
      </div>
    </main>
  );
}
