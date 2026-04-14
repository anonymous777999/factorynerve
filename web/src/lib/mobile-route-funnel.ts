"use client";

import { useEffect, useRef } from "react";

import { trackProductEvent } from "@/lib/product-analytics";


export function useMobileRouteFunnel(route: string, userRole?: string | null, enabled = true) {
  const viewTrackedRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!enabled || viewTrackedRef.current || typeof window === "undefined") {
      return;
    }
    const viewportWidth = window.innerWidth;
    if (viewportWidth >= 768) {
      return;
    }
    viewTrackedRef.current = true;
    void trackProductEvent("mobile_route_funnel_step", {
      route,
      user_role: userRole || "unknown",
      viewport_width: viewportWidth,
      step: "view",
      primary_action: "route_entry",
    });
  }, [enabled, route, userRole]);

  return (primaryAction: string) => {
    if (!enabled || completedRef.current || typeof window === "undefined") {
      return;
    }
    const viewportWidth = window.innerWidth;
    if (viewportWidth >= 768) {
      return;
    }
    completedRef.current = true;
    void trackProductEvent("mobile_route_funnel_step", {
      route,
      user_role: userRole || "unknown",
      viewport_width: viewportWidth,
      step: "primary_action_completed",
      primary_action: primaryAction,
    });
  };
}
