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
  ocrVerify: {
    root: () => ["ocrVerify"] as const,
    templates: () => [...queryKeys.ocrVerify.root(), "templates"] as const,
    queue: (filters: OcrVerifyQueueFilters) =>
      [...queryKeys.ocrVerify.root(), "queue", normalizeQueueFilters(filters)] as const,
    detail: (id: number) => [...queryKeys.ocrVerify.root(), "detail", id] as const,
  },
};
