import { redirect } from "next/navigation";

import { NEW_OCR_VERIFY } from "@/config/featureFlags";
import OcrVerificationPage from "@/components/workflow/ocr-verification-page";
import OcrVerificationV2Page from "@/components/workflow/ocr-verification-v2-page";
import { buildCanonicalOcrVerifyHref } from "@/lib/ocr-verify-route";

type OcrVerifyRoutePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OcrVerifyRoutePage({
  searchParams,
}: OcrVerifyRoutePageProps) {
  if (!NEW_OCR_VERIFY) {
    return <OcrVerificationPage />;
  }

  const resolvedSearchParams = await searchParams;
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
