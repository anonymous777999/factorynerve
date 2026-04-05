export type AppToastTone = "success" | "error" | "info";

export type AppToast = {
  id?: string;
  title: string;
  description?: string;
  tone?: AppToastTone;
  durationMs?: number;
  actionLabel?: string;
  actionHref?: string;
};

export const APP_TOAST_EVENT = "dpr:toast";

export function pushAppToast(toast: AppToast) {
  if (typeof window === "undefined") return;
  const payload = {
    ...toast,
    id: toast.id || window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  };
  window.dispatchEvent(new CustomEvent(APP_TOAST_EVENT, { detail: payload }));
}
