export type OcrVerifyQueueFilters = {
  search: string;
  status: "all" | "draft" | "pending" | "rejected" | "approved";
};

function normalizeQueueFilters(filters: OcrVerifyQueueFilters) {
  return {
    search: filters.search.trim().toLowerCase(),
    status: filters.status,
  };
}

export const queryKeys = {
  steel: {
    root: () => ["steel"] as const,
    overview: () => [...queryKeys.steel.root(), "overview"] as const,
    productionRecord: {
      root: () => [...queryKeys.steel.root(), "production-record"] as const,
      draft: (factoryId: string | null, userId: number | null) =>
        [
          ...queryKeys.steel.productionRecord.root(),
          "draft",
          factoryId ?? "unknown-factory",
          userId ?? "anonymous",
        ] as const,
    },
    inventory: {
      root: () => [...queryKeys.steel.root(), "inventory"] as const,
      items: () => [...queryKeys.steel.inventory.root(), "items"] as const,
      stock: () => [...queryKeys.steel.inventory.root(), "stock"] as const,
      transactionsRoot: () => [...queryKeys.steel.inventory.root(), "transactions"] as const,
      transactions: (limit: number) =>
        [...queryKeys.steel.inventory.transactionsRoot(), limit] as const,
      reconciliationsRoot: () => [...queryKeys.steel.inventory.root(), "reconciliations"] as const,
      reconciliationsSummary: () =>
        [...queryKeys.steel.inventory.reconciliationsRoot(), "summary"] as const,
    },
    batchesRoot: () => [...queryKeys.steel.root(), "batches"] as const,
    batches: (limit: number) => [...queryKeys.steel.batchesRoot(), limit] as const,
    batchDetail: (batchId: number) =>
      [...queryKeys.steel.batchesRoot(), "detail", batchId] as const,
  },
  ocr: {
    root: () => ["ocr"] as const,
    jobsRoot: () => [...queryKeys.ocr.root(), "jobs"] as const,
    job: (jobId: string) => [...queryKeys.ocr.jobsRoot(), jobId] as const,
  },
  ocrVerify: {
    root: () => ["ocrVerify"] as const,
    templates: () => [...queryKeys.ocrVerify.root(), "templates"] as const,
    queueRoot: () => [...queryKeys.ocrVerify.root(), "queue"] as const,
    queue: (filters: OcrVerifyQueueFilters) =>
      [...queryKeys.ocrVerify.root(), "queue", normalizeQueueFilters(filters)] as const,
    detail: (id: number) => [...queryKeys.ocrVerify.root(), "detail", id] as const,
    detailIdle: () => [...queryKeys.ocrVerify.root(), "detail", "idle"] as const,
  },
};
