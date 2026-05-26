import type {
  ToolbarFilterChip,
  ToolbarSectionAlign,
  ToolbarSurface,
  ToolbarStatusItem,
} from "../../../../types/datatable";
import { getInteractionClassName } from "../Interaction";

export const TOOLBAR_SURFACE_CLASSNAME: Record<ToolbarSurface, string> = {
  ai: "border-[var(--prim-blue-800)] bg-[var(--color-accent-ai-surface,var(--prim-blue-950))]",
  workspace: "border-[var(--color-border-default)] bg-[var(--color-surface-primary)]",
};

export const TOOLBAR_SECTION_ALIGNMENT: Record<ToolbarSectionAlign, string> = {
  between: "justify-between",
  center: "justify-center",
  end: "justify-end",
  start: "justify-start",
};

export const TOOLBAR_STATUS_TONE_CLASSNAME: Record<NonNullable<ToolbarStatusItem["tone"]>, string> = {
  ai: "border-[var(--prim-blue-800)] bg-[var(--prim-blue-950)] text-[var(--prim-blue-300)]",
  critical: "border-[var(--color-status-critical-border)] bg-[var(--color-status-critical-surface)] text-[var(--color-status-critical-text)]",
  info: "border-[var(--color-status-info-border)] bg-[var(--color-status-info-surface)] text-[var(--color-status-info-text)]",
  neutral: "border-[var(--color-border-default)] bg-[var(--color-surface-raised)] text-[var(--color-text-tertiary)]",
  ok: "border-[var(--color-status-ok-border)] bg-[var(--color-status-ok-surface)] text-[var(--color-status-ok-text)]",
  warning: "border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-surface)] text-[var(--color-status-warning-text)]",
};

export const TOOLBAR_FILTER_TONE_CLASSNAME: Record<NonNullable<ToolbarFilterChip["tone"]>, string> = {
  active: "border-[var(--color-accent-operational-border)] bg-[var(--color-accent-operational-surface)] text-[var(--color-accent-operational-muted)]",
  ai: "border-[var(--prim-blue-800)] bg-[var(--prim-blue-950)] text-[var(--prim-blue-300)]",
  default: "border-[var(--color-border-default)] bg-[var(--color-surface-raised)] text-[var(--color-text-tertiary)]",
};

export const TOOLBAR_BUTTON_CLASSNAME = getInteractionClassName({
  className:
    "inline-flex h-7 shrink-0 items-center justify-center gap-[var(--spacing-1)] rounded-[var(--radius-md)] border border-transparent bg-transparent px-[var(--spacing-2)] text-[11px] font-medium text-[var(--color-text-tertiary)] focus-visible:outline-none",
  states: ["hover", "focus", "pressed", "selected", "warning", "critical", "pending", "success", "reviewed"],
  target: "button",
});

export const TOOLBAR_AI_BUTTON_CLASSNAME = getInteractionClassName({
  className:
    "inline-flex h-7 shrink-0 items-center justify-center gap-[var(--spacing-1)] rounded-[var(--radius-md)] border border-transparent bg-transparent px-[var(--spacing-2)] text-[11px] font-medium text-[var(--color-text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus-ai)]",
  states: ["hover", "pressed", "selected", "ai-active", "reviewed"],
  target: "button",
  tone: "ai",
});
