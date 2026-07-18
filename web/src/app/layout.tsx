import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/layout/app-providers";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plex-sans",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-space-grotesk",
});
import { AppShell } from "@/components/layout/app-shell";
import { BetaRolloutBanner } from "@/components/shared/beta-rollout-banner";
import { FeedbackSyncAgent } from "@/components/shared/feedback-sync-agent";
import { FrontendErrorMonitor } from "@/components/shared/frontend-error-monitor";
import { OfflineSyncAgent } from "@/components/shared/offline-sync-agent";
import { PendingSyncBadge } from "@/components/shared/pending-sync-badge";
import { ServiceWorker } from "@/components/shared/service-worker";
import { ToastCenter } from "@/components/shared/toast-center";

export const metadata: Metadata = {
  title: "Factory Nerve",
  description: "Factory trust infrastructure — production, attendance, inventory, and dispatch in one platform.",
  manifest: "/manifest.json",
  applicationName: "Factory Nerve",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Factory Nerve",
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
    <html lang="en" className={`h-full antialiased ${plexSans.variable} ${spaceGrotesk.variable}`}>

      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--text)]">
        <AppProviders>
          <BetaRolloutBanner />
          <AppShell>{children}</AppShell>
          <ToastCenter />
          <FrontendErrorMonitor />
          <OfflineSyncAgent />
          <PendingSyncBadge />
          <FeedbackSyncAgent />
          <ServiceWorker buildVersion={serviceWorkerBuildVersion} />
        </AppProviders>
      </body>
    </html>
  );
}
