"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

type Notification = {
    id: string;
    message: string;
    type: "success" | "error" | "info";
};

type OcrNotificationDropdownProps = {
    notifications: Notification[];
    onDismiss?: (id: string) => void;
};

export function OcrNotificationDropdown({
    notifications,
    onDismiss,
}: OcrNotificationDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        function handleEsc(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleEsc);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
                document.removeEventListener("keydown", handleEsc);
            };
        }
    }, [isOpen]);

    const hasNotifications = notifications.length > 0;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                    hasNotifications
                        ? "border-action-primary/30 bg-action-primary/10 text-action-primary hover:bg-action-primary/20"
                        : "border-border-subtle bg-surface-shell text-text-secondary hover:bg-surface-container"
                )}
                aria-label="Notifications"
                aria-expanded={isOpen}
            >
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path
                        d="M8 2C6.34315 2 5 3.34315 5 5V7.58579L3.70711 8.87868C3.31658 9.26921 3.31658 9.90237 3.70711 10.2929C4.09763 10.6834 4.73079 10.6834 5.12132 10.2929L6 9.41421V5C6 3.89543 6.89543 3 8 3C9.10457 3 10 3.89543 10 5V9.41421L10.8787 10.2929C11.2692 10.6834 11.9024 10.6834 12.2929 10.2929C12.6834 9.90237 12.6834 9.26921 12.2929 8.87868L11 7.58579V5C11 3.34315 9.65685 2 8 2Z"
                        fill="currentColor"
                    />
                    <path
                        d="M6.5 12C6.5 11.4477 6.94772 11 7.5 11H8.5C9.05228 11 9.5 11.4477 9.5 12C9.5 12.8284 8.82843 13.5 8 13.5C7.17157 13.5 6.5 12.8284 6.5 12Z"
                        fill="currentColor"
                    />
                </svg>
                {hasNotifications && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-action-primary text-[10px] font-semibold text-white">
                        {notifications.length}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-10 z-50 w-80 rounded-md border border-border-subtle bg-surface-shell shadow-lg">
                    <div className="border-b border-border-subtle px-3 py-2">
                        <div className="text-sm font-semibold text-text-primary">Notifications</div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {hasNotifications ? (
                            <div className="divide-y divide-border-subtle">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={cn(
                                            "px-3 py-3 text-sm",
                                            notification.type === "success" && "bg-success/5",
                                            notification.type === "error" && "bg-error/5"
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                                <div
                                                    className={cn(
                                                        "font-medium",
                                                        notification.type === "success" && "text-success",
                                                        notification.type === "error" && "text-error",
                                                        notification.type === "info" && "text-text-primary"
                                                    )}
                                                >
                                                    {notification.message}
                                                </div>
                                            </div>
                                            {onDismiss && (
                                                <button
                                                    type="button"
                                                    onClick={() => onDismiss(notification.id)}
                                                    className="text-text-secondary hover:text-text-primary"
                                                    aria-label="Dismiss"
                                                >
                                                    <svg
                                                        width="14"
                                                        height="14"
                                                        viewBox="0 0 14 14"
                                                        fill="none"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        aria-hidden="true"
                                                        focusable="false"
                                                    >
                                                        <path
                                                            d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5"
                                                            stroke="currentColor"
                                                            strokeWidth="1.5"
                                                            strokeLinecap="round"
                                                        />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="px-3 py-8 text-center text-sm text-text-secondary">
                                No notifications
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
