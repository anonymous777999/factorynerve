"use client";

import { startTransition, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  isValidOcrVerifyStatusFilter,
  type OcrVerifyStatusFilter,
  type OcrVerifyStep,
} from "@/lib/ocr-verify-route";

type RouteStatePatch = {
  id?: number | null;
  step?: OcrVerifyStep;
  search?: string;
  status?: OcrVerifyStatusFilter;
};

export function useOcrVerifyRouteState() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const state = useMemo(() => {
    const rawId = searchParams.get("id");
    const parsedId = rawId ? Number(rawId) : Number.NaN;
    const id = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;

    const rawStep = Number(searchParams.get("step"));
    const step =
      rawStep >= 1 && rawStep <= 4
        ? (rawStep as OcrVerifyStep)
        : id != null
          ? 3
          : 1;

    const rawStatus = searchParams.get("status");
    const status = isValidOcrVerifyStatusFilter(rawStatus)
      ? ((rawStatus as OcrVerifyStatusFilter) || "all")
      : "all";

    return {
      id,
      step,
      search: searchParams.get("q")?.trim() ?? "",
      status,
    };
  }, [searchParams]);

  const navigate = useCallback(
    (patch: RouteStatePatch, history: "push" | "replace" = "push") => {
      const next = new URLSearchParams(searchParams.toString());

      if (patch.id !== undefined) {
        if (patch.id == null) {
          next.delete("id");
        } else {
          next.set("id", String(patch.id));
        }
      }

      if (patch.step !== undefined) {
        next.set("step", String(patch.step));
      }

      if (patch.search !== undefined) {
        const normalizedSearch = patch.search.trim();
        if (normalizedSearch) {
          next.set("q", normalizedSearch);
        } else {
          next.delete("q");
        }
      }

      if (patch.status !== undefined) {
        if (patch.status === "all") {
          next.delete("status");
        } else {
          next.set("status", patch.status);
        }
      }

      const href = `${pathname}?${next.toString()}`;
      startTransition(() => {
        if (history === "replace") {
          router.replace(href, { scroll: false });
        } else {
          router.push(href, { scroll: false });
        }
      });
    },
    [pathname, router, searchParams],
  );

  return {
    ...state,
    setSearch(search: string) {
      navigate({ search }, "replace");
    },
    setStatus(status: OcrVerifyStatusFilter) {
      navigate({ status }, "replace");
    },
    openQueue() {
      navigate({ id: null, step: 1 }, "push");
    },
    openIntake() {
      navigate({ id: null, step: 2 }, "push");
    },
    openVerification(id: number, step: OcrVerifyStep = 3) {
      navigate({ id, step }, "push");
    },
    replaceVerification(id: number, step: OcrVerifyStep = 3) {
      navigate({ id, step }, "replace");
    },
    setStep(step: OcrVerifyStep, history: "push" | "replace" = "push") {
      navigate({ step }, history);
    },
  };
}
