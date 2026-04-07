import { Suspense } from "react";

import VerifyEmailPage from "@/components/verify-email-page";

export default function VerifyEmailRoutePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-4 py-8">
          <div className="w-full max-w-md rounded-[1.8rem] border border-[var(--border)] bg-[rgba(20,24,36,0.9)] px-6 py-8 text-center text-sm text-[var(--muted)] shadow-2xl">
            Loading email verification...
          </div>
        </main>
      }
    >
      <VerifyEmailPage />
    </Suspense>
  );
}
