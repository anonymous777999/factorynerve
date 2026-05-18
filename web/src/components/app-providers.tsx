"use client";

import { ApiErrorBoundary } from "@/components/api-error-boundary";
import { I18nProvider } from "@/lib/i18n";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <ApiErrorBoundary />
      {children}
    </I18nProvider>
  );
}
