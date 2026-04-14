import { API_BASE_URL, apiFetch } from "@/lib/api";
import { getCookie } from "@/lib/cookies";
import { getRoleDefaultFavoriteHrefs } from "@/lib/role-navigation";
import {
  NAV_FAVORITES_SOURCE_STORAGE_KEY,
  NAV_FAVORITES_STORAGE_KEY,
  UI_AUTONOMY_NAV_SYNC_EVENT,
  type FavoriteRouteSource,
} from "@/lib/ui-autonomy-constants";

const CSRF_COOKIE = process.env.NEXT_PUBLIC_CSRF_COOKIE || "dpr_csrf";
const CSRF_HEADER = process.env.NEXT_PUBLIC_CSRF_HEADER || "X-CSRF-Token";
const AUTO_FAVORITE_LIMIT = 5;

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type UiSignalPayload = {
  route?: string | null;
  signal_type: string;
  signal_key: string;
  severity?: "high" | "medium" | "low" | null;
  duration_ms?: number | null;
  value?: number | null;
  payload?: JsonValue | undefined;
};

export type UiPreference = {
  id: number;
  key: string;
  value: JsonValue;
  source: string;
  created_at: string;
  updated_at: string;
};

export type UiRecommendation = {
  id: number;
  route?: string | null;
  category: string;
  priority: string;
  title: string;
  summary: string;
  suggested_action?: string | null;
  evidence?: JsonValue;
  source: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type UiRouteSummary = {
  route: string;
  visits: number;
  interactions: number;
  issue_count: number;
  avg_duration_ms?: number | null;
  long_tasks: number;
};

export type UiAutonomyOverview = {
  status: string;
  window_days: number;
  summary: {
    window_days: number;
    total_signals: number;
    signal_breakdown: Record<string, number>;
    top_routes: UiRouteSummary[];
    slow_routes: UiRouteSummary[];
    drop_off_routes: UiRouteSummary[];
    open_recommendations: number;
    recent_signals: Array<Record<string, JsonValue>>;
  };
  preferences: UiPreference[];
  recommendations: UiRecommendation[];
  automation_contract: Record<string, JsonValue>;
};

export type UiRecommendationRunResult = {
  window_days: number;
  signals_considered: number;
  created: number;
  updated: number;
  reopened: number;
  resolved: number;
  preference_changed: boolean;
  recommendations: UiRecommendation[];
};

function readFavoriteRoutes(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(NAV_FAVORITES_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

function arrayEquals(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function dedupeRoutes(routes: string[]) {
  return routes.filter((route, index, all) => route && all.indexOf(route) === index);
}

export async function recordUiSignal(
  payload: UiSignalPayload,
  options?: {
    keepalive?: boolean;
  },
) {
  const headers = new Headers({
    "Content-Type": "application/json",
    "X-Response-Envelope": "v1",
  });
  const csrf = getCookie(CSRF_COOKIE);
  if (csrf) {
    headers.set(CSRF_HEADER, csrf);
  }
  await fetch(`${API_BASE_URL}/autonomy/signals`, {
    method: "POST",
    credentials: "include",
    keepalive: options?.keepalive ?? false,
    headers,
    body: JSON.stringify(payload),
  });
}

export function safeRecordUiSignal(
  payload: UiSignalPayload,
  options?: {
    keepalive?: boolean;
  },
) {
  void recordUiSignal(payload, options).catch(() => undefined);
}

export async function getUiAutonomyOverview() {
  return apiFetch<UiAutonomyOverview>("/autonomy/overview", {}, { cacheTtlMs: 15_000 });
}

export async function listUiPreferences() {
  return apiFetch<UiPreference[]>("/autonomy/preferences", {}, { cacheTtlMs: 10_000 });
}

export async function updateUiPreference(key: string, value: JsonValue, source = "manual") {
  return apiFetch<UiPreference>(`/autonomy/preferences/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: { value, source },
  });
}

export async function listUiRecommendations() {
  return apiFetch<UiRecommendation[]>("/autonomy/recommendations", {}, { cacheTtlMs: 10_000 });
}

export async function runUiRecommendationCycle() {
  return apiFetch<UiRecommendationRunResult>("/autonomy/recommendations/run", {
    method: "POST",
  });
}

export async function updateUiRecommendationStatus(id: number, status: string) {
  return apiFetch<UiRecommendation>(`/autonomy/recommendations/${id}/status`, {
    method: "PUT",
    body: { status },
  });
}

export function applyAutonomyFavoriteRoutes(routes: string[], role?: string | null) {
  if (typeof window === "undefined") {
    return false;
  }

  const cleanedRoutes = dedupeRoutes(routes).slice(0, AUTO_FAVORITE_LIMIT);
  if (cleanedRoutes.length === 0) {
    return false;
  }

  const currentRoutes = readFavoriteRoutes();
  const defaultRoutes = dedupeRoutes(getRoleDefaultFavoriteHrefs(role || null));
  const currentSource = (window.localStorage.getItem(
    NAV_FAVORITES_SOURCE_STORAGE_KEY,
  ) || "") as FavoriteRouteSource | "";

  if (currentSource === "manual") {
    return false;
  }

  if (!currentSource && currentRoutes.length > 0 && !arrayEquals(currentRoutes, defaultRoutes.slice(0, currentRoutes.length))) {
    return false;
  }

  const nextRoutes = dedupeRoutes([...cleanedRoutes, ...defaultRoutes]).slice(0, AUTO_FAVORITE_LIMIT);
  if (arrayEquals(currentRoutes, nextRoutes) && currentSource === "autonomy") {
    return false;
  }

  window.localStorage.setItem(NAV_FAVORITES_STORAGE_KEY, JSON.stringify(nextRoutes));
  window.localStorage.setItem(NAV_FAVORITES_SOURCE_STORAGE_KEY, "autonomy");
  window.dispatchEvent(new Event(UI_AUTONOMY_NAV_SYNC_EVENT));
  return true;
}
