"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AuthShellFreshnessAgent } from "@/components/auth-shell-freshness-agent";
import { DisplayModeAgent } from "@/components/display-mode-agent";
import { RuntimeCapabilityAgent } from "@/components/runtime-capability-agent";

const AppShell = dynamic(() =>
  import("@/components/app-shell").then((module) => module.AppShell),
);
const BetaRolloutBanner = dynamic(() =>
  import("@/components/beta-rollout-banner").then((module) => module.BetaRolloutBanner),
);
const FrontendErrorMonitor = dynamic(() =>
  import("@/components/frontend-error-monitor").then((module) => module.FrontendErrorMonitor),
);
const OfflineSyncAgent = dynamic(() =>
  import("@/components/offline-sync-agent").then((module) => module.OfflineSyncAgent),
);
const PwaInstallPrompt = dynamic(() =>
  import("@/components/pwa-install-prompt").then((module) => module.PwaInstallPrompt),
);
const PwaRouteCoverageAgent = dynamic(() =>
  import("@/components/pwa-route-coverage-agent").then((module) => module.PwaRouteCoverageAgent),
);
const ServiceWorker = dynamic(() =>
  import("@/components/service-worker").then((module) => module.ServiceWorker),
);
const ToastCenter = dynamic(() =>
  import("@/components/toast-center").then((module) => module.ToastCenter),
);

const PUBLIC_LIGHT_ROUTES = [
  "/",
  "/access",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

function isPublicLightRoute(pathname: string) {
  return PUBLIC_LIGHT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function RootRuntimeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const publicLightRoute = isPublicLightRoute(pathname);

  return (
    <>
      <RuntimeCapabilityAgent />
      <DisplayModeAgent />
      {publicLightRoute ? <AuthShellFreshnessAgent /> : null}
      {!publicLightRoute ? <PwaRouteCoverageAgent /> : null}
      {!publicLightRoute ? <BetaRolloutBanner /> : null}
      {publicLightRoute ? children : <AppShell>{children}</AppShell>}
      <ToastCenter />
      <FrontendErrorMonitor />
      {!publicLightRoute ? <OfflineSyncAgent /> : null}
      {!publicLightRoute ? <PwaInstallPrompt /> : null}
      <ServiceWorker />
    </>
  );
}
