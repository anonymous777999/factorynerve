"use client";

import { API_BASE_URL } from "@/lib/api";
import { getCookie } from "@/lib/cookies";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type ProductAnalyticsEventName =
  | "report_trust_gate_evaluated"
  | "mobile_route_funnel_step"
  | "manager_session_guard_result";

type ProductAnalyticsPayload = {
  event_name: ProductAnalyticsEventName;
  properties: Record<string, JsonValue>;
};

type TrackOptions = {
  keepalive?: boolean;
  context?: {
    userId?: number | null;
    factoryId?: string | null;
  };
};

const CSRF_COOKIE = process.env.NEXT_PUBLIC_CSRF_COOKIE || "dpr_csrf";
const CSRF_HEADER = process.env.NEXT_PUBLIC_CSRF_HEADER || "X-CSRF-Token";
const QUEUE_STORAGE_KEY = "dpr:product-analytics:queue:v1";
const SESSION_STORAGE_KEY = "dpr:product-analytics:session:v1";
const APP_SESSION_STORAGE_KEY = "dpr:web:session:v1";
const MAX_QUEUE_SIZE = 100;

let lifecycleBound = false;
let inflightFlush: Promise<void> | null = null;

function readQueue(): ProductAnalyticsPayload[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is ProductAnalyticsPayload => {
      return Boolean(
        item &&
          typeof item === "object" &&
          "event_name" in item &&
          "properties" in item,
      );
    });
  } catch {
    return [];
  }
}

function writeQueue(queue: ProductAnalyticsPayload[]) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!queue.length) {
      window.localStorage.removeItem(QUEUE_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)));
  } catch {
    // Ignore storage failures and keep tracking silent.
  }
}

function enqueueEvents(events: ProductAnalyticsPayload[]) {
  writeQueue([...readQueue(), ...events].slice(-MAX_QUEUE_SIZE));
}

function getSessionId() {
  if (typeof window === "undefined") {
    return "server";
  }
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      return existing;
    }
    const next =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return `session-${Date.now()}`;
  }
}

function bindLifecycle() {
  if (typeof window === "undefined" || lifecycleBound) {
    return;
  }
  lifecycleBound = true;

  const flush = () => {
    void flushQueuedProductEvents().catch(() => undefined);
  };

  window.addEventListener("online", flush);
  window.addEventListener("pageshow", flush);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      flush();
    }
  });
}

function buildHeaders() {
  const headers = new Headers({
    "Content-Type": "application/json",
    "X-Response-Envelope": "v1",
  });
  const csrf = getCookie(CSRF_COOKIE);
  if (csrf) {
    headers.set(CSRF_HEADER, csrf);
  }
  return headers;
}

function readSessionContext() {
  if (typeof window === "undefined") {
    return {
      userId: null as number | null,
      factoryId: null as string | null,
    };
  }
  try {
    const raw = window.sessionStorage.getItem(APP_SESSION_STORAGE_KEY);
    if (!raw) {
      return { userId: null, factoryId: null };
    }
    const parsed = JSON.parse(raw) as {
      user?: { id?: number | null } | null;
      activeFactoryId?: string | null;
    } | null;
    return {
      userId: parsed?.user?.id ?? null,
      factoryId: parsed?.activeFactoryId ?? null,
    };
  } catch {
    return { userId: null, factoryId: null };
  }
}

function buildPayload(
  eventName: ProductAnalyticsEventName,
  properties: Record<string, JsonValue>,
  options?: TrackOptions,
): ProductAnalyticsPayload {
  const session = readSessionContext();
  const userId = options?.context?.userId ?? session.userId;
  const factoryId = options?.context?.factoryId ?? session.factoryId;
  return {
    event_name: eventName,
    properties: {
      ...properties,
      session_id: typeof properties.session_id === "string" ? properties.session_id : getSessionId(),
      client_timestamp: new Date().toISOString(),
      user_id: typeof properties.user_id === "number" ? properties.user_id : userId,
      factory_id: typeof properties.factory_id === "string" ? properties.factory_id : factoryId,
    },
  };
}

async function postEvents(events: ProductAnalyticsPayload[], keepalive = false) {
  const response = await fetch(`${API_BASE_URL}/analytics/events/batch`, {
    method: "POST",
    credentials: "include",
    keepalive,
    headers: buildHeaders(),
    body: JSON.stringify({ events }),
  });
  if (!response.ok) {
    throw new Error(`product analytics rejected (${response.status})`);
  }
}

export async function flushQueuedProductEvents() {
  if (typeof window === "undefined") {
    return;
  }
  if (inflightFlush) {
    return inflightFlush;
  }
  const queue = readQueue();
  if (!queue.length) {
    return;
  }

  inflightFlush = postEvents(queue)
    .then(() => {
      writeQueue([]);
    })
    .catch(() => undefined)
    .finally(() => {
      inflightFlush = null;
    });

  return inflightFlush;
}

export async function trackProductEvent(
  eventName: ProductAnalyticsEventName,
  properties: Record<string, JsonValue>,
  options?: TrackOptions,
) {
  bindLifecycle();
  const payload = buildPayload(eventName, properties, options);
  try {
    await postEvents([payload], options?.keepalive ?? false);
    void flushQueuedProductEvents();
  } catch {
    enqueueEvents([payload]);
    void flushQueuedProductEvents();
  }
}
