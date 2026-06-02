"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getActiveWorkflowTemplate, getMe, type ActiveWorkflowTemplateContext, type CurrentUser } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { createEntry, getEntryConflict, listEntries } from "@/lib/entries";
import {
  clearDraft,
  countQueuedEntries,
  enqueueEntry,
  flushQueue,
  loadDraft,
  saveDraft,
  subscribeToQueueUpdates,
  withClientRequestId,
  type EntryDraft,
  type EntryPayload,
  type TemplateFieldMap,
} from "@/lib/offline-entries";
import { coerceIntegerInput } from "@/lib/validation";
import { signalWorkflowRefresh } from "@/lib/workflow-sync";
import { EntryPageSkeleton } from "@/components/page-skeletons";
import { Button } from "@/components/ui/button";
import { GuidanceHint } from "@/components/ui/guidance-block";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SuccessBanner, MutationErrorBanner } from "@/shared/feedback";
import { useGuidancePreferences } from "@/lib/guidance";
import {
  ROLE_LABELS,
  SHIFT_OPTIONS,
  STEP_DEFINITIONS,
  TRACEABILITY_FIELDS,
  BUILT_IN_TEMPLATE_FIELDS,
  TEMPLATE_SELECT_OPTIONS,
  blankDraft,
  buildTemplateNotes,
  clampProgress,
  defaultShiftValue,
  defaultTemplateFields,
  formatShiftLabel,
  hasTemplateFieldValue,
  localDateValue,
  normalizeTemplateFields,
  renderTemplateFieldValue,
  roleLabel,
  validateTemplateDraft,
  type NumericFieldKey,
  type ShiftValue,
  type StepIndex,
  type TemplateInputType,
  type TextFieldKey,
} from "@/features/entry/lib/entry-helpers";
import {
  SubmitConfirmationModal,
  type SubmitConfirmation,
} from "@/features/entry/components/submit-confirmation-modal";

type Me = CurrentUser;

export default function ShiftEntryWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<Me | null>(null);
  const [templateContext, setTemplateContext] = useState<ActiveWorkflowTemplateContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<EntryDraft>(() => blankDraft());
  const [shiftMap, setShiftMap] = useState<Record<string, number>>({});
  const [queueCount, setQueueCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [submitConfirmation, setSubmitConfirmation] = useState<SubmitConfirmation | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [activeStep, setActiveStep] = useState<StepIndex>(0);
  const queryAppliedRef = useRef(false);
  const entryTips = useGuidancePreferences("entry-flow", { autoOpenVisits: 2 });
  const showEntryTips = entryTips.visible && entryTips.expanded;

  const loadShiftMap = useCallback(async (date: string) => {
    const response = await listEntries({ date, page: 1, page_size: 50 });
    return response.items.reduce<Record<string, number>>((acc, item) => {
      acc[item.shift] = item.id;
      return acc;
    }, {});
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([getMe(), getActiveWorkflowTemplate()])
      .then(([userResult, templateResult]) => {
        if (!alive) return;
        if (userResult.status === "fulfilled") {
          setUser(userResult.value);
        } else {
          router.push("/access");
          return;
        }
        if (templateResult.status === "fulfilled") {
          setTemplateContext(templateResult.value);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [router]);

  useEffect(() => {
    if (queryAppliedRef.current) return;
    const queryDate = searchParams.get("date");
    const queryShift = searchParams.get("shift");
    const focus = searchParams.get("focus");

    if (!queryDate && !queryShift && !focus) {
      queryAppliedRef.current = true;
      return;
    }

    queryAppliedRef.current = true;

    if (queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate)) {
      setForm((prev) => ({ ...prev, date: queryDate }));
    }

    if (queryShift === "morning" || queryShift === "evening" || queryShift === "night") {
      setForm((prev) => ({ ...prev, shift: queryShift }));
    }

    if (focus === "draft") {
      setStatus("Loaded your saved draft.");
    } else if (focus === "offline") {
      setStatus("Offline queue is ready for review.");
    } else if (focus === "today") {
      setStatus("Ready for today's shift entry.");
    }
  }, [searchParams]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      template_fields: normalizeTemplateFields(templateContext, prev.template_fields),
    }));
  }, [templateContext]);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let alive = true;

    loadDraft(user.id)
      .then((draft) => {
        if (!alive) return;
        const fallback = blankDraft(user.role);
        const nextDraft = draft
          ? {
            ...fallback,
            ...draft,
            department: draft.department || fallback.department,
          }
          : fallback;
        nextDraft.template_fields = normalizeTemplateFields(templateContext, nextDraft.template_fields);
        setForm(nextDraft);
      })
      .finally(() => {
        if (alive) setDraftReady(true);
      });

    countQueuedEntries(user.id).then(setQueueCount).catch(() => setQueueCount(0));

    return () => {
      alive = false;
    };
  }, [templateContext, user]);

  useEffect(() => {
    if (!draftReady || !user) return;
    const timer = window.setTimeout(() => {
      saveDraft(user.id, form).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draftReady, form, user]);

  useEffect(() => {
    if (!user) return;
    const refreshQueueCount = () => {
      countQueuedEntries(user.id).then(setQueueCount).catch(() => setQueueCount(0));
    };
    refreshQueueCount();
    return subscribeToQueueUpdates(refreshQueueCount);
  }, [user]);

  const handleSync = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    setError("");
    setStatus("Syncing queued DPR entries...");
    try {
      const result = await flushQueue(user.id, async (payload) => {
        try {
          const entry = await createEntry(payload);
          return { status: "sent" as const, entryId: entry.id };
        } catch (err) {
          if (err instanceof ApiError) {
            const conflict = getEntryConflict(err);
            if (conflict) {
              return {
                status: "duplicate" as const,
                entryId: conflict.entryId ?? null,
                message: conflict.message,
              };
            }
          }
          throw err;
        }
      });

      setQueueCount(result.remaining);

      if (result.sent || result.duplicates || result.failed) {
        const parts = [];
        if (result.sent) parts.push(`synced ${result.sent}`);
        if (result.duplicates) {
          parts.push(`resolved ${result.duplicates} duplicate conflict${result.duplicates > 1 ? "s" : ""}`);
        }
        if (result.failed) parts.push(`${result.failed} still waiting`);
        setStatus(`Offline queue update: ${parts.join(", ")}.`);
      } else {
        setStatus("No queued entries were ready to sync.");
      }
      signalWorkflowRefresh("entry-sync");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sync queued entries right now.");
    } finally {
      setSyncing(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !online || syncing || !queueCount) return;
    void handleSync();
  }, [handleSync, online, queueCount, syncing, user]);

  useEffect(() => {
    if (!user || !form.date) return;
    loadShiftMap(form.date).then(setShiftMap).catch(() => setShiftMap({}));
  }, [form.date, loadShiftMap, user]);

  const templateSections = useMemo(
    () => templateContext?.template?.sections || [],
    [templateContext],
  );

  const extraTemplateSections = useMemo(
    () =>
      templateSections
        .map((section) => ({
          ...section,
          fields: section.fields.filter((field) => !BUILT_IN_TEMPLATE_FIELDS.has(field.key)),
        }))
        .filter((section) => section.fields.length > 0),
    [templateSections],
  );

  const departmentOptions = useMemo(() => {
    const options = [
      form.department || roleLabel(user?.role),
      roleLabel(user?.role),
      "Production",
      "Operator",
      "Maintenance",
      "Quality",
      "Dispatch",
      "Packing",
    ].filter((value): value is string => Boolean(value && value.trim()));
    return Array.from(new Set(options));
  }, [form.department, user?.role]);

  const performance = useMemo(() => {
    const target = Math.max(1, Number(form.units_target || 0));
    const produced = Math.max(0, Number(form.units_produced || 0));
    return (produced / target) * 100;
  }, [form.units_produced, form.units_target]);

  const workforceTotal = form.manpower_present + form.manpower_absent;
  const performanceLabel =
    performance >= 100 ? "On target" : performance >= 85 ? "Close to target" : "Needs attention";
  const conflictId = shiftMap[form.shift];
  const factoryLabel = user?.factory_name || templateContext?.factory_name || "Factory";
  const progressPercent = ((activeStep + 1) / STEP_DEFINITIONS.length) * 100;
  const submittedShifts = Object.entries(shiftMap);

  const alerts = useMemo(() => {
    const next: string[] = [];
    if (conflictId) {
      next.push(`This ${formatShiftLabel(form.shift).toLowerCase()} shift already has an entry.`);
    }
    if (form.units_produced < form.units_target) {
      next.push(`${form.units_target - form.units_produced} units are still behind target.`);
    }
    if (form.downtime_minutes > 0) {
      next.push(`${form.downtime_minutes} minutes of downtime recorded.`);
    }
    if (form.manpower_absent > 0) {
      next.push(`${form.manpower_absent} worker${form.manpower_absent > 1 ? "s" : ""} absent.`);
    }
    if (form.quality_issues) {
      next.push("Quality issue flagged for review.");
    }
    return next;
  }, [
    conflictId,
    form.downtime_minutes,
    form.manpower_absent,
    form.quality_issues,
    form.shift,
    form.units_produced,
    form.units_target,
  ]);

  const traceabilitySummary = useMemo(
    () =>
      TRACEABILITY_FIELDS.reduce<Array<{ label: string; value: string }>>((items, field) => {
        const value = form.template_fields?.[field.key];
        if (!hasTemplateFieldValue(value)) {
          return items;
        }
        items.push({ label: field.label, value: renderTemplateFieldValue(value) });
        return items;
      }, []),
    [form.template_fields],
  );

  const buildPayload = useCallback(
    (draft: EntryDraft): EntryPayload => ({
      date: draft.date,
      shift: draft.shift,
      department: draft.department || roleLabel(user?.role),
      units_target: draft.units_target,
      units_produced: draft.units_produced,
      manpower_present: draft.manpower_present,
      manpower_absent: draft.manpower_absent,
      downtime_minutes: draft.downtime_minutes,
      downtime_reason: draft.downtime_reason || null,
      materials_used: draft.materials_used || null,
      quality_issues: Boolean(draft.quality_issues),
      quality_details: draft.quality_details || null,
      notes: buildTemplateNotes(draft, templateContext) || null,
    }),
    [templateContext, user?.role],
  );

  const submitPayload = useCallback(
    async (draft: EntryDraft, duplicateMap: Record<string, number>) => {
      if (!user) return;
      const payload = withClientRequestId(buildPayload(draft));
      setBusy(true);
      setStatus(online ? "Saving today's DPR..." : "Saving the DPR locally for offline sync...");
      setError("");

      const templateError = validateTemplateDraft(draft, templateContext);
      if (templateError) {
        setError(templateError);
        setBusy(false);
        return;
      }

      if (duplicateMap[payload.shift]) {
        setError(`This shift is already submitted. Entry ID ${duplicateMap[payload.shift]}.`);
        setBusy(false);
        return;
      }

      if (!online) {
        await enqueueEntry(user.id, payload);
        setQueueCount(await countQueuedEntries(user.id));
        setStatus("Offline: entry saved locally and will sync when the network returns.");
        setBusy(false);
        return;
      }

      try {
        const latestShiftMap = await loadShiftMap(payload.date);
        if (latestShiftMap[payload.shift]) {
          setError(`This shift is already submitted. Entry ID ${latestShiftMap[payload.shift]}.`);
          return;
        }

        const created = await createEntry(payload);
        const submittedShift = payload.shift;
        const submittedUnits = payload.units_produced;
        const reset = blankDraft(user.role);
        reset.template_fields = normalizeTemplateFields(templateContext, reset.template_fields);
        await clearDraft(user.id);
        setForm(reset);
        setShiftMap({});
        setActiveStep(0);

        const refreshedShiftMap = await loadShiftMap(payload.date).catch(() => ({} as Record<string, number>));
        const completedToday = Object.keys(refreshedShiftMap).length;

        setSubmitConfirmation({
          shift: submittedShift,
          units: submittedUnits,
          entryId: created.id,
          completedToday: completedToday || 1,
        });

        const baseMessage =
          created.client_request_id === payload.client_request_id
            ? `Entry submitted successfully. Entry ID ${created.id}.`
            : `Entry synced successfully. Entry ID ${created.id}.`;

        setStatus(
          created.summary_job_id
            ? `${baseMessage} AI summary queued in the background.`
            : baseMessage,
        );
        signalWorkflowRefresh("entry-submit");
      } catch (err) {
        if (err instanceof ApiError) {
          const conflict = getEntryConflict(err);
          if (conflict) {
            setError(
              conflict.entryId
                ? `${conflict.message} Open entry #${conflict.entryId} for review.`
                : conflict.message,
            );
            setBusy(false);
            return;
          }
        }

        if (err instanceof ApiError && err.status >= 500) {
          await enqueueEntry(user.id, payload);
          setQueueCount(await countQueuedEntries(user.id));
          setStatus("Server issue detected. Entry was queued locally and will retry automatically.");
        } else if (err instanceof ApiError) {
          setError(err.message);
        } else {
          await enqueueEntry(user.id, payload);
          setQueueCount(await countQueuedEntries(user.id));
          setStatus("Network issue detected. Entry was queued locally and will retry automatically.");
        }
      } finally {
        setBusy(false);
      }
    },
    [buildPayload, loadShiftMap, online, templateContext, user],
  );

  const updateNumber =
    (field: NumericFieldKey, minValue = 0) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({
          ...prev,
          [field]: coerceIntegerInput(event.target.value, minValue),
        }));
      };

  const updateText =
    (field: TextFieldKey) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const value = event.target.value;
        setForm((prev) => ({
          ...prev,
          [field]: value,
        }));
      };

  const updateTemplateField =
    (fieldKey: string, inputType: TemplateInputType) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const nextValue =
          inputType === "boolean"
            ? (event.target as HTMLInputElement).checked
            : inputType === "number"
              ? event.target.value === ""
                ? null
                : Number(event.target.value)
              : event.target.value;
        setForm((prev) => ({
          ...prev,
          template_fields: {
            ...(prev.template_fields || {}),
            [fieldKey]: nextValue,
          },
        }));
      };

  const validateStep = useCallback(
    (step: StepIndex) => {
      if (!form.date) {
        return "Select the entry date first.";
      }

      if (step === 0) {
        if (!form.department?.trim()) {
          return "Choose the department before moving ahead.";
        }
        return "";
      }

      if (step === 1) {
        if (form.units_target < 1) {
          return "Units target must be at least 1.";
        }
        if (form.units_produced < 0) {
          return "Units produced cannot be negative.";
        }
        if (form.manpower_present < 0 || form.manpower_absent < 0) {
          return "Manpower values cannot be negative.";
        }
        if (form.manpower_present + form.manpower_absent < 1) {
          return "Add at least one worker count before moving ahead.";
        }
        return "";
      }

      if (step === 2) {
        if (form.quality_issues && !(form.quality_details || "").trim()) {
          return "Add a short note for the quality issue or turn the quality flag off.";
        }
        return "";
      }

      return validateTemplateDraft(form, templateContext);
    },
    [form, templateContext],
  );

  const goToStep = useCallback(
    (target: number) => {
      if (target <= activeStep) {
        setError("");
        setActiveStep(target as StepIndex);
        return;
      }

      const stepError = validateStep(activeStep);
      if (stepError) {
        setError(stepError);
        return;
      }

      setError("");
      setActiveStep(Math.min(target, STEP_DEFINITIONS.length - 1) as StepIndex);
    },
    [activeStep, validateStep],
  );

  const handleNext = useCallback(() => {
    goToStep(activeStep + 1);
  }, [activeStep, goToStep]);

  const handleBack = useCallback(() => {
    setError("");
    setActiveStep((prev) => Math.max(0, prev - 1) as StepIndex);
  }, []);

  const handleSubmit = useCallback(async () => {
    const stepError = validateStep(3);
    if (stepError) {
      setError(stepError);
      setActiveStep(3);
      return;
    }
    setError("");
    await submitPayload(form, shiftMap);
  }, [form, shiftMap, submitPayload, validateStep]);

  if (loading) {
    return <EntryPageSkeleton />;
  }

  const activeDefinition = STEP_DEFINITIONS[activeStep];
  const mobilePrimaryLabel =
    activeStep === STEP_DEFINITIONS.length - 1
      ? busy
        ? "Submitting..."
        : "Submit Entry"
      : "Next";

  return (
    <main className="min-h-screen bg-[var(--surface-app)] px-4 pb-28 pt-6 text-text-primary md:px-6 lg:pb-10 lg:pt-8">
      <SubmitConfirmationModal
        confirmation={submitConfirmation}
        onDismiss={() => setSubmitConfirmation(null)}
      />
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--status-info-border)] bg-[var(--status-info-bg)] px-4 py-1 text-xs font-medium text-[var(--status-info-fg)]">
              Shift entry
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl text-text-primary">Finish one shift before the next one starts piling up</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
              Move step by step, keep the live shift visible, and let drafts or offline sync protect the entry in the background.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-2 text-xs text-text-secondary">
              {factoryLabel}
            </span>
            <span
              className={`rounded-full border px-4 py-2 text-xs ${online
                ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-fg)]"
                : "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]"
                }`}
            >
              {online ? "Online" : "Offline"}
            </span>
          </div>
        </header>

        <details className="mt-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-shell)] p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-text-primary marker:hidden">
            Entry tools
          </summary>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-2 text-xs text-text-secondary">
              Queue {queueCount}
            </span>
            <Link href="/dashboard">
              <Button variant="outline" className="h-10 px-4 text-xs">
                Dashboard
              </Button>
            </Link>
          </div>
        </details>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-md)] md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-text-tertiary">
                  Step {activeStep + 1} of {STEP_DEFINITIONS.length}
                </div>
                <div className="mt-2 text-2xl font-semibold text-text-primary">{activeDefinition.title}</div>
                <GuidanceHint className="mt-2 text-sm text-text-secondary">
                  {showEntryTips ? activeDefinition.caption : null}
                </GuidanceHint>
              </div>
              <div className="w-full sm:w-auto sm:min-w-[180px]">
                <div className="flex items-center justify-between text-xs text-text-tertiary">
                  <span>Progress</span>
                  <span className="tabular-nums">{Math.round(progressPercent)}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[var(--surface-elevated)]">
                  <div
                    className="h-full rounded-full bg-[var(--action-primary)] transition-[width] duration-300 ease-out"
                    style={{ width: `${clampProgress(progressPercent)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {STEP_DEFINITIONS.map((step, index) => {
                const isActive = index === activeStep;
                const isUnlocked = index <= activeStep;
                return (
                  <button
                    key={step.title}
                    type="button"
                    onClick={() => goToStep(index)}
                    className={`rounded-lg border px-4 py-4 text-left ${isActive
                      ? "border-[var(--border-focus)] bg-[var(--workflow-active-bg)] shadow-[var(--shadow-sm)]"
                      : isUnlocked
                        ? "border-[var(--border-subtle)] bg-[var(--surface-shell)] hover:border-[var(--border-default)] hover:bg-[var(--surface-elevated)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-shell)] text-text-tertiary opacity-70"
                      }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-text-tertiary">Step {index + 1}</span>
                      {"optional" in step && step.optional ? (
                        <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] text-text-tertiary">
                          Optional
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 text-base font-semibold text-text-primary">{step.title}</div>
                    <GuidanceHint className="mt-2 text-sm leading-5 text-text-secondary">
                      {showEntryTips ? step.caption : null}
                    </GuidanceHint>
                  </button>
                );
              })}
            </div>

            {entryTips.visible ? (
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="px-3 py-2 text-xs"
                  onClick={() => entryTips.setExpanded(!entryTips.expanded)}
                >
                  {entryTips.expanded ? "Hide step tips" : "Show step tips"}
                </Button>
              </div>
            ) : null}

            <div className="mt-6 space-y-4">
              {status ? (
                <SuccessBanner message={status} onDismiss={() => setStatus("")} />
              ) : null}

              {error ? (
                <MutationErrorBanner
                  message={error}
                  onDismiss={() => setError("")}
                />
              ) : null}
            </div>

            <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-shell)] p-5 md:p-6">
              {activeStep === 0 ? (
                <div className="space-y-6">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-text-secondary">Date</label>
                      <Input aria-label="Date" type="date" value={form.date} onChange={updateText("date")} max={localDateValue()} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-text-secondary">Department</label>
                      <Select aria-label="Department" value={form.department || ""} onChange={updateText("department")}>
                        {departmentOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-text-secondary">Shift</label>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {SHIFT_OPTIONS.map((option) => {
                        const active = form.shift === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, shift: option.value }))}
                            className={`rounded-lg border px-4 py-4 text-left ${active
                              ? "border-[var(--border-focus)] bg-[var(--workflow-active-bg)]"
                              : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-[var(--border-default)]"
                              }`}
                          >
                            <div className="text-lg">{option.icon}</div>
                            <div className="mt-2 text-base font-semibold text-text-primary">{option.label}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-4 text-sm text-text-secondary">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span>Factory</span>
                      <span className="font-medium text-text-primary">{factoryLabel}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <span>Auto-fill source</span>
                      <span className="font-medium text-text-primary">{roleLabel(user?.role)}</span>
                    </div>
                  </div>

                  {submittedShifts.length ? (
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-4 text-sm text-text-secondary">
                      <div className="text-xs font-medium text-text-tertiary">Submitted on {form.date}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {submittedShifts.map(([shift, entryId]) => (
                          <span
                            key={shift}
                            className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-shell)] px-3 py-1 text-xs text-text-secondary"
                          >
                            {formatShiftLabel(shift as ShiftValue)} #{entryId}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {conflictId ? (
                    <div className="rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-4 text-sm text-[var(--status-danger-fg)]">
                      This shift already has an entry.{" "}
                      <Link href={`/entry/${conflictId}`} className="underline underline-offset-4">
                        Open entry #{conflictId}
                      </Link>
                      .
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeStep === 1 ? (
                <div className="space-y-6">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-text-secondary">Units target</label>
                      <Input aria-label="Units target" type="number" min={1} step={1} inputMode="numeric" className="h-14 text-2xl tabular-nums" value={form.units_target} onChange={updateNumber("units_target", 1)} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-text-secondary">Units produced</label>
                      <Input aria-label="Units produced" type="number" min={0} step={1} inputMode="numeric" className="h-14 text-2xl tabular-nums" value={form.units_produced} onChange={updateNumber("units_produced", 0)} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-text-secondary">Manpower present</label>
                      <Input aria-label="Manpower present" type="number" min={0} step={1} inputMode="numeric" className="h-14 text-2xl tabular-nums" value={form.manpower_present} onChange={updateNumber("manpower_present", 0)} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-text-secondary">Manpower absent</label>
                      <Input aria-label="Manpower absent" type="number" min={0} step={1} inputMode="numeric" className="h-14 text-2xl tabular-nums" value={form.manpower_absent} onChange={updateNumber("manpower_absent", 0)} />
                    </div>
                  </div>

                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-medium text-text-tertiary">Live performance</div>
                        <div className="mt-3 text-4xl font-semibold tabular-nums text-text-primary">{performance.toFixed(0)}%</div>
                        <div className="mt-2 text-sm text-text-secondary">
                          {form.units_produced} produced of {form.units_target} target
                        </div>
                      </div>
                      <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-shell)] px-4 py-2 text-sm text-text-secondary">
                        {performanceLabel}
                      </div>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-[var(--surface-shell)]">
                      <div
                        className="h-full rounded-full bg-[var(--action-primary)] transition-[width] duration-300 ease-out"
                        style={{ width: `${clampProgress(performance)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {activeStep === 2 ? (
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium text-text-secondary">Downtime (minutes)</label>
                    <Input aria-label="Downtime (minutes)" type="number" min={0} step={1} inputMode="numeric" className="h-14 text-xl tabular-nums" value={form.downtime_minutes} onChange={updateNumber("downtime_minutes", 0)} />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-text-secondary">Downtime reason</label>
                    <Input
                      value={form.downtime_reason || ""}
                      onChange={updateText("downtime_reason")}
                      placeholder="Optional reason"
                    />
                  </div>

                  <div>
                    <div className="text-sm font-medium text-text-secondary">Quality issue?</div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, quality_issues: false, quality_details: "" }))}
                        className={`rounded-lg border px-4 py-4 text-base font-semibold ${!form.quality_issues
                          ? "border-[var(--border-focus)] bg-[var(--workflow-active-bg)] text-text-primary"
                          : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-text-secondary hover:border-[var(--border-default)]"
                          }`}
                      >
                        No
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, quality_issues: true }))}
                        className={`rounded-lg border px-4 py-4 text-base font-semibold ${form.quality_issues
                          ? "border-[var(--border-focus)] bg-[var(--workflow-active-bg)] text-text-primary"
                          : "border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-text-secondary hover:border-[var(--border-default)]"
                          }`}
                      >
                        Yes
                      </button>
                    </div>
                  </div>

                  {form.quality_issues ? (
                    <div>
                      <label className="text-sm font-medium text-text-secondary">Quality notes</label>
                      <Textarea
                        rows={4}
                        value={form.quality_details || ""}
                        onChange={updateText("quality_details")}
                        placeholder="Add a short note about the quality issue"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeStep === 3 ? (
                <div className="space-y-6">
                  <div>
                    <div className="text-xs font-medium text-text-tertiary">Optional &mdash; for traceability</div>
                    <div className="mt-2 text-lg font-semibold text-text-primary">Advanced details</div>
                    <div className="mt-2 text-sm text-text-secondary">
                      Fill only what is available. These details are appended safely to the final entry.
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    {TRACEABILITY_FIELDS.map((field) => {
                      const value = form.template_fields?.[field.key];
                      return (
                        <div key={field.key}>
                          <label className="text-sm font-medium text-text-secondary">{field.label}</label>
                          <Input
                            type={field.inputType === "number" ? "number" : "text"}
                            min={field.inputType === "number" ? 0 : undefined}
                            value={
                              field.inputType === "number"
                                ? value == null
                                  ? ""
                                  : String(value)
                                : typeof value === "string"
                                  ? value
                                  : ""
                            }
                            onChange={updateTemplateField(field.key, field.inputType)}
                            placeholder={field.placeholder}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-text-secondary">Notes</label>
                    <Textarea
                      rows={4}
                      value={form.notes || ""}
                      onChange={updateText("notes")}
                      placeholder="Optional note for the supervisor or owner"
                    />
                  </div>

                  {templateContext ? (
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 py-4 text-sm text-text-secondary">
                      <div className="text-xs font-medium text-text-tertiary">Active workflow</div>
                      <div className="mt-2 text-base font-semibold text-text-primary">{templateContext.workflow_template_label}</div>
                      <div className="mt-2">{templateContext.template.description}</div>
                    </div>
                  ) : null}

                  {extraTemplateSections.length ? (
                    <div className="space-y-5">
                      {extraTemplateSections.map((section) => (
                        <div
                          key={section.key}
                          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-5"
                        >
                          <div className="text-base font-semibold text-text-primary">{section.label}</div>
                          <div className="mt-2 text-sm text-text-secondary">{section.description}</div>
                          <div className="mt-5 grid gap-4 sm:grid-cols-2">
                            {section.fields.map((field) => {
                              const inputType = field.input_type as TemplateInputType;
                              const value = form.template_fields?.[field.key];
                              const selectOptions = TEMPLATE_SELECT_OPTIONS[field.key] || [];
                              return (
                                <div
                                  key={field.key}
                                  className={field.input_type === "textarea" ? "sm:col-span-2" : undefined}
                                >
                                  <label className="text-sm font-medium text-text-secondary">
                                    {field.label}
                                    {field.required ? " *" : ""}
                                  </label>
                                  {inputType === "textarea" ? (
                                    <Textarea
                                      rows={3}
                                      value={typeof value === "string" ? value : ""}
                                      onChange={updateTemplateField(field.key, inputType)}
                                      placeholder={field.help_text}
                                    />
                                  ) : inputType === "select" ? (
                                    <Select
                                      aria-label={field.label}
                                      value={typeof value === "string" ? value : ""}
                                      onChange={updateTemplateField(field.key, inputType)}
                                    >
                                      <option value="">Select</option>
                                      {selectOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>
                                      ))}
                                    </Select>
                                  ) : inputType === "boolean" ? (
                                    <label className="mt-2 flex items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-shell)] px-4 py-3 text-sm text-text-secondary">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(value)}
                                        onChange={updateTemplateField(field.key, inputType)}
                                      />
                                      <span>{field.help_text || "Toggle field"}</span>
                                    </label>
                                  ) : (
                                    <Input
                                      type={inputType === "number" ? "number" : "text"}
                                      min={inputType === "number" ? 0 : undefined}
                                      value={
                                        inputType === "number"
                                          ? value == null
                                            ? ""
                                            : String(value)
                                          : typeof value === "string"
                                            ? value
                                            : ""
                                      }
                                      onChange={updateTemplateField(field.key, inputType)}
                                      placeholder={field.help_text}
                                    />
                                  )}
                                  {inputType !== "boolean" && field.help_text ? (
                                    <div className="mt-2 text-xs text-text-tertiary">{field.help_text}</div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="mt-6 hidden items-center justify-between gap-4 border-t border-[var(--border-subtle)] pt-6 lg:flex">
              <button
                type="button"
                onClick={handleBack}
                className={`text-sm font-medium ${activeStep === 0 ? "cursor-not-allowed text-text-tertiary" : "text-text-secondary hover:text-text-primary"
                  }`}
                disabled={activeStep === 0}
              >
                Back
              </button>

              <div className="flex items-center gap-3">
                {queueCount ? (
                  <Button variant="outline" className="h-12 px-5" onClick={handleSync} disabled={syncing}>
                    {syncing ? "Syncing..." : "Sync queue"}
                  </Button>
                ) : null}
                <Button
                  className="h-12 px-6 text-base"
                  onClick={activeStep === STEP_DEFINITIONS.length - 1 ? handleSubmit : handleNext}
                  disabled={busy || (activeStep === STEP_DEFINITIONS.length - 1 && Boolean(conflictId))}
                >
                  {activeStep === STEP_DEFINITIONS.length - 1
                    ? busy
                      ? "Submitting..."
                      : "Submit entry"
                    : "Next"}
                </Button>
              </div>
            </div>
          </section>

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-sm)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-medium text-text-tertiary">Live summary</div>
                    <div className="mt-3 text-4xl font-semibold tabular-nums text-text-primary">{performance.toFixed(0)}%</div>
                    <div className="mt-2 text-sm text-text-secondary">{performanceLabel}</div>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${online
                      ? "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-fg)]"
                      : "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]"
                      }`}
                  >
                    {online ? "Live" : "Offline"}
                  </span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-[var(--surface-elevated)]">
                  <div
                    className="h-full rounded-full bg-[var(--action-primary)] transition-[width] duration-300 ease-out"
                    style={{ width: `${clampProgress(performance)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-sm)]">
                <div className="text-xs font-medium text-text-tertiary">Workforce summary</div>
                <div className="mt-4 space-y-3 text-sm text-text-secondary">
                  <div className="flex items-center justify-between">
                    <span>Present</span>
                    <span className="font-semibold text-text-primary tabular-nums">{form.manpower_present}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Absent</span>
                    <span className="font-semibold text-text-primary tabular-nums">{form.manpower_absent}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total count</span>
                    <span className="font-semibold text-text-primary tabular-nums">{workforceTotal}</span>
                  </div>
                </div>
              </div>

              <details className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-sm)]" open={alerts.length > 0 || Boolean(conflictId)}>
                <summary className="cursor-pointer list-none text-xs font-medium text-text-tertiary marker:hidden">
                  Alerts
                </summary>
                {alerts.length ? (
                  <div className="mt-4 space-y-3">
                    {alerts.map((alert) => (
                      <div
                        key={alert}
                        className="rounded-md border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-3 text-sm text-[var(--status-warning-fg)]"
                      >
                        {alert}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-md border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-3 text-sm text-[var(--status-success-fg)]">
                    No alerts right now.
                  </div>
                )}
                {conflictId ? (
                  <div className="mt-4 text-sm text-text-secondary">
                    Existing shift entry:{" "}
                    <Link href={`/entry/${conflictId}`} className="text-[var(--text-link)] underline underline-offset-4 hover:text-[var(--text-link-hover)]">
                      Open #{conflictId}
                    </Link>
                  </div>
                ) : null}
              </details>

              <details className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-sm)]" open={activeStep === STEP_DEFINITIONS.length - 1}>
                <summary className="cursor-pointer list-none text-xs font-medium text-text-tertiary marker:hidden">
                  Production snapshot
                </summary>
                <div className="mt-4 space-y-3 text-sm text-text-secondary">
                  <div className="flex items-center justify-between">
                    <span>Date</span>
                    <span className="font-semibold text-text-primary tabular-nums">{form.date}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Shift</span>
                    <span className="font-semibold text-text-primary">{formatShiftLabel(form.shift)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Department</span>
                    <span className="font-semibold text-text-primary">{form.department || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Target</span>
                    <span className="font-semibold text-text-primary tabular-nums">{form.units_target}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Produced</span>
                    <span className="font-semibold text-text-primary tabular-nums">{form.units_produced}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Downtime</span>
                    <span className="font-semibold text-text-primary tabular-nums">{form.downtime_minutes} min</span>
                  </div>
                </div>

                {traceabilitySummary.length ? (
                  <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
                    <div className="text-xs font-medium text-text-tertiary">Traceability</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {traceabilitySummary.map((item) => (
                        <span
                          key={item.label}
                          className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1 text-xs text-text-secondary"
                        >
                          {item.label}: {item.value}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {submittedShifts.length ? (
                  <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
                    <div className="text-xs font-medium text-text-tertiary">Already submitted</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {submittedShifts.map(([shift, entryId]) => (
                        <span
                          key={shift}
                          className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1 text-xs text-text-secondary"
                        >
                          {formatShiftLabel(shift as ShiftValue)} #{entryId}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </details>

              <details className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-sm)]" open={queueCount > 0}>
                <summary className="cursor-pointer list-none text-xs font-medium text-text-tertiary marker:hidden">
                  Entry health
                </summary>
                <div className="mt-4 space-y-3 text-sm text-text-secondary">
                  <div className="flex items-center justify-between">
                    <span>Queue waiting</span>
                    <span className="font-semibold text-text-primary tabular-nums">{queueCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Draft save</span>
                    <span className="font-semibold text-text-primary">{draftReady ? "Active" : "Starting"}</span>
                  </div>
                </div>
                {queueCount ? (
                  <Button variant="outline" className="mt-4 h-11 w-full" onClick={handleSync} disabled={syncing}>
                    {syncing ? "Syncing..." : "Sync queue"}
                  </Button>
                ) : null}
              </details>
            </div>
          </aside>
        </div>
      </div>

      <div className="safe-bottom-inset fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-4 lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className={`w-20 shrink-0 text-sm font-medium ${activeStep === 0 ? "cursor-not-allowed text-text-tertiary" : "text-text-secondary hover:text-text-primary"
              }`}
            disabled={activeStep === 0}
          >
            Back
          </button>
          <Button
            className="h-14 flex-1 text-base"
            onClick={activeStep === STEP_DEFINITIONS.length - 1 ? handleSubmit : handleNext}
            disabled={busy || (activeStep === STEP_DEFINITIONS.length - 1 && Boolean(conflictId))}
          >
            {mobilePrimaryLabel}
          </Button>
        </div>
      </div>
    </main>
  );
}
