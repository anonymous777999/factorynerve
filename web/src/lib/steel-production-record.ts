import { z } from "zod";

export const STEEL_PRODUCTION_RECORD_DRAFT_VERSION = 1;

export const steelProductionRecordSchema = z
  .object({
    batch_code: z.string().trim().max(40, "Batch code must stay within 40 characters."),
    production_date: z.string().min(1, "Production date is required."),
    input_item_id: z.string().min(1, "Select the input material."),
    output_item_id: z.string().min(1, "Select the output material."),
    input_quantity_kg: z.string().min(1, "Enter the input quantity."),
    expected_output_kg: z.string().min(1, "Enter the expected output quantity."),
    actual_output_kg: z.string().min(1, "Enter the actual output quantity."),
    notes: z.string().max(500, "Notes must stay within 500 characters."),
  })
  .superRefine((values, context) => {
    const numericFields = [
      ["input_quantity_kg", values.input_quantity_kg],
      ["expected_output_kg", values.expected_output_kg],
      ["actual_output_kg", values.actual_output_kg],
    ] as const;

    for (const [field, value] of numericFields) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a quantity greater than zero.",
          path: [field],
        });
      }
    }

    if (values.input_item_id && values.output_item_id && values.input_item_id === values.output_item_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Input and output materials must be different.",
        path: ["output_item_id"],
      });
    }
  });

export type SteelProductionRecordFormValues = z.infer<typeof steelProductionRecordSchema>;

export type SteelProductionRecordDraft = {
  version: number;
  updatedAt: string;
  values: SteelProductionRecordFormValues;
};

type SteelProductionRecordDraftIdentity = {
  factoryId?: string | null;
  userId?: number | null;
};

export function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function createEmptySteelProductionRecordValues(): SteelProductionRecordFormValues {
  return {
    batch_code: "",
    production_date: todayValue(),
    input_item_id: "",
    output_item_id: "",
    input_quantity_kg: "",
    expected_output_kg: "",
    actual_output_kg: "",
    notes: "",
  };
}

export function getSteelProductionRecordDraftStorageKey(input: SteelProductionRecordDraftIdentity) {
  const factorySegment = input.factoryId || "unknown-factory";
  const userSegment = input.userId != null ? String(input.userId) : "anonymous";
  return `dpr:steel:production-record:draft:${factorySegment}:${userSegment}`;
}

export function parseSteelProductionRecordDraft(raw: string | null) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SteelProductionRecordDraft>;
    if (
      parsed.version !== STEEL_PRODUCTION_RECORD_DRAFT_VERSION ||
      !parsed.updatedAt ||
      !parsed.values
    ) {
      return null;
    }

    const normalized = steelProductionRecordSchema.safeParse(parsed.values);
    if (!normalized.success) {
      return null;
    }

    return {
      version: STEEL_PRODUCTION_RECORD_DRAFT_VERSION,
      updatedAt: parsed.updatedAt,
      values: normalized.data,
    } satisfies SteelProductionRecordDraft;
  } catch {
    return null;
  }
}

export function formatDraftTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function hasSteelProductionRecordDraftContent(values: SteelProductionRecordFormValues) {
  return Boolean(
    values.batch_code.trim() ||
      values.input_item_id ||
      values.output_item_id ||
      values.input_quantity_kg ||
      values.expected_output_kg ||
      values.actual_output_kg ||
      values.notes.trim(),
  );
}

export function buildSteelProductionRecordDraft(
  values: SteelProductionRecordFormValues,
): SteelProductionRecordDraft {
  return {
    version: STEEL_PRODUCTION_RECORD_DRAFT_VERSION,
    updatedAt: new Date().toISOString(),
    values,
  };
}

export async function loadSteelProductionRecordDraft(
  identity: SteelProductionRecordDraftIdentity,
): Promise<SteelProductionRecordDraft | null> {
  if (typeof window === "undefined") {
    return null;
  }

  return parseSteelProductionRecordDraft(
    window.localStorage.getItem(getSteelProductionRecordDraftStorageKey(identity)),
  );
}

export async function saveSteelProductionRecordDraft(
  identity: SteelProductionRecordDraftIdentity,
  draft: SteelProductionRecordDraft,
): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getSteelProductionRecordDraftStorageKey(identity),
    JSON.stringify(draft),
  );
}

export async function clearSteelProductionRecordDraftStorage(
  identity: SteelProductionRecordDraftIdentity,
): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getSteelProductionRecordDraftStorageKey(identity));
}
