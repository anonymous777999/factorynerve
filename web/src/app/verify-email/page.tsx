import { Suspense } from "react";

import { VerifyEmailWorkspace } from "@/features/auth";

export default function VerifyEmailRoutePage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailWorkspace />
    </Suspense>
  );
}
