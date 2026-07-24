"use client";

import { ApiErrorBoundary } from "@/components/shared/api-error-boundary";
import { OcrQueryClientProvider } from "@/components/shared/query-client-provider";
import { I18nProvider } from "@/lib/i18n";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <OcrQueryClientProvider>
      <I18nProvider>
        <ApiErrorBoundary />
        {children}
      </I18nProvider>
    </OcrQueryClientProvider>
  );
}
