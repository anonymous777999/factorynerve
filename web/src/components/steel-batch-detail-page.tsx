"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSteelBatchDetail, type SteelBatchDetail } from "@/lib/steel";
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

function badgeTone(value?: string | null) {
  if (value === "green" || value === "normal" || value === "recorded") {
    return "border-emerald-400/35 bg-emerald-400/12 text-emerald-200";
  }
  if (value === "yellow" || value === "watch") {
    return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  }
  if (value === "high") {
    return "border-orange-400/35 bg-orange-400/12 text-orange-200";
  }
  return "border-rose-400/35 bg-rose-400/12 text-rose-200";
}

export function SteelBatchDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: sessionLoading, error: sessionError } = useSession();
  const [detail, setDetail] = useState<SteelBatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const batchId = Number(params?.id);

  const loadDetail = useCallback(async () => {
    if (!Number.isFinite(batchId) || batchId <= 0) {
      setError("Invalid steel batch ID.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = await getSteelBatchDetail(batchId);
      setDetail(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load steel batch detail.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void loadDetail();
  }, [loadDetail, sessionLoading, user]);

  const inputMovement = detail?.traceability.input_item.movement || null;
  const outputMovement = detail?.traceability.output_item.movement || null;
  const canSeeFinancials = Boolean(detail?.financial_access && user?.role === "owner");
  const stockExposure = useMemo(
    () => ({
      inputDelta: inputMovement ? Math.abs(inputMovement.quantity_kg) : 0,
      outputDelta: outputMovement ? Math.abs(outputMovement.quantity_kg) : 0,
    }),
    [inputMovement, outputMovement],
  );

  if (sessionLoading || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading steel batch traceability...
      </main>
    );
  }

  if (!user || !detail) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Steel Batch Detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{error || sessionError || "Batch not found."}</div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/steel" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto">Back to Steel</Button>
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
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Steel Batch Traceability</div>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl md:text-4xl">{detail.batch.batch_code}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Expected-vs-actual batch detail with live ledger movements, balance checkpoints, and audit visibility.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${badgeTone(detail.batch.severity)}`}>
                  {detail.batch.severity}
                </span>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${badgeTone(detail.batch.status)}`}>
                  {detail.batch.status}
                </span>
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link href="/steel" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto">Back to Steel</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Input</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{formatKg(detail.batch.input_quantity_kg)} KG</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Actual Output</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{formatKg(detail.batch.actual_output_kg)} KG</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Variance</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{formatKg(detail.batch.variance_kg)} KG</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">{canSeeFinancials ? "Value At Risk" : "Variance %"}</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">
              {canSeeFinancials ? formatCurrency(detail.batch.variance_value_inr) : `${detail.batch.variance_percent.toFixed(2)}%`}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Batch Snapshot</div>
              <CardTitle className="text-xl">Loss and responsibility context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-[var(--muted)]">Production Date</div>
                  <div className="font-semibold text-white">{formatDate(detail.batch.production_date)}</div>
                </div>
                <div>
                  <div className="text-[var(--muted)]">Recorded At</div>
                  <div className="font-semibold text-white">{formatDateTime(detail.batch.created_at)}</div>
                </div>
                <div>
                  <div className="text-[var(--muted)]">Operator</div>
                  <div className="font-semibold text-white">{detail.batch.operator_name || "Not captured"}</div>
                </div>
                <div>
                  <div className="text-[var(--muted)]">Factory</div>
                  <div className="font-semibold text-white">{detail.factory.name}</div>
                </div>
                <div>
                  <div className="text-[var(--muted)]">Loss</div>
                  <div className="font-semibold text-white">
                    {formatKg(detail.batch.loss_kg)} KG - {detail.batch.loss_percent.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-[var(--muted)]">Expected vs Actual</div>
                  <div className="font-semibold text-white">
                    {formatKg(detail.batch.expected_output_kg)} KG to {formatKg(detail.batch.actual_output_kg)} KG
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm leading-7 text-[var(--text)]">
                {detail.traceability.severity_reason}
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm leading-7 text-[var(--text)]">
                {detail.batch.notes || "No batch notes were recorded for this trace."}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Material Traceability</div>
              <CardTitle className="text-xl">Ledger checkpoint before and after the batch</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Input Material</div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {detail.traceability.input_item.item_code} - {detail.traceability.input_item.name}
                </div>
                <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                  <div>Current stock: <span className="font-semibold text-white">{formatKg(detail.traceability.input_item.current_stock_kg)} KG</span></div>
                  <div>Batch issue: <span className="font-semibold text-white">{formatKg(stockExposure.inputDelta)} KG</span></div>
                  <div>Before issue: <span className="font-semibold text-white">{formatKg(inputMovement?.balance_before_kg)} KG</span></div>
                  <div>After issue: <span className="font-semibold text-white">{formatKg(inputMovement?.balance_after_kg)} KG</span></div>
                </div>
              </div>
              <div className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Output Material</div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {detail.traceability.output_item.item_code} - {detail.traceability.output_item.name}
                </div>
                <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                  <div>Current stock: <span className="font-semibold text-white">{formatKg(detail.traceability.output_item.current_stock_kg)} KG</span></div>
                  <div>Batch receipt: <span className="font-semibold text-white">{formatKg(stockExposure.outputDelta)} KG</span></div>
                  <div>Before receipt: <span className="font-semibold text-white">{formatKg(outputMovement?.balance_before_kg)} KG</span></div>
                  <div>After receipt: <span className="font-semibold text-white">{formatKg(outputMovement?.balance_after_kg)} KG</span></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Linked Ledger</div>
              <CardTitle className="text-xl">Every movement posted by this batch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 md:hidden">
                {detail.inventory_movements.map((movement) => (
                  <div key={movement.id} className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4 text-sm">
                    <div className="space-y-1">
                      <div className="font-semibold text-white">{movement.item_code}</div>
                      <div className="text-xs text-[var(--muted)]">{movement.item_name}</div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Type</div>
                        <div className="mt-1 text-white">{movement.transaction_type}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Qty</div>
                        <div className="mt-1 text-white">{formatKg(movement.quantity_kg)} KG</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Before</div>
                        <div className="mt-1 text-white">{formatKg(movement.balance_before_kg)} KG</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">After</div>
                        <div className="mt-1 text-white">{formatKg(movement.balance_after_kg)} KG</div>
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
                      <th className="px-3 py-3 font-medium">Type</th>
                      <th className="px-3 py-3 font-medium">Qty</th>
                      <th className="px-3 py-3 font-medium">Before</th>
                      <th className="px-3 py-3 font-medium">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.inventory_movements.map((movement) => (
                      <tr key={movement.id} className="border-b border-[var(--border)]/60 last:border-none">
                        <td className="px-3 py-3">
                          <div className="font-semibold text-white">{movement.item_code}</div>
                          <div className="text-xs text-[var(--muted)]">{movement.item_name}</div>
                        </td>
                        <td className="px-3 py-3">{movement.transaction_type}</td>
                        <td className="px-3 py-3">{formatKg(movement.quantity_kg)} KG</td>
                        <td className="px-3 py-3">{formatKg(movement.balance_before_kg)} KG</td>
                        <td className="px-3 py-3">{formatKg(movement.balance_after_kg)} KG</td>
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
              <CardTitle className="text-xl">Who touched this batch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {detail.audit_events.length ? (
                detail.audit_events.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="font-semibold text-white">{event.action}</div>
                      <div className="text-xs text-[var(--muted)]">{formatDateTime(event.timestamp)}</div>
                    </div>
                    <div className="mt-2 text-[var(--muted)]">{event.user_name || "System / background action"}</div>
                    <div className="mt-2 text-[var(--text)]">{event.details || "No extra audit detail."}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  No audit events were linked to this batch yet.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

      </div>
    </main>
  );
}
