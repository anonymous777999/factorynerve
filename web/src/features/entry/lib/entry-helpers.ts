/**
 * features/entry/lib — pure helper functions and constants for the
 * shift entry workspace.
 *
 * Extracted from app/entry/page.tsx so the workspace component stays
 * focused on rendering. Anything stateless and side-effect-free that
 * the workspace uses lives here.
 */

import type {
    ActiveWorkflowTemplateContext,
} from "@/lib/auth";
import type {
    EntryDraft,
    EntryPayload,
    TemplateFieldMap,
} from "@/lib/offline-entries";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShiftValue = EntryPayload["shift"];

export type StepIndex = 0 | 1 | 2 | 3;

export type NumericFieldKey =
    | "units_target"
    | "units_produced"
    | "manpower_present"
    | "manpower_absent"
    | "downtime_minutes";

export type TextFieldKey =
    | "date"
    | "department"
    | "downtime_reason"
    | "materials_used"
    | "quality_details"
    | "notes";

export type TemplateInputType = "text" | "number" | "boolean" | "textarea" | "select";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ROLE_LABELS: Record<string, string> = {
    owner: "Owner",
    admin: "Admin",
    manager: "Manager",
    supervisor: "Supervisor",
    operator: "Operator",
    attendance: "Attendance Worker",
    accountant: "Accountant",
};

export const SHIFT_OPTIONS: Array<{ value: ShiftValue; label: string; icon: string }> = [
    { value: "morning", label: "Morning", icon: "🌅" },
    { value: "evening", label: "Evening", icon: "🌆" },
    { value: "night", label: "Night", icon: "🌙" },
];

export const STEP_DEFINITIONS = [
    { title: "Basic Info", caption: "Date, shift, department" },
    { title: "Production", caption: "Target, output, manpower" },
    { title: "Issues", caption: "Downtime and quality flags", optional: true },
    { title: "Advanced", caption: "Traceability and submit", optional: true },
] as const;

export const TRACEABILITY_FIELDS = [
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

export const BUILT_IN_TEMPLATE_FIELDS = new Set([
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

export const TEMPLATE_SELECT_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
    release_status: [
        { value: "released", label: "Released" },
        { value: "on_hold", label: "On Hold" },
        { value: "rejected", label: "Rejected" },
    ],
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function localDateValue() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function defaultShiftValue(): ShiftValue {
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) return "night";
    if (hour >= 14) return "evening";
    return "morning";
}

export function roleLabel(role?: string) {
    const key = (role || "").toLowerCase();
    return ROLE_LABELS[key] || (role ? role[0].toUpperCase() + role.slice(1) : "Operator");
}

export function defaultTemplateFields(): TemplateFieldMap {
    return {
        heat_number: "",
        lot_number: "",
        scrap_kg: null,
        certificate_reference: "",
    };
}

export function blankDraft(role?: string): EntryDraft {
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

export function normalizeTemplateFields(
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

export function hasTemplateFieldValue(value: string | number | boolean | null | undefined) {
    if (typeof value === "boolean") return true;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value === "string") return value.trim().length > 0;
    return false;
}

export function renderTemplateFieldValue(value: string | number | boolean | null | undefined) {
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value ?? "").trim();
}

export function buildTemplateNotes(
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

export function validateTemplateDraft(
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

export function clampProgress(value: number) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
}

export function formatShiftLabel(shift: ShiftValue) {
    return SHIFT_OPTIONS.find((option) => option.value === shift)?.label || shift;
}
