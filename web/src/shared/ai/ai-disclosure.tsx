"use client";

import { cn } from "@/lib/utils";

type AIDisclosureProps = {
    /** What part of the value the AI produced. */
    source: "extracted" | "suggested" | "summarized";
    /** Optional rationale for the AI decision. */
    rationale?: string;
    className?: string;
};

const SOURCE_LABELS: Record<AIDisclosureProps["source"], string> = {
    extracted: "AI extracted",
    suggested: "AI suggested",
    summarized: "AI summarized",
};

/**
 * AIDisclosure — a small marker on any value AI produced.
 *
 * Trust principle: the operator must always know which numbers came
 * from a model. This component is the visual contract for that.
 *
 * Always render alongside (not in place of) the value itself. Never
 * hide the disclosure — it must be visible at the same time as the
 * value, even if abbreviated.
 */
export function AIDisclosure({ source, rationale, className }: AIDisclosureProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                "border-[var(--status-processing-border)] bg-[var(--status-processing-bg)] text-[var(--status-processing-fg)]",
                className,
            )}
            title={rationale}
        >
            <svg
                viewBox="0 0 24 24"
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <span>{SOURCE_LABELS[source]}</span>
        </span>
    );
}
