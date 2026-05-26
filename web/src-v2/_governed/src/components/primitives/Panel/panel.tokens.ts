export const PANEL_STORAGE_KEYS = {
  ai: "factorynerve.panel.ai.width",
  inspector: "factorynerve.panel.inspector.width",
  workflow: "factorynerve.panel.workflow.width",
} as const;

export const PANEL_WIDTHS = {
  ai: { default: 360, min: 280, max: 480 },
  inspector: { default: 400, min: 320, max: 600 },
  workflow: { default: 360, min: 320, max: 480 },
  validation: { default: 320, min: 280, max: 400 },
} as const;

export const PANEL_PADDING = {
  none: "p-0",
  compact: "p-[var(--spacing-4)]",
  default: "p-[var(--spacing-6)]",
  comfortable: "p-[var(--spacing-8)]",
} as const;

export const PANEL_DENSITY = {
  compact: "gap-[var(--spacing-3)]",
  default: "gap-[var(--spacing-4)]",
  touch: "gap-[var(--spacing-5)]",
} as const;
