import type { Metadata, Viewport } from "next";
import { DM_Sans, Sora } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/app-providers";
import { RootRuntimeShell } from "@/components/root-runtime-shell";
import { DottedSurface } from "@/components/ui/dotted-surface";

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
      <body className="relative isolate min-h-full flex flex-col overflow-x-clip bg-[var(--bg)] text-[var(--text)]">
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <DottedSurface className="fixed inset-0 opacity-[0.9]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgba(77,163,255,0.16),transparent_24%),radial-gradient(circle_at_84%_18%,rgba(20,184,166,0.12),transparent_24%),linear-gradient(180deg,rgba(9,19,29,0.24),rgba(9,19,29,0.12)_38%,rgba(9,19,29,0.28))]" />
        </div>
        <AppProviders>
          <RootRuntimeShell>{children}</RootRuntimeShell>
        </AppProviders>
      </body>
    </html>
  );
}
