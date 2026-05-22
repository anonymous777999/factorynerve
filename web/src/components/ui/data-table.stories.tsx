import * as React from "react";
import type {
  ColumnFiltersState,
  SortingState,
} from "@tanstack/react-table";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  createDataTableColumnHelper,
  type DataTableColumnDef,
} from "@/components/ui/data-table/data-table-types";
import { Badge } from "@/components/ui/badge";
import { DataTableToolbar } from "@/components/ui/data-table/data-table-toolbar";
import { DataTable, type DataTableProps } from "@/components/ui/data-table/data-table";

type DispatchRow = {
  id: string;
  isEditing?: boolean;
  vehicle: string;
  supplier: string;
  quantityKg: number;
  status: "processing" | "warning" | "success" | "paused";
};

const columnHelper = createDataTableColumnHelper<DispatchRow>();

function getDispatchStatus(index: number): DispatchRow["status"] {
  if (index % 5 === 0) {
    return "warning";
  }

  if (index % 7 === 0) {
    return "paused";
  }

  if (index % 3 === 0) {
    return "processing";
  }

  return "success";
}

const columns = [
  columnHelper.accessor("id", {
    header: "Dispatch ID",
    cell: (info) => info.getValue(),
    enableSorting: true,
    meta: {
      filterPlaceholder: "Filter ID",
      filterVariant: "text",
      isRowHeader: true,
      sortable: true,
      sticky: "left",
    },
  }),
  columnHelper.accessor("vehicle", {
    header: "Vehicle",
    cell: (info) => info.getValue(),
    enableSorting: true,
    meta: {
      filterPlaceholder: "Filter vehicle",
      filterVariant: "text",
      sortable: true,
    },
  }),
  columnHelper.accessor("supplier", {
    header: "Supplier",
    cell: (info) => info.getValue(),
    enableSorting: true,
    meta: {
      filterPlaceholder: "Filter supplier",
      filterVariant: "text",
      sortable: true,
    },
  }),
  columnHelper.accessor("quantityKg", {
    header: "Quantity",
    cell: (info) => `${info.getValue().toLocaleString("en-IN")} kg`,
    enableSorting: true,
    meta: {
      align: "right",
      cellClassName: "font-numeric text-numeric-sm",
      sortable: true,
    },
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => (
      <div className="flex justify-center">
        <Badge status={info.getValue()}>{info.getValue()}</Badge>
      </div>
    ),
    enableSorting: true,
    meta: {
      align: "center",
      filterOptions: [
        { label: "Processing", value: "processing" },
        { label: "Warning", value: "warning" },
        { label: "Success", value: "success" },
        { label: "Paused", value: "paused" },
      ],
      filterPlaceholder: "All statuses",
      filterVariant: "select",
      sortable: true,
    },
  }),
] as DataTableColumnDef<DispatchRow>[];

const rows: DispatchRow[] = Array.from({ length: 240 }, (_, index) => ({
  id: `DSP-${String(index + 1).padStart(4, "0")}`,
  isEditing: false,
  vehicle: `MH12-${3000 + index}`,
  supplier: index % 2 === 0 ? "Shree Steel Traders" : "Apex Inbound Logistics",
  quantityKg: 1200 + index * 17,
  status: getDispatchStatus(index),
}));

const rowStateRows: DispatchRow[] = [
  {
    id: "DSP-2001",
    isEditing: true,
    vehicle: "MH12-4201",
    supplier: "Shree Steel Traders",
    quantityKg: 1840,
    status: "processing",
  },
  {
    id: "DSP-2002",
    vehicle: "MH12-4202",
    supplier: "Apex Inbound Logistics",
    quantityKg: 2260,
    status: "paused",
  },
  {
    id: "DSP-2003",
    vehicle: "MH12-4203",
    supplier: "Metro Rolling Mills",
    quantityKg: 1980,
    status: "success",
  },
  {
    id: "DSP-2004",
    vehicle: "MH12-4204",
    supplier: "Unit 7 Yard Transfer",
    quantityKg: 1430,
    status: "processing",
  },
];

function DataTablePreview(args: DataTableProps<DispatchRow>) {
  const [searchValue, setSearchValue] = React.useState("");
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [selectedRowIds, setSelectedRowIds] = React.useState<string[]>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const sourceRows = args.data;

  const filteredRows = React.useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return sourceRows.filter((row) => {
      const matchesSearch =
        !normalizedSearch ||
        [row.id, row.vehicle, row.supplier, row.status].some((value) =>
          value.toLowerCase().includes(normalizedSearch),
        );

      return matchesSearch;
    });
  }, [searchValue, sourceRows]);

  return (
    <DataTable<DispatchRow>
      {...args}
      columns={columns}
      data={filteredRows}
      enableColumnFilters
      enableGlobalSearch
      enableSorting
      onSelectedRowIdsChange={setSelectedRowIds}
      onColumnFiltersChange={setColumnFilters}
      onSearchChange={setSearchValue}
      onSortingChange={setSorting}
      selectedRowIds={selectedRowIds}
      renderToolbar={
        <DataTableToolbar
          searchPlaceholder="Search dispatch, vehicle, supplier"
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          onClear={() => {
            setSearchValue("");
            setColumnFilters([]);
            setSorting([]);
          }}
        />
      }
      searchValue={searchValue}
      sorting={sorting}
      state={{
        columnFilters,
        search: searchValue,
        sorting,
      }}
    />
  );
}

function BulkActionsPreview(args: DataTableProps<DispatchRow>) {
  const [selectedRowIds, setSelectedRowIds] = React.useState<string[]>([
    "DSP-2001",
    "DSP-2002",
  ]);

  return (
    <DataTable<DispatchRow>
      {...args}
      bulkActions={[
        {
          id: "sync",
          label: "Mark synced",
          onAction: () => undefined,
          shortcutKey: "s",
          variant: "secondary",
        },
        {
          id: "pause",
          label: "Pause queue",
          onAction: () => undefined,
          shortcutKey: "p",
          variant: "outline",
        },
      ]}
      columns={columns}
      data={rowStateRows}
      enableSorting={false}
      getRowState={(row) => {
        if (row.isEditing) {
          return "editing";
        }

        if (row.status === "processing") {
          return "processing";
        }

        if (row.status === "paused") {
          return "paused";
        }

        if (row.status === "success") {
          return "synced";
        }

        return null;
      }}
      onSelectedRowIdsChange={setSelectedRowIds}
      selectedRowIds={selectedRowIds}
      renderToolbar={<DataTableToolbar searchValue="" />}
    />
  );
}

const meta = {
  title: "UI/DataTable",
  tags: ["autodocs"],
  render: (args) => <DataTablePreview {...args} />,
  args: {
    ariaLabel: "Dispatch queue",
    caption: "Dispatch verification queue for warehouse operations",
    columns,
    data: rows,
    viewportSize: "lg",
  },
  parameters: {
    controls: {
      exclude: ["columns", "data", "renderEmptyState", "getRowId", "onRowSelectionChange"],
    },
  },
} satisfies Meta<DataTableProps<DispatchRow>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const VirtualizedQueue: Story = {};

export const Empty: Story = {
  args: {
    data: [],
  },
};

export const RowStates: Story = {
  args: {
    activeRowId: "DSP-2002",
    data: rowStateRows,
    enableVirtualization: false,
    selectedRowId: "DSP-2003",
  },
  render: (args) => (
    <DataTable<DispatchRow>
      {...args}
      columns={columns}
      data={rowStateRows}
      enableSorting={false}
      getRowState={(row) => {
        if (row.isEditing) {
          return "editing";
        }

        if (row.status === "processing") {
          return "processing";
        }

        if (row.status === "paused") {
          return "paused";
        }

        if (row.status === "success") {
          return "synced";
        }

        return null;
      }}
      renderToolbar={<DataTableToolbar searchValue="" />}
    />
  ),
};

export const BulkActions: Story = {
  args: {
    data: rowStateRows,
    enableBulkSelection: true,
    enableVirtualization: false,
  },
  render: (args) => <BulkActionsPreview {...args} />,
};
