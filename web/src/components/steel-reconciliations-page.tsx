"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import {
  createDataTableColumnHelper,
  type DataTableColumnDef,
} from "@/components/ui/data-table/data-table-types";
import { DataTable } from "@/components/ui/data-table/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { OperationalDrawer } from "@/components/ui/operational-drawer";
import { Select } from "@/components/ui/select";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { Textarea } from "@/components/ui/textarea";
import { queryKeys } from "@/lib/query-keys";
import {
  approveSteelReconciliation,
  getSteelReconciliationsSummary,
  listSteelReconciliations,
  listSteelStock,
  rejectSteelReconciliation,
  type SteelReconciliation,
  type SteelStockItem,
  type SteelStockMismatchCause,
} from "@/lib/steel";
import { useSession } from "@/lib/use-session";

const columnHelper = createDataTableColumnHelper<SteelReconciliation>();

const decisionSchema = z.object({
  approverNotes: z.string().optional(),
  rejectionReason: z.string().optional(),
  mismatchCause: z.string().optional(),
});

const MISMATCH_CAUSE_OPTIONS: Array<{ value: SteelStockMismatchCause; label: string }> = [
  { value: "counting_error", label: "Counting Error" },
  { value: "process_loss", label: "Process Loss" },
  { value: "theft_or_leakage", label: "Theft / Leakage" },
  { value: "wrong_entry", label: "Wrong Entry" },
  { value: "delayed_dispatch_update", label: "Delayed Dispatch Update" },
  { value: "other", label: "Other" },
];

function formatKg(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value || 0);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function badgeStatus(value: string) {
  if (value === "approved" || value === "green") return "success";
  if (value === "pending" || value === "yellow") return "warning";
  if (value === "rejected" || value === "red") return "destructive";
  return "secondary";
}

function mismatchActionLink(value: SteelStockMismatchCause | string | null | undefined) {
  switch (value) {
    case "counting_error":
      return { href: "/steel/reconciliations", label: "Recount this stock" };
    case "process_loss":
      return { href: "/steel/production/record", label: "Open production lane" };
    case "theft_or_leakage":
      return { href: "/approvals", label: "Escalate in review queue" };
    case "wrong_entry":
      return { href: "/steel/invoices", label: "Check invoice or stock entries" };
    case "delayed_dispatch_update":
      return { href: "/steel/dispatches", label: "Check dispatch posting" };
    default:
      return { href: "/steel", label: "Open steel command center" };
  }
}

function canReviewSteel(role?: string | null) {
  return ["owner", "admin"].includes(role || "");
}

export function SteelReconciliationsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user, activeFactory, loading, error: sessionError } = useSession();

  const statusFilter = searchParams.get("status")?.trim() || "";
  const itemFilter = searchParams.get("item_id")?.trim() || "";
  const activeReconciliationId = searchParams.get("id")?.trim() || "";
  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";
  const canReview = canReviewSteel(user?.role);
  const [confirmDecision, setConfirmDecision] = useState<"approve" | "reject" | null>(null);

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        next.delete(key);
        return;
      }
      next.set(key, value);
    });
    const query = next.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  const stockQuery = useQuery({
    queryKey: queryKeys.steel.inventory.stock(),
    queryFn: () => listSteelStock(),
    enabled: Boolean(user) && isSteelFactory,
    staleTime: 60_000,
  });

  const reconciliationsQuery = useQuery({
    queryKey: [
      ...queryKeys.steel.inventory.reconciliationsRoot(),
      { itemId: itemFilter || "", status: statusFilter || "" },
    ],
    queryFn: () =>
      listSteelReconciliations({
        status: (statusFilter as "pending" | "approved" | "rejected" | "") || "",
        item_id: itemFilter ? Number(itemFilter) : undefined,
        limit: 100,
      }),
    enabled: Boolean(user) && isSteelFactory,
  });

  const summaryQuery = useQuery({
    queryKey: queryKeys.steel.inventory.reconciliationsSummary(),
    queryFn: () => getSteelReconciliationsSummary(),
    enabled: Boolean(user) && isSteelFactory,
  });

  const form = useForm<z.infer<typeof decisionSchema>>({
    resolver: zodResolver(decisionSchema),
    defaultValues: {
      approverNotes: "",
      rejectionReason: "",
      mismatchCause: "",
    },
  });

  const rows = reconciliationsQuery.data?.items ?? [];
  const items = stockQuery.data?.items ?? [];
  const activeRow = rows.find((row) => String(row.id) === activeReconciliationId) ?? null;
  const summary = summaryQuery.data?.summary;
  const mismatchCauseValue = useWatch({ control: form.control, name: "mismatchCause" });
  const rejectionReasonValue = useWatch({ control: form.control, name: "rejectionReason" });

  useEffect(() => {
    form.reset({
      approverNotes: activeRow?.approver_notes || "",
      rejectionReason: activeRow?.rejection_reason || "",
      mismatchCause: activeRow?.mismatch_cause || "",
    });
  }, [activeRow, form]);

  const decisionMutation = useMutation({
    mutationFn: async (decision: "approve" | "reject") => {
      if (!activeRow) {
        throw new Error("No reconciliation selected.");
      }

      const values = form.getValues();
      const mismatchCause = (values.mismatchCause || undefined) as SteelStockMismatchCause | undefined;

      if (decision === "approve") {
        return approveSteelReconciliation(activeRow.id, {
          approver_notes: values.approverNotes || null,
          mismatch_cause: mismatchCause,
        });
      }

      if (!values.rejectionReason?.trim()) {
        throw new Error("Rejection reason is required.");
      }

      return rejectSteelReconciliation(activeRow.id, {
        rejection_reason: values.rejectionReason.trim(),
        approver_notes: values.approverNotes || null,
        mismatch_cause: mismatchCause,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.steel.inventory.reconciliationsRoot() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.steel.inventory.reconciliationsSummary() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.steel.inventory.stock() }),
      ]);
      setConfirmDecision(null);
      updateParams({ id: null });
    },
  });

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor("item_code", {
          header: "Item",
          cell: (info) => (
            <div className="space-y-xs">
              <div className="font-semibold text-text-primary">
                {info.getValue() || `Item #${info.row.original.item_id}`}
              </div>
              <div className="text-label-dense text-text-secondary">
                {info.row.original.item_name || "Unknown item"}
              </div>
            </div>
          ),
          meta: { isRowHeader: true },
        }),
        columnHelper.accessor("status", {
          header: "Status",
          cell: (info) => (
            <Badge status={badgeStatus(info.getValue())} size="compact">
              {info.getValue()}
            </Badge>
          ),
        }),
        columnHelper.accessor("confidence_status", {
          header: "Confidence",
          cell: (info) => (
            <Badge status={badgeStatus(info.getValue())} size="compact">
              {info.getValue()}
            </Badge>
          ),
        }),
        columnHelper.accessor("system_qty_kg", {
          header: "System",
          cell: (info) => <span className="font-mono tabular-nums">{formatKg(info.getValue())} KG</span>,
          meta: { align: "right" },
        }),
        columnHelper.accessor("physical_qty_kg", {
          header: "Physical",
          cell: (info) => <span className="font-mono tabular-nums">{formatKg(info.getValue())} KG</span>,
          meta: { align: "right" },
        }),
        columnHelper.accessor("variance_kg", {
          header: "Variance",
          cell: (info) => <span className="font-mono tabular-nums">{formatKg(info.getValue())} KG</span>,
          meta: { align: "right" },
        }),
        columnHelper.accessor("counted_at", {
          header: "Counted",
          cell: (info) => formatDateTime(info.getValue()),
        }),
      ] as DataTableColumnDef<SteelReconciliation, unknown>[],
    [],
  );

  if (loading || (isSteelFactory && (reconciliationsQuery.isLoading || stockQuery.isLoading) && !reconciliationsQuery.data)) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl">
          <LoadingBoundary isLoading loadingTitle="Loading stock review" loadingRows={8}>
            <div />
          </LoadingBoundary>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Steel Reconciliations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-status-danger-fg">{sessionError || "Please sign in to continue."}</div>
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
              <CardTitle>Steel reconciliations are factory-aware</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-text-secondary">
              <div>
                Your active factory is <span className="font-semibold text-text-primary">{activeFactory?.name || "not selected"}</span>.
              </div>
              <div>Switch into a steel factory from the sidebar, or update the factory profile in Settings first.</div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-panel border border-border-default bg-surface-panel px-lg py-lg shadow-xs">
          <div className="max-w-4xl">
            <div className="text-sm uppercase tracking-wide text-text-secondary">Steel Reconciliations</div>
            <h1 className="mt-2 text-3xl font-semibold text-text-primary md:text-4xl">Stock mismatches</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
              Reconciliation compares your physical stock count against the system ledger so you can close inventory trust gaps without leaving the list workflow.
            </p>
          </div>
        </section>

        <StickyActionBar
          variant="page"
          status="warning"
          statusLabel="Review queue"
          title="Stock review"
          description="Open a mismatch in the drawer, decide it, and return to the same queue state."
          primaryAction={{
            id: "open-approvals",
            label: "Open approvals",
            onAction: () => router.push("/approvals"),
          }}
          secondaryAction={{
            id: "refresh-stock-review",
            label: reconciliationsQuery.isFetching ? "Refreshing" : "Refresh",
            variant: "outline",
            disabled: reconciliationsQuery.isFetching,
            onAction: () => {
              void reconciliationsQuery.refetch();
              void summaryQuery.refetch();
            },
          }}
        />

        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Pending</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-text-primary">{summary?.pending_reviews ?? rows.filter((row) => row.status === "pending").length}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Matched</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-text-primary">{summary?.matched_items ?? rows.filter((row) => row.confidence_status === "green").length}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Mismatch</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-text-primary">{summary?.mismatch_items ?? rows.filter((row) => row.confidence_status !== "green").length}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Accuracy</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold text-text-primary">{summary?.accuracy_percent?.toFixed(1) ?? "0.0"}%</CardContent>
          </Card>
        </section>

        <FilterBar
          fields={[
            {
              id: "status",
              label: "Status",
              type: "select",
              value: statusFilter,
              onValueChange: (value) => updateParams({ status: value || null }),
              options: [
                { label: "Pending", value: "pending" },
                { label: "Approved", value: "approved" },
                { label: "Rejected", value: "rejected" },
              ],
              placeholder: "All statuses",
            },
            {
              id: "item_id",
              label: "Item",
              type: "select",
              value: itemFilter,
              onValueChange: (value) => updateParams({ item_id: value || null }),
              options: items.map((item: SteelStockItem) => ({
                label: `${item.item_code} - ${item.name}`,
                value: String(item.item_id),
              })),
              placeholder: "All items",
            },
          ]}
          activeFilters={[
            statusFilter
              ? {
                  id: "status",
                  label: "Status",
                  value: statusFilter,
                  onClear: () => updateParams({ status: null }),
                }
              : null,
            itemFilter
              ? {
                  id: "item_id",
                  label: "Item",
                  value: items.find((item) => String(item.item_id) === itemFilter)?.item_code || itemFilter,
                  onClear: () => updateParams({ item_id: null }),
                }
              : null,
          ].filter(Boolean) as Array<{ id: string; label: string; value: string; onClear: () => void }>}
          onClearAll={() => updateParams({ status: null, item_id: null })}
        />

        <LoadingBoundary
          isLoading={reconciliationsQuery.isLoading}
          isFetching={reconciliationsQuery.isFetching}
          isError={reconciliationsQuery.isError || stockQuery.isError || summaryQuery.isError}
          error={(reconciliationsQuery.error || stockQuery.error || summaryQuery.error) as Error | null}
          hasData={rows.length > 0}
          isEmpty={rows.length === 0}
          onRetry={() => {
            void reconciliationsQuery.refetch();
            void stockQuery.refetch();
            void summaryQuery.refetch();
          }}
          emptyFallback={
            <EmptyState
              title="No reconciliation records match the current filters."
              description="Clear the stock review filters or come back after the next count is recorded."
              action={
                <Button variant="outline" onClick={() => updateParams({ status: null, item_id: null })}>
                  Clear filters
                </Button>
              }
            />
          }
        >
          <DataTable<SteelReconciliation>
            ariaLabel="Steel reconciliation queue"
            columns={columns}
            data={rows}
            activeRowId={activeRow ? String(activeRow.id) : null}
            enableSorting
            onRowClick={(row) => updateParams({ id: String(row.id) })}
          />
        </LoadingBoundary>

        <OperationalDrawer
          open={Boolean(activeRow)}
          onOpenChange={(open) => {
            if (!open) {
              updateParams({ id: null });
            }
          }}
          title={activeRow ? `${activeRow.item_code || `Item #${activeRow.item_id}`} reconciliation` : "Reconciliation"}
          description="Review the mismatch, capture the cause, and confirm the decision without leaving the list."
          status={activeRow ? badgeStatus(activeRow.status) : "secondary"}
          statusLabel={activeRow?.status || "review"}
          footer={
            activeRow ? (
              <StickyActionBar
                variant="drawer"
                status={badgeStatus(activeRow.status)}
                statusLabel={activeRow.status}
                title="Decision"
                description={canReview ? "Approve or reject after capturing the root cause." : "Review is visible, but final approval is restricted by role."}
                primaryAction={
                  canReview && activeRow.status === "pending"
                    ? {
                        id: "approve-reconciliation",
                        label: "Approve",
                        onAction: () => setConfirmDecision("approve"),
                      }
                    : undefined
                }
                secondaryAction={
                  canReview && activeRow.status === "pending"
                    ? {
                        id: "reject-reconciliation",
                        label: "Reject",
                        variant: "destructive",
                        onAction: () => setConfirmDecision("reject"),
                      }
                    : {
                        id: "close-reconciliation",
                        label: "Close",
                        variant: "ghost",
                        onAction: () => updateParams({ id: null }),
                      }
                }
              />
            ) : null
          }
        >
          {activeRow ? (
            <form className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-panel border border-border-subtle bg-surface-shell px-md py-sm">
                  <div className="text-xs uppercase tracking-wide text-text-secondary">System</div>
                  <div className="mt-1 font-mono text-lg text-text-primary">{formatKg(activeRow.system_qty_kg)} KG</div>
                </div>
                <div className="rounded-panel border border-border-subtle bg-surface-shell px-md py-sm">
                  <div className="text-xs uppercase tracking-wide text-text-secondary">Physical</div>
                  <div className="mt-1 font-mono text-lg text-text-primary">{formatKg(activeRow.physical_qty_kg)} KG</div>
                </div>
                <div className="rounded-panel border border-border-subtle bg-surface-shell px-md py-sm">
                  <div className="text-xs uppercase tracking-wide text-text-secondary">Variance</div>
                  <div className="mt-1 font-mono text-lg text-text-primary">{formatKg(activeRow.variance_kg)} KG</div>
                </div>
                <div className="rounded-panel border border-border-subtle bg-surface-shell px-md py-sm">
                  <div className="text-xs uppercase tracking-wide text-text-secondary">Variance %</div>
                  <div className="mt-1 font-mono text-lg text-text-primary">{activeRow.variance_percent.toFixed(2)}%</div>
                </div>
              </div>

              <div className="rounded-panel border border-border-subtle bg-surface-shell px-md py-sm text-sm text-text-secondary">
                Counted by {activeRow.counted_by_name || "Unknown"} on {formatDateTime(activeRow.counted_at)}
              </div>

              {activeRow.notes ? (
                <div className="rounded-panel border border-border-subtle bg-surface-shell px-md py-sm text-sm text-text-secondary">
                  Count note: {activeRow.notes}
                </div>
              ) : null}

              <div className="space-y-sm">
                <label className="text-label-dense font-medium uppercase tracking-wide text-text-secondary">Mismatch root cause</label>
                <Select {...form.register("mismatchCause")}>
                  <option value="">Mismatch root cause</option>
                  {MISMATCH_CAUSE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-sm">
                <label className="text-label-dense font-medium uppercase tracking-wide text-text-secondary">Approver note</label>
                <Textarea {...form.register("approverNotes")} rows={3} placeholder="Capture what you checked before closing this mismatch." />
              </div>

              <div className="space-y-sm">
                <label className="text-label-dense font-medium uppercase tracking-wide text-text-secondary">Rejection reason</label>
                <Input {...form.register("rejectionReason")} placeholder="Required when rejecting this mismatch" />
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge status={badgeStatus(activeRow.confidence_status)} size="compact">
                  {activeRow.confidence_status}
                </Badge>
                <Link href={mismatchActionLink(mismatchCauseValue || activeRow.mismatch_cause).href} className="text-action-primary hover:underline">
                  {mismatchActionLink(mismatchCauseValue || activeRow.mismatch_cause).label}
                </Link>
              </div>

              {activeRow.approver_notes ? <div className="text-sm text-text-secondary">Approver note: {activeRow.approver_notes}</div> : null}
              {activeRow.rejection_reason ? <div className="text-sm text-status-danger-fg">Rejection: {activeRow.rejection_reason}</div> : null}
            </form>
          ) : null}
        </OperationalDrawer>

        <ConfirmationModal
          open={confirmDecision === "approve"}
          onOpenChange={(open) => {
            if (!open) {
              setConfirmDecision(null);
            }
          }}
          title="Approve this reconciliation?"
          description="This will close the stock mismatch and persist the decision."
          primaryActionLabel={`Approve ${activeRow?.item_code || "reconciliation"}`}
          secondaryActionLabel="Cancel"
          onConfirm={() => {
            void decisionMutation.mutateAsync("approve");
          }}
          confirmBusy={decisionMutation.isPending}
          status="warning"
          statusLabel="Pending review"
        >
          <p className="text-sm text-text-secondary">
            Variance {activeRow ? `${formatKg(activeRow.variance_kg)} KG` : "-"} will be closed with the current root-cause and approver note.
          </p>
        </ConfirmationModal>

        <ConfirmationModal
          open={confirmDecision === "reject"}
          onOpenChange={(open) => {
            if (!open) {
              setConfirmDecision(null);
            }
          }}
          title="Reject this reconciliation?"
          description="This sends the stock mismatch back for another correction pass."
          primaryActionLabel={`Reject ${activeRow?.item_code || "reconciliation"}`}
          secondaryActionLabel="Cancel"
          onConfirm={() => {
            void decisionMutation.mutateAsync("reject");
          }}
          confirmBusy={decisionMutation.isPending}
          status="destructive"
          statusLabel="Rejecting"
        >
          <p className="text-sm text-text-secondary">
            Rejection reason: {rejectionReasonValue?.trim() || "Add a reason in the drawer before confirming."}
          </p>
        </ConfirmationModal>
      </div>
    </main>
  );
}
