"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { pushAppToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const ENABLE_SW_DEV = process.env.NEXT_PUBLIC_ENABLE_SW_DEV === "1";
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const BANNER_HIDDEN_ROUTES = ["/ocr/scan", "/offline"];
const SHELL_HIDDEN_ROUTES = new Set(["/", "/access", "/login", "/register", "/forgot-password", "/reset-password"]);

type RuntimeNavigator = Navigator & {
  deviceMemory?: number;
  hardwareConcurrency?: number;
};

function routeMatches(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isLowCapabilityRuntime() {
  if (typeof window === "undefined") return false;

  const nav = navigator as RuntimeNavigator;
  const deviceMemory = nav.deviceMemory ?? 8;
  const hardwareConcurrency = nav.hardwareConcurrency ?? 8;
  const coarsePointer =
    window.matchMedia("(pointer: coarse)").matches || (nav.maxTouchPoints ?? 0) > 0;
  const compactViewport = window.innerWidth < 768;
  const isAndroid = /android/i.test(nav.userAgent);

  return (
    deviceMemory <= 4 ||
    hardwareConcurrency <= 4 ||
    (isAndroid && coarsePointer && compactViewport && (deviceMemory <= 6 || hardwareConcurrency <= 6))
  );
}

function scheduleDeferredRegistration(task: () => void) {
  if (typeof window === "undefined") {
    task();
    return () => undefined;
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let idleId = 0;
  let detached = false;
  let loadHandler: (() => void) | null = null;

  const runTask = () => {
    if (detached) return;

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(task, { timeout: 2500 });
    } else {
      timeoutId = globalThis.setTimeout(task, 1200);
    }
  };

  if (document.readyState === "complete") {
    runTask();
  } else {
    loadHandler = () => {
      if (loadHandler) {
        window.removeEventListener("load", loadHandler);
        loadHandler = null;
      }
      runTask();
    };
    window.addEventListener("load", loadHandler, { once: true });
  }

  return () => {
    detached = true;
    if (loadHandler) {
      window.removeEventListener("load", loadHandler);
      loadHandler = null;
    }
    if (idleId && "cancelIdleCallback" in window) {
      window.cancelIdleCallback(idleId);
    }
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
    }
  };
}

export function ServiceWorker() {
  const pathname = usePathname();
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const notifiedWorkerRef = useRef<ServiceWorker | null>(null);
  const controllerChangedRef = useRef(false);
  const [waitingRegistration, setWaitingRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production" && !ENABLE_SW_DEV) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      return;
    }

    let mounted = true;
    const lowCapabilityRuntime = isLowCapabilityRuntime();
    let cancelDeferredRegistration: (() => void) | null = null;

    const announceWaitingWorker = (registration: ServiceWorkerRegistration, worker: ServiceWorker | null) => {
      if (!mounted || !worker) return;
      setWaitingRegistration(registration);
      setShowUpdateBanner(true);

      if (notifiedWorkerRef.current === worker) return;
      notifiedWorkerRef.current = worker;
      pushAppToast({
        title: "App update ready",
        description: "Refresh FactoryNerve to load the latest installed-app changes.",
        tone: "info",
        durationMs: 6500,
      });
    };

    const watchInstallingWorker = (registration: ServiceWorkerRegistration, worker: ServiceWorker | null) => {
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          announceWaitingWorker(registration, registration.waiting || worker);
        }
      });
    };

    const checkForUpdate = () => {
      registrationRef.current?.update().catch(() => undefined);
      if (registrationRef.current?.waiting) {
        announceWaitingWorker(registrationRef.current, registrationRef.current.waiting);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkForUpdate();
      }
    };

    const handleControllerChange = () => {
      if (controllerChangedRef.current) return;
      controllerChangedRef.current = true;
      window.location.reload();
    };

    const registerWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        if (!mounted) return;

        registrationRef.current = registration;

        if (registration.waiting) {
          announceWaitingWorker(registration, registration.waiting);
        }

        watchInstallingWorker(registration, registration.installing);
        registration.addEventListener("updatefound", () => {
          watchInstallingWorker(registration, registration.installing);
        });

        checkForUpdate();
      } catch {
        // Ignore registration errors and continue without PWA enhancement.
      }
    };

    if (lowCapabilityRuntime) {
      cancelDeferredRegistration = scheduleDeferredRegistration(() => {
        void registerWorker();
      });
    } else {
      void registerWorker();
    }

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    window.addEventListener("online", checkForUpdate);
    window.addEventListener("focus", checkForUpdate);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);

    return () => {
      mounted = false;
      cancelDeferredRegistration?.();
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      window.removeEventListener("online", checkForUpdate);
      window.removeEventListener("focus", checkForUpdate);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(interval);
    };
  }, []);

  const updateReady = Boolean(waitingRegistration?.waiting);
  const hiddenByRoute = BANNER_HIDDEN_ROUTES.some((route) => routeMatches(pathname, route));
  const bottomOffsetClass = SHELL_HIDDEN_ROUTES.has(pathname)
    ? "bottom-[max(1rem,calc(1rem+env(safe-area-inset-bottom)))]"
    : "bottom-[calc(7rem+env(safe-area-inset-bottom))] lg:bottom-6";

  const handleApplyUpdate = () => {
    if (!waitingRegistration?.waiting) return;
    pushAppToast({
      title: "Updating FactoryNerve",
      description: "The app is refreshing into the latest production build.",
      tone: "info",
      durationMs: 4000,
    });
    waitingRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
  };

  if (!updateReady || !showUpdateBanner || hiddenByRoute) return null;

  return (
    <div className={cn("safe-inline-pad pointer-events-none fixed inset-x-0 z-40", bottomOffsetClass)}>
      <div className="pointer-events-auto mx-auto w-full max-w-xl rounded-[1.7rem] border border-[rgba(77,163,255,0.22)] bg-[rgba(8,14,24,0.94)] p-4 shadow-[0_22px_60px_rgba(4,10,20,0.4)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex rounded-full border border-[rgba(77,163,255,0.22)] bg-[rgba(77,163,255,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(148,207,255,0.95)]">
              Update Ready
            </div>
            <div className="text-lg font-semibold text-white">Refresh into the latest FactoryNerve build.</div>
            <div className="text-sm leading-6 text-slate-300">
              A newer app version is ready with the latest fixes and mobile improvements.
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[11rem]">
            <Button type="button" className="h-11 w-full" onClick={handleApplyUpdate}>
              Refresh App
            </Button>
            <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setShowUpdateBanner(false)}>
              Later
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
