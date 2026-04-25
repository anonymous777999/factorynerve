"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import {
  createSteelInvoice,
  listSteelBatches,
  listSteelCustomers,
  listSteelInvoices,
  listSteelItems,
  type SteelBatch,
  type SteelCustomer,
  type SteelInvoice,
  type SteelItem,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";

type DraftLine = {
  item_id: string;
  batch_id: string;
  description: string;
  weight_kg: string;
  rate_per_kg: string;
};

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

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

function addDays(dateValue: string, days: number) {
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateValue;
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function blankLine(): DraftLine {
  return {
    item_id: "",
    batch_id: "",
    description: "",
    weight_kg: "",
    rate_per_kg: "",
  };
}

function parseRequiredNumber(
  value: string,
  label: string,
  {
    minimum,
    integerOnly = false,
    inclusive = true,
  }: { minimum: number; integerOnly?: boolean; inclusive?: boolean },
) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }
  if (integerOnly && !Number.isInteger(parsed)) {
    throw new Error(`${label} must be a whole number.`);
  }
  const isBelowMinimum = inclusive ? parsed < minimum : parsed <= minimum;
  if (isBelowMinimum) {
    throw new Error(
      inclusive
        ? `${label} must be at least ${minimum}.`
        : `${label} must be greater than ${minimum}.`,
    );
  }
  return parsed;
}

export function SteelInvoicesPage() {
  const { user, activeFactory, loading, error: sessionError } = useSession();
  const [items, setItems] = useState<SteelItem[]>([]);
  const [batches, setBatches] = useState<SteelBatch[]>([]);
  const [customers, setCustomers] = useState<SteelCustomer[]>([]);
  const [invoices, setInvoices] = useState<SteelInvoice[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [invoiceDate, setInvoiceDate] = useState(todayValue());
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [paymentTermsDays, setPaymentTermsDays] = useState("30");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);

  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";
  const canCreate = Boolean(user && ["owner", "admin", "manager", "accountant"].includes(user.role));

  const loadData = useCallback(async () => {
    if (!isSteelFactory) {
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    try {
      const [itemsPayload, batchesPayload, customersPayload, invoicesPayload] = await Promise.all([
        listSteelItems(),
        listSteelBatches(50),
        listSteelCustomers(100),
        listSteelInvoices(20),
      ]);
      setItems(itemsPayload.items || []);
      setBatches(batchesPayload.items || []);
      setCustomers(customersPayload.items || []);
      setInvoices(invoicesPayload.items || []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load steel invoices.");
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

  const finishedItems = useMemo(
    () => items.filter((item) => item.category === "finished_goods"),
    [items],
  );

  const batchOptionsByItem = useMemo(() => {
    const map = new Map<number, SteelBatch[]>();
    for (const batch of batches) {
      const current = map.get(batch.output_item_id) || [];
      current.push(batch);
      map.set(batch.output_item_id, current);
    }
    return map;
  }, [batches]);

  const totals = useMemo(() => {
    let weight = 0;
    let amount = 0;
    for (const line of lines) {
      const weightKg = Number(line.weight_kg || 0);
      const rate = Number(line.rate_per_kg || 0);
      weight += weightKg;
      amount += weightKg * rate;
    }
    return { weight, amount };
  }, [lines]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => String(customer.id) === selectedCustomerId) || null,
    [customers, selectedCustomerId],
  );

  const dueDate = useMemo(() => {
    const parsedTerms = Number(paymentTermsDays || 0);
    return addDays(invoiceDate, Number.isFinite(parsedTerms) && parsedTerms >= 0 ? parsedTerms : 0);
  }, [invoiceDate, paymentTermsDays]);

  useEffect(() => {
    if (!selectedCustomer) return;
    setCustomerName(selectedCustomer.name);
    setPaymentTermsDays(String(selectedCustomer.payment_terms_days || 0));
  }, [selectedCustomer]);

  const setLine = (index: number, patch: Partial<DraftLine>) => {
    setLines((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    );
  };

  const submitInvoice = async () => {
    setStatus("");
    setError("");
    try {
      const parsedTerms = paymentTermsDays.trim() ? Number(paymentTermsDays) : 0;
      if (!Number.isInteger(parsedTerms) || parsedTerms < 0 || parsedTerms > 365) {
        throw new Error("Payment terms must be a whole number between 0 and 365.");
      }
      const trimmedCustomerName = customerName.trim();
      if (!selectedCustomerId && !trimmedCustomerName) {
        throw new Error("Customer name is required.");
      }
      const payload = {
        invoice_date: invoiceDate,
        customer_id: selectedCustomerId ? Number(selectedCustomerId) : undefined,
        customer_name: trimmedCustomerName || undefined,
        payment_terms_days: parsedTerms,
        notes: notes || undefined,
        lines: lines.map((line, index) => ({
          item_id: parseRequiredNumber(line.item_id, `Line ${index + 1} item`, {
            minimum: 1,
            integerOnly: true,
          }),
          batch_id: line.batch_id
            ? parseRequiredNumber(line.batch_id, `Line ${index + 1} batch`, {
                minimum: 1,
                integerOnly: true,
              })
            : undefined,
          description: line.description || undefined,
          weight_kg: parseRequiredNumber(line.weight_kg, `Line ${index + 1} weight`, {
            minimum: 0,
            inclusive: false,
          }),
          rate_per_kg: parseRequiredNumber(line.rate_per_kg, `Line ${index + 1} rate`, { minimum: 0 }),
        })),
      };
      setBusy(true);
      const created = await createSteelInvoice(payload);
      setStatus(`Steel invoice ${created.invoice.invoice_number} created successfully.`);
      setSelectedCustomerId("");
      setCustomerName("");
      setPaymentTermsDays("30");
      setNotes("");
      setInvoiceDate(todayValue());
      setLines([blankLine()]);
      await loadData();
    } catch (reason) {
      if (reason instanceof ApiError || reason instanceof Error) {
        setError(reason.message);
      } else {
        setError("Could not create steel invoice.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading steel invoicing...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Steel Invoicing</CardTitle>
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
              <CardTitle>Steel invoicing is factory-aware</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-[var(--muted)]">
              <div>
                Your active factory is <span className="font-semibold text-[var(--text)]">{activeFactory?.name || "not selected"}</span>.
              </div>
              <div>Switch into a steel factory from the sidebar, or update the factory profile in Settings first.</div>
              <div className="flex gap-3">
                <Link href="/steel">
                  <Button>Open Steel Module</Button>
                </Link>
                <Link href="/settings">
                  <Button variant="outline">Open Settings</Button>
                </Link>
              </div>
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
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Steel Invoicing</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Create a steel invoice from finished goods</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Pick the buyer, add finished-goods lines, and let the server lock the invoice total before dispatch starts.
              </p>
            </div>
            {/* AUDIT: BUTTON_CLUTTER - move cross-route steel actions into a secondary tools tray so invoice creation stays primary. */}
            <details className="group w-full min-w-0 rounded-3xl border border-[var(--border)] bg-[rgba(10,16,26,0.72)] sm:w-auto sm:min-w-[220px]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                Invoice tools
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
                <Link href="/steel/dispatches">
                  <Button variant="ghost">Dispatches</Button>
                </Link>
              </div>
            </details>
          </div>
        </section>

        {/* AUDIT: FLOW_BROKEN - add a short three-step sequence so the invoice journey points to a clear finish. */}
        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Recent Invoices</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{invoices.length}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Draft Weight</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{formatKg(totals.weight)} KG</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Draft Total</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{formatCurrency(totals.amount)}</CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.16fr_0.84fr]">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Create Invoice</div>
              <CardTitle className="text-xl">Issue a steel sales invoice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-[var(--muted)]">Invoice Date</label>
                  <Input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Customer</label>
                  <Select value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}>
                    <option value="">Select existing customer (optional)</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.customer_code || `#${customer.id}`} - {customer.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <label className="text-sm text-[var(--muted)]">Customer Name</label>
                  <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer / buyer name" />
                  <div className="mt-2 text-xs text-[var(--muted)]">Used only when you are not selecting an existing customer.</div>
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Payment Terms</label>
                  <Input type="number" min="0" step="1" inputMode="numeric" value={paymentTermsDays} onChange={(event) => setPaymentTermsDays(event.target.value)} />
                  <div className="mt-2 text-xs text-[var(--muted)]">Due {dueDate}</div>
                </div>
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Notes</label>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional invoice notes" />
              </div>
              {selectedCustomer ? (
                <div className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4 text-sm text-[var(--muted)]">
                  <div className="font-semibold text-white">{selectedCustomer.name}</div>
                  <div className="mt-1">Status: {selectedCustomer.status.replace("_", " ")} | Credit used {selectedCustomer.credit_used_percentage.toFixed(0)}%</div>
                  <div className="mt-1">Outstanding {formatCurrency(selectedCustomer.outstanding_amount_inr)} / Limit {selectedCustomer.credit_limit ? formatCurrency(selectedCustomer.credit_limit) : "Not set"}</div>
                </div>
              ) : null}

              <div className="space-y-4">
                {lines.map((line, index) => {
                  const selectedItemId = Number(line.item_id || 0);
                  const matchingBatches = selectedItemId ? batchOptionsByItem.get(selectedItemId) || [] : [];
                  const lineTotal = Number(line.weight_kg || 0) * Number(line.rate_per_kg || 0);
                  return (
                    <div key={index} className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="text-sm text-[var(--muted)]">Finished item</label>
                          <Select value={line.item_id} onChange={(event) => setLine(index, { item_id: event.target.value, batch_id: "" })}>
                            <option value="">Select item</option>
                            {finishedItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.item_code} - {item.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm text-[var(--muted)]">Batch (optional)</label>
                          <Select value={line.batch_id} onChange={(event) => setLine(index, { batch_id: event.target.value })}>
                            <option value="">No batch link</option>
                            {matchingBatches.map((batch) => (
                              <option key={batch.id} value={batch.id}>
                                {batch.batch_code}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <div>
                          <label className="text-sm text-[var(--muted)]">Weight (KG)</label>
                          <Input type="number" min="0.01" step="0.01" value={line.weight_kg} onChange={(event) => setLine(index, { weight_kg: event.target.value })} />
                        </div>
                        <div>
                          <label className="text-sm text-[var(--muted)]">Rate / KG</label>
                          <Input type="number" min="0" step="0.01" value={line.rate_per_kg} onChange={(event) => setLine(index, { rate_per_kg: event.target.value })} />
                        </div>
                        <div>
                          <label className="text-sm text-[var(--muted)]">Line Total</label>
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-4 py-3 text-sm font-semibold text-white">
                            {formatCurrency(lineTotal)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <label className="text-sm text-[var(--muted)]">Description</label>
                        <Input value={line.description} onChange={(event) => setLine(index, { description: event.target.value })} placeholder="Line description" />
                      </div>
                      <div className="mt-4 flex gap-3">
                        {lines.length > 1 ? (
                          <Button variant="ghost" onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>
                            Remove line
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                <Button variant="outline" onClick={() => setLines((current) => [...current, blankLine()])}>
                  Add line
                </Button>
              </div>

              <div className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-[var(--muted)]">Invoice total weight</div>
                    <div className="text-2xl font-semibold text-white">{formatKg(totals.weight)} KG</div>
                  </div>
                  <div>
                    <div className="text-sm text-[var(--muted)]">Invoice total amount</div>
                    <div className="text-2xl font-semibold text-white">{formatCurrency(totals.amount)}</div>
                  </div>
                </div>
              </div>

              <Button disabled={busy || !canCreate} onClick={() => void submitInvoice()}>
                {canCreate ? (busy ? "Creating..." : "Create invoice") : "Owner / manager / admin / accountant access required"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Invoice History</div>
              <CardTitle className="text-xl">Recent invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {/* AUDIT: DENSITY_OVERLOAD - keep invoice history available but collapsed so the creation form stays dominant. */}
              <details className="group rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                  Review recent invoices
                  <span className="text-xs text-[var(--muted)] transition group-open:hidden">{invoices.length} items</span>
                  <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
                </summary>
                <ResponsiveScrollArea className="border-t border-[var(--border)]" debugLabel="steel-invoices-history">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-3 font-medium">Invoice</th>
                        <th className="px-3 py-3 font-medium">Customer</th>
                        <th className="px-3 py-3 font-medium">Due</th>
                        <th className="px-3 py-3 font-medium">Outstanding</th>
                        <th className="px-3 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-[var(--border)]/60 last:border-none">
                          <td className="px-3 py-3">
                            <div className="font-semibold text-white">{invoice.invoice_number}</div>
                            <div className="text-xs text-[var(--muted)]">{invoice.invoice_date}</div>
                          </td>
                          <td className="px-3 py-3">{invoice.customer_name}</td>
                          <td className="px-3 py-3">
                            <div>{invoice.due_date}</div>
                            <div className="text-xs text-[var(--muted)]">{invoice.status}</div>
                          </td>
                          <td className="px-3 py-3">{formatCurrency(invoice.outstanding_amount_inr ?? invoice.total_amount)}</td>
                          <td className="px-3 py-3">
                            <Link href={`/steel/invoices/${invoice.id}`} className="text-xs font-medium text-[var(--accent)] hover:underline">
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                      {!invoices.length ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-[var(--muted)]">
                            No steel invoices yet. Create the first one from finished goods above.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </ResponsiveScrollArea>
              </details>
            </CardContent>
          </Card>
        </section>

        {status ? <div className="text-sm text-green-400">{status}</div> : null}
        {error || sessionError ? <div className="text-sm text-red-400">{error || sessionError}</div> : null}
      </div>
    </main>
  );
}
