"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import {
  approveSteelReconciliation,
  listSteelReconciliations,
  listSteelStock,
  rejectSteelReconciliation,
  type SteelReconciliation,
  type SteelStockMismatchCause,
  type SteelStockItem,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";

function formatKg(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function badgeTone(value: string) {
  if (value === "approved" || value === "green") return "border-emerald-400/35 bg-emerald-400/12 text-emerald-200";
  if (value === "pending" || value === "yellow") return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  return "border-rose-400/35 bg-rose-400/12 text-rose-200";
}

function formatMismatchCause(value: SteelStockMismatchCause | string | null | undefined) {
  if (!value) return "Not tagged";
  return value.replaceAll("_", " ");
}

function mismatchActionLink(value: SteelStockMismatchCause | string | null | undefined) {
  switch (value) {
    case "counting_error":
      return { href: "/steel/reconciliations", label: "Recount this stock" };
    case "process_loss":
      return { href: "/steel?tab=production", label: "Open production loss lane" };
    case "theft_or_leakage":
      return { href: "/steel?tab=risk", label: "Open leakage risk lane" };
    case "wrong_entry":
      return { href: "/steel/invoices", label: "Check invoice or stock entries" };
    case "delayed_dispatch_update":
      return { href: "/steel/dispatches", label: "Check dispatch posting" };
    default:
      return { href: "/steel", label: "Open steel command center" };
  }
}

const MISMATCH_CAUSE_OPTIONS: Array<{ value: SteelStockMismatchCause; label: string }> = [
  { value: "counting_error", label: "Counting Error" },
  { value: "process_loss", label: "Process Loss" },
  { value: "theft_or_leakage", label: "Theft / Leakage" },
  { value: "wrong_entry", label: "Wrong Entry" },
  { value: "delayed_dispatch_update", label: "Delayed Dispatch Update" },
  { value: "other", label: "Other" },
];

export function SteelReconciliationsPage() {
  const { user, activeFactory, loading, error: sessionError } = useSession();
  const [items, setItems] = useState<SteelStockItem[]>([]);
  const [reconciliations, setReconciliations] = useState<SteelReconciliation[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [rejectionReasons, setRejectionReasons] = useState<Record<number, string>>({});
  const [mismatchCauses, setMismatchCauses] = useState<Record<number, string>>({});

  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";
  const canReview = Boolean(user && ["owner", "admin"].includes(user.role));

  const loadData = useCallback(async () => {
    if (!isSteelFactory) {
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    try {
      const [stockPayload, reconciliationPayload] = await Promise.all([
        listSteelStock(),
        listSteelReconciliations({
          status: (statusFilter as "pending" | "approved" | "rejected" | "") || "",
          item_id: itemFilter ? Number(itemFilter) : undefined,
          limit: 100,
        }),
      ]);
      setItems(stockPayload.items || []);
      setReconciliations(reconciliationPayload.items || []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load reconciliation history.");
    } finally {
      setPageLoading(false);
    }
  }, [isSteelFactory, itemFilter, statusFilter]);

  useEffect(() => {
    if (!user || !isSteelFactory) {
      setPageLoading(false);
      return;
    }
    void loadData();
  }, [isSteelFactory, loadData, user]);

  const summary = useMemo(() => {
    return reconciliations.reduce(
      (acc, row) => {
        acc[row.status] += 1;
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0 },
    );
  }, [reconciliations]);
  const nextPending = useMemo(
    () => reconciliations.find((row) => row.status === "pending") || null,
    [reconciliations],
  );

  const handleApprove = async (reconciliationId: number) => {
    setBusyId(reconciliationId);
    setStatus("");
    setError("");
    try {
      await approveSteelReconciliation(reconciliationId, {
        approver_notes: reviewNotes[reconciliationId] || undefined,
        mismatch_cause: (mismatchCauses[reconciliationId] || undefined) as SteelStockMismatchCause | undefined,
      });
      setStatus("Reconciliation approved.");
      await loadData();
    } catch (reason) {
      if (reason instanceof ApiError || reason instanceof Error) {
        setError(reason.message);
      } else {
        setError("Could not approve reconciliation.");
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (reconciliationId: number) => {
    setBusyId(reconciliationId);
    setStatus("");
    setError("");
    try {
      await rejectSteelReconciliation(reconciliationId, {
        approver_notes: reviewNotes[reconciliationId] || undefined,
        rejection_reason: rejectionReasons[reconciliationId] || "",
        mismatch_cause: (mismatchCauses[reconciliationId] || undefined) as SteelStockMismatchCause | undefined,
      });
      setStatus("Reconciliation rejected.");
      await loadData();
    } catch (reason) {
      if (reason instanceof ApiError || reason instanceof Error) {
        setError(reason.message);
      } else {
        setError("Could not reject reconciliation.");
      }
    } finally {
      setBusyId(null);
    }
  };

  if (loading || pageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading steel reconciliations...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Steel Reconciliations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Please sign in to continue."}</div>
            <Link href="/access">
              <Button>Open Access</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!isSteelFactory) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Steel reconciliations are factory-aware</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-[var(--muted)]">
              <div>
                Your active factory is <span className="font-semibold text-[var(--text)]">{activeFactory?.name || "not selected"}</span>.
              </div>
              <div>Switch into a steel factory from the sidebar, or update the factory profile in Settings first.</div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Steel Reconciliations</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Review the next stock mismatch first</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Start with pending physical counts, tag the root cause, and keep the history trail available without crowding the review flow.
              </p>
            </div>
            {/* AUDIT: BUTTON_CLUTTER - move route jumps into a secondary tray so reconciliation review stays primary. */}
            <details className="group w-full min-w-0 rounded-3xl border border-[var(--border)] bg-[rgba(10,16,26,0.72)] sm:w-auto sm:min-w-[220px]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                Review tools
                <span className="text-xs text-[var(--muted)] transition group-open:hidden">Open</span>
                <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
              </summary>
              <div className="flex flex-wrap gap-3 border-t border-[var(--border)] px-4 py-4">
                <Link href="/steel">
                  <Button variant="outline">Steel hub</Button>
                </Link>
                <Link href="/steel/customers">
                  <Button variant="ghost">Customers</Button>
                </Link>
              </div>
            </details>
          </div>
        </section>

        {/* AUDIT: FLOW_BROKEN - add a short sequence so the page leads clearly from pending review to history. */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader className="space-y-2">
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">1. Open pending count</div>
              <CardTitle className="text-lg">Start with the next mismatch</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Pending reconciliations need the first review pass before approved and rejected history matters.
            </CardContent>
          </Card>
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader className="space-y-2">
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">2. Tag the cause</div>
              <CardTitle className="text-lg">Record why stock drifted</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Choose the mismatch cause before approving or rejecting so the next action lane stays traceable.
            </CardContent>
          </Card>
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader className="space-y-2">
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">3. Keep history</div>
              <CardTitle className="text-lg">Use filters when needed</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Status and item filters stay available once the active mismatch is handled.
            </CardContent>
          </Card>
        </section>

        {nextPending ? (
          // AUDIT: FLOW_BROKEN - feature the next pending reconciliation first so reviewers see the immediate task before the full history list.
          <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
              <CardHeader>
                <div className="text-sm text-[var(--muted)]">Next review</div>
                <CardTitle className="text-xl">{nextPending.item_code} - {nextPending.item_name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-[var(--muted)]">
                  Counted by {nextPending.counted_by_name || "Unknown"} on {nextPending.counted_at}
                </div>
                <div className="font-semibold text-white">
                  {formatKg(nextPending.variance_kg)} KG variance | {nextPending.variance_percent.toFixed(2)}%
                </div>
                <div className="text-[var(--muted)]">
                  Cause: {formatMismatchCause(mismatchCauses[nextPending.id] || nextPending.mismatch_cause)}
                </div>
              </CardContent>
            </Card>
            <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
              <CardHeader>
                <div className="text-sm text-[var(--muted)]">Queue pulse</div>
                <CardTitle className="text-xl">Pending first</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-[var(--muted)]">
                <div>{summary.pending} pending | {summary.approved} approved | {summary.rejected} rejected</div>
                <div>Clear the pending queue first, then use the filters below for audits or post-mortems.</div>
              </CardContent>
            </Card>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Pending</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{summary.pending}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Approved</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{summary.approved}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Rejected</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{summary.rejected}</CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* AUDIT: BUTTON_CLUTTER - keep filters available in a reveal so the review list itself stays easier to scan. */}
            <details className="group rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                Filter history
                <span className="text-xs text-[var(--muted)] transition group-open:hidden">Open</span>
                <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
              </summary>
              <div className="grid gap-4 border-t border-[var(--border)] px-4 py-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-[var(--muted)]">Status</label>
                  <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Item</label>
                  <Select value={itemFilter} onChange={(event) => setItemFilter(event.target.value)}>
                    <option value="">All items</option>
                    {items.map((item) => (
                      <option key={item.item_id} value={item.item_id}>
                        {item.item_code} - {item.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </details>

            <div className="space-y-4">
              {reconciliations.map((row) => (
                <div key={row.id} className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-white">{row.item_code} - {row.item_name}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        Counted by {row.counted_by_name || "Unknown"} on {row.counted_at}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${badgeTone(row.status)}`}>
                        {row.status}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${badgeTone(row.confidence_status)}`}>
                        {row.confidence_status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">System</div>
                      <div className="mt-1 text-sm font-semibold text-white">{formatKg(row.system_qty_kg)} KG</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Physical</div>
                      <div className="mt-1 text-sm font-semibold text-white">{formatKg(row.physical_qty_kg)} KG</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Variance</div>
                      <div className="mt-1 text-sm font-semibold text-white">{formatKg(row.variance_kg)} KG</div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Variance %</div>
                      <div className="mt-1 text-sm font-semibold text-white">{row.variance_percent.toFixed(2)}%</div>
                    </div>
                  </div>

                  {row.notes ? <div className="mt-3 text-sm text-[var(--muted)]">Count note: {row.notes}</div> : null}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                    <div className="rounded-full border border-[var(--border)] bg-[rgba(8,14,24,0.6)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      Cause: {formatMismatchCause(mismatchCauses[row.id] || row.mismatch_cause)}
                    </div>
                    <Link href={mismatchActionLink(mismatchCauses[row.id] || row.mismatch_cause).href} className="text-xs font-medium text-[var(--accent)] hover:underline">
                      {mismatchActionLink(mismatchCauses[row.id] || row.mismatch_cause).label}
                    </Link>
                  </div>
                  {row.approver_notes ? <div className="mt-2 text-sm text-[var(--muted)]">Approver note: {row.approver_notes}</div> : null}
                  {row.rejection_reason ? <div className="mt-2 text-sm text-red-300">Rejection: {row.rejection_reason}</div> : null}

                  {row.status === "pending" && canReview ? (
                    <div className="mt-4 space-y-3 rounded-2xl border border-[var(--border)] bg-[rgba(8,14,24,0.6)] p-4">
                      <Select
                        value={mismatchCauses[row.id] ?? row.mismatch_cause ?? ""}
                        onChange={(event) => setMismatchCauses((current) => ({ ...current, [row.id]: event.target.value }))}
                      >
                        <option value="">Mismatch root cause</option>
                        {MISMATCH_CAUSE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                      <Input
                        value={reviewNotes[row.id] || ""}
                        onChange={(event) => setReviewNotes((current) => ({ ...current, [row.id]: event.target.value }))}
                        placeholder="Approver note (optional)"
                      />
                      <Input
                        value={rejectionReasons[row.id] || ""}
                        onChange={(event) => setRejectionReasons((current) => ({ ...current, [row.id]: event.target.value }))}
                        placeholder="Rejection reason (required for reject)"
                      />
                      {Math.abs(Number(row.variance_kg || 0)) > 0.001 && !(mismatchCauses[row.id] || row.mismatch_cause) ? (
                        <div className="text-xs text-amber-200">
                          Select the root cause before approving or rejecting this mismatch.
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-3">
                        <Button
                          disabled={busyId === row.id || (Math.abs(Number(row.variance_kg || 0)) > 0.001 && !(mismatchCauses[row.id] || row.mismatch_cause))}
                          onClick={() => void handleApprove(row.id)}
                        >
                          {busyId === row.id ? "Saving..." : "Approve"}
                        </Button>
                        <Button
                          variant="outline"
                          disabled={busyId === row.id || (Math.abs(Number(row.variance_kg || 0)) > 0.001 && !(mismatchCauses[row.id] || row.mismatch_cause))}
                          onClick={() => void handleReject(row.id)}
                        >
                          {busyId === row.id ? "Saving..." : "Reject"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
              {!reconciliations.length ? (
                <div className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted)]">
                  No reconciliation records match the current filters.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {status ? <div className="text-sm text-green-400">{status}</div> : null}
        {error || sessionError ? <div className="text-sm text-red-400">{error || sessionError}</div> : null}
      </div>
    </main>
  );
}
