"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
  type NotificationListParams,
} from "@/lib/notifications";
import { useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";
import { signalWorkflowRefresh } from "@/lib/workflow-sync";

type TabKey = "all" | "unread" | "read";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "read", label: "Read" },
];

const PAGE_SIZE = 20;
const NOTIFICATION_TYPES = [
  { value: "", label: "All types" },
  { value: "approval_bypass", label: "Approval Bypasses" },
  { value: "system", label: "System" },
];

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const now = new Date();
  const diffMs = now.getTime() - parsed.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function NotificationIcon({ type }: { type: string }) {
  if (type === "approval_bypass") {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.08)]">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className="h-[18px] w-[18px] text-amber-300"
        >
          <path
            d="M10 3.8 11.8 7.7l4 .6-2.9 2.9.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.9 4-.6L10 3.8Z"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[rgba(8,12,20,0.62)]">
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="h-[18px] w-[18px] text-sky-300"
      >
        <path
          d="M10 3.4a5.2 5.2 0 0 0-5.2 5.2v1.4c0 .5-.2 1.1-.5 1.5l-.8 1c-.6.8-.2 2.1.8 2.1h11.4c1 0 1.4-1.3.8-2.1l-.8-1c-.3-.4-.5-1-.5-1.5V8.6A5.2 5.2 0 0 0 10 3.4Z"
          strokeLinejoin="round"
        />
        <path d="M7.7 15.2a2.3 2.3 0 0 0 4.6 0" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function EmptyState({
  tab,
  notificationType,
}: {
  tab: TabKey;
  notificationType: string;
}) {
  const messages: Record<TabKey, { title: string; body: string }> = {
    all: {
      title: "No notifications",
      body: notificationType
        ? "No notifications match the selected type filter."
        : "You don't have any notifications yet.",
    },
    unread: {
      title: "All caught up!",
      body: "No unread notifications. Come back later for updates.",
    },
    read: {
      title: "No read notifications",
      body: "Marked notifications will appear here.",
    },
  };
  const msg = messages[tab];

  return (
    <Card className="border-dashed border-[var(--border)] bg-[var(--card-strong)]">
      <CardContent className="flex min-h-[12rem] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          className="h-10 w-10 text-[var(--muted)] opacity-30"
        >
          <path
            d="M10 3.4a5.2 5.2 0 0 0-5.2 5.2v1.4c0 .5-.2 1.1-.5 1.5l-.8 1c-.6.8-.2 2.1.8 2.1h11.4c1 0 1.4-1.3.8-2.1l-.8-1c-.3-.4-.5-1-.5-1.5V8.6A5.2 5.2 0 0 0 10 3.4Z"
            strokeLinejoin="round"
          />
          <path d="M7.7 15.2a2.3 2.3 0 0 0 4.6 0" strokeLinecap="round" />
        </svg>
        <div className="text-xl font-semibold text-[var(--text)]">{msg.title}</div>
        <div className="max-w-md text-sm leading-6 text-[var(--muted)]">{msg.body}</div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard">
            <Button>Open Dashboard</Button>
          </Link>
          <Link href="/work-queue">
            <Button variant="outline">Open Work Queue</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function PaginationBar({
  page,
  totalPages,
  totalItems,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[rgba(20,24,36,0.88)] px-4 py-3">
      <div className="text-xs text-[var(--muted)]">
        {totalItems} notification{totalItems !== 1 ? "s" : ""}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="ui-no-select ui-no-callout inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[rgba(8,12,20,0.62)] text-xs font-semibold text-[var(--text)] transition hover:border-[rgba(62,166,255,0.28)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <path d="m12 5.8-4.2 4.2 4.2 4.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-[var(--muted)]">
              ...
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "ui-no-select ui-no-callout inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition",
                p === page
                  ? "border border-[rgba(62,166,255,0.34)] bg-[rgba(62,166,255,0.14)] text-[var(--text)]"
                  : "border border-[var(--border)] bg-[rgba(8,12,20,0.62)] text-[var(--muted)] hover:border-[rgba(62,166,255,0.28)] hover:text-[var(--text)]",
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="ui-no-select ui-no-callout inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[rgba(8,12,20,0.62)] text-xs font-semibold text-[var(--text)] transition hover:border-[rgba(62,166,255,0.28)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <path d="m8 5.8 4.2 4.2-4.2 4.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { user, loading: sessionLoading } = useSession();

  // ── State ──
  const [activeTab, setActiveTab] = useState<TabKey>("unread");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingIds, setMarkingIds] = useState<Record<number, boolean>>({});
  const [markingAll, setMarkingAll] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Derived query params from active tab ──
  const listParams = useMemo((): NotificationListParams => {
    const params: NotificationListParams = {
      page,
      page_size: PAGE_SIZE,
    };
    if (typeFilter) params.notification_type = typeFilter;
    if (activeTab === "unread") params.is_read = false;
    else if (activeTab === "read") params.is_read = true;
    // "all": no is_read filter
    return params;
  }, [page, typeFilter, activeTab]);

  // ── Fetch ──
  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setError("");
    setPageLoading(true);
    try {
      const result = await fetchNotifications(listParams);
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notifications.");
      setItems([]);
      setTotal(0);
    } finally {
      setPageLoading(false);
    }
  }, [user, listParams]);

  useEffect(() => {
    if (!user) {
      const timer = window.setTimeout(() => setPageLoading(false), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => void loadNotifications(), 0);
    return () => window.clearTimeout(timer);
  }, [loadNotifications, user]);

  // Tab/type change handlers that reset to page 1 (avoids double-fetch from separate useEffect)
  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    setPage(1);
  }, []);

  const handleTypeFilterChange = useCallback((type: string) => {
    setTypeFilter(type);
    setPage(1);
  }, []);

  // ── Mark as read ──
  const handleMarkRead = useCallback(
    async (id: number) => {
      if (markingIds[id]) return;
      setMarkingIds((prev) => ({ ...prev, [id]: true }));
      try {
        await markNotificationRead(id);
        // Remove from list if on unread tab, otherwise keep
        if (activeTab === "unread") {
          setItems((prev) => prev.filter((n) => n.id !== id));
          setTotal((prev) => Math.max(0, prev - 1));
        } else {
          setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
        }
        signalWorkflowRefresh("notifications");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("dpr:rail-counts-refresh"));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not mark as read.");
      } finally {
        setMarkingIds((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [markingIds, activeTab],
  );

  // ── Mark all as read ──
  const handleMarkAllRead = useCallback(async () => {
    setMarkingAll(true);
    try {
      const result = await markAllNotificationsRead();
      if (result.count > 0) {
        if (activeTab === "unread") {
          setItems([]);
          setTotal(0);
        } else {
          setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
        }
        signalWorkflowRefresh("notifications");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("dpr:rail-counts-refresh"));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark all as read.");
    } finally {
      setMarkingAll(false);
    }
  }, [activeTab]);

  // ── Loading state ──
  if (sessionLoading || (pageLoading && Boolean(user) && page === 1)) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <Skeleton className="h-40 rounded-[2rem]" />
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ── Unauthenticated ──
  if (!user) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <div className="text-sm uppercase tracking-prominent text-[var(--accent)]">Notifications</div>
              <CardTitle>Sign in to view notifications</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link href="/access">
                <Button>Open Access</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* ── Header ── */}
        <section className="rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-prominent text-[var(--accent)]">Notifications</div>
              <h1 className="mt-2 text-3xl font-semibold">Activity &amp; alerts</h1>
              <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
                Review system notifications, approval updates, and activity alerts.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {items.some((n) => !n.is_read) ? (
                <Button
                  variant="outline"
                  className="px-4 py-2 text-xs"
                  onClick={() => void handleMarkAllRead()}
                  disabled={markingAll}
                >
                  {markingAll ? "Marking..." : "Mark all read"}
                </Button>
              ) : null}
              <Button variant="outline" className="px-4 py-2 text-xs" onClick={() => void loadNotifications()}>
                Refresh
              </Button>
            </div>
          </div>
        </section>

        {/* ── Tabs + Filter ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[rgba(8,12,20,0.62)] p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleTabChange(tab.key)}
                className={cn(
                  "ui-no-select ui-no-callout rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-label transition",
                  activeTab === tab.key
                    ? "bg-[rgba(62,166,255,0.14)] text-[var(--text)]"
                    : "text-[var(--muted)] hover:text-[var(--text)]",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={typeFilter}
            onChange={(e) => handleTypeFilterChange(e.target.value)}
            className="h-9 rounded-xl border border-[var(--border)] bg-[rgba(8,12,20,0.62)] px-3 text-xs font-medium text-[var(--text)] outline-none transition focus:border-[rgba(62,166,255,0.34)]"
            aria-label="Filter by type"
          >
            {NOTIFICATION_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* ── Error ── */}
        {error ? (
          <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {/* ── Empty state ── */}
        {!pageLoading && items.length === 0 ? (
          <EmptyState tab={activeTab} notificationType={typeFilter} />
        ) : null}

        {/* ── List ── */}
        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((notification) => (
              <Link
                key={notification.id}
                href={`/notifications/${notification.id}`}
                className={cn(
                  "group relative flex gap-4 rounded-2xl border p-5 transition hover:bg-[rgba(62,166,255,0.04)]",
                  notification.is_read
                    ? "border-[var(--border)] bg-[rgba(20,24,36,0.6)]"
                    : "border-[rgba(62,166,255,0.18)] bg-[rgba(62,166,255,0.06)]",
                )}
              >
                <NotificationIcon type={notification.notification_type} />

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[var(--border)] bg-[rgba(0,0,0,0.2)] px-3 py-0.5 text-[11px] font-semibold uppercase tracking-label">
                      {notification.notification_type.replace("_", " ")}
                    </span>
                    {!notification.is_read ? (
                      <span className="inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
                    ) : null}
                    <span className="text-xs text-[var(--muted)]">
                      {formatDateTime(notification.created_at)}
                    </span>
                  </div>
                  <div className="text-base font-semibold text-[var(--text)]">{notification.title}</div>
                  {notification.body ? (
                    <div className="text-sm leading-6 text-[var(--muted)] line-clamp-2">
                      {notification.body}
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-col items-center justify-center gap-1">
                  {!notification.is_read ? (
                    <button
                      type="button"
                      aria-label="Mark as read"
                      title="Mark as read"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleMarkRead(notification.id);
                      }}
                      disabled={markingIds[notification.id]}
                      className="ui-no-select ui-no-callout inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[rgba(8,12,20,0.62)] text-[var(--muted)] transition hover:border-[rgba(62,166,255,0.28)] hover:text-[var(--accent)] disabled:opacity-50"
                    >
                      {markingIds[notification.id] ? (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
                      ) : (
                        <svg
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          className="h-4 w-4"
                        >
                          <path d="m6 10 2.5 2.5 5.5-5.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  ) : null}
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    className="h-4 w-4 text-[var(--muted)] opacity-0 transition group-hover:opacity-60"
                  >
                    <path d="m8.5 6 3.5 4-3.5 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        ) : null}

        {/* ── Loading shimmer for page transitions ── */}
        {pageLoading && items.length > 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={`loading-${i}`} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : null}

        {/* ── Pagination ── */}
        <PaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={total}
          onPageChange={setPage}
        />
      </div>
    </main>
  );
}
