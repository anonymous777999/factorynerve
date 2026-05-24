import * as React from "react";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge, type BadgeStatus } from "@/components/ui/badge";
import {
  createDataTableColumnHelper,
  type DataTableColumnDef,
} from "@/components/ui/data-table/data-table-types";
import { DataTableToolbar } from "@/components/ui/data-table/data-table-toolbar";
import { FilterBar } from "@/components/ui/filter-bar";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { OperationalTable, type OperationalTableProps } from "@/components/ui/operational-table";
import { activeFilters, filterFields, queueTableRows } from "@/stories/operational-fixtures";

type QueueRow = (typeof queueTableRows)[number];

const columnHelper = createDataTableColumnHelper<QueueRow>();

const columns = [
  columnHelper.accessor("id", {
    header: "Queue ID",
    cell: (info) => info.getValue(),
    enableSorting: true,
    meta: { isRowHeader: true, sticky: "left", sortable: true },
  }),
  columnHelper.accessor("lane", {
    header: "Lane",
    cell: (info) => info.getValue(),
    enableSorting: true,
    meta: { sortable: true },
  }),
  columnHelper.accessor("document", {
    header: "Document",
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("station", {
    header: "Station",
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("owner", {
    header: "Owner",
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor("age", {
    header: "Age",
    cell: (info) => info.getValue(),
    meta: { align: "right", cellClassName: "font-mono" },
  }),
  columnHelper.accessor("variance", {
    header: "Variance",
    cell: (info) => info.getValue(),
    meta: { align: "right", cellClassName: "font-mono" },
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => (
      <div className="flex justify-center">
        <Badge status={info.getValue() as BadgeStatus}>{info.getValue()}</Badge>
      </div>
    ),
    meta: { align: "center" },
  }),
] as DataTableColumnDef<QueueRow>[];

function OperationalTablePreview(args: OperationalTableProps<QueueRow>) {
  const [searchValue, setSearchValue] = React.useState("");
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const filteredRows = React.useMemo(() => {
    const normalized = searchValue.trim().toLowerCase();
    return args.data.filter((row) =>
      !normalized ||
      Object.values(row).some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [args.data, searchValue]);

  return (
    <OperationalTable<QueueRow>
      {...args}
      columns={columns}
      data={filteredRows}
      enableBulkSelection
      enableSorting
      enableGlobalSearch
      onColumnFiltersChange={setColumnFilters}
      onSearchChange={setSearchValue}
      onSortingChange={setSorting}
      searchValue={searchValue}
      sorting={sorting}
      renderToolbar={
        <div className="space-y-sm">
          <FilterBar
            title="Queue filters"
            resultCount={`${filteredRows.length} records`}
            fields={filterFields}
            activeFilters={activeFilters}
            onClearAll={() => {
              setSearchValue("");
              setColumnFilters([]);
              setSorting([]);
            }}
          />
          <DataTableToolbar
            searchPlaceholder="Search queue, station, document"
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            onClear={() => {
              setSearchValue("");
              setColumnFilters([]);
              setSorting([]);
            }}
          />
        </div>
      }
      state={{ columnFilters, sorting, search: searchValue }}
    />
  );
}

const meta = {
  title: "Operational/OperationalTable",
  component: OperationalTable,
  tags: ["autodocs"],
  render: (args) => <OperationalTablePreview {...args} />,
  args: {
    title: "Backlog table",
    description: "Dense queue table for OCR, approvals, inventory, and reconciliation lanes.",
    eyebrow: "Approval queue",
    toneLabel: "Virtualized",
    headerMeta: "Selection, sorting, and keyboard shortcuts are built into the table layer.",
    data: queueTableRows,
    columns,
    ariaLabel: "Approval backlog table",
    caption: "Current backlog across operational lanes",
    viewportSize: "md",
  },
  parameters: {
    controls: {
      exclude: ["columns", "data", "renderToolbar", "onColumnFiltersChange", "onSearchChange", "onSortingChange"],
    },
  },
} satisfies Meta<typeof OperationalTable<QueueRow>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Queue: Story = {};

export const Mobile: Story = {
  parameters: {
    viewport: { value: "mobile1" },
  },
};

export const Loading: Story = {
  render: (args) => (
    <LoadingBoundary isLoading hasData={false} loadingTitle="Loading queue table">
      <OperationalTablePreview {...args} />
    </LoadingBoundary>
  ),
};

export const Empty: Story = {
  args: {
    data: [],
  },
};

export const ErrorState: Story = {
  render: (args) => (
    <LoadingBoundary
      isError
      hasData={false}
      error={new Error("Queue table sync failed during approval refresh.")}
      onRetry={() => undefined}
    >
      <OperationalTablePreview {...args} />
    </LoadingBoundary>
  ),
};
