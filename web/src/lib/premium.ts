import { ApiError, apiFetch } from "@/lib/api";

export type PremiumFilterOption = {
  id: string;
  label: string;
};

export type PremiumSummary = {
  total_units: number;
  total_target: number;
  average_performance: number;
  total_downtime: number;
  issues_count: number;
  active_factories: number;
  active_people: number;
};

export type PremiumSeriesPoint = {
  date: string;
  factory_id: string;
  factory_name: string;
  shift: string;
  units: number;
  target: number;
  performance: number;
  downtime: number;
  issues: number;
};

export type PremiumHeatmapCell = {
  day: string;
  label: string;
  hour: number;
  count: number;
  level: number;
};

export type PremiumAuditItem = {
  id: number;
  timestamp: string;
  action: string;
  details?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  factory_id?: string | null;
};

export type PremiumDashboardResponse = {
  plan: string;
  generated_at: string;
  enterprise_mode: boolean;
  filters: {
    factories: PremiumFilterOption[];
    shifts: PremiumFilterOption[];
  };
  summary: PremiumSummary;
  series: PremiumSeriesPoint[];
  heatmap: PremiumHeatmapCell[];
  audit_preview: PremiumAuditItem[];
  insights: string[];
};

export type PremiumAuditTrailResponse = {
  items: PremiumAuditItem[];
  total: number;
  limit: number;
};

function normalizeFilterOptions(value: unknown): PremiumFilterOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      const id = typeof raw.id === "string" ? raw.id : "";
      const label = typeof raw.label === "string" ? raw.label : id;
      if (!id) return null;
      return { id, label };
    })
    .filter((item): item is PremiumFilterOption => Boolean(item));
}

function normalizeAuditItem(value: unknown): PremiumAuditItem | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "number" ? raw.id : Number(raw.id || 0);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id,
    timestamp: typeof raw.timestamp === "string" ? raw.timestamp : "",
    action: typeof raw.action === "string" ? raw.action : "UNKNOWN",
    details: typeof raw.details === "string" ? raw.details : null,
    user_name: typeof raw.user_name === "string" ? raw.user_name : null,
    user_email: typeof raw.user_email === "string" ? raw.user_email : null,
    factory_id: typeof raw.factory_id === "string" ? raw.factory_id : null,
  };
}

function normalizeAuditItems(value: unknown): PremiumAuditItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeAuditItem)
    .filter((item): item is PremiumAuditItem => Boolean(item));
}

function normalizeSeries(value: unknown): PremiumSeriesPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      if (typeof raw.date !== "string") return null;
      return {
        date: raw.date,
        factory_id: typeof raw.factory_id === "string" ? raw.factory_id : "unknown",
        factory_name: typeof raw.factory_name === "string" ? raw.factory_name : "Unassigned Factory",
        shift: typeof raw.shift === "string" ? raw.shift : "",
        units: Number(raw.units || 0),
        target: Number(raw.target || 0),
        performance: Number(raw.performance || 0),
        downtime: Number(raw.downtime || 0),
        issues: Number(raw.issues || 0),
      };
    })
    .filter((item): item is PremiumSeriesPoint => Boolean(item));
}

function normalizeHeatmap(value: unknown): PremiumHeatmapCell[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      if (typeof raw.day !== "string") return null;
      return {
        day: raw.day,
        label: typeof raw.label === "string" ? raw.label : "",
        hour: Number(raw.hour || 0),
        count: Number(raw.count || 0),
        level: Number(raw.level || 0),
      };
    })
    .filter((item): item is PremiumHeatmapCell => Boolean(item));
}

function normalizeDashboard(payload: unknown): PremiumDashboardResponse {
  const raw = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const filters = raw.filters && typeof raw.filters === "object" ? (raw.filters as Record<string, unknown>) : {};
  const summaryRaw =
    raw.summary && typeof raw.summary === "object" ? (raw.summary as Record<string, unknown>) : {};

  return {
    plan: typeof raw.plan === "string" ? raw.plan : "premium",
    generated_at: typeof raw.generated_at === "string" ? raw.generated_at : "",
    enterprise_mode: Boolean(raw.enterprise_mode),
    filters: {
      factories: normalizeFilterOptions(filters.factories),
      shifts: normalizeFilterOptions(filters.shifts),
    },
    summary: {
      total_units: Number(summaryRaw.total_units || 0),
      total_target: Number(summaryRaw.total_target || 0),
      average_performance: Number(summaryRaw.average_performance || 0),
      total_downtime: Number(summaryRaw.total_downtime || 0),
      issues_count: Number(summaryRaw.issues_count || 0),
      active_factories: Number(summaryRaw.active_factories || 0),
      active_people: Number(summaryRaw.active_people || 0),
    },
    series: normalizeSeries(raw.series),
    heatmap: normalizeHeatmap(raw.heatmap),
    audit_preview: normalizeAuditItems(raw.audit_preview),
    insights: Array.isArray(raw.insights)
      ? raw.insights.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function normalizeAuditTrail(payload: unknown): PremiumAuditTrailResponse {
  if (Array.isArray(payload)) {
    const items = normalizeAuditItems(payload);
    return {
      items,
      total: items.length,
      limit: items.length,
    };
  }
  const raw = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const items = normalizeAuditItems(raw.items);
  return {
    items,
    total: Number(raw.total || items.length),
    limit: Number(raw.limit || items.length),
  };
}

function buildQuery(params: Record<string, string | number | undefined | null>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === "") return;
    query.set(key, String(value));
  });
  return query.toString();
}

export async function getPremiumDashboard(params: { days?: number } = {}) {
  const query = buildQuery({ days: params.days ?? 14 });
  const payload = await apiFetch<unknown>(`/premium/dashboard${query ? `?${query}` : ""}`);
  return normalizeDashboard(payload);
}

export async function getPremiumAuditTrail(params: {
  days?: number;
  limit?: number;
  factoryId?: string | null;
  action?: string | null;
} = {}) {
  const query = buildQuery({
    days: params.days ?? 14,
    limit: params.limit ?? 80,
    factory_id: params.factoryId ?? undefined,
    action: params.action ?? undefined,
  });
  const payload = await apiFetch<unknown>(`/premium/audit-trail?${query}`);
  return normalizeAuditTrail(payload);
}

export async function downloadPremiumExecutivePdf(params: {
  days?: number;
  factoryId?: string | null;
  shift?: string | null;
}) {
  const query = buildQuery({
    days: params.days ?? 14,
    factory_id: params.factoryId ?? undefined,
    shift: params.shift ?? undefined,
  });
  const response = await fetch(`/api/premium/executive-pdf?${query}`, {
    credentials: "include",
  });
  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = await response.json().catch(() => ({}));
      throw new ApiError(payload?.detail || "Could not export executive PDF.", response.status, payload?.detail);
    }
    throw new ApiError("Could not export executive PDF.", response.status);
  }
  return response.blob();
}
