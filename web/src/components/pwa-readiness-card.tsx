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

type ChecklistKey =
  | "browser_install"
  | "standalone_launch"
  | "login"
  | "google_login"
  | "attendance"
  | "entry"
  | "ocr_scan"
  | "approvals"
  | "work_queue"
  | "reports"
  | "offline_reconnect"
  | "update_flow";

type ChecklistItem = {
  key: ChecklistKey;
  label: string;
  detail: string;
};

const CHECKLIST_STORAGE_KEY = "factorynerve:pwa-qa-checklist:v1";

const QA_CHECKLIST: ChecklistItem[] = [
  {
    key: "browser_install",
    label: "Android browser install",
    detail: "Confirm install prompt or Add to Home Screen guidance in Chrome.",
  },
  {
    key: "standalone_launch",
    label: "Standalone launch",
    detail: "Open from the home screen and confirm standalone mode plus safe-area layout.",
  },
  {
    key: "login",
    label: "Email login",
    detail: "Sign in, refresh, relaunch, and confirm the session survives.",
  },
  {
    key: "google_login",
    label: "Google login",
    detail: "Complete Google sign-in from installed mode and return to the app.",
  },
  {
    key: "attendance",
    label: "Attendance route",
    detail: "Check main attendance flow and mobile actions on a real phone.",
  },
  {
    key: "entry",
    label: "Entry route",
    detail: "Create or queue an entry and confirm draft or sync status is visible.",
  },
  {
    key: "ocr_scan",
    label: "OCR scan route",
    detail: "Run all four OCR steps and verify buttons, images, and results fit on phone.",
  },
  {
    key: "approvals",
    label: "Approvals route",
    detail: "Review queue, drawer, and actions in installed mode.",
  },
  {
    key: "work_queue",
    label: "Work queue route",
    detail: "Verify task list density, actions, and section order on phone.",
  },
  {
    key: "reports",
    label: "Reports route",
    detail: "Check filters, export actions, and mobile results/cards.",
  },
  {
    key: "offline_reconnect",
    label: "Offline and reconnect",
    detail: "Disable network, verify offline behavior, then reconnect and confirm sync feedback.",
  },
  {
    key: "update_flow",
    label: "App update flow",
    detail: "Deploy a new build, confirm update-ready banner, then refresh into the new version.",
  },
];

function emptyChecklistState() {
  return QA_CHECKLIST.reduce<Record<ChecklistKey, boolean>>((accumulator, item) => {
    accumulator[item.key] = false;
    return accumulator;
  }, {} as Record<ChecklistKey, boolean>);
}

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
  const [checklist, setChecklist] = useState<Record<ChecklistKey, boolean>>(() => emptyChecklistState());

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
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<ChecklistKey, boolean>>;
      setChecklist((current) => ({
        ...current,
        ...parsed,
      }));
    } catch {
      // Ignore invalid local storage state and keep defaults.
    }
  }, []);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checklist));
  }, [checklist]);

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
  const completedChecklistCount = useMemo(
    () => QA_CHECKLIST.filter((item) => checklist[item.key]).length,
    [checklist],
  );

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

  const handleToggleChecklist = (key: ChecklistKey) => {
    setChecklist((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const handleCopySummary = async () => {
    const lines = [
      "FactoryNerve PWA QA Summary",
      `Checked at: ${snapshot.checkedAt || "Not checked"}`,
      `App mode: ${snapshot.standalone ? "Installed app" : "Browser tab"}`,
      `Network: ${networkLabel}`,
      `Service worker: ${
        snapshot.serviceWorkerSupported
          ? snapshot.serviceWorkerRegistered
            ? "Active"
            : "Not registered"
          : "Unsupported"
      }`,
      `Update ready: ${snapshot.updateReady ? "Yes" : "No"}`,
      `Pending sync: ${
        canQueueEntries ? snapshot.pendingSync : "Not used on this account"
      }`,
      "",
      "QA checklist:",
      ...QA_CHECKLIST.map((item) => `- [${checklist[item.key] ? "x" : " "}] ${item.label}`),
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      pushAppToast({
        title: "QA summary copied",
        description: "The current PWA readiness snapshot is copied to your clipboard.",
        tone: "success",
        durationMs: 3600,
      });
    } catch {
      pushAppToast({
        title: "Copy failed",
        description: "Clipboard access was blocked. Try again from a secure browser tab.",
        tone: "error",
        durationMs: 4200,
      });
    }
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
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => void handleCopySummary()}>
            Copy QA Summary
          </Button>
          {!snapshot.standalone ? (
            <div className="rounded-[1.1rem] border border-[rgba(77,163,255,0.22)] bg-[rgba(77,163,255,0.12)] px-4 py-3 text-sm text-[rgba(220,239,255,0.96)]">
              Open FactoryNerve from the home screen to verify standalone mode, auth persistence, and bottom safe-area behavior.
            </div>
          ) : null}
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-[rgba(8,12,20,0.5)] px-4 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">QA Checklist</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {completedChecklistCount} / {QA_CHECKLIST.length} checks complete
              </div>
              <div className="mt-2 text-sm text-slate-300">
                Use this checklist during Android browser and installed-app testing so route acceptance stays visible.
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {QA_CHECKLIST.map((item) => {
              const complete = checklist[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleToggleChecklist(item.key)}
                  className={`rounded-[1.25rem] border px-4 py-4 text-left transition ${
                    complete
                      ? "border-emerald-400/30 bg-emerald-400/10"
                      : "border-white/10 bg-white/[0.04] hover:border-[rgba(77,163,255,0.22)] hover:bg-[rgba(77,163,255,0.08)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{item.label}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-300">{item.detail}</div>
                    </div>
                    <div
                      className={`mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-2 text-xs font-semibold ${
                        complete
                          ? "border-emerald-300/30 bg-emerald-300/18 text-emerald-100"
                          : "border-white/10 bg-[rgba(8,12,20,0.5)] text-slate-300"
                      }`}
                    >
                      {complete ? "Done" : "Open"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {loading ? <div className="text-sm text-slate-400">Loading app readiness...</div> : null}
      </CardContent>
    </Card>
  );
}
