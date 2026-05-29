import { Controller, type Control } from "react-hook-form";

import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Field, HelperText, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SteelProductionRecordFormValues } from "@/lib/steel-production-record";

function toValidationState(message?: string) {
  return message ? "invalid" : "default";
}

function normalizeBatchCode(value: string) {
  return value.trim().toUpperCase();
}

type ProductionRecordFormProps = {
  control: Control<SteelProductionRecordFormValues>;
  itemOptions: ComboboxOption[];
};

export function ProductionRecordForm({
  control,
  itemOptions,
}: ProductionRecordFormProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem]">
        <Controller
          control={control}
          name="batch_code"
          render={({ field, fieldState }) => (
            <Field>
              <Label
                htmlFor="steel-production-batch-code"
                validationState={toValidationState(fieldState.error?.message)}
                className="text-sm text-gray-400"
              >
                Batch Code
              </Label>
              <Input
                {...field}
                id="steel-production-batch-code"
                autoComplete="off"
                placeholder="e.g. BT-2026-001"
                validationState={toValidationState(fieldState.error?.message)}
                aria-invalid={fieldState.invalid}
                aria-describedby="steel-production-batch-code-help"
                className="mt-2 bg-[#0f1419] border-gray-700 text-white placeholder:text-gray-600"
                onChange={(event) => field.onChange(normalizeBatchCode(event.target.value))}
              />
              <HelperText
                id="steel-production-batch-code-help"
                validationState={toValidationState(fieldState.error?.message)}
                className="text-xs text-gray-500"
              >
                {fieldState.error?.message || "Optional operator-facing batch reference."}
              </HelperText>
            </Field>
          )}
        />

        <Controller
          control={control}
          name="production_date"
          render={({ field, fieldState }) => (
            <Field>
              <Label
                htmlFor="steel-production-date"
                required
                validationState={toValidationState(fieldState.error?.message)}
                className="text-sm text-gray-400"
              >
                Production Date*
              </Label>
              <Input
                {...field}
                id="steel-production-date"
                type="date"
                validationState={toValidationState(fieldState.error?.message)}
                aria-invalid={fieldState.invalid}
                aria-describedby="steel-production-date-help"
                className="mt-2 bg-[#0f1419] border-gray-700 text-white"
              />
              <HelperText
                id="steel-production-date-help"
                validationState={toValidationState(fieldState.error?.message)}
                className="text-xs text-gray-500"
              >
                {fieldState.error?.message ||
                  "Anchors the batch in the production ledger timeline."}
              </HelperText>
            </Field>
          )}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Controller
          control={control}
          name="input_item_id"
          render={({ field, fieldState }) => (
            <Field>
              <Label
                htmlFor="steel-production-input-item"
                required
                validationState={toValidationState(fieldState.error?.message)}
                className="text-sm text-gray-400"
              >
                Input Material*
              </Label>
              <Combobox
                {...field}
                id="steel-production-input-item"
                options={itemOptions}
                placeholder="Type material code or name"
                emptyMessage="No input material matches the current search."
                validationState={toValidationState(fieldState.error?.message)}
                aria-invalid={fieldState.invalid}
                aria-describedby="steel-production-input-item-help"
                className="mt-2 bg-[#0f1419] border-gray-700 text-white"
                onValueChange={field.onChange}
                onBlur={field.onBlur}
              />
              <HelperText
                id="steel-production-input-item-help"
                validationState={toValidationState(fieldState.error?.message)}
                className="text-xs text-gray-500"
              >
                {fieldState.error?.message ||
                  "Arrow keys move, Enter selects, and typing filters without leaving the keyboard flow."}
              </HelperText>
            </Field>
          )}
        />

        <Controller
          control={control}
          name="output_item_id"
          render={({ field, fieldState }) => (
            <Field>
              <Label
                htmlFor="steel-production-output-item"
                required
                validationState={toValidationState(fieldState.error?.message)}
                className="text-sm text-gray-400"
              >
                Output Material*
              </Label>
              <Combobox
                {...field}
                id="steel-production-output-item"
                options={itemOptions}
                placeholder="Type material code or name"
                emptyMessage="No output material matches the current search."
                validationState={toValidationState(fieldState.error?.message)}
                aria-invalid={fieldState.invalid}
                aria-describedby="steel-production-output-item-help"
                className="mt-2 bg-[#0f1419] border-gray-700 text-white"
                onValueChange={field.onChange}
                onBlur={field.onBlur}
              />
              <HelperText
                id="steel-production-output-item-help"
                validationState={toValidationState(fieldState.error?.message)}
                className="text-xs text-gray-500"
              >
                {fieldState.error?.message ||
                  "Input and output stay keyboard-selectable and cannot resolve to the same ledger item."}
              </HelperText>
            </Field>
          )}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Controller
          control={control}
          name="input_quantity_kg"
          render={({ field, fieldState }) => (
            <Field>
              <Label
                htmlFor="steel-production-input-quantity"
                required
                validationState={toValidationState(fieldState.error?.message)}
                className="text-sm text-gray-400"
              >
                Input Qty (KG)*
              </Label>
              <Input
                {...field}
                id="steel-production-input-quantity"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                validationState={toValidationState(fieldState.error?.message)}
                aria-invalid={fieldState.invalid}
                aria-describedby="steel-production-input-quantity-help"
                className="mt-2 font-mono bg-[#0f1419] border-gray-700 text-white placeholder:text-gray-600"
              />
              <HelperText
                id="steel-production-input-quantity-help"
                validationState={toValidationState(fieldState.error?.message)}
                className="text-xs text-gray-500"
              >
                {fieldState.error?.message || "Consumed source material in kilograms."}
              </HelperText>
            </Field>
          )}
        />

        <Controller
          control={control}
          name="expected_output_kg"
          render={({ field, fieldState }) => (
            <Field>
              <Label
                htmlFor="steel-production-expected-output"
                required
                validationState={toValidationState(fieldState.error?.message)}
                className="text-sm text-gray-400"
              >
                Expected Output (KG)*
              </Label>
              <Input
                {...field}
                id="steel-production-expected-output"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                validationState={toValidationState(fieldState.error?.message)}
                aria-invalid={fieldState.invalid}
                aria-describedby="steel-production-expected-output-help"
                className="mt-2 font-mono bg-[#0f1419] border-gray-700 text-white placeholder:text-gray-600"
              />
              <HelperText
                id="steel-production-expected-output-help"
                validationState={toValidationState(fieldState.error?.message)}
                className="text-xs text-gray-500"
              >
                {fieldState.error?.message || "Planned finished-goods output."}
              </HelperText>
            </Field>
          )}
        />

        <Controller
          control={control}
          name="actual_output_kg"
          render={({ field, fieldState }) => (
            <Field>
              <Label
                htmlFor="steel-production-actual-output"
                required
                validationState={toValidationState(fieldState.error?.message)}
                className="text-sm text-gray-400"
              >
                Actual Output (KG)*
              </Label>
              <Input
                {...field}
                id="steel-production-actual-output"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                validationState={toValidationState(fieldState.error?.message)}
                aria-invalid={fieldState.invalid}
                aria-describedby="steel-production-actual-output-help"
                className="mt-2 font-mono bg-[#0f1419] border-gray-700 text-white placeholder:text-gray-600"
              />
              <HelperText
                id="steel-production-actual-output-help"
                validationState={toValidationState(fieldState.error?.message)}
                className="text-xs text-gray-500"
              >
                {fieldState.error?.message || "Measured batch output."}
              </HelperText>
            </Field>
          )}
        />
      </div>

      <Controller
        control={control}
        name="notes"
        render={({ field, fieldState }) => (
          <Field>
            <Label
              htmlFor="steel-production-notes"
              validationState={toValidationState(fieldState.error?.message)}
              className="text-sm text-gray-400"
            >
              Notes
            </Label>
            <Textarea
              {...field}
              id="steel-production-notes"
              rows={3}
              placeholder="Heat notes, downtime, shift observations..."
              validationState={toValidationState(fieldState.error?.message)}
              aria-invalid={fieldState.invalid}
              aria-describedby="steel-production-notes-help"
              className="mt-2 bg-[#0f1419] border-gray-700 text-white placeholder:text-gray-600"
            />
            <HelperText
              id="steel-production-notes-help"
              validationState={toValidationState(fieldState.error?.message)}
              className="text-xs text-gray-500"
            >
              {fieldState.error?.message ||
                "Esc blurs the active field, and the verify modal only opens after validation passes."}
            </HelperText>
          </Field>
        )}
      />
    </div>
  );
}
