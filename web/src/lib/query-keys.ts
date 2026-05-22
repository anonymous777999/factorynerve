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
