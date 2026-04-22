"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { getSteelInvoiceDetail, type SteelInvoiceDetail } from "@/lib/steel";
import { useSession } from "@/lib/use-session";

function formatKg(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
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

function dispatchStatusBadgeClass(status: string | null | undefined) {
  if (status === "delivered") return "border-emerald-400/35 bg-emerald-500/12 text-emerald-200";
  if (status === "dispatched") return "border-cyan-400/35 bg-cyan-500/12 text-cyan-200";
  if (status === "loaded") return "border-amber-400/35 bg-amber-500/12 text-amber-200";
  if (status === "cancelled") return "border-rose-400/35 bg-rose-500/12 text-rose-200";
  return "border-slate-400/35 bg-slate-500/12 text-slate-200";
}

export function SteelInvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: sessionLoading, error: sessionError } = useSession();
  const [detail, setDetail] = useState<SteelInvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const invoiceId = Number(params?.id);

  const loadDetail = useCallback(async () => {
    if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
      setError("Invalid steel invoice ID.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = await getSteelInvoiceDetail(invoiceId);
      setDetail(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load steel invoice.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void loadDetail();
  }, [loadDetail, sessionLoading, user]);

  if (sessionLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading steel invoice detail...
      </main>
    );
  }

  if (!user || !detail) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Steel Invoice Detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{error || sessionError || "Invoice not found."}</div>
            <div className="flex gap-3">
              <Link href="/steel/invoices">
                <Button variant="outline">Back to Invoices</Button>
              </Link>
              {!user ? (
                <Link href="/access">
                  <Button>Open Access</Button>
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const invoiceLines = detail.invoice.lines || [];
  const linkedDispatches = detail.dispatches || [];
  const dispatchedWeight = Number(
    detail.dispatch_summary?.dispatched_weight_kg ||
      invoiceLines.reduce((sum, line) => sum + Number(line.dispatched_weight_kg || 0), 0),
  );
  const remainingWeight = Number(
    detail.dispatch_summary?.remaining_weight_kg ||
      invoiceLines.reduce((sum, line) => sum + Number(line.remaining_weight_kg || 0), 0),
  );
  const fullyDispatchedCount = invoiceLines.filter(
    (line) => Number(line.remaining_weight_kg || 0) <= 0.001,
  ).length;
  const dispatchCompletionPercent =
    detail.invoice.total_weight_kg > 0
      ? (dispatchedWeight / detail.invoice.total_weight_kg) * 100
      : 0;
  const latestDispatch = linkedDispatches[0] || null;
  const hasRemainingDispatch = remainingWeight > 0.001;
  const nextDispatchHref = latestDispatch ? `/steel/dispatches/${latestDispatch.id}` : "/steel/dispatches";
  const nextDispatchLabel = hasRemainingDispatch
    ? latestDispatch
      ? "Continue dispatch"
      : "Start dispatch"
    : latestDispatch
      ? "View dispatch"
      : "Dispatch complete";
  const nextDispatchCopy = hasRemainingDispatch
    ? `${formatKg(remainingWeight)} KG is still waiting for a truck assignment.`
    : "All invoice weight is already tied to completed dispatch activity.";

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Steel Invoice</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{detail.invoice.invoice_number}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Check dispatch progress, open the next truck action, and keep the commercial record aligned with steel movement.
              </p>
            </div>
            {/* AUDIT: BUTTON_CLUTTER - move route jumps into a secondary tools tray so the dispatch handoff stays primary. */}
            <details className="group w-full min-w-0 rounded-3xl border border-[var(--border)] bg-[rgba(10,16,26,0.72)] sm:w-auto sm:min-w-[220px]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                Invoice tools
                <span className="text-xs text-[var(--muted)] transition group-open:hidden">Open</span>
                <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
              </summary>
              <div className="flex flex-wrap gap-3 border-t border-[var(--border)] px-4 py-4">
                <Link href="/steel/invoices">
                  <Button variant="outline">Invoices</Button>
                </Link>
                {detail.invoice.customer_id ? (
                  <Link href={`/steel/customers/${detail.invoice.customer_id}`}>
                    <Button variant="ghost">Customer</Button>
                  </Link>
                ) : null}
                <Link href="/steel/dispatches">
                  <Button variant="ghost">Dispatches</Button>
                </Link>
                <Link href="/steel">
                  <Button variant="ghost">Steel hub</Button>
                </Link>
              </div>
            </details>
          </div>
        </section>

        {/* AUDIT: FLOW_BROKEN - add a short next-step sequence so the invoice detail leads directly into dispatch follow-through. */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader className="space-y-2">
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">1. Check progress</div>
              <CardTitle className="text-lg">See what is already shipped</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Track ordered weight, active trucks, and the quantity that is still waiting to move.
            </CardContent>
          </Card>
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader className="space-y-2">
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">2. Open next truck</div>
              <CardTitle className="text-lg">Keep dispatch moving</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">{nextDispatchCopy}</CardContent>
          </Card>
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader className="space-y-2">
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">3. Review trust</div>
              <CardTitle className="text-lg">Confirm cash and audit state</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Commercial status, notes, and invoice events stay available once the dispatch path is clear.
            </CardContent>
          </Card>
        </section>

        {/* AUDIT: FLOW_BROKEN - feature the next dispatch action before supporting audit context so the page has a clear operational handoff. */}
        <section className="grid gap-4 lg:grid-cols-[1.18fr_0.82fr]">
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Next move</div>
              <CardTitle className="text-xl">
                {hasRemainingDispatch ? "Dispatch the remaining weight" : "Invoice dispatch is complete"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1 text-sm text-[var(--muted)]">
                <div>{nextDispatchCopy}</div>
                <div>
                  {detail.dispatch_summary.active_count} active dispatches | {detail.dispatch_summary.delivered_count} delivered
                </div>
              </div>
              {latestDispatch || hasRemainingDispatch ? (
                <Link href={nextDispatchHref}>
                  <Button>{nextDispatchLabel}</Button>
                </Link>
              ) : (
                <Button disabled>Dispatch complete</Button>
              )}
            </CardContent>
          </Card>
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Commercial state</div>
              <CardTitle className="text-xl">Cash and terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="text-[var(--muted)]">Paid / Outstanding</div>
              <div className="text-lg font-semibold text-white">
                {formatCurrency(detail.invoice.paid_amount_inr)} / {formatCurrency(detail.invoice.outstanding_amount_inr)}
              </div>
              <div className="text-[var(--muted)]">Terms</div>
              <div className="font-semibold text-white">
                {detail.invoice.payment_terms_days} day terms | {detail.invoice.status}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold text-white">{detail.invoice.customer_name}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice Date</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold text-white">{formatDate(detail.invoice.invoice_date)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weight</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold text-white">{formatKg(detail.invoice.total_weight_kg)} KG</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Total</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold text-white">{formatCurrency(detail.invoice.total_amount)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Due Date</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold text-white">{formatDate(detail.invoice.due_date)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dispatch Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-xl font-semibold text-white">{formatKg(dispatchedWeight)} KG</div>
              <div className="text-xs text-[var(--muted)]">
                {fullyDispatchedCount}/{invoiceLines.length} lines closed | {formatKg(remainingWeight)} KG remaining
              </div>
              <div className="text-xs text-[var(--muted)]">
                {detail.dispatch_summary.dispatch_count} dispatches | {dispatchCompletionPercent.toFixed(1)}% shipped
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Invoice Lines</div>
              <CardTitle className="text-xl">Weight x rate with dispatch progress</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveScrollArea
                className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                debugLabel="steel-invoice-detail-lines"
              >
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[var(--muted)]">
                    <tr className="border-b border-[var(--border)]">
                      <th className="px-3 py-3 font-medium">Item</th>
                      <th className="px-3 py-3 font-medium">Batch</th>
                      <th className="px-3 py-3 font-medium">Ordered</th>
                      <th className="px-3 py-3 font-medium">Dispatched</th>
                      <th className="px-3 py-3 font-medium">Remaining</th>
                      <th className="px-3 py-3 font-medium">Rate</th>
                      <th className="px-3 py-3 font-medium">Total</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceLines.map((line) => (
                      <tr key={line.id} className="border-b border-[var(--border)]/60 last:border-none">
                        <td className="px-3 py-3">
                          <div className="font-semibold text-white">{line.item_code}</div>
                          <div className="text-xs text-[var(--muted)]">{line.item_name}</div>
                          {line.description ? (
                            <div className="mt-1 text-xs text-[var(--muted)]">{line.description}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          {line.batch_id ? (
                            <Link
                              href={`/steel/batches/${line.batch_id}`}
                              className="text-[var(--accent)] hover:underline"
                            >
                              {line.batch_code}
                            </Link>
                          ) : (
                            <span className="text-[var(--muted)]">No batch link</span>
                          )}
                        </td>
                        <td className="px-3 py-3">{formatKg(line.weight_kg)} KG</td>
                        <td className="px-3 py-3">{formatKg(line.dispatched_weight_kg)} KG</td>
                        <td className="px-3 py-3">{formatKg(line.remaining_weight_kg)} KG</td>
                        <td className="px-3 py-3">{formatCurrency(line.rate_per_kg)}</td>
                        <td className="px-3 py-3">{formatCurrency(line.line_total)}</td>
                        <td className="px-3 py-3">
                          {Number(line.remaining_weight_kg || 0) <= 0.001 ? (
                            <span className="inline-flex rounded-full border border-emerald-400/35 bg-emerald-500/12 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-200">
                              Dispatched
                            </span>
                          ) : Number(line.dispatched_weight_kg || 0) > 0 ? (
                            <span className="inline-flex rounded-full border border-amber-400/35 bg-amber-500/12 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-200">
                              Partial
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-slate-400/35 bg-slate-500/12 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-200">
                              Open
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Audit Trail</div>
              <CardTitle className="text-xl">Dispatch and audit context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                <div className="text-[var(--muted)]">Created By</div>
                <div className="mt-1 font-semibold text-white">{detail.invoice.created_by_name || "Unknown"}</div>
                <div className="mt-2 text-[var(--muted)]">Created At</div>
                <div className="mt-1 font-semibold text-white">{formatDateTime(detail.invoice.created_at)}</div>
                <div className="mt-2 text-[var(--muted)]">Last truck</div>
                <div className="mt-1 font-semibold text-white">
                  {detail.dispatch_summary.last_dispatch_date
                    ? formatDate(detail.dispatch_summary.last_dispatch_date)
                    : "Not recorded"}
                </div>
              </div>
              {/* AUDIT: DENSITY_OVERLOAD - keep the truck chain available in a reveal so the current dispatch handoff stays easier to scan. */}
              <details className="group rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                  Dispatch chain
                  <span className="text-xs text-[var(--muted)] transition group-open:hidden">
                    {linkedDispatches.length || 0} trucks
                  </span>
                  <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
                </summary>
                <div className="space-y-3 border-t border-[var(--border)] px-4 py-4">
                  {linkedDispatches.length ? (
                    linkedDispatches.map((dispatch) => (
                      <div key={dispatch.id} className="rounded-2xl border border-[var(--border)] bg-[rgba(8,14,24,0.6)] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-white">{dispatch.dispatch_number}</div>
                            <div className="text-xs text-[var(--muted)]">
                              Gate pass {dispatch.gate_pass_number} | {formatDate(dispatch.dispatch_date)} | {dispatch.truck_number}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div
                              className={`inline-flex rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${dispatchStatusBadgeClass(dispatch.status)}`}
                            >
                              {dispatch.status}
                            </div>
                            <Link
                              href={`/steel/dispatches/${dispatch.id}`}
                              className="text-xs font-medium text-[var(--accent)] hover:underline"
                            >
                              Open
                            </Link>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-[var(--muted)]">
                          {formatKg(dispatch.total_weight_kg)} KG |{" "}
                          {dispatch.delivered_at
                            ? `delivered ${formatDateTime(dispatch.delivered_at)}`
                            : "delivery pending"}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(8,14,24,0.6)] p-3 text-xs text-[var(--muted)]">
                      Dispatch has not started yet. Use this invoice as the source of truth for remaining weight.
                    </div>
                  )}
                </div>
              </details>
              {/* AUDIT: BUTTON_CLUTTER - keep invoice notes and audit history available in reveals instead of making them compete with the next dispatch action. */}
              <details className="group rounded-2xl border border-[var(--border)] bg-[var(--card-strong)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                  Invoice notes
                  <span className="text-xs text-[var(--muted)] transition group-open:hidden">Open</span>
                  <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
                </summary>
                <div className="border-t border-[var(--border)] px-4 py-4 text-[var(--text)]">
                  {detail.invoice.notes || "No invoice notes were captured."}
                </div>
              </details>
              <details className="group rounded-2xl border border-[var(--border)] bg-[var(--card-strong)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                  Audit events
                  <span className="text-xs text-[var(--muted)] transition group-open:hidden">
                    {detail.audit_events.length || 0} items
                  </span>
                  <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
                </summary>
                <div className="space-y-3 border-t border-[var(--border)] px-4 py-4">
                  {detail.audit_events.length ? (
                    detail.audit_events.map((event) => (
                      <div key={event.id} className="rounded-2xl border border-[var(--border)] bg-[rgba(8,14,24,0.6)] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold text-white">{event.action}</div>
                          <div className="text-xs text-[var(--muted)]">{formatDateTime(event.timestamp)}</div>
                        </div>
                        <div className="mt-2 text-[var(--muted)]">
                          {event.user_name || "System / background action"}
                        </div>
                        <div className="mt-2 text-[var(--text)]">
                          {event.details || "No extra audit detail."}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(8,14,24,0.6)] p-4 text-[var(--muted)]">
                      No audit events were linked to this invoice yet.
                    </div>
                  )}
                </div>
              </details>
            </CardContent>
          </Card>
        </section>

        {error ? <div className="text-sm text-red-400">{error}</div> : null}
      </div>
    </main>
  );
}
