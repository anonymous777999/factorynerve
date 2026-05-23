"use client";

import { startTransition, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useSteelProductionRecordRouteState() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const reviewOpen = useMemo(() => searchParams.get("review") === "1", [searchParams]);

  const navigate = useCallback(
    (nextOpen: boolean, history: "push" | "replace" = "push") => {
      const next = new URLSearchParams(searchParams.toString());
      if (nextOpen) {
        next.set("review", "1");
      } else {
        next.delete("review");
      }

      const query = next.toString();
      const href = query ? `${pathname}?${query}` : pathname;

      startTransition(() => {
        if (history === "replace") {
          router.replace(href, { scroll: false });
          return;
        }

        router.push(href, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  return {
    reviewOpen,
    openReview() {
      navigate(true, "push");
    },
    closeReview() {
      navigate(false, "replace");
    },
    setReviewOpen(open: boolean) {
      navigate(open, open ? "push" : "replace");
    },
  };
}
