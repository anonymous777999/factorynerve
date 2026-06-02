"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info" | "warning";

type FeedbackBannerProps = {
    tone: Tone;
    message: string;
    onDismiss?: () => void;
    onRetry?: () => void;
    retryLabel?: string;
    autoDismissMs?: number;
    className?: string;
};

const TONE_TOKENS: Record<Tone, { border: string; bg: string; fg: string; dot: string }> = {
    success: {
        border: "border-[var(--status-success-border)]",
        bg: "bg-[var(--status-success-bg)]",
        fg: "text-[var(--status-success-fg)]",
        dot: "bg-[var(--status-success-icon)]",
    },
    error: {
        border: "border-[var(--status-danger-border)]",
        bg: "bg-[var(--status-danger-bg)]",
        fg: "text-[var(--status-danger-fg)]",
        dot: "bg-[var(--status-danger-icon)]",
    },
    info: {
        border: "border-[var(--status-info-border)]",
        bg: "bg-[var(--status-info-bg)]",
        fg: "text-[var(--status-info-fg)]",
        dot: "bg-[var(--status-info-icon)]",
    },
    warning: {
        border: "border-[var(--status-warning-border)]",
        bg: "bg-[var(--status-warning-bg)]",
        fg: "text-[var(--status-warning-fg)]",
        dot: "bg-[var(--status-warning-icon)]",
    },
};

/**
 * FeedbackBanner — unified mutation feedback surface.
 * - Success: green banner, auto-dismiss after 4s by default
 * - Error: red banner, manual dismiss or retry
 * - Info / Warning: persistent until dismissed
 *
 * Use SuccessBanner / ErrorBanner wrappers for the most common cases.
 */
export function FeedbackBanner({
    tone,
    message,
    onDismiss,
    onRetry,
    retryLabel = "Retry",
    autoDismissMs,
    className,
}: FeedbackBannerProps) {
    const tokens = TONE_TOKENS[tone];

    useEffect(() => {
        if (!onDismiss || !autoDismissMs) return;
        const timer = window.setTimeout(onDismiss, autoDismissMs);
        return () => window.clearTimeout(timer);
    }, [autoDismissMs, onDismiss]);

    return (
        <div
            role={tone === "error" ? "alert" : "status"}
            aria-live={tone === "error" ? "assertive" : "polite"}
            className={cn(
                "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 animate-fade-in",
                tokens.border,
                tokens.bg,
                className,
            )}
        >
            <div className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", tokens.dot)} />
                <span className={cn("truncate text-sm font-medium", tokens.fg)}>{message}</span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
                {onRetry ? (
                    <button
                        type="button"
                        onClick={onRetry}
                        className={cn("text-xs font-semibold underline underline-offset-4", tokens.fg)}
                    >
                        {retryLabel}
                    </button>
                ) : null}
                {onDismiss ? (
                    <button
                        type="button"
                        onClick={onDismiss}
                        aria-label="Dismiss"
                        className={cn("text-lg leading-none opacity-70 hover:opacity-100", tokens.fg)}
                    >
                        ×
                    </button>
                ) : null}
            </div>
        </div>
    );
}

export function SuccessBanner({
    message,
    onDismiss,
    autoDismissMs = 4000,
    className,
}: {
    message: string;
    onDismiss?: () => void;
    autoDismissMs?: number;
    className?: string;
}) {
    return (
        <FeedbackBanner
            tone="success"
            message={message}
            onDismiss={onDismiss}
            autoDismissMs={autoDismissMs}
            className={className}
        />
    );
}

export function MutationErrorBanner({
    message,
    onRetry,
    onDismiss,
    retryLabel,
    className,
}: {
    message: string;
    onRetry?: () => void;
    onDismiss?: () => void;
    retryLabel?: string;
    className?: string;
}) {
    return (
        <FeedbackBanner
            tone="error"
            message={message}
            onRetry={onRetry}
            onDismiss={onDismiss}
            retryLabel={retryLabel}
            className={className}
        />
    );
}
