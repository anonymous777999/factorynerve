"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { listUnreadAlerts } from "@/lib/dashboard";
import { listEntries } from "@/lib/entries";
import { listOcrVerifications } from "@/lib/ocr";
import { listSteelReconciliations } from "@/lib/steel";
import { useAuth } from "@/lib/use-session";
import { subscribeToWorkflowRefresh } from "@/lib/workflow-sync";

const RAIL_COUNT_REFRESH_EVENT = "dpr:rail-counts-refresh";

const DEFAULT_BADGE_COUNTS: Record<string, number> = {
  alerts: 0,
  approvals: 0,
};

const BadgeContext = createContext<Record<string, number>>(DEFAULT_BADGE_COUNTS);

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const { activeFactory, permissions, user } = useAuth();
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>(DEFAULT_BADGE_COUNTS);

  useEffect(() => {
    if (!user) {
      setBadgeCounts(DEFAULT_BADGE_COUNTS);
      return;
    }

    let cancelled = false;
    const canReview = permissions.can_approve_entries;
    const steelMode = (activeFactory?.industry_type || "").toLowerCase() === "steel";

    const loadCounts = async () => {
      const [alertsResult, entryResult, verificationResult, reconciliationResult] = await Promise.allSettled([
        listUnreadAlerts(),
        canReview ? listEntries({ status: ["pending"], page: 1, page_size: 1 }) : Promise.resolve(null),
        canReview ? listOcrVerifications({ status: "pending" }) : Promise.resolve([]),
        canReview && steelMode ? listSteelReconciliations({ status: "pending", limit: 100 }) : Promise.resolve({ items: [] }),
      ]);

      if (cancelled) {
        return;
      }

      const alerts =
        alertsResult.status === "fulfilled" && Array.isArray(alertsResult.value)
          ? alertsResult.value.length
          : 0;
      const pendingEntries =
        entryResult.status === "fulfilled" && entryResult.value && typeof entryResult.value === "object" && "total" in entryResult.value
          ? Number((entryResult.value as { total?: number }).total || 0)
          : 0;
      const pendingVerifications =
        verificationResult.status === "fulfilled" && Array.isArray(verificationResult.value)
          ? verificationResult.value.length
          : 0;
      const pendingReconciliations =
        reconciliationResult.status === "fulfilled" && reconciliationResult.value && typeof reconciliationResult.value === "object" && "items" in reconciliationResult.value
          ? ((reconciliationResult.value as { items?: unknown[] }).items || []).length
          : 0;

      setBadgeCounts({
        alerts,
        approvals: pendingEntries + pendingVerifications + pendingReconciliations,
      });
    };

    void loadCounts();
    const timer = window.setInterval(() => {
      void loadCounts();
    }, 20000);
    const onRefresh = () => {
      void loadCounts();
    };
    const onVisibility = () => {
      if (!document.hidden) {
        void loadCounts();
      }
    };

    window.addEventListener(RAIL_COUNT_REFRESH_EVENT, onRefresh);
    document.addEventListener("visibilitychange", onVisibility);
    const stopWorkflowRefresh = subscribeToWorkflowRefresh(() => {
      void loadCounts();
    });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(RAIL_COUNT_REFRESH_EVENT, onRefresh);
      document.removeEventListener("visibilitychange", onVisibility);
      stopWorkflowRefresh();
    };
  }, [activeFactory?.industry_type, permissions.can_approve_entries, user]);

  return <BadgeContext.Provider value={badgeCounts}>{children}</BadgeContext.Provider>;
}

export function useBadges() {
  return useContext(BadgeContext);
}
