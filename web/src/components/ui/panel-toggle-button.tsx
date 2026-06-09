"use client";

import { ChevronLeft, ChevronRight, PanelLeft, PanelLeftClose } from "lucide-react";

import { cn } from "@/lib/utils";

export type PanelToggleKind = "nav-sidebar" | "rail-right";

type PanelToggleButtonProps = {
  /** Which panel this control affects. */
  kind: PanelToggleKind;
  /** True when the panel is currently visible (button will collapse it). */
  expanded: boolean;
  onClick: () => void;
  "aria-label": string;
  title?: string;
  className?: string;
  /** Docked to the right viewport edge when the panel is collapsed (expand affordance). */
  docked?: boolean;
};

const iconClass = "h-4 w-4 shrink-0";

function ToggleIcon({ kind, expanded }: { kind: PanelToggleKind; expanded: boolean }) {
  if (kind === "nav-sidebar") {
    const Icon = expanded ? PanelLeftClose : PanelLeft;
    return <Icon className={iconClass} aria-hidden />;
  }

  const Icon = expanded ? ChevronRight : ChevronLeft;
  return <Icon className={iconClass} aria-hidden />;
}

/**
 * Compact circular control for collapsing/expanding side panels (nav, context rail, etc.).
 * Icon-only — no boxed text labels that overflow cramped headers.
 */
export function PanelToggleButton({
  kind,
  expanded,
  onClick,
  "aria-label": ariaLabel,
  title,
  className,
  docked = false,
}: PanelToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
      aria-expanded={expanded}
      className={cn(
        "panel-toggle-btn",
        docked ? "panel-toggle-btn--dock-right" : "panel-toggle-btn--inline",
        className,
      )}
    >
      <ToggleIcon kind={kind} expanded={expanded} />
    </button>
  );
}
