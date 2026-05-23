"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  createSteelBatch,
  listSteelItems,
  type SteelBatch,
  type SteelItem,
} from "@/lib/steel";
import {
  clearSteelProductionRecordDraftStorage,
  loadSteelProductionRecordDraft,
  saveSteelProductionRecordDraft,
  type SteelProductionRecordDraft,
} from "@/lib/steel-production-record";

export type CreateSteelBatchInput = {
  batch_code?: string | null;
  production_date: string;
  input_item_id: number;
  output_item_id: number;
  input_quantity_kg: number;
  expected_output_kg: number;
  actual_output_kg: number;
  notes?: string | null;
};

type SteelProductionDraftIdentity = {
  factoryId: string | null;
  userId: number | null;
};

export function useSteelItemsQuery(enabled: boolean) {
  return useQuery<SteelItem[]>({
    queryKey: queryKeys.steel.inventory.items(),
    queryFn: async ({ signal }) => {
      const payload = await listSteelItems({ signal });
      return payload.items ?? [];
    },
    enabled,
    staleTime: 60_000,
  });
}

export function useCreateSteelBatchMutation() {
  const queryClient = useQueryClient();

  return useMutation<{ batch: SteelBatch }, Error, CreateSteelBatchInput>({
    mutationFn: createSteelBatch,
    onSuccess: async (payload) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.steel.batchesRoot() }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.steel.batchDetail(payload.batch.id),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.steel.inventory.stock() }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.steel.inventory.transactionsRoot(),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.steel.overview() }),
      ]);
    },
  });
}

export function useSteelProductionDraftQuery(identity: SteelProductionDraftIdentity, enabled: boolean) {
  return useQuery<SteelProductionRecordDraft | null>({
    queryKey: queryKeys.steel.productionRecord.draft(identity.factoryId, identity.userId),
    queryFn: async () => loadSteelProductionRecordDraft(identity),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useSaveSteelProductionDraftMutation(identity: SteelProductionDraftIdentity) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.steel.productionRecord.draft(identity.factoryId, identity.userId);

  return useMutation<SteelProductionRecordDraft, Error, SteelProductionRecordDraft>({
    mutationFn: async (draft) => {
      await saveSteelProductionRecordDraft(identity, draft);
      return draft;
    },
    onSuccess: (draft) => {
      queryClient.setQueryData(queryKey, draft);
    },
  });
}

export function useClearSteelProductionDraftMutation(identity: SteelProductionDraftIdentity) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.steel.productionRecord.draft(identity.factoryId, identity.userId);

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await clearSteelProductionRecordDraftStorage(identity);
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKey, null);
    },
  });
}
