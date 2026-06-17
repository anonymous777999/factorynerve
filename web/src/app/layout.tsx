import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/components/layout/app-providers";
import { AppShell } from "@/components/layout/app-shell";
import { BetaRolloutBanner } from "@/components/shared/beta-rollout-banner";
import { FeedbackSyncAgent } from "@/components/shared/feedback-sync-agent";
import { FrontendErrorMonitor } from "@/components/shared/frontend-error-monitor";
import { OfflineSyncAgent } from "@/components/shared/offline-sync-agent";
import { ServiceWorker } from "@/components/shared/service-worker";
import { ToastCenter } from "@/components/shared/toast-center";

export const metadata: Metadata = {
  title: "DPR.ai Web",
  description: "Modern production-ready frontend for DPR.ai",
  manifest: "/manifest.json",
  applicationName: "DPR.ai",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DPR.ai",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0e14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const serviceWorkerBuildVersion =
  (process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_RELEASE_VERSION ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    "dev"
  ).trim();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      {/* AUDIT: VISUAL_GENERIC — Swapped the default app fonts for a more deliberate control-room pairing loaded from Google Fonts CDN. */}
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--text)]">
        <AppProviders>
          <BetaRolloutBanner />
          <AppShell>{children}</AppShell>
          <ToastCenter />
          <FrontendErrorMonitor />
          <OfflineSyncAgent />
          <FeedbackSyncAgent />
          <ServiceWorker buildVersion={serviceWorkerBuildVersion} />
        </AppProviders>
      </body>
    </html>
  );
}
