"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import {
  getSteelDispatchDetail,
  type SteelDispatchDetail,
  type SteelDispatchStatus,
  updateSteelDispatchStatus,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";

function formatKg(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
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

function statusBadgeClass(status: SteelDispatchStatus) {
  if (status === "delivered") return "border-emerald-400/35 bg-emerald-500/12 text-emerald-200";
  if (status === "dispatched") return "border-cyan-400/35 bg-cyan-500/12 text-cyan-200";
  if (status === "loaded") return "border-amber-400/35 bg-amber-500/12 text-amber-200";
  if (status === "cancelled") return "border-rose-400/35 bg-rose-500/12 text-rose-200";
  return "border-slate-400/35 bg-slate-500/12 text-slate-200";
}

function timelineTone(completed: boolean) {
  return completed
    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
    : "border-[var(--border)] bg-[var(--card-strong)] text-[var(--muted)]";
}

export function SteelDispatchDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: sessionLoading, error: sessionError } = useSession();
  const [detail, setDetail] = useState<SteelDispatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [podNotes, setPodNotes] = useState("");
  const [entryTime, setEntryTime] = useState("");
  const [exitTime, setExitTime] = useState("");

  const dispatchId = Number(params?.id);
  const canManage = Boolean(user && ["owner", "admin", "manager", "supervisor"].includes(user.role));

  const loadDetail = useCallback(async () => {
    if (!Number.isFinite(dispatchId) || dispatchId <= 0) {
      setError("Invalid steel dispatch ID.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = await getSteelDispatchDetail(dispatchId);
      setDetail(payload);
      setReceiverName(payload.dispatch.receiver_name || "");
      setPodNotes(payload.dispatch.pod_notes || "");
      setEntryTime(payload.dispatch.entry_time ? payload.dispatch.entry_time.slice(0, 16) : "");
      setExitTime(payload.dispatch.exit_time ? payload.dispatch.exit_time.slice(0, 16) : "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load steel dispatch.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [dispatchId]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void loadDetail();
  }, [loadDetail, sessionLoading, user]);

  const updateStatus = async (nextStatus: SteelDispatchStatus) => {
    if (!detail) return;
    setBusy(true);
    setStatus("");
    setError("");
    try {
      await updateSteelDispatchStatus(detail.dispatch.id, {
        status: nextStatus,
        entry_time: entryTime || undefined,
        exit_time: exitTime || undefined,
        receiver_name: receiverName || undefined,
        pod_notes: podNotes || undefined,
      });
      setStatus(`Dispatch moved to ${nextStatus}.`);
      await loadDetail();
    } catch (reason) {
      if (reason instanceof ApiError || reason instanceof Error) {
        setError(reason.message);
      } else {
        setError("Could not update dispatch status.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (sessionLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading steel dispatch detail...
      </main>
    );
  }

  if (!user || !detail) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Steel Dispatch Detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{error || sessionError || "Dispatch not found."}</div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/steel/dispatches" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto">Back to Dispatches</Button>
              </Link>
              {!user ? (
                <Link href="/access" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto">Open Login</Button>
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const dispatchStatus = detail.dispatch.status;
  const canMarkLoaded = canManage && !busy && dispatchStatus === "pending";
  const canMarkDispatched = canManage && !busy && (dispatchStatus === "pending" || dispatchStatus === "loaded");
  const canMarkDelivered = canManage && !busy && (dispatchStatus === "loaded" || dispatchStatus === "dispatched");
  const canCancelDraft = canManage && !busy && !detail.dispatch.inventory_posted_at && (dispatchStatus === "pending" || dispatchStatus === "loaded");
  const invoiceReferenceWeight = (detail.dispatch.lines || []).reduce((sum, line) => sum + Number(line.invoice_line_weight_kg || 0), 0);
  const dispatchCoveragePercent = invoiceReferenceWeight > 0 ? (Number(detail.dispatch.total_weight_kg || 0) / invoiceReferenceWeight) * 100 : 0;
  const movementTimeline = [
    {
      id: "created",
      label: "Dispatch created",
      value: detail.dispatch.created_at,
      detail: detail.dispatch.created_by_name ? `Created by ${detail.dispatch.created_by_name}` : "Created in dispatch desk",
    },
    {
      id: "yard-entry",
      label: "Truck entry",
      value: detail.dispatch.entry_time,
      detail: "Vehicle entered the yard/loading area",
    },
    {
      id: "inventory-posted",
      label: "Inventory posted",
      value: detail.dispatch.inventory_posted_at,
      detail: detail.ledger_movements.length ? `${detail.ledger_movements.length} stock movement(s) recorded` : "Stock movement not posted yet",
    },
    {
      id: "yard-exit",
      label: "Truck exit",
      value: detail.dispatch.exit_time,
      detail: "Truck left the plant gate",
    },
    {
      id: "delivered",
      label: "Delivery confirmed",
      value: detail.dispatch.delivered_at,
      detail: detail.dispatch.delivered_by_name ? `Closed by ${detail.dispatch.delivered_by_name}` : "Customer receipt pending",
    },
  ];

  return (
    <main className="min-h-screen px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {status ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/12 px-4 py-3 text-sm text-emerald-100">
            {status}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/12 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Steel Dispatch</div>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl md:text-4xl">{detail.dispatch.dispatch_number}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Gate pass, truck manifest, status progression, and the ledger movements tied to this dispatch.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
              <div className={`inline-flex rounded-full border px-4 py-2 text-xs uppercase tracking-[0.18em] ${statusBadgeClass(detail.dispatch.status)}`}>
                {detail.dispatch.status}
              </div>
              <Link href="/steel/dispatches" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto">Back to Dispatches</Button>
              </Link>
              <Link href={`/steel/invoices/${detail.dispatch.invoice_id}`} className="w-full sm:w-auto">
                <Button variant="ghost" className="w-full sm:w-auto">Open Invoice</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Gate Pass</CardTitle></CardHeader>
            <CardContent className="text-xl font-semibold text-white">{detail.dispatch.gate_pass_number}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Dispatch Date</CardTitle></CardHeader>
            <CardContent className="text-xl font-semibold text-white">{formatDate(detail.dispatch.dispatch_date)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Truck</CardTitle></CardHeader>
            <CardContent className="text-xl font-semibold text-white">{detail.dispatch.truck_number}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Total Weight</CardTitle></CardHeader>
            <CardContent className="text-xl font-semibold text-white">{formatKg(detail.dispatch.total_weight_kg)} KG</CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Dispatch Manifest</div>
              <CardTitle className="text-xl">Material list and logistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                  <div className="text-[var(--muted)]">Invoice</div>
                  <div className="mt-1 font-semibold text-white">{detail.dispatch.invoice_number}</div>
                  <div className="mt-2 text-[var(--muted)]">Customer</div>
                  <div className="mt-1 font-semibold text-white">{detail.dispatch.customer_name || "-"}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                  <div className="text-[var(--muted)]">Transporter</div>
                  <div className="mt-1 font-semibold text-white">{detail.dispatch.transporter_name || "Not recorded"}</div>
                  <div className="mt-2 text-[var(--muted)]">Vehicle</div>
                  <div className="mt-1 font-semibold text-white">{detail.dispatch.vehicle_type || "Not recorded"}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                  <div className="text-[var(--muted)]">Driver</div>
                  <div className="mt-1 font-semibold text-white">{detail.dispatch.driver_name}</div>
                  <div className="mt-2 text-[var(--muted)]">Phone / License</div>
                  <div className="mt-1 font-semibold text-white">{detail.dispatch.driver_phone || "-"} / {detail.dispatch.driver_license_number || "-"}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                  <div className="text-[var(--muted)]">Entry / Exit</div>
                  <div className="mt-1 font-semibold text-white">{formatDateTime(detail.dispatch.entry_time)} / {formatDateTime(detail.dispatch.exit_time)}</div>
                  <div className="mt-2 text-[var(--muted)]">Truck Capacity</div>
                  <div className="mt-1 font-semibold text-white">{detail.dispatch.truck_capacity_kg ? `${formatKg(detail.dispatch.truck_capacity_kg)} KG` : "Not recorded"}</div>
                </div>
              </div>
              <div className="space-y-3 md:hidden">
                {(detail.dispatch.lines || []).map((line) => (
                  <div key={line.id} className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4 text-sm">
                    <div className="space-y-1">
                      <div className="font-semibold text-white">{line.item_code}</div>
                      <div className="text-xs text-[var(--muted)]">{line.item_name}</div>
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
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Dispatched</div>
                        <div className="mt-1 text-white">{formatKg(line.weight_kg)} KG</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Invoice Line</div>
                        <div className="mt-1 text-white">{formatKg(line.invoice_line_weight_kg)} KG</div>
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
                      <th className="px-3 py-3 font-medium">Dispatched</th>
                      <th className="px-3 py-3 font-medium">Invoice Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.dispatch.lines || []).map((line) => (
                      <tr key={line.id} className="border-b border-[var(--border)]/60 last:border-none">
                        <td className="px-3 py-3">
                          <div className="font-semibold text-white">{line.item_code}</div>
                          <div className="text-xs text-[var(--muted)]">{line.item_name}</div>
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
                        <td className="px-3 py-3">{formatKg(line.invoice_line_weight_kg)} KG</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Status + Audit</div>
              <CardTitle className="text-xl">Dispatch control panel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                <div className="text-[var(--muted)]">Created By</div>
                <div className="mt-1 font-semibold text-white">{detail.dispatch.created_by_name || "Unknown"}</div>
                <div className="mt-2 text-[var(--muted)]">Created At</div>
                <div className="mt-1 font-semibold text-white">{formatDateTime(detail.dispatch.created_at)}</div>
                <div className="mt-2 text-[var(--muted)]">Inventory Posted</div>
                <div className="mt-1 font-semibold text-white">{formatDateTime(detail.dispatch.inventory_posted_at)}</div>
                <div className="mt-2 text-[var(--muted)]">Delivered</div>
                <div className="mt-1 font-semibold text-white">{formatDateTime(detail.dispatch.delivered_at)} {detail.dispatch.delivered_by_name ? `by ${detail.dispatch.delivered_by_name}` : ""}</div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                <div className="text-sm font-semibold text-white">Movement timeline</div>
                <div className="mt-3 space-y-3">
                  {movementTimeline.map((entry, index) => {
                    const completed = Boolean(entry.value);
                    return (
                      <div key={entry.id} className={`rounded-2xl border p-3 text-sm ${timelineTone(completed)}`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="font-semibold text-white">
                              {index + 1}. {entry.label}
                            </div>
                            <div className="mt-1 text-xs">{entry.detail}</div>
                          </div>
                          <div className="text-right text-xs">
                            {completed ? formatDateTime(entry.value) : "Waiting"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                <div className="text-[var(--muted)]">Weight consistency</div>
                <div className="mt-1 font-semibold text-white">
                  {formatKg(detail.dispatch.total_weight_kg)} KG on this truck - {formatKg(invoiceReferenceWeight)} KG linked to invoice lines
                </div>
                <div className="mt-2 text-[var(--muted)]">Dispatch coverage</div>
                <div className="mt-1 font-semibold text-white">
                  {dispatchCoveragePercent.toFixed(1)}% of the linked invoice-line quantity
                </div>
                <div className="mt-2 text-xs text-[var(--muted)]">
                  Use this check to confirm the truck load, invoice allocation, and posted inventory are telling the same story.
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                <div className="text-sm font-semibold text-white">Progress dispatch</div>
                <div className="text-xs text-[var(--muted)]">
                  Drafts can move to loaded, then dispatched, then delivered. Cancel is available only before inventory is posted.
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-[var(--muted)]">Entry Time</label>
                    <Input type="datetime-local" value={entryTime} onChange={(event) => setEntryTime(event.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Exit Time</label>
                    <Input type="datetime-local" value={exitTime} onChange={(event) => setExitTime(event.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Receiver Name</label>
                  <Input value={receiverName} onChange={(event) => setReceiverName(event.target.value)} placeholder="Person receiving the dispatch" />
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">POD Notes</label>
                  <Textarea value={podNotes} onChange={(event) => setPodNotes(event.target.value)} placeholder="Delivery note / proof details" />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button variant="outline" className="w-full sm:w-auto" disabled={!canMarkLoaded} onClick={() => void updateStatus("loaded")}>
                    Mark Loaded
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto" disabled={!canMarkDispatched} onClick={() => void updateStatus("dispatched")}>
                    Mark Dispatched
                  </Button>
                  <Button className="w-full sm:w-auto" disabled={!canMarkDelivered} onClick={() => void updateStatus("delivered")}>
                    Mark Delivered
                  </Button>
                  <Button variant="ghost" className="w-full sm:w-auto" disabled={!canCancelDraft} onClick={() => void updateStatus("cancelled")}>
                    Cancel Draft
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                <div className="text-[var(--muted)]">Dispatch Notes</div>
                <div className="mt-1 text-[var(--text)]">{detail.dispatch.notes || "No notes were captured for this dispatch."}</div>
                <div className="mt-3 text-[var(--muted)]">Receiver / POD</div>
                <div className="mt-1 text-[var(--text)]">{detail.dispatch.receiver_name || "Receiver not recorded"} - {detail.dispatch.pod_notes || "No POD notes yet."}</div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                <div className="text-sm font-semibold text-white">Ledger movements</div>
                <div className="mt-3 space-y-3">
                  {detail.ledger_movements.map((movement) => (
                    <div key={movement.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3 text-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="font-semibold text-white">{movement.transaction_type}</div>
                        <div className="text-xs text-[var(--muted)]">{formatDateTime(movement.created_at)}</div>
                      </div>
                      <div className="mt-2 text-[var(--muted)]">{movement.item_code} - {formatKg(movement.quantity_kg)} KG</div>
                    </div>
                  ))}
                  {!detail.ledger_movements.length ? (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3 text-sm text-[var(--muted)]">
                      No inventory movement yet.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                <div className="text-sm font-semibold text-white">Audit events</div>
                <div className="mt-3 space-y-3">
                  {detail.audit_events.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3 text-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="font-semibold text-white">{event.action}</div>
                        <div className="text-xs text-[var(--muted)]">{formatDateTime(event.timestamp)}</div>
                      </div>
                      <div className="mt-2 text-[var(--muted)]">{event.user_name || "System / background action"}</div>
                      <div className="mt-2 text-[var(--text)]">{event.details || "No extra audit detail."}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

      </div>
    </main>
  );
}
