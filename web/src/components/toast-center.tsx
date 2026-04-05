"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { APP_TOAST_EVENT, type AppToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const DEFAULT_DURATION_MS = 4200;

type ToastItem = Required<Pick<AppToast, "id" | "title">> & Omit<AppToast, "id" | "title">;

function toneClasses(tone: AppToast["tone"]) {
  if (tone === "success") {
    return "border-emerald-500/35 bg-[rgba(16,185,129,0.14)] text-emerald-50";
  }
  if (tone === "error") {
    return "border-red-500/35 bg-[rgba(239,68,68,0.14)] text-red-50";
  }
  return "border-[rgba(62,166,255,0.35)] bg-[rgba(62,166,255,0.12)] text-white";
}

export function ToastCenter() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AppToast>).detail;
      if (!detail?.title) return;
      const nextToast: ToastItem = {
        ...detail,
        id: detail.id || window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        title: detail.title,
      };
      setToasts((current) => [...current, nextToast].slice(-5));
      const duration = nextToast.durationMs ?? DEFAULT_DURATION_MS;
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== nextToast.id));
      }, duration);
    };

    window.addEventListener(APP_TOAST_EVENT, handler as EventListener);
    return () => window.removeEventListener(APP_TOAST_EVENT, handler as EventListener);
  }, []);

  const visibleToasts = useMemo(() => toasts, [toasts]);

  if (!visibleToasts.length) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 lg:right-6">
      {visibleToasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur",
            toneClasses(toast.tone),
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{toast.title}</div>
              {toast.description ? (
                <div className="mt-1 text-sm text-white/80">{toast.description}</div>
              ) : null}
            </div>
            <button
              type="button"
              className="text-xs uppercase tracking-[0.18em] text-white/70"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
            >
              Close
            </button>
          </div>
          {toast.actionHref && toast.actionLabel ? (
            <div className="mt-3">
              <Link href={toast.actionHref} className="text-sm font-medium text-white underline underline-offset-4">
                {toast.actionLabel}
              </Link>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
