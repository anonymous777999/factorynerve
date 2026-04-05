import { Suspense } from "react";

import BillingPage from "@/components/billing-page";

export default function BillingRoutePage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center text-sm text-[var(--muted)]">Loading billing...</main>}>
      <BillingPage />
    </Suspense>
  );
}
