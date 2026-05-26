import "@/v2/systems/styles/factory-nerve.ui.css";

import { redirect } from "next/navigation";

import { NEW_OCR_VERIFY, USE_GOVERNED_OCR_WORKSPACE } from "@/config/featureFlags";
import OcrVerificationV2Page from "@/components/ocr-verification-v2-page";
import OcrVerificationPage from "@/legacy-ui/ocr/ocr-verification-page";
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

  if (!NEW_OCR_VERIFY) {
    return <OcrVerificationPage />;
  }

  if (workspaceOverride === "legacy") {
    return <OcrVerificationV2Page />;
  }

  if (workspaceOverride === "governed" || USE_GOVERNED_OCR_WORKSPACE) {
    return <GovernedOcrVerificationPage />;
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

  return <OcrVerificationV2Page />;
}
