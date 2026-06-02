"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type EvidenceItem = {
    label: string;
    value: string;
    /** When set, the value renders as a link. */
    href?: string;
};

type EvidencePanelProps = {
    /** Section header. */
    title: string;
    items: EvidenceItem[];
    className?: string;
};

/**
 * EvidencePanel — "what was looked at" card.
 *
 * Used in approval drawers, OCR side panels, and reconciliation reviews
 * to show the static evidence behind a decision: source document,
 * shift entry id, weighbridge reference, etc.
 *
 * Compose with AuditTimeline for the full audit story (what was looked
 * at + what happened to it).
 */
export function EvidencePanel({ title, items, className }: EvidencePanelProps) {
    return (
        <div className={cn("rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4", className)}>
            <div className="text-xs font-semibold tracking-wide text-text-tertiary">{title}</div>
            <dl className="mt-3 space-y-2 text-sm">
                {items.map((item) => (
                    <div key={`${item.label}-${item.value}`} className="flex items-start justify-between gap-3">
                        <dt className="text-text-secondary">{item.label}</dt>
                        <dd className="min-w-0 text-right font-medium text-text-primary truncate">
                            {item.href ? (
                                <Link href={item.href} className="text-[var(--text-link)] underline underline-offset-4 hover:text-[var(--text-link-hover)]">
                                    {item.value}
                                </Link>
                            ) : (
                                item.value
                            )}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}
