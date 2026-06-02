import { Suspense } from "react";

import { ResetPasswordWorkspace } from "@/features/auth";

export default function ResetPasswordRoutePage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordWorkspace />
    </Suspense>
  );
}
