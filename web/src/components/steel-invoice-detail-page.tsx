"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/steel/invoices" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto">Back to Invoices</Button>
              </Link>
              {!user ? (
                <Link href="/login" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto">Open Login</Button>
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
  const dispatchedWeight = Number(detail.dispatch_summary?.dispatched_weight_kg || invoiceLines.reduce((sum, line) => sum + Number(line.dispatched_weight_kg || 0), 0));
  const remainingWeight = Number(detail.dispatch_summary?.remaining_weight_kg || invoiceLines.reduce((sum, line) => sum + Number(line.remaining_weight_kg || 0), 0));
  const fullyDispatchedCount = invoiceLines.filter((line) => Number(line.remaining_weight_kg || 0) <= 0.001).length;
  const dispatchCompletionPercent = detail.invoice.total_weight_kg > 0 ? (dispatchedWeight / detail.invoice.total_weight_kg) * 100 : 0;
  const latestDispatch = linkedDispatches[0] || null;

  return (
    <main className="min-h-screen px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/12 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Steel Invoice</div>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl md:text-4xl">{detail.invoice.invoice_number}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Weight-based invoice detail tied to finished steel items and optional production batches.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
              <Link href="/steel/invoices" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto">Back to Invoices</Button>
              </Link>
              {detail.invoice.customer_id ? (
                <Link href={`/steel/customers/${detail.invoice.customer_id}`} className="w-full sm:w-auto">
                  <Button variant="ghost" className="w-full sm:w-auto">Open Customer</Button>
                </Link>
              ) : null}
              <Link href="/steel/dispatches" className="w-full sm:w-auto">
                <Button variant="ghost" className="w-full sm:w-auto">Open Dispatch</Button>
              </Link>
              <Link href="/steel" className="w-full sm:w-auto">
                <Button variant="ghost" className="w-full sm:w-auto">Back to Steel</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Customer</CardTitle></CardHeader>
            <CardContent className="text-xl font-semibold text-white">{detail.invoice.customer_name}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Invoice Date</CardTitle></CardHeader>
            <CardContent className="text-xl font-semibold text-white">{formatDate(detail.invoice.invoice_date)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Weight</CardTitle></CardHeader>
            <CardContent className="text-xl font-semibold text-white">{formatKg(detail.invoice.total_weight_kg)} KG</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Total</CardTitle></CardHeader>
            <CardContent className="text-xl font-semibold text-white">{formatCurrency(detail.invoice.total_amount)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Due Date</CardTitle></CardHeader>
            <CardContent className="text-xl font-semibold text-white">{formatDate(detail.invoice.due_date)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Dispatch Progress</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <div className="text-xl font-semibold text-white">{formatKg(dispatchedWeight)} KG</div>
              <div className="text-xs text-[var(--muted)]">
                {fullyDispatchedCount}/{invoiceLines.length} lines closed {" - "} {formatKg(remainingWeight)} KG remaining
              </div>
              <div className="text-xs text-[var(--muted)]">
                {detail.dispatch_summary.dispatch_count} dispatches {" - "} {dispatchCompletionPercent.toFixed(1)}% shipped
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
            <CardContent className="space-y-4">
              <div className="space-y-3 md:hidden">
                {invoiceLines.map((line) => (
                  <div key={line.id} className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4 text-sm">
                    <div className="space-y-1">
                      <div className="font-semibold text-white">{line.item_code}</div>
                      <div className="text-xs text-[var(--muted)]">{line.item_name}</div>
                      {line.description ? <div className="text-xs text-[var(--muted)]">{line.description}</div> : null}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Batch</div>
                        <div className="mt-1 text-white">
                          {line.batch_id ? (
                            <Link href={`/steel/batches/${line.batch_id}`} className="text-[var(--accent)] hover:underline">
                              {line.batch_code}
                            </Link>
                          ) : (
                            "No batch link"
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Ordered</div>
                        <div className="mt-1 text-white">{formatKg(line.weight_kg)} KG</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Dispatched</div>
                        <div className="mt-1 text-white">{formatKg(line.dispatched_weight_kg)} KG</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Remaining</div>
                        <div className="mt-1 text-white">{formatKg(line.remaining_weight_kg)} KG</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Rate</div>
                        <div className="mt-1 text-white">{formatCurrency(line.rate_per_kg)}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Total</div>
                        <div className="mt-1 text-white">{formatCurrency(line.line_total)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] md:block">
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
                          {line.description ? <div className="mt-1 text-xs text-[var(--muted)]">{line.description}</div> : null}
                        </td>
                        <td className="px-3 py-3">
                          {line.batch_id ? (
                            <Link href={`/steel/batches/${line.batch_id}`} className="text-[var(--accent)] hover:underline">
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
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Audit Trail</div>
              <CardTitle className="text-xl">Commercial trust and dispatch readiness</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                  <div className="text-[var(--muted)]">Paid / Outstanding</div>
                  <div className="mt-1 font-semibold text-white">
                    {formatCurrency(detail.invoice.paid_amount_inr)} {" / "} {formatCurrency(detail.invoice.outstanding_amount_inr)}
                  </div>
                  <div className="mt-2 text-[var(--muted)]">Terms</div>
                  <div className="mt-1 font-semibold text-white">
                    {detail.invoice.payment_terms_days} day terms {" - "} {detail.invoice.status}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                  <div className="text-[var(--muted)]">Dispatch State</div>
                  <div className="mt-1 font-semibold text-white">
                    {formatKg(dispatchedWeight)} KG dispatched {" - "} {formatKg(remainingWeight)} KG pending
                  </div>
                  <div className="mt-2 text-[var(--muted)]">Next action</div>
                  <div className="mt-1 font-semibold text-white">
                    {remainingWeight > 0.001 ? "Open dispatch for remaining quantity" : "Invoice fully dispatched"}
                  </div>
                  <div className="mt-2 text-xs text-[var(--muted)]">
                    {detail.dispatch_summary.active_count} active dispatches {" - "} {detail.dispatch_summary.delivered_count} delivered {" - "}
                    {detail.dispatch_summary.last_dispatch_date ? ` last truck ${formatDate(detail.dispatch_summary.last_dispatch_date)}` : " no truck recorded yet"}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-[var(--muted)]">Invoice to dispatch chain</div>
                    <div className="mt-1 font-semibold text-white">
                      {linkedDispatches.length ? "Trace every truck linked to this invoice" : "No dispatch linked yet"}
                    </div>
                  </div>
                  {latestDispatch ? (
                    <Link href={`/steel/dispatches/${latestDispatch.id}`} className="w-full sm:w-auto">
                      <Button variant="outline" className="w-full sm:w-auto">Open Latest Dispatch</Button>
                    </Link>
                  ) : (
                    <Link href="/steel/dispatches" className="w-full sm:w-auto">
                      <Button variant="outline" className="w-full sm:w-auto">Open Dispatch Desk</Button>
                    </Link>
                  )}
                </div>
                <div className="mt-3 space-y-3">
                  {linkedDispatches.length ? (
                    linkedDispatches.map((dispatch) => (
                      <div key={dispatch.id} className="rounded-2xl border border-[var(--border)] bg-[rgba(8,14,24,0.6)] p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="font-semibold text-white">{dispatch.dispatch_number}</div>
                            <div className="text-xs text-[var(--muted)]">
                              Gate pass {dispatch.gate_pass_number} {" - "} {formatDate(dispatch.dispatch_date)} {" - "} {dispatch.truck_number}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className={`inline-flex rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${dispatchStatusBadgeClass(dispatch.status)}`}>
                              {dispatch.status}
                            </div>
                            <Link href={`/steel/dispatches/${dispatch.id}`} className="text-xs font-medium text-[var(--accent)] hover:underline">
                              Open
                            </Link>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-[var(--muted)]">
                          {formatKg(dispatch.total_weight_kg)} KG {" - "}
                          {dispatch.delivered_at ? `delivered ${formatDateTime(dispatch.delivered_at)}` : "delivery pending"}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(8,14,24,0.6)] p-3 text-xs text-[var(--muted)]">
                      Dispatch has not started yet. Use this invoice as the source of truth for remaining weight.
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                <div className="text-[var(--muted)]">Created By</div>
                <div className="mt-1 font-semibold text-white">{detail.invoice.created_by_name || "Unknown"}</div>
                <div className="mt-2 text-[var(--muted)]">Created At</div>
                <div className="mt-1 font-semibold text-white">{formatDateTime(detail.invoice.created_at)}</div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                <div className="text-[var(--muted)]">Notes</div>
                <div className="mt-1 text-[var(--text)]">{detail.invoice.notes || "No invoice notes were captured."}</div>
              </div>
              {detail.audit_events.length ? (
                detail.audit_events.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="font-semibold text-white">{event.action}</div>
                      <div className="text-xs text-[var(--muted)]">{formatDateTime(event.timestamp)}</div>
                    </div>
                    <div className="mt-2 text-[var(--muted)]">{event.user_name || "System / background action"}</div>
                    <div className="mt-2 text-[var(--text)]">{event.details || "No extra audit detail."}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-[var(--muted)]">
                  No audit events were linked to this invoice yet.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

      </div>
    </main>
  );
}
