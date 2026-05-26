import { formatINR, formatIndianNumber } from "../../../../lib/utils";
import type { OCRConfidenceLevel } from "../../../../types/datatable";

export function formatCellCurrency(
  value: number | null,
  { currency = "INR", decimals = 0 }: { currency?: string; decimals?: number } = {}
) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  if (currency === "INR" && decimals === 0) {
    return formatINR(value);
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatCellNumber(value: number | null) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return formatIndianNumber(value);
}

export function formatCellTimestamp(
  value: Date | number | string | null,
  format: "datetime" | "date" | "time" | "relative" = "datetime"
) {
  if (value == null) {
    return { label: "—", meta: undefined as string | undefined };
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { label: "—", meta: undefined as string | undefined };
  }

  if (format === "relative") {
    const diffMs = date.getTime() - Date.now();
    const diffMinutes = Math.round(diffMs / 60000);
    const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

    if (Math.abs(diffMinutes) < 60) {
      return {
        label: formatter.format(diffMinutes, "minute"),
        meta: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date),
      };
    }

    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) {
      return {
        label: formatter.format(diffHours, "hour"),
        meta: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date),
      };
    }

    const diffDays = Math.round(diffHours / 24);
    return {
      label: formatter.format(diffDays, "day"),
      meta: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date),
    };
  }

  const formatters = {
    date: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }),
    datetime: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }),
    time: new Intl.DateTimeFormat("en-IN", { timeStyle: "short" }),
  } as const;

  return {
    label: formatters[format].format(date),
    meta: format === "time" ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date) : undefined,
  };
}

export function resolveOCRConfidenceLevel(confidence?: number | null): OCRConfidenceLevel {
  if (confidence == null || Number.isNaN(confidence)) {
    return "failed";
  }

  if (confidence >= 0.9) {
    return "high";
  }

  if (confidence >= 0.72) {
    return "medium";
  }

  return "low";
}

export function formatCellPercentage(value?: number | null) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return `${Math.round(value * 100)}%`;
}
