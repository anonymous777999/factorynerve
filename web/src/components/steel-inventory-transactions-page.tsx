"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import {
  createSteelTransaction,
  listSteelItems,
  listSteelTransactions,
  type SteelInventoryTransaction,
  type SteelItem,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";

function formatKg(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SteelInventoryTransactionsPage() {
  const { user, activeFactory, loading, error: sessionError } = useSession();
  const [items, setItems] = useState<SteelItem[]>([]);
  const [transactions, setTransactions] = useState<SteelInventoryTransaction[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    item_id: "",
    transaction_type: "manual_adjustment",
    quantity_kg: "",
    direction: "in",
    notes: "",
  });

  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";
  const canManage = Boolean(user && ["owner", "admin", "manager"].includes(user.role));

  const loadData = useCallback(async () => {
    if (!isSteelFactory) {
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    try {
      const [itemsPayload, transactionsPayload] = await Promise.all([
        listSteelItems(),
        listSteelTransactions(50),
      ]);
      setItems(itemsPayload.items || []);
      setTransactions(transactionsPayload.items || []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load transactions.");
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

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    setError("");
    try {
      await createSteelTransaction({
        item_id: Number(form.item_id),
        transaction_type: form.transaction_type,
        quantity_kg: Number(form.quantity_kg),
        direction: form.direction,
        notes: form.notes,
      });
      setStatus("Inventory transaction recorded.");
      setForm({
        item_id: "",
        transaction_type: "manual_adjustment",
        quantity_kg: "",
        direction: "in",
        notes: "",
      });
      await loadData();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not record transaction.");
    } finally {
      setBusy(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading transactions...
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Inventory Operations</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Manual Transactions & Audit Trail</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Record manual stock adjustments and review the full history of inventory movements for the active plant.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/steel/inventory">
                <Button variant="outline">Stock Board</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_350px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Movements</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveScrollArea
                  className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                  debugLabel="steel-transactions-list"
                >
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-3 font-medium">Timestamp</th>
                        <th className="px-3 py-3 font-medium">Item</th>
                        <th className="px-3 py-3 font-medium">Type</th>
                        <th className="px-3 py-3 font-medium">Qty (KG)</th>
                        <th className="px-3 py-3 font-medium">Direction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-[var(--border)]/60 last:border-none">
                          <td className="px-3 py-3 text-[var(--text)]">{formatDateTime(tx.created_at)}</td>
                          <td className="px-3 py-3">
                            <div className="font-semibold text-white">{tx.item_name || `Item #${tx.item_id}`}</div>
                            <div className="text-xs text-[var(--muted)]">{tx.item_code}</div>
                          </td>
                          <td className="px-3 py-3 text-[var(--muted)]">{tx.transaction_type.replace("_", " ")}</td>
                          <td className="px-3 py-3 font-mono text-white">{formatKg(tx.quantity_kg)}</td>
                          <td className="px-3 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase font-bold ${tx.direction === "in" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                              {tx.direction}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!transactions.length && (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)]">No recent transactions found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </ResponsiveScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {canManage && (
              <Card>
                <CardHeader>
                  <CardTitle>Manual Adjustment</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateTransaction} className="space-y-4">
                    <div>
                      <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Material</label>
                      <Select
                        value={form.item_id}
                        onChange={(e) => setForm({ ...form, item_id: e.target.value })}
                        required
                      >
                        <option value="">Select Item</option>
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>{item.item_code} - {item.name}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Direction</label>
                      <Select
                        value={form.direction}
                        onChange={(e) => setForm({ ...form, direction: e.target.value })}
                      >
                        <option value="in">Add (+) Stock (Inward)</option>
                        <option value="out">Remove (-) Stock (Outward)</option>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Quantity (KG)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.quantity_kg}
                        onChange={(e) => setForm({ ...form, quantity_kg: e.target.value })}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Reason / Type</label>
                      <Select
                        value={form.transaction_type}
                        onChange={(e) => setForm({ ...form, transaction_type: e.target.value })}
                      >
                        <option value="manual_adjustment">Manual Adjustment</option>
                        <option value="opening_stock">Opening Stock</option>
                        <option value="damage_writeoff">Damage / Write-off</option>
                        <option value="internal_transfer">Internal Transfer</option>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Notes</label>
                      <Input
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        placeholder="Internal audit note"
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy ? "Recording..." : "Post Transaction"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {status && <div className="text-sm text-green-400">{status}</div>}
        {error && <div className="text-sm text-red-400">{error}</div>}
      </div>
    </main>
  );
}
