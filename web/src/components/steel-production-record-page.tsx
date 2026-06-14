"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import {
  createSteelBatch,
  listSteelBatches,
  listSteelItems,
  listSteelStock,
  type SteelBatch,
  type SteelItem,
  type SteelStockItem,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";

function formatKg(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function SteelProductionRecordPage() {
  const router = useRouter();
  const { user, activeFactory, loading, error: sessionError } = useSession();
  const [items, setItems] = useState<SteelItem[]>([]);
  const [stock, setStock] = useState<SteelStockItem[]>([]);
  const [recentBatches, setRecentBatches] = useState<SteelBatch[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    batch_code: "",
    production_date: todayValue(),
    input_item_id: "",
    output_item_id: "",
    input_quantity_kg: "",
    expected_output_kg: "",
    actual_output_kg: "",
    notes: "",
  });

  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";
  const canRecord = Boolean(user && ["owner", "admin", "manager", "supervisor"].includes(user.role));

  const inputItems = useMemo(
    () => items.filter((item) => item.category === "raw_material" || item.category === "wip"),
    [items],
  );
  const outputItems = useMemo(
    () => items.filter((item) => item.category === "finished_goods"),
    [items],
  );

  const loadData = useCallback(async () => {
    if (!isSteelFactory) {
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    try {
      const [itemsPayload, stockPayload, batchesPayload] = await Promise.all([
        listSteelItems(),
        listSteelStock(),
        listSteelBatches(10),
      ]);
      setItems(itemsPayload.items || []);
      setStock(stockPayload.items || []);
      setRecentBatches(batchesPayload.items || []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load production data.");
    } finally {
      setPageLoading(false);
    }
  }, [isSteelFactory]);

  useEffect(() => {
    if (!user || !isSteelFactory) {
      setPageLoading(false);
      return;
    }
    void loadData();
  }, [isSteelFactory, loadData, user]);

  const stockByItemId = useCallback(
    (itemId: number) => stock.find((s) => s.item_id === itemId),
    [stock],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    setError("");
    try {
      const payload = await createSteelBatch({
        batch_code: form.batch_code || null,
        production_date: form.production_date,
        input_item_id: Number(form.input_item_id),
        output_item_id: Number(form.output_item_id),
        input_quantity_kg: Number(form.input_quantity_kg),
        expected_output_kg: Number(form.expected_output_kg),
        actual_output_kg: Number(form.actual_output_kg),
        notes: form.notes || null,
      });
      setStatus("Batch recorded successfully.");
      // Redirect to the new batch trace
      router.push(`/steel/batches/${payload.batch.id}`);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not record batch.");
    } finally {
      setBusy(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading production record...
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Production Desk</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Manual Batch Recording</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Record material conversion (input to output) and variance signals directly into the ledger.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/steel/batches">
                <Button variant="outline" className="text-xs">Batch List</Button>
              </Link>
              <Link href="/steel/invoices">
                <Button variant="ghost" className="text-xs">Invoices</Button>
              </Link>
              <Link href="/steel/dispatches">
                <Button variant="ghost" className="text-xs">Dispatches</Button>
              </Link>
              <Link href="/steel">
                <Button variant="ghost" className="text-xs">Steel Hub</Button>
              </Link>
            </div>
          </div>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Record Production Batch</CardTitle>
          </CardHeader>
          <CardContent>
            {!canRecord ? (
              <div className="py-4 text-sm text-amber-200">
                Supervisor or higher access required to record production batches.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Batch Code (Optional)</label>
                    <Input
                      value={form.batch_code}
                      onChange={(e) => setForm({ ...form, batch_code: e.target.value.toUpperCase() })}
                      placeholder="e.g. BT-2026-001"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Production Date</label>
                    <Input
                      type="date"
                      value={form.production_date}
                      onChange={(e) => setForm({ ...form, production_date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Input Material (Scrap/Billet)</label>
                    <Select
                      value={form.input_item_id}
                      onChange={(e) => setForm({ ...form, input_item_id: e.target.value })}
                      required
                    >
                      <option value="">Select Input</option>
                      {inputItems.map((item) => (
                        <option key={item.id} value={item.id}>{item.item_code} - {item.name}</option>
                      ))}
                    </Select>
                    {form.input_item_id ? (
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        Stock: {formatKg(stockByItemId(Number(form.input_item_id))?.stock_balance_kg)} KG
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Output Material (Ingot/TMT)</label>
                    <Select
                      value={form.output_item_id}
                      onChange={(e) => setForm({ ...form, output_item_id: e.target.value })}
                      required
                    >
                      <option value="">Select Output</option>
                      {outputItems.map((item) => (
                        <option key={item.id} value={item.id}>{item.item_code} - {item.name}</option>
                      ))}
                    </Select>
                    {form.output_item_id ? (
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        Stock: {formatKg(stockByItemId(Number(form.output_item_id))?.stock_balance_kg)} KG
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Input Qty (KG)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.input_quantity_kg}
                      onChange={(e) => setForm({ ...form, input_quantity_kg: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Expected Output (KG)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.expected_output_kg}
                      onChange={(e) => setForm({ ...form, expected_output_kg: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Actual Output (KG)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.actual_output_kg}
                      onChange={(e) => setForm({ ...form, actual_output_kg: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Notes</label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Process observations, downtime, etc."
                  />
                </div>

                <div className="pt-4">
                  <Button type="submit" className="w-full h-12 text-lg" disabled={busy}>
                    {busy ? "Recording Batch..." : "Record Production Batch"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {recentBatches.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Recent Batches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentBatches.slice(0, 5).map((batch) => (
                  <Link
                    key={batch.id}
                    href={`/steel/batches/${batch.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] px-4 py-3 text-sm transition hover:bg-[rgba(20,24,36,0.52)]"
                  >
                    <div>
                      <div className="font-semibold text-white">{batch.batch_code || `Batch #${batch.id}`}</div>
                      <div className="text-xs text-[var(--muted)]">{batch.output_item_name} | {formatKg(batch.actual_output_kg)} KG</div>
                    </div>
                    <span className="text-xs text-[var(--accent)]">View →</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {status && <div className="text-sm text-green-400">{status}</div>}
        {error && <div className="text-sm text-red-400">{error}</div>}
      </div>
    </main>
  );
}
