import { Suspense } from "react";

import { BillingWorkspace } from "@/features/billing";

export default function BillingRoutePage() {
  return (
    <Suspense fallback={null}>
      <BillingWorkspace />
    </Suspense>
  );
}
