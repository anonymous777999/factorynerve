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
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/use-session";
import {
  RecordReviewStateNote,
  recordReviewBadgeClass,
  recordReviewSurfaceClass,
  type RecordReviewTone,
} from "@/components/ui/record-review-state";

function formatKg(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function badgeTone(value: string) {
  if (value === "approved" || value === "green") return "border-emerald-400/35 bg-emerald-400/12 text-emerald-200";
  if (value === "pending" || value === "yellow") return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  return "border-rose-400/35 bg-rose-400/12 text-rose-200";
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

function reconciliationTone(row: SteelReconciliation): RecordReviewTone {
  if (row.status === "approved") return "approved";
  if (row.status === "rejected") return "flagged";
  return "pending";
}

function reconciliationDetail(row: SteelReconciliation) {
  const tone = reconciliationTone(row);
  if (tone === "approved") {
    return `Approved by ${row.approved_by_name || "Unassigned"} on ${formatDateTime(row.approved_at)}`;
  }
  if (tone === "flagged") {
    if (row.rejection_reason?.trim()) return row.rejection_reason.trim();
    return `Rejected by ${row.rejected_by_name || "Unassigned"} on ${formatDateTime(row.rejected_at)}`;
  }
  return "Pending stock trust decision. Select the mismatch cause, then approve or reject this count.";
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
            <div className="text-sm text-red-400">{sessionError || "Please login to continue."}</div>
            <Link href="/login">
              <Button>Open Login</Button>
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
    <main className="min-h-screen px-4 py-6 pb-24 md:px-8 md:pb-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Steel Reconciliations</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Approval history for stock confidence</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Review submitted physical counts, approve trusted stock evidence, and reject mismatched counts with clear reasons.
              </p>
            </div>
            <div className="grid gap-3 sm:flex sm:flex-wrap">
              <Link href="/steel">
                <Button variant="outline" className="w-full sm:w-auto">Back to Steel</Button>
              </Link>
              <Link href="/steel/customers">
                <Button variant="ghost" className="w-full sm:w-auto">Customer Ledger</Button>
              </Link>
            </div>
          </div>
        </section>

        {status ? (
          <div className="rounded-3xl border border-emerald-400/30 bg-emerald-400/12 px-4 py-3 text-sm text-emerald-100">
            {status}
          </div>
        ) : null}
        {error || sessionError ? (
          <div className="rounded-3xl border border-rose-400/30 bg-rose-400/12 px-4 py-3 text-sm text-rose-100">
            {error || sessionError}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-3">
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

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-xl">History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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

            <div className="space-y-4">
              {reconciliations.map((row) => {
                const rowTone = reconciliationTone(row);
                return (
                <div key={row.id} className={cn("rounded-3xl p-4 sm:p-5", recordReviewSurfaceClass(rowTone))}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold text-white">{row.item_code} - {row.item_name}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        Counted by {row.counted_by_name || "Unknown"} on {formatDateTime(row.counted_at)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={cn("rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em]", recordReviewBadgeClass(rowTone))}>
                        {row.status}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${badgeTone(row.confidence_status)}`}>
                        {row.confidence_status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                  <div className="mt-2 flex flex-col items-start gap-3 text-sm sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="rounded-full border border-[var(--border)] bg-[rgba(8,14,24,0.6)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                      Cause: {formatMismatchCause(mismatchCauses[row.id] || row.mismatch_cause)}
                    </div>
                    <Link href={mismatchActionLink(mismatchCauses[row.id] || row.mismatch_cause).href} className="text-xs font-medium text-[var(--accent)] hover:underline">
                      {mismatchActionLink(mismatchCauses[row.id] || row.mismatch_cause).label}
                    </Link>
                  </div>
                  <RecordReviewStateNote tone={rowTone} detail={reconciliationDetail(row)} className="mt-3" />
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
                      <div className="grid gap-3 sm:flex sm:flex-wrap">
                        <Button
                          className="w-full sm:w-auto"
                          disabled={busyId === row.id || (Math.abs(Number(row.variance_kg || 0)) > 0.001 && !(mismatchCauses[row.id] || row.mismatch_cause))}
                          onClick={() => void handleApprove(row.id)}
                        >
                          {busyId === row.id ? "Saving..." : "Approve"}
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto"
                          disabled={busyId === row.id || (Math.abs(Number(row.variance_kg || 0)) > 0.001 && !(mismatchCauses[row.id] || row.mismatch_cause))}
                          onClick={() => void handleReject(row.id)}
                        >
                          {busyId === row.id ? "Saving..." : "Reject"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
                );
              })}
              {!reconciliations.length ? (
                <div className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted)]">
                  No reconciliation records match the current filters.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
