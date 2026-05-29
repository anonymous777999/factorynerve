import "@/v2/systems/styles/factory-nerve.ui.css";

import { redirect } from "next/navigation";

import { NEW_OCR_VERIFY, USE_GOVERNED_OCR_WORKSPACE } from "@/config/featureFlags";
import { buildCanonicalOcrVerifyHref } from "@/lib/ocr-verify-route";
import { Suspense, lazy } from "react";

const GovernedOcrVerificationPage = lazy(() =>
  import("@/v2/workspaces/ocr-execution").then(m => ({ default: m.GovernedOcrVerificationPage }))
);

const OcrVerificationPage = lazy(() => import("@/legacy-ui/ocr/ocr-verification-page"));
const OcrVerificationV2Page = lazy(() => import("@/legacy-ui/ocr/ocr-verification-v2-page"));

type OcrVerifyRoutePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function VerifyLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-app text-sm text-text-secondary">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-action-primary border-t-transparent" />
        Loading OCR workspace...
      </div>
    </main>
  );
}

export default async function OcrVerifyRoutePage({
  searchParams,
}: OcrVerifyRoutePageProps) {
  const resolvedSearchParams = await searchParams;
  const workspaceOverride = Array.isArray(resolvedSearchParams.workspace)
    ? resolvedSearchParams.workspace[0]
    : resolvedSearchParams.workspace;

  if (!NEW_OCR_VERIFY) {
    return (
      <Suspense fallback={<VerifyLoading />}>
        <OcrVerificationPage />
      </Suspense>
    );
  }

  if (workspaceOverride === "legacy") {
    return (
      <Suspense fallback={<VerifyLoading />}>
        <OcrVerificationV2Page />
      </Suspense>
    );
  }

  if (workspaceOverride === "governed" || USE_GOVERNED_OCR_WORKSPACE || !workspaceOverride) {
    return (
      <Suspense fallback={<VerifyLoading />}>
        <GovernedOcrVerificationPage />
      </Suspense>
    );
  }

  const canonicalHref = buildCanonicalOcrVerifyHref(resolvedSearchParams);
  const currentParams = new URLSearchParams();

  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => currentParams.append(key, item));
      return;
    }
    if (typeof value === "string") {
      currentParams.set(key, value);
    }
  });

  const currentHref = currentParams.toString()
    ? `/ocr/verify?${currentParams.toString()}`
    : "/ocr/verify";

  if (canonicalHref !== currentHref) {
    redirect(canonicalHref);
  }

  return (
    <Suspense fallback={<VerifyLoading />}>
      <OcrVerificationV2Page />
    </Suspense>
  );
}
