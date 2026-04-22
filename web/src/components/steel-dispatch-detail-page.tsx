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
  const canManage = Boolean(
    user && ["owner", "admin", "manager", "supervisor"].includes(user.role),
  );

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
            <div className="flex gap-3">
              <Link href="/steel/dispatches">
                <Button variant="outline">Back to Dispatches</Button>
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

  const dispatchStatus = detail.dispatch.status;
  const canMarkLoaded = canManage && !busy && dispatchStatus === "pending";
  const canMarkDispatched =
    canManage && !busy && (dispatchStatus === "pending" || dispatchStatus === "loaded");
  const canMarkDelivered =
    canManage && !busy && (dispatchStatus === "loaded" || dispatchStatus === "dispatched");
  const canCancelDraft =
    canManage &&
    !busy &&
    !detail.dispatch.inventory_posted_at &&
    (dispatchStatus === "pending" || dispatchStatus === "loaded");
  const invoiceReferenceWeight = (detail.dispatch.lines || []).reduce(
    (sum, line) => sum + Number(line.invoice_line_weight_kg || 0),
    0,
  );
  const dispatchCoveragePercent =
    invoiceReferenceWeight > 0
      ? (Number(detail.dispatch.total_weight_kg || 0) / invoiceReferenceWeight) * 100
      : 0;
  const movementTimeline = [
    {
      id: "created",
      label: "Dispatch created",
      value: detail.dispatch.created_at,
      detail: detail.dispatch.created_by_name
        ? `Created by ${detail.dispatch.created_by_name}`
        : "Created in dispatch desk",
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
      detail: detail.ledger_movements.length
        ? `${detail.ledger_movements.length} stock movement(s) recorded`
        : "Stock movement not posted yet",
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
      detail: detail.dispatch.delivered_by_name
        ? `Closed by ${detail.dispatch.delivered_by_name}`
        : "Customer receipt pending",
    },
  ];
  const nextAction = canMarkLoaded
    ? {
        label: "Mark loaded",
        status: "loaded" as SteelDispatchStatus,
        title: "Confirm loading",
        description: "Use this when the truck has been loaded and the gate process can continue.",
      }
    : canMarkDispatched
      ? {
          label: "Mark dispatched",
          status: "dispatched" as SteelDispatchStatus,
          title: "Release the truck",
          description: "Confirm the truck has left the plant and the dispatch is in transit.",
        }
      : canMarkDelivered
        ? {
            label: "Mark delivered",
            status: "delivered" as SteelDispatchStatus,
            title: "Close delivery",
            description: "Capture the receiver details and close the dispatch once the customer accepts it.",
          }
        : null;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Steel Dispatch</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">{detail.dispatch.dispatch_number}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Check the manifest, move the truck to its next valid status, and keep inventory posting aligned with delivery proof.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div
                className={`inline-flex rounded-full border px-4 py-2 text-xs uppercase tracking-[0.18em] ${statusBadgeClass(detail.dispatch.status)}`}
              >
                {detail.dispatch.status}
              </div>
              {/* AUDIT: BUTTON_CLUTTER - move cross-route links into a secondary tools tray so dispatch progression stays primary. */}
              <details className="group min-w-[220px] rounded-3xl border border-[var(--border)] bg-[rgba(10,16,26,0.72)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                  Dispatch tools
                  <span className="text-xs text-[var(--muted)] transition group-open:hidden">Open</span>
                  <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
                </summary>
                <div className="flex flex-wrap gap-3 border-t border-[var(--border)] px-4 py-4">
                  <Link href="/steel/dispatches">
                    <Button variant="outline">Dispatches</Button>
                  </Link>
                  <Link href={`/steel/invoices/${detail.dispatch.invoice_id}`}>
                    <Button variant="ghost">Invoice</Button>
                  </Link>
                  <Link href="/steel">
                    <Button variant="ghost">Steel hub</Button>
                  </Link>
                </div>
              </details>
            </div>
          </div>
        </section>

        {/* AUDIT: FLOW_BROKEN - add a short progression strip so the dispatch screen clearly points from manifest to closure. */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader className="space-y-2">
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">1. Check manifest</div>
              <CardTitle className="text-lg">Confirm truck and load</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Validate the truck, driver, and invoice-linked material before changing dispatch state.
            </CardContent>
          </Card>
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader className="space-y-2">
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">2. Move status</div>
              <CardTitle className="text-lg">{nextAction ? nextAction.title : "Dispatch is up to date"}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              {nextAction
                ? nextAction.description
                : "No further progression is available right now. Review notes, ledger movements, or the audit trail instead."}
            </CardContent>
          </Card>
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader className="space-y-2">
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">3. Review evidence</div>
              <CardTitle className="text-lg">Check ledger and proof</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Timeline, receiver notes, inventory movements, and audit events remain available once the next move is recorded.
            </CardContent>
          </Card>
        </section>

        {/* AUDIT: FLOW_BROKEN - surface the next valid status change before lower-signal audit context so the page has one obvious action. */}
        <section className="grid gap-4 lg:grid-cols-[1.12fr_0.88fr]">
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Next move</div>
              <CardTitle className="text-xl">
                {nextAction ? nextAction.title : "No new dispatch action required"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-[var(--muted)]">
                {nextAction
                  ? nextAction.description
                  : "This dispatch is already at its furthest valid state. Use the evidence panels below for review only."}
              </div>
              {nextAction ? (
                <Button disabled={busy} onClick={() => void updateStatus(nextAction.status)}>
                  {nextAction.label}
                </Button>
              ) : (
                <Button disabled>Status complete</Button>
              )}
            </CardContent>
          </Card>
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Weight check</div>
              <CardTitle className="text-xl">Invoice coverage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="text-[var(--muted)]">Truck vs invoice</div>
              <div className="font-semibold text-white">
                {formatKg(detail.dispatch.total_weight_kg)} KG on truck | {formatKg(invoiceReferenceWeight)} KG linked
              </div>
              <div className="text-[var(--muted)]">Dispatch coverage</div>
              <div className="font-semibold text-white">
                {dispatchCoveragePercent.toFixed(1)}% of the linked invoice-line quantity
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gate Pass</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold text-white">{detail.dispatch.gate_pass_number}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dispatch Date</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold text-white">{formatDate(detail.dispatch.dispatch_date)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Truck</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold text-white">{detail.dispatch.truck_number}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Total Weight</CardTitle>
            </CardHeader>
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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                  <div className="text-[var(--muted)]">Invoice</div>
                  <div className="mt-1 font-semibold text-white">{detail.dispatch.invoice_number}</div>
                  <div className="mt-2 text-[var(--muted)]">Customer</div>
                  <div className="mt-1 font-semibold text-white">{detail.dispatch.customer_name || "-"}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                  <div className="text-[var(--muted)]">Transporter</div>
                  <div className="mt-1 font-semibold text-white">
                    {detail.dispatch.transporter_name || "Not recorded"}
                  </div>
                  <div className="mt-2 text-[var(--muted)]">Vehicle</div>
                  <div className="mt-1 font-semibold text-white">
                    {detail.dispatch.vehicle_type || "Not recorded"}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                  <div className="text-[var(--muted)]">Driver</div>
                  <div className="mt-1 font-semibold text-white">{detail.dispatch.driver_name}</div>
                  <div className="mt-2 text-[var(--muted)]">Phone / License</div>
                  <div className="mt-1 font-semibold text-white">
                    {detail.dispatch.driver_phone || "-"} / {detail.dispatch.driver_license_number || "-"}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                  <div className="text-[var(--muted)]">Entry / Exit</div>
                  <div className="mt-1 font-semibold text-white">
                    {formatDateTime(detail.dispatch.entry_time)} / {formatDateTime(detail.dispatch.exit_time)}
                  </div>
                  <div className="mt-2 text-[var(--muted)]">Truck Capacity</div>
                  <div className="mt-1 font-semibold text-white">
                    {detail.dispatch.truck_capacity_kg
                      ? `${formatKg(detail.dispatch.truck_capacity_kg)} KG`
                      : "Not recorded"}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]">
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
                <div className="mt-1 font-semibold text-white">
                  {detail.dispatch.created_by_name || "Unknown"}
                </div>
                <div className="mt-2 text-[var(--muted)]">Created At</div>
                <div className="mt-1 font-semibold text-white">{formatDateTime(detail.dispatch.created_at)}</div>
                <div className="mt-2 text-[var(--muted)]">Inventory Posted</div>
                <div className="mt-1 font-semibold text-white">
                  {formatDateTime(detail.dispatch.inventory_posted_at)}
                </div>
                <div className="mt-2 text-[var(--muted)]">Delivered</div>
                <div className="mt-1 font-semibold text-white">
                  {formatDateTime(detail.dispatch.delivered_at)}{" "}
                  {detail.dispatch.delivered_by_name
                    ? `by ${detail.dispatch.delivered_by_name}`
                    : ""}
                </div>
              </div>

              {/* AUDIT: DENSITY_OVERLOAD - keep the editable status form as the primary lane and move lesser status actions behind a secondary reveal. */}
              <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                <div>
                  <div className="text-sm font-semibold text-white">Status update</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    Record the next valid state and capture the yard or delivery proof details that support it.
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-[var(--muted)]">Entry Time</label>
                    <Input
                      type="datetime-local"
                      value={entryTime}
                      onChange={(event) => setEntryTime(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Exit Time</label>
                    <Input
                      type="datetime-local"
                      value={exitTime}
                      onChange={(event) => setExitTime(event.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Receiver Name</label>
                  <Input
                    value={receiverName}
                    onChange={(event) => setReceiverName(event.target.value)}
                    placeholder="Person receiving the dispatch"
                  />
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">POD Notes</label>
                  <Textarea
                    value={podNotes}
                    onChange={(event) => setPodNotes(event.target.value)}
                    placeholder="Delivery note / proof details"
                  />
                </div>
                {nextAction ? (
                  <Button disabled={busy} onClick={() => void updateStatus(nextAction.status)}>
                    {nextAction.label}
                  </Button>
                ) : (
                  <Button disabled>Status complete</Button>
                )}
                <details className="group rounded-2xl border border-[var(--border)] bg-[var(--card-strong)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                    More actions
                    <span className="text-xs text-[var(--muted)] transition group-open:hidden">
                      Open
                    </span>
                    <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
                  </summary>
                  <div className="flex flex-wrap gap-3 border-t border-[var(--border)] px-4 py-4">
                    <Button
                      variant="outline"
                      disabled={!canMarkLoaded}
                      onClick={() => void updateStatus("loaded")}
                    >
                      Mark loaded
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!canMarkDispatched}
                      onClick={() => void updateStatus("dispatched")}
                    >
                      Mark dispatched
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!canMarkDelivered}
                      onClick={() => void updateStatus("delivered")}
                    >
                      Mark delivered
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={!canCancelDraft}
                      onClick={() => void updateStatus("cancelled")}
                    >
                      Cancel draft
                    </Button>
                  </div>
                </details>
              </div>

              {/* AUDIT: BUTTON_CLUTTER - keep evidence-heavy sections in reveals so the next status change stays easier to spot. */}
              <details className="group rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                  Movement timeline
                  <span className="text-xs text-[var(--muted)] transition group-open:hidden">
                    Open
                  </span>
                  <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
                </summary>
                <div className="space-y-3 border-t border-[var(--border)] px-4 py-4">
                  {movementTimeline.map((entry, index) => {
                    const completed = Boolean(entry.value);
                    return (
                      <div
                        key={entry.id}
                        className={`rounded-2xl border p-3 text-sm ${timelineTone(completed)}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
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
              </details>

              <details className="group rounded-2xl border border-[var(--border)] bg-[var(--card-strong)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                  Dispatch notes
                  <span className="text-xs text-[var(--muted)] transition group-open:hidden">
                    Open
                  </span>
                  <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
                </summary>
                <div className="space-y-3 border-t border-[var(--border)] px-4 py-4 text-sm">
                  <div>
                    <div className="text-[var(--muted)]">Notes</div>
                    <div className="mt-1 text-[var(--text)]">
                      {detail.dispatch.notes || "No notes were captured for this dispatch."}
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)]">Receiver / POD</div>
                    <div className="mt-1 text-[var(--text)]">
                      {detail.dispatch.receiver_name || "Receiver not recorded"} |{" "}
                      {detail.dispatch.pod_notes || "No POD notes yet."}
                    </div>
                  </div>
                </div>
              </details>

              <details className="group rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                  Ledger movements
                  <span className="text-xs text-[var(--muted)] transition group-open:hidden">
                    {detail.ledger_movements.length || 0} items
                  </span>
                  <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
                </summary>
                <div className="space-y-3 border-t border-[var(--border)] px-4 py-4">
                  {detail.ledger_movements.map((movement) => (
                    <div key={movement.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-white">{movement.transaction_type}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {formatDateTime(movement.created_at)}
                        </div>
                      </div>
                      <div className="mt-2 text-[var(--muted)]">
                        {movement.item_code} | {formatKg(movement.quantity_kg)} KG
                      </div>
                    </div>
                  ))}
                  {!detail.ledger_movements.length ? (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3 text-sm text-[var(--muted)]">
                      No inventory movement has been posted yet. This usually means the dispatch is still a draft.
                    </div>
                  ) : null}
                </div>
              </details>

              <details className="group rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                  Audit events
                  <span className="text-xs text-[var(--muted)] transition group-open:hidden">
                    {detail.audit_events.length || 0} items
                  </span>
                  <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
                </summary>
                <div className="space-y-3 border-t border-[var(--border)] px-4 py-4">
                  {detail.audit_events.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
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
                  ))}
                  {!detail.audit_events.length ? (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3 text-sm text-[var(--muted)]">
                      No audit events were linked to this dispatch yet.
                    </div>
                  ) : null}
                </div>
              </details>
            </CardContent>
          </Card>
        </section>

        {status ? <div className="text-sm text-green-400">{status}</div> : null}
        {error ? <div className="text-sm text-red-400">{error}</div> : null}
      </div>
    </main>
  );
}
