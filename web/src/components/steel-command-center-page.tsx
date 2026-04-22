"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { IndustrialFactoryDashboard } from "@/components/dashboard/industrial-factory-dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import { buildSteelDashboardData, type IndustrialDashboardData } from "@/lib/industrial-dashboard";
import {
  createSteelBatch,
  createSteelItem,
  createSteelTransaction,
  getSteelOverview,
  getSteelOwnerDailyPdfUrl,
  listSteelBatches,
  listSteelDispatches,
  listSteelInvoices,
  listSteelItems,
  listSteelStock,
  reconcileSteelStock,
  type SteelBatch,
  type SteelDispatch,
  type SteelInvoice,
  type SteelItem,
  type SteelStockMismatchCause,
  type SteelOverview,
  type SteelStockItem,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";
import { validateIdentifierCode } from "@/lib/validation";

type SteelControlTab = "overview" | "inventory" | "production" | "sales" | "risk";

const STEEL_CONTROL_TABS: Array<{ id: SteelControlTab; label: string; hint: string }> = [
  { id: "overview", label: "Overview", hint: "Live command view" },
  { id: "inventory", label: "Inventory", hint: "Stock trust + reconciliation" },
  { id: "production", label: "Production", hint: "Batch recording + traceability" },
  { id: "sales", label: "Sales", hint: "Invoices + dispatch flow" },
  { id: "risk", label: "Risk", hint: "Leakage + responsibility review" },
];

function isSteelControlTab(value: string | null): value is SteelControlTab {
  return value === "overview" || value === "inventory" || value === "production" || value === "sales" || value === "risk";
}

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

function formatPercent(value: number | null | undefined, digits = 2) {
  return `${(value || 0).toFixed(digits)}%`;
}

function deriveOperationalZone(category: string | null | undefined) {
  if (category === "raw_material") return "Yard";
  if (category === "wip") return "Production Line";
  return "Warehouse";
}

function formatMismatchCause(value: SteelStockMismatchCause | string | null | undefined) {
  if (!value) return "Not tagged";
  return value.replaceAll("_", " ");
}

const STEEL_MISMATCH_CAUSE_OPTIONS: Array<{ value: SteelStockMismatchCause; label: string }> = [
  { value: "counting_error", label: "Counting Error" },
  { value: "process_loss", label: "Process Loss" },
  { value: "theft_or_leakage", label: "Theft / Leakage" },
  { value: "wrong_entry", label: "Wrong Entry" },
  { value: "delayed_dispatch_update", label: "Delayed Dispatch Update" },
  { value: "other", label: "Other" },
];

function badgeTone(value: string) {
  if (value === "green" || value === "normal") return "border-emerald-400/35 bg-emerald-400/12 text-emerald-200";
  if (value === "yellow" || value === "watch") return "border-amber-400/35 bg-amber-400/12 text-amber-200";
  if (value === "high") return "border-orange-400/35 bg-orange-400/12 text-orange-200";
  return "border-rose-400/35 bg-rose-400/12 text-rose-200";
}

function toPositiveNumber(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function toPositiveInteger(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function normalizeSteelActionError(reason: unknown): string {
  const base =
    reason instanceof ApiError || reason instanceof Error
      ? reason.message
      : "Steel operation failed.";
  if (base.includes("Steel inventory item not found")) {
    return "Selected material is not available in this factory. Pick a valid material or create it in Inventory first.";
  }
  if (base.includes("Not enough input stock for this batch")) {
    return "Not enough input stock for this batch. Add inward stock in Inventory before recording production.";
  }
  return base;
}

export function SteelCommandCenterPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, activeFactory, loading, error: sessionError } = useSession();
  const [overview, setOverview] = useState<SteelOverview | null>(null);
  const [items, setItems] = useState<SteelItem[]>([]);
  const [stock, setStock] = useState<SteelStockItem[]>([]);
  const [batches, setBatches] = useState<SteelBatch[]>([]);
  const [steelDashboardData, setSteelDashboardData] = useState<Partial<Record<"today" | "7d" | "30d", IndustrialDashboardData>> | undefined>(undefined);
  const [pageLoading, setPageLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [itemForm, setItemForm] = useState({
    item_code: "",
    name: "",
    category: "raw_material",
    display_unit: "kg",
    current_rate_per_kg: "",
  });
  const [moveForm, setMoveForm] = useState({
    item_id: "",
    transaction_type: "inward",
    quantity_kg: "",
    direction: "increase",
    notes: "",
  });
  const [reconcileForm, setReconcileForm] = useState({
    item_id: "",
    physical_qty_kg: "",
    notes: "",
    mismatch_cause: "",
  });
  const [ownerReportDate, setOwnerReportDate] = useState(todayValue());
  const [batchForm, setBatchForm] = useState({
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
  const canAccessSteelControl = user?.role === "owner" || user?.role === "manager";
  const canManage = canAccessSteelControl;
  const canRecordBatch = canAccessSteelControl;
  const [activeTab, setActiveTab] = useState<SteelControlTab>(() => {
    const requestedTab = searchParams.get("tab");
    return isSteelControlTab(requestedTab) ? requestedTab : "overview";
  });

  const navigateTab = useCallback((tab: SteelControlTab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "overview") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    const nextTab = isSteelControlTab(requestedTab) ? requestedTab : "overview";
    setActiveTab((current) => (current === nextTab ? current : nextTab));
  }, [searchParams]);

  const refreshAll = useCallback(async () => {
    if (!canAccessSteelControl) {
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    try {
      if (!isSteelFactory) {
        // Keep the chart board available with reference data even when a steel factory is not active.
        setOverview(null);
        setItems([]);
        setStock([]);
        setBatches([]);
        setSteelDashboardData(undefined);
        setError("");
      } else {
        const [nextOverview, nextItems, nextStock, nextBatches, nextInvoices, nextDispatches] = await Promise.all([
          getSteelOverview(),
          listSteelItems(),
          listSteelStock(),
          listSteelBatches(60),
          listSteelInvoices(60),
          listSteelDispatches(60),
        ]);
        setOverview(nextOverview);
        setItems(nextItems.items || []);
        setStock(nextStock.items || []);
        setBatches(nextBatches.items || []);
        setSteelDashboardData(
          buildSteelDashboardData({
            overview: nextOverview,
            batches: (nextBatches.items || []) as SteelBatch[],
            invoices: (nextInvoices.items || []) as SteelInvoice[],
            dispatches: (nextDispatches.items || []) as SteelDispatch[],
          }),
        );
        setError("");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load steel operations.");
    } finally {
      setPageLoading(false);
    }
  }, [canAccessSteelControl, isSteelFactory]);

  useEffect(() => {
    if (!user || !canAccessSteelControl) {
      setPageLoading(false);
      return;
    }
    void refreshAll();
  }, [canAccessSteelControl, refreshAll, user]);

  useEffect(() => {
    if (!isSteelFactory) {
      setActiveTab("overview");
    }
  }, [isSteelFactory]);

  const inputItems = useMemo(
    () => items.filter((item) => item.category === "raw_material" || item.category === "wip"),
    [items],
  );
  const inventoryZones = useMemo(() => {
    return stock.reduce(
      (acc, row) => {
        const zone = deriveOperationalZone(row.category);
        acc[zone] = Number(acc[zone] || 0) + Number(row.stock_balance_kg || 0);
        return acc;
      },
      { Yard: 0, "Production Line": 0, Warehouse: 0 } as Record<string, number>,
    );
  }, [stock]);
  const selectedReconcileItem = useMemo(
    () => stock.find((row) => String(row.item_id) === reconcileForm.item_id) || null,
    [reconcileForm.item_id, stock],
  );
  const reconcilePhysicalQty = useMemo(() => {
    const trimmed = reconcileForm.physical_qty_kg.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }, [reconcileForm.physical_qty_kg]);
  const reconcileSystemQty = Number(selectedReconcileItem?.stock_balance_kg || 0);
  const reconcileVarianceKg = Number(reconcilePhysicalQty || 0) - reconcileSystemQty;
  const reconcileVariancePercent = reconcileSystemQty > 0
    ? (Math.abs(reconcileVarianceKg) / reconcileSystemQty) * 100
    : (reconcilePhysicalQty === null || reconcilePhysicalQty === 0 ? 0 : 100);
  const reconcileNeedsCause = Math.abs(reconcileVarianceKg) > 0.001;
  const reconciliationValidationMessage = useMemo(() => {
    if (!reconcileForm.item_id) {
      return "Select the stock item you are counting.";
    }
    if (!reconcileForm.physical_qty_kg.trim()) {
      return "Enter the physical stock in KG.";
    }
    if (reconcilePhysicalQty === null || reconcilePhysicalQty < 0) {
      return "Physical stock must be zero or more.";
    }
    if (reconcileNeedsCause && !reconcileForm.mismatch_cause) {
      return "Pick the root cause before saving a mismatch.";
    }
    return "";
  }, [reconcileForm.item_id, reconcileForm.mismatch_cause, reconcileForm.physical_qty_kg, reconcileNeedsCause, reconcilePhysicalQty]);
  const outputItems = useMemo(
    () => items.filter((item) => item.category === "wip" || item.category === "finished_goods"),
    [items],
  );
  const batchInputItemId = useMemo(() => toPositiveInteger(batchForm.input_item_id), [batchForm.input_item_id]);
  const batchOutputItemId = useMemo(() => toPositiveInteger(batchForm.output_item_id), [batchForm.output_item_id]);
  const batchInputQuantity = useMemo(() => toPositiveNumber(batchForm.input_quantity_kg), [batchForm.input_quantity_kg]);
  const batchExpectedOutput = useMemo(() => toPositiveNumber(batchForm.expected_output_kg), [batchForm.expected_output_kg]);
  const batchActualOutput = useMemo(() => toPositiveNumber(batchForm.actual_output_kg), [batchForm.actual_output_kg]);
  const hasInputMaterials = inputItems.length > 0;
  const hasOutputMaterials = outputItems.length > 0;
  const productionValidationMessage = useMemo(() => {
    if (!isSteelFactory) {
      return "Switch to a steel factory to record production batches.";
    }
    if (!hasInputMaterials) {
      return "Add at least one raw material or WIP item in Inventory before recording a batch.";
    }
    if (!hasOutputMaterials) {
      return "Add at least one output item (WIP or finished goods) in Inventory before recording a batch.";
    }
    if (!batchInputItemId) {
      return "Select input material.";
    }
    if (!batchOutputItemId) {
      return "Select output material.";
    }
    if (batchInputItemId === batchOutputItemId) {
      return "Input and output material must be different.";
    }
    if (!batchInputQuantity) {
      return "Enter input quantity in KG.";
    }
    if (!batchExpectedOutput) {
      return "Enter expected output in KG.";
    }
    if (!batchActualOutput) {
      return "Enter actual output in KG.";
    }
    if (batchExpectedOutput > batchInputQuantity) {
      return "Expected output cannot be greater than input quantity.";
    }
    if (batchActualOutput > batchInputQuantity) {
      return "Actual output cannot be greater than input quantity.";
    }
    return "";
  }, [
    batchActualOutput,
    batchExpectedOutput,
    batchInputItemId,
    batchInputQuantity,
    batchOutputItemId,
    hasInputMaterials,
    hasOutputMaterials,
    isSteelFactory,
  ]);
  const canSubmitBatch = canRecordBatch && !busy && !productionValidationMessage;
  const profitSummary = overview?.profit_summary;
  const anomalySummary = overview?.anomaly_summary;
  const responsibility = overview?.responsibility_analytics;
  const rankedAnomalies = overview?.ranked_anomalies || [];
  const bestProfitBatch = profitSummary?.best_profit_batch;
  const highestRiskOperator = anomalySummary?.highest_risk_operator;
  const highestLossDay = anomalySummary?.highest_loss_day;
  const canSeeFinancials = Boolean(overview?.financial_access && user?.role === "owner");
  const steelHubSections = useMemo(
    () => [
      {
        id: "stock-lane",
        tab: "inventory" as SteelControlTab,
        eyebrow: "Stock",
        title: "Trust the live ledger",
        detail: `${overview?.confidence_counts.red || 0} red item${(overview?.confidence_counts.red || 0) === 1 ? "" : "s"} and ${formatKg(overview?.inventory_totals.raw_material_kg || 0)} KG raw material in view.`,
        actionLabel: "Open Stock Lane",
      },
      {
        id: "production-lane",
        tab: "production" as SteelControlTab,
        eyebrow: "Production",
        title: "Record and trace batches",
        detail: `${overview?.batch_metrics.total_batches || 0} batch${(overview?.batch_metrics.total_batches || 0) === 1 ? "" : "es"} recorded with ${formatPercent(overview?.batch_metrics.average_loss_percent || 0)} average loss.`,
        actionLabel: "Open Production Lane",
      },
      {
        id: "sales-lane",
        tab: "sales" as SteelControlTab,
        eyebrow: "Sales",
        title: "Follow invoices and dispatch",
        detail: `${profitSummary?.invoice_count || 0} invoice${(profitSummary?.invoice_count || 0) === 1 ? "" : "s"} and ${profitSummary?.dispatch_count || 0} dispatch${(profitSummary?.dispatch_count || 0) === 1 ? "" : "es"} tied to steel movement.`,
        actionLabel: "Open Sales Lane",
      },
      {
        id: "risk-lane",
        tab: "risk" as SteelControlTab,
        eyebrow: "Risk",
        title: "Watch leakage and responsibility",
        detail: `${anomalySummary?.ranked_batch_count || 0} ranked anomaly batch${(anomalySummary?.ranked_batch_count || 0) === 1 ? "" : "es"} with ${formatKg(anomalySummary?.total_variance_kg || 0)} KG variance.`,
        actionLabel: "Open Risk Lane",
      },
    ],
    [
      anomalySummary?.ranked_batch_count,
      anomalySummary?.total_variance_kg,
      overview?.batch_metrics.average_loss_percent,
      overview?.batch_metrics.total_batches,
      overview?.confidence_counts.red,
      overview?.inventory_totals.raw_material_kg,
      profitSummary?.dispatch_count,
      profitSummary?.invoice_count,
    ],
  );

  const runAction = async (work: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    setStatus("");
    setError("");
    try {
      await work();
      setStatus(successMessage);
      await refreshAll();
    } catch (reason) {
      setError(normalizeSteelActionError(reason));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const inputItemIds = new Set(inputItems.map((item) => String(item.id)));
    const outputItemIds = new Set(outputItems.map((item) => String(item.id)));
    setBatchForm((current) => {
      let changed = false;
      const next = { ...current };
      if (current.input_item_id && !inputItemIds.has(current.input_item_id)) {
        next.input_item_id = "";
        changed = true;
      }
      if (current.output_item_id && !outputItemIds.has(current.output_item_id)) {
        next.output_item_id = "";
        changed = true;
      }
      return changed ? next : current;
    });
  }, [inputItems, outputItems]);

  if (loading || pageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
        Loading steel command center...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Steel Operations</CardTitle>
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

  if (!canAccessSteelControl) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Steel Control is restricted</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-[var(--muted)]">
              <div>
                This command center is available to authorized <span className="font-semibold text-[var(--text)]">owner/manager</span> roles only.
              </div>
              <div>You can still use daily workflows from Work Queue, Attendance, OCR, and role-specific steel pages.</div>
              <div className="flex flex-wrap gap-3">
                <Link href="/work-queue">
                  <Button>Open Work Queue</Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline">Open Today Board</Button>
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
              <div className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">Steel Operations</div>
              <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Run the steel desk from one trusted control lane</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Start with live stock trust, then move into batch, sales, and risk lanes without losing the factory context.
              </p>
            </div>
            <div className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] px-4 py-3 text-sm text-[var(--muted)]">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Active Steel Factory</div>
              <div className="mt-2 font-semibold text-[var(--text)]">{overview?.factory.name || activeFactory?.name}</div>
              <div className="mt-1">{overview?.factory.factory_code || activeFactory?.factory_code || "Code pending"}</div>
              {canSeeFinancials ? (
                <div className="mt-3 space-y-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Owner Report Date</div>
                  <Input type="date" value={ownerReportDate} onChange={(event) => setOwnerReportDate(event.target.value)} />
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* AUDIT: BUTTON_CLUTTER - keep cross-module launch actions in a secondary tray so the active steel lane stays primary. */}
        <details className="rounded-[28px] border border-[var(--border)] bg-[rgba(12,16,24,0.72)] p-5">
          <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)] marker:hidden">
            Steel tools
          </summary>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/steel/invoices">
              <Button variant="outline">Invoices</Button>
            </Link>
            <Link href="/steel/customers">
              <Button variant="outline">Customers</Button>
            </Link>
            <Link href="/steel/dispatches">
              <Button variant="ghost">Dispatches</Button>
            </Link>
            <Link href="/steel/reconciliations">
              <Button variant="ghost">Reconciliations</Button>
            </Link>
            {canSeeFinancials ? (
              <Button
                variant="secondary"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.open(getSteelOwnerDailyPdfUrl(ownerReportDate), "_blank", "noopener,noreferrer");
                  }
                }}
              >
                Owner PDF
              </Button>
            ) : null}
          </div>
        </details>

        {/* AUDIT: FLOW_BROKEN - add a short steel control sequence so users know how to move through the command desk. */}
        <section className="grid gap-3 md:grid-cols-3">
          {[
            { step: "1. Check trust", caption: "Start with stock confidence and the active factory signal." },
            { step: "2. Pick lane", caption: "Move into inventory, production, sales, or risk next." },
            { step: "3. Act fast", caption: "Open the exact steel workflow only when the signal needs it." },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-[24px] border border-[var(--border)] bg-[rgba(10,14,24,0.68)] px-5 py-4"
            >
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">{item.step}</div>
              <div className="mt-2 text-sm text-[var(--muted)]">{item.caption}</div>
            </div>
          ))}
        </section>

        {!isSteelFactory ? (
          <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
            <CardHeader>
              <CardTitle className="text-xl">Steel module is factory-aware</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-[var(--muted)]">
              <div>
                Your active factory is <span className="font-semibold text-[var(--text)]">{activeFactory?.name || "not selected"}</span>.
              </div>
              <div>Chart board is available below. Switch to a steel factory to unlock inventory, production, sales, and risk actions.</div>
              <div className="flex flex-wrap gap-3">
                <Link href="/settings">
                  <Button variant="outline">Open Settings</Button>
                </Link>
                <Link href="/control-tower">
                  <Button variant="outline">Open Control Tower</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <section className="rounded-[1.4rem] border border-[var(--border)] bg-[rgba(18,24,36,0.86)] p-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {STEEL_CONTROL_TABS.map((tab) => {
              const active = activeTab === tab.id;
              const disabled = !isSteelFactory && tab.id !== "overview";
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (!disabled) {
                      navigateTab(tab.id);
                    }
                  }}
                  disabled={disabled}
                  className={
                    active
                      ? "rounded-2xl border border-[var(--accent)] bg-[rgba(56,189,248,0.2)] px-4 py-3 text-left shadow-sm"
                      : "rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] px-4 py-3 text-left hover:border-[var(--accent)]/60 disabled:cursor-not-allowed disabled:opacity-45"
                  }
                >
                  <div className="text-sm font-semibold text-[var(--text)]">{tab.label}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{tab.hint}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-4">
          {steelHubSections.map((section) => (
            <Card key={section.id} className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
              <CardHeader>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">{section.eyebrow}</div>
                <CardTitle className="text-xl">{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm leading-6 text-[var(--muted)]">{section.detail}</div>
                <Button variant="outline" onClick={() => navigateTab(section.tab)}>
                  {section.actionLabel}
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        {activeTab === "overview" ? (
        <section>
          <IndustrialFactoryDashboard
            loading={pageLoading}
            industryType="steel"
            dataByRange={steelDashboardData}
          />
        </section>
        ) : null}

        {activeTab === "overview" ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Raw Material</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{formatKg(overview?.inventory_totals.raw_material_kg || 0)} KG</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Finished Goods</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{formatKg(overview?.inventory_totals.finished_goods_kg || 0)} KG</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Avg Loss</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{formatPercent(overview?.batch_metrics.average_loss_percent || 0)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">High-Risk Batches</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">{overview?.batch_metrics.high_severity_batches || 0}</CardContent>
          </Card>
        </section>
        ) : null}

        {activeTab === "sales" ? (
        <>
        <section id="sales-lane" className="grid gap-4 md:grid-cols-3">
          <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
            <CardHeader>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Sales Lane</div>
              <CardTitle className="text-xl">Invoices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-[var(--muted)]">
                {profitSummary?.invoice_count || 0} invoice{(profitSummary?.invoice_count || 0) === 1 ? "" : "s"} recorded for the active steel factory.
              </div>
              <Link href="/steel/invoices">
                <Button variant="outline">Open Invoices</Button>
              </Link>
            </CardContent>
          </Card>
          <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
            <CardHeader>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Sales Lane</div>
              <CardTitle className="text-xl">Dispatch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-[var(--muted)]">
                {profitSummary?.dispatch_count || 0} dispatch{(profitSummary?.dispatch_count || 0) === 1 ? "" : "es"} linked to steel movement and gate pass control.
              </div>
              <Link href="/steel/dispatches">
                <Button variant="outline">Open Dispatch</Button>
              </Link>
            </CardContent>
          </Card>
          <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
            <CardHeader>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Sales Lane</div>
              <CardTitle className="text-xl">Customers & Collections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-[var(--muted)]">
                {canSeeFinancials
                  ? `${formatCurrency(profitSummary?.outstanding_invoice_amount_inr || 0)} still outstanding across current invoice exposure.`
                  : "Open customer ledger, invoice history, and payment tracking from one place."}
              </div>
              <Link href="/steel/customers">
                <Button variant="outline">Open Customers</Button>
              </Link>
            </CardContent>
          </Card>
        </section>

        {canSeeFinancials ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Realized Dispatch Revenue</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">
              {formatCurrency(profitSummary?.realized_dispatched_revenue_inr || 0)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Realized Gross Profit</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-white">
              {formatCurrency(profitSummary?.realized_dispatched_profit_inr || 0)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Leakage Exposure</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-semibold text-white">
                {formatCurrency(anomalySummary?.total_estimated_leakage_value_inr || 0)}
              </div>
              <div className="text-xs text-[var(--muted)]">
                {formatKg(anomalySummary?.total_variance_kg || 0)} KG across {anomalySummary?.ranked_batch_count || 0} ranked batches
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Outstanding Invoice Value</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-semibold text-white">
                {formatCurrency(profitSummary?.outstanding_invoice_amount_inr || 0)}
              </div>
              <div className="text-xs text-[var(--muted)]">
                {formatKg(profitSummary?.outstanding_invoice_weight_kg || 0)} KG still invoiced but not dispatched
              </div>
            </CardContent>
          </Card>
          </section>
        ) : null}
        </>
        ) : null}

        {activeTab === "inventory" ? (
        <section id="stock-lane" className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Live Stock Trust Board</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className={`rounded-2xl px-4 py-3 text-sm ${badgeTone("green")}`}>Green<div className="mt-1 text-2xl font-semibold text-white">{overview?.confidence_counts.green || 0}</div></div>
                  <div className={`rounded-2xl px-4 py-3 text-sm ${badgeTone("yellow")}`}>Review<div className="mt-1 text-2xl font-semibold text-white">{overview?.confidence_counts.yellow || 0}</div></div>
                  <div className={`rounded-2xl px-4 py-3 text-sm ${badgeTone("red")}`}>Mismatch<div className="mt-1 text-2xl font-semibold text-white">{overview?.confidence_counts.red || 0}</div></div>
                </div>
                <ResponsiveScrollArea
                  className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                  debugLabel="steel-command-center-batches"
                >
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-3 py-3 font-medium">Item</th>
                        <th className="px-3 py-3 font-medium">Zone</th>
                        <th className="px-3 py-3 font-medium">KG</th>
                        <th className="px-3 py-3 font-medium">TON</th>
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
                            <div className="text-xs text-[var(--muted)]">Derived from material stage</div>
                          </td>
                          <td className="px-3 py-3">{formatKg(row.stock_balance_kg)}</td>
                          <td className="px-3 py-3">{formatKg(row.stock_balance_ton)}</td>
                          <td className="px-3 py-3">
                            <div className="font-medium text-white">
                              {row.last_variance_kg != null ? `${formatKg(row.last_variance_kg)} KG` : "No count yet"}
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {row.last_variance_percent != null ? formatPercent(row.last_variance_percent) : "Variance pending"}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${badgeTone(row.confidence_status)}`}>
                              {row.confidence_status}
                            </span>
                            <div className="mt-2 max-w-[18rem] text-xs text-[var(--muted)]">{row.confidence_reason}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ResponsiveScrollArea>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Add Steel Material</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Input value={itemForm.item_code} onChange={(event) => setItemForm((current) => ({ ...current, item_code: event.target.value }))} placeholder="Item code" />
                  <Input value={itemForm.name} onChange={(event) => setItemForm((current) => ({ ...current, name: event.target.value }))} placeholder="Item name" />
                  <Select value={itemForm.category} onChange={(event) => setItemForm((current) => ({ ...current, category: event.target.value }))}>
                    <option value="raw_material">Raw Material</option>
                    <option value="wip">WIP</option>
                    <option value="finished_goods">Finished Goods</option>
                  </Select>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select value={itemForm.display_unit} onChange={(event) => setItemForm((current) => ({ ...current, display_unit: event.target.value }))}>
                      <option value="kg">KG</option>
                      <option value="ton">TON</option>
                    </Select>
                    <Input type="number" min="0" step="0.01" value={itemForm.current_rate_per_kg} onChange={(event) => setItemForm((current) => ({ ...current, current_rate_per_kg: event.target.value }))} placeholder="Rate / KG" />
                  </div>
                  <Button
                    disabled={busy || !canManage}
                    onClick={() =>
                      runAction(async () => {
                        const itemCodeError = validateIdentifierCode(itemForm.item_code, "Item code", 40);
                        if (itemCodeError) {
                          throw new Error(itemCodeError);
                        }
                        await createSteelItem({
                          item_code: itemForm.item_code,
                          name: itemForm.name,
                          category: itemForm.category,
                          display_unit: itemForm.display_unit,
                          current_rate_per_kg: itemForm.current_rate_per_kg ? Number(itemForm.current_rate_per_kg) : undefined,
                        });
                        setItemForm({ item_code: "", name: "", category: "raw_material", display_unit: "kg", current_rate_per_kg: "" });
                      }, "Steel inventory item created.")
                    }
                  >
                    {canManage ? "Create Item" : "Manager access required"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Ledger Movement</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Select value={moveForm.item_id} onChange={(event) => setMoveForm((current) => ({ ...current, item_id: event.target.value }))}>
                    <option value="">Select item</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>{item.item_code} - {item.name}</option>
                    ))}
                  </Select>
                  <Select value={moveForm.transaction_type} onChange={(event) => setMoveForm((current) => ({ ...current, transaction_type: event.target.value }))}>
                    <option value="inward">Raw inward</option>
                    <option value="dispatch_out">Dispatch out</option>
                    <option value="adjustment">Adjustment</option>
                  </Select>
                  {moveForm.transaction_type === "adjustment" ? (
                    <Select value={moveForm.direction} onChange={(event) => setMoveForm((current) => ({ ...current, direction: event.target.value }))}>
                      <option value="increase">Increase</option>
                      <option value="decrease">Decrease</option>
                    </Select>
                  ) : null}
                  <Input type="number" min="0" step="0.01" value={moveForm.quantity_kg} onChange={(event) => setMoveForm((current) => ({ ...current, quantity_kg: event.target.value }))} placeholder="Quantity KG" />
                  <Textarea value={moveForm.notes} onChange={(event) => setMoveForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Movement reason" />
                  <Button
                    disabled={busy || !canManage}
                    onClick={() =>
                      runAction(async () => {
                        await createSteelTransaction({
                          item_id: Number(moveForm.item_id),
                          transaction_type: moveForm.transaction_type,
                          quantity_kg: Number(moveForm.quantity_kg),
                          direction: moveForm.transaction_type === "adjustment" ? moveForm.direction : undefined,
                          notes: moveForm.notes || undefined,
                        });
                        setMoveForm({ item_id: "", transaction_type: "inward", quantity_kg: "", direction: "increase", notes: "" });
                      }, "Ledger transaction recorded.")
                    }
                  >
                    {canManage ? "Record Movement" : "Manager access required"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-6">
            {canSeeFinancials ? (
            <Card>
              <CardHeader><CardTitle>Owner Control Board</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Top loss batch</div>
                  {overview?.top_loss_batch ? (
                    <div className="mt-3 space-y-2">
                      <div className="text-lg font-semibold text-white">{overview.top_loss_batch.batch_code}</div>
                      <div className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${badgeTone(overview.top_loss_batch.severity)}`}>
                        {overview.top_loss_batch.severity}
                      </div>
                      <div className="text-[var(--muted)]">
                        Variance {formatKg(overview.top_loss_batch.variance_kg)} KG / {formatCurrency(overview.top_loss_batch.variance_value_inr)}
                      </div>
                      <div className="text-[var(--muted)]">
                        Estimated gross profit {formatCurrency(overview.top_loss_batch.estimated_gross_profit_inr)}
                      </div>
                      <Link href={`/steel/batches/${overview.top_loss_batch.id}`}>
                        <Button variant="outline">Open Trace</Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="mt-3 text-[var(--muted)]">No batch data yet.</div>
                  )}
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Highest risk operator</div>
                  <div className="mt-3 space-y-2">
                    {highestRiskOperator ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-white">{highestRiskOperator.name}</div>
                            <div className="text-xs text-[var(--muted)]">
                              {highestRiskOperator.batch_count} batches / {highestRiskOperator.high_risk_batches} high risk
                            </div>
                          </div>
                          <div className="text-right text-white">
                            {formatCurrency(highestRiskOperator.total_variance_value_inr)}
                          </div>
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          {formatKg(highestRiskOperator.total_variance_kg)} KG at {formatPercent(highestRiskOperator.average_loss_percent)} avg loss.
                        </div>
                      </div>
                    ) : (
                      <div className="text-[var(--muted)]">Operator-level loss signals appear once batches are recorded.</div>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Highest loss day</div>
                  {highestLossDay ? (
                    <div className="mt-3 space-y-2">
                      <div className="text-lg font-semibold text-white">{highestLossDay.date}</div>
                      <div className="text-[var(--muted)]">
                        {formatCurrency(highestLossDay.total_variance_value_inr)} / {formatKg(highestLossDay.total_variance_kg)} KG
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {highestLossDay.batch_count} batches / {highestLossDay.high_risk_batches} high-risk / avg loss {formatPercent(highestLossDay.average_loss_percent)}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 text-[var(--muted)]">Daily responsibility trends appear once batches are recorded.</div>
                  )}
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Best gross-profit batch</div>
                  {bestProfitBatch ? (
                    <div className="mt-3 space-y-2">
                      <div className="text-lg font-semibold text-white">{bestProfitBatch.batch_code}</div>
                      <div className="text-[var(--muted)]">
                        {formatCurrency(bestProfitBatch.estimated_gross_profit_inr)} / {formatCurrency(bestProfitBatch.estimated_output_value_inr)} output
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {formatKg(bestProfitBatch.actual_output_kg)} KG actual / profit per KG {formatCurrency(bestProfitBatch.profit_per_kg_inr)}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 text-[var(--muted)]">Profit visibility appears once output and rates are recorded.</div>
                  )}
                </div>
              </CardContent>
            </Card>
            ) : null}

            <Card>
              <CardHeader><CardTitle>Stock Reconciliation</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4 text-sm">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Operational zones</div>
                  <div className="mt-3 grid gap-3">
                    {Object.entries(inventoryZones).map(([zone, quantity]) => (
                      <div key={zone} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] px-3 py-3">
                        <div>
                          <div className="font-semibold text-white">{zone}</div>
                          <div className="text-xs text-[var(--muted)]">Derived from material category until exact yard/bin tracking is modeled.</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-white">{formatKg(quantity)} KG</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <Select value={reconcileForm.item_id} onChange={(event) => setReconcileForm((current) => ({ ...current, item_id: event.target.value }))}>
                  <option value="">Select item</option>
                  {stock.map((item) => (
                    <option key={item.item_id} value={item.item_id}>{item.item_code} - {item.name}</option>
                  ))}
                </Select>
                <Input type="number" min="0" step="0.01" value={reconcileForm.physical_qty_kg} onChange={(event) => setReconcileForm((current) => ({ ...current, physical_qty_kg: event.target.value }))} placeholder="Physical KG" />
                <Select
                  value={reconcileForm.mismatch_cause}
                  onChange={(event) => setReconcileForm((current) => ({ ...current, mismatch_cause: event.target.value }))}
                >
                  <option value="">Mismatch root cause</option>
                  {STEEL_MISMATCH_CAUSE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
                <Textarea value={reconcileForm.notes} onChange={(event) => setReconcileForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Count notes" />
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Mismatch preview</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-[var(--muted)]">System stock</div>
                      <div className="mt-1 font-semibold text-white">{formatKg(reconcileSystemQty)} KG</div>
                    </div>
                    <div>
                      <div className="text-[var(--muted)]">Operational zone</div>
                      <div className="mt-1 font-semibold text-white">{selectedReconcileItem ? deriveOperationalZone(selectedReconcileItem.category) : "Select item first"}</div>
                    </div>
                    <div>
                      <div className="text-[var(--muted)]">Physical stock</div>
                      <div className="mt-1 font-semibold text-white">{formatKg(reconcilePhysicalQty || 0)} KG</div>
                    </div>
                    <div>
                      <div className="text-[var(--muted)]">Variance</div>
                      <div className="mt-1 font-semibold text-white">
                        {formatKg(reconcileVarianceKg)} KG / {formatPercent(reconcileVariancePercent)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-[var(--muted)]">
                    {reconcileNeedsCause
                      ? `Root cause required before saving. Current tag: ${formatMismatchCause(reconcileForm.mismatch_cause || null)}.`
                      : "No mismatch detected. Cause can stay blank for matched stock."}
                  </div>
                </div>
                {reconciliationValidationMessage ? (
                  <div className="text-xs text-amber-200">{reconciliationValidationMessage}</div>
                ) : (
                  <div className="text-xs text-[var(--muted)]">Ready to save this reconciliation into the stock review loop.</div>
                )}
                <Button
                  disabled={busy || !canManage || Boolean(reconciliationValidationMessage)}
                  onClick={() =>
                    runAction(async () => {
                      await reconcileSteelStock({
                        item_id: Number(reconcileForm.item_id),
                        physical_qty_kg: Number(reconcilePhysicalQty),
                        notes: reconcileForm.notes || undefined,
                        mismatch_cause: (reconcileForm.mismatch_cause || undefined) as SteelStockMismatchCause | undefined,
                      });
                      setReconcileForm({ item_id: "", physical_qty_kg: "", notes: "", mismatch_cause: "" });
                    }, "Stock reconciliation saved.")
                  }
                >
                  {canManage ? "Save Reconciliation" : "Manager access required"}
                </Button>
              </CardContent>
            </Card>

          </div>
        </section>
        ) : null}

        {activeTab === "risk" ? (
        <section id="risk-lane" className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader><CardTitle>Leakage Alert Ladder</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {rankedAnomalies.length ? (
                rankedAnomalies.map((entry) => (
                  <div key={entry.batch.id} className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Rank #{entry.rank}</div>
                        <div className="mt-1 text-lg font-semibold text-white">{entry.batch.batch_code}</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">
                          {entry.batch.production_date} / {entry.batch.operator_name || "Operator not tagged"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${badgeTone(entry.batch.severity)}`}>
                          {entry.batch.severity}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white">Score {entry.anomaly_score.toFixed(2)}</div>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Variance</div>
                        <div className="mt-1 text-sm font-semibold text-white">{formatKg(entry.batch.variance_kg)} KG</div>
                        <div className="text-xs text-[var(--muted)]">{formatPercent(entry.batch.variance_percent)}</div>
                      </div>
                      {canSeeFinancials ? (
                        <>
                          <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Leakage Value</div>
                            <div className="mt-1 text-sm font-semibold text-white">{formatCurrency(entry.estimated_leakage_value_inr || 0)}</div>
                            <div className="text-xs text-[var(--muted)]">Potential margin erosion</div>
                          </div>
                          <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Gross Profit</div>
                            <div className="mt-1 text-sm font-semibold text-white">{formatCurrency(entry.batch.estimated_gross_profit_inr || 0)}</div>
                            <div className="text-xs text-[var(--muted)]">Profit after input cost snapshot</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Loss</div>
                            <div className="mt-1 text-sm font-semibold text-white">{formatPercent(entry.batch.loss_percent)}</div>
                            <div className="text-xs text-[var(--muted)]">Operational deviation</div>
                          </div>
                          <div className="rounded-2xl border border-[var(--border)] px-3 py-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Signal</div>
                            <div className="mt-1 text-sm font-semibold text-white">{entry.batch.severity}</div>
                            <div className="text-xs text-[var(--muted)]">Investigate process drift</div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="max-w-2xl text-sm text-[var(--muted)]">{entry.reason}</div>
                      <Link href={`/steel/batches/${entry.batch.id}`}>
                        <Button variant="outline">Open batch trace</Button>
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted)]">
                  Ranked leakage alerts appear after watch/high/critical steel batches are recorded.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Responsibility Analytics</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Loss by operator</div>
                <div className="mt-3 space-y-3">
                  {responsibility?.by_operator?.length ? (
                    responsibility.by_operator.map((row) => (
                      <div key={row.user_id} className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-white">{row.name}</div>
                          <div className="text-xs text-[var(--muted)]">
                            {row.batch_count} batches / {row.high_risk_batches} high risk / avg loss {formatPercent(row.average_loss_percent)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-white">
                            {canSeeFinancials ? formatCurrency(row.total_variance_value_inr || 0) : `${formatKg(row.total_variance_kg)} KG`}
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            {canSeeFinancials ? `${formatKg(row.total_variance_kg)} KG` : `${row.critical_batches} critical batches`}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-[var(--muted)]">Operator responsibility signals appear once batches are recorded.</div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Highest loss days</div>
                <div className="mt-3 space-y-3">
                  {responsibility?.by_day?.length ? (
                    responsibility.by_day.slice(0, 4).map((row) => (
                      <div key={row.date} className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-white">{row.date}</div>
                          <div className="text-xs text-[var(--muted)]">
                            {row.batch_count} batches / {row.high_risk_batches} high risk
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-white">
                            {canSeeFinancials ? formatCurrency(row.total_variance_value_inr || 0) : `${formatKg(row.total_variance_kg)} KG`}
                          </div>
                          <div className="text-xs text-[var(--muted)]">{formatPercent(row.average_loss_percent)} avg loss</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-[var(--muted)]">Day-level responsibility trends appear once batches are recorded.</div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Loss by batch</div>
                <div className="mt-3 space-y-3">
                  {responsibility?.by_batch?.length ? (
                    responsibility.by_batch.slice(0, 4).map((row) => (
                      <div key={row.id} className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-white">{row.batch_code}</div>
                          <div className="text-xs text-[var(--muted)]">
                            {row.production_date} / {row.operator_name || "Operator not tagged"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-white">
                            {canSeeFinancials ? formatCurrency(row.variance_value_inr || 0) : `${formatKg(row.variance_kg)} KG`}
                          </div>
                          <div className="text-xs text-[var(--muted)]">
                            {canSeeFinancials ? `Score ${row.anomaly_score.toFixed(2)}` : formatPercent(row.loss_percent)}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-[var(--muted)]">Batch responsibility signals appear once batches are recorded.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
        ) : null}

        {activeTab === "production" ? (
        <>
          <section id="production-lane" className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader><CardTitle>Record Production Batch</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {!hasInputMaterials || !hasOutputMaterials ? (
                  <div className="rounded-2xl border border-amber-400/35 bg-[rgba(245,158,11,0.12)] px-3 py-2 text-xs text-amber-100">
                    Material setup is incomplete for this factory. Add inventory items first, then record production.
                    <Button variant="ghost" className="ml-2 px-2 py-1 text-xs" onClick={() => navigateTab("inventory")}>
                      Open Inventory
                    </Button>
                  </div>
                ) : null}
                <Input value={batchForm.batch_code} onChange={(event) => setBatchForm((current) => ({ ...current, batch_code: event.target.value }))} placeholder="Batch code (optional)" />
                <Input type="date" value={batchForm.production_date} onChange={(event) => setBatchForm((current) => ({ ...current, production_date: event.target.value }))} />
                <Select value={batchForm.input_item_id} onChange={(event) => setBatchForm((current) => ({ ...current, input_item_id: event.target.value }))}>
                  <option value="">Input material</option>
                  {inputItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.item_code} - {item.name}</option>
                  ))}
                </Select>
                <Select value={batchForm.output_item_id} onChange={(event) => setBatchForm((current) => ({ ...current, output_item_id: event.target.value }))}>
                  <option value="">Output material</option>
                  {outputItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.item_code} - {item.name}</option>
                  ))}
                </Select>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input type="number" min="0" step="0.01" value={batchForm.input_quantity_kg} onChange={(event) => setBatchForm((current) => ({ ...current, input_quantity_kg: event.target.value }))} placeholder="Input KG" />
                  <Input type="number" min="0" step="0.01" value={batchForm.expected_output_kg} onChange={(event) => setBatchForm((current) => ({ ...current, expected_output_kg: event.target.value }))} placeholder="Expected KG" />
                  <Input type="number" min="0" step="0.01" value={batchForm.actual_output_kg} onChange={(event) => setBatchForm((current) => ({ ...current, actual_output_kg: event.target.value }))} placeholder="Actual KG" />
                </div>
                <Textarea value={batchForm.notes} onChange={(event) => setBatchForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Heat, operator, or loss notes" />
                {productionValidationMessage ? (
                  <div className="text-xs text-amber-200">{productionValidationMessage}</div>
                ) : (
                  <div className="text-xs text-[var(--muted)]">Ready to post this batch directly to the steel ledger.</div>
                )}
                <Button
                  disabled={!canSubmitBatch}
                  onClick={() =>
                    runAction(async () => {
                      if (!batchInputItemId || !batchOutputItemId || !batchInputQuantity || !batchExpectedOutput || !batchActualOutput) {
                        throw new Error(productionValidationMessage || "Complete all required batch fields.");
                      }
                      const batchCodeError = validateIdentifierCode(batchForm.batch_code, "Batch code", 40);
                      if (batchCodeError) {
                        throw new Error(batchCodeError);
                      }
                      await createSteelBatch({
                        batch_code: batchForm.batch_code || undefined,
                        production_date: batchForm.production_date,
                        input_item_id: batchInputItemId,
                        output_item_id: batchOutputItemId,
                        input_quantity_kg: batchInputQuantity,
                        expected_output_kg: batchExpectedOutput,
                        actual_output_kg: batchActualOutput,
                        notes: batchForm.notes || undefined,
                      });
                      setBatchForm({
                        batch_code: "",
                        production_date: todayValue(),
                        input_item_id: "",
                        output_item_id: "",
                        input_quantity_kg: "",
                        expected_output_kg: "",
                        actual_output_kg: "",
                        notes: "",
                      });
                    }, "Steel batch recorded and posted to the ledger.")
                  }
                >
                  {canRecordBatch ? "Record Batch" : "Manager access required"}
                </Button>
              </CardContent>
            </Card>
            <Card className="border border-[var(--border)] bg-[rgba(20,24,36,0.88)]">
              <CardHeader>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">Production Snapshot</div>
                <CardTitle className="text-xl">Latest batch signals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[var(--muted)]">
                <div>{overview?.batch_metrics.total_batches || 0} batches recorded in the active steel context.</div>
                <div>Average loss is currently {formatPercent(overview?.batch_metrics.average_loss_percent || 0)}.</div>
                <div>{overview?.batch_metrics.high_severity_batches || 0} high severity batches need follow-up.</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link href="/steel/reconciliations">
                    <Button variant="outline">Open Reconciliations</Button>
                  </Link>
                  <Button variant="ghost" onClick={() => navigateTab("risk")}>Open Risk Lane</Button>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader><CardTitle>Recent Batches and Variance Signals</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveScrollArea
                className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                debugLabel="steel-command-center-ledger"
              >
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[var(--muted)]">
                    <tr className="border-b border-[var(--border)]">
                      <th className="px-3 py-3 font-medium">Batch</th>
                      <th className="px-3 py-3 font-medium">Expected</th>
                      <th className="px-3 py-3 font-medium">Actual</th>
                      <th className="px-3 py-3 font-medium">Variance</th>
                      <th className="px-3 py-3 font-medium">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch) => (
                      <tr key={batch.id} className="border-b border-[var(--border)]/60 last:border-none">
                        <td className="px-3 py-3">
                          <div className="font-semibold text-white">{batch.batch_code}</div>
                          <div className="text-xs text-[var(--muted)]">{batch.production_date}</div>
                        </td>
                        <td className="px-3 py-3">{formatKg(batch.expected_output_kg)} KG</td>
                        <td className="px-3 py-3">{formatKg(batch.actual_output_kg)} KG</td>
                        <td className="px-3 py-3">
                          <div>{formatKg(batch.variance_kg)} KG</div>
                          <div className="text-xs text-[var(--muted)]">
                            {canSeeFinancials ? formatCurrency(batch.variance_value_inr || 0) : formatPercent(batch.variance_percent)}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${badgeTone(batch.severity)}`}>
                            {batch.severity}
                          </span>
                          <div className="mt-2">
                            <Link href={`/steel/batches/${batch.id}`} className="text-xs font-medium text-[var(--accent)] hover:underline">
                              Open traceability
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveScrollArea>
            </CardContent>
          </Card>
        </>
        ) : null}

        {status ? <div className="text-sm text-green-400">{status}</div> : null}
        {error || sessionError ? <div className="text-sm text-red-400">{error || sessionError}</div> : null}
      </div>
    </main>
  );
}
