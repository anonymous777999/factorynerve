"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { RecoveryBanner } from "@/components/ui/recovery-banner";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { ProductionRecordForm } from "@/components/steel/production-record/production-record-form";
import { ProductionRecordReviewModal } from "@/components/steel/production-record/production-record-review-modal";
import { ProductionRecordSidebar } from "@/components/steel/production-record/production-record-sidebar";
import { useSteelProductionRecordRouteState } from "@/hooks/use-steel-production-record-route-state";
import {
  useClearSteelProductionDraftMutation,
  useCreateSteelBatchMutation,
  useSaveSteelProductionDraftMutation,
  useSteelItemsQuery,
  useSteelProductionDraftQuery,
} from "@/hooks/use-steel-queries";
import {
  buildSteelProductionRecordDraft,
  createEmptySteelProductionRecordValues,
  formatDraftTimestamp,
  hasSteelProductionRecordDraftContent,
  saveSteelProductionRecordDraft,
  steelProductionRecordSchema,
  type SteelProductionRecordDraft,
  type SteelProductionRecordFormValues,
} from "@/lib/steel-production-record";
import {
  calculateSteelProductionRecordMetrics,
  getSeverityBadgeStatus,
} from "@/lib/steel-production-record-metrics";
import { useSession } from "@/lib/use-session";

type RecoveryMode = "available" | "confirm-discard" | "hidden";

function normalizeBatchCode(value: string) {
  return value.trim().toUpperCase();
}

function isShortcutKey(event: KeyboardEvent, key: string) {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === key;
}

export function SteelProductionRecordPage() {
  const router = useRouter();
  const reviewRoute = useSteelProductionRecordRouteState();
  const { user, activeFactory, loading, error: sessionError } = useSession();
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [recoveryMode, setRecoveryMode] = useState<RecoveryMode>("hidden");
  const [recoveryScope, setRecoveryScope] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);

  const isSteelFactory = (activeFactory?.industry_type || "").toLowerCase() === "steel";
  const canRecord = Boolean(
    user && ["owner", "admin", "manager", "supervisor"].includes(user.role),
  );

  const draftIdentity = useMemo(
    () => ({
      factoryId: activeFactory?.factory_id ?? null,
      userId: user?.id ?? null,
    }),
    [activeFactory?.factory_id, user?.id],
  );
  const draftScopeKey = `${draftIdentity.factoryId ?? "unknown-factory"}:${draftIdentity.userId ?? "anonymous"}`;
  const draftEnabled = Boolean(user && isSteelFactory);

  const defaultValues = useMemo(() => createEmptySteelProductionRecordValues(), []);
  const { control, formState, getValues, handleSubmit, reset, setFocus, trigger, watch } =
    useForm<SteelProductionRecordFormValues>({
      resolver: zodResolver(steelProductionRecordSchema),
      mode: "onBlur",
      reValidateMode: "onBlur",
      defaultValues,
    });

  const watchedValues = watch();
  const itemsQuery = useSteelItemsQuery(Boolean(user && isSteelFactory));
  const createBatchMutation = useCreateSteelBatchMutation();
  const draftQuery = useSteelProductionDraftQuery(draftIdentity, draftEnabled);
  const saveDraftMutation = useSaveSteelProductionDraftMutation(draftIdentity);
  const clearDraftMutation = useClearSteelProductionDraftMutation(draftIdentity);
  const items = itemsQuery.data ?? [];
  const activeDraft = draftQuery.data ?? null;
  const draftUpdatedAt = activeDraft?.updatedAt ?? null;

  useEffect(() => {
    if (recoveryScope === draftScopeKey) {
      return;
    }

    setRecoveryScope(draftScopeKey);
    setRecoveryMode("hidden");
  }, [draftScopeKey, recoveryScope]);

  useEffect(() => {
    if (!draftEnabled || draftQuery.isPending) {
      return;
    }

    if (!activeDraft) {
      if (!formState.isDirty) {
        setRecoveryMode("hidden");
      }
      return;
    }

    setRecoveryMode((currentMode) => {
      if (currentMode === "confirm-discard") {
        return currentMode;
      }
      return formState.isDirty ? "hidden" : "available";
    });
  }, [activeDraft, draftEnabled, draftQuery.isPending, formState.isDirty]);

  const itemOptions = useMemo(
    () =>
      items.map((item) => ({
        value: String(item.id),
        label: `${item.item_code} - ${item.name}`,
        meta: item.category,
        keywords: [item.item_code, item.name, item.category],
      })),
    [items],
  );

  const itemById = useMemo(
    () => new Map(items.map((item) => [String(item.id), item])),
    [items],
  );
  const inputItem = itemById.get(watchedValues.input_item_id) ?? null;
  const outputItem = itemById.get(watchedValues.output_item_id) ?? null;
  const metrics = useMemo(
    () =>
      calculateSteelProductionRecordMetrics({
        inputItemId: watchedValues.input_item_id,
        outputItemId: watchedValues.output_item_id,
        inputQuantityKg: watchedValues.input_quantity_kg,
        expectedOutputKg: watchedValues.expected_output_kg,
        actualOutputKg: watchedValues.actual_output_kg,
      }),
    [
      watchedValues.actual_output_kg,
      watchedValues.expected_output_kg,
      watchedValues.input_item_id,
      watchedValues.input_quantity_kg,
      watchedValues.output_item_id,
    ],
  );

  const persistDraftSnapshot = useEffectEvent(
    async (reason: "autosave" | "manual"): Promise<SteelProductionRecordDraft | null> => {
      if (!draftEnabled) {
        return null;
      }

      const values = getValues();
      if (!hasSteelProductionRecordDraftContent(values)) {
        if (reason === "manual") {
          setErrorMessage("Enter at least one production field before saving a local draft.");
          setStatusMessage("");
        }
        return null;
      }

      const draft = buildSteelProductionRecordDraft(values);

      try {
        await saveDraftMutation.mutateAsync(draft);
        if (reason === "manual") {
          setStatusMessage("Saved the local production draft.");
          setErrorMessage("");
        }
        return draft;
      } catch (error) {
        if (reason === "manual") {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not save the local production draft.",
          );
          setStatusMessage("");
        }
        return null;
      }
    },
  );

  const persistDraftBeforeUnload = useEffectEvent(() => {
    if (!draftEnabled || !formState.isDirty) {
      return;
    }

    const values = getValues();
    if (!hasSteelProductionRecordDraftContent(values)) {
      return;
    }

    const draft = buildSteelProductionRecordDraft(values);
    void saveSteelProductionRecordDraft(draftIdentity, draft);
  });

  const clearDraftState = useEffectEvent(async () => {
    await clearDraftMutation.mutateAsync();
    setRecoveryMode("hidden");
  });

  const resetWorkspace = useEffectEvent((message: string) => {
    reset(createEmptySteelProductionRecordValues());
    setStatusMessage(message);
    setErrorMessage("");
    setRecoveryMode("hidden");
    setTimeout(() => setFocus("batch_code"), 0);
  });

  const handleResumeDraft = useEffectEvent(async () => {
    if (!activeDraft) {
      return;
    }

    reset(activeDraft.values);
    setRecoveryMode("hidden");
    setStatusMessage("Recovered the locally saved production draft.");
    setErrorMessage("");
    await trigger();
    setTimeout(() => setFocus("batch_code"), 0);
  });

  const handleDiscardDraft = useEffectEvent(async () => {
    if (recoveryMode !== "confirm-discard") {
      setRecoveryMode("confirm-discard");
      return;
    }

    await clearDraftState();
    resetWorkspace("Discarded the local draft and reset the production workspace.");
  });

  const openReviewModal = useEffectEvent(async () => {
    const valid = await trigger();
    if (!valid) {
      setErrorMessage("Resolve the highlighted production fields before reviewing the ledger commit.");
      setStatusMessage("");
      return;
    }

    setErrorMessage("");
    reviewRoute.openReview();
  });

  const onSubmit = useEffectEvent(async (values: SteelProductionRecordFormValues) => {
    setStatusMessage("");
    setErrorMessage("");

    try {
      const payload = await createBatchMutation.mutateAsync({
        batch_code: normalizeBatchCode(values.batch_code) || null,
        production_date: values.production_date,
        input_item_id: Number(values.input_item_id),
        output_item_id: Number(values.output_item_id),
        input_quantity_kg: Number(values.input_quantity_kg),
        expected_output_kg: Number(values.expected_output_kg),
        actual_output_kg: Number(values.actual_output_kg),
        notes: values.notes.trim() || null,
      });

      await clearDraftState();
      reset(createEmptySteelProductionRecordValues());
      reviewRoute.closeReview();
      router.push(`/steel/batches/${payload.batch.id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not record the production batch.",
      );
      reviewRoute.closeReview();
    }
  });

  useEffect(() => {
    if (!draftEnabled || !formState.isDirty) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void persistDraftSnapshot("autosave");
    }, 10_000);

    return () => window.clearInterval(intervalId);
  }, [draftEnabled, formState.isDirty, persistDraftSnapshot]);

  useEffect(() => {
    if (!draftEnabled) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!formState.isDirty) {
        return;
      }

      persistDraftBeforeUnload();
      event.preventDefault();
      event.returnValue = "";
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persistDraftBeforeUnload();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", persistDraftBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", persistDraftBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [draftEnabled, formState.isDirty, persistDraftBeforeUnload]);

  useEffect(() => {
    if (!canRecord || !isSteelFactory) {
      return;
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (reviewRoute.reviewOpen) {
        return;
      }

      const target = event.target;
      const isInsideForm = target instanceof HTMLElement && !!formRef.current?.contains(target);
      if (!isInsideForm) {
        return;
      }

      if (isShortcutKey(event, "s")) {
        event.preventDefault();
        void persistDraftSnapshot("manual");
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void openReviewModal();
        return;
      }

      if (event.key === "Escape" && target instanceof HTMLElement) {
        target.blur();
      }
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [
    canRecord,
    isSteelFactory,
    openReviewModal,
    persistDraftSnapshot,
    reviewRoute.reviewOpen,
  ]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-text-secondary">
        Loading production record workspace...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Production Record</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-status-danger-fg">
              {sessionError || "Please sign in to continue."}
            </div>
            <Link href="/access">
              <Button>Open Access</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!isSteelFactory) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Production recording is factory-aware</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-text-secondary">
              <div>
                Your active factory is{" "}
                <span className="font-semibold text-text-primary">
                  {activeFactory?.name || "not selected"}
                </span>
                .
              </div>
              <div>
                Switch into a steel factory from the sidebar before recording a production batch.
              </div>
              <div className="flex gap-3">
                <Link href="/steel">
                  <Button>Open Steel Module</Button>
                </Link>
                <Link href="/settings">
                  <Button variant="outline">Open Settings</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-3 py-4 md:px-4 md:py-5">
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="rounded-panel border border-border-default bg-surface-panel px-lg py-md shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-md">
            <div className="min-w-0 space-y-xs">
              <div className="text-label-dense uppercase tracking-wide text-text-tertiary">
                Steel Production Record
              </div>
              <h1 className="text-page-title font-semibold text-text-primary">
                Keyboard-first operational capture
              </h1>
              <p className="max-w-3xl text-label text-text-secondary">
                Search materials, capture weights, review live yield and variance, then confirm
                the ledger transformation before commit.
              </p>
            </div>
            <div className="flex gap-sm">
              <Link href="/steel/batches">
                <Button variant="outline" size="compact">
                  Batch List
                </Button>
              </Link>
              <Badge status={getSeverityBadgeStatus(metrics.severity)}>{metrics.severityLabel}</Badge>
            </div>
          </div>
        </section>

        {(recoveryMode === "available" && activeDraft) || recoveryMode === "confirm-discard" ? (
          <RecoveryBanner
            kind="unsaved-draft"
            statusLabel={recoveryMode === "confirm-discard" ? "Confirm discard" : "Draft recovery"}
            title={
              recoveryMode === "confirm-discard"
                ? "Discard the saved production draft?"
                : "A locally saved production draft is available"
            }
            description={
              recoveryMode === "confirm-discard"
                ? "This clears the saved recovery snapshot for this factory and operator. Choose keep draft if you want to preserve it."
                : "Resume to restore the last saved field state, or discard only after confirming you no longer need this recovery point."
            }
            meta={draftUpdatedAt ? `Last saved ${formatDraftTimestamp(draftUpdatedAt)}` : undefined}
            primaryAction={{
              id: "resume-production-draft",
              label: recoveryMode === "confirm-discard" ? "Keep draft" : "Resume draft",
              onAction:
                recoveryMode === "confirm-discard"
                  ? () => setRecoveryMode(activeDraft ? "available" : "hidden")
                  : () => void handleResumeDraft(),
            }}
            secondaryAction={{
              id:
                recoveryMode === "confirm-discard"
                  ? "confirm-discard-production-draft"
                  : "discard-production-draft",
              label: recoveryMode === "confirm-discard" ? "Confirm discard" : "Discard draft",
              variant: "outline",
              onAction: () => void handleDiscardDraft(),
            }}
          />
        ) : null}

        {statusMessage ? (
          <RecoveryBanner
            kind="reconnecting"
            statusLabel="Operational continuity"
            title={statusMessage}
            description="The production workspace remains locally recoverable while you continue data entry."
          />
        ) : null}

        {errorMessage ? (
          <RecoveryBanner
            kind="sync-failure"
            statusLabel="Action required"
            title="Production record needs attention"
            description={errorMessage}
          />
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_22rem]">
          <LoadingBoundary
            isLoading={itemsQuery.isLoading || draftQuery.isLoading}
            isFetching={itemsQuery.isFetching || draftQuery.isFetching}
            isError={itemsQuery.isError || draftQuery.isError}
            error={
              itemsQuery.error instanceof Error
                ? itemsQuery.error
                : draftQuery.error instanceof Error
                  ? draftQuery.error
                  : null
            }
            hasData={items.length > 0}
            isEmpty={!itemsQuery.isLoading && items.length === 0}
            loadingTitle="Loading steel items"
            loadingMessage="Preparing governed inventory choices for this production record."
            emptyTitle="No steel items are available yet"
            emptyMessage="Create inventory items first so production batches can map input and output materials."
            errorTitle="Steel items could not be loaded"
            errorMessage="Retry to restore governed item ownership for this workflow."
            onRetry={() => {
              void itemsQuery.refetch();
              void draftQuery.refetch();
            }}
          >
            <div className="space-y-4">
              <Card>
                <CardHeader className="px-md pt-md">
                  <div className="flex flex-wrap items-center justify-between gap-sm">
                    <div>
                      <CardTitle className="text-lg">Production lane</CardTitle>
                      <div className="mt-xs text-label-dense text-text-secondary">
                        Compact data entry with searchable materials and live operational math.
                      </div>
                    </div>
                    <div className="flex items-center gap-sm text-label-dense text-text-secondary">
                      <span>Cmd/Ctrl+S save</span>
                      <span>Cmd/Ctrl+Enter verify</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-md pb-md">
                  {!canRecord ? (
                    <div className="py-4 text-sm text-status-warning-fg">
                      Supervisor or higher access is required to record production batches.
                    </div>
                  ) : (
                    <form
                      ref={formRef}
                      onSubmit={(event) => event.preventDefault()}
                      className="space-y-4"
                      noValidate
                    >
                      <ProductionRecordForm control={control} itemOptions={itemOptions} />
                    </form>
                  )}
                </CardContent>
              </Card>

              {metrics.warnings.length ? (
                <RecoveryBanner
                  kind={metrics.severity === "critical" ? "sync-failure" : "offline"}
                  statusLabel={metrics.severityLabel}
                  title={metrics.statusLabel}
                  description={metrics.warnings[0]}
                  meta={
                    metrics.warnings.length > 1
                      ? `${metrics.warnings.length} operational checks are currently active.`
                      : "One operational check is currently active."
                  }
                />
              ) : null}
            </div>
          </LoadingBoundary>

          <ProductionRecordSidebar
            inputItem={inputItem}
            outputItem={outputItem}
            metrics={metrics}
          />
        </div>

        {canRecord ? (
          <StickyActionBar
            status={
              createBatchMutation.isPending
                ? "processing"
                : saveDraftMutation.isPending
                  ? "processing"
                  : formState.isDirty
                    ? "draft"
                    : getSeverityBadgeStatus(metrics.severity)
            }
            statusLabel={
              createBatchMutation.isPending
                ? "Posting batch"
                : saveDraftMutation.isPending
                  ? "Saving draft"
                  : formState.isDirty
                    ? "Unsaved changes"
                    : metrics.severityLabel
            }
            title="Operational action flow"
            description="Save locally at any point, then verify the transformation before committing it to the production ledger."
            meta={
              draftUpdatedAt
                ? `Autosave ${formatDraftTimestamp(draftUpdatedAt)} | ${metrics.statusLabel}`
                : `No local draft saved yet | ${metrics.statusLabel}`
            }
            primaryAction={{
              id: "verify-production-record",
              label: "Verify Batch",
              onAction: () => void openReviewModal(),
              disabled: createBatchMutation.isPending,
              shortcutHint: "Cmd+Enter",
            }}
            secondaryAction={{
              id: "save-production-draft",
              label: "Save Draft",
              variant: "outline",
              onAction: () => void persistDraftSnapshot("manual"),
              disabled: createBatchMutation.isPending,
              shortcutHint: "Cmd+S",
            }}
            tertiaryAction={{
              id: activeDraft ? "discard-production-draft" : "reset-form",
              label: activeDraft ? "Discard Draft" : "Reset Form",
              variant: "ghost",
              onAction: activeDraft
                ? () => void handleDiscardDraft()
                : () => {
                    void (async () => {
                      await clearDraftState();
                      resetWorkspace("Reset the form to a fresh production record.");
                    })();
                  },
              disabled: createBatchMutation.isPending,
            }}
          />
        ) : null}

        <ProductionRecordReviewModal
          open={reviewRoute.reviewOpen}
          onOpenChange={(open) => reviewRoute.setReviewOpen(open)}
          onConfirm={() => void handleSubmit((values) => void onSubmit(values))()}
          confirmBusy={createBatchMutation.isPending}
          values={watchedValues}
          inputItem={inputItem}
          outputItem={outputItem}
          metrics={metrics}
        />
      </div>
    </main>
  );
}
