"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OperationalPageShell } from "@/components/ui/operational-page-shell";
import { PageMain } from "@/components/ui/page-main";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DataTable,
} from "@/components/ui/data-table/data-table";
import {
  createDataTableColumnHelper,
  type DataTableColumnDef,
} from "@/components/ui/data-table/data-table-types";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { useDataTableRouteState } from "@/hooks/use-data-table-route-state";
import { queryKeys } from "@/lib/query-keys";
import { listSteelBatches, listSteelItems, type SteelBatch, type SteelItem } from "@/lib/steel";
import { useSession } from "@/lib/use-session";

const BATCH_LIST_LIMIT = 100;
const columnHelper = createDataTableColumnHelper<BatchListRow>();

type BatchListRow = {
  id: number;
  batchId: string;
  itemCode: string;
  itemLabel: string;
  outputKg: number;
  lossKg: number;
  productionDate: string;
  status: string;
};

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

function getStatusBadgeStatus(status: string) {
  switch (status.toLowerCase()) {
    case "recorded":
    case "completed":
    case "approved":
      return "success";
    case "pending":
    case "watch":
    case "draft":
      return "warning";
    case "dispatched":
      return "info";
    case "failed":
    case "rejected":
      return "destructive";
    default:
      return "secondary";
  }
}

function highlightMatches(row: BatchListRow, normalizedHighlight: string) {
  if (!normalizedHighlight) return false;
  const batchId = row.batchId.toLowerCase();
  if (batchId === normalizedHighlight) return true;
  const itemCode = row.itemCode.toLowerCase();
  return itemCode ? itemCode === normalizedHighlight : false;
}

export function SteelBatchesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, activeFactory, loading, error: sessionError } = useSession();
  const queryState = useDataTableRouteState({
    defaultSorting: [{ id: "productionDate", desc: true }],
    filterIds: ["date"],
  });
  const hasAutoScrolled = useRef(false);

  const source = searchParams.get("source")?.trim() || "";
  const highlight = searchParams.get("highlight")?.trim() || "";
  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";

  const batchesQuery = useQuery({
    queryKey: queryKeys.steel.batches(BATCH_LIST_LIMIT),
    queryFn: async () => {
      const payload = await listSteelBatches(BATCH_LIST_LIMIT);
      return payload.items || [];
    },
    enabled: Boolean(user) && isSteelFactory,
    staleTime: 60_000,
  });

  const itemsQuery = useQuery({
    queryKey: queryKeys.steel.inventory.items(),
    queryFn: async ({ signal }) => {
      const payload = await listSteelItems({ signal });
      return payload.items || [];
    },
    enabled: Boolean(user) && isSteelFactory,
    staleTime: 60_000,
  });

  const itemById = useMemo(() => {
    const map = new Map<number, SteelItem>();
    for (const item of itemsQuery.data ?? []) {
      map.set(item.id, item);
    }
    return map;
  }, [itemsQuery.data]);

  const rows = useMemo<BatchListRow[]>(() => {
    return (batchesQuery.data ?? []).map((batch: SteelBatch) => {
      const outputItem = itemById.get(batch.output_item_id);
      const itemCode = outputItem?.item_code || "";
      const itemName = outputItem?.name || batch.output_item_name || "";
      return {
        id: batch.id,
        batchId: batch.batch_code || String(batch.id),
        itemCode,
        itemLabel: itemCode && itemName ? `${itemCode} - ${itemName}` : itemCode || itemName || `Item #${batch.output_item_id}`,
        outputKg: batch.actual_output_kg ?? 0,
        lossKg: batch.loss_kg ?? 0,
        productionDate: batch.production_date || "",
        status: batch.status || "unknown",
      };
    });
  }, [batchesQuery.data, itemById]);

  const search = queryState.search.trim().toLowerCase();
  const dateFilter = queryState.columnFilters.find((filter) => filter.id === "date")?.value?.toString() ?? "";
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch =
        !search ||
        row.batchId.toLowerCase().includes(search) ||
        row.itemCode.toLowerCase().includes(search) ||
        row.itemLabel.toLowerCase().includes(search);
      const matchesDate = !dateFilter || row.productionDate === dateFilter;
      return matchesSearch && matchesDate;
    });
  }, [dateFilter, rows, search]);

  const highlightedRowId = useMemo(() => {
    const normalizedHighlight = highlight.toLowerCase();
    if (!normalizedHighlight) {
      return null;
    }

    const match = filteredRows.find((row) => highlightMatches(row, normalizedHighlight)) ?? null;
    return match ? String(match.id) : null;
  }, [filteredRows, highlight]);

  useEffect(() => {
    if (hasAutoScrolled.current || !highlightedRowId) {
      return;
    }

    hasAutoScrolled.current = true;
  }, [highlightedRowId]);

  const columns = useMemo(
    () =>
      [
        columnHelper.accessor("batchId", {
          header: "Batch ID",
          cell: (info) => (
            <div className="space-y-xs">
              <div className="font-semibold text-text-primary">{info.getValue()}</div>
              <div className="font-mono text-label-dense text-text-secondary">
                Record #{info.row.original.id}
              </div>
            </div>
          ),
          meta: {
            isRowHeader: true,
          },
        }),
        columnHelper.accessor("itemLabel", {
          header: "SKU / Item Code",
          cell: (info) => <span className="text-text-primary">{info.getValue()}</span>,
        }),
        columnHelper.accessor("productionDate", {
          header: "Production Date",
          cell: (info) => formatDate(info.getValue()),
          meta: {
            align: "left",
          },
        }),
        columnHelper.accessor("outputKg", {
          header: "Actual Output",
          cell: (info) => (
            <span className="font-mono tabular-nums text-text-primary">
              {formatKg(info.getValue())} KG
            </span>
          ),
          meta: {
            align: "right",
          },
        }),
        columnHelper.accessor("lossKg", {
          header: "Loss",
          cell: (info) => (
            <span className="font-mono tabular-nums text-text-primary">
              {formatKg(info.getValue())} KG
            </span>
          ),
          meta: {
            align: "right",
          },
        }),
        columnHelper.accessor("status", {
          header: "Status",
          cell: (info) => (
            <Badge status={getStatusBadgeStatus(info.getValue())} size="compact">
              {info.getValue()}
            </Badge>
          ),
        }),
      ] as DataTableColumnDef<BatchListRow, unknown>[],
    [],
  );

  const activeFilters = [
    search
      ? {
          id: "search",
          label: "Search",
          value: queryState.search,
          onClear: () => queryState.setSearch(""),
        }
      : null,
    dateFilter
      ? {
          id: "date",
          label: "Date",
          value: formatDate(dateFilter),
          onClear: () => queryState.setColumnFilter("date", ""),
        }
      : null,
  ].filter(Boolean) as Array<{ id: string; label: string; value: string; onClear: () => void }>;

  if (!user) {
    return (
      <PageMain maxWidth="3xl" innerClassName="flex min-h-[50vh] items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Steel Batches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-status-danger-fg">{sessionError || "Please sign in to continue."}</div>
            <Link href="/access">
              <Button>Open Access</Button>
            </Link>
          </CardContent>
        </Card>
      </PageMain>
    );
  }

  if (!isSteelFactory) {
    return (
      <OperationalPageShell
        title="Steel batches are factory-aware"
        description="Switch into a steel factory from the sidebar, or update the factory profile in Settings first."
      >
        <Card className="mx-auto max-w-4xl">
          <CardContent className="space-y-4 py-lg text-sm text-text-secondary">
            <div>
              Your active factory is <span className="font-semibold text-text-primary">{activeFactory?.name || "not selected"}</span>.
            </div>
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
      </OperationalPageShell>
    );
  }

  return (
    <OperationalPageShell
      eyebrow="Steel Batches"
      title="Investigate production batches"
      description="Continue from batch signals into a governed production list, then open the batch trace that needs attention."
      isLoading={loading || (!user && !sessionError)}
      loadingTitle="Loading steel batches..."
      contentClassName="space-y-6"
    >
        {source === "charts" ? (
          <div className="rounded-panel border border-border-subtle bg-surface-shell px-md py-sm text-sm text-text-secondary">
            Showing batches from steel performance overview.
          </div>
        ) : null}

        <StickyActionBar
          variant="page"
          status="info"
          statusLabel="Live workspace"
          title="Batch list"
          description="Filter in place, keep state in the URL, and open records without leaving the workflow."
          primaryAction={{
            id: "open-production-record",
            label: "Create batch",
            onAction: () => router.push("/steel/production/record"),
          }}
        />

        <FilterBar
          fields={[
            {
              id: "search",
              label: "Search",
              type: "text",
              value: queryState.search,
              placeholder: "Search by batch ID or item code",
              onValueChange: queryState.setSearch,
            },
            {
              id: "date",
              label: "Production date",
              type: "date",
              value: dateFilter,
              onValueChange: (value) => queryState.setColumnFilter("date", value),
            },
          ]}
          activeFilters={activeFilters}
          onClearAll={queryState.clearAll}
        />

        <LoadingBoundary
          isLoading={batchesQuery.isLoading || itemsQuery.isLoading}
          isFetching={batchesQuery.isFetching || itemsQuery.isFetching}
          isError={batchesQuery.isError || itemsQuery.isError}
          error={batchesQuery.error ?? itemsQuery.error ?? null}
          hasData={rows.length > 0}
          isEmpty={filteredRows.length === 0}
          onRetry={() => {
            void batchesQuery.refetch();
            void itemsQuery.refetch();
          }}
          emptyFallback={
            <EmptyState
              title={rows.length === 0 ? "No steel batches yet." : "No steel batches match your filters."}
              description={
                rows.length === 0
                  ? "Create the first production batch to start tracking output and losses."
                  : "Adjust or clear the active filters to broaden the batch list."
              }
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    if (rows.length === 0) {
                      router.push("/steel/production/record");
                      return;
                    }

                    queryState.clearAll();
                  }}
                >
                  {rows.length === 0 ? "Create batch" : "Clear filters"}
                </Button>
              }
            />
          }
        >
          <DataTable<BatchListRow>
            ariaLabel="Steel batches"
            columns={columns}
            data={filteredRows}
            activeRowId={highlightedRowId}
            enableGlobalSearch={false}
            enableSorting
            manualSorting={false}
            onRowClick={(row) => router.push(`/steel/batches/${row.id}`)}
            sorting={queryState.sorting}
            onSortingChange={(updater) => {
              const nextSorting =
                typeof updater === "function" ? updater(queryState.sorting) : updater;
              queryState.setSorting(nextSorting);
            }}
            emptyMessage="No steel batches match the current filters."
            emptyTitle="No matching batches"
            viewportSize="lg"
          />
        </LoadingBoundary>
    </OperationalPageShell>
  );
}
