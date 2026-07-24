"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Star, Clock, Check } from "lucide-react";
import {
  type NotificationItem,
  fetchUnreadNotificationCount,
  fetchUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 30000;

function BellIcon({ className }: { className?: string }) {
  return <Bell className={className} strokeWidth={1.7} />;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}


type NotificationBellProps = {
  /** Optional class name for the trigger button. */
  className?: string;
};

export function NotificationBell({ className }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // ── Fetch unread count on an interval ──
  const refreshCount = useCallback(async () => {
    const count = await fetchUnreadNotificationCount();
    setUnreadCount(count);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshCount();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refreshCount]);

  // ── Open: fetch full list ──
  const handleOpen = useCallback(async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    const items = await fetchUnreadNotifications();
    setNotifications(items);
    setLoading(false);
  }, [open]);

  // ── Position the panel inside the viewport ──
  // The trigger can live in the left sidebar or the top bar, so a plain
  // `right-0` dropdown overflows off-screen. Anchor a fixed-position panel to
  // the trigger and clamp it to the viewport (with a gutter) instead.
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gutter = 8;
    const width = Math.min(window.innerWidth - gutter * 2, 448); // 28rem cap
    // Prefer right-aligning the panel to the trigger, then clamp.
    let left = rect.right - width;
    left = Math.min(Math.max(left, gutter), window.innerWidth - width - gutter);
    const top = rect.bottom + gutter;
    setPanelPos({ top, left, width });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  // ── Close on outside click ──
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  // ── Mark single as read ──
  const handleMarkRead = useCallback(
    async (id: number) => {
      await markNotificationRead(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    },
    [],
  );

  // ── Mark all as read ──
  const handleMarkAllRead = useCallback(async () => {
    setMarkingAll(true);
    try {
await markAllNotificationsRead();
      setNotifications([]);
      setUnreadCount(0);
    } catch {
      // Silently fail — user can retry
    } finally {
      setMarkingAll(false);
    }
  }, []);

  const displayCount = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={handleOpen}
        className={cn(
          "ui-no-select ui-no-callout relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition",
          open
            ? "border-[rgba(197,109,45,0.34)] bg-[rgba(197,109,45,0.14)]"
            : "border-[var(--border)] bg-[rgba(8,12,20,0.62)] hover:border-[rgba(197,109,45,0.28)] hover:bg-[rgba(20,24,36,0.85)]",
        )}
      >
        <BellIcon className="h-[18px] w-[18px] text-[var(--text)]" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-[0_2px_6px_rgba(244,63,94,0.4)]">
            {displayCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          style={
            panelPos
              ? { top: panelPos.top, left: panelPos.left, width: panelPos.width }
              : undefined
          }
          className={cn(
            "fixed z-50 max-h-[calc(100vh-5rem)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[rgba(14,18,28,0.98)] shadow-[0_24px_64px_rgba(3,8,20,0.45)] backdrop-blur-xl",
            !panelPos && "invisible",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div className="text-sm font-semibold text-[var(--text)]">
              Notifications
              {unreadCount > 0 ? (
                <span className="ml-2 text-[11px] font-medium text-[var(--muted)]">
                  ({unreadCount} unread)
                </span>
              ) : null}
            </div>
            {notifications.length > 0 ? (
              <button
                type="button"
                disabled={markingAll}
                onClick={handleMarkAllRead}
                className="ui-no-select ui-no-callout rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-label text-[var(--accent)] transition hover:bg-[rgba(197,109,45,0.1)] disabled:opacity-50"
              >
                {markingAll ? "Marking..." : "Mark all read"}
              </button>
            ) : null}
          </div>

          {/* Body */}
          <div className="max-h-[24rem] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center px-4 py-10">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <BellIcon className="h-8 w-8 text-[var(--muted)] opacity-40" />
                <div className="mt-3 text-sm font-medium text-[var(--muted)]">No notifications</div>
                <div className="mt-1 text-xs text-[var(--muted)] opacity-60">
                  You&apos;re all caught up!
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {notifications.map((notification) => {
                  const isApprovalBypass = notification.notification_type === "approval_bypass";

                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        "group relative flex gap-3 px-4 py-3.5 transition hover:bg-[rgba(197,109,45,0.04)]",
                      )}
                    >
                      {/* Icon */}
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.08)]">
                        {isApprovalBypass ? (
                          <Star className="h-4 w-4 text-amber-300" strokeWidth={1.6} />
                        ) : (
                          <Clock className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.6} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-semibold text-[var(--text)] leading-snug">
                            {notification.title}
                          </div>
                          <button
                            type="button"
                            aria-label="Mark as read"
                            title="Mark as read"
                            onClick={() => void handleMarkRead(notification.id)}
                            className="ui-no-select ui-no-callout mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted)] opacity-0 transition hover:bg-[rgba(197,109,45,0.1)] hover:text-[var(--accent)] group-hover:opacity-100 focus-visible:opacity-100"
                          >
                            <Check className="h-3.5 w-3.5" strokeWidth={1.6} />
                          </button>
                        </div>
                        {notification.body ? (
                          <div className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                            {notification.body}
                          </div>
                        ) : null}
                        <div className="mt-1.5 text-[10px] font-medium uppercase tracking-label text-[var(--muted)] opacity-60">
                          {formatTimestamp(notification.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--border)] px-4 py-2.5">
            <div className="text-[10px] text-center text-[var(--muted)] opacity-50">
              Auto-refreshes every 30s
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
