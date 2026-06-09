import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Inter, Barlow_Condensed, DM_Sans, Bebas_Neue } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AppProviders } from "@/components/app-providers";
import { AppShell } from "@/components/app-shell";
import { BetaRolloutBanner } from "@/components/beta-rollout-banner";
import { FeedbackSyncAgent } from "@/components/feedback-sync-agent";
import { FrontendErrorMonitor } from "@/components/frontend-error-monitor";
import { OfflineSyncAgent } from "@/components/offline-sync-agent";
import { ServiceWorker } from "@/components/service-worker";
import { ToastCenter } from "@/components/toast-center";
import { BadgeProvider } from "@/providers/badge-provider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600"],
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex-sans",
  weight: ["400", "500", "600"],
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex-mono",
  weight: ["400", "500"],
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-barlow-condensed",
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
  weight: ["400", "500", "700"],
});

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bebas-neue",
  weight: ["400"],
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
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f1117" },
    { media: "(prefers-color-scheme: light)", color: "#f7f6f4" },
  ],
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
    <html
      lang="en"
      className={cn(
        "h-full antialiased",
        inter.variable,
        ibmPlexSans.variable,
        ibmPlexMono.variable,
        barlowCondensed.variable,
        dmSans.variable,
        bebasNeue.variable
      )}
      data-theme="dark"
      data-density="default"
    >
      <body className="flex min-h-full flex-col bg-surface-app font-sans text-text-primary">
        <Script
          id="dpr-ui-preferences-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var root = document.documentElement;
                var storedTheme = window.localStorage.getItem("dpr:web:theme");
                var storedDensity = window.localStorage.getItem("dpr:web:density");
                var theme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";
                var density = storedDensity === "compact" || storedDensity === "default" || storedDensity === "comfortable" ? storedDensity : "default";
                root.dataset.theme = theme;
                root.dataset.density = density;
                root.style.colorScheme = theme;
              })();
            `,
          }}
        />
        <AppProviders>
          {/* Skip link for keyboard/screen reader users — WCAG 2.4.1 */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-surface-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent focus:shadow-md focus:outline-none focus:ring-2 focus:ring-accent"
          >
            Skip to main content
          </a>
          <BetaRolloutBanner />
          <BadgeProvider>
            <AppShell>{children}</AppShell>
          </BadgeProvider>
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
