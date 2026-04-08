"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { countQueuedEntries, subscribeToQueueUpdates } from "@/lib/offline-entries";
import { pushAppToast } from "@/lib/toast";
import { useNetworkStatus } from "@/lib/use-network-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PwaReadinessCardProps = {
  userId: number | null;
  canQueueEntries: boolean;
};

type PwaSnapshot = {
  standalone: boolean;
  serviceWorkerSupported: boolean;
  serviceWorkerRegistered: boolean;
  serviceWorkerControlling: boolean;
  updateReady: boolean;
  pendingSync: number;
  checkedAt: string;
};

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function formatCheckedAt(value: string | null) {
  if (!value) return "Not checked yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not checked yet";
  return parsed.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function ReadinessPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warn" | "danger";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-400/30 bg-emerald-400/12 text-emerald-100"
      : tone === "warn"
        ? "border-amber-400/30 bg-amber-400/12 text-amber-100"
        : tone === "danger"
          ? "border-red-400/30 bg-red-400/12 text-red-100"
          : "border-white/10 bg-[rgba(8,12,20,0.5)] text-white";

  return (
    <div className={`rounded-[1.35rem] border px-4 py-4 ${toneClass}`}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300/90">{label}</div>
      <div className="mt-2 text-sm font-semibold">{value}</div>
    </div>
  );
}

export function PwaReadinessCard({ userId, canQueueEntries }: PwaReadinessCardProps) {
  const { online, constrained, effectiveType } = useNetworkStatus();
  const [snapshot, setSnapshot] = useState<PwaSnapshot>({
    standalone: false,
    serviceWorkerSupported: false,
    serviceWorkerRegistered: false,
    serviceWorkerControlling: false,
    updateReady: false,
    pendingSync: 0,
    checkedAt: "",
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const readSnapshot = useCallback(async (options?: { announceUpdateCheck?: boolean }) => {
    const serviceWorkerSupported =
      typeof window !== "undefined" && "serviceWorker" in navigator;
    const registration = serviceWorkerSupported
      ? await navigator.serviceWorker.getRegistration().catch(() => null)
      : null;
    const pendingSync =
      canQueueEntries && userId != null ? await countQueuedEntries(userId).catch(() => 0) : 0;

    if (options?.announceUpdateCheck) {
      if (registration?.waiting) {
        pushAppToast({
          title: "App update ready",
          description: "Refresh FactoryNerve to load the latest installed-app build.",
          tone: "info",
          durationMs: 4200,
        });
      } else {
        pushAppToast({
          title: "App checked",
          description: "No newer installed-app update is waiting right now.",
          tone: "success",
          durationMs: 3600,
        });
      }
    }

    setSnapshot({
      standalone: isStandaloneMode(),
      serviceWorkerSupported,
      serviceWorkerRegistered: Boolean(registration),
      serviceWorkerControlling: Boolean(navigator.serviceWorker?.controller),
      updateReady: Boolean(registration?.waiting),
      pendingSync,
      checkedAt: new Date().toISOString(),
    });
    setLoading(false);
  }, [canQueueEntries, userId]);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      if (cancelled) return;
      await readSnapshot();
    };

    void refresh();

    const media = window.matchMedia?.("(display-mode: standalone)");
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };
    const onInstalled = () => {
      void refresh();
    };
    const onControllerChange = () => {
      void refresh();
    };
    const onDisplayModeChange = () => {
      void refresh();
    };

    window.addEventListener("appinstalled", onInstalled);
    document.addEventListener("visibilitychange", onVisibility);
    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);
    media?.addEventListener?.("change", onDisplayModeChange);

    const unsubscribeQueue = canQueueEntries ? subscribeToQueueUpdates(() => void refresh()) : () => undefined;

    return () => {
      cancelled = true;
      window.removeEventListener("appinstalled", onInstalled);
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
      media?.removeEventListener?.("change", onDisplayModeChange);
      unsubscribeQueue();
    };
  }, [canQueueEntries, readSnapshot]);

  const networkLabel = useMemo(() => {
    if (!online) return "Offline";
    if (constrained) {
      return effectiveType ? `Weak ${effectiveType}` : "Weak network";
    }
    return "Healthy";
  }, [constrained, effectiveType, online]);

  const networkTone = !online ? "danger" : constrained ? "warn" : "good";
  const installTone = snapshot.standalone ? "good" : "warn";
  const serviceWorkerTone = snapshot.serviceWorkerRegistered ? "good" : "warn";
  const syncTone =
    !canQueueEntries || snapshot.pendingSync === 0 ? "good" : online ? "warn" : "danger";

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await readSnapshot();
    } finally {
      setRefreshing(false);
    }
  };

  const handleCheckForUpdate = async () => {
    setRefreshing(true);
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration().catch(() => null);
        await registration?.update().catch(() => undefined);
      }
      await readSnapshot({ announceUpdateCheck: true });
    } finally {
      setRefreshing(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration().catch(() => null);
    if (!registration?.waiting) return;
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <Card className="rounded-[2rem] border-white/10 bg-[rgba(20,24,36,0.9)]">
      <CardHeader className="pb-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm text-slate-400">PWA</div>
            <CardTitle className="mt-2 text-2xl text-white">App readiness</CardTitle>
            <div className="mt-2 max-w-2xl text-sm text-slate-300">
              Quick check for install mode, service worker health, queued work, and network quality before device QA.
            </div>
          </div>
          <div className="grid gap-2 sm:min-w-[13rem]">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh Status"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-10 w-full"
              onClick={() => void handleCheckForUpdate()}
              disabled={refreshing || !snapshot.serviceWorkerSupported}
            >
              Check App Update
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ReadinessPill
            label="App Mode"
            value={snapshot.standalone ? "Installed app" : "Browser tab"}
            tone={installTone}
          />
          <ReadinessPill label="Network" value={networkLabel} tone={networkTone} />
          <ReadinessPill
            label="Service Worker"
            value={
              snapshot.serviceWorkerSupported
                ? snapshot.serviceWorkerRegistered
                  ? "Active"
                  : "Not registered"
                : "Unsupported"
            }
            tone={serviceWorkerTone}
          />
          <ReadinessPill
            label="Pending Sync"
            value={
              canQueueEntries
                ? snapshot.pendingSync
                  ? `${snapshot.pendingSync} queued`
                  : "Queue clear"
                : "Not used"
            }
            tone={syncTone}
          />
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-[rgba(8,12,20,0.5)] px-4 py-4">
          <div className="grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
            <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Update State</div>
              <div className="mt-2 font-semibold text-white">
                {snapshot.updateReady ? "New build ready to refresh" : "Latest build active"}
              </div>
              <div className="mt-2 text-slate-300">
                {snapshot.serviceWorkerControlling
                  ? "This tab is controlled by the installed app cache."
                  : "This tab will use app cache fully after the next controlled load."}
              </div>
            </div>
            <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">QA Hint</div>
              <div className="mt-2 font-semibold text-white">
                {snapshot.standalone
                  ? "Run route QA from the home-screen app."
                  : "Install the app before final mobile QA."}
              </div>
              <div className="mt-2 text-slate-300">
                Last checked at {formatCheckedAt(snapshot.checkedAt)}. Recheck after deploys, reconnects, and install steps.
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:flex sm:flex-wrap">
          {snapshot.updateReady ? (
            <Button type="button" className="w-full sm:w-auto" onClick={() => void handleApplyUpdate()}>
              Refresh App Now
            </Button>
          ) : null}
          {!snapshot.standalone ? (
            <div className="rounded-[1.1rem] border border-[rgba(77,163,255,0.22)] bg-[rgba(77,163,255,0.12)] px-4 py-3 text-sm text-[rgba(220,239,255,0.96)]">
              Open FactoryNerve from the home screen to verify standalone mode, auth persistence, and bottom safe-area behavior.
            </div>
          ) : null}
        </div>

        {loading ? <div className="text-sm text-slate-400">Loading app readiness...</div> : null}
      </CardContent>
    </Card>
  );
}
