import "@/v2/systems/styles/factory-nerve.ui.css";

import { redirect } from "next/navigation";

import { USE_GOVERNED_OCR_WORKSPACE } from "@/config/featureFlags";
import OcrVerificationV2Page from "@/legacy-ui/ocr/ocr-verification-v2-page";
import { buildCanonicalOcrVerifyHref } from "@/lib/ocr-verify-route";
import { GovernedOcrVerificationPage } from "@/v2/workspaces/ocr-execution";

type OcrVerifyRoutePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OcrVerifyRoutePage({
  searchParams,
}: OcrVerifyRoutePageProps) {
  const resolvedSearchParams = await searchParams;
  const workspaceOverride = Array.isArray(resolvedSearchParams.workspace)
    ? resolvedSearchParams.workspace[0]
    : resolvedSearchParams.workspace;

  if (workspaceOverride === "legacy") {
    return <OcrVerificationV2Page />;
  }

  // Normalize legacy ?verification_id=N to canonical ?id=N before rendering.
  // This must run before returning any workspace component so the client-side
  // route state hook always receives the canonical ?id param.
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

  if (USE_GOVERNED_OCR_WORKSPACE && (workspaceOverride === "governed" || !workspaceOverride)) {
    return <GovernedOcrVerificationPage />;
  }

  return <OcrVerificationV2Page />;
}
