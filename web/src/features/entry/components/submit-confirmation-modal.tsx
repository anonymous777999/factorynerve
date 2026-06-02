"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

import { formatShiftLabel, type ShiftValue } from "../lib/entry-helpers";

export type SubmitConfirmation = {
    shift: ShiftValue;
    units: number;
    entryId: number;
    completedToday: number;
};

type SubmitConfirmationModalProps = {
    confirmation: SubmitConfirmation | null;
    onDismiss: () => void;
};

/**
 * SubmitConfirmationModal — the post-submit success overlay.
 *
 * Renders nothing when `confirmation` is null. When set, shows a centered
 * modal with shift, units, entry id, today's progress, and two CTAs:
 *   - "Next shift" (or "Done for today" when 3/3 shifts done)
 *   - "Back to dashboard"
 *
 * Both CTAs dismiss the modal. The dashboard link also navigates.
 */
export function SubmitConfirmationModal({ confirmation, onDismiss }: SubmitConfirmationModalProps) {
    if (!confirmation) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="entry-confirm-title"
        >
            <div className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-7 text-center shadow-[var(--shadow-xl)] animate-scale-in">
                <div
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
                    style={{
                        background: "var(--status-success-bg)",
                        color: "var(--status-success-fg)",
                    }}
                >
                    <svg
                        viewBox="0 0 24 24"
                        className="h-8 w-8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div id="entry-confirm-title" className="mt-5 text-xl font-semibold text-text-primary">
                    Entry saved
                </div>
                <div className="mt-2 text-sm text-text-secondary">
                    {formatShiftLabel(confirmation.shift)} shift &mdash; {confirmation.units} units
                </div>
                <div className="mt-1 text-xs text-text-tertiary tabular-nums">
                    Entry #{confirmation.entryId} &middot; {confirmation.completedToday}/3 shifts complete today
                </div>
                <div className="mt-6 grid gap-2">
                    <Button className="h-12 w-full text-base" onClick={onDismiss}>
                        {confirmation.completedToday < 3 ? "Next shift" : "Done for today"}
                    </Button>
                    <Link href="/dashboard" className="block">
                        <Button variant="ghost" className="h-10 w-full text-sm" onClick={onDismiss}>
                            Back to dashboard
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
