import { Suspense } from "react";

import VerifyEmailPage from "@/components/verify-email-page";

export default function VerifyEmailRoutePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
          Loading email verification...
        </main>
      }
    >
      <VerifyEmailPage />
    </Suspense>
  );
}
