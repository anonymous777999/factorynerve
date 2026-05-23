import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type SteelItem } from "@/lib/steel";
import {
  formatOperationalNumber,
  getSeverityBadgeStatus,
  type SteelProductionRecordMetrics,
} from "@/lib/steel-production-record-metrics";

import { MetricTile } from "./metric-tile";

type ProductionRecordSidebarProps = {
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

export function ProductionRecordSidebar({
  inputItem,
  outputItem,
  metrics,
}: ProductionRecordSidebarProps) {
  const tone = resolveTone(metrics);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="px-md pt-md">
          <div className="flex items-center justify-between gap-sm">
            <CardTitle className="text-lg">Live metrics</CardTitle>
            <Badge status={getSeverityBadgeStatus(metrics.severity)}>{metrics.severityLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-md pb-md">
          <MetricTile
            label="Yield"
            value={`${formatOperationalNumber(metrics.yieldPercent)}%`}
            detail="Actual output divided by input weight."
            tone={tone}
          />
          <MetricTile
            label="Variance"
            value={`${formatOperationalNumber(metrics.varianceKg)} KG`}
            detail="Actual output minus expected output."
            tone={tone}
          />
          <MetricTile
            label="Variance %"
            value={`${formatOperationalNumber(metrics.variancePercent)}%`}
            detail="Output drift against the expected plan."
            tone={tone}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-md pt-md">
          <CardTitle className="text-lg">Operational review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-md pb-md">
          <div className="rounded-panel border border-border-subtle bg-surface-shell px-md py-sm">
            <div className="text-label-dense uppercase tracking-wide text-text-tertiary">
              Transformation
            </div>
            <div className="mt-xs text-body font-medium text-text-primary">
              {inputItem ? `${inputItem.item_code} -> ` : "Input -> "}
              {outputItem ? outputItem.item_code : "Output"}
            </div>
            <div className="mt-xs text-label-dense text-text-secondary">
              {inputItem?.name || "Select source material"} to{" "}
              {outputItem?.name || "select finished material"}
            </div>
          </div>

          <div className="rounded-panel border border-border-subtle bg-surface-shell px-md py-sm">
            <div className="text-label-dense uppercase tracking-wide text-text-tertiary">
              Severity state
            </div>
            <div className="mt-xs flex items-center gap-sm">
              <Badge status={getSeverityBadgeStatus(metrics.severity)}>{metrics.severityLabel}</Badge>
              <span className="text-label text-text-primary">{metrics.statusLabel}</span>
            </div>
          </div>

          <div className="space-y-2">
            {metrics.warnings.length ? (
              metrics.warnings.map((warning, index) => (
                <div
                  key={`${warning}-${index}`}
                  className="rounded-control border border-border-subtle bg-surface-panel px-sm py-sm text-label-dense text-text-secondary"
                >
                  {warning}
                </div>
              ))
            ) : (
              <div className="rounded-control border border-border-subtle bg-surface-panel px-sm py-sm text-label-dense text-text-secondary">
                No watch or critical signals are currently active.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
