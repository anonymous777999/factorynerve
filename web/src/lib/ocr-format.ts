/**
 * Presentation formatters for OCR values.
 *
 * The backend structural analysis (backend/understanding/structure.py) tags
 * each column with a semantic type — label / amount / quantity / date / text.
 * These helpers turn a raw OCR string into something a factory owner would
 * expect to see on a real document: rupee amounts with thousands separators,
 * human dates, right-aligned numbers. Everything is best-effort and lossless —
 * if a value does not look like what its column claims, the original string is
 * shown untouched so we never hide or corrupt real data.
 */

import type { OcrColumnType } from "@/lib/ocr";

const AMOUNT_CLEAN_RE = /[^0-9.\-]/g;

/** Strip currency symbols / Dr-Cr suffixes and parse to a number, else null. */
export function parseAmountValue(raw: string): number | null {
  if (!raw) return null;
  const negativeParen = /^\s*\(.*\)\s*$/.test(raw.trim());
  const cleaned = raw.replace(AMOUNT_CLEAN_RE, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const num = Number.parseFloat(cleaned);
  if (Number.isNaN(num)) return null;
  return negativeParen ? -Math.abs(num) : num;
}

/** ₹1,25,000.00 — Indian grouping, two decimals. */
export function formatIndianCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** 12,500 or 12.5 — Indian grouping, no forced decimals. */
export function formatIndianNumber(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 3,
  }).format(value);
}

/** 14 Jul 2026 when parseable, else the original string. */
export function formatDisplayDate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  // Accept dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, and native Date parsing.
  const dmy = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  let date: Date | null = null;
  if (dmy) {
    let [, d, m, y] = dmy;
    if (y.length === 2) y = `20${y}`;
    date = new Date(Number(y), Number(m) - 1, Number(d));
  } else {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  if (!date || Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format a raw OCR value for display according to its column's semantic type.
 * Preserves any trailing qualifier the amount carried (e.g. "Dr", "Cr") so
 * ledger sign context is never lost.
 */
export function formatByColumnType(raw: string, type: OcrColumnType | undefined): string {
  const value = (raw ?? "").toString();
  if (!value.trim()) return "";
  switch (type) {
    case "amount": {
      const num = parseAmountValue(value);
      if (num === null) return value;
      const suffix = value.match(/\b(dr|cr)\b/i);
      const formatted = formatIndianCurrency(num);
      return suffix ? `${formatted} ${suffix[1].toUpperCase()}` : formatted;
    }
    case "quantity": {
      const num = parseAmountValue(value);
      return num === null ? value : formatIndianNumber(num);
    }
    case "date":
      return formatDisplayDate(value);
    default:
      return value;
  }
}

/** Amount/quantity columns read better right-aligned. */
export function alignForColumnType(type: OcrColumnType | undefined): "left" | "right" {
  return type === "amount" || type === "quantity" ? "right" : "left";
}
