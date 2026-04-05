"use client";

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const enableInDev = process.env.NEXT_PUBLIC_ENABLE_SW_DEV === "1";
    if (process.env.NODE_ENV !== "production" && !enableInDev) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
