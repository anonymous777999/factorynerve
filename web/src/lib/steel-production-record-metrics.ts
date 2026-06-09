export type SteelProductionRecordSeverity = "normal" | "watch" | "critical";

export type SteelProductionRecordMetricsInput = {
  inputItemId: string;
  outputItemId: string;
  inputQuantityKg: string;
  expectedOutputKg: string;
  actualOutputKg: string;
};

export type SteelProductionRecordMetrics = {
  yieldPercent: number | null;
  varianceKg: number | null;
  variancePercent: number | null;
  severity: SteelProductionRecordSeverity;
  severityLabel: "NORMAL" | "WATCH" | "CRITICAL";
  statusLabel: string;
  warnings: string[];
};

function parsePositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toSeverityLabel(severity: SteelProductionRecordSeverity) {
  switch (severity) {
    case "critical":
      return "CRITICAL";
    case "watch":
      return "WATCH";
    default:
      return "NORMAL";
  }
}

export function getSeverityBadgeStatus(severity: SteelProductionRecordSeverity) {
  switch (severity) {
    case "critical":
      return "error" as const;
    case "watch":
      return "warning" as const;
    default:
      return "synced" as const;
  }
}

export function formatOperationalNumber(value: number | null, fractionDigits = 2) {
  if (value == null) {
    return "--";
  }

  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function calculateSteelProductionRecordMetrics(
  input: SteelProductionRecordMetricsInput,
): SteelProductionRecordMetrics {
  const warnings: string[] = [];
  const inputQty = parsePositiveNumber(input.inputQuantityKg);
  const expectedQty = parsePositiveNumber(input.expectedOutputKg);
  const actualQty = parsePositiveNumber(input.actualOutputKg);

  if (input.inputItemId && input.outputItemId && input.inputItemId === input.outputItemId) {
    warnings.push("Input and output materials cannot be the same ledger item.");
  }

  const yieldPercent =
    inputQty != null && actualQty != null ? (actualQty / inputQty) * 100 : null;
  const varianceKg =
    expectedQty != null && actualQty != null ? actualQty - expectedQty : null;
  const variancePercent =
    expectedQty != null && expectedQty > 0 && varianceKg != null
      ? (varianceKg / expectedQty) * 100
      : null;

  const absoluteVariancePercent = Math.abs(variancePercent ?? 0);

  if (yieldPercent != null) {
    if (yieldPercent < 85 || yieldPercent > 105) {
      warnings.push("Yield is outside the normal production band.");
    }
    if (yieldPercent < 70 || yieldPercent > 115) {
      warnings.push("Yield is in a critical band and should be reviewed before posting.");
    }
  }

  if (variancePercent != null) {
    if (absoluteVariancePercent >= 2) {
      warnings.push("Expected and actual output are drifting beyond watch tolerance.");
    }
    if (absoluteVariancePercent >= 5) {
      warnings.push("Variance has crossed the critical tolerance band.");
    }
  }

  let severity: SteelProductionRecordSeverity = "normal";

  if (
    warnings.some((warning) =>
      warning.includes("cannot be the same") ||
      warning.includes("critical band") ||
      warning.includes("critical tolerance"),
    )
  ) {
    severity = "critical";
  } else if (warnings.length > 0) {
    severity = "watch";
  }

  return {
    yieldPercent,
    varianceKg,
    variancePercent,
    severity,
    severityLabel: toSeverityLabel(severity),
    statusLabel:
      severity === "critical"
        ? "Review before commit"
        : severity === "watch"
          ? "Watch closely"
          : "Within normal range",
    warnings,
  };
}
