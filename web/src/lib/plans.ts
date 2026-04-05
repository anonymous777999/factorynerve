import { API_BASE_URL, ApiError, apiFetch } from "@/lib/api";

export type PlanInfo = {
  id: string;
  name: string;
  subtitle?: string;
  monthly_price: number;
  display_price?: string;
  custom_price_hint?: string;
  sales_only?: boolean;
  badge?: string | null;
  user_limit: number;
  factory_limit: number;
  limits: {
    ocr: number;
    summary: number;
    email: number;
    smart: number;
  };
  unlimited_limits?: string[];
  features: Record<string, boolean>;
};

export type PricingMeta = {
  currency: string;
  yearly_multiplier: number;
  currency_symbol?: string;
};

export type AddonInfo = {
  id: string;
  name: string;
  price: number;
  description?: string;
  feature_key?: string;
  kind?: string;
  scan_quota?: number;
  quantity_allowed?: boolean;
  sort_order?: number;
  included_in?: string[];
};

export type PlansPayload = {
  pricing: PricingMeta;
  plans: PlanInfo[];
  addons: AddonInfo[];
};

export type LastPlanUpgrade = {
  timestamp?: string | null;
  details?: string | null;
  plan?: string | null;
};

function isPlansPayload(payload: unknown): payload is PlansPayload {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Partial<PlansPayload>;
  return (
    !!value.pricing &&
    typeof value.pricing === "object" &&
    Array.isArray(value.plans) &&
    Array.isArray(value.addons)
  );
}

function unwrapPlansPayload(payload: unknown): PlansPayload | null {
  if (isPlansPayload(payload)) return payload;
  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data?: unknown }).data;
    if (isPlansPayload(data)) return data;
  }
  return null;
}

async function fetchPlansDirect(): Promise<PlansPayload> {
  const response = await fetch(`${API_BASE_URL}/plans`, {
    credentials: "include",
    headers: {
      "X-Response-Envelope": "v1",
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  const normalized = unwrapPlansPayload(payload);
  if (response.ok && normalized) {
    return normalized;
  }

  const detail =
    payload && typeof payload === "object" && "detail" in payload
      ? String((payload as { detail?: unknown }).detail || "")
      : "";
  throw new Error(detail || `Could not load pricing catalog (${response.status}).`);
}

export async function getPlans() {
  try {
    const payload = await apiFetch<PlansPayload>("/plans", {}, { cacheTtlMs: 60_000 });
    const normalized = unwrapPlansPayload(payload);
    if (normalized) {
      return normalized;
    }
  } catch (error) {
    if (!(error instanceof ApiError) && !(error instanceof Error)) {
      throw error;
    }
  }

  return fetchPlansDirect();
}

export async function getLastPlanUpgrade() {
  return apiFetch<LastPlanUpgrade>("/settings/plan/last-upgrade", {}, { cacheTtlMs: 20_000 });
}
