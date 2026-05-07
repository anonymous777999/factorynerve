"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children: ReactNode;
    fallbackMessage?: string;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error boundary for OCR components
 * Prevents white-screen crashes and shows user-friendly fallback
 */
export class OcrErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("OCR component error:", error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="rounded-[28px] border-2 border-red-200 bg-red-50 p-6">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 text-4xl">⚠️</div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-red-900">
                                Display Error
                            </h3>
                            <p className="mt-2 text-sm text-red-800">
                                {this.props.fallbackMessage ||
                                    "This content could not be displayed. The data is safe, but the renderer encountered an error."}
                            </p>
                            {this.state.error && (
                                <details className="mt-3">
                                    <summary className="cursor-pointer text-xs font-medium text-red-700">
                                        Technical details
                                    </summary>
                                    <pre className="mt-2 overflow-auto rounded-lg bg-red-900 p-3 text-xs text-red-50">
                                        {this.state.error.message}
                                        {"\n"}
                                        {this.state.error.stack}
                                    </pre>
                                </details>
                            )}
                            <button
                                type="button"
                                className="mt-4 rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-900 transition hover:bg-red-50"
                                onClick={() => {
                                    this.setState({ hasError: false, error: null });
                                    window.location.reload();
                                }}
                            >
                                Reload page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
