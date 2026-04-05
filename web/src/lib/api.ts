import { getCookie } from "@/lib/cookies";

const ENV_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
const SERVER_API_HOST = process.env.NEXT_PUBLIC_API_HOST || process.env.FASTAPI_HOST || "127.0.0.1";
const SERVER_API_PORT = process.env.NEXT_PUBLIC_API_PORT || process.env.FASTAPI_PORT || "8765";
const DEFAULT_API_BASE =
  typeof window !== "undefined"
    ? "/api"
    : `http://${SERVER_API_HOST}:${SERVER_API_PORT}`;

export const API_BASE_URL =
  typeof window !== "undefined"
    ? ENV_API_BASE && ENV_API_BASE.startsWith("/") ? ENV_API_BASE : "/api"
    : ENV_API_BASE || DEFAULT_API_BASE;

const CSRF_COOKIE =
  process.env.NEXT_PUBLIC_CSRF_COOKIE || "dpr_csrf";

const CSRF_HEADER =
  process.env.NEXT_PUBLIC_CSRF_HEADER || "X-CSRF-Token";

type ApiFetchOptions = {
  useCookies?: boolean;
  cookieAuth?: boolean;
  envelope?: boolean;
  timeoutMs?: number;
  cacheTtlMs?: number;
  cacheKey?: string;
};

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

type ApiRequestInit = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | null;
};

export class ApiError extends Error {
  status: number;
  detail?: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

type ApiDetailObject = {
  message?: unknown;
  error?: unknown;
  used?: unknown;
  limit?: unknown;
  reset_date?: unknown;
  upgrade_url?: unknown;
};

function buildDetailSuffix(detail: ApiDetailObject | null) {
  if (!detail) return "";
  const parts: string[] = [];
  const used = typeof detail.used === "number" ? detail.used : null;
  const limit = typeof detail.limit === "number" ? detail.limit : null;
  if (used != null && limit != null) {
    parts.push(`Used ${used}/${limit}.`);
  }
  if (typeof detail.reset_date === "string" && detail.reset_date.trim()) {
    parts.push(`Resets on ${detail.reset_date}.`);
  }
  if (typeof detail.upgrade_url === "string" && detail.upgrade_url.trim()) {
    parts.push(`Upgrade: ${detail.upgrade_url}.`);
  }
  return parts.length ? ` ${parts.join(" ")}` : "";
}

export function formatApiErrorMessage(error: unknown, fallback = "Request failed."): string {
  if (error instanceof ApiError) {
    const detailObj =
      error.detail && typeof error.detail === "object" ? (error.detail as ApiDetailObject) : null;
    if (typeof detailObj?.message === "string" && detailObj.message.trim()) {
      return `${detailObj.message}${buildDetailSuffix(detailObj)}`.trim();
    }
    if (typeof error.message === "string" && error.message.trim()) {
      return `${error.message}${buildDetailSuffix(detailObj)}`.trim();
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

type CacheEntry = {
  expiresAt: number;
  data?: unknown;
  promise?: Promise<unknown>;
};

const responseCache = new Map<string, CacheEntry>();

function canUseResponseCache() {
  return typeof window !== "undefined";
}

function buildCacheKey(
  path: string,
  method: string,
  useCookies: boolean,
  envelope: boolean,
  explicitKey?: string,
) {
  if (explicitKey) return explicitKey;
  return `${method}:${useCookies ? "cookie" : "anon"}:${envelope ? "env" : "raw"}:${path}`;
}

export function invalidateApiCache(match?: string | RegExp) {
  if (!responseCache.size) return;
  if (!match) {
    responseCache.clear();
    return;
  }
  for (const key of responseCache.keys()) {
    if (typeof match === "string" ? key.includes(match) : match.test(key)) {
      responseCache.delete(key);
    }
  }
}

export function primeApiCache<T>(
  path: string,
  value: T,
  apiOptions: ApiFetchOptions = {},
) {
  if (!canUseResponseCache()) return;
  const cacheKey = buildCacheKey(
    path,
    "GET",
    apiOptions.useCookies ?? true,
    apiOptions.envelope ?? true,
    apiOptions.cacheKey,
  );
  responseCache.set(cacheKey, {
    data: value,
    expiresAt: Date.now() + (apiOptions.cacheTtlMs ?? 15000),
  });
}

export function preloadApiGet<T>(path: string, apiOptions: ApiFetchOptions = {}) {
  return apiFetch<T>(path, { method: "GET" }, { ...apiOptions, cacheTtlMs: apiOptions.cacheTtlMs ?? 15000 });
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestInit = {},
  apiOptions: ApiFetchOptions = {},
): Promise<T> {
  const useCookies = apiOptions.useCookies ?? true;
  const cookieAuth = apiOptions.cookieAuth ?? false;
  const envelope = apiOptions.envelope ?? true;
  const timeoutMs = apiOptions.timeoutMs ?? 10000;
  const method = (options.method ?? "GET").toUpperCase();
  const cacheTtlMs = apiOptions.cacheTtlMs ?? 0;
  const useCache =
    canUseResponseCache() &&
    SAFE_METHODS.includes(method) &&
    cacheTtlMs > 0 &&
    !options.signal;
  const cacheKey = useCache
    ? buildCacheKey(path, method, useCookies, envelope, apiOptions.cacheKey)
    : null;

  if (cacheKey) {
    const cached = responseCache.get(cacheKey);
    if (cached?.data !== undefined && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
    if (cached?.promise) {
      return cached.promise as Promise<T>;
    }
  }

  const headers = new Headers(options.headers ?? {});
  if (
    !headers.has("Content-Type") &&
    options.body &&
    !(options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }
  if (cookieAuth) {
    headers.set("X-Use-Cookies", "1");
  }
  if (envelope) {
    headers.set("X-Response-Envelope", "v1");
  }

  if (useCookies && !SAFE_METHODS.includes(method) && !headers.has("Authorization")) {
    const csrf = getCookie(CSRF_COOKIE);
    if (csrf) {
      headers.set(CSRF_HEADER, csrf);
    }
  }

  const rawBody = options.body;
  const body =
    rawBody && typeof rawBody === "object" && !(rawBody instanceof FormData)
      ? JSON.stringify(rawBody)
      : rawBody;

  const performFetch = async () => {
    const controller = !options.signal && timeoutMs > 0 ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        method,
        headers,
        body: body as BodyInit | null | undefined,
        signal: options.signal ?? controller?.signal,
        credentials: useCookies ? "include" : options.credentials,
      });
    } catch (err) {
      if (controller?.signal.aborted) {
        throw new ApiError("Request timed out. Is the backend running?", 0);
      }
      throw err;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    const contentType = response.headers.get("content-type") || "";
    let payload: unknown = undefined;
    if (contentType.includes("application/json")) {
      payload = await response.json();
    } else {
      const raw = await response.text();
      const trimmed = raw.trim();
      if (trimmed) {
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          try {
            payload = JSON.parse(trimmed);
          } catch {
            payload = undefined;
          }
        }
      }
      if (payload === undefined) {
        if (!response.ok) {
          throw new ApiError(`Request failed (${response.status}).`, response.status, raw || undefined);
        }
        if (!SAFE_METHODS.includes(method) && canUseResponseCache()) {
          invalidateApiCache();
        }
        return undefined as T;
      }
    }

    if (envelope && payload && typeof payload === "object" && "ok" in payload) {
      const envelopePayload = payload as {
        ok: boolean;
        data?: unknown;
        status?: number;
        error?: { detail?: unknown } | null;
      };
      if (!envelopePayload.ok) {
        const detail = envelopePayload.error?.detail;
        const message =
          typeof detail === "string"
            ? detail
            : typeof detail === "object" && detail && "message" in detail
              ? String((detail as { message?: unknown }).message)
              : "Request failed.";
        throw new ApiError(message, envelopePayload.status ?? response.status, detail);
      }
      if (!SAFE_METHODS.includes(method) && canUseResponseCache()) {
        invalidateApiCache();
      }
      return envelopePayload.data as T;
    }

    if (!response.ok) {
      const objectPayload =
        payload && typeof payload === "object"
          ? (payload as { detail?: unknown })
          : null;
      const detail =
        objectPayload?.detail ?? "Request failed.";
      const message =
        typeof detail === "string"
          ? detail
          : typeof detail === "object" && detail && "message" in detail
            ? String((detail as { message?: unknown }).message)
            : "Request failed.";
      throw new ApiError(message, response.status, detail);
    }

    if (!SAFE_METHODS.includes(method) && canUseResponseCache()) {
      invalidateApiCache();
    }
    return payload as T;
  };

  if (!cacheKey) {
    return performFetch();
  }

  const promise = performFetch()
    .then((result) => {
      responseCache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + cacheTtlMs,
      });
      return result;
    })
    .catch((err) => {
      responseCache.delete(cacheKey);
      throw err;
    });

  responseCache.set(cacheKey, {
    expiresAt: Date.now() + cacheTtlMs,
    promise,
  });
  return promise;
}
