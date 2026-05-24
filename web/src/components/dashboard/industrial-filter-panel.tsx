"use client";

import type { IndustrialFilterPanel as IndustrialFilterPanelType } from "@/lib/industrial-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function IndustrialFilterPanel({
  panel,
  selected,
  onSelect,
}: {
  panel: IndustrialFilterPanelType;
  selected?: string;
  onSelect: (panelId: string, option: string) => void;
}) {
  return (
    <Card className="rounded-[1.6rem] bg-surface-card text-text-primary shadow-[var(--shadow-xs)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-text-primary">{panel.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {panel.options.map((option) => {
          const active = selected === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(panel.id, option)}
              className={
                active
                  ? "rounded-xl border border-transparent bg-[var(--action-primary)] px-3 py-2 text-left text-sm font-semibold text-[var(--action-primary-text)] shadow-[var(--shadow-xs)]"
                  : "rounded-xl border border-transparent bg-surface-elevated px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-hover"
              }
            >
              {option}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
