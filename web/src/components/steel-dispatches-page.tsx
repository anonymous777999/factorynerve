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
  createSteelDispatch,
  getSteelInvoiceDetail,
  listSteelDispatches,
  listSteelInvoices,
  type SteelDispatch,
  type SteelDispatchStatus,
  type SteelInvoice,
  type SteelInvoiceDetail,
  type SteelVehicleType,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { validatePhoneNumber, validateReferenceCode } from "@/lib/validation";

type DispatchDraftLine = {
  invoice_line_id: number;
  weight_kg: string;
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

function dispatchStatusBadgeClass(status: SteelDispatchStatus) {
  if (status === "delivered") return "border-emerald-400/35 bg-emerald-500/12 text-emerald-200";
  if (status === "dispatched") return "border-cyan-400/35 bg-cyan-500/12 text-cyan-200";
  if (status === "loaded") return "border-amber-400/35 bg-amber-500/12 text-amber-200";
  if (status === "cancelled") return "border-rose-400/35 bg-rose-500/12 text-rose-200";
  return "border-slate-400/35 bg-slate-500/12 text-slate-200";
}

export function SteelDispatchesPage() {
  const { user, activeFactory, loading, error: sessionError } = useSession();
  const [invoices, setInvoices] = useState<SteelInvoice[]>([]);
  const [dispatches, setDispatches] = useState<SteelDispatch[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<SteelInvoiceDetail | null>(null);
  const [lineDrafts, setLineDrafts] = useState<DispatchDraftLine[]>([]);
  const [dispatchDate, setDispatchDate] = useState(todayValue());
  const [truckNumber, setTruckNumber] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [vehicleType, setVehicleType] = useState<SteelVehicleType>("truck");
  const [truckCapacityKg, setTruckCapacityKg] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverLicenseNumber, setDriverLicenseNumber] = useState("");
  const [entryTime, setEntryTime] = useState("");
  const [exitTime, setExitTime] = useState("");
  const [notes, setNotes] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";
  const canCreate = Boolean(user && ["owner", "admin", "manager", "supervisor"].includes(user.role));

  const loadBase = useCallback(async () => {
    if (!isSteelFactory) {
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    try {
      const [invoicesPayload, dispatchesPayload] = await Promise.all([
        listSteelInvoices(30),
        listSteelDispatches(20),
      ]);
      setInvoices(invoicesPayload.items || []);
      setDispatches(dispatchesPayload.items || []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load steel dispatches.");
    } finally {
      setPageLoading(false);
    }
  }, [isSteelFactory]);

  useEffect(() => {
    if (!user || !isSteelFactory) {
      setPageLoading(false);
      return;
    }
    void loadBase();
  }, [isSteelFactory, loadBase, user]);

  useEffect(() => {
    if (!selectedInvoiceId) {
      setSelectedInvoice(null);
      setLineDrafts([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const detail = await getSteelInvoiceDetail(Number(selectedInvoiceId));
        if (cancelled) return;
        setSelectedInvoice(detail);
        setLineDrafts(
          (detail.invoice.lines || []).map((line) => ({
            invoice_line_id: line.id,
            weight_kg: line.remaining_weight_kg && line.remaining_weight_kg > 0 ? String(line.remaining_weight_kg) : "",
          })),
        );
      } catch (reason) {
        if (cancelled) return;
        setSelectedInvoice(null);
        setLineDrafts([]);
        setError(reason instanceof Error ? reason.message : "Could not load invoice detail.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedInvoiceId]);

  const totalWeight = useMemo(
    () => lineDrafts.reduce((sum, line) => sum + Number(line.weight_kg || 0), 0),
    [lineDrafts],
  );

  const lineById = useMemo(() => {
    const map = new Map<number, DispatchDraftLine>();
    for (const line of lineDrafts) map.set(line.invoice_line_id, line);
    return map;
  }, [lineDrafts]);

  const selectedInvoiceSummary = useMemo(() => {
    if (!selectedInvoice) return null;
    const lines = selectedInvoice.invoice.lines || [];
    return {
      totalWeight: lines.reduce((sum, line) => sum + Number(line.weight_kg || 0), 0),
      dispatchedWeight: lines.reduce((sum, line) => sum + Number(line.dispatched_weight_kg || 0), 0),
      remainingWeight: lines.reduce((sum, line) => sum + Number(line.remaining_weight_kg || 0), 0),
      totalAmount: Number(selectedInvoice.invoice.total_amount || 0),
    };
  }, [selectedInvoice]);

  const capacityWarning = useMemo(() => {
    const parsedCapacity = Number(truckCapacityKg || 0);
    if (!Number.isFinite(parsedCapacity) || parsedCapacity <= 0) return "";
    return totalWeight > parsedCapacity ? "Selected dispatch weight is above truck capacity." : "";
  }, [totalWeight, truckCapacityKg]);

  const selectedLines = useMemo(
    () =>
      lineDrafts
        .map((line) => ({
          invoice_line_id: line.invoice_line_id,
          weight_kg: Number(line.weight_kg || 0),
        }))
        .filter((line) => line.weight_kg > 0),
    [lineDrafts],
  );

  const overRemainingLineLabels = useMemo(() => {
    if (!selectedInvoice) return [] as string[];
    const lineMap = new Map((selectedInvoice.invoice.lines || []).map((line) => [line.id, line]));
    return selectedLines
      .filter((line) => {
        const invoiceLine = lineMap.get(line.invoice_line_id);
        if (!invoiceLine) return true;
        const remaining = Number(invoiceLine.remaining_weight_kg || 0);
        return line.weight_kg - remaining > 0.0001;
      })
      .map((line) => {
        const invoiceLine = lineMap.get(line.invoice_line_id);
        if (!invoiceLine) {
          return `Line #${line.invoice_line_id}`;
        }
        return `${invoiceLine.item_code || "Item"}${invoiceLine.item_name ? ` - ${invoiceLine.item_name}` : ""}`;
      });
  }, [selectedInvoice, selectedLines]);

  const truckNumberError = useMemo(() => validateReferenceCode(truckNumber, "Truck number", 40), [truckNumber]);
  const driverPhoneError = useMemo(() => validatePhoneNumber(driverPhone, "Driver phone"), [driverPhone]);
  const driverLicenseError = useMemo(
    () => validateReferenceCode(driverLicenseNumber, "Driver license", 80),
    [driverLicenseNumber],
  );
  const capacityInputError = useMemo(() => {
    if (!truckCapacityKg.trim()) return null;
    const parsed = Number(truckCapacityKg);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return "Truck capacity must be greater than 0.";
    }
    return null;
  }, [truckCapacityKg]);

  const dispatchValidationBlockers = useMemo(() => {
    const reasons: string[] = [];
    if (!canCreate) {
      reasons.push("Your role cannot create dispatch. Owner, supervisor, manager, or admin access is required.");
    }
    if (!selectedInvoiceId) {
      reasons.push("Select an invoice before creating dispatch.");
    }
    if (selectedInvoiceId && !selectedInvoice) {
      reasons.push("Invoice detail is still loading. Wait for invoice lines to appear.");
    }
    if (!dispatchDate) {
      reasons.push("Dispatch date is required.");
    }
    if (!selectedLines.length) {
      reasons.push("Enter at least one material line weight greater than 0 KG.");
    }
    if (overRemainingLineLabels.length) {
      reasons.push(`Some line weights exceed remaining invoice quantity (${overRemainingLineLabels.length} line(s)).`);
    }
    if (!truckNumber.trim()) {
      reasons.push("Truck number is required.");
    }
    if (!driverName.trim()) {
      reasons.push("Driver name is required.");
    }
    if (truckNumberError) {
      reasons.push(truckNumberError);
    }
    if (driverPhoneError) {
      reasons.push(driverPhoneError);
    }
    if (driverLicenseError) {
      reasons.push(driverLicenseError);
    }
    if (capacityInputError) {
      reasons.push(capacityInputError);
    }
    return reasons;
  }, [
    canCreate,
    capacityInputError,
    dispatchDate,
    driverLicenseError,
    driverName,
    driverPhoneError,
    overRemainingLineLabels.length,
    selectedInvoice,
    selectedInvoiceId,
    selectedLines.length,
    truckNumber,
    truckNumberError,
  ]);

  const dispatchChecklist = useMemo(
    () => [
      {
        id: "role",
        label: "Role allowed",
        ready: canCreate,
        detail: canCreate ? `Role ${user?.role || "unknown"} can create dispatches.` : "Only owner/supervisor/manager/admin can create dispatches.",
      },
      {
        id: "invoice",
        label: "Invoice selected",
        ready: Boolean(selectedInvoiceId && selectedInvoice),
        detail: selectedInvoice?.invoice.invoice_number || "Select an invoice to load dispatchable lines.",
      },
      {
        id: "lines",
        label: "Line weights entered",
        ready: selectedLines.length > 0 && overRemainingLineLabels.length === 0,
        detail:
          selectedLines.length > 0
            ? `${selectedLines.length} line(s), ${formatKg(totalWeight)} KG selected.`
            : "Add at least one line with weight greater than 0 KG.",
      },
      {
        id: "logistics",
        label: "Truck and driver",
        ready: Boolean(truckNumber.trim() && driverName.trim() && !truckNumberError),
        detail:
          truckNumberError ||
          (truckNumber.trim() && driverName.trim()
            ? "Truck number and driver name are ready."
            : "Truck number and driver name are required."),
      },
      {
        id: "contact",
        label: "Contact and capacity format",
        ready: !driverPhoneError && !driverLicenseError && !capacityInputError,
        detail:
          driverPhoneError ||
          driverLicenseError ||
          capacityInputError ||
          "Optional phone/license/capacity values are valid.",
      },
    ],
    [
      canCreate,
      capacityInputError,
      driverLicenseError,
      driverName,
      driverPhoneError,
      overRemainingLineLabels.length,
      selectedInvoice,
      selectedInvoiceId,
      selectedLines.length,
      totalWeight,
      truckNumber,
      truckNumberError,
      user?.role,
    ],
  );

  const readyChecklistCount = dispatchChecklist.filter((item) => item.ready).length;

  const fillRemainingWeights = useCallback(() => {
    if (!selectedInvoice) return;
    setLineDrafts(
      (selectedInvoice.invoice.lines || []).map((line) => ({
        invoice_line_id: line.id,
        weight_kg: line.remaining_weight_kg && line.remaining_weight_kg > 0 ? String(line.remaining_weight_kg) : "",
      })),
    );
  }, [selectedInvoice]);

  const clearLineWeights = useCallback(() => {
    setLineDrafts((current) => current.map((line) => ({ ...line, weight_kg: "" })));
  }, []);

  const canSubmitDispatch = !busy && dispatchValidationBlockers.length === 0;
  const primaryDispatchHint = canSubmitDispatch
    ? "All dispatch checks are clear. You can save a draft or post the live dispatch now."
    : dispatchValidationBlockers[0] || "Complete the checklist to enable dispatch creation.";

  const submitDispatch = async (dispatchStatus: SteelDispatchStatus) => {
    if (dispatchValidationBlockers.length) {
      setError(dispatchValidationBlockers[0]);
      return;
    }
    setBusy(true);
    setStatus("");
    setError("");
    setWarnings([]);
    try {
      if (driverPhoneError) {
        throw new Error(driverPhoneError);
      }
      if (truckNumberError) {
        throw new Error(truckNumberError);
      }
      if (driverLicenseError) {
        throw new Error(driverLicenseError);
      }
      const parsedCapacity = truckCapacityKg.trim() ? Number(truckCapacityKg) : undefined;
      if (capacityInputError) {
        throw new Error(capacityInputError);
      }
      const lines = selectedLines;
      if (!lines.length) {
        throw new Error("Enter at least one material weight to save this dispatch.");
      }
      const created = await createSteelDispatch({
        invoice_id: Number(selectedInvoiceId),
        dispatch_date: dispatchDate,
        truck_number: truckNumber,
        transporter_name: transporterName || undefined,
        vehicle_type: vehicleType,
        truck_capacity_kg: parsedCapacity,
        driver_name: driverName,
        driver_phone: driverPhone || undefined,
        driver_license_number: driverLicenseNumber || undefined,
        entry_time: entryTime || undefined,
        exit_time: exitTime || undefined,
        status: dispatchStatus,
        notes: notes || undefined,
        lines,
      });
      setStatus(
        dispatchStatus === "pending"
          ? `Dispatch ${created.dispatch.dispatch_number} saved as a draft.`
          : `Dispatch ${created.dispatch.dispatch_number} created with gate pass ${created.dispatch.gate_pass_number}.`,
      );
      setWarnings(created.warnings || []);
      setSelectedInvoiceId("");
      setSelectedInvoice(null);
      setLineDrafts([]);
      setDispatchDate(todayValue());
      setTruckNumber("");
      setTransporterName("");
      setVehicleType("truck");
      setTruckCapacityKg("");
      setDriverName("");
      setDriverPhone("");
      setDriverLicenseNumber("");
      setEntryTime("");
      setExitTime("");
      setNotes("");
      await loadBase();
    } catch (reason) {
      if (reason instanceof ApiError || reason instanceof Error) {
        setError(reason.message);
      } else {
        setError("Could not create steel dispatch.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading steel dispatch...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Steel Dispatch</CardTitle>
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
              <CardTitle>Steel dispatch is factory-aware</CardTitle>
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
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Steel Dispatch</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Create a truck-ready steel dispatch</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Pick the invoice, assign the material load, and save the truck movement once the dispatch checks clear.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-[var(--border)] bg-[rgba(12,18,28,0.72)] px-3 py-1 text-[var(--muted)]">
                  {selectedInvoice?.invoice.invoice_number ? `Invoice ${selectedInvoice.invoice.invoice_number}` : "No invoice selected"}
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[rgba(12,18,28,0.72)] px-3 py-1 text-[var(--muted)]">
                  {selectedLines.length} material line{selectedLines.length === 1 ? "" : "s"} selected
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[rgba(12,18,28,0.72)] px-3 py-1 text-[var(--muted)]">
                  {readyChecklistCount}/{dispatchChecklist.length} readiness checks clear
                </span>
              </div>
            </div>
            {/* AUDIT: BUTTON_CLUTTER - move route jumps into a secondary tools tray so dispatch creation stays primary. */}
            <details className="group w-full min-w-0 rounded-3xl border border-[var(--border)] bg-[rgba(10,16,26,0.72)] sm:w-auto sm:min-w-[220px]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                Dispatch tools
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
                <Link href="/steel/invoices">
                  <Button variant="ghost">Invoices</Button>
                </Link>
              </div>
            </details>
          </div>
        </section>

        {/* AUDIT: FLOW_BROKEN - add a short sequence so the screen points from invoice selection to truck release. */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader className="space-y-2">
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">1. Pick invoice</div>
              <CardTitle className="text-lg">Load remaining quantity</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Start from an invoice so every truck line inherits a real customer, item, and remaining quantity.
            </CardContent>
          </Card>
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader className="space-y-2">
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">2. Check truck</div>
              <CardTitle className="text-lg">Confirm logistics and capacity</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Truck, driver, entry, exit, and capacity should all be captured before the dispatch is saved.
            </CardContent>
          </Card>
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader className="space-y-2">
              <div className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">3. Save dispatch</div>
              <CardTitle className="text-lg">Create the gate pass</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[var(--muted)]">
              Once the checklist is clear, save the draft or create the live dispatch without losing invoice traceability.
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Recent Dispatches</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{dispatches.length}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Selected Weight</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{formatKg(totalWeight)} KG</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Selected Invoice</CardTitle></CardHeader>
            <CardContent className="text-xl font-semibold text-white">{selectedInvoice?.invoice.invoice_number || "None"}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Truck Capacity</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <div className="text-xl font-semibold text-white">{truckCapacityKg ? `${formatKg(Number(truckCapacityKg))} KG` : "Not set"}</div>
              <div className="text-xs text-[var(--muted)]">{capacityWarning || "Add truck capacity to get overweight warnings."}</div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Create Dispatch</div>
              <CardTitle className="text-xl">Invoice selection, materials, and logistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="text-sm text-[var(--muted)]">Invoice</label>
                <Select value={selectedInvoiceId} onChange={(event) => setSelectedInvoiceId(event.target.value)}>
                  <option value="">Select invoice</option>
                  {invoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoice_number} - {invoice.customer_name}
                    </option>
                  ))}
                </Select>
              </div>

              {selectedInvoice && selectedInvoiceSummary ? (
                <div className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Dispatch packet</div>
                      <div className="mt-2 text-lg font-semibold text-white">Invoice and quantity snapshot</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={fillRemainingWeights}>
                        Use remaining
                      </Button>
                      <Button type="button" variant="ghost" onClick={clearLineWeights}>
                        Clear weights
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Invoice</div>
                      <div className="mt-2 font-semibold text-white">{selectedInvoice.invoice.invoice_number}</div>
                      <div className="text-xs text-[var(--muted)]">{selectedInvoice.invoice.customer_name}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Ordered</div>
                      <div className="mt-2 font-semibold text-white">{formatKg(selectedInvoiceSummary.totalWeight)} KG</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Dispatched</div>
                      <div className="mt-2 font-semibold text-white">{formatKg(selectedInvoiceSummary.dispatchedWeight)} KG</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Remaining</div>
                      <div className="mt-2 font-semibold text-white">{formatKg(selectedInvoiceSummary.remainingWeight)} KG</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-[var(--muted)]">
                    Invoice value {formatCurrency(selectedInvoiceSummary.totalAmount)}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm text-[var(--muted)]">Dispatch Date</label>
                  <Input type="date" value={dispatchDate} onChange={(event) => setDispatchDate(event.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Truck Number</label>
                  <Input value={truckNumber} onChange={(event) => setTruckNumber(event.target.value)} placeholder="Truck number" />
                  {truckNumberError ? <div className="mt-2 text-xs text-rose-300">{truckNumberError}</div> : null}
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Transporter</label>
                  <Input value={transporterName} onChange={(event) => setTransporterName(event.target.value)} placeholder="Transport company" />
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Vehicle Type</label>
                  <Select value={vehicleType} onChange={(event) => setVehicleType(event.target.value as SteelVehicleType)}>
                    <option value="truck">Truck</option>
                    <option value="trailer">Trailer</option>
                    <option value="pickup">Pickup</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Truck Capacity (KG)</label>
                  <Input type="number" min="0" step="0.01" value={truckCapacityKg} onChange={(event) => setTruckCapacityKg(event.target.value)} placeholder="14000" />
                  {capacityInputError ? <div className="mt-2 text-xs text-rose-300">{capacityInputError}</div> : null}
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Driver Name</label>
                  <Input value={driverName} onChange={(event) => setDriverName(event.target.value)} placeholder="Driver name" />
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Driver Phone</label>
                  <Input type="tel" autoComplete="tel" inputMode="tel" value={driverPhone} onChange={(event) => setDriverPhone(event.target.value)} placeholder="Driver phone" />
                  {driverPhoneError ? <div className="mt-2 text-xs text-rose-300">{driverPhoneError}</div> : null}
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Driver License</label>
                  <Input value={driverLicenseNumber} onChange={(event) => setDriverLicenseNumber(event.target.value)} placeholder="License number" />
                  {driverLicenseError ? <div className="mt-2 text-xs text-rose-300">{driverLicenseError}</div> : null}
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Entry Time</label>
                  <Input type="datetime-local" value={entryTime} onChange={(event) => setEntryTime(event.target.value)} />
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Exit Time</label>
                  <Input type="datetime-local" value={exitTime} onChange={(event) => setExitTime(event.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-sm text-[var(--muted)]">Dispatch Notes</label>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional gate pass notes" />
              </div>

              {selectedInvoice ? (
                <div className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Material allocation</div>
                      <div className="mt-1 text-lg font-semibold text-white">Choose what leaves with this truck</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        Enter dispatch weight per invoice line. Use remaining quantity as the safest starting point.
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[rgba(9,14,23,0.76)] px-3 py-3 text-xs text-[var(--muted)]">
                      Total selected: <span className="font-semibold text-white">{formatKg(totalWeight)} KG</span>
                    </div>
                  </div>
                  <ResponsiveScrollArea debugLabel="steel-dispatch-allocation">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-3 font-medium">Material</th>
                        <th className="px-3 py-3 font-medium">Ordered</th>
                        <th className="px-3 py-3 font-medium">Dispatched</th>
                        <th className="px-3 py-3 font-medium">Remaining</th>
                        <th className="px-3 py-3 font-medium">Dispatch Now</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedInvoice.invoice.lines || []).map((line) => {
                        const draft = lineById.get(line.id);
                        const enteredWeight = Number(draft?.weight_kg || 0);
                        const remainingWeight = Number(line.remaining_weight_kg || 0);
                        const exceedsRemaining = enteredWeight > remainingWeight + 0.0001;
                        return (
                          <tr key={line.id} className="border-b border-[var(--border)]/60 last:border-none">
                            <td className="px-3 py-3">
                              <div className="font-semibold text-white">{line.item_code} - {line.item_name}</div>
                              <div className="text-xs text-[var(--muted)]">{line.description || line.batch_code || "Direct invoice line"}</div>
                            </td>
                            <td className="px-3 py-3">{formatKg(line.weight_kg)} KG</td>
                            <td className="px-3 py-3">{formatKg(line.dispatched_weight_kg)} KG</td>
                            <td className="px-3 py-3">{formatKg(line.remaining_weight_kg)} KG</td>
                            <td className="px-3 py-3">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={draft?.weight_kg || ""}
                                onChange={(event) =>
                                  setLineDrafts((current) =>
                                    current.map((row) =>
                                      row.invoice_line_id === line.id ? { ...row, weight_kg: event.target.value } : row,
                                    ),
                                  )
                                }
                              />
                              {exceedsRemaining ? (
                                <div className="mt-2 text-xs text-rose-300">
                                  Entered weight is above remaining invoice quantity by {formatKg(enteredWeight - remainingWeight)} KG.
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </ResponsiveScrollArea>
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm text-[var(--muted)]">
                  Select an invoice to load its dispatchable lines and remaining quantities.
                </div>
              )}

              {capacityWarning ? (
                <div className="rounded-2xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  {capacityWarning}
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Pre-submit checklist</div>
                      <div className="mt-2 text-lg font-semibold text-white">Dispatch readiness</div>
                      <div className="mt-1 text-xs text-[var(--muted)]">{primaryDispatchHint}</div>
                    </div>
                    <div
                      className={`inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${
                        canSubmitDispatch
                          ? "border-emerald-400/35 bg-emerald-500/12 text-emerald-200"
                          : "border-amber-400/35 bg-amber-500/12 text-amber-100"
                      }`}
                    >
                      {canSubmitDispatch ? "Ready to create" : `${dispatchValidationBlockers.length} blocker${dispatchValidationBlockers.length === 1 ? "" : "s"}`}
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {dispatchChecklist.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[rgba(20,24,36,0.72)] px-3 py-3">
                        <div
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                            item.ready
                              ? "bg-emerald-500/20 text-emerald-200"
                              : "bg-rose-500/18 text-rose-200"
                          }`}
                        >
                          {item.ready ? "OK" : "!"}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-white">{item.label}</div>
                          <div className="mt-1 text-xs leading-5 text-[var(--muted)]">{item.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className={`rounded-3xl border p-4 ${
                    dispatchValidationBlockers.length
                      ? "border-rose-400/35 bg-rose-500/8"
                      : "border-emerald-400/35 bg-emerald-500/8"
                  }`}
                >
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Decision guardrail</div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    {dispatchValidationBlockers.length ? "Why dispatch is blocked" : "Dispatch can move ahead"}
                  </div>
                  {dispatchValidationBlockers.length ? (
                    <div className="mt-4 space-y-3">
                      {dispatchValidationBlockers.map((blocker) => (
                        <div key={blocker} className="rounded-2xl border border-rose-400/20 bg-[rgba(64,12,12,0.24)] px-3 py-3 text-sm text-rose-100">
                          {blocker}
                        </div>
                      ))}
                      {overRemainingLineLabels.length ? (
                        <div className="rounded-2xl border border-rose-400/20 bg-[rgba(64,12,12,0.2)] px-3 py-3">
                          <div className="text-xs uppercase tracking-[0.16em] text-rose-200">Lines above remaining quantity</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {overRemainingLineLabels.map((label) => (
                              <span key={label} className="rounded-full border border-rose-300/25 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-100">
                                {label}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3 text-sm text-emerald-100">
                      <div className="rounded-2xl border border-emerald-400/25 bg-[rgba(14,44,26,0.28)] px-3 py-3">
                        All mandatory dispatch checks are clear. You can save the draft or create the live dispatch now.
                      </div>
                      <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.62)] px-3 py-3 text-xs leading-5 text-[var(--muted)]">
                        Gate control will use the invoice, selected line weights, truck number, and driver details captured here.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-[var(--border)] bg-[rgba(10,16,24,0.86)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Dispatch action</div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {canSubmitDispatch ? "Choose how to save this truck movement" : "Creation is paused until blockers are cleared"}
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">{primaryDispatchHint}</div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] px-3 py-3 text-xs text-[var(--muted)]">
                    Truck {truckNumber.trim() || "not added"} | Driver {driverName.trim() || "not added"}
                  </div>
                </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="outline" disabled={!canSubmitDispatch} onClick={() => void submitDispatch("pending")}>
                  {busy ? "Saving..." : "Save draft"}
                </Button>
                <Button disabled={!canSubmitDispatch} onClick={() => void submitDispatch("dispatched")}>
                  {canCreate ? (busy ? "Creating..." : "Create dispatch") : "Owner / supervisor / manager / admin access required"}
                </Button>
              </div>
              {!canSubmitDispatch ? (
                <div className="mt-3 text-xs text-[var(--muted)]">
                  Resolve the blockers above to enable dispatch creation.
                </div>
              ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Dispatch History</div>
              <CardTitle className="text-xl">Recent gate passes</CardTitle>
              <div className="text-xs text-[var(--muted)]">Latest truck movement, gate pass status, and invoice traceability.</div>
            </CardHeader>
            <CardContent>
              {/* AUDIT: DENSITY_OVERLOAD - keep history available but collapsed so the create-dispatch flow stays dominant. */}
              <details className="group rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                  Review recent dispatches
                  <span className="text-xs text-[var(--muted)] transition group-open:hidden">{dispatches.length} items</span>
                  <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
                </summary>
                <ResponsiveScrollArea className="border-t border-[var(--border)]" debugLabel="steel-dispatch-history">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-3 font-medium">Dispatch</th>
                        <th className="px-3 py-3 font-medium">Gate Pass</th>
                        <th className="px-3 py-3 font-medium">Status</th>
                        <th className="px-3 py-3 font-medium">Truck</th>
                        <th className="px-3 py-3 font-medium">Weight</th>
                        <th className="px-3 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dispatches.map((dispatch) => (
                        <tr key={dispatch.id} className="border-b border-[var(--border)]/60 last:border-none">
                          <td className="px-3 py-3">
                            <div className="font-semibold text-white">{dispatch.dispatch_number}</div>
                            <div className="text-xs text-[var(--muted)]">{dispatch.invoice_number}</div>
                          </td>
                          <td className="px-3 py-3">{dispatch.gate_pass_number}</td>
                          <td className="px-3 py-3">
                            <div className={`inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${dispatchStatusBadgeClass(dispatch.status)}`}>
                              {dispatch.status}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div>{dispatch.truck_number}</div>
                            <div className="text-xs text-[var(--muted)]">{dispatch.transporter_name || dispatch.driver_name}</div>
                          </td>
                          <td className="px-3 py-3">{formatKg(dispatch.total_weight_kg)} KG</td>
                          <td className="px-3 py-3">
                            <Link href={`/steel/dispatches/${dispatch.id}`} className="text-xs font-medium text-[var(--accent)] hover:underline">
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                      {!dispatches.length ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-[var(--muted)]">
                            No dispatches yet. Create the first gate pass from an invoice above.
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

        {warnings.length ? (
          <div className="space-y-2">
            {warnings.map((warning, index) => (
              <div key={`${warning}-${index}`} className="text-sm text-amber-300">{warning}</div>
            ))}
          </div>
        ) : null}
        {status ? <div className="text-sm text-green-400">{status}</div> : null}
        {error || sessionError ? <div className="text-sm text-red-400">{error || sessionError}</div> : null}
      </div>
    </main>
  );
}
