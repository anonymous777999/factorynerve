"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type BillingEvent = {
  id: number;
  org_id: string | null;
  razorpay_event_id: string | null;
  provider: string | null;
  event_id: string | null;
  event_type: string | null;
  status: string | null;
  outcome: string | null;
  duration_ms: number | null;
  received_at: string | null;
};

type BillingSubscription = {
  org_id: string;
  user_id: number | null;
  plan: string;
  status: string;
  grace_period_end: string | null;
  current_period_end: string | null;
  updated_at: string | null;
};

export default function AdminBillingPage() {
  const { user } = useSession();
  const [eventsTab, setEventsTab] = useState(true);
  const [subscriptionsTab, setSubscriptionsTab] = useState(false);
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [subscriptions, setSubscriptions] = useState<BillingSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(false);
  const [error, setError] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("past_due");

  const loadEvents = useCallback(async (eventType?: string) => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (eventType) query.set("event_type", eventType);
      const qs = query.toString();
      const data = await apiFetch<BillingEvent[]>(`/admin/billing/events${qs ? `?${qs}` : ""}`);
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load billing events.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSubscriptions = useCallback(async (status?: string) => {
    setSubLoading(true);
    setError("");
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : "";
      const data = await apiFetch<BillingSubscription[]>(`/admin/billing/subscriptions${query}`);
      setSubscriptions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load subscriptions.");
    } finally {
      setSubLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents().catch(() => setLoading(false));
  }, [loadEvents]);

  const handleSwitchToEvents = () => {
    setEventsTab(true);
    setSubscriptionsTab(false);
    loadEvents(eventTypeFilter || undefined).catch(() => undefined);
  };

  const handleSwitchToSubscriptions = () => {
    setEventsTab(false);
    setSubscriptionsTab(true);
    loadSubscriptions(statusFilter).catch(() => undefined);
  };

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex flex-wrap items-start justify-between gap-4 rounded-[2rem] border border-[var(--border)] bg-[rgba(20,24,36,0.88)] p-6 shadow-2xl backdrop-blur">
          <div>
            <div className="text-sm uppercase tracking-prominent text-amber-200">Superadmin</div>
            <h1 className="mt-2 text-3xl font-semibold">Billing Admin</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Review billing events, manage subscriptions, and audit webhook activity across all organizations.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant={eventsTab ? "primary" : "outline"}
                className="px-4 py-2 text-xs"
                onClick={handleSwitchToEvents}
              >
                Billing Events
              </Button>
              <Button
                variant={subscriptionsTab ? "primary" : "outline"}
                className="px-4 py-2 text-xs"
                onClick={handleSwitchToSubscriptions}
              >
                Subscriptions
              </Button>
            </div>
          </div>
          <div className="rounded-full border border-amber-400/30 bg-[rgba(245,158,11,0.12)] px-4 py-2 text-xs font-semibold uppercase tracking-label text-amber-100">
            {user?.role || "unknown"}
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-400/30 bg-[rgba(239,68,68,0.12)] px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {eventsTab ? (
          <>
            <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-5 py-4">
              <div className="text-sm text-[var(--muted)]">Filter by event type:</div>
              <Input
                className="mt-0 h-10 w-60"
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                placeholder="e.g. payment.captured"
              />
              <Button
                variant="outline"
                className="px-4 py-2 text-xs"
                onClick={() => loadEvents(eventTypeFilter || undefined)}
                disabled={loading}
              >
                {loading ? "Loading..." : "Apply Filter"}
              </Button>
              <Button
                variant="ghost"
                className="px-4 py-2 text-xs"
                onClick={() => {
                  setEventTypeFilter("");
                  loadEvents();
                }}
                disabled={loading}
              >
                Clear
              </Button>
              <span className="text-xs text-[var(--muted)]">{events.length} events</span>
            </section>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-2xl" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <Card className="border-dashed border-[var(--border)] bg-[var(--card-strong)]">
                <CardContent className="flex min-h-[8rem] flex-col items-center justify-center px-6 py-8 text-center">
                  <div className="text-sm uppercase tracking-prominent text-[var(--accent)]">No Events</div>
                  <div className="mt-2 text-lg font-semibold text-[var(--text)]">No billing events found</div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    Try a different filter or check back later.
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[var(--accent-soft)] bg-[rgba(56,189,248,0.12)] px-3 py-0.5 text-[11px] font-semibold uppercase tracking-label text-[var(--accent)]">
                            {event.event_type || "unknown"}
                          </span>
                          <span
                            className={`rounded-full border px-3 py-0.5 text-[11px] font-semibold uppercase tracking-label ${
                              event.status === "success"
                                ? "border-emerald-400/30 bg-[rgba(34,197,94,0.12)] text-emerald-100"
                                : event.status === "failed"
                                  ? "border-red-400/30 bg-[rgba(239,68,68,0.12)] text-red-100"
                                  : "border-amber-400/30 bg-[rgba(245,158,11,0.12)] text-amber-100"
                            }`}
                          >
                            {event.status || "unknown"}
                          </span>
                        </div>
                        <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <span className="text-[11px] font-semibold uppercase tracking-label text-[var(--muted)]">
                              Org
                            </span>
                            <div className="mt-0.5 text-[var(--text)]">{event.org_id || "-"}</div>
                          </div>
                          <div>
                            <span className="text-[11px] font-semibold uppercase tracking-label text-[var(--muted)]">
                              Outcome
                            </span>
                            <div className="mt-0.5 text-[var(--text)]">{event.outcome || "-"}</div>
                          </div>
                          <div>
                            <span className="text-[11px] font-semibold uppercase tracking-label text-[var(--muted)]">
                              Duration
                            </span>
                            <div className="mt-0.5 text-[var(--text)]">
                              {event.duration_ms != null ? `${event.duration_ms}ms` : "-"}
                            </div>
                          </div>
                          <div>
                            <span className="text-[11px] font-semibold uppercase tracking-label text-[var(--muted)]">
                              Received
                            </span>
                            <div className="mt-0.5 text-[var(--text)]">
                              {event.received_at
                                ? new Date(event.received_at).toLocaleString("en-IN")
                                : "-"}
                            </div>
                          </div>
                        </div>
                        <div className="grid gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <span className="text-[11px] font-semibold uppercase tracking-label text-[var(--muted)]">
                              Provider
                            </span>
                            <div className="mt-0.5 text-[var(--text)]">{event.provider || "-"}</div>
                          </div>
                          <div>
                            <span className="text-[11px] font-semibold uppercase tracking-label text-[var(--muted)]">
                              Event ID
                            </span>
                            <div className="mt-0.5 overflow-safe-text text-[var(--text)]">
                              {event.event_id || "-"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}

        {subscriptionsTab ? (
          <>
            <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-5 py-4">
              <div className="text-sm text-[var(--muted)]">Filter by status:</div>
              <Select
                className="mt-0 h-10 w-48"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="past_due">Past Due</option>
                <option value="active">Active</option>
                <option value="trialing">Trialing</option>
                <option value="cancelled">Cancelled</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </Select>
              <Button
                variant="outline"
                className="px-4 py-2 text-xs"
                onClick={() => loadSubscriptions(statusFilter)}
                disabled={subLoading}
              >
                {subLoading ? "Loading..." : "Filter"}
              </Button>
            </section>

            {subLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-2xl" />
                ))}
              </div>
            ) : subscriptions.length === 0 ? (
              <Card className="border-dashed border-[var(--border)] bg-[var(--card-strong)]">
                <CardContent className="flex min-h-[8rem] flex-col items-center justify-center px-6 py-8 text-center">
                  <div className="text-sm uppercase tracking-prominent text-[var(--accent)]">No Subscriptions</div>
                  <div className="mt-2 text-lg font-semibold text-[var(--text)]">
                    No subscriptions match the status filter
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    Try a different status filter.
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {subscriptions.map((sub) => (
                  <div
                    key={sub.org_id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[var(--accent-soft)] bg-[rgba(197,109,45,0.12)] px-3 py-0.5 text-[11px] font-semibold uppercase tracking-label text-[var(--accent)]">
                            {sub.plan}
                          </span>
                          <span
                            className={`rounded-full border px-3 py-0.5 text-[11px] font-semibold uppercase tracking-label ${
                              sub.status === "active"
                                ? "border-emerald-400/30 bg-[rgba(34,197,94,0.12)] text-emerald-100"
                                : sub.status === "past_due"
                                  ? "border-red-400/30 bg-[rgba(239,68,68,0.12)] text-red-100"
                                  : sub.status === "trialing"
                                    ? "border-[var(--accent-soft)] bg-[rgba(56,189,248,0.12)] text-[var(--accent)]"
                                    : "border-amber-400/30 bg-[rgba(245,158,11,0.12)] text-amber-100"
                            }`}
                          >
                            {sub.status}
                          </span>
                        </div>
                        <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <span className="text-[11px] font-semibold uppercase tracking-label text-[var(--muted)]">
                              Org ID
                            </span>
                            <div className="mt-0.5 overflow-safe-text text-[var(--text)]">{sub.org_id}</div>
                          </div>
                          <div>
                            <span className="text-[11px] font-semibold uppercase tracking-label text-[var(--muted)]">
                              User ID
                            </span>
                            <div className="mt-0.5 text-[var(--text)]">{sub.user_id ?? "-"}</div>
                          </div>
                          <div>
                            <span className="text-[11px] font-semibold uppercase tracking-label text-[var(--muted)]">
                              Period End
                            </span>
                            <div className="mt-0.5 text-[var(--text)]">
                              {sub.current_period_end
                                ? new Date(sub.current_period_end).toLocaleString("en-IN")
                                : "-"}
                            </div>
                          </div>
                          <div>
                            <span className="text-[11px] font-semibold uppercase tracking-label text-[var(--muted)]">
                              Grace End
                            </span>
                            <div className="mt-0.5 text-[var(--text)]">
                              {sub.grace_period_end
                                ? new Date(sub.grace_period_end).toLocaleString("en-IN")
                                : "-"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}
