"use client";

import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";
import { cn } from "@/lib/utils";

export type SettingsTabKey = "factory" | "users" | "usage" | "alerts" | "feedback";

type SettingsTabNavProps = {
  activeTab: SettingsTabKey;
  canManageAlerts: boolean;
  canManageFeedback: boolean;
  labels: {
    factory: string;
    users: string;
    usage: string;
    alerts: string;
    feedback: string;
  };
  onTabChange: (tab: SettingsTabKey) => void;
};

export function SettingsTabNav({
  activeTab,
  canManageAlerts,
  canManageFeedback,
  labels,
  onTabChange,
}: SettingsTabNavProps) {
  return (
    <ResponsiveScrollArea
      debugLabel="settings-tabs"
      viewportClassName="-mx-1 px-1"
      showIndicators={false}
    >
      <div className="mb-5 flex min-w-max gap-1">
        <button
          type="button"
          className={cn(
            "whitespace-nowrap rounded-full border-none bg-transparent px-4 py-1.5 text-[13px] text-[var(--color-text-secondary)]",
            activeTab === "factory" && "bg-[var(--color-text-primary)] font-medium text-[var(--color-background-primary)]",
          )}
          onClick={() => onTabChange("factory")}
        >
          {labels.factory}
        </button>
        <button
          type="button"
          className={cn(
            "whitespace-nowrap rounded-full border-none bg-transparent px-4 py-1.5 text-[13px] text-[var(--color-text-secondary)]",
            activeTab === "users" && "bg-[var(--color-text-primary)] font-medium text-[var(--color-background-primary)]",
          )}
          onClick={() => onTabChange("users")}
        >
          {labels.users}
        </button>
        <button
          type="button"
          className={cn(
            "whitespace-nowrap rounded-full border-none bg-transparent px-4 py-1.5 text-[13px] text-[var(--color-text-secondary)]",
            activeTab === "usage" && "bg-[var(--color-text-primary)] font-medium text-[var(--color-background-primary)]",
          )}
          onClick={() => onTabChange("usage")}
        >
          {labels.usage}
        </button>
        {canManageAlerts ? (
          <button
            type="button"
            className={cn(
              "whitespace-nowrap rounded-full border-none bg-transparent px-4 py-1.5 text-[13px] text-[var(--color-text-secondary)]",
              activeTab === "alerts" && "bg-[var(--color-text-primary)] font-medium text-[var(--color-background-primary)]",
            )}
            onClick={() => onTabChange("alerts")}
          >
            {labels.alerts}
          </button>
        ) : null}
        {canManageFeedback ? (
          <button
            type="button"
            className={cn(
              "whitespace-nowrap rounded-full border-none bg-transparent px-4 py-1.5 text-[13px] text-[var(--color-text-secondary)]",
              activeTab === "feedback" && "bg-[var(--color-text-primary)] font-medium text-[var(--color-background-primary)]",
            )}
            onClick={() => onTabChange("feedback")}
          >
            {labels.feedback}
          </button>
        ) : null}
      </div>
    </ResponsiveScrollArea>
  );
}
