"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkflowReminders } from "@/components/workflow-reminder-strip";
import { cn } from "@/lib/utils";

export function NotificationCenter() {
    const { reminders } = useWorkflowReminders();
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement | null>(null);

    const count = reminders.length;
    const highPriorityCount = reminders.filter((item) => item.tone === "danger").length;

    useEffect(() => {
        if (!open) return;

        function handleClickOutside(event: MouseEvent) {
            if (!panelRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        function handleEsc(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEsc);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEsc);
        };
    }, [open]);

    const title = useMemo(() => {
        if (count === 0) return "No live notifications";
        if (highPriorityCount > 0) return `${highPriorityCount} high-priority alert${highPriorityCount === 1 ? "" : "s"}`;
        return `${count} live reminder${count === 1 ? "" : "s"}`;
    }, [count, highPriorityCount]);

    return (
        <div className="relative" ref={panelRef}>
            <Button
                size="compact"
                variant="outline"
                className="relative h-8 w-8 rounded-sm border-border-default bg-surface-elevated p-0 text-text-primary hover:bg-surface-hover"
                aria-expanded={open}
                aria-label="Open notifications"
                onClick={() => setOpen((current) => !current)}
            >
                <span className="sr-only">Notifications</span>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4.5 w-4.5" aria-hidden="true" focusable="false">
                    <path d="M10 3.5a3 3 0 0 1 3 3V8c0 .7.24 1.38.69 1.91L15 11.5v1H5v-1l1.31-1.59c.45-.53.69-1.2.69-1.91V6.5a3 3 0 0 1 3-3Z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M8.5 14a1.5 1.5 0 0 0 3 0" strokeLinecap="round" />
                </svg>
                {count > 0 ? (
                    <span className="pointer-events-none absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-status-warning-icon px-1.5 text-[10px] font-semibold text-white">
                        {count}
                    </span>
                ) : null}
            </Button>

            {open ? (
                <div className="absolute right-0 top-full z-50 mt-2 w-[min(28rem,calc(100vw-1rem)))] overflow-hidden rounded-[0.85rem] border border-border-default bg-surface-shell shadow-[0_20px_70px_rgba(0,0,0,0.24)]">
                    <div className="border-b border-border-subtle px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-text-secondary">Notifications</div>
                                <div className="mt-1 text-sm font-semibold text-text-primary">{title}</div>
                            </div>
                            {count > 0 ? <Badge status={highPriorityCount > 0 ? "error" : "processing"}>{count}</Badge> : null}
                        </div>
                    </div>

                    <div className="max-h-[32rem] overflow-y-auto p-3">
                        {count === 0 ? (
                            <div className="rounded-[1rem] border border-border-subtle bg-surface-app p-4 text-sm text-text-secondary">
                                No active reminders. The workspace is clear.
                            </div>
                        ) : (
                            reminders.map((item) => (
                                <div
                                    key={item.id}
                                    className={cn(
                                        "mb-3 rounded-[1rem] border px-3 py-3 last:mb-0",
                                        item.tone === "danger"
                                            ? "border-status-danger-border bg-status-danger-bg"
                                            : item.tone === "watch"
                                                ? "border-status-warning-border bg-status-warning-bg"
                                                : "border-status-processing-border bg-status-processing-bg",
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text-primary">
                                                <span className={cn("inline-flex h-2.5 w-2.5 rounded-full", item.tone === "danger" ? "bg-status-danger-icon" : item.tone === "watch" ? "bg-status-warning-icon" : "bg-status-processing-icon")} />
                                                {item.title}
                                            </div>
                                            <p className="mt-2 text-sm leading-6 text-text-secondary">{item.detail}</p>
                                        </div>
                                        <Link href={item.href} className="shrink-0">
                                            <Button size="compact" variant="outline" className="h-8 px-3 text-xs">
                                                {item.action}
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
