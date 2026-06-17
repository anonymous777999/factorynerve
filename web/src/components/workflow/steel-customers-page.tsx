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

const GST_MAX_LENGTH = 15;
const PAN_MAX_LENGTH = 10;
const GST_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

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

function normalizePhoneInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 15);
}

function normalizeGstInput(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, GST_MAX_LENGTH);
}

function normalizePanInput(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, PAN_MAX_LENGTH);
}

function normalizeCreditLimitInput(value: string) {
  const sanitized = value.replace(/[^0-9.]/g, "");
  const [whole = "", ...decimalParts] = sanitized.split(".");
  return decimalParts.length ? `${whole}.${decimalParts.join("")}` : whole;
}

function normalizePaymentTermsInput(value: string) {
  return value.replace(/\D/g, "");
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
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
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

  const markTouched = useCallback((field: string) => {
    setTouched((current) => (current[field] ? current : { ...current, [field]: true }));
  }, []);

  const trimField = useCallback((field: keyof typeof form) => {
    setForm((current) => {
      const value = current[field];
      if (typeof value !== "string") {
        return current;
      }
      const trimmedValue = value.trim();
      return trimmedValue === value ? current : { ...current, [field]: trimmedValue };
    });
  }, [form]);

  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";
  const canManage = Boolean(user && ["owner", "manager"].includes(user.role));

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

  const fieldErrors = useMemo(() => {
    const errors: Partial<Record<keyof typeof form, string>> = {};
    const trimmedName = form.name.trim();
    const normalizedPhone = normalizePhoneInput(form.phone);
    const trimmedEmail = form.email.trim();
    const gstNumber = form.gst_number.trim();
    const panNumber = form.pan_number.trim();
    const creditLimit = form.credit_limit.trim();
    const paymentTerms = form.payment_terms_days.trim();

    if (!trimmedName) {
      errors.name = "Customer name is required.";
    }
    if (!normalizedPhone && !trimmedEmail) {
      errors.phone = "At least one contact method is required.";
    } else if (validatePhoneNumber(normalizedPhone, "Customer phone")) {
      errors.phone = "Enter a valid phone number.";
    }
    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      errors.email = "Enter a valid email address.";
    }
    if (gstNumber && !GST_PATTERN.test(gstNumber)) {
      errors.gst_number = "Enter a valid GST number (e.g. 22AAAAA0000A1Z5).";
    }
    if (panNumber && !PAN_PATTERN.test(panNumber)) {
      errors.pan_number = "Enter a valid PAN (e.g. ABCDE1234F).";
    }
    if (creditLimit) {
      const numericValue = Number(creditLimit);
      if (!Number.isFinite(numericValue) || numericValue < 0) {
        errors.credit_limit = "Credit limit must be 0 or higher.";
      }
    }
    if (!paymentTerms) {
      errors.payment_terms_days = "Payment terms must be a whole number greater than 0.";
    } else {
      const numericValue = Number(paymentTerms);
      if (!Number.isInteger(numericValue) || numericValue <= 0) {
        errors.payment_terms_days = "Payment terms must be a whole number greater than 0.";
      }
    }
    return errors;
  }, [form]);

  const showFieldError = useCallback(
    (field: keyof typeof form) => Boolean(fieldErrors[field] && (attemptedSubmit || touched[field])),
    [attemptedSubmit, fieldErrors, touched],
  );

  const submitCustomer = async () => {
    setStatus("");
    setError("");
    try {
      setAttemptedSubmit(true);
      const trimmedName = form.name.trim();
      const trimmedEmail = form.email.trim();
      const normalizedPhone = normalizePhoneInput(form.phone);
      const trimmedTaxId = form.tax_id.trim();
      const normalizedGstNumber = normalizeGstInput(form.gst_number);
      const normalizedPanNumber = normalizePanInput(form.pan_number);
      const trimmedAddress = form.address.trim();
      const trimmedCity = form.city.trim();
      const trimmedState = form.state.trim();
      const trimmedContactPerson = form.contact_person.trim();
      const trimmedDesignation = form.designation.trim();
      const trimmedNotes = form.notes.trim();
      if (!trimmedName) {
        throw new Error("Customer name is required.");
      }
      if (!normalizedPhone && !trimmedEmail) {
        throw new Error("At least one contact method is required.");
      }
      if (trimmedEmail && !isValidEmail(trimmedEmail)) {
        throw new Error("Customer email must be a valid email address.");
      }
      const phoneError = validatePhoneNumber(normalizedPhone, "Customer phone");
      if (phoneError) {
        throw new Error(phoneError);
      }
      const taxIdError = validateIdentifierCode(trimmedTaxId, "Tax ID", 64);
      if (taxIdError) {
        throw new Error(taxIdError);
      }
      if (normalizedGstNumber && !GST_PATTERN.test(normalizedGstNumber)) {
        throw new Error("Enter a valid GST number (e.g. 22AAAAA0000A1Z5).");
      }
      if (normalizedPanNumber && !PAN_PATTERN.test(normalizedPanNumber)) {
        throw new Error("Enter a valid PAN (e.g. ABCDE1234F).");
      }
      const creditLimit = form.credit_limit.trim() ? Number(form.credit_limit) : 0;
      if (!Number.isFinite(creditLimit) || creditLimit < 0) {
        throw new Error("Credit limit must be 0 or higher.");
      }
      const paymentTermsDays = form.payment_terms_days.trim() ? Number(form.payment_terms_days) : 0;
      if (!Number.isInteger(paymentTermsDays) || paymentTermsDays <= 0 || paymentTermsDays > 365) {
        throw new Error("Payment terms must be a whole number greater than 0.");
      }
      setBusy(true);
      const created = await createSteelCustomer({
        name: trimmedName,
        phone: normalizedPhone || undefined,
        email: trimmedEmail || undefined,
        address: trimmedAddress || undefined,
        city: trimmedCity || undefined,
        state: trimmedState || undefined,
        tax_id: trimmedTaxId || undefined,
        gst_number: normalizedGstNumber || undefined,
        pan_number: normalizedPanNumber || undefined,
        company_type: form.company_type || undefined,
        contact_person: trimmedContactPerson || undefined,
        designation: trimmedDesignation || undefined,
        credit_limit: creditLimit || 0,
        payment_terms_days: paymentTermsDays,
        status: form.status,
        notes: trimmedNotes || undefined,
      });
      setStatus(`Customer ${created.customer.name} added to the steel ledger.`);
      setAttemptedSubmit(false);
      setTouched({});
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

  if (!canManage) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Customer Ledger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-[var(--muted)]">The customer ledger and commercial exposure tracking are available to managers and owners.</div>
            <div className="flex gap-3">
              <Link href="/steel">
                <Button>Back to Steel Hub</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline">Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
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
                <Input
                  aria-invalid={showFieldError("name")}
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  onBlur={() => {
                    markTouched("name");
                    trimField("name");
                  }}
                  placeholder="Buyer / customer name"
                />
                {showFieldError("name") ? <div className="mt-1 text-xs text-red-400">{fieldErrors.name}</div> : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-[var(--muted)]">Contact Person</label>
                  <Input
                    value={form.contact_person}
                    onChange={(event) => setForm((current) => ({ ...current, contact_person: event.target.value }))}
                    onBlur={() => trimField("contact_person")}
                    placeholder="Primary contact person"
                  />
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Designation</label>
                  <Input
                    value={form.designation}
                    onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))}
                    onBlur={() => trimField("designation")}
                    placeholder="Purchase manager / owner"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-[var(--muted)]">Phone</label>
                  <Input
                    type="tel"
                    autoComplete="tel"
                    inputMode="numeric"
                    maxLength={15}
                    aria-invalid={showFieldError("phone")}
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: normalizePhoneInput(event.target.value) }))}
                    onBlur={() => markTouched("phone")}
                    placeholder="9876543210"
                  />
                  {showFieldError("phone") ? <div className="mt-1 text-xs text-red-400">{fieldErrors.phone}</div> : null}
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Email</label>
                  <Input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    aria-invalid={showFieldError("email")}
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value.replace(/\s+/g, "") }))}
                    onBlur={() => {
                      markTouched("email");
                      trimField("email");
                    }}
                    placeholder="buyer@example.com"
                  />
                  {showFieldError("email") ? <div className="mt-1 text-xs text-red-400">{fieldErrors.email}</div> : null}
                </div>
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Address</label>
                <Textarea
                  value={form.address}
                  onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                  onBlur={() => trimField("address")}
                  placeholder="Billing / delivery address"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-[var(--muted)]">City</label>
                  <Input
                    value={form.city}
                    onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                    onBlur={() => trimField("city")}
                    placeholder="Mumbai"
                  />
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">State</label>
                  <Input
                    value={form.state}
                    onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}
                    onBlur={() => trimField("state")}
                    placeholder="Maharashtra"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm text-[var(--muted)]">GST</label>
                  <Input
                    autoCapitalize="characters"
                    maxLength={GST_MAX_LENGTH}
                    aria-invalid={showFieldError("gst_number")}
                    value={form.gst_number}
                    onChange={(event) => setForm((current) => ({ ...current, gst_number: normalizeGstInput(event.target.value) }))}
                    onBlur={() => markTouched("gst_number")}
                    placeholder="22AAAAA0000A1Z5"
                  />
                  {showFieldError("gst_number") ? <div className="mt-1 text-xs text-red-400">{fieldErrors.gst_number}</div> : null}
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">PAN</label>
                  <Input
                    autoCapitalize="characters"
                    maxLength={PAN_MAX_LENGTH}
                    aria-invalid={showFieldError("pan_number")}
                    value={form.pan_number}
                    onChange={(event) => setForm((current) => ({ ...current, pan_number: normalizePanInput(event.target.value) }))}
                    onBlur={() => markTouched("pan_number")}
                    placeholder="ABCDE1234F"
                  />
                  {showFieldError("pan_number") ? <div className="mt-1 text-xs text-red-400">{fieldErrors.pan_number}</div> : null}
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Legacy Tax ID</label>
                  <Input
                    value={form.tax_id}
                    onChange={(event) => setForm((current) => ({ ...current, tax_id: event.target.value }))}
                    onBlur={() => trimField("tax_id")}
                    placeholder="Optional tax identifier"
                  />
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
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    aria-invalid={showFieldError("credit_limit")}
                    value={form.credit_limit}
                    onChange={(event) => setForm((current) => ({ ...current, credit_limit: normalizeCreditLimitInput(event.target.value) }))}
                    onBlur={() => markTouched("credit_limit")}
                    onKeyDown={(event) => {
                      if (["e", "E", "+", "-"].includes(event.key)) {
                        event.preventDefault();
                      }
                    }}
                    placeholder="500000"
                  />
                  {showFieldError("credit_limit") ? <div className="mt-1 text-xs text-red-400">{fieldErrors.credit_limit}</div> : null}
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Payment Terms (days)</label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    aria-invalid={showFieldError("payment_terms_days")}
                    value={form.payment_terms_days}
                    onChange={(event) => setForm((current) => ({ ...current, payment_terms_days: normalizePaymentTermsInput(event.target.value) }))}
                    onBlur={() => markTouched("payment_terms_days")}
                    onKeyDown={(event) => {
                      if (["e", "E", "+", "-", "."].includes(event.key)) {
                        event.preventDefault();
                      }
                    }}
                    placeholder="30"
                  />
                  {showFieldError("payment_terms_days") ? <div className="mt-1 text-xs text-red-400">{fieldErrors.payment_terms_days}</div> : null}
                </div>
              </div>
              <div>
                <label className="text-sm text-[var(--muted)]">Notes</label>
                <Textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  onBlur={() => trimField("notes")}
                  placeholder="Payment habits, follow-up notes, preferred material"
                />
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
