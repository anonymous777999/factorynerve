"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export type DisclosurePanelProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: "surface" | "ghost";
  className?: string;
};

export function DisclosurePanel({
  title,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  variant = "surface",
  className,
}: DisclosurePanelProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  return (
    <section
      className={cn(
        "rounded-panel border border-border-subtle",
        variant === "surface" ? "bg-surface-panel" : "bg-transparent",
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-sm px-lg py-md text-left transition-colors hover:bg-surface-hover"
        onClick={() => setOpen(!open)}
      >
        <span className="text-panel-title font-semibold text-text-primary">{title}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-text-tertiary transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-[var(--motion-base)] ease-[var(--ease-standard)]",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border-subtle px-lg py-md">{children}</div>
        </div>
      </div>
    </section>
  );
}
