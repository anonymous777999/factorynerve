"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type TabButtonProps = {
  label: React.ReactNode;
  active: boolean;
  onClick: () => void;
  className?: string;
};

/**
 * Shared pill-style tab trigger. Replaces the 6 identical local `TabButton`
 * copies across the workflow/workforce pages. For full a11y tab semantics
 * prefer `ui/tabs.tsx` (Radix); this stays for the existing controlled-state
 * pattern those pages use.
 */
export function TabButton({ label, active, onClick, className }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl px-4 py-2 text-sm font-semibold transition",
        active
          ? "border border-[rgba(197,109,45,0.45)] bg-[rgba(197,109,45,0.14)] text-[var(--accent)] shadow-[0_0_0_1px_rgba(197,109,45,0.15)]"
          : "border border-[var(--border)] bg-[rgba(20,24,36,0.7)] text-[var(--muted)] hover:border-[rgba(197,109,45,0.28)] hover:bg-[rgba(28,34,51,0.82)]",
        className,
      )}
    >
      {label}
    </button>
  );
}
