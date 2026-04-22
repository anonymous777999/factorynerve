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
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Me = CurrentUser;
type ShiftValue = EntryPayload["shift"];
type StepIndex = 0 | 1 | 2 | 3;
type NumericFieldKey =
  | "units_target"
  | "units_produced"
  | "manpower_present"
  | "manpower_absent"
  | "downtime_minutes";
type TextFieldKey =
  | "date"
  | "department"
  | "downtime_reason"
  | "materials_used"
  | "quality_details"
  | "notes";
type TemplateInputType = "text" | "number" | "boolean" | "textarea" | "select";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  supervisor: "Supervisor",
  operator: "Operator",
  attendance: "Attendance Worker",
  accountant: "Accountant",
};

const SHIFT_OPTIONS: Array<{ value: ShiftValue; label: string; icon: string }> = [
  { value: "morning", label: "Morning", icon: "🌅" },
  { value: "evening", label: "Evening", icon: "🌆" },
  { value: "night", label: "Night", icon: "🌙" },
];

const STEP_DEFINITIONS = [
  { title: "Basic Info", caption: "Date, shift, department" },
  { title: "Production", caption: "Target, output, manpower" },
  { title: "Issues", caption: "Downtime and quality flags", optional: true },
  { title: "Advanced", caption: "Traceability and submit", optional: true },
] as const;

const TRACEABILITY_FIELDS = [
  { key: "heat_number", label: "Heat No.", inputType: "text", placeholder: "Optional heat number" },
  { key: "lot_number", label: "Lot No.", inputType: "text", placeholder: "Optional lot number" },
  { key: "scrap_kg", label: "Scrap (kg)", inputType: "number", placeholder: "0" },
  {
    key: "certificate_reference",
    label: "Certificate Ref.",
    inputType: "text",
    placeholder: "Optional certificate reference",
  },
] as const;

const BUILT_IN_TEMPLATE_FIELDS = new Set([
  "date",
  "shift",
  "units_target",
  "units_produced",
  "manpower_present",
  "manpower_absent",
  "downtime_minutes",
  "downtime_reason",
  "department",
  "materials_used",
  "quality_issues",
  "quality_details",
  "notes",
  ...TRACEABILITY_FIELDS.map((field) => field.key),
]);

const TEMPLATE_SELECT_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  release_status: [
    { value: "released", label: "Released" },
    { value: "on_hold", label: "On Hold" },
    { value: "rejected", label: "Rejected" },
  ],
};

function localDateValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function defaultShiftValue(): ShiftValue {
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 6) return "night";
  if (hour >= 14) return "evening";
  return "morning";
}

function roleLabel(role?: string) {
  const key = (role || "").toLowerCase();
  return ROLE_LABELS[key] || (role ? role[0].toUpperCase() + role.slice(1) : "Operator");
}

function defaultTemplateFields(): TemplateFieldMap {
  return {
    heat_number: "",
    lot_number: "",
    scrap_kg: null,
    certificate_reference: "",
  };
}

function blankDraft(role?: string): EntryDraft {
  return {
    date: localDateValue(),
    shift: defaultShiftValue(),
    units_target: 1,
    units_produced: 1,
    manpower_present: 1,
    manpower_absent: 0,
    downtime_minutes: 0,
    downtime_reason: "",
    department: roleLabel(role),
    materials_used: "",
    quality_issues: false,
    quality_details: "",
    notes: "",
    template_fields: defaultTemplateFields(),
  };
}

function normalizeTemplateFields(
  templateContext: ActiveWorkflowTemplateContext | null,
  templateFields: TemplateFieldMap | null | undefined,
): TemplateFieldMap {
  const current = templateFields || {};
  const next: TemplateFieldMap = {
    ...defaultTemplateFields(),
  };

  TRACEABILITY_FIELDS.forEach((field) => {
    if (current[field.key] !== undefined) {
      next[field.key] = current[field.key];
    }
  });

  if (!templateContext?.template?.sections?.length) {
    return next;
  }

  templateContext.template.sections.forEach((section) => {
    section.fields.forEach((field) => {
      if (BUILT_IN_TEMPLATE_FIELDS.has(field.key)) {
        return;
      }
      if (current[field.key] !== undefined) {
        next[field.key] = current[field.key];
      }
    });
  });

  return next;
}

function hasTemplateFieldValue(value: string | number | boolean | null | undefined) {
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim().length > 0;
  return false;
}

function renderTemplateFieldValue(value: string | number | boolean | null | undefined) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value ?? "").trim();
}

function buildTemplateNotes(
  draft: EntryDraft,
  templateContext: ActiveWorkflowTemplateContext | null,
) {
  const extraLines: string[] = [];

  const traceabilityLines = TRACEABILITY_FIELDS.reduce<string[]>((lines, field) => {
    const value = draft.template_fields?.[field.key];
    if (hasTemplateFieldValue(value)) {
      lines.push(`${field.label}: ${renderTemplateFieldValue(value)}`);
    }
    return lines;
  }, []);

  if (traceabilityLines.length) {
    extraLines.push("[Traceability]", ...traceabilityLines);
  }

  if (templateContext?.template?.sections?.length) {
    const workflowLines: string[] = [];
    templateContext.template.sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (BUILT_IN_TEMPLATE_FIELDS.has(field.key)) {
          return;
        }
        const value = draft.template_fields?.[field.key];
        if (!hasTemplateFieldValue(value)) {
          return;
        }
        workflowLines.push(`${field.label}: ${renderTemplateFieldValue(value)}`);
      });
    });

    if (workflowLines.length) {
      extraLines.push(`[${templateContext.workflow_template_label}]`, ...workflowLines);
    }
  }

  const baseNotes = (draft.notes || "").trim();
  if (!extraLines.length) {
    return baseNotes;
  }

  return [baseNotes, ...extraLines].filter((item) => item && item.trim().length > 0).join("\n");
}

function validateTemplateDraft(
  draft: EntryDraft,
  templateContext: ActiveWorkflowTemplateContext | null,
) {
  if (templateContext?.template?.sections?.length) {
    for (const section of templateContext.template.sections) {
      for (const field of section.fields) {
        if (BUILT_IN_TEMPLATE_FIELDS.has(field.key) || !field.required) {
          continue;
        }
        const value = draft.template_fields?.[field.key];
        if (!hasTemplateFieldValue(value)) {
          return `${field.label} is required for the ${templateContext.workflow_template_label}.`;
        }
      }
    }
  }

  const composedNotes = buildTemplateNotes(draft, templateContext);
  if (composedNotes.length > 1000) {
    return "Notes and workflow details must stay within 1000 characters.";
  }

  return "";
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatShiftLabel(shift: ShiftValue) {
  return SHIFT_OPTIONS.find((option) => option.value === shift)?.label || shift;
}

export default function EntryPage() {
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
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [activeStep, setActiveStep] = useState<StepIndex>(0);
  const queryAppliedRef = useRef(false);

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
        const reset = blankDraft(user.role);
        reset.template_fields = normalizeTemplateFields(templateContext, reset.template_fields);
        await clearDraft(user.id);
        setForm(reset);
        setShiftMap({});
        setActiveStep(0);

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
    <main className="min-h-screen bg-[#0B0F19] px-4 pb-28 pt-6 text-white md:px-6 lg:pb-10 lg:pt-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-1 text-xs uppercase tracking-[0.22em] text-cyan-200">
              Shift entry
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">Finish one shift before the next one starts piling up</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Move step by step, keep the live shift visible, and let drafts or offline sync protect the entry in the background.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-200">
              {factoryLabel}
            </span>
            <span
              className={`rounded-full border px-4 py-2 text-xs ${
                online
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                  : "border-amber-400/20 bg-amber-400/10 text-amber-200"
              }`}
            >
              {online ? "Online" : "Offline"}
            </span>
          </div>
        </header>

        {/* AUDIT: BUTTON_CLUTTER - move route and queue utilities into a secondary tray so the active step stays primary. */}
        <details className="mt-5 rounded-[24px] border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-white marker:hidden">
            Entry tools
          </summary>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-[#0E1524]/80 px-4 py-2 text-xs text-slate-200">
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
          <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(21,28,44,0.92),rgba(11,15,25,0.98))] p-5 shadow-[0_24px_80px_rgba(6,10,18,0.48)] backdrop-blur md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-[0.22em] text-cyan-200">
                  Step {activeStep + 1}/{STEP_DEFINITIONS.length}
                </div>
                <div className="mt-2 text-2xl font-semibold">{activeDefinition.title}</div>
                <div className="mt-2 text-sm text-slate-300">{activeDefinition.caption}</div>
              </div>
              <div className="min-w-[180px]">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Progress</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#8b5cf6)] transition-all duration-300"
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
                    className={`rounded-[24px] border px-4 py-4 text-left transition ${
                      isActive
                        ? "border-cyan-300/40 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_16px_36px_rgba(10,18,34,0.32)]"
                        : isUnlocked
                          ? "border-white/10 bg-white/5 hover:border-cyan-300/25 hover:bg-white/8"
                          : "border-white/6 bg-white/[0.03] text-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Step {index + 1}</span>
                      {"optional" in step && step.optional ? (
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                          Optional
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 text-base font-semibold text-white">{step.title}</div>
                    <div className="mt-2 text-sm leading-5 text-slate-300">{step.caption}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 space-y-4">
              {status ? (
                <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                  {status}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="mt-6 rounded-[28px] border border-white/10 bg-[#0E1524]/90 p-5 md:p-6">
              {activeStep === 0 ? (
                <div className="space-y-6">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="text-sm text-slate-300">Date</label>
                      <Input type="date" value={form.date} onChange={updateText("date")} max={localDateValue()} />
                    </div>
                    <div>
                      <label className="text-sm text-slate-300">Department</label>
                      <Select value={form.department || ""} onChange={updateText("department")}>
                        {departmentOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">Shift</label>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {SHIFT_OPTIONS.map((option) => {
                        const active = form.shift === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, shift: option.value }))}
                            className={`rounded-[24px] border px-4 py-4 text-left transition ${
                              active
                                ? "border-cyan-300/40 bg-cyan-400/12 shadow-[0_0_0_1px_rgba(34,211,238,0.1)]"
                                : "border-white/10 bg-white/5 hover:border-cyan-300/25 hover:bg-white/8"
                            }`}
                          >
                            <div className="text-lg">{option.icon}</div>
                            <div className="mt-2 text-base font-semibold">{option.label}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span>Factory</span>
                      <span className="font-medium text-white">{factoryLabel}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <span>Auto-fill source</span>
                      <span className="font-medium text-white">{roleLabel(user?.role)}</span>
                    </div>
                  </div>

                  {submittedShifts.length ? (
                    <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Submitted On {form.date}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {submittedShifts.map(([shift, entryId]) => (
                          <span
                            key={shift}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200"
                          >
                            {formatShiftLabel(shift as ShiftValue)} #{entryId}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {conflictId ? (
                    <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 px-4 py-4 text-sm text-rose-100">
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
                      <label className="text-sm text-slate-300">Units Target</label>
                      <Input type="number" min={1} step={1} inputMode="numeric" value={form.units_target} onChange={updateNumber("units_target", 1)} />
                    </div>
                    <div>
                      <label className="text-sm text-slate-300">Units Produced</label>
                      <Input type="number" min={0} step={1} inputMode="numeric" value={form.units_produced} onChange={updateNumber("units_produced", 0)} />
                    </div>
                    <div>
                      <label className="text-sm text-slate-300">Manpower Present</label>
                      <Input type="number" min={0} step={1} inputMode="numeric" value={form.manpower_present} onChange={updateNumber("manpower_present", 0)} />
                    </div>
                    <div>
                      <label className="text-sm text-slate-300">Manpower Absent</label>
                      <Input type="number" min={0} step={1} inputMode="numeric" value={form.manpower_absent} onChange={updateNumber("manpower_absent", 0)} />
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(34,211,238,0.1),rgba(14,21,36,0.95))] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-cyan-200">Live Performance</div>
                        <div className="mt-3 text-4xl font-semibold">{performance.toFixed(0)}%</div>
                        <div className="mt-2 text-sm text-slate-300">
                          {form.units_produced} produced of {form.units_target} target
                        </div>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100">
                        {performanceLabel}
                      </div>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#8b5cf6)] transition-all duration-300"
                        style={{ width: `${clampProgress(performance)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {activeStep === 2 ? (
                <div className="space-y-6">
                  <div>
                    <label className="text-sm text-slate-300">Downtime (minutes)</label>
                    <Input type="number" min={0} step={1} inputMode="numeric" value={form.downtime_minutes} onChange={updateNumber("downtime_minutes", 0)} />
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">Downtime Reason</label>
                    <Input
                      value={form.downtime_reason || ""}
                      onChange={updateText("downtime_reason")}
                      placeholder="Optional reason"
                    />
                  </div>

                  <div>
                    <div className="text-sm text-slate-300">Quality Issue?</div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, quality_issues: false, quality_details: "" }))}
                        className={`rounded-[24px] border px-4 py-4 text-sm font-semibold transition ${
                          !form.quality_issues
                            ? "border-cyan-300/40 bg-cyan-400/12 text-white"
                            : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8"
                        }`}
                      >
                        OFF
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, quality_issues: true }))}
                        className={`rounded-[24px] border px-4 py-4 text-sm font-semibold transition ${
                          form.quality_issues
                            ? "border-cyan-300/40 bg-cyan-400/12 text-white"
                            : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8"
                        }`}
                      >
                        ON
                      </button>
                    </div>
                  </div>

                  {form.quality_issues ? (
                    <div>
                      <label className="text-sm text-slate-300">Quality Notes</label>
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
                    <div className="text-sm uppercase tracking-[0.18em] text-cyan-200">Optional - For Traceability</div>
                    <div className="mt-2 text-lg font-semibold">Advanced Details</div>
                    <div className="mt-2 text-sm text-slate-300">
                      Fill only what is available. These details are appended safely to the final entry.
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    {TRACEABILITY_FIELDS.map((field) => {
                      const value = form.template_fields?.[field.key];
                      return (
                        <div key={field.key}>
                          <label className="text-sm text-slate-300">{field.label}</label>
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
                    <label className="text-sm text-slate-300">Notes</label>
                    <Textarea
                      rows={4}
                      value={form.notes || ""}
                      onChange={updateText("notes")}
                      placeholder="Optional note for the supervisor or owner"
                    />
                  </div>

                  {templateContext ? (
                    <div className="rounded-[24px] border border-cyan-300/15 bg-white/5 px-4 py-4 text-sm text-slate-300">
                      <div className="text-xs uppercase tracking-[0.18em] text-cyan-200">Active Workflow</div>
                      <div className="mt-2 text-base font-semibold text-white">{templateContext.workflow_template_label}</div>
                      <div className="mt-2">{templateContext.template.description}</div>
                    </div>
                  ) : null}

                  {extraTemplateSections.length ? (
                    <div className="space-y-5">
                      {extraTemplateSections.map((section) => (
                        <div
                          key={section.key}
                          className="rounded-[24px] border border-white/10 bg-white/5 p-5"
                        >
                          <div className="text-base font-semibold text-white">{section.label}</div>
                          <div className="mt-2 text-sm text-slate-300">{section.description}</div>
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
                                  <label className="text-sm text-slate-300">
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
                                    <label className="mt-2 flex items-center gap-3 rounded-[20px] border border-white/10 bg-[#0E1524]/80 px-4 py-3 text-sm text-slate-200">
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
                                    <div className="mt-2 text-xs text-slate-400">{field.help_text}</div>
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

            <div className="mt-6 hidden items-center justify-between gap-4 border-t border-white/10 pt-6 lg:flex">
              <button
                type="button"
                onClick={handleBack}
                className={`text-sm font-medium transition ${
                  activeStep === 0 ? "cursor-not-allowed text-slate-500" : "text-slate-200 hover:text-white"
                }`}
                disabled={activeStep === 0}
              >
                Back
              </button>

              <div className="flex items-center gap-3">
                {queueCount ? (
                  <Button variant="outline" className="h-12 px-5" onClick={handleSync} disabled={syncing}>
                    {syncing ? "Syncing..." : "Sync Queue"}
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
                      : "Submit Entry"
                    : "Next"}
                </Button>
              </div>
            </div>
          </section>

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,25,40,0.94),rgba(11,15,25,0.98))] p-5 shadow-[0_20px_60px_rgba(6,10,18,0.38)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Live Summary</div>
                    <div className="mt-3 text-4xl font-semibold">{performance.toFixed(0)}%</div>
                    <div className="mt-2 text-sm text-slate-300">{performanceLabel}</div>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs ${
                      online
                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                        : "border-amber-400/20 bg-amber-400/10 text-amber-200"
                    }`}
                  >
                    {online ? "Live" : "Offline"}
                  </span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#8b5cf6)] transition-all duration-300"
                    style={{ width: `${clampProgress(performance)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Workforce Summary</div>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>Present</span>
                    <span className="font-semibold text-white">{form.manpower_present}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Absent</span>
                    <span className="font-semibold text-white">{form.manpower_absent}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Total Count</span>
                    <span className="font-semibold text-white">{workforceTotal}</span>
                  </div>
                </div>
              </div>

              {/* AUDIT: DENSITY_OVERLOAD - keep shift diagnostics available in secondary reveals so the form and live summary stay dominant. */}
              <details className="rounded-[28px] border border-white/10 bg-white/5 p-5" open={alerts.length > 0 || Boolean(conflictId)}>
                <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-[0.18em] text-slate-400 marker:hidden">
                  Alerts
                </summary>
                {alerts.length ? (
                  <div className="mt-4 space-y-3">
                    {alerts.map((alert) => (
                      <div
                        key={alert}
                        className="rounded-[20px] border border-amber-400/15 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
                      >
                        {alert}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[20px] border border-emerald-400/15 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                    No alerts right now.
                  </div>
                )}
                {conflictId ? (
                  <div className="mt-4 text-sm text-slate-300">
                    Existing shift entry:{" "}
                    <Link href={`/entry/${conflictId}`} className="text-cyan-200 underline underline-offset-4">
                      Open #{conflictId}
                    </Link>
                  </div>
                ) : null}
              </details>

              <details className="rounded-[28px] border border-white/10 bg-white/5 p-5" open={activeStep === STEP_DEFINITIONS.length - 1}>
                <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-[0.18em] text-slate-400 marker:hidden">
                  Production snapshot
                </summary>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>Date</span>
                    <span className="font-semibold text-white">{form.date}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Shift</span>
                    <span className="font-semibold text-white">{formatShiftLabel(form.shift)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Department</span>
                    <span className="font-semibold text-white">{form.department || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Target</span>
                    <span className="font-semibold text-white">{form.units_target}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Produced</span>
                    <span className="font-semibold text-white">{form.units_produced}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Downtime</span>
                    <span className="font-semibold text-white">{form.downtime_minutes} min</span>
                  </div>
                </div>

                {traceabilitySummary.length ? (
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Traceability</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {traceabilitySummary.map((item) => (
                        <span
                          key={item.label}
                          className="rounded-full border border-white/10 bg-[#0E1524]/80 px-3 py-1 text-xs text-slate-200"
                        >
                          {item.label}: {item.value}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {submittedShifts.length ? (
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Already Submitted</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {submittedShifts.map(([shift, entryId]) => (
                        <span
                          key={shift}
                          className="rounded-full border border-white/10 bg-[#0E1524]/80 px-3 py-1 text-xs text-slate-200"
                        >
                          {formatShiftLabel(shift as ShiftValue)} #{entryId}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </details>

              <details className="rounded-[28px] border border-white/10 bg-white/5 p-5" open={queueCount > 0}>
                <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-[0.18em] text-slate-400 marker:hidden">
                  Entry health
                </summary>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>Queue Waiting</span>
                    <span className="font-semibold text-white">{queueCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Draft Save</span>
                    <span className="font-semibold text-white">{draftReady ? "Active" : "Starting"}</span>
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

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#08101D]/95 px-4 py-4 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className={`min-w-[88px] text-sm font-medium transition ${
              activeStep === 0 ? "cursor-not-allowed text-slate-500" : "text-slate-200 hover:text-white"
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
