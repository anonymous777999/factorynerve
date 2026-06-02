/**
 * shared/tables — the operational data-table system.
 *
 * Wraps @tanstack/react-table with virtualization, sticky columns,
 * sticky headers, density modes, and the operational-grade column adapters.
 */

export { DataTable } from "@/components/ui/data-table/data-table";
export {
    createDataTableColumnHelper,
    type DataTableColumnDef,
} from "@/components/ui/data-table/data-table-types";
export { DataTableToolbar } from "@/components/ui/data-table/data-table-toolbar";
export { OperationalTable } from "@/components/ui/operational-table";
