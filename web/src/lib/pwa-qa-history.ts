"use client";

export type PwaQaCheckpoint = {
  id: string;
  createdAt: string;
  appMode: "installed" | "browser";
  installState: string;
  device: string;
  browser: string;
  viewport: string;
  authStatus: string;
  routeCoverageCount: number;
  routeCoverageTotal: number;
  checklistCompleted: number;
  checklistTotal: number;
  pendingSync: string;
  score?: number | null;
  verdict?: string | null;
  summary: string;
};

export const PWA_QA_HISTORY_STORAGE_KEY = "factorynerve:pwa-qa-history:v1";
export const PWA_QA_HISTORY_EVENT = "factorynerve:pwa-qa-history-updated";

function readStore() {
  if (typeof window === "undefined") return [] as PwaQaCheckpoint[];
  try {
    const raw = window.localStorage.getItem(PWA_QA_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PwaQaCheckpoint[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(next: PwaQaCheckpoint[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PWA_QA_HISTORY_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(PWA_QA_HISTORY_EVENT));
}

export function loadPwaQaHistory() {
  return readStore();
}

export function savePwaQaCheckpoint(checkpoint: PwaQaCheckpoint) {
  const current = readStore();
  const next = [checkpoint, ...current].slice(0, 8);
  writeStore(next);
}

export function clearPwaQaHistory() {
  writeStore([]);
}

export function subscribeToPwaQaHistory(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const onCustom = () => listener();
  const onStorage = (event: StorageEvent) => {
    if (event.key === PWA_QA_HISTORY_STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(PWA_QA_HISTORY_EVENT, onCustom as EventListener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(PWA_QA_HISTORY_EVENT, onCustom as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}
