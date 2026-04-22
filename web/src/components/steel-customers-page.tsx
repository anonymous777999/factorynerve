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
import { createSteelCustomer, listSteelCustomers, type SteelCustomer } from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { validateIdentifierCode, validatePhoneNumber } from "@/lib/validation";

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
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function riskBadgeClass(level: SteelCustomer["risk_level"]) {
  if (level === "high") return "border-rose-400/35 bg-rose-500/12 text-rose-200";
  if (level === "medium") return "border-amber-400/35 bg-amber-500/12 text-amber-200";
  return "border-emerald-400/35 bg-emerald-500/12 text-emerald-200";
}

function verificationBadgeClass(status: SteelCustomer["verification_status"]) {
  if (status === "verified") return "border-emerald-400/35 bg-emerald-500/12 text-emerald-200";
  if (status === "rejected" || status === "mismatch") return "border-rose-400/35 bg-rose-500/12 text-rose-200";
  if (status === "pending_review" || status === "format_valid") return "border-amber-400/35 bg-amber-500/12 text-amber-200";
  return "border-slate-400/35 bg-slate-500/12 text-slate-200";
}

export function SteelCustomersPage() {
  const { user, activeFactory, loading, error: sessionError } = useSession();
  const [customers, setCustomers] = useState<SteelCustomer[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    tax_id: "",
    gst_number: "",
    pan_number: "",
    company_type: "trader",
    contact_person: "",
    designation: "",
    credit_limit: "",
    payment_terms_days: "30",
    status: "active" as "active" | "on_hold" | "blocked",
    notes: "",
  });

  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";
  const canManage = Boolean(user && ["owner", "admin", "manager", "accountant"].includes(user.role));

  const loadData = useCallback(async () => {
    if (!isSteelFactory) {
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    try {
      const payload = await listSteelCustomers(100);
      setCustomers(payload.items || []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load steel customers.");
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

  const totals = useMemo(() => {
    return customers.reduce(
      (acc, customer) => {
        acc.outstanding += Number(customer.outstanding_amount_inr || 0);
        acc.overdue += Number(customer.overdue_amount_inr || 0);
        acc.highRisk += customer.risk_level === "high" ? 1 : 0;
        acc.followUps += Number(customer.open_follow_up_count || 0);
        return acc;
      },
      { outstanding: 0, overdue: 0, highRisk: 0, followUps: 0 },
    );
  }, [customers]);

  const submitCustomer = async () => {
    setStatus("");
    setError("");
    try {
      const trimmedName = form.name.trim();
      const trimmedEmail = form.email.trim();
      if (!trimmedName) {
        throw new Error("Customer name is required.");
      }
      if (trimmedEmail && !isValidEmail(trimmedEmail)) {
        throw new Error("Customer email must be a valid email address.");
      }
      const phoneError = validatePhoneNumber(form.phone, "Customer phone");
      if (phoneError) {
        throw new Error(phoneError);
      }
      const taxIdError = validateIdentifierCode(form.tax_id, "Tax ID", 64);
      if (taxIdError) {
        throw new Error(taxIdError);
      }
      const gstError = validateIdentifierCode(form.gst_number, "GST number", 32);
      if (gstError) {
        throw new Error(gstError);
      }
      const panError = validateIdentifierCode(form.pan_number, "PAN number", 16);
      if (panError) {
        throw new Error(panError);
      }
      const creditLimit = form.credit_limit.trim() ? Number(form.credit_limit) : 0;
      if (!Number.isFinite(creditLimit) || creditLimit < 0) {
        throw new Error("Credit limit must be 0 or higher.");
      }
      const paymentTermsDays = form.payment_terms_days.trim() ? Number(form.payment_terms_days) : 0;
      if (!Number.isInteger(paymentTermsDays) || paymentTermsDays < 0 || paymentTermsDays > 365) {
        throw new Error("Payment terms must be a whole number between 0 and 365.");
      }
      setBusy(true);
      const created = await createSteelCustomer({
        name: trimmedName,
        phone: form.phone || undefined,
        email: trimmedEmail || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        tax_id: form.tax_id || undefined,
        gst_number: form.gst_number || undefined,
        pan_number: form.pan_number || undefined,
        company_type: form.company_type || undefined,
        contact_person: form.contact_person || undefined,
        designation: form.designation || undefined,
        credit_limit: creditLimit || 0,
        payment_terms_days: paymentTermsDays,
        status: form.status,
        notes: form.notes || undefined,
      });
      setStatus(`Customer ${created.customer.name} added to the steel ledger.`);
      setForm({
        name: "",
        phone: "",
        email: "",
        address: "",
        city: "",
        state: "",
        tax_id: "",
        gst_number: "",
        pan_number: "",
        company_type: "trader",
        contact_person: "",
        designation: "",
        credit_limit: "",
        payment_terms_days: "30",
        status: "active",
        notes: "",
      });
      await loadData();
    } catch (reason) {
      if (reason instanceof ApiError || reason instanceof Error) {
        setError(reason.message);
      } else {
        setError("Could not create steel customer.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading steel customer ledger...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Steel Customers</CardTitle>
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
              <CardTitle>Steel customer ledger is factory-aware</CardTitle>
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
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Steel Customer Ledger</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Add the buyer before receivables start moving</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Keep buyer setup, receivables, and recovery context in one place before invoices and dispatches stack up.
              </p>
            </div>
          </div>
        </section>

        {/* AUDIT: BUTTON_CLUTTER - keep route jumps available in a secondary tray so customer creation stays primary. */}
        <details className="rounded-[28px] border border-[var(--border)] bg-[rgba(10,14,24,0.78)] p-5">
          <summary className="cursor-pointer list-none text-sm font-semibold text-white marker:hidden">
            Ledger tools
          </summary>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/steel">
              <Button variant="outline">Steel hub</Button>
            </Link>
            <Link href="/steel/invoices">
              <Button variant="ghost">Invoices</Button>
            </Link>
            <Link href="/steel/dispatches">
              <Button variant="ghost">Dispatches</Button>
            </Link>
          </div>
        </details>

        {/* AUDIT: FLOW_BROKEN - add a short customer setup path so the first move is obvious before the ledger expands. */}
        <section className="grid gap-3 md:grid-cols-3">
          {[
            { step: "1. Add buyer", caption: "Create the customer profile first." },
            { step: "2. Set limits", caption: "Capture credit, terms, and status." },
            { step: "3. Open ledger", caption: "Review receivables and follow-up next." },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-[24px] border border-[var(--border)] bg-[rgba(10,14,24,0.72)] px-5 py-4"
            >
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">{item.step}</div>
              <div className="mt-2 text-sm text-[var(--muted)]">{item.caption}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Customers</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{customers.length}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Outstanding</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{formatCurrency(totals.outstanding)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Overdue</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{formatCurrency(totals.overdue)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">High Risk</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{totals.highRisk}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Open Follow-up</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{totals.followUps}</CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Create Customer</div>
              <CardTitle className="text-xl">Add buyer profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-[var(--muted)]">Customer Name</label>
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Buyer / customer name" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-[var(--muted)]">Contact Person</label>
                  <Input value={form.contact_person} onChange={(event) => setForm((current) => ({ ...current, contact_person: event.target.value }))} placeholder="Primary contact person" />
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Designation</label>
                  <Input value={form.designation} onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))} placeholder="Purchase manager / owner" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-[var(--muted)]">Phone</label>
                  <Input type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+91..." />
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Email</label>
                  <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="buyer@example.com" />
                </div>
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Address</label>
                <Textarea value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="Billing / delivery address" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-[var(--muted)]">City</label>
                  <Input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} placeholder="Mumbai" />
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">State</label>
                  <Input value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))} placeholder="Maharashtra" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm text-[var(--muted)]">GST</label>
                  <Input value={form.gst_number} onChange={(event) => setForm((current) => ({ ...current, gst_number: event.target.value }))} placeholder="GST number" />
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">PAN</label>
                  <Input value={form.pan_number} onChange={(event) => setForm((current) => ({ ...current, pan_number: event.target.value }))} placeholder="PAN number" />
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Legacy Tax ID</label>
                  <Input value={form.tax_id} onChange={(event) => setForm((current) => ({ ...current, tax_id: event.target.value }))} placeholder="Optional tax identifier" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-[var(--muted)]">Company Type</label>
                  <Select value={form.company_type} onChange={(event) => setForm((current) => ({ ...current, company_type: event.target.value }))}>
                    <option value="trader">Trader</option>
                    <option value="manufacturer">Manufacturer</option>
                    <option value="contractor">Contractor</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Status</label>
                  <Select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as "active" | "on_hold" | "blocked" }))}>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="blocked">Blocked</option>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-[var(--muted)]">Credit Limit</label>
                  <Input type="number" min="0" step="0.01" value={form.credit_limit} onChange={(event) => setForm((current) => ({ ...current, credit_limit: event.target.value }))} placeholder="500000" />
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Payment Terms (days)</label>
                  <Input type="number" min="0" step="1" inputMode="numeric" value={form.payment_terms_days} onChange={(event) => setForm((current) => ({ ...current, payment_terms_days: event.target.value }))} placeholder="30" />
                </div>
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Notes</label>
                <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Payment habits, follow-up notes, preferred material" />
              </div>
              <Button disabled={busy || !canManage} onClick={() => void submitCustomer()}>
                {canManage ? (busy ? "Saving..." : "Create customer") : "Owner / manager / admin / accountant access required"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Customer Directory</div>
              <CardTitle className="text-xl">Receivables and recovery at a glance</CardTitle>
            </CardHeader>
            <CardContent>
              {/* AUDIT: DENSITY_OVERLOAD - keep the full receivables directory available in a secondary reveal so the create form remains the first move. */}
              <details className="rounded-[24px] border border-[var(--border)] bg-[rgba(12,18,28,0.56)] p-4" open={customers.length <= 6}>
                <summary className="cursor-pointer list-none text-sm font-semibold text-white marker:hidden">
                  View directory
                </summary>
                <ResponsiveScrollArea
                  className="mt-4 rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                  debugLabel="steel-customers-directory"
                >
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-3 font-medium">Customer</th>
                        <th className="px-3 py-3 font-medium">Risk</th>
                        <th className="px-3 py-3 font-medium">Lifecycle</th>
                        <th className="px-3 py-3 font-medium">Outstanding</th>
                        <th className="px-3 py-3 font-medium">Credit</th>
                        <th className="px-3 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((customer) => (
                        <tr key={customer.id} className="border-b border-[var(--border)]/60 last:border-none">
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-semibold text-white">{customer.name}</div>
                              <div className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${verificationBadgeClass(customer.verification_status)}`}>
                                {customer.verification_status.replace("_", " ")}
                              </div>
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {customer.customer_code || "Code pending"} {" | "} {customer.contact_person || customer.phone || customer.email || "Contact pending"}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className={`inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${riskBadgeClass(customer.risk_level)}`}>
                              {customer.risk_level}
                            </div>
                            <div className="mt-2 text-xs text-[var(--muted)]">
                              {customer.overdue_days} overdue days {" | "} score {customer.risk_score.toFixed(0)}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-semibold text-white">
                              {customer.open_follow_up_count ? `${customer.open_follow_up_count} open task${customer.open_follow_up_count === 1 ? "" : "s"}` : "Clear"}
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {customer.next_follow_up_date ? `Next ${formatDate(customer.next_follow_up_date)}` : "No follow-up due"}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-semibold text-white">{formatCurrency(customer.outstanding_amount_inr)}</div>
                            <div className="text-xs text-[var(--muted)]">Overdue {formatCurrency(customer.overdue_amount_inr)}</div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-semibold text-white">{customer.credit_limit ? `${customer.credit_used_percentage.toFixed(0)}%` : "No limit"}</div>
                            <div className="text-xs text-[var(--muted)]">{customer.credit_limit ? `${formatCurrency(customer.available_credit_inr)} available` : `${customer.payment_terms_days} day terms`}</div>
                          </td>
                          <td className="px-3 py-3">
                            <Link href={`/steel/customers/${customer.id}`} className="text-xs font-medium text-[var(--accent)] hover:underline">
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                      {!customers.length ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-[var(--muted)]">
                            No steel customers yet. Add the first buyer profile or create an invoice to auto-create one from the customer name.
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
