"use client";

export type PwaAuthCheckState = {
  status: "idle" | "checking" | "healthy" | "slow" | "error";
  readyOk: boolean | null;
  readyLatencyMs: number | null;
  sessionOk: boolean | null;
  sessionLatencyMs: number | null;
  checkedAt: string;
  summary: string;
  error: string | null;
};

export const PWA_AUTH_CHECK_STATE_STORAGE_KEY = "factorynerve:pwa-auth-check-state:v1";
export const PWA_AUTH_CHECK_STATE_EVENT = "factorynerve:pwa-auth-check-state-updated";

const DEFAULT_STATE: PwaAuthCheckState = {
  status: "idle",
  readyOk: null,
  readyLatencyMs: null,
  sessionOk: null,
  sessionLatencyMs: null,
  checkedAt: "",
  summary: "",
  error: null,
};

function readStore() {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(PWA_AUTH_CHECK_STATE_STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PwaAuthCheckState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function loadPwaAuthCheckState() {
  return readStore();
}

export function writePwaAuthCheckState(next: PwaAuthCheckState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PWA_AUTH_CHECK_STATE_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(PWA_AUTH_CHECK_STATE_EVENT));
}

export function subscribeToPwaAuthCheckState(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const onCustom = () => listener();
  const onStorage = (event: StorageEvent) => {
    if (event.key === PWA_AUTH_CHECK_STATE_STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(PWA_AUTH_CHECK_STATE_EVENT, onCustom as EventListener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(PWA_AUTH_CHECK_STATE_EVENT, onCustom as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}
