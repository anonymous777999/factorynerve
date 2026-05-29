"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { queryKeys, type OcrVerifyQueueFilters } from "@/lib/query-keys";
import {
  approveOcrVerification,
  createOcrVerification,
  getOcrVerification,
  listOcrTemplates,
  listOcrVerifications,
  rejectOcrVerification,
  submitOcrVerification,
  updateOcrVerification,
  type OcrTemplate,
  type OcrVerificationRecord,
  type OcrVerificationSavePayload,
  type OcrVerificationListFilters,
} from "@/lib/ocr";

function sortVerifications(records: OcrVerificationRecord[]) {
  const weight = (status: OcrVerificationRecord["status"]) => {
    switch (status) {
      case "pending":
        return 4;
      case "rejected":
        return 3;
      case "draft":
        return 2;
      default:
        return 1;
    }
  };

  return [...records].sort((left, right) => {
    if (weight(right.status) !== weight(left.status)) {
      return weight(right.status) - weight(left.status);
    }
    return new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime();
  });
}

export function useOcrVerifyTemplatesQuery(enabled: boolean) {
  return useQuery<OcrTemplate[]>({
    queryKey: queryKeys.ocrVerify.templates(),
    queryFn: ({ signal }) => listOcrTemplates({ signal }),
    enabled,
  });
}

export function useOcrVerifyQueueQuery(filters: OcrVerifyQueueFilters, enabled: boolean) {
  return useQuery<OcrVerificationRecord[]>({
    queryKey: queryKeys.ocrVerify.queue(filters),
    queryFn: ({ signal }) => listOcrVerifications(undefined, { signal }),
    select: (records) => {
      const sorted = sortVerifications(records);
      const term = filters.search.trim().toLowerCase();
      return sorted.filter((verification) => {
        if (filters.status !== "all" && verification.status !== filters.status) {
          return false;
        }
        if (!term) {
          return true;
        }
        return [
          verification.source_filename || "",
          verification.template_name || "",
          verification.status,
          ...(verification.warnings || []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);
      });
    },
    enabled,
  });
}

export function useOcrHistoryQuery(filters: OcrVerifyQueueFilters, enabled: boolean) {
  const queryFilters: OcrVerificationListFilters = {
    search: filters.search || undefined,
    status: filters.status !== "all" ? filters.status : undefined,
    exportState: filters.exportState && filters.exportState !== "all" ? filters.exportState : undefined,
    documentType: filters.documentType || undefined,
    reviewerId: filters.reviewerId,
    minConfidence: filters.minConfidence ?? undefined,
    maxConfidence: filters.maxConfidence ?? undefined,
    updatedAfter: filters.updatedAfter || undefined,
    updatedBefore: filters.updatedBefore || undefined,
  };

  return useQuery<OcrVerificationRecord[]>({
    queryKey: queryKeys.ocrVerify.queue(filters),
    queryFn: ({ signal }) => listOcrVerifications(queryFilters, { signal }),
    select: (records) => sortVerifications(records),
    enabled,
  });
}

export function useOcrVerifyDetailQuery(id: number | null, enabled: boolean) {
  return useQuery<OcrVerificationRecord>({
    queryKey: id != null ? queryKeys.ocrVerify.detail(id) : queryKeys.ocrVerify.detailIdle(),
    queryFn: ({ signal }) => getOcrVerification(id as number, { signal }),
    enabled: enabled && id != null,
  });
}

export function useOcrVerifyRecordMutation<TVariables>(
  invalidationMode: "create" | "update",
  options: UseMutationOptions<OcrVerificationRecord, Error, TVariables>,
) {
  const queryClient = useQueryClient();

  return useMutation<OcrVerificationRecord, Error, TVariables>({
    ...options,
    onSuccess: async (record, variables, onMutateResult, context) => {
      queryClient.setQueryData(queryKeys.ocrVerify.detail(record.id), record);
      if (invalidationMode === "update") {
        await queryClient.invalidateQueries({ queryKey: queryKeys.ocrVerify.detail(record.id) });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.ocrVerify.queueRoot() });
      await options.onSuccess?.(record, variables, onMutateResult, context);
    },
  });
}

export function useCreateOcrVerificationMutation() {
  return useOcrVerifyRecordMutation<OcrVerificationSavePayload>("create", {
    mutationFn: createOcrVerification,
  });
}

export function useUpdateOcrVerificationMutation() {
  return useOcrVerifyRecordMutation<{
    id: number;
    payload: Omit<OcrVerificationSavePayload, "file">;
  }>("update", {
    mutationFn: ({ id, payload }) => updateOcrVerification(id, payload),
  });
}

export function useSubmitOcrVerificationMutation() {
  return useOcrVerifyRecordMutation<{ id: number; reviewerNotes?: string }>("update", {
    mutationFn: ({ id, reviewerNotes }) => submitOcrVerification(id, reviewerNotes),
  });
}

export function useApproveOcrVerificationMutation() {
  return useOcrVerifyRecordMutation<{ id: number; reviewerNotes?: string }>("update", {
    mutationFn: ({ id, reviewerNotes }) => approveOcrVerification(id, reviewerNotes),
  });
}

export function useRejectOcrVerificationMutation() {
  return useOcrVerifyRecordMutation<{
    id: number;
    rejectionReason: string;
    reviewerNotes?: string;
  }>("update", {
    mutationFn: ({ id, rejectionReason, reviewerNotes }) =>
      rejectOcrVerification(id, rejectionReason, reviewerNotes),
  });
}
