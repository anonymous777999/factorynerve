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
    <Card className="rounded-[1.6rem] border border-[#dce5ef] bg-white text-slate-900 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-slate-800">{panel.title}</CardTitle>
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
                  ? "rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-left text-sm font-semibold text-sky-700"
                  : "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-600 hover:border-slate-300 hover:bg-slate-100"
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
