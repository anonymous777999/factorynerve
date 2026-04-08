"use client";

export type PwaInstallState = {
  installed: boolean;
  iosManualMode: boolean;
  promptAvailable: boolean;
  dismissed: boolean;
  mobileViewport: boolean;
  updatedAt: string;
};

export const PWA_INSTALL_STATE_STORAGE_KEY = "factorynerve:pwa-install-state:v1";
export const PWA_INSTALL_STATE_EVENT = "factorynerve:pwa-install-state-updated";

const DEFAULT_STATE: PwaInstallState = {
  installed: false,
  iosManualMode: false,
  promptAvailable: false,
  dismissed: false,
  mobileViewport: false,
  updatedAt: "",
};

function readStore() {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(PWA_INSTALL_STATE_STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PwaInstallState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function loadPwaInstallState() {
  return readStore();
}

export function writePwaInstallState(next: PwaInstallState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PWA_INSTALL_STATE_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(PWA_INSTALL_STATE_EVENT));
}

export function subscribeToPwaInstallState(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const onCustom = () => listener();
  const onStorage = (event: StorageEvent) => {
    if (event.key === PWA_INSTALL_STATE_STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(PWA_INSTALL_STATE_EVENT, onCustom as EventListener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(PWA_INSTALL_STATE_EVENT, onCustom as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}
