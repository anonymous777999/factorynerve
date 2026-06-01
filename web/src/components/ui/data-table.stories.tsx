import * as React from "react";
import type {
  ColumnFiltersState,
  SortingState,
} from "@tanstack/react-table";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor, within } from "storybook/test";

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

// Task 33: Virtual scrolling integrity dataset (1000+ rows).
const LARGE_DATASET_SIZE = 1200;
const largeDataset: DispatchRow[] = Array.from({ length: LARGE_DATASET_SIZE }, (_, index) => ({
  id: `DSP-${String(index + 1).padStart(5, "0")}`,
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

/**
 * Task 33: Virtual Scrolling Integrity.
 *
 * Renders a 1200-row dataset to validate that @tanstack/react-virtual only
 * mounts a windowed subset of rows (rather than all 1200), keeps row heights
 * consistent with the density token (40px default), and that the table owns a
 * bounded, independent scroll container.
 */
export const LargeDatasetVirtualized: Story = {
  args: {
    ariaLabel: "Large dispatch queue",
    caption: "1200-row dispatch queue for virtual scrolling validation",
    data: largeDataset,
    enableVirtualization: true,
    viewportSize: "md",
  },
  render: (args) => (
    <DataTable<DispatchRow>
      {...args}
      columns={columns}
      data={largeDataset}
      enableSorting={false}
      // Explicit bounded height so the scroll container is height-constrained.
      // In the app this comes from the `max-h-table-*` viewport utility; we pin an
      // arbitrary-value height here so virtualization is validated deterministically.
      viewportClassName="max-h-[480px]"
      renderToolbar={null}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = await canvas.findByRole("table", { name: "Large dispatch queue" });

    // The scroll viewport owns scrolling and has a bounded height (independent of page scroll).
    const viewport = canvasElement.querySelector<HTMLElement>(
      "[data-scroll-debug-label='dpr-data-table'] .responsive-scroll-area__viewport",
    );
    expect(viewport).not.toBeNull();
    expect(viewport!.clientHeight).toBeGreaterThan(0);
    expect(viewport!.clientHeight).toBeLessThanOrEqual(480);
    expect(viewport!.scrollHeight).toBeGreaterThan(viewport!.clientHeight);

    // Virtualization mounts only a windowed subset of rows, never the full set.
    // Body rows exclude the aria-hidden spacer rows used for padding.
    await waitFor(() => {
      const bodyRows = table.querySelectorAll("tbody tr:not([aria-hidden='true'])");
      expect(bodyRows.length).toBeGreaterThan(0);
      // Windowed subset must be far smaller than the full dataset (1200 rows).
      expect(bodyRows.length).toBeLessThan(200);
    });

    // Spacer rows (paddingTop/paddingBottom) keep the total scrollable height correct.
    const spacerRows = table.querySelectorAll("tbody tr[aria-hidden='true']");
    expect(spacerRows.length).toBeGreaterThan(0);

    // Row heights are consistent and derive from the density row-height token (40px default).
    const firstBodyRow = table.querySelector<HTMLElement>(
      "tbody tr:not([aria-hidden='true'])",
    );
    expect(firstBodyRow).not.toBeNull();
    expect(firstBodyRow!.style.height).toBe("40px");

    // Capture the currently rendered row indices, then scroll deep into the dataset.
    const getRenderedRowIndices = () =>
      Array.from(
        table.querySelectorAll<HTMLElement>("tbody [data-row-index]"),
      ).map((cell) => Number(cell.dataset.rowIndex));

    const initialIndices = getRenderedRowIndices();
    const initialMin = Math.min(...initialIndices);

    viewport!.scrollTop = 20_000;
    viewport!.dispatchEvent(new Event("scroll"));

    // After scrolling, the virtualizer re-windows to later rows (proves windowing tracks scroll).
    await waitFor(() => {
      const scrolledIndices = getRenderedRowIndices();
      expect(Math.min(...scrolledIndices)).toBeGreaterThan(initialMin);
      // Still a windowed subset, never the full dataset.
      expect(scrolledIndices.length).toBeLessThan(200);
    });
  },
};
