"use client";

export type PwaSyncState = {
  queueCount: number | null;
  syncStatus: "idle" | "checking" | "empty" | "success" | "partial" | "error" | "offline";
  lastCheckedAt: string;
  lastSyncAt: string;
  lastSummary: string;
  lastError: string | null;
  lastOnlineAt: string;
  lastOfflineAt: string;
};

export const PWA_SYNC_STATE_STORAGE_KEY = "factorynerve:pwa-sync-state:v1";
export const PWA_SYNC_STATE_EVENT = "factorynerve:pwa-sync-state-updated";

const DEFAULT_STATE: PwaSyncState = {
  queueCount: null,
  syncStatus: "idle",
  lastCheckedAt: "",
  lastSyncAt: "",
  lastSummary: "",
  lastError: null,
  lastOnlineAt: "",
  lastOfflineAt: "",
};

function readStore() {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(PWA_SYNC_STATE_STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PwaSyncState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function loadPwaSyncState() {
  return readStore();
}

export function writePwaSyncState(next: PwaSyncState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PWA_SYNC_STATE_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(PWA_SYNC_STATE_EVENT));
}

export function patchPwaSyncState(patch: Partial<PwaSyncState>) {
  const current = readStore();
  writePwaSyncState({
    ...current,
    ...patch,
  });
}

export function subscribeToPwaSyncState(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const onCustom = () => listener();
  const onStorage = (event: StorageEvent) => {
    if (event.key === PWA_SYNC_STATE_STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(PWA_SYNC_STATE_EVENT, onCustom as EventListener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(PWA_SYNC_STATE_EVENT, onCustom as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}
