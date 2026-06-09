import type { Density, PanelMotionStyle, PanelState, PanelStyleRecipe, PanelVariantDefinition } from "../../../../types/datatable";
import { cx } from "../../../../lib/utils";
import { getInteractionClassName } from "../Interaction";
import { PANEL_DENSITY, PANEL_PADDING } from "./panel.tokens";

const PANEL_VARIANTS: Record<NonNullable<PanelVariantDefinition["surface"]>, string> = {
  ground: "bg-[var(--color-surface-ground)]",
  workspace: "bg-[var(--color-surface-primary)]",
  elevated: "bg-[var(--color-surface-elevated)]",
  raised: "bg-[var(--color-surface-raised)]",
  overlay: "bg-[var(--color-surface-overlay)]",
  ai: "bg-[var(--color-accent-ai-surface,var(--prim-blue-950))]",
};

const PANEL_STATE_CLASSES: Record<PanelState, string> = {
  default: "border-[var(--color-border-default)]",
  selected: "border-[var(--color-border-strong)] shadow-[inset_2px_0_0_var(--prim-amber-500)]",
  active: "border-[var(--color-border-focus)] shadow-[inset_2px_0_0_var(--prim-amber-500)]",
  ai: "border-[var(--prim-blue-700)] shadow-[inset_2px_0_0_var(--prim-blue-600)]",
  warning: "border-[var(--prim-amber-700)] shadow-[inset_2px_0_0_var(--prim-amber-500)]",
  critical: "border-[var(--prim-red-700)] shadow-[inset_2px_0_0_var(--prim-red-500)]",
};

export const PANEL_VARIANT_MAP: Record<"workspace" | "inspector" | "ai" | "floating", PanelVariantDefinition> = {
  workspace: {
    surface: "elevated",
    rootClassName: "border border-[var(--color-border-default)]",
    headerClassName: "bg-[var(--color-surface-primary)] border-b border-[var(--color-border-default)]",
    footerClassName: "bg-[var(--color-surface-primary)] border-t border-[var(--color-border-default)]",
    toolbarClassName: "bg-[var(--color-surface-primary)] border-b border-[var(--color-border-default)]",
  },
  inspector: {
    surface: "workspace",
    borderAccent: "shadow-[inset_2px_0_0_var(--prim-amber-500)]",
    rootClassName: "border border-[var(--color-border-default)]",
    headerClassName: "bg-[var(--color-surface-primary)] border-b border-[var(--color-border-default)]",
    footerClassName: "bg-[var(--color-surface-primary)] border-t border-[var(--color-border-default)]",
    toolbarClassName: "bg-[var(--color-surface-primary)] border-b border-[var(--color-border-default)]",
  },
  ai: {
    surface: "workspace",
    borderAccent: "shadow-[inset_2px_0_0_var(--prim-blue-700)]",
    rootClassName: "border border-[var(--prim-blue-700)]",
    headerClassName: "bg-[var(--ai-panel-header-bg,var(--color-surface-elevated))] border-b border-[var(--prim-blue-800)]",
    footerClassName: "bg-[var(--color-surface-elevated)] border-t border-[var(--prim-blue-800)]",
    toolbarClassName: "bg-[var(--color-accent-ai-surface,var(--prim-blue-950))] border-b border-[var(--prim-blue-800)]",
  },
  floating: {
    surface: "elevated",
    rootClassName: "border border-[var(--color-border-default)] shadow-[var(--shadow-lg)]",
    headerClassName: "bg-[var(--color-surface-primary)] border-b border-[var(--color-border-default)]",
    footerClassName: "bg-[var(--color-surface-primary)] border-t border-[var(--color-border-default)]",
    toolbarClassName: "bg-[var(--color-surface-primary)] border-b border-[var(--color-border-default)]",
  },
};

export function getPanelMotionStyle(isOverlay: boolean): PanelMotionStyle {
  return {
    enterClassName: isOverlay
      ? "animate-[fn-panel-enter_var(--transition-slow)_var(--ease-smooth)]"
      : "animate-[fn-panel-enter_var(--transition-base)_var(--ease-smooth)]",
    exitClassName: "animate-none",
  };
}

export function getPanelRecipe(options: {
  variant: "workspace" | "inspector" | "ai" | "floating";
  surface?: PanelVariantDefinition["surface"];
  state: PanelState;
  density: Density;
  padding: keyof typeof PANEL_PADDING;
  scrollable: boolean;
}): PanelStyleRecipe {
  const variant = PANEL_VARIANT_MAP[options.variant];
  const surface = options.surface ?? variant.surface;

  return {
    root: cx(
      "relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--radius-lg)] text-[var(--color-text-secondary)]",
      getInteractionClassName({
        states: ["selected", "active", "warning", "critical", "ai-active", "pending", "reviewed"],
        target: "surface",
      }),
      PANEL_VARIANTS[surface],
      variant.rootClassName,
      variant.borderAccent,
      PANEL_STATE_CLASSES[options.state],
      PANEL_DENSITY[options.density]
    ),
    body: cx(
      "relative min-h-0 min-w-0 flex-1",
      PANEL_PADDING[options.padding],
      options.scrollable &&
        "overflow-auto overscroll-contain [scrollbar-color:var(--prim-neutral-600)_transparent]"
    ),
    header: cx(
      "relative z-[var(--z-raised)] flex min-h-[40px] shrink-0 items-center gap-[var(--spacing-3)] px-[var(--spacing-5)] py-[10px]",
      variant.headerClassName
    ),
    footer: cx(
      "relative z-[var(--z-raised)] flex min-h-[40px] shrink-0 items-center gap-[var(--spacing-3)] px-[var(--spacing-5)] py-[10px]",
      variant.footerClassName
    ),
  };
}
