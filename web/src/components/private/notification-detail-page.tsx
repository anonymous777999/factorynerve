"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Star, Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchNotificationById,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/notifications";
import { useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";
import { signalWorkflowRefresh } from "@/lib/workflow-sync";

function formatFullDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelative(value: string | null | undefined): string {
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
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function parseMetadata(
  metadataJson: string | null,
): Record<string, unknown> | null {
  if (!metadataJson) return null;
  try {
    return JSON.parse(metadataJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[rgba(8,12,20,0.45)] px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-label text-[var(--muted)]">
        {label}
      </span>
      <span className="text-right text-sm font-medium text-[var(--text)] break-all">
        {children}
      </span>
    </div>
  );
}

function RawJsonBlock({ data }: { data: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[rgba(3,8,20,0.7)] p-4 text-xs leading-6 text-[var(--muted)] font-mono whitespace-pre-wrap">
      {(() => {
        try {
          return JSON.stringify(JSON.parse(data), null, 2);
        } catch {
          return data;
        }
      })()}
    </pre>
  );
}

export default function NotificationDetailPage() {
  const params = useParams();
  const notificationId = Number(params.id);
  const { user, loading: sessionLoading } = useSession();

  const [notification, setNotification] = useState<NotificationItem | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [marking, setMarking] = useState(false);

  const loadNotification = useCallback(async () => {
    if (!user || !notificationId) return;
    if (Number.isNaN(notificationId)) {
      setError("Invalid notification ID.");
      setPageLoading(false);
      return;
    }
    setError("");
    setPageLoading(true);
    try {
      const result = await fetchNotificationById(notificationId);
      setNotification(result);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Could not load notification.");
      }
    } finally {
      setPageLoading(false);
    }
  }, [user, notificationId]);

  useEffect(() => {
    if (!user) {
      const timer = window.setTimeout(() => setPageLoading(false), 0);
      return () => window.clearTimeout(timer);
    }
    const fetchData = async () => {
      await loadNotification();
    };
    fetchData();
  }, [loadNotification, user]);

  const handleMarkRead = useCallback(async () => {
    if (!notification || marking) return;
    setMarking(true);
    try {
      await markNotificationRead(notification.id);
      setNotification((prev) => (prev ? { ...prev, is_read: true } : prev));
      signalWorkflowRefresh("notifications");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("dpr:rail-counts-refresh"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark as read.");
    } finally {
      setMarking(false);
    }
  }, [notification, marking]);

  const metadata = notification ? parseMetadata(notification.metadata_json) : null;

  // Loading
  if (sessionLoading || (pageLoading && !notification)) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Skeleton className="h-14 w-48 rounded-2xl" />
          <Skeleton className="h-64 rounded-[2rem]" />
          <Skeleton className="h-48 rounded-[2rem]" />
        </div>
      </main>
    );
  }

  // Unauthenticated
  if (!user) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <div className="text-sm uppercase tracking-prominent text-[var(--accent)]">Notification</div>
              <CardTitle>Sign in to view notification</CardTitle>
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

  // Error / not found
  if (error && !notification) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center gap-3">
            <Link
              href="/notifications"
              className="ui-no-select ui-no-callout inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[rgba(8,12,20,0.62)] text-base font-semibold text-[var(--text)] transition hover:border-[rgba(197,109,45,0.35)]"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
            </Link>
          </div>
          <Card>
            <CardHeader>
              <div className="text-sm uppercase tracking-prominent text-[var(--accent)]">
                {notificationId ? `Notification #${notificationId}` : "Notification"}
              </div>
              <CardTitle>Not found</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-[var(--muted)]">
                {error || "This notification could not be found or you don't have access to it."}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/notifications">
                  <Button>Back to notifications</Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline">Dashboard</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!notification) return null;

  const notificationType =
    notification.notification_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* ── Back nav ── */}
        <nav className="flex items-center gap-3">
          <Link
            href="/notifications"
            className="ui-no-select ui-no-callout inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[rgba(8,12,20,0.62)] text-base font-semibold text-[var(--text)] transition hover:border-[rgba(197,109,45,0.35)]"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
          </Link>
          <Link
            href="/notifications"
            className="text-sm font-medium text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            Notifications
          </Link>
          <span className="text-xs text-[var(--muted)] opacity-50">/</span>
          <span className="text-sm font-semibold text-[var(--text)]">
            #{notification.id}
          </span>
        </nav>

        {/* ── Main card ── */}
        <section
          className={cn(
            "rounded-[2rem] border p-6 shadow-2xl backdrop-blur md:p-8",
            notification.is_read
              ? "border-[var(--border)] bg-[rgba(20,24,36,0.88)]"
              : "border-[rgba(197,109,45,0.18)] bg-[rgba(197,109,45,0.06)]",
          )}
        >
          {/* Header row */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              {/* Type icon */}
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border",
                  notification.notification_type === "approval_bypass"
                    ? "border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.08)]"
                    : "border-[var(--border)] bg-[rgba(8,12,20,0.62)]",
                )}
              >
                {notification.notification_type === "approval_bypass" ? (
                  <Star className="h-6 w-6 text-amber-300" strokeWidth={1.6} />
                ) : (
                  <Bell className="h-6 w-6 text-[var(--accent)]" strokeWidth={1.6} />
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[var(--border)] bg-[rgba(0,0,0,0.2)] px-3 py-0.5 text-[11px] font-semibold uppercase tracking-label">
                    {notificationType}
                  </span>
                  {!notification.is_read ? (
                    <span className="inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
                  ) : (
                    <span className="text-[11px] font-medium text-[var(--muted)]">Read</span>
                  )}
                </div>
                <h1 className="mt-3 text-2xl font-semibold text-[var(--text)] md:text-3xl">
                  {notification.title}
                </h1>
              </div>
            </div>

            {!notification.is_read ? (
              <Button
                onClick={() => void handleMarkRead()}
                disabled={marking}
                className="shrink-0"
              >
                {marking ? "Marking..." : "Mark as read"}
              </Button>
            ) : null}
          </div>

          {/* Body */}
          {notification.body ? (
            <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[rgba(8,12,20,0.35)] px-5 py-5">
              <div className="text-sm leading-7 text-[var(--text)] whitespace-pre-line">
                {notification.body}
              </div>
            </div>
          ) : null}
        </section>

        {/* ── Metadata card ── */}
        <section className="rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur md:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-header text-[var(--muted)]">
            Details
          </h2>
          <div className="mt-5 space-y-2">
            <MetaRow label="ID">#{notification.id}</MetaRow>
            <MetaRow label="Type">{notificationType}</MetaRow>
            <MetaRow label="Status">
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-label",
                  notification.is_read
                    ? "bg-[rgba(34,197,94,0.12)] text-emerald-100"
                    : "bg-[rgba(197,109,45,0.12)] text-[var(--accent)]",
                )}
              >
                {notification.is_read ? "Read" : "Unread"}
              </span>
            </MetaRow>
            <MetaRow label="Created">
              <div className="flex flex-col items-end gap-0.5">
                <span>{formatFullDateTime(notification.created_at)}</span>
                <span className="text-xs text-[var(--muted)]">
                  {formatRelative(notification.created_at)}
                </span>
              </div>
            </MetaRow>
            {notification.org_id ? (
              <MetaRow label="Org ID">{notification.org_id}</MetaRow>
            ) : null}
          </div>
        </section>

        {/* ── Metadata JSON ── */}
        {notification.metadata_json ? (
          <section className="rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur md:p-8">
            <h2 className="text-sm font-semibold uppercase tracking-header text-[var(--muted)]">
              Metadata
            </h2>

            {metadata ? (
              <div className="mt-5 space-y-2">
                {Object.entries(metadata).map(([key, value]) => (
                  <MetaRow key={key} label={key}>
                    {typeof value === "boolean" ? (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-label",
                          value
                            ? "bg-[rgba(34,197,94,0.12)] text-emerald-100"
                            : "bg-[rgba(239,68,68,0.12)] text-red-100",
                        )}
                      >
                        {String(value)}
                      </span>
                    ) : (
                      String(value)
                    )}
                  </MetaRow>
                ))}
              </div>
            ) : null}

            <div className="mt-5">
              <RawJsonBlock data={notification.metadata_json} />
            </div>
          </section>
        ) : null}

        {/* ── Actions ── */}
        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[rgba(20,24,36,0.88)] px-6 py-4 shadow-2xl backdrop-blur">
          <Link href="/notifications">
            <Button variant="outline">
              <ChevronLeft className="mr-2 h-4 w-4" strokeWidth={1.8} />
              Back to notifications
            </Button>
          </Link>
          {!notification.is_read ? (
            <Button onClick={() => void handleMarkRead()} disabled={marking}>
              {marking ? "Marking..." : "Mark as read"}
            </Button>
          ) : null}
        </section>
      </div>
    </main>
  );
}
