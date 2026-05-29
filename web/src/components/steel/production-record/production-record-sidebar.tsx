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
      <Card className="bg-[#1a1f2e] border-gray-800">
        <CardHeader className="px-6 pt-6">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg text-white">Live metrics</CardTitle>
            <Badge status={getSeverityBadgeStatus(metrics.severity)}>{metrics.severityLabel}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-6 pb-6">
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

      <Card className="bg-[#1a1f2e] border-gray-800">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="text-lg text-white">Operational review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-6 pb-6">
          <div className="rounded-lg border border-gray-700 bg-[#0f1419] px-4 py-3">
            <div className="text-xs uppercase tracking-wider text-gray-500">
              Transformation
            </div>
            <div className="mt-2 text-sm font-medium text-white">
              {inputItem ? `${inputItem.item_code} -> ` : "Input -> "}
              {outputItem ? outputItem.item_code : "Output"}
            </div>
            <div className="mt-1 text-xs text-gray-400">
              {inputItem?.name || "Select source material"} to{" "}
              {outputItem?.name || "select finished material"}
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-[#0f1419] px-4 py-3">
            <div className="text-xs uppercase tracking-wider text-gray-500">
              Severity state
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge status={getSeverityBadgeStatus(metrics.severity)}>{metrics.severityLabel}</Badge>
              <span className="text-sm text-white">{metrics.statusLabel}</span>
            </div>
          </div>

          <div className="space-y-2">
            {metrics.warnings.length ? (
              metrics.warnings.map((warning, index) => (
                <div
                  key={`${warning}-${index}`}
                  className="rounded-lg border border-gray-700 bg-[#0f1419] px-3 py-2 text-xs text-gray-400"
                >
                  {warning}
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-gray-700 bg-[#0f1419] px-3 py-2 text-xs text-gray-400">
                No watch or critical signals are currently active.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
