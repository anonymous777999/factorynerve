import type { Metadata, Viewport } from "next";
import { DM_Sans, Sora } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";
import { AppShell } from "@/components/app-shell";
import { BetaRolloutBanner } from "@/components/beta-rollout-banner";
import { FrontendErrorMonitor } from "@/components/frontend-error-monitor";
import { OfflineSyncAgent } from "@/components/offline-sync-agent";
import { ServiceWorker } from "@/components/service-worker";
import { ToastCenter } from "@/components/toast-center";

const fontBody = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const fontDisplay = Sora({
  variable: "--font-display",
  subsets: ["latin"],
});

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fontBody.variable} ${fontDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--text)]">
        <AppProviders>
          <BetaRolloutBanner />
          <AppShell>{children}</AppShell>
          <ToastCenter />
          <FrontendErrorMonitor />
          <OfflineSyncAgent />
          <ServiceWorker />
        </AppProviders>
      </body>
    </html>
  );
}
