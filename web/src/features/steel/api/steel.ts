/**
 * features/steel/api — server contract for the steel industry module.
 *
 * Re-exports `lib/steel.ts` (large API surface: inventory, dispatches,
 * invoices, customers, batches, reconciliations, production records).
 */

export * from "@/lib/steel";
export * as productionRecordApi from "@/lib/steel-production-record";
export * as productionRecordMetrics from "@/lib/steel-production-record-metrics";
export * as decisionApi from "@/lib/steel-decision";
