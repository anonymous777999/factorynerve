"use client";

import { startTransition, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  isValidOcrScanPanel,
  isValidOcrScanStep,
  type OcrScanPanel,
  type OcrScanStep,
} from "@/lib/ocr-scan-route";

type RouteStatePatch = {
  panel?: OcrScanPanel | null;
  step?: OcrScanStep;
  verificationId?: number | null;
};

export function useOcrScanRouteState() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const state = useMemo(() => {
    const rawStep = searchParams.get("step");
    const step = isValidOcrScanStep(rawStep) ? rawStep : "upload";

    const rawId = searchParams.get("verification_id");
    const parsedId = rawId ? Number(rawId) : Number.NaN;
    const verificationId = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;

    const rawPanel = searchParams.get("panel");
    const panel = isValidOcrScanPanel(rawPanel) ? rawPanel : "workspace";

    return {
      panel,
      step,
      verificationId,
    };
  }, [searchParams]);

  const navigate = useCallback(
    (patch: RouteStatePatch, history: "push" | "replace" = "replace") => {
      const next = new URLSearchParams(searchParams.toString());

      if (patch.step !== undefined) {
        next.set("step", patch.step);
      }

      if (patch.verificationId !== undefined) {
        if (patch.verificationId == null) {
          next.delete("verification_id");
        } else {
          next.set("verification_id", String(patch.verificationId));
        }
      }

      if (patch.panel !== undefined) {
        if (patch.panel == null || patch.panel === "workspace") {
          next.delete("panel");
        } else {
          next.set("panel", patch.panel);
        }
      }

      const query = next.toString();
      const href = query ? `${pathname}?${query}` : pathname;

      startTransition(() => {
        if (history === "push") {
          router.push(href, { scroll: false });
        } else {
          router.replace(href, { scroll: false });
        }
      });
    },
    [pathname, router, searchParams],
  );

  return {
    ...state,
    openCamera() {
      navigate({ panel: "camera" }, "push");
    },
    closeCamera() {
      navigate({ panel: "workspace" }, "replace");
    },
    replaceStep(step: OcrScanStep, verificationId: number | null) {
      navigate({ step, verificationId }, "replace");
    },
    pushStep(step: OcrScanStep, verificationId: number | null) {
      navigate({ step, verificationId }, "push");
    },
  };
}
