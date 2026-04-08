import type { Metadata, Viewport } from "next";
import { DM_Sans, Sora } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";
import { AppShell } from "@/components/app-shell";
import { BetaRolloutBanner } from "@/components/beta-rollout-banner";
import { DisplayModeAgent } from "@/components/display-mode-agent";
import { FrontendErrorMonitor } from "@/components/frontend-error-monitor";
import { OfflineSyncAgent } from "@/components/offline-sync-agent";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
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
  title: "FactoryNerve",
  description: "Factory-first mobile operating system for attendance, entry, OCR, approvals, and reporting.",
  manifest: "/manifest.json",
  applicationName: "FactoryNerve",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icons/shortcut-96.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FactoryNerve",
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
          <DisplayModeAgent />
          <BetaRolloutBanner />
          <AppShell>{children}</AppShell>
          <PwaInstallPrompt />
          <ToastCenter />
          <FrontendErrorMonitor />
          <OfflineSyncAgent />
          <ServiceWorker />
        </AppProviders>
      </body>
    </html>
  );
}
