"use client";

import { cn } from "@/lib/utils";

type AuditEvent = {
    id: number | string;
    /** Short kind label, e.g. "submitted", "approved", "rejected". */
    type: string;
    /** Free-text detail. */
    detail?: string | null;
    /** Who did it. */
    actor?: string | null;
    /** ISO timestamp. */
    createdAt: string;
};

type AuditTimelineProps = {
    events: AuditEvent[];
    className?: string;
    emptyMessage?: string;
};

function formatTimestamp(value: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/**
 * AuditTimeline — vertical event timeline.
 *
 * The audit-trail visual every operational record gets. Used for OCR,
 * approvals, attendance review, reconciliation, dispatch edits.
 *
 * Each event renders as a row with: dot (status-token color), kind label,
 * actor, timestamp, optional detail. The dot color comes from the kind
 * via simple keyword mapping; override with theme tokens if needed.
 */
export function AuditTimeline({ events, className, emptyMessage = "No events recorded yet." }: AuditTimelineProps) {
    if (!events.length) {
        return (
            <div className={cn("rounded-md border border-[var(--border-subtle)] bg-[var(--surface-shell)] px-3 py-3 text-sm text-text-tertiary", className)}>
                {emptyMessage}
            </div>
        );
    }

    return (
        <ol className={cn("relative space-y-3 border-l border-[var(--border-subtle)] pl-4", className)}>
            {events.map((event) => {
                const tone =
                    /reject|fail|error/i.test(event.type) ? "danger" :
                        /approv|complet|sync/i.test(event.type) ? "success" :
                            /pend|wait|review/i.test(event.type) ? "warning" :
                                /process|extract|ai/i.test(event.type) ? "processing" :
                                    "neutral";
                const dotColor =
                    tone === "success" ? "var(--status-success-icon)" :
                        tone === "warning" ? "var(--status-warning-icon)" :
                            tone === "danger" ? "var(--status-danger-icon)" :
                                tone === "processing" ? "var(--status-processing-icon)" :
                                    "var(--text-tertiary)";

                return (
                    <li key={event.id} className="relative">
                        <span
                            aria-hidden="true"
                            className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--surface-shell)]"
                            style={{ background: dotColor }}
                        />
                        <div className="text-sm font-medium text-text-primary">{event.type}</div>
                        {event.detail ? (
                            <div className="mt-0.5 text-xs text-text-secondary">{event.detail}</div>
                        ) : null}
                        <div className="mt-1 text-xs text-text-tertiary tabular-nums">
                            {event.actor ? `${event.actor} · ` : ""}
                            {formatTimestamp(event.createdAt)}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

export type { AuditEvent };
