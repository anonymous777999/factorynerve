"use client";

import { startTransition, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  isValidOcrVerifyPane,
  isValidOcrVerifyStatusFilter,
  isValidOcrVerifyTab,
  type OcrVerifyPane,
  type OcrVerifyStatusFilter,
  type OcrVerifyStep,
  type OcrVerifyTab,
} from "@/lib/ocr-verify-route";

type RouteStatePatch = {
  id?: number | null;
  step?: OcrVerifyStep;
  search?: string;
  status?: OcrVerifyStatusFilter;
  pane?: OcrVerifyPane;
  tab?: OcrVerifyTab;
};

export function useOcrVerifyRouteState() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const state = useMemo(() => {
    // Support both ?id=N (canonical) and ?verification_id=N (legacy alias from OCR history page)
    const rawId = searchParams.get("id") ?? searchParams.get("verification_id");
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
    const defaultPane: OcrVerifyPane = id != null && step >= 3 ? "workspace" : "queue";
    const pane = isValidOcrVerifyPane(searchParams.get("pane"))
      ? ((searchParams.get("pane") as OcrVerifyPane) || defaultPane)
      : defaultPane;
    const tab = isValidOcrVerifyTab(searchParams.get("tab"))
      ? ((searchParams.get("tab") as OcrVerifyTab) || "issues")
      : "issues";

    return {
      id,
      pane,
      step,
      search: searchParams.get("q")?.trim() ?? "",
      status,
      tab,
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

      if (patch.pane !== undefined) {
        if (patch.pane === "queue") {
          next.delete("pane");
        } else {
          next.set("pane", patch.pane);
        }
      }

      if (patch.tab !== undefined) {
        if (patch.tab === "issues") {
          next.delete("tab");
        } else {
          next.set("tab", patch.tab);
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
      navigate({ id: null, pane: "queue", step: 1 }, "push");
    },
    openIntake() {
      navigate({ id: null, pane: "workspace", step: 2 }, "push");
    },
    openVerification(id: number, step: OcrVerifyStep = 3, pane: OcrVerifyPane = "workspace") {
      navigate({ id, pane, step }, "push");
    },
    replaceVerification(id: number, step: OcrVerifyStep = 3, pane: OcrVerifyPane = "workspace") {
      navigate({ id, pane, step }, "replace");
    },
    setStep(step: OcrVerifyStep, history: "push" | "replace" = "push") {
      navigate({ step }, history);
    },
    setPane(pane: OcrVerifyPane, history: "push" | "replace" = "replace") {
      navigate({ pane }, history);
    },
    setTab(tab: OcrVerifyTab, history: "push" | "replace" = "replace") {
      navigate({ tab }, history);
    },
  };
}
