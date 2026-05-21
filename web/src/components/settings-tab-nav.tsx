"use client";

import { Button } from "@/components/ui/button";
import { ResponsiveScrollArea } from "@/components/ui/responsive-scroll-area";

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
      <div className="flex min-w-max gap-3">
        <Button
          className="whitespace-nowrap"
          variant={activeTab === "factory" ? "primary" : "outline"}
          onClick={() => onTabChange("factory")}
        >
          {labels.factory}
        </Button>
        <Button
          className="whitespace-nowrap"
          variant={activeTab === "users" ? "primary" : "outline"}
          onClick={() => onTabChange("users")}
        >
          {labels.users}
        </Button>
        <Button
          className="whitespace-nowrap"
          variant={activeTab === "usage" ? "primary" : "outline"}
          onClick={() => onTabChange("usage")}
        >
          {labels.usage}
        </Button>
        {canManageAlerts ? (
          <Button
            className="whitespace-nowrap"
            variant={activeTab === "alerts" ? "primary" : "outline"}
            onClick={() => onTabChange("alerts")}
          >
            {labels.alerts}
          </Button>
        ) : null}
        {canManageFeedback ? (
          <Button
            className="whitespace-nowrap"
            variant={activeTab === "feedback" ? "primary" : "outline"}
            onClick={() => onTabChange("feedback")}
          >
            {labels.feedback}
          </Button>
        ) : null}
      </div>
    </ResponsiveScrollArea>
  );
}
