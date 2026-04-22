import { Suspense } from "react";

import ResetPasswordPage from "@/components/reset-password-page";

export default function ResetPasswordRoutePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">
          Loading password reset...
        </main>
      }
    >
      <ResetPasswordPage />
    </Suspense>
  );
}
