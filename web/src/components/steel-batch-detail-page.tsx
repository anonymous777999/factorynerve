"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { OperationalPageShell } from "@/components/ui/operational-page-shell";
import { PageMain } from "@/components/ui/page-main";
import { DisclosurePanel } from "@/shared/operational/disclosure-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
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
    return "border-status-warning-fg bg-status-warning-fg text-status-warning-fg";
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

  if (!user || !detail) {
    return (
      <PageMain maxWidth="3xl" innerClassName="flex min-h-[50vh] items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Steel Batch Detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-status-danger-fg">{error || sessionError || "Batch not found."}</div>
            <div className="flex gap-3">
              <Link href="/steel">
                <Button variant="outline">Back to Steel</Button>
              </Link>
              {!user ? (
                <Link href="/access">
                  <Button>Open Access</Button>
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </PageMain>
    );
  }

  return (
    <OperationalPageShell
      eyebrow="Steel Batch Traceability"
      title={detail.batch.batch_code}
      description="Start with the batch loss signal, then inspect traceability and audit evidence before leaving this record."
      isLoading={sessionLoading || loading}
      loadingTitle="Loading steel batch traceability..."
      contentClassName="space-y-6"
      filters={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-text-secondary">
            <span className="font-bold text-[var(--accent)]">Production</span>
            <span>→</span>
            <span>Invoice</span>
            <span>→</span>
            <span>Dispatch</span>
            <span>→</span>
            <span>Reconciliation</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${badgeTone(detail.batch.severity)}`}>
              {detail.batch.severity}
            </span>
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${badgeTone(detail.batch.status)}`}>
              {detail.batch.status}
            </span>
            <Link href="/steel/invoices">
              <Button size="compact">Create Invoice</Button>
            </Link>
            <Link href="/steel">
              <Button variant="outline" size="compact">Back to Steel</Button>
            </Link>
          </div>
        </div>
      }
    >

        <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
          <CardHeader>
            <div className="text-sm text-[var(--muted)]">Production Impact</div>
            <CardTitle className="text-xl">Inventory Transformation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="text-[var(--muted)] leading-relaxed">
              This batch consumed <span className="font-semibold text-white">{formatKg(detail.batch.input_quantity_kg)} KG</span> of {detail.traceability.input_item.name} to produce <span className="font-semibold text-white">{formatKg(detail.batch.actual_output_kg)} KG</span> of {detail.traceability.output_item.name}.
              The resulting finished goods are now available in inventory for customer invoicing.
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-[var(--muted)]">Next Step:</span>
              <Link href="/steel/invoices" className="font-medium text-[var(--accent)] hover:underline">
                Issue a sales invoice for these goods →
              </Link>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              <div className="grid gap-4 md:grid-cols-2">
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
                    {formatKg(detail.batch.loss_kg)} KG • {detail.batch.loss_percent.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-[var(--muted)]">Expected vs Actual</div>
                  <div className="font-semibold text-white">
                    {formatKg(detail.batch.expected_output_kg)} KG → {formatKg(detail.batch.actual_output_kg)} KG
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
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Input Material</div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {detail.traceability.input_item.item_code} • {detail.traceability.input_item.name}
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
                  {detail.traceability.output_item.item_code} • {detail.traceability.output_item.name}
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
            <CardContent>
              <ResponsiveScrollArea
                className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                debugLabel="steel-batch-detail-transactions"
              >
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
              </ResponsiveScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Audit Trail</div>
              <CardTitle className="text-xl">Who touched this batch</CardTitle>
            </CardHeader>
            <CardContent>
              {/* AUDIT: DENSITY_OVERLOAD - keep full audit evidence available in a secondary reveal so the ledger trace stays primary. */}
              <DisclosurePanel title="View audit" defaultOpen={detail.audit_events.length <= 2}>
                <div className="space-y-3">
                  {detail.audit_events.length ? (
                    detail.audit_events.map((event) => (
                      <div key={event.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
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
                </div>
              </DisclosurePanel>
            </CardContent>
          </Card>
        </section>

        {error ? <div className="text-sm text-status-danger-fg">{error}</div> : null}
    </OperationalPageShell>
  );
}
