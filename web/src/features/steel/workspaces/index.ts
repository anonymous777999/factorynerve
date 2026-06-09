/**
 * features/steel/workspaces — full-page compositions for the steel module.
 *
 * /steel                          → command center (industry home)
 * /steel/inventory                → live stock board
 * /steel/inventory/transactions   → transaction history
 * /steel/dispatches               → dispatch queue
 * /steel/dispatches/[id]          → dispatch detail
 * /steel/invoices                 → invoice list
 * /steel/invoices/[id]            → invoice detail
 * /steel/customers                → customer master
 * /steel/customers/[id]           → customer ledger
 * /steel/batches                  → batch traceability
 * /steel/batches/[id]             → batch detail
 * /steel/reconciliations          → variance review
 * /steel/charts                   → loss/dispatch viz
 * /steel/production/record        → production record entry
 */

export { SteelCommandCenterPage as SteelCommandCenterWorkspace } from "@/components/steel-command-center-page";
export { SteelInventoryPage as SteelInventoryWorkspace } from "@/components/steel-inventory-page";
export { SteelInventoryTransactionsPage as SteelInventoryTransactionsWorkspace } from "@/components/steel-inventory-transactions-page";
export { SteelDispatchesPage as SteelDispatchesWorkspace } from "@/components/steel-dispatches-page";
export { SteelDispatchDetailPage as SteelDispatchDetailWorkspace } from "@/components/steel-dispatch-detail-page";
export { SteelInvoicesPage as SteelInvoicesWorkspace } from "@/components/steel-invoices-page";
export { SteelInvoiceDetailPage as SteelInvoiceDetailWorkspace } from "@/components/steel-invoice-detail-page";
export { SteelCustomersPage as SteelCustomersWorkspace } from "@/components/steel-customers-page";
export { SteelCustomerLedgerPage as SteelCustomerLedgerWorkspace } from "@/components/steel-customer-ledger-page";
export { SteelBatchesPage as SteelBatchesWorkspace } from "@/components/steel-batches-page";
export { SteelBatchDetailPage as SteelBatchDetailWorkspace } from "@/components/steel-batch-detail-page";
export { SteelReconciliationsPage as SteelReconciliationsWorkspace } from "@/components/steel-reconciliations-page";
export { SteelChartsPage as SteelChartsWorkspace } from "@/components/steel-charts-page";
export { SteelProductionRecordPage as SteelProductionRecordWorkspace } from "@/components/steel-production-record-page";
