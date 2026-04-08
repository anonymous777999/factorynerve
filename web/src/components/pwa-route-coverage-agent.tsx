"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { recordPwaRouteVisit } from "@/lib/pwa-route-coverage";
import { useDisplayMode } from "@/lib/use-display-mode";

export function PwaRouteCoverageAgent() {
  const pathname = usePathname() || "/";
  const { standalone } = useDisplayMode();

  useEffect(() => {
    recordPwaRouteVisit(pathname, standalone ? "standalone" : "browser");
  }, [pathname, standalone]);

  return null;
}
