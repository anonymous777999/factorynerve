"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import {
  createSteelCustomerFollowUpTask,
  createSteelCustomerPayment,
  getSteelCustomerVerificationDocumentUrl,
  getSteelCustomerLedger,
  reviewSteelCustomerVerification,
  runSteelCustomerVerificationCheck,
  type SteelCustomerLedger,
  type SteelCustomerVerificationDocType,
  type SteelCustomerVerificationFieldStatus,
  type SteelCustomerVerificationStatus,
  type SteelFollowUpTaskPriority,
  type SteelFollowUpTaskStatus,
  type SteelPaymentMode,
  updateSteelCustomerFollowUpTaskStatus,
  uploadSteelCustomerVerificationDocument,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { validateReferenceCode } from "@/lib/validation";

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
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
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function riskBadgeClass(level: SteelCustomerLedger["ledger_summary"]["risk_level"]) {
  if (level === "high") return "border-rose-400/35 bg-rose-500/12 text-rose-200";
  if (level === "medium") return "border-amber-400/35 bg-amber-500/12 text-amber-200";
  return "border-emerald-400/35 bg-emerald-500/12 text-emerald-200";
}

function verificationBadgeClass(status: SteelCustomerVerificationStatus) {
  if (status === "verified") return "border-emerald-400/35 bg-emerald-500/12 text-emerald-200";
  if (status === "rejected" || status === "mismatch") return "border-rose-400/35 bg-rose-500/12 text-rose-200";
  if (status === "pending_review" || status === "format_valid") return "border-amber-400/35 bg-amber-500/12 text-amber-200";
  return "border-slate-400/35 bg-slate-500/12 text-slate-200";
}

function formatVerificationLabel(value: string | null | undefined) {
  if (!value) return "Not available";
  return value.replaceAll("_", " ");
}

function fieldStatusTone(status: SteelCustomerVerificationFieldStatus) {
  if (status === "matched" || status === "format_valid") return "text-emerald-300";
  if (status === "mismatch" || status === "invalid_format") return "text-rose-300";
  if (status === "missing") return "text-amber-300";
  return "text-[var(--muted)]";
}

function alertToneClass(level: "info" | "warning" | "critical") {
  if (level === "critical") return "border-rose-400/30 bg-rose-500/10 text-rose-100";
  if (level === "warning") return "border-amber-400/30 bg-amber-500/10 text-amber-100";
  return "border-cyan-400/30 bg-cyan-500/10 text-cyan-100";
}

function taskPriorityBadgeClass(priority: SteelFollowUpTaskPriority) {
  if (priority === "critical") return "border-rose-400/35 bg-rose-500/12 text-rose-200";
  if (priority === "high") return "border-amber-400/35 bg-amber-500/12 text-amber-200";
  if (priority === "medium") return "border-cyan-400/35 bg-cyan-500/12 text-cyan-200";
  return "border-slate-400/35 bg-slate-500/12 text-slate-200";
}

function taskStatusBadgeClass(status: SteelFollowUpTaskStatus) {
  if (status === "done") return "border-emerald-400/35 bg-emerald-500/12 text-emerald-200";
  if (status === "in_progress") return "border-amber-400/35 bg-amber-500/12 text-amber-200";
  if (status === "cancelled") return "border-rose-400/35 bg-rose-500/12 text-rose-200";
  return "border-cyan-400/35 bg-cyan-500/12 text-cyan-200";
}

function formatTaskLabel(value: string | null | undefined) {
  if (!value) return "Not set";
  return value.replaceAll("_", " ");
}

type Props = {
  customerId: number;
};

const PAYMENT_MODE_OPTIONS: SteelPaymentMode[] = ["bank_transfer", "cash", "cheque", "upi"];
const PAYMENT_MODES = new Set<SteelPaymentMode>(PAYMENT_MODE_OPTIONS);
const FOLLOW_UP_PRIORITY_OPTIONS: SteelFollowUpTaskPriority[] = ["low", "medium", "high", "critical"];

function parsePositiveAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Amount is required.");
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Amount must be greater than 0.");
  }
  return parsed;
}

export function SteelCustomerLedgerPage({ customerId }: Props) {
  const { user, activeFactory, loading, error: sessionError } = useSession();
  const [ledger, setLedger] = useState<SteelCustomerLedger | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [taskBusy, setTaskBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [paymentForm, setPaymentForm] = useState({
    invoice_id: "",
    payment_date: todayValue(),
    amount: "",
    payment_mode: "bank_transfer" as SteelPaymentMode,
    reference_number: "",
    notes: "",
  });
  const [reviewForm, setReviewForm] = useState({
    official_legal_name: "",
    official_trade_name: "",
    official_state: "",
    verification_source: "manual_review",
    mismatch_reason: "",
  });
  const [taskForm, setTaskForm] = useState({
    title: "",
    note: "",
    priority: "medium" as SteelFollowUpTaskPriority,
    due_date: todayValue(),
    invoice_id: "",
  });

  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";
  const canRecordPayment = Boolean(user && ["owner", "admin", "manager", "accountant"].includes(user.role));
  const canManageVerification = canRecordPayment;
  const canManageTasks = canRecordPayment;

  const loadLedger = useCallback(async () => {
    if (!isSteelFactory) {
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    try {
      const payload = await getSteelCustomerLedger(customerId);
      setLedger(payload);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load steel customer ledger.");
    } finally {
      setPageLoading(false);
    }
  }, [customerId, isSteelFactory]);

  useEffect(() => {
    if (!user || !isSteelFactory) {
      setPageLoading(false);
      return;
    }
    void loadLedger();
  }, [isSteelFactory, loadLedger, user]);

  useEffect(() => {
    if (!ledger) return;
    setReviewForm({
      official_legal_name: ledger.customer.official_legal_name || "",
      official_trade_name: ledger.customer.official_trade_name || "",
      official_state: ledger.customer.official_state || "",
      verification_source: ledger.customer.verification_source || "manual_review",
      mismatch_reason: ledger.customer.mismatch_reason || "",
    });
  }, [ledger]);

  const openInvoices = useMemo(
    () => (ledger?.invoices || []).filter((invoice) => Number(invoice.outstanding_amount_inr || 0) > 0),
    [ledger?.invoices],
  );
  const overdueInvoices = useMemo(
    () => openInvoices.filter((invoice) => Boolean(invoice.is_overdue)).sort((left, right) => Number(right.overdue_days || 0) - Number(left.overdue_days || 0)),
    [openInvoices],
  );
  const openTaskCount = useMemo(
    () => (ledger?.follow_up_tasks || []).filter((task) => task.status === "open" || task.status === "in_progress").length,
    [ledger?.follow_up_tasks],
  );
  const recoveryFocusInvoice = overdueInvoices[0] || openInvoices[0] || null;

  const submitPayment = async () => {
    if (!ledger) return;
    setStatus("");
    setError("");
    try {
      const amount = parsePositiveAmount(paymentForm.amount);
      const invoiceId = paymentForm.invoice_id ? Number(paymentForm.invoice_id) : undefined;
      if (invoiceId !== undefined && (!Number.isInteger(invoiceId) || invoiceId <= 0)) {
        throw new Error("Invoice selection is invalid.");
      }
      if (!PAYMENT_MODES.has(paymentForm.payment_mode)) {
        throw new Error("Payment mode is invalid.");
      }
      const referenceError = validateReferenceCode(paymentForm.reference_number, "Reference number", 80);
      if (referenceError) {
        throw new Error(referenceError);
      }
      setPaymentBusy(true);
      await createSteelCustomerPayment({
        customer_id: ledger.customer.id,
        invoice_id: invoiceId,
        payment_date: paymentForm.payment_date,
        amount,
        payment_mode: paymentForm.payment_mode,
        reference_number: paymentForm.reference_number || undefined,
        notes: paymentForm.notes || undefined,
      });
      setStatus("Customer payment recorded successfully.");
      setPaymentForm({
        invoice_id: "",
        payment_date: todayValue(),
        amount: "",
        payment_mode: "bank_transfer" as SteelPaymentMode,
        reference_number: "",
        notes: "",
      });
      await loadLedger();
    } catch (reason) {
      if (reason instanceof ApiError || reason instanceof Error) {
        setError(reason.message);
      } else {
        setError("Could not record customer payment.");
      }
    } finally {
      setPaymentBusy(false);
    }
  };

  const runVerificationCheck = async () => {
    if (!ledger) return;
    setStatus("");
    setError("");
    try {
      setVerificationBusy(true);
      await runSteelCustomerVerificationCheck(ledger.customer.id);
      setStatus("Verification checks refreshed.");
      await loadLedger();
    } catch (reason) {
      if (reason instanceof ApiError || reason instanceof Error) {
        setError(reason.message);
      } else {
        setError("Could not run verification checks.");
      }
    } finally {
      setVerificationBusy(false);
    }
  };

  const uploadVerificationDocument = async (
    documentType: SteelCustomerVerificationDocType,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!ledger || !file) return;
    setStatus("");
    setError("");
    try {
      setVerificationBusy(true);
      await uploadSteelCustomerVerificationDocument(ledger.customer.id, documentType, file);
      setStatus(`${documentType === "pan" ? "PAN" : "GST"} document uploaded.`);
      await loadLedger();
    } catch (reason) {
      if (reason instanceof ApiError || reason instanceof Error) {
        setError(reason.message);
      } else {
        setError("Could not upload verification document.");
      }
    } finally {
      setVerificationBusy(false);
    }
  };

  const submitVerificationReview = async (decision: "approve" | "reject") => {
    if (!ledger) return;
    setStatus("");
    setError("");
    try {
      if (decision === "reject" && !reviewForm.mismatch_reason.trim()) {
        throw new Error("Add a mismatch reason before rejecting verification.");
      }
      setVerificationBusy(true);
      await reviewSteelCustomerVerification(ledger.customer.id, {
        decision,
        official_legal_name: reviewForm.official_legal_name || undefined,
        official_trade_name: reviewForm.official_trade_name || undefined,
        official_state: reviewForm.official_state || undefined,
        verification_source: reviewForm.verification_source || undefined,
        mismatch_reason: reviewForm.mismatch_reason || undefined,
      });
      setStatus(decision === "approve" ? "Customer marked as verified." : "Customer verification rejected.");
      await loadLedger();
    } catch (reason) {
      if (reason instanceof ApiError || reason instanceof Error) {
        setError(reason.message);
      } else {
        setError("Could not update verification review.");
      }
    } finally {
      setVerificationBusy(false);
    }
  };

  const submitFollowUpTask = async () => {
    if (!ledger) return;
    setStatus("");
    setError("");
    try {
      const trimmedTitle = taskForm.title.trim();
      if (!trimmedTitle) {
        throw new Error("Task title is required.");
      }
      const invoiceId = taskForm.invoice_id ? Number(taskForm.invoice_id) : undefined;
      if (invoiceId !== undefined && (!Number.isInteger(invoiceId) || invoiceId <= 0)) {
        throw new Error("Task invoice selection is invalid.");
      }
      setTaskBusy(true);
      await createSteelCustomerFollowUpTask(ledger.customer.id, {
        title: trimmedTitle,
        note: taskForm.note.trim() || undefined,
        priority: taskForm.priority,
        due_date: taskForm.due_date || undefined,
        invoice_id: invoiceId,
      });
      setStatus("Follow-up task added to this customer lifecycle.");
      setTaskForm({
        title: "",
        note: "",
        priority: "medium",
        due_date: todayValue(),
        invoice_id: "",
      });
      await loadLedger();
    } catch (reason) {
      if (reason instanceof ApiError || reason instanceof Error) {
        setError(reason.message);
      } else {
        setError("Could not create follow-up task.");
      }
    } finally {
      setTaskBusy(false);
    }
  };

  const setTaskStatus = async (taskId: number, nextStatus: SteelFollowUpTaskStatus) => {
    if (!ledger) return;
    setStatus("");
    setError("");
    try {
      setTaskBusy(true);
      await updateSteelCustomerFollowUpTaskStatus(ledger.customer.id, taskId, { status: nextStatus });
      setStatus(`Task moved to ${formatTaskLabel(nextStatus)}.`);
      await loadLedger();
    } catch (reason) {
      if (reason instanceof ApiError || reason instanceof Error) {
        setError(reason.message);
      } else {
        setError("Could not update follow-up task.");
      }
    } finally {
      setTaskBusy(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading customer ledger...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Steel Customer Ledger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{sessionError || "Please login to continue."}</div>
            <Link href="/login" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">Open Login</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!isSteelFactory) {
    return (
      <main className="min-h-screen px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8">
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
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!ledger) {
    return (
      <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Steel Customer Ledger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-400">{error || "Customer ledger not found."}</div>
            <Link href="/steel/customers" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto">Back to Customers</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {status ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/12 px-4 py-3 text-sm text-emerald-100">
            {status}
          </div>
        ) : null}
        {error || sessionError ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/12 px-4 py-3 text-sm text-rose-100">
            {error || sessionError}
          </div>
        ) : null}
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))] p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Customer Ledger</div>
              <h1 className="mt-2 text-2xl font-semibold sm:text-3xl md:text-4xl">{ledger.customer.name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Keep invoice value, payment receipts, and outstanding exposure tied to one steel customer record.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link href="/steel/customers" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto">Back to Customers</Button>
              </Link>
              <Link href="/steel/invoices" className="w-full sm:w-auto">
                <Button variant="ghost" className="w-full sm:w-auto">Open Invoices</Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Invoice Total</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{formatCurrency(ledger.ledger_summary.invoice_total_inr)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Outstanding</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{formatCurrency(ledger.ledger_summary.outstanding_amount_inr)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Overdue</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{formatCurrency(ledger.ledger_summary.overdue_amount_inr)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Risk</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${riskBadgeClass(ledger.ledger_summary.risk_level)}`}>
                {ledger.ledger_summary.risk_level}
              </div>
              <div className="text-sm text-[var(--muted)]">
                Score {ledger.ledger_summary.risk_score.toFixed(0)} {" - "} {ledger.ledger_summary.overdue_days} overdue days
              </div>
            </CardContent>
          </Card>
        </section>

        {ledger.alerts.length ? (
          <section className="grid gap-3">
            {ledger.alerts.map((alert, index) => (
              <div
                key={`${alert.title}-${index}`}
                className={`rounded-2xl border px-4 py-3 text-sm ${alertToneClass(alert.level)}`}
              >
                <div className="font-semibold">{alert.title}</div>
                <div className="mt-1 opacity-90">{alert.detail}</div>
              </div>
            ))}
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
            <CardHeader>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Collections Focus</div>
              <CardTitle className="text-xl">Highest recovery priority</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {recoveryFocusInvoice ? (
                <>
                  <div className="font-semibold text-white">{recoveryFocusInvoice.invoice_number}</div>
                  <div className="text-[var(--muted)]">
                    {formatCurrency(recoveryFocusInvoice.outstanding_amount_inr)} outstanding
                    {recoveryFocusInvoice.is_overdue ? ` for ${recoveryFocusInvoice.overdue_days} overdue days` : " and not overdue yet"}
                  </div>
                  <Link href={`/steel/invoices/${recoveryFocusInvoice.id}`}>
                    <Button variant="outline">Open Priority Invoice</Button>
                  </Link>
                </>
              ) : (
                <div className="text-[var(--muted)]">No open recovery exposure for this customer right now.</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
            <CardHeader>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Exposure Mix</div>
              <CardTitle className="text-xl">Open vs overdue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-3 py-3">
                <span className="text-[var(--muted)]">Open invoices</span>
                <span className="font-semibold text-white">{openInvoices.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-3 py-3">
                <span className="text-[var(--muted)]">Overdue invoices</span>
                <span className="font-semibold text-white">{overdueInvoices.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-3 py-3">
                <span className="text-[var(--muted)]">Late payment count</span>
                <span className="font-semibold text-white">{ledger.ledger_summary.late_payment_count}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
            <CardHeader>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">Next Team Action</div>
              <CardTitle className="text-xl">Recovery handoff</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="text-[var(--muted)]">
                {openTaskCount
                  ? `${openTaskCount} follow-up tasks already exist. Use them to close the open invoice trail.`
                  : "No recovery tasks are open yet. Create one from this ledger before the exposure ages further."}
              </div>
              <div className="text-[var(--muted)]">
                {ledger.customer.next_follow_up_date
                  ? `Next follow-up is due on ${formatDate(ledger.customer.next_follow_up_date)}.`
                  : "No due date is set for the next recovery touchpoint."}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Customer Snapshot</div>
              <CardTitle className="text-xl">Profile and payment capture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Customer Code</div>
                  <div className="mt-2 text-sm font-semibold text-white">{ledger.customer.customer_code || "Pending"}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Status</div>
                  <div className="mt-2 text-sm font-semibold text-white">{ledger.customer.status.replace("_", " ")}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Phone</div>
                  <div className="mt-2 text-sm font-semibold text-white">{ledger.customer.phone || "Not set"}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Email</div>
                  <div className="mt-2 text-sm font-semibold text-white">{ledger.customer.email || "Not set"}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Contact Person</div>
                  <div className="mt-2 text-sm font-semibold text-white">{ledger.customer.contact_person || "Not set"}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">GST / PAN</div>
                  <div className="mt-2 text-sm font-semibold text-white">{ledger.customer.gst_number || ledger.customer.tax_id || "Not set"}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {ledger.customer.pan_number || "PAN not set"} {" - "} {formatVerificationLabel(ledger.customer.verification_status)}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Credit Policy</div>
                  <div className="mt-2 text-sm font-semibold text-white">{formatCurrency(ledger.customer.credit_limit)} limit</div>
                  <div className="text-xs text-[var(--muted)]">
                    {ledger.customer.payment_terms_days} day terms {" - "} {formatCurrency(ledger.customer.available_credit_inr)} available
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Recovery Queue</div>
                  <div className="mt-2 text-sm font-semibold text-white">{openTaskCount} open follow-ups</div>
                  <div className="text-xs text-[var(--muted)]">
                    {ledger.customer.next_follow_up_date ? `Next due ${formatDate(ledger.customer.next_follow_up_date)}` : "No follow-up due yet"}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Location</div>
                  <div className="mt-2 text-sm font-semibold text-white">{[ledger.customer.city, ledger.customer.state].filter(Boolean).join(", ") || "Not set"}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4 sm:col-span-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Address</div>
                  <div className="mt-2 text-sm font-semibold text-white">{ledger.customer.address || "Not set"}</div>
                </div>
              </div>

              <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">Verification</div>
                    <div className="text-xs text-[var(--muted)]">
                      Format checks, uploaded documents, and manual approval for PAN and GST data.
                    </div>
                  </div>
                  <div className={`inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${verificationBadgeClass(ledger.customer.verification_status)}`}>
                    {formatVerificationLabel(ledger.customer.verification_status)}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl border border-[var(--border)] bg-[rgba(7,12,20,0.72)] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">PAN</div>
                    <div className="mt-2 text-sm font-semibold text-white">{ledger.customer.pan_number || "Not set"}</div>
                    <div className={`text-xs ${fieldStatusTone(ledger.customer.pan_status)}`}>
                      {formatVerificationLabel(ledger.customer.pan_status)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[rgba(7,12,20,0.72)] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">GST</div>
                    <div className="mt-2 text-sm font-semibold text-white">{ledger.customer.gst_number || "Not set"}</div>
                    <div className={`text-xs ${fieldStatusTone(ledger.customer.gst_status)}`}>
                      {formatVerificationLabel(ledger.customer.gst_status)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[rgba(7,12,20,0.72)] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Match Score</div>
                    <div className="mt-2 text-sm font-semibold text-white">{ledger.customer.match_score.toFixed(0)} / 100</div>
                    <div className="text-xs text-[var(--muted)]">{ledger.customer.verification_source || "system_check"}</div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[rgba(7,12,20,0.72)] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Legal Name Match</div>
                    <div className={`mt-2 text-sm font-semibold ${fieldStatusTone(ledger.customer.name_match_status)}`}>
                      {formatVerificationLabel(ledger.customer.name_match_status)}
                    </div>
                    <div className="text-xs text-[var(--muted)]">{ledger.customer.official_legal_name || "Official name not added"}</div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[rgba(7,12,20,0.72)] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">State Match</div>
                    <div className={`mt-2 text-sm font-semibold ${fieldStatusTone(ledger.customer.state_match_status)}`}>
                      {formatVerificationLabel(ledger.customer.state_match_status)}
                    </div>
                    <div className="text-xs text-[var(--muted)]">{ledger.customer.official_state || "Official state not added"}</div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[rgba(7,12,20,0.72)] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Documents</div>
                    <div className="mt-2 text-sm font-semibold text-white">
                      {ledger.customer.pan_document_url ? "PAN uploaded" : "PAN pending"}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {ledger.customer.gst_document_url ? "GST uploaded" : "GST pending"}
                    </div>
                  </div>
                </div>

                {ledger.customer.mismatch_reason ? (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                    {ledger.customer.mismatch_reason}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button className="w-full sm:w-auto" disabled={verificationBusy || !canManageVerification} onClick={() => void runVerificationCheck()}>
                    {verificationBusy ? "Checking..." : "Run Check"}
                  </Button>
                  <label className="inline-flex w-full cursor-pointer items-center justify-center rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-white transition hover:border-[var(--accent)] hover:text-[var(--accent)] sm:w-auto">
                    Upload PAN
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      disabled={verificationBusy || !canManageVerification}
                      onChange={(event) => void uploadVerificationDocument("pan", event)}
                    />
                  </label>
                  <label className="inline-flex w-full cursor-pointer items-center justify-center rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-white transition hover:border-[var(--accent)] hover:text-[var(--accent)] sm:w-auto">
                    Upload GST
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      disabled={verificationBusy || !canManageVerification}
                      onChange={(event) => void uploadVerificationDocument("gst", event)}
                    />
                  </label>
                  {ledger.customer.pan_document_url ? (
                    <a
                      href={getSteelCustomerVerificationDocumentUrl(ledger.customer.id, "pan")}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-full items-center justify-center rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-white transition hover:border-[var(--accent)] hover:text-[var(--accent)] sm:w-auto"
                    >
                      View PAN
                    </a>
                  ) : null}
                  {ledger.customer.gst_document_url ? (
                    <a
                      href={getSteelCustomerVerificationDocumentUrl(ledger.customer.id, "gst")}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-full items-center justify-center rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-white transition hover:border-[var(--accent)] hover:text-[var(--accent)] sm:w-auto"
                    >
                      View GST
                    </a>
                  ) : null}
                </div>

                {ledger.customer.verified_at ? (
                  <div className="text-xs text-[var(--muted)]">
                    Verified by {ledger.customer.verified_by_name || "team"} on {formatDate(ledger.customer.verified_at)}
                  </div>
                ) : null}

                {canManageVerification ? (
                  <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[rgba(7,12,20,0.72)] p-4">
                    <div className="text-sm font-semibold text-white">Manual review</div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-sm text-[var(--muted)]">Official Legal Name</label>
                        <Input
                          value={reviewForm.official_legal_name}
                          onChange={(event) => setReviewForm((current) => ({ ...current, official_legal_name: event.target.value }))}
                          placeholder="Name from GST certificate"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-[var(--muted)]">Official Trade Name</label>
                        <Input
                          value={reviewForm.official_trade_name}
                          onChange={(event) => setReviewForm((current) => ({ ...current, official_trade_name: event.target.value }))}
                          placeholder="Trade / shop name"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-sm text-[var(--muted)]">Official State</label>
                        <Input
                          value={reviewForm.official_state}
                          onChange={(event) => setReviewForm((current) => ({ ...current, official_state: event.target.value }))}
                          placeholder="State from official document"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-[var(--muted)]">Verification Source</label>
                        <Input
                          value={reviewForm.verification_source}
                          onChange={(event) => setReviewForm((current) => ({ ...current, verification_source: event.target.value }))}
                          placeholder="manual_review / gst_portal"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-[var(--muted)]">Mismatch Reason</label>
                      <Textarea
                        value={reviewForm.mismatch_reason}
                        onChange={(event) => setReviewForm((current) => ({ ...current, mismatch_reason: event.target.value }))}
                        placeholder="Use this when rejecting or documenting a mismatch"
                      />
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button className="w-full sm:w-auto" disabled={verificationBusy} onClick={() => void submitVerificationReview("approve")}>
                        {verificationBusy ? "Saving..." : "Approve Verification"}
                      </Button>
                      <Button variant="outline" className="w-full sm:w-auto" disabled={verificationBusy} onClick={() => void submitVerificationReview("reject")}>
                        Reject Verification
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                <div className="text-sm font-semibold text-white">Record payment</div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-[var(--muted)]">Payment Date</label>
                    <Input type="date" value={paymentForm.payment_date} onChange={(event) => setPaymentForm((current) => ({ ...current, payment_date: event.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Invoice (optional)</label>
                    <Select value={paymentForm.invoice_id} onChange={(event) => setPaymentForm((current) => ({ ...current, invoice_id: event.target.value }))}>
                      <option value="">Auto allocate oldest outstanding</option>
                      {openInvoices.map((invoice) => (
                        <option key={invoice.id} value={invoice.id}>
                          {invoice.invoice_number} - {formatCurrency(invoice.outstanding_amount_inr)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-[var(--muted)]">Amount</label>
                    <Input type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Payment Mode</label>
                    <Select value={paymentForm.payment_mode} onChange={(event) => setPaymentForm((current) => ({ ...current, payment_mode: event.target.value as SteelPaymentMode }))}>
                      {PAYMENT_MODE_OPTIONS.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode === "bank_transfer"
                            ? "Bank Transfer"
                            : mode === "cash"
                              ? "Cash"
                              : mode === "cheque"
                                ? "Cheque"
                                : "UPI"}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Reference Number</label>
                  <Input value={paymentForm.reference_number} onChange={(event) => setPaymentForm((current) => ({ ...current, reference_number: event.target.value }))} placeholder="UTR / cheque / receipt number" />
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Notes</label>
                  <Textarea value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional payment note" />
                </div>
                <Button className="w-full sm:w-auto" disabled={paymentBusy || !canRecordPayment} onClick={() => void submitPayment()}>
                  {canRecordPayment ? (paymentBusy ? "Recording Payment..." : "Record Customer Payment") : "Owner / manager / admin / accountant access required"}
                </Button>
              </div>

              <div className="space-y-4 rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">Create follow-up</div>
                    <div className="text-xs text-[var(--muted)]">
                      Add the next recovery or account-check step without leaving the customer ledger.
                    </div>
                  </div>
                  <div className="rounded-full border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    {openTaskCount} open
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Task title</label>
                  <Input
                    value={taskForm.title}
                    onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Call customer for overdue payment"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <label className="text-sm text-[var(--muted)]">Priority</label>
                    <Select
                      value={taskForm.priority}
                      onChange={(event) =>
                        setTaskForm((current) => ({ ...current, priority: event.target.value as SteelFollowUpTaskPriority }))
                      }
                    >
                      {FOLLOW_UP_PRIORITY_OPTIONS.map((priority) => (
                        <option key={priority} value={priority}>
                          {formatTaskLabel(priority)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Due date</label>
                    <Input
                      type="date"
                      value={taskForm.due_date}
                      onChange={(event) => setTaskForm((current) => ({ ...current, due_date: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Invoice (optional)</label>
                    <Select
                      value={taskForm.invoice_id}
                      onChange={(event) => setTaskForm((current) => ({ ...current, invoice_id: event.target.value }))}
                    >
                      <option value="">General customer task</option>
                      {openInvoices.map((invoice) => (
                        <option key={invoice.id} value={invoice.id}>
                          {invoice.invoice_number} - {formatCurrency(invoice.outstanding_amount_inr)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Notes</label>
                  <Textarea
                    value={taskForm.note}
                    onChange={(event) => setTaskForm((current) => ({ ...current, note: event.target.value }))}
                    placeholder="What should the team check or collect?"
                  />
                </div>
                <Button className="w-full sm:w-auto" disabled={taskBusy || !canManageTasks} onClick={() => void submitFollowUpTask()}>
                  {canManageTasks ? (taskBusy ? "Saving Task..." : "Add Follow-up Task") : "Owner / manager / admin / accountant access required"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Recovery Board</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ledger.follow_up_tasks.map((task) => (
                  <div key={task.id} className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold text-white">{task.title}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {task.invoice_number ? `${task.invoice_number} - ` : ""}
                          {task.due_date ? `Due ${formatDate(task.due_date)}` : "No due date"}
                          {task.assigned_to_name ? ` - ${task.assigned_to_name}` : ""}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className={`inline-flex rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${taskPriorityBadgeClass(task.priority)}`}>
                          {formatTaskLabel(task.priority)}
                        </div>
                        <div className={`inline-flex rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${taskStatusBadgeClass(task.status)}`}>
                          {formatTaskLabel(task.status)}
                        </div>
                      </div>
                    </div>
                    {task.note ? <div className="mt-3 text-sm text-[var(--text)]">{task.note}</div> : null}
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs text-[var(--muted)]">
                        Created {formatDate(task.created_at)}
                        {task.created_by_name ? ` by ${task.created_by_name}` : ""}
                        {task.completed_at ? ` - closed ${formatDate(task.completed_at)}` : ""}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto"
                          disabled={taskBusy || !canManageTasks || task.status !== "open"}
                          onClick={() => void setTaskStatus(task.id, "in_progress")}
                        >
                          Start
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto"
                          disabled={taskBusy || !canManageTasks || task.status === "done" || task.status === "cancelled"}
                          onClick={() => void setTaskStatus(task.id, "done")}
                        >
                          Mark Done
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full sm:w-auto"
                          disabled={taskBusy || !canManageTasks || task.status === "cancelled" || task.status === "done"}
                          onClick={() => void setTaskStatus(task.id, "cancelled")}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {!ledger.follow_up_tasks.length ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                    No follow-up tasks yet. Create the first recovery step from the left panel.
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Invoice Ledger</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 md:hidden">
                  {ledger.invoices.map((invoice) => (
                    <div key={invoice.id} className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4 text-sm">
                      <div className="space-y-1">
                        <Link href={`/steel/invoices/${invoice.id}`} className="font-semibold text-white hover:text-[var(--accent)]">
                          {invoice.invoice_number}
                        </Link>
                        <div className="text-xs text-[var(--muted)]">
                          {formatDate(invoice.invoice_date)} - due {formatDate(invoice.due_date)}
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Total</div>
                          <div className="mt-1 text-white">{formatCurrency(invoice.total_amount)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Paid</div>
                          <div className="mt-1 text-white">{formatCurrency(invoice.paid_amount_inr)}</div>
                        </div>
                        <div className="sm:col-span-2">
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Outstanding</div>
                          <div className="mt-1 text-white">{formatCurrency(invoice.outstanding_amount_inr)}</div>
                          <div className="mt-1 text-xs text-[var(--muted)]">
                            {invoice.status}
                            {invoice.is_overdue ? ` - ${invoice.overdue_days} days overdue` : ""}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!ledger.invoices.length ? (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                      No invoices linked to this customer yet.
                    </div>
                  ) : null}
                </div>
                <div className="hidden overflow-x-auto rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] md:block">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-3 font-medium">Invoice</th>
                        <th className="px-3 py-3 font-medium">Total</th>
                        <th className="px-3 py-3 font-medium">Paid</th>
                        <th className="px-3 py-3 font-medium">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-[var(--border)]/60 last:border-none">
                          <td className="px-3 py-3">
                            <Link href={`/steel/invoices/${invoice.id}`} className="font-semibold text-white hover:text-[var(--accent)]">
                              {invoice.invoice_number}
                            </Link>
                            <div className="text-xs text-[var(--muted)]">
                              {formatDate(invoice.invoice_date)} {" - "} due {formatDate(invoice.due_date)}
                            </div>
                          </td>
                          <td className="px-3 py-3">{formatCurrency(invoice.total_amount)}</td>
                          <td className="px-3 py-3">{formatCurrency(invoice.paid_amount_inr)}</td>
                          <td className="px-3 py-3">
                            <div>{formatCurrency(invoice.outstanding_amount_inr)}</div>
                            <div className="text-xs text-[var(--muted)]">
                              {invoice.status}
                              {invoice.is_overdue ? ` - ${invoice.overdue_days} days overdue` : ""}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!ledger.invoices.length ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-[var(--muted)]">
                            No invoices linked to this customer yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Payment History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 md:hidden">
                  {ledger.payments.map((payment) => (
                    <div key={payment.id} className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4 text-sm">
                      <div className="space-y-1">
                        <div className="font-semibold text-white">{formatDate(payment.payment_date)}</div>
                        <div className="text-xs text-[var(--muted)]">{payment.reference_number || "No reference"}</div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Amount</div>
                          <div className="mt-1 text-white">{formatCurrency(payment.amount)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Mode</div>
                          <div className="mt-1 text-white">{payment.payment_mode}</div>
                        </div>
                        <div className="sm:col-span-2">
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Invoice</div>
                          <div className="mt-1 text-white">
                            {payment.allocations?.length
                              ? payment.allocations.map((allocation) => `${allocation.invoice_number || `#${allocation.invoice_id}`} ${formatCurrency(allocation.amount)}`).join(", ")
                              : payment.invoice_number || "Unallocated"}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!ledger.payments.length ? (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                      No customer payments recorded yet.
                    </div>
                  ) : null}
                </div>
                <div className="hidden overflow-x-auto rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] md:block">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-3 font-medium">Date</th>
                        <th className="px-3 py-3 font-medium">Amount</th>
                        <th className="px-3 py-3 font-medium">Mode</th>
                        <th className="px-3 py-3 font-medium">Invoice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.payments.map((payment) => (
                        <tr key={payment.id} className="border-b border-[var(--border)]/60 last:border-none">
                          <td className="px-3 py-3">
                            <div className="font-semibold text-white">{formatDate(payment.payment_date)}</div>
                            <div className="text-xs text-[var(--muted)]">{payment.reference_number || "No reference"}</div>
                          </td>
                          <td className="px-3 py-3">{formatCurrency(payment.amount)}</td>
                          <td className="px-3 py-3">{payment.payment_mode}</td>
                          <td className="px-3 py-3">
                            {payment.allocations?.length
                              ? payment.allocations.map((allocation) => `${allocation.invoice_number || `#${allocation.invoice_id}`} ${formatCurrency(allocation.amount)}`).join(", ")
                              : payment.invoice_number || "Unallocated"}
                          </td>
                        </tr>
                      ))}
                      {!ledger.payments.length ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-[var(--muted)]">
                            No customer payments recorded yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

      </div>
    </main>
  );
}
