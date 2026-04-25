"use client";

import type { ReactNode } from "react";

import type { GuidanceSurfaceKey } from "@/lib/guidance";
import { useGuidancePreferences } from "@/lib/guidance";
import { cn } from "@/lib/utils";

type GuidanceBlockProps = {
  surfaceKey: GuidanceSurfaceKey | string;
  title: string;
  children: ReactNode;
  eyebrow?: string;
  summary?: string;
  collapsedLabel?: string;
  expandedLabel?: string;
  autoOpenVisits?: number;
  critical?: boolean;
  respectGlobal?: boolean;
  className?: string;
  eyebrowClassName?: string;
  titleClassName?: string;
  summaryClassName?: string;
  contentClassName?: string;
};

export function GuidanceBlock({
  surfaceKey,
  title,
  children,
  eyebrow = "Learn More",
  summary,
  collapsedLabel = "Show tips",
  expandedLabel = "Hide tips",
  autoOpenVisits,
  critical,
  respectGlobal,
  className,
  eyebrowClassName,
  titleClassName,
  summaryClassName,
  contentClassName,
}: GuidanceBlockProps) {
  const { expanded, ready, setExpanded, visible } = useGuidancePreferences(surfaceKey, {
    autoOpenVisits,
    critical,
    respectGlobal,
  });

  if (!visible) {
    return null;
  }

  const isExpanded = ready ? expanded : false;

  return (
    <section className={cn("overflow-hidden rounded-[1.6rem] border border-[var(--border)] bg-[var(--card)]", className)}>
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
        onClick={() => setExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div>
          <div className={cn("text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]", eyebrowClassName)}>
            {eyebrow}
          </div>
          <div className={cn("mt-1 text-lg font-semibold text-[var(--text)]", titleClassName)}>{title}</div>
          {summary ? <div className={cn("mt-2 text-sm leading-6 text-[var(--muted)]", summaryClassName)}>{summary}</div> : null}
        </div>
        <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          {isExpanded ? expandedLabel : collapsedLabel}
        </span>
      </button>
      {isExpanded ? (
        <div className={cn("border-t border-[var(--border)] px-5 py-5", contentClassName)}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

type GuidanceHintProps = {
  children: ReactNode;
  className?: string;
  critical?: boolean;
};

export function GuidanceHint({ children, className, critical = false }: GuidanceHintProps) {
  const { showTips } = useGuidancePreferences();

  if ((!critical && !showTips) || children == null) {
    return null;
  }

  return <div className={className}>{children}</div>;
}
