import type { SteelOverview, SteelStockItem } from "@/lib/steel";

export type SteelStatusTone = "good" | "watch" | "critical";
export type SteelConfidenceLevel = "low" | "medium" | "high";
export type SteelPriorityKind = "stock_issue" | "anomaly_batch" | "dispatch_gap" | "watch_stock" | "none";

export type SteelQuickAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

export type SteelPrioritySummary = {
  kind: SteelPriorityKind;
  tone: SteelStatusTone;
  title: string;
  statusLabel: string;
  reason: string;
  nextStep: string;
  primaryAction: SteelQuickAction;
  secondaryAction?: SteelQuickAction;
};

export type SteelConfidenceSummary = {
  level: SteelConfidenceLevel;
  label: string;
  tone: Exclude<SteelStatusTone, "good"> | "good";
  reason: string;
  nextStep: string;
  action?: SteelQuickAction;
};

function formatKg(value: number | null | undefined) {
  return `${Math.round(Number(value || 0)).toLocaleString("en-IN")} KG`;
}

function statusFromOverview(overview: SteelOverview | null | undefined): SteelStatusTone {
  if (!overview) return "watch";
  if (Number(overview.confidence_counts.red || 0) > 0 || Number(overview.anomaly_summary.critical_batches || 0) > 0) {
    return "critical";
  }
  if (
    Number(overview.confidence_counts.yellow || 0) > 0 ||
    Number(overview.anomaly_summary.high_batches || 0) > 0 ||
    Number(overview.profit_summary?.outstanding_invoice_weight_kg || 0) > 0
  ) {
    return "watch";
  }
  return "good";
}

export function getOverallStatusLabel(tone: SteelStatusTone) {
  if (tone === "critical") return "Critical";
  if (tone === "watch") return "Watch";
  return "Good";
}

function findRedConfidenceItem(overview: SteelOverview | null | undefined) {
  if (!overview) return null;
  return (
    overview.low_confidence_items.find((item) => item.confidence_status === "red") ||
    null
  );
}

function findWatchConfidenceItem(overview: SteelOverview | null | undefined) {
  if (!overview) return null;
  return (
    overview.low_confidence_items.find((item) => item.confidence_status === "yellow") ||
    null
  );
}

function formatItemLabel(item: SteelStockItem) {
  return `${item.item_code} - ${item.name}`;
}

export function deriveSteelTopPriority(overview: SteelOverview | null | undefined): SteelPrioritySummary {
  const redItem = findRedConfidenceItem(overview);
  if (redItem) {
    return {
      kind: "stock_issue",
      tone: "critical",
      title: "Top Priority",
      statusLabel: "Critical stock confidence issue",
      reason: `${formatItemLabel(redItem)} is off by ${formatKg(redItem.last_variance_kg)} and needs a trusted count.`,
      nextStep: "Reconcile the item first so every downstream stock, batch, and sales decision uses reliable inventory.",
      primaryAction: { href: "/steel/reconciliations", label: "Open Reconciliations", variant: "primary" },
      secondaryAction: { href: "/steel?tab=inventory", label: "Inventory Lane", variant: "secondary" },
    };
  }

  const topAnomaly = overview?.ranked_anomalies[0];
  if (topAnomaly && (topAnomaly.batch.severity === "critical" || topAnomaly.batch.severity === "high")) {
    return {
      kind: "anomaly_batch",
      tone: topAnomaly.batch.severity === "critical" ? "critical" : "watch",
      title: "Top Priority",
      statusLabel: topAnomaly.batch.severity === "critical" ? "Critical loss signal" : "High loss signal",
      reason: `${topAnomaly.batch.batch_code} shows ${formatKg(topAnomaly.batch.variance_kg)} variance and ranks highest for leakage review.`,
      nextStep: "Trace the batch and review the risk lane before closing the next production or dispatch decision.",
      primaryAction: { href: "/steel?tab=risk", label: "Open Risk Lane", variant: "primary" },
      secondaryAction: { href: `/steel/batches/${topAnomaly.batch.id}`, label: "Batch Detail", variant: "secondary" },
    };
  }

  const outstandingWeightKg = Number(overview?.profit_summary?.outstanding_invoice_weight_kg || 0);
  if (outstandingWeightKg > 0) {
    return {
      kind: "dispatch_gap",
      tone: "watch",
      title: "Top Priority",
      statusLabel: "Dispatch closure gap",
      reason: `${formatKg(outstandingWeightKg)} is still sitting between invoice and dispatch proof.`,
      nextStep: "Close the invoice-dispatch gap so commercial exposure and realized movement stay aligned.",
      primaryAction: { href: "/steel/dispatches", label: "Open Dispatches", variant: "primary" },
      secondaryAction: { href: "/steel/invoices", label: "Open Invoices", variant: "secondary" },
    };
  }

  const watchItem = findWatchConfidenceItem(overview);
  if (watchItem) {
    return {
      kind: "watch_stock",
      tone: "watch",
      title: "Top Priority",
      statusLabel: "Watch-level stock drift",
      reason: `${formatItemLabel(watchItem)} is on watch with ${formatKg(watchItem.last_variance_kg)} drift.`,
      nextStep: "Review the inventory lane and tighten the next physical-to-system stock check before drift grows.",
      primaryAction: { href: "/steel?tab=inventory", label: "Open Inventory Lane", variant: "primary" },
      secondaryAction: { href: "/steel/reconciliations", label: "Stock Review", variant: "secondary" },
    };
  }

  return {
    kind: "none",
    tone: statusFromOverview(overview),
    title: "Top Priority",
    statusLabel: "No urgent blocker",
    reason: "The current steel signals do not show a critical stock, batch, or dispatch issue.",
    nextStep: "Use the summary strip to confirm health, then move into the lane that matters most for the next shift decision.",
    primaryAction: { href: "/steel", label: "Open Steel Hub", variant: "primary" },
    secondaryAction: { href: "/steel/charts", label: "Open Steel Charts", variant: "secondary" },
  };
}

export function deriveDataConfidence(params: {
  overview: SteelOverview | null | undefined;
  chartRecordCoverage: number;
  hasLiveDashboard: boolean;
}): SteelConfidenceSummary {
  const { overview, chartRecordCoverage, hasLiveDashboard } = params;
  if (!overview || !hasLiveDashboard || chartRecordCoverage <= 0) {
    return {
      level: "low",
      label: "Low",
      tone: "critical",
      reason: "Live steel data is incomplete, so this view may be relying on fallback or sparse records.",
      nextStep: "Refresh, confirm the active steel factory, and record or sync core stock, batch, invoice, and dispatch data.",
      action: { href: "/steel?tab=inventory", label: "Record First Data", variant: "primary" },
    };
  }

  if (Number(overview.confidence_counts.red || 0) > 0) {
    return {
      level: "medium",
      label: "Medium",
      tone: "watch",
      reason: "Live data is available, but red-confidence stock positions reduce operational trust.",
      nextStep: "Resolve critical stock mismatches before treating this board as fully reliable.",
      action: { href: "/steel/reconciliations", label: "Review Confidence", variant: "primary" },
    };
  }

  if (Number(overview.confidence_counts.yellow || 0) > 0 || chartRecordCoverage < 6) {
    return {
      level: "medium",
      label: "Medium",
      tone: "watch",
      reason: "The board is live, but watch-level confidence or sparse records mean some trends are still sharpening.",
      nextStep: "Add the next stock, batch, invoice, or dispatch updates to improve trend confidence.",
      action: { href: "/steel/charts", label: "Review Trend Coverage", variant: "primary" },
    };
  }

  return {
    level: "high",
    label: "High",
    tone: "good",
    reason: "The current steel board is using live data with no red-confidence stock blockers.",
    nextStep: "You can use these signals for fast shift and owner decisions with high trust.",
  };
}

export function deriveOverallStatusSummary(params: {
  overview: SteelOverview | null | undefined;
  chartRecordCoverage: number;
  hasLiveDashboard: boolean;
}) {
  const { overview, chartRecordCoverage, hasLiveDashboard } = params;
  const tone = statusFromOverview(overview);
  const confidence = deriveDataConfidence({ overview, chartRecordCoverage, hasLiveDashboard });

  return {
    tone,
    label: getOverallStatusLabel(tone),
    reason:
      tone === "critical"
        ? "Critical stock or anomaly signals need attention now."
        : tone === "watch"
          ? "The steel system is running, but there are signals worth reviewing."
          : "The active steel workflow looks stable across stock, batch, and dispatch signals.",
    nextStep:
      tone === "critical"
        ? "Resolve the top-priority issue before relying on downstream numbers."
        : tone === "watch"
          ? "Review the top priority and confirm the trend before moving deeper."
          : "Keep scanning KPIs and move directly to the next planned workflow action.",
    confidence,
  };
}

