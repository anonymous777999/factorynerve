"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { Select } from "@/components/ui/select";
import { SuccessBanner, MutationErrorBanner } from "@/shared/feedback";
import { ApiError } from "@/lib/api";
import {
  createSteelItem,
  listSteelStock,
  type SteelStockItem,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import {
  formatKg,
  formatPercent,
  confidenceBadgeTone as badgeTone,
  deriveOperationalZone,
} from "@/features/steel/lib/steel-helpers";

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
    <main className="min-h-screen bg-[var(--surface-app)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-md)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium tracking-wide text-text-tertiary">Inventory management</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary md:text-4xl">Stock balance &amp; material master</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
                Trusted stock levels across operational zones. Manage material definitions and monitor inventory health.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/steel/inventory/transactions">
                <Button variant="outline">Transaction history</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_350px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Live stock trust board</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveScrollArea
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-shell)]"
                  debugLabel="steel-inventory-board"
                >
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-text-tertiary">
                      <tr className="border-b border-[var(--border-subtle)]">
                        <th className="px-3 py-3 font-medium">Item</th>
                        <th className="px-3 py-3 font-medium">Zone</th>
                        <th className="px-3 py-3 font-medium">Balance (KG)</th>
                        <th className="px-3 py-3 font-medium">Last variance</th>
                        <th className="px-3 py-3 font-medium">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const maxBalance = stock.reduce(
                          (acc, item) => Math.max(acc, item.stock_balance_kg || 0),
                          0,
                        );
                        return stock.map((row) => {
                          const balance = row.stock_balance_kg || 0;
                          const ratio = maxBalance > 0 ? Math.max(0, Math.min(1, balance / maxBalance)) : 0;
                          const fill =
                            row.confidence_status === "green"
                              ? "var(--status-success-icon)"
                              : row.confidence_status === "yellow"
                                ? "var(--status-warning-icon)"
                                : "var(--status-danger-icon)";
                          const variance = row.last_variance_kg ?? 0;
                          const varianceTone =
                            variance > 0
                              ? "text-status-danger-fg"
                              : variance < 0
                                ? "text-status-warning-fg"
                                : "text-text-secondary";
                          return (
                            <tr key={row.item_id} className="border-b border-[var(--border-subtle)] last:border-none">
                              <td className="px-3 py-3">
                                <div className="font-semibold text-text-primary">{row.name}</div>
                                <div className="text-xs text-text-tertiary">{row.item_code} &middot; {row.category.replace("_", " ")}</div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="font-medium text-text-primary">{deriveOperationalZone(row.category)}</div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="font-mono tabular-nums text-text-primary">{formatKg(balance)}</div>
                                {maxBalance > 0 ? (
                                  <div className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-[var(--surface-elevated)]">
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${Math.max(2, ratio * 100)}%`,
                                        background: fill,
                                      }}
                                    />
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-3 py-3">
                                <div className={`tabular-nums font-semibold ${varianceTone}`}>
                                  {row.last_variance_kg != null ? `${variance > 0 ? "+" : ""}${formatKg(row.last_variance_kg)} KG` : "-"}
                                </div>
                                <div className="text-xs text-text-tertiary tabular-nums">
                                  {row.last_variance_percent != null ? formatPercent(row.last_variance_percent) : ""}
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${badgeTone(row.confidence_status)}`}>
                                  {row.confidence_status}
                                </span>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                      {!stock.length ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-text-tertiary">No inventory items found.</td>
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
                  <CardTitle>Add material</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateItem} className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-text-tertiary">Item code</label>
                      <Input
                        value={form.item_code}
                        onChange={(e) => setForm({ ...form, item_code: e.target.value.toUpperCase() })}
                        placeholder="e.g. TMT-12MM"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-tertiary">Name</label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Full description"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-tertiary">Category</label>
                      <Select
                        aria-label="Category"
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                      >
                        <option value="raw_material">Raw material (scrap)</option>
                        <option value="wip">WIP (ingot/billet)</option>
                        <option value="finished_goods">Finished goods</option>
                        <option value="consumable">Consumable</option>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-tertiary">Rate per kg (INR)</label>
                      <Input
                        type="number"
                        value={form.current_rate_per_kg}
                        onChange={(e) => setForm({ ...form, current_rate_per_kg: e.target.value })}
                        placeholder="Optional"
                      />
                    </div>
                    <Button type="submit" className="w-full" isBusy={busy} busyLabel="Creating...">
                      Add to master
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Quick navigation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/steel/reconciliations" className="block">
                  <Button variant="outline" className="w-full justify-start text-sm">Stock reconciliations</Button>
                </Link>
                <Link href="/steel/batches" className="block">
                  <Button variant="outline" className="w-full justify-start text-sm">Batch traceability</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>

        {status && <SuccessBanner message={status} onDismiss={() => setStatus("")} />}
        {error && <MutationErrorBanner message={error} onDismiss={() => setError("")} />}
      </div>
    </main>
  );
}
