"use client";

import { ApiErrorBoundary } from "@/components/api-error-boundary";
import { OcrQueryClientProvider } from "@/components/query-client-provider";
import { I18nProvider } from "@/lib/i18n";
import { UiPreferencesProvider } from "@/providers/ui-preferences-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <OcrQueryClientProvider>
      <UiPreferencesProvider>
        <I18nProvider>
          <ApiErrorBoundary />
          {children}
        </I18nProvider>
      </UiPreferencesProvider>
    </OcrQueryClientProvider>
  );
}
