"use client";

import { useState, useMemo } from "react";

interface RawDataViewProps {
    data: unknown;
    title?: string;
}

const MAX_DISPLAY_SIZE = 500000; // 500KB limit for display

/**
 * Raw JSON view for OCR debugging
 * Shows exact OCR payload for support/debugging purposes
 * Includes performance safeguards for large payloads
 */
export function RawDataView({ data, title = "Raw OCR Data" }: RawDataViewProps) {
    const [collapsed, setCollapsed] = useState(false);

    // Memoize stringified data to prevent re-stringification on every render
    const { stringified, isTruncated, fullSize } = useMemo(() => {
        const full = JSON.stringify(data, null, 2);
        const size = full.length;

        if (size > MAX_DISPLAY_SIZE) {
            const truncated = full.slice(0, MAX_DISPLAY_SIZE) + "\n\n... [TRUNCATED FOR PERFORMANCE]";
            return { stringified: truncated, isTruncated: true, fullSize: size };
        }

        return { stringified: full, isTruncated: false, fullSize: size };
    }, [data]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
            alert("Raw data copied to clipboard");
        } catch (error) {
            console.error("Failed to copy:", error);
        }
    };

    const handleDownload = () => {
        try {
            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ocr-raw-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to download:", error);
        }
    };

    return (
        <div className="rounded-[28px] border border-border-subtle bg-white p-6 shadow-[0_18px_54px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
                    <p className="mt-1 text-sm text-text-secondary">
                        Exact OCR payload for debugging and support
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setCollapsed(!collapsed)}
                        className="rounded-full border border-[#d9e1e8] bg-white px-3 py-1.5 text-sm text-text-primary transition hover:bg-surface-shell"
                    >
                        {collapsed ? "Expand" : "Collapse"}
                    </button>
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="rounded-full border border-[#d9e1e8] bg-white px-3 py-1.5 text-sm text-text-primary transition hover:bg-surface-shell"
                    >
                        Copy
                    </button>
                    <button
                        type="button"
                        onClick={handleDownload}
                        className="rounded-full border border-[#d9e1e8] bg-white px-3 py-1.5 text-sm text-text-primary transition hover:bg-surface-shell"
                    >
                        Download
                    </button>
                </div>
            </div>

            {!collapsed && (
                <>
                    {isTruncated && (
                        <div className="mb-3 rounded-panel border border-status-warning-border bg-status-warning-bg p-3 text-sm text-status-warning-fg">
                            Large payload detected ({Math.round(fullSize / 1024)}KB).
                            Showing first {Math.round(MAX_DISPLAY_SIZE / 1024)}KB only.
                            Use Download button to get the full data.
                        </div>
                    )}
                    <div className="overflow-auto rounded-panel border border-border-default bg-surface-app p-4 max-h-[600px]">
                        <pre className="text-xs text-text-primary font-mono leading-relaxed">
                            {stringified}
                        </pre>
                    </div>
                </>
            )}
        </div>
    );
}
