import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type SteelItem } from "@/lib/steel";
import {
  formatOperationalNumber,
  getSeverityBadgeStatus,
  type SteelProductionRecordMetrics,
} from "@/lib/steel-production-record-metrics";
import type { SteelProductionRecordFormValues } from "@/lib/steel-production-record";

import { MetricTile } from "./metric-tile";
import { SummaryRow } from "./summary-row";

type ProductionRecordReviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  confirmBusy: boolean;
  values: SteelProductionRecordFormValues;
  inputItem: SteelItem | null;
  outputItem: SteelItem | null;
  metrics: SteelProductionRecordMetrics;
};

function resolveTone(metrics: SteelProductionRecordMetrics) {
  if (metrics.severity === "critical") {
    return "critical" as const;
  }
  if (metrics.severity === "watch") {
    return "watch" as const;
  }
  return "default" as const;
}

export function ProductionRecordReviewModal({
  open,
  onOpenChange,
  onConfirm,
  confirmBusy,
  values,
  inputItem,
  outputItem,
  metrics,
}: ProductionRecordReviewModalProps) {
  const tone = resolveTone(metrics);

  return (
    <ConfirmationModal
      open={open}
      onOpenChange={onOpenChange}
      title="Confirm production ledger commit"
      description="Review the material transformation, live operational math, and severity state before writing this batch to the ledger."
      status={getSeverityBadgeStatus(metrics.severity)}
      statusLabel={metrics.severityLabel}
      meta="Shortcut: Cmd/Ctrl+Enter confirms, and Esc returns to editing."
      primaryActionLabel="Confirm and record batch"
      secondaryActionLabel="Back to editing"
      onConfirm={onConfirm}
      confirmDisabled={confirmBusy}
      confirmBusy={confirmBusy}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="border-border-subtle bg-surface-shell shadow-none">
          <CardHeader className="px-md pt-md">
            <CardTitle className="text-lg">Transformation summary</CardTitle>
          </CardHeader>
          <CardContent className="px-md pb-md">
            <SummaryRow label="Batch code" value={values.batch_code || "Auto / not provided"} />
            <SummaryRow label="Production date" value={values.production_date || "--"} mono />
            <SummaryRow
              label="Input material"
              value={inputItem ? `${inputItem.item_code} - ${inputItem.name}` : "--"}
            />
            <SummaryRow
              label="Output material"
              value={outputItem ? `${outputItem.item_code} - ${outputItem.name}` : "--"}
            />
            <SummaryRow
              label="Input weight"
              value={`${formatOperationalNumber(Number(values.input_quantity_kg || 0))} KG`}
              mono
            />
            <SummaryRow
              label="Expected output"
              value={`${formatOperationalNumber(Number(values.expected_output_kg || 0))} KG`}
              mono
            />
            <SummaryRow
              label="Actual output"
              value={`${formatOperationalNumber(Number(values.actual_output_kg || 0))} KG`}
              mono
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border-subtle bg-surface-shell shadow-none">
            <CardHeader className="px-md pt-md">
              <CardTitle className="text-lg">Operational metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-md pb-md">
              <MetricTile
                label="Yield"
                value={`${formatOperationalNumber(metrics.yieldPercent)}%`}
                detail="Actual output divided by input."
                tone={tone}
              />
              <MetricTile
                label="Variance"
                value={`${formatOperationalNumber(metrics.varianceKg)} KG`}
                detail="Actual minus expected output."
                tone={tone}
              />
              <MetricTile
                label="Severity"
                value={metrics.severityLabel}
                detail={metrics.statusLabel}
                tone={tone}
              />
            </CardContent>
          </Card>

          <Card className="border-border-subtle bg-surface-shell shadow-none">
            <CardHeader className="px-md pt-md">
              <CardTitle className="text-lg">Review notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-md pb-md">
              {metrics.warnings.length ? (
                metrics.warnings.map((warning, index) => (
                  <div
                    key={`${warning}-modal-${index}`}
                    className="rounded-control border border-border-subtle bg-surface-panel px-sm py-sm text-label-dense text-text-secondary"
                  >
                    {warning}
                  </div>
                ))
              ) : (
                <div className="rounded-control border border-border-subtle bg-surface-panel px-sm py-sm text-label-dense text-text-secondary">
                  No current watch or critical warnings. This batch is within the normal operating band.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ConfirmationModal>
  );
}
