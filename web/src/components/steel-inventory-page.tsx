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
  createSteelItem,
  listSteelStock,
  type SteelStockItem,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";

function formatKg(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatPercent(value: number | null | undefined) {
  return `${(value || 0).toFixed(2)}%`;
}

function badgeTone(value: string | null | undefined) {
  if (value === "green" || value === "approved") return "border-emerald-400/35 bg-emerald-400/12 text-emerald-200";
  if (value === "yellow" || value === "pending" || value === "review" || value === "watch") return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  return "border-rose-400/35 bg-rose-400/12 text-rose-200";
}

function deriveOperationalZone(category: string) {
  const cat = category.toLowerCase();
  if (cat.includes("scrap")) return "Scrap Yard";
  if (cat.includes("ingot") || cat.includes("billet")) return "Melt Shop WIP";
  if (cat.includes("finished") || cat.includes("tmt") || cat.includes("round") || cat.includes("section")) return "Dispatch Yard";
  return "Process Floor";
}

export function SteelInventoryPage() {
  const { user, activeFactory, loading, error: sessionError } = useSession();
  const [stock, setStock] = useState<SteelStockItem[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    item_code: "",
    name: "",
    category: "finished_goods",
    display_unit: "kg",
    current_rate_per_kg: "",
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
      const payload = await listSteelStock();
      setStock(payload.items || []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load steel inventory.");
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

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    setError("");
    try {
      await createSteelItem({
        item_code: form.item_code,
        name: form.name,
        category: form.category,
        display_unit: form.display_unit,
        current_rate_per_kg: form.current_rate_per_kg ? Number(form.current_rate_per_kg) : null,
      });
      setStatus("New material added to master.");
      setForm({
        item_code: "",
        name: "",
        category: "finished_goods",
        display_unit: "kg",
        current_rate_per_kg: "",
      });
      await loadData();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not add material.");
    } finally {
      setBusy(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading steel inventory...
      </main>
    );
  }

  if (!isSteelFactory) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <Card>
            <CardHeader>
              <CardTitle>Steel inventory is factory-aware</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-[var(--muted)]">
              <div>Switch into a steel factory from the sidebar to open the stock board.</div>
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
            <div>
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Inventory Management</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Stock Balance & Material Master</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Trusted stock levels across operational zones. Manage material definitions and monitor inventory health.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/steel/inventory/transactions">
                <Button variant="outline">Transaction History</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_350px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Live Stock Trust Board</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveScrollArea
                  className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                  debugLabel="steel-inventory-board"
                >
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-3 font-medium">Item</th>
                        <th className="px-3 py-3 font-medium">Zone</th>
                        <th className="px-3 py-3 font-medium">Balance (KG)</th>
                        <th className="px-3 py-3 font-medium">Last Variance</th>
                        <th className="px-3 py-3 font-medium">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stock.map((row) => (
                        <tr key={row.item_id} className="border-b border-[var(--border)]/60 last:border-none">
                          <td className="px-3 py-3">
                            <div className="font-semibold text-white">{row.name}</div>
                            <div className="text-xs text-[var(--muted)]">{row.item_code} / {row.category.replace("_", " ")}</div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-medium text-white">{deriveOperationalZone(row.category)}</div>
                          </td>
                          <td className="px-3 py-3 font-mono text-white">{formatKg(row.stock_balance_kg)}</td>
                          <td className="px-3 py-3">
                            <div className="text-white">
                              {row.last_variance_kg != null ? `${formatKg(row.last_variance_kg)} KG` : "-"}
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {row.last_variance_percent != null ? formatPercent(row.last_variance_percent) : ""}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${badgeTone(row.confidence_status)}`}>
                              {row.confidence_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!stock.length ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)]">No inventory items found.</td>
                        </tr>
                      ) : null}
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
                  <CardTitle>Add Material</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateItem} className="space-y-4">
                    <div>
                      <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Item Code</label>
                      <Input
                        value={form.item_code}
                        onChange={(e) => setForm({ ...form, item_code: e.target.value.toUpperCase() })}
                        placeholder="e.g. TMT-12MM"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Name</label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Full description"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Category</label>
                      <Select
                        aria-label="Category"
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                      >
                        <option value="raw_material">Raw Material (Scrap)</option>
                        <option value="wip">WIP (Ingot/Billet)</option>
                        <option value="finished_goods">Finished Goods</option>
                        <option value="consumable">Consumable</option>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">Rate per KG (INR)</label>
                      <Input
                        type="number"
                        value={form.current_rate_per_kg}
                        onChange={(e) => setForm({ ...form, current_rate_per_kg: e.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                    <Button type="submit" className="w-full" isBusy={busy} busyLabel="Creating...">
                      Add to Master
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Quick Navigation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/steel/reconciliations" className="block">
                  <Button variant="outline" className="w-full justify-start text-sm">Stock Reconciliations</Button>
                </Link>
                <Link href="/steel/batches" className="block">
                  <Button variant="outline" className="w-full justify-start text-sm">Batch Traceability</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>

        {status && <div className="text-sm text-green-400">{status}</div>}
        {error && <div className="text-sm text-red-400">{error}</div>}
      </div>
    </main>
  );
}
