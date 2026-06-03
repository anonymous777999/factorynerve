"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { OperationalPageShell } from "@/components/ui/operational-page-shell";
import { PageMain } from "@/components/ui/page-main";
import { DisclosurePanel } from "@/shared/operational/disclosure-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import {
  getSteelDispatchDetail,
  type SteelDispatchDetail,
  type SteelDispatchStatus,
  updateSteelDispatchStatus,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";

function formatKg(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadgeClass(status: SteelDispatchStatus) {
  if (status === "delivered") return "border-emerald-400/35 bg-emerald-500/12 text-emerald-200";
  if (status === "dispatched") return "border-cyan-400/35 bg-cyan-500/12 text-cyan-200";
  if (status === "exited") return "border-cyan-400/35 bg-cyan-500/12 text-cyan-200";
  if (status === "loaded") return "border-amber-400/35 bg-amber-500/12 text-amber-200";
  if (status === "cancelled") return "border-rose-400/35 bg-rose-500/12 text-rose-200";
  return "border-slate-400/35 bg-surface-panel/12 text-text-secondary";
}

function timelineTone(completed: boolean) {
  return completed
    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
    : "border-[var(--border)] bg-[var(--card-strong)] text-[var(--muted)]";
}

function movementState(entryTime?: string | null, exitTime?: string | null) {
  if (exitTime) return "Truck exit recorded";
  if (entryTime) return "Truck entry recorded";
  return "Yard movement waiting";
}

function formatStatusLabel(status: SteelDispatchStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

type DispatchAction = {
  label: string;
  status?: SteelDispatchStatus;
  href?: string;
  title: string;
  description: string;
};

type MovementTimelineEntry = {
  id: string;
  label: string;
  value?: string | null;
  detail: string;
  pendingDetail?: string;
};

export function SteelDispatchDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: sessionLoading, error: sessionError } = useSession();
  const [detail, setDetail] = useState<SteelDispatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [podNotes, setPodNotes] = useState("");
  const [entryTime, setEntryTime] = useState("");
  const [exitTime, setExitTime] = useState("");

  const dispatchId = Number(params?.id);
  const canManage = Boolean(
    user && ["owner", "admin", "manager", "supervisor"].includes(user.role),
  );

  const loadDetail = useCallback(async () => {
    if (!Number.isFinite(dispatchId) || dispatchId <= 0) {
      setError("Invalid steel dispatch ID.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = await getSteelDispatchDetail(dispatchId);
      setDetail(payload);
      setReceiverName(payload.dispatch.receiver_name || "");
      setPodNotes(payload.dispatch.pod_notes || "");
      setEntryTime(payload.dispatch.entry_time ? payload.dispatch.entry_time.slice(0, 16) : "");
      setExitTime(payload.dispatch.exit_time ? payload.dispatch.exit_time.slice(0, 16) : "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load steel dispatch.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [dispatchId]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) return;
    const timeoutId = window.setTimeout(() => {
      void loadDetail();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadDetail, sessionLoading, user]);

  const updateStatus = async (nextStatus: SteelDispatchStatus) => {
    if (!detail) return;
    setBusy(true);
    setStatus("");
    setError("");
    try {
      await updateSteelDispatchStatus(detail.dispatch.id, {
        status: nextStatus,
        entry_time: entryTime || undefined,
        exit_time: exitTime || undefined,
        receiver_name: receiverName || undefined,
        pod_notes: podNotes || undefined,
      });
      setStatus(`Dispatch moved to ${nextStatus}.`);
      await loadDetail();
    } catch (reason) {
      if (reason instanceof ApiError || reason instanceof Error) {
        setError(reason.message);
      } else {
        setError("Could not update dispatch status.");
      }
    } finally {
      setBusy(false);
    }
  };

  const pageLoading = sessionLoading || (Boolean(user) && loading);

  if (!user || !detail) {
    return (
      <PageMain maxWidth="3xl" innerClassName="flex min-h-[50vh] items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Steel Dispatch Detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-status-danger-fg">{error || sessionError || "Dispatch not found."}</div>
            <div className="flex gap-3">
              <Link href="/steel/dispatches">
                <Button variant="outline">Back to Dispatches</Button>
              </Link>
              {!user ? (
                <Link href="/access">
                  <Button>Open Access</Button>
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </PageMain>
    );
  }

  const dispatchStatus = detail.dispatch.status;
  const canMarkLoaded = canManage && !busy && dispatchStatus === "pending";
  const canMarkExited =
    canManage && !busy && (dispatchStatus === "pending" || dispatchStatus === "loaded");
  const canMarkDispatched =
    canManage && !busy && (dispatchStatus === "pending" || dispatchStatus === "loaded" || dispatchStatus === "exited");
  const canMarkDelivered =
    canManage && !busy && (dispatchStatus === "loaded" || dispatchStatus === "dispatched" || dispatchStatus === "exited");
  const canCancelDraft =
    canManage &&
    !busy &&
    !detail.dispatch.inventory_posted_at &&
    (dispatchStatus === "pending" || dispatchStatus === "loaded");
  const inventoryPosted = Boolean(detail.dispatch.inventory_posted_at);
  const deliveryConfirmed = Boolean(detail.dispatch.delivered_at);
  const truckExitRecorded = Boolean(detail.dispatch.exit_time);
  const invoiceReferenceWeight = (detail.dispatch.lines || []).reduce(
    (sum, line) => sum + Number(line.invoice_line_weight_kg || 0),
    0,
  );
  const dispatchCoveragePercent =
    invoiceReferenceWeight > 0
      ? (Number(detail.dispatch.total_weight_kg || 0) / invoiceReferenceWeight) * 100
      : 0;
  const workflowSummary = (() => {
    if (dispatchStatus === "cancelled") {
      return {
        heading: "Dispatch cancelled",
        body:
          "This dispatch has been closed without further movement. Inventory posting and delivery confirmation will remain stopped for this record.",
      };
    }
    if (deliveryConfirmed) {
      return {
        heading: "Dispatch delivered — workflow complete",
        body:
          "Customer delivery confirmation has been recorded and this dispatch is operationally complete. Use the audit and notes sections below for traceability review.",
      };
    }
    if (truckExitRecorded && !inventoryPosted) {
      return {
        heading: "Truck exit recorded — inventory posting pending",
        body:
          "The vehicle already has an exit timestamp, but stock has not yet been posted out of inventory. Inventory will reduce only after the dispatch reaches the required operational status.",
      };
    }
    if (dispatchStatus === "loaded" && !inventoryPosted) {
      return {
        heading: "Dispatch loaded — inventory posting pending",
        body:
          "The truck has been prepared for movement, but stock has not yet been posted out of inventory. Inventory will reduce only after the dispatch reaches the required operational status.",
      };
    }
    if (inventoryPosted && !deliveryConfirmed) {
      return {
        heading: "Dispatch in transit — delivery confirmation pending",
        body:
          "Stock has already been posted out of inventory for this dispatch. Record receiver details and POD notes after the customer accepts the material.",
      };
    }
    return {
      heading: "Dispatch pending — loading not confirmed",
      body:
        "This dispatch has been created, but loading and truck movement are still in progress. Inventory remains unchanged until the dispatch reaches an inventory-posting status.",
    };
  })();
  const movementTimeline = [
    {
      id: "created",
      label: "Dispatch created",
      value: detail.dispatch.created_at,
      detail: detail.dispatch.created_by_name
        ? `Created by ${detail.dispatch.created_by_name}`
        : "Created in dispatch desk",
    },
    {
      id: "yard-entry",
      label: "Truck entry",
      value: detail.dispatch.entry_time,
      detail: "Vehicle entered the yard/loading area",
      pendingDetail:
        "Truck entry is still pending. Record entry time when the vehicle arrives for loading.",
    },
    {
      id: "inventory-posted",
      label: "Inventory posted",
      value: detail.dispatch.inventory_posted_at,
      detail: detail.ledger_movements.length
        ? `${detail.ledger_movements.length} stock movement(s) recorded`
        : "Stock movement not posted yet",
      pendingDetail:
        "Inventory posting pending. Stock movement will occur after dispatch reaches the required operational state.",
    },
    {
      id: "yard-exit",
      label: "Truck exit",
      value: detail.dispatch.exit_time,
      detail: "Truck left the plant gate",
      pendingDetail:
        "Truck exit is still pending. Record exit time when the vehicle leaves the plant gate.",
    },
    {
      id: "delivered",
      label: "Delivery confirmed",
      value: detail.dispatch.delivered_at,
      detail: detail.dispatch.delivered_by_name
        ? `Closed by ${detail.dispatch.delivered_by_name}`
        : "Customer receipt pending",
      pendingDetail:
        "Customer delivery confirmation is still pending. Record receiver details and POD notes after material delivery.",
    },
  ];
  const nextAction: DispatchAction | null = canMarkLoaded
    ? {
      label: "Mark loaded",
      status: "loaded" as SteelDispatchStatus,
      title: "Confirm loading",
      description: "Use this when the truck has been loaded and the gate process can continue.",
    }
    : canMarkExited
      ? {
        label: "Mark exited",
        status: "exited" as SteelDispatchStatus,
        title: "Release the truck",
        description: "Confirm the truck has left the plant and post stock out of inventory.",
      }
      : canMarkDelivered
        ? {
          label: "Mark delivered",
          status: "delivered" as SteelDispatchStatus,
          title: "Close delivery",
          description: "Capture the receiver details and close the dispatch once the customer accepts it.",
        }
        : dispatchStatus === "delivered"
          ? {
            label: "Open Reconciliation",
            href: "/steel/reconciliations",
            title: "Cycle count pending",
            description: "Delivery is complete. Perform a cycle count to ensure the ledger matches physical yard stock.",
          }
          : null;
  const nextActionGuidance = (() => {
    if (dispatchStatus === "cancelled") {
      return {
        title: "Dispatch cancelled",
        description:
          "No further operational action is available on this dispatch. Review the invoice if material still needs to move.",
      };
    }
    if (deliveryConfirmed) {
      return {
        title: "Dispatch workflow complete",
        description:
          "Delivery confirmation is already recorded. Use the evidence panels below for audit or customer follow-up only.",
      };
    }
    if (inventoryPosted && !deliveryConfirmed) {
      return {
        title: "Record delivery confirmation",
        description:
          "Capture the receiver name and POD notes after the customer accepts the material to close this dispatch cleanly.",
      };
    }
    if (truckExitRecorded && !inventoryPosted) {
      return {
        title: "Move dispatch to inventory posting",
        description:
          "Truck exit is already recorded, but stock is still waiting to post. Advance the dispatch to the next valid operational state so inventory can reduce.",
      };
    }
    if (nextAction) {
      return {
        title: nextAction.title,
        description: nextAction.description,
      };
    }
    return {
      title: "No new dispatch action required",
      description:
        "This dispatch is already at its furthest valid state. Use the evidence panels below for review only.",
    };
  })();
  const dispatchTransitionAction: DispatchAction | null = canMarkDispatched
    ? {
      label: "Mark dispatched",
      status: "dispatched",
      title: "Release the truck",
      description: "Confirm the truck has left the plant and post stock out of inventory.",
    }
    : null;
  const deliveryTransitionAction: DispatchAction | null = canMarkDelivered
    ? {
      label: "Mark delivered",
      status: "delivered",
      title: "Close delivery",
      description: "Capture the receiver details and close the dispatch once the customer accepts it.",
    }
    : null;
  const recommendedAction: DispatchAction | null =
    (inventoryPosted && !deliveryConfirmed ? deliveryTransitionAction : null) ||
    (truckExitRecorded && !inventoryPosted
      ? {
        label: "Mark exited",
        status: "exited" as SteelDispatchStatus,
        title: "Record truck exit",
        description:
          "Truck exit is already recorded, but stock is still waiting to post. Move the dispatch to the next operational step so inventory can reduce.",
      }
      : null) ||
    nextAction;
  const workflowSummaryCard = (() => {
    if (dispatchStatus === "cancelled") {
      return workflowSummary;
    }
    if (deliveryConfirmed) {
      return {
        heading: "Dispatch delivered - workflow complete",
        body:
          "Customer delivery confirmation has been recorded and this dispatch is operationally complete. Use the audit and notes sections below for traceability review.",
      };
    }
    if (inventoryPosted && !deliveryConfirmed) {
      return {
        heading:
          dispatchStatus === "dispatched"
            ? "Dispatch dispatched - delivery confirmation pending"
            : "Inventory posted - delivery confirmation pending",
        body:
          "Stock has already been posted out of inventory for this dispatch. Record the receiver name and POD notes after the customer accepts the material.",
      };
    }
    if (truckExitRecorded && !inventoryPosted) {
      return {
        heading: "Truck exit recorded - inventory posting pending",
        body:
          "The vehicle already has an exit timestamp, but stock has not yet been posted out of inventory. Inventory will reduce when the dispatch is marked dispatched or delivered.",
      };
    }
    if (dispatchStatus === "loaded" && !inventoryPosted) {
      return {
        heading: "Dispatch loaded - inventory posting pending",
        body:
          "Loading is confirmed, but stock still remains in inventory. Inventory will reduce when the dispatch is marked dispatched or delivered.",
      };
    }
    return {
      heading: "Dispatch pending - loading not confirmed",
      body:
        "This dispatch has been created, but loading and truck movement are still in progress. Inventory remains unchanged until the dispatch is marked dispatched or delivered.",
    };
  })();
  const dispatchStatusLabel = formatStatusLabel(dispatchStatus);
  const dispatchStatusDetail = (() => {
    if (dispatchStatus === "cancelled") {
      return "This dispatch is closed and will not move further.";
    }
    if (dispatchStatus === "delivered") {
      return "Customer receipt is already confirmed for this dispatch.";
    }
    if (dispatchStatus === "dispatched") {
      return "The truck is in transit and inventory should already be posted.";
    }
    if (dispatchStatus === "loaded") {
      return "Material is loaded, but the dispatch still needs to be released.";
    }
    return "The dispatch exists, but loading and release are not yet confirmed.";
  })();
  const movementStateLabel = movementState(detail.dispatch.entry_time, detail.dispatch.exit_time);
  const movementStateDetail = truckExitRecorded
    ? "Truck departure from the plant gate has already been recorded."
    : detail.dispatch.entry_time
      ? "The truck has entered the yard and is still waiting for final gate release."
      : "Truck entry is still pending for this dispatch.";
  const inventoryStateLabel = inventoryPosted ? "Posted out of stock" : "Posting still pending";
  const inventoryStateDetail = inventoryPosted
    ? "Stock reduction has already been finalized for this dispatch."
    : "Stock will reduce when the dispatch is marked dispatched or delivered.";
  const deliveryStateLabel = deliveryConfirmed ? "Customer receipt recorded" : "Customer receipt pending";
  const deliveryStateDetail = deliveryConfirmed
    ? "Receiver confirmation is already recorded for this dispatch."
    : "Record receiver details and POD notes after material delivery.";
  const interpretedTimeline: MovementTimelineEntry[] = movementTimeline.map((entry) =>
    entry.id === "inventory-posted" && !entry.value
      ? {
        ...entry,
        pendingDetail:
          "Inventory posting pending. Stock movement will occur when the dispatch is marked dispatched or delivered.",
      }
      : entry,
  );
  const recommendedGuidance =
    dispatchStatus === "cancelled"
      ? {
        title: "Dispatch cancelled",
        description:
          "No further operational action is available on this dispatch. Review the invoice if material still needs to move.",
      }
      : deliveryConfirmed
        ? {
          title: "Dispatch workflow complete",
          description:
            "Delivery confirmation is already recorded. Use the evidence panels below for audit or customer follow-up only.",
        }
        : inventoryPosted && !deliveryConfirmed
          ? {
            title: "Record delivery confirmation",
            description:
              "Capture the receiver name and POD notes after the customer accepts the material to close this dispatch cleanly.",
          }
          : truckExitRecorded && !inventoryPosted && dispatchTransitionAction
            ? {
              title: "Mark dispatch as dispatched",
              description:
                "Truck exit is already recorded, but stock is still waiting to post. Mark this dispatch as dispatched so inventory can reduce.",
            }
            : recommendedAction
              ? {
                title: recommendedAction.title,
                description: recommendedAction.description,
              }
              : nextActionGuidance;

  return (
    <OperationalPageShell
      eyebrow="Steel Dispatch"
      title={detail.dispatch.dispatch_number}
      description="Check the manifest, move the truck to its next valid status, and keep inventory posting aligned with delivery proof."
      isLoading={pageLoading}
      loadingTitle="Loading steel dispatch detail..."
      contentClassName="space-y-6"
      filters={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-text-secondary">
            <span>Production</span>
            <span>→</span>
            <span>Invoice</span>
            <span>→</span>
            <span className="font-bold text-[var(--accent)]">Dispatch</span>
            <span>→</span>
            <span>Reconciliation</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`inline-flex rounded-full border px-4 py-2 text-xs uppercase tracking-[0.18em] ${statusBadgeClass(detail.dispatch.status)}`}
            >
              {detail.dispatch.status}
            </div>
            <DisclosurePanel title="Dispatch tools" className="w-full sm:max-w-xs">
              <div className="flex flex-wrap gap-3">
                <Link href="/steel/dispatches">
                  <Button variant="outline" size="compact">Dispatches</Button>
                </Link>
                <Link href={`/steel/invoices/${detail.dispatch.invoice_id}`}>
                  <Button variant="ghost" size="compact">Invoice</Button>
                </Link>
                <Link href="/steel">
                  <Button variant="ghost" size="compact">Steel hub</Button>
                </Link>
              </div>
            </DisclosurePanel>
          </div>
        </div>
      }
    >

        <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
          <CardHeader>
            <div className="text-sm text-[var(--muted)]">Workflow summary</div>
            <CardTitle className="text-xl">{workflowSummaryCard.heading}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="text-[var(--muted)]">
              {workflowSummaryCard.body}
              {detail.dispatch.lines && detail.dispatch.lines.length > 0 && detail.dispatch.lines[0].batch_code && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider text-[var(--muted)]">Upstream Origin:</span>
                  <Link
                    href={`/steel/batches/${detail.dispatch.lines[0].batch_id}`}
                    className="font-medium text-[var(--accent)] hover:underline"
                  >
                    Batch {detail.dispatch.lines[0].batch_code}
                  </Link>
                </div>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-3">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Dispatch status</div>
                <div className="mt-2 font-semibold text-white">{dispatchStatusLabel}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">{dispatchStatusDetail}</div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-3">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Truck movement</div>
                <div className="mt-2 font-semibold text-white">{movementStateLabel}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">{movementStateDetail}</div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-3">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Inventory</div>
                <div className="mt-2 font-semibold text-white">{inventoryStateLabel}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">{inventoryStateDetail}</div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-3">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Delivery</div>
                <div className="mt-2 font-semibold text-white">{deliveryStateLabel}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">{deliveryStateDetail}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4 lg:grid-cols-[1.12fr_0.88fr]">
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Next recommended action</div>
              <CardTitle className="text-xl">{recommendedGuidance.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-[var(--muted)]">{recommendedGuidance.description}</div>
              {recommendedAction ? (
                recommendedAction.href ? (
                  <Link href={recommendedAction.href}>
                    <Button className="w-full sm:w-auto">{recommendedAction.label}</Button>
                  </Link>
                ) : (
                  <Button
                    disabled={busy}
                    onClick={() => void updateStatus(recommendedAction.status!)}
                  >
                    {recommendedAction.label}
                  </Button>
                )
              ) : (
                <Button disabled>Status complete</Button>
              )}
            </CardContent>
          </Card>
          <Card className="border-[var(--border-strong)] bg-[var(--card-strong)]">
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Weight check</div>
              <CardTitle className="text-xl">Invoice coverage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="text-[var(--muted)]">Truck vs invoice</div>
              <div className="font-semibold text-white">
                {formatKg(detail.dispatch.total_weight_kg)} KG on truck | {formatKg(invoiceReferenceWeight)} KG linked
              </div>
              <div className="text-[var(--muted)]">Dispatch coverage</div>
              <div className="font-semibold text-white">
                {dispatchCoveragePercent.toFixed(1)}% of the linked invoice-line quantity
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gate Pass</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold text-white">{detail.dispatch.gate_pass_number}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dispatch Date</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold text-white">{formatDate(detail.dispatch.dispatch_date)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Truck</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold text-white">{detail.dispatch.truck_number}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Total Weight</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold text-white">{formatKg(detail.dispatch.total_weight_kg)} KG</CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Dispatch Manifest</div>
              <CardTitle className="text-xl">Material list and logistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                  <div className="text-[var(--muted)]">Invoice</div>
                  <div className="mt-1 font-semibold text-white">{detail.dispatch.invoice_number}</div>
                  <div className="mt-2 text-[var(--muted)]">Customer</div>
                  <div className="mt-1 font-semibold text-white">{detail.dispatch.customer_name || "-"}</div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                  <div className="text-[var(--muted)]">Transporter</div>
                  <div className="mt-1 font-semibold text-white">
                    {detail.dispatch.transporter_name || "Not recorded"}
                  </div>
                  <div className="mt-2 text-[var(--muted)]">Vehicle</div>
                  <div className="mt-1 font-semibold text-white">
                    {detail.dispatch.vehicle_type || "Not recorded"}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                  <div className="text-[var(--muted)]">Driver</div>
                  <div className="mt-1 font-semibold text-white">{detail.dispatch.driver_name}</div>
                  <div className="mt-2 text-[var(--muted)]">Phone / License</div>
                  <div className="mt-1 font-semibold text-white">
                    {detail.dispatch.driver_phone || "-"} / {detail.dispatch.driver_license_number || "-"}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                  <div className="text-[var(--muted)]">Entry / Exit</div>
                  <div className="mt-1 font-semibold text-white">
                    {formatDateTime(detail.dispatch.entry_time)} / {formatDateTime(detail.dispatch.exit_time)}
                  </div>
                  <div className="mt-2 text-[var(--muted)]">Truck Capacity</div>
                  <div className="mt-1 font-semibold text-white">
                    {detail.dispatch.truck_capacity_kg
                      ? `${formatKg(detail.dispatch.truck_capacity_kg)} KG`
                      : "Not recorded"}
                  </div>
                </div>
              </div>
              <ResponsiveScrollArea
                className="rounded-3xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]"
                debugLabel="steel-dispatch-detail-lines"
              >
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[var(--muted)]">
                    <tr className="border-b border-[var(--border)]">
                      <th className="px-3 py-3 font-medium">Item</th>
                      <th className="px-3 py-3 font-medium">Batch</th>
                      <th className="px-3 py-3 font-medium">Dispatched</th>
                      <th className="px-3 py-3 font-medium">Invoice Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.dispatch.lines || []).map((line) => (
                      <tr key={line.id} className="border-b border-[var(--border)]/60 last:border-none">
                        <td className="px-3 py-3">
                          <div className="font-semibold text-white">{line.item_code}</div>
                          <div className="text-xs text-[var(--muted)]">{line.item_name}</div>
                        </td>
                        <td className="px-3 py-3">
                          {line.batch_id ? (
                            <Link
                              href={`/steel/batches/${line.batch_id}`}
                              className="text-[var(--accent)] hover:underline"
                            >
                              {line.batch_code}
                            </Link>
                          ) : (
                            <span className="text-[var(--muted)]">No batch link</span>
                          )}
                        </td>
                        <td className="px-3 py-3">{formatKg(line.weight_kg)} KG</td>
                        <td className="px-3 py-3">{formatKg(line.invoice_line_weight_kg)} KG</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm text-[var(--muted)]">Status + Audit</div>
              <CardTitle className="text-xl">Dispatch control panel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 text-sm">
                <div className="text-[var(--muted)]">Created By</div>
                <div className="mt-1 font-semibold text-white">
                  {detail.dispatch.created_by_name || "Unknown"}
                </div>
                <div className="mt-2 text-[var(--muted)]">Created At</div>
                <div className="mt-1 font-semibold text-white">{formatDateTime(detail.dispatch.created_at)}</div>
                <div className="mt-2 text-[var(--muted)]">Inventory Posted</div>
                <div className="mt-1 font-semibold text-white">
                  {formatDateTime(detail.dispatch.inventory_posted_at)}
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {inventoryPosted
                    ? "Stock reduction has already been finalized for this dispatch."
                    : "Stock reduction has not been finalized yet. It will post when this dispatch is marked dispatched or delivered."}
                </div>
                <div className="mt-2 text-[var(--muted)]">Delivered</div>
                <div className="mt-1 font-semibold text-white">
                  {formatDateTime(detail.dispatch.delivered_at)}{" "}
                  {detail.dispatch.delivered_by_name
                    ? `by ${detail.dispatch.delivered_by_name}`
                    : ""}
                </div>
                {!deliveryConfirmed ? (
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    Customer receipt is still pending for this dispatch.
                  </div>
                ) : null}
              </div>

              {/* AUDIT: DENSITY_OVERLOAD - keep the editable status form as the primary lane and move lesser status actions behind a secondary reveal. */}
              <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)] p-4">
                <div>
                  <div className="text-sm font-semibold text-white">Status update</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    Record the next valid state and capture the yard or delivery proof details that support it.
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-[var(--muted)]">Entry Time</label>
                    <Input
                      aria-label="Entry time"
                      type="datetime-local"
                      value={entryTime}
                      onChange={(event) => setEntryTime(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[var(--muted)]">Exit Time</label>
                    <Input
                      aria-label="Exit time"
                      type="datetime-local"
                      value={exitTime}
                      onChange={(event) => setExitTime(event.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">Receiver Name</label>
                  <Input
                    value={receiverName}
                    onChange={(event) => setReceiverName(event.target.value)}
                    placeholder="Person receiving the dispatch"
                  />
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    The person who accepted the material delivery.
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[var(--muted)]">POD Notes</label>
                  <Textarea
                    value={podNotes}
                    onChange={(event) => setPodNotes(event.target.value)}
                    placeholder="Delivery note / proof details"
                  />
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    Record delivery proof, unloading notes, or customer confirmation details.
                  </div>
                </div>
                {recommendedAction ? (
                  recommendedAction.href ? (
                    <Link href={recommendedAction.href}>
                      <Button className="w-full sm:w-auto">{recommendedAction.label}</Button>
                    </Link>
                  ) : (
                    <Button disabled={busy} onClick={() => void updateStatus(recommendedAction.status!)}>
                      {recommendedAction.label}
                    </Button>
                  )
                ) : (
                  <Button disabled>Status complete</Button>
                )}
                <details className="group rounded-2xl border border-[var(--border)] bg-[var(--card-strong)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                    More actions
                    <span className="text-xs text-[var(--muted)] transition group-open:hidden">
                      Open
                    </span>
                    <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
                  </summary>
                  <div className="flex flex-wrap gap-3 border-t border-[var(--border)] px-4 py-4">
                    <Button
                      variant="outline"
                      disabled={!canMarkLoaded}
                      onClick={() => void updateStatus("loaded")}
                    >
                      Mark loaded
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!canMarkExited}
                      onClick={() => void updateStatus("exited")}
                    >
                      Mark exited
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!canMarkDispatched}
                      onClick={() => void updateStatus("dispatched")}
                    >
                      Mark dispatched
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!canMarkDelivered}
                      onClick={() => void updateStatus("delivered")}
                    >
                      Mark delivered
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={!canCancelDraft}
                      onClick={() => void updateStatus("cancelled")}
                    >
                      Cancel draft
                    </Button>
                  </div>
                </details>
              </div>

              {/* AUDIT: BUTTON_CLUTTER - keep evidence-heavy sections in reveals so the next status change stays easier to spot. */}
              <details className="group rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                  Movement timeline
                  <span className="text-xs text-[var(--muted)] transition group-open:hidden">
                    Open
                  </span>
                  <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
                </summary>
                <div className="space-y-3 border-t border-[var(--border)] px-4 py-4">
                  {interpretedTimeline.map((entry, index) => {
                    const completed = Boolean(entry.value);
                    return (
                      <div
                        key={entry.id}
                        className={`rounded-2xl border p-3 text-sm ${timelineTone(completed)}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-white">
                              {index + 1}. {entry.label}
                            </div>
                            <div className="mt-1 text-xs">
                              {completed ? entry.detail : entry.pendingDetail}
                            </div>
                          </div>
                          <div className="text-right text-xs">
                            {completed ? formatDateTime(entry.value) : "Waiting"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>

              <details className="group rounded-2xl border border-[var(--border)] bg-[var(--card-strong)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                  Dispatch notes
                  <span className="text-xs text-[var(--muted)] transition group-open:hidden">
                    Open
                  </span>
                  <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
                </summary>
                <div className="space-y-3 border-t border-[var(--border)] px-4 py-4 text-sm">
                  <div>
                    <div className="text-[var(--muted)]">Notes</div>
                    <div className="mt-1 text-[var(--text)]">
                      {detail.dispatch.notes || "No notes were captured for this dispatch."}
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)]">Receiver / POD</div>
                    <div className="mt-1 text-[var(--text)]">
                      {detail.dispatch.receiver_name || "Receiver not recorded"} |{" "}
                      {detail.dispatch.pod_notes || "No POD notes yet."}
                    </div>
                  </div>
                </div>
              </details>

              <details className="group rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                  Ledger movements
                  <span className="text-xs text-[var(--muted)] transition group-open:hidden">
                    {detail.ledger_movements.length || 0} items
                  </span>
                  <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
                </summary>
                <div className="space-y-3 border-t border-[var(--border)] px-4 py-4">
                  {detail.ledger_movements.map((movement) => (
                    <div key={movement.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-white">{movement.transaction_type}</div>
                        <div className="text-xs text-[var(--muted)]">
                          {formatDateTime(movement.created_at)}
                        </div>
                      </div>
                      <div className="mt-2 text-[var(--muted)]">
                        {movement.item_code} | {formatKg(movement.quantity_kg)} KG
                      </div>
                    </div>
                  ))}
                  {!detail.ledger_movements.length ? (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3 text-sm text-[var(--muted)]">
                      No inventory movement has been posted yet. Stock will post when the dispatch is marked dispatched or delivered.
                    </div>
                  ) : null}
                </div>
              </details>

              <details className="group rounded-2xl border border-[var(--border)] bg-[rgba(12,18,28,0.72)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white">
                  Audit events
                  <span className="text-xs text-[var(--muted)] transition group-open:hidden">
                    {detail.audit_events.length || 0} items
                  </span>
                  <span className="hidden text-xs text-[var(--muted)] group-open:inline">Hide</span>
                </summary>
                <div className="space-y-3 border-t border-[var(--border)] px-4 py-4">
                  {detail.audit_events.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-white">{event.action}</div>
                        <div className="text-xs text-[var(--muted)]">{formatDateTime(event.timestamp)}</div>
                      </div>
                      <div className="mt-2 text-[var(--muted)]">
                        {event.user_name || "System / background action"}
                      </div>
                      <div className="mt-2 text-[var(--text)]">
                        {event.details || "No extra audit detail."}
                      </div>
                    </div>
                  ))}
                  {!detail.audit_events.length ? (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-3 text-sm text-[var(--muted)]">
                      No audit events were linked to this dispatch yet.
                    </div>
                  ) : null}
                </div>
              </details>
            </CardContent>
          </Card>
        </section>

        {status ? <div className="text-sm text-green-400">{status}</div> : null}
        {error ? <div className="text-sm text-status-danger-fg">{error}</div> : null}
    </OperationalPageShell>
  );
}
