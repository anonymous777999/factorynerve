"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "factorynerve:pwa-install-dismissed:v1";
const HIDE_ROUTES = ["/ocr/scan", "/offline"];
const SHELL_HIDDEN_ROUTES = new Set(["/", "/login", "/register", "/forgot-password", "/reset-password"]);

type InstallOutcome = "accepted" | "dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: InstallOutcome; platform: string }>;
};

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isIosSafari() {
  if (typeof window === "undefined") return false;
  const userAgent = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(userAgent);
  const webkit = /WebKit/.test(userAgent);
  const excluded = /CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
  return iOS && webkit && !excluded;
}

function isLikelyMobileWidth() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 1023px)").matches;
}

export function PwaInstallPrompt() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosMode, setIosMode] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setInstalled(isStandaloneMode());
    setIosMode(isIosSafari());
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");

    const handlePrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setDeferredPrompt(installEvent);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      window.localStorage.removeItem(DISMISS_KEY);
    };

    const handleDisplayModeChange = () => {
      setInstalled(isStandaloneMode());
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.matchMedia?.("(display-mode: standalone)")?.addEventListener?.("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.matchMedia?.("(display-mode: standalone)")?.removeEventListener?.("change", handleDisplayModeChange);
    };
  }, []);

  const hiddenByRoute = useMemo(
    () => HIDE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`)),
    [pathname],
  );

  const canShow = useMemo(() => {
    if (installed || dismissed || hiddenByRoute) return false;
    if (!isLikelyMobileWidth()) return false;
    return Boolean(deferredPrompt || iosMode);
  }, [deferredPrompt, dismissed, hiddenByRoute, installed, iosMode]);

  const bottomOffsetClass = SHELL_HIDDEN_ROUTES.has(pathname || "")
    ? "bottom-[max(1rem,calc(1rem+env(safe-area-inset-bottom)))]"
    : "bottom-[calc(7rem+env(safe-area-inset-bottom))] lg:bottom-6";

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, "1");
    }
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === "accepted") {
        setInstalled(true);
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(DISMISS_KEY);
        }
      } else {
        handleDismiss();
      }
    } finally {
      setInstalling(false);
    }
  };

  if (!canShow) return null;

  return (
    <div
      className={cn(
        "safe-inline-pad pointer-events-none fixed inset-x-0 z-40",
        bottomOffsetClass,
      )}
    >
      <div className="pointer-events-auto mx-auto w-full max-w-xl rounded-[1.7rem] border border-[rgba(77,163,255,0.2)] bg-[rgba(8,14,24,0.92)] p-4 shadow-[0_22px_60px_rgba(4,10,20,0.4)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex rounded-full border border-[rgba(77,163,255,0.22)] bg-[rgba(77,163,255,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[rgba(148,207,255,0.95)]">
              {iosMode ? "iPhone Install" : "Install App"}
            </div>
            <div className="mt-3 text-lg font-semibold text-white">Open FactoryNerve like an app.</div>
            <div className="mt-2 text-sm leading-6 text-slate-300">
              {iosMode
                ? "Add FactoryNerve to your home screen for a cleaner full-screen factory workflow on iPhone."
                : "Install FactoryNerve to your home screen for faster launch, full-screen mode, and a smoother mobile workflow."}
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Not now
          </button>
        </div>

        {iosMode ? (
          <div className="mt-4 space-y-3">
            <Button
              type="button"
              variant="primary"
              className="h-11 w-full"
              onClick={() => setShowIosSteps((current) => !current)}
            >
              {showIosSteps ? "Hide iPhone Steps" : "Show iPhone Steps"}
            </Button>
            {showIosSteps ? (
              <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
                <div>1. Tap the Safari share button.</div>
                <div className="mt-2">2. Choose `Add to Home Screen`.</div>
                <div className="mt-2">3. Tap `Add` to install FactoryNerve.</div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="primary"
              className="h-11 w-full sm:w-auto"
              onClick={() => void handleInstall()}
              disabled={installing}
            >
              {installing ? "Opening install..." : "Install FactoryNerve"}
            </Button>
            <div className="rounded-[1.1rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
              Works best for daily routes like attendance, entry, and OCR.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
