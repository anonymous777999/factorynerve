"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { type OcrGuidePageKey, useOcrGuide } from "@/lib/ocr-guide";

type OcrGuideStep = {
  label: string;
  detail: string;
};

type OcrGuideCardProps = {
  pageKey: OcrGuidePageKey;
  title: string;
  summary: string;
  steps: OcrGuideStep[];
  eyebrow?: string;
  collapsedLabel?: string;
  expandedLabel?: string;
  className?: string;
  summaryClassName?: string;
  titleClassName?: string;
  bodyClassName?: string;
  stepClassName?: string;
  renderFooter?: (expanded: boolean) => ReactNode;
};

export function OcrGuideCard({
  pageKey,
  title,
  summary,
  steps,
  eyebrow = "Guide",
  collapsedLabel = "Show guide",
  expandedLabel = "Hide guide",
  className,
  summaryClassName,
  titleClassName,
  bodyClassName,
  stepClassName,
  renderFooter,
}: OcrGuideCardProps) {
  const { expanded, ready, onExpandedChange } = useOcrGuide(pageKey);
  const isExpanded = ready ? expanded : false;

  return (
    <section className={cn("overflow-hidden rounded-[1.6rem] border", className)}>
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
        onClick={() => onExpandedChange(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div>
          <div className={cn("text-xs font-semibold uppercase tracking-[0.22em]", summaryClassName)}>
            {eyebrow}
          </div>
          <div className={cn("mt-1 text-lg font-semibold", titleClassName)}>{title}</div>
          <div className={cn("mt-2 text-sm leading-6", bodyClassName)}>{summary}</div>
        </div>
        <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em]">
          {isExpanded ? expandedLabel : collapsedLabel}
        </span>
      </button>
      {isExpanded ? (
        <div className="border-t px-5 py-5">
          <div className="grid gap-3 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.label} className={cn("rounded-2xl border px-4 py-4", stepClassName)}>
                <div className="text-xs font-semibold uppercase tracking-[0.18em]">{step.label}</div>
                <div className="mt-2 text-sm leading-6">{step.detail}</div>
              </div>
            ))}
          </div>
          {renderFooter ? <div className="mt-4">{renderFooter(isExpanded)}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
