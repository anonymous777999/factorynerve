"use client";

import { cn } from "@/lib/utils";

export type TabNavItem = {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
};

export type TabNavProps = {
  tabs: TabNavItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
  variant?: "surface" | "inline";
};

export function TabNav({
  tabs,
  activeTab,
  onTabChange,
  className,
  variant = "surface",
}: TabNavProps) {
  return (
    <nav
      className={cn(
        "flex gap-xs overflow-x-auto pb-xs",
        variant === "surface" &&
          "rounded-panel border border-border-subtle bg-surface-panel p-xs",
        className,
      )}
      aria-label="Section tabs"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            disabled={tab.disabled}
            aria-current={active ? "page" : undefined}
            className={cn(
              "min-w-[7rem] shrink-0 rounded-control px-md py-sm text-left transition-colors",
              active
                ? "border border-border-focus bg-surface-selected text-text-primary"
                : "border border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary",
              tab.disabled && "cursor-not-allowed opacity-50",
            )}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="block text-sm font-semibold">{tab.label}</span>
            {tab.hint ? (
              <span className="mt-xs hidden text-label-dense text-text-tertiary md:block">
                {tab.hint}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
