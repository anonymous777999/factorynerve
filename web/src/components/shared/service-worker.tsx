"use client";

import { useEffect } from "react";

type ServiceWorkerProps = {
  buildVersion: string;
};

const BUILD_VERSION_STORAGE_KEY = "dpr:web:build-version";
const BUILD_RELOAD_MARKER_PREFIX = "dpr:web:build-reload:";
const BUILD_CHECK_INTERVAL_MS = 60_000;

function markAndReload(buildVersion: string) {
  if (typeof window === "undefined") {
    return;
  }

  const reloadMarkerKey = `${BUILD_RELOAD_MARKER_PREFIX}${buildVersion}`;
  try {
    if (window.sessionStorage.getItem(reloadMarkerKey)) {
      return;
    }
    window.sessionStorage.setItem(reloadMarkerKey, "1");
    window.localStorage.setItem(BUILD_VERSION_STORAGE_KEY, buildVersion);
  } catch {
    // Ignore storage failures and still try a best-effort refresh.
  }

  window.location.reload();
}

export function ServiceWorker({ buildVersion }: ServiceWorkerProps) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const previousBuildVersion = window.localStorage.getItem(BUILD_VERSION_STORAGE_KEY);
      window.localStorage.setItem(BUILD_VERSION_STORAGE_KEY, buildVersion);
      if (previousBuildVersion && previousBuildVersion !== buildVersion) {
        markAndReload(buildVersion);
        return;
      }
    } catch {
      // Ignore storage failures and continue without the fast version handoff.
    }

    const checkForNewBuild = async () => {
      try {
        const response = await fetch(`${window.location.pathname}${window.location.search}`, {
          method: "HEAD",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "x-dpr-build-check": "1",
          },
        });
        const latestBuildVersion = response.headers.get("x-dpr-build-version")?.trim();
        if (latestBuildVersion && latestBuildVersion !== buildVersion) {
          markAndReload(latestBuildVersion);
        }
      } catch {
        // Ignore transient network errors; the next poll or navigation can retry.
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkForNewBuild();
      }
    };

    const intervalId = window.setInterval(() => {
      void checkForNewBuild();
    }, BUILD_CHECK_INTERVAL_MS);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    void checkForNewBuild();

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [buildVersion]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const enableInDev = process.env.NEXT_PUBLIC_ENABLE_SW_DEV === "1";
    if (process.env.NODE_ENV !== "production" && !enableInDev) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      return;
    }
    const swUrl = `/sw.js?v=${encodeURIComponent(buildVersion)}`;
    navigator.serviceWorker
      .register(swUrl, { updateViaCache: "none" })
      .then((registration) => registration.update().catch(() => undefined))
      .catch(() => undefined);
  }, [buildVersion]);
  return null;
}
