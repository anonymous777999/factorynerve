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
    <Card className="rounded-[1.6rem] !border-[#e7e5e4] !bg-none !bg-white !text-[#111111] shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-[#111111]">{panel.title}</CardTitle>
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
                  ? "rounded-xl border border-[#111111] bg-[#111111] px-3 py-2 text-left text-sm font-semibold text-white shadow-[0_10px_24px_rgba(17,17,17,0.12)]"
                  : "rounded-xl border border-[#d6d3d1] bg-[#f5f5f4] px-3 py-2 text-left text-sm text-[#57534e] hover:border-[#a8a29e] hover:bg-[#e7e5e4]"
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
