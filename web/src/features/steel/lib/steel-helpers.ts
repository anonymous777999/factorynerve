/**
 * features/steel/lib — shared formatting and tone helpers for the
 * steel module.
 *
 * Each steel page used to define its own `formatKg`, `formatDateTime`,
 * `todayValue`, and `badgeTone` copies. This module is the single
 * source of truth so a tweak (locale, units, status mapping) is one edit.
 */

// ---------------------------------------------------------------------------
// Number / date formatting
// ---------------------------------------------------------------------------

const KG_FORMATTER = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
});

export function formatKg(value: number | null | undefined): string {
    return KG_FORMATTER.format(value || 0);
}

export function formatPercent(value: number | null | undefined): string {
    return `${(value || 0).toFixed(2)}%`;
}

export function formatCurrency(value: number | null | undefined): string {
    return CURRENCY_FORMATTER.format(value || 0);
}

export function formatDateTime(value?: string | null): string {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function todayValue(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function addDays(dateValue: string, days: number): string {
    const parsed = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return dateValue;
    parsed.setDate(parsed.getDate() + days);
    return parsed.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Tone helpers — confidence/status → semantic-token utility classes
// ---------------------------------------------------------------------------

export function confidenceBadgeTone(value: string | null | undefined): string {
    if (value === "green" || value === "approved")
        return "border-status-success-border bg-status-success-bg text-status-success-fg";
    if (
        value === "yellow" ||
        value === "pending" ||
        value === "review" ||
        value === "watch"
    )
        return "border-status-warning-border bg-status-warning-bg text-status-warning-fg";
    return "border-status-danger-border bg-status-danger-bg text-status-danger-fg";
}

export function reconciliationStatusBadge(value: string): "success" | "warning" | "error" {
    if (value === "approved" || value === "green") return "success";
    if (value === "pending" || value === "yellow") return "warning";
    return "error";
}

export function deriveOperationalZone(category: string): string {
    const cat = category.toLowerCase();
    if (cat.includes("scrap")) return "Scrap Yard";
    if (cat.includes("ingot") || cat.includes("billet")) return "Melt Shop WIP";
    if (
        cat.includes("finished") ||
        cat.includes("tmt") ||
        cat.includes("round") ||
        cat.includes("section")
    )
        return "Dispatch Yard";
    return "Process Floor";
}

export function canReviewSteel(role?: string | null): boolean {
    return ["owner", "admin"].includes(role || "");
}
