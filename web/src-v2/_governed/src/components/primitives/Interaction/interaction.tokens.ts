import type {
  InteractionState,
  InteractionTarget,
  InteractionTone,
} from "../../../../types/datatable";

export const INTERACTION_STATE_ORDER: InteractionState[] = [
  "disabled",
  "loading",
  "locked",
  "critical",
  "warning",
  "success",
  "ai-active",
  "pending",
  "reviewed",
  "selected",
  "active",
  "pressed",
  "focus",
  "hover",
];

export const INTERACTION_BASE_CLASSNAME: Record<InteractionTarget, string> = {
  button:
    "transition-[background-color,border-color,color,box-shadow,opacity] duration-[var(--transition-fast)] ease-[var(--ease-operational)]",
  "icon-button":
    "transition-[background-color,border-color,color,box-shadow,opacity] duration-[var(--transition-fast)] ease-[var(--ease-operational)]",
  cell:
    "transition-[background-color,border-color,box-shadow,color] duration-[var(--transition-fast)] ease-[var(--ease-operational)]",
  dock:
    "transition-[background-color,border-color,box-shadow,opacity] duration-[var(--transition-fast)] ease-[var(--ease-operational)]",
  input:
    "transition-[background-color,border-color,box-shadow,color,opacity] duration-[var(--transition-fast)] ease-[var(--ease-operational)]",
  popover:
    "transition-[border-color,box-shadow,opacity,transform] duration-[var(--transition-base)] ease-[var(--ease-enter)]",
  "resize-handle":
    "transition-[background-color,opacity] duration-[var(--transition-fast)] ease-[var(--ease-operational)]",
  row:
    "transition-[background-color,box-shadow,color,opacity] duration-[var(--transition-fast)] ease-[var(--ease-operational)]",
  surface:
    "transition-[background-color,border-color,box-shadow,opacity] duration-[var(--transition-fast)] ease-[var(--ease-operational)]",
  toolbar:
    "transition-[background-color,border-color,box-shadow,opacity] duration-[var(--transition-fast)] ease-[var(--ease-operational)]",
  viewport:
    "transition-[border-color,box-shadow,opacity] duration-[var(--transition-fast)] ease-[var(--ease-operational)]",
};

export const INTERACTION_TONE_CLASSNAME: Record<InteractionTone, string> = {
  ai: "data-[interaction-state~=selected]:border-[var(--prim-blue-700)] data-[interaction-state~=selected]:bg-[var(--prim-blue-950)] data-[interaction-state~=selected]:text-[var(--prim-blue-300)]",
  critical:
    "data-[interaction-state~=selected]:border-[var(--color-status-critical-border)] data-[interaction-state~=selected]:bg-[var(--color-status-critical-surface)] data-[interaction-state~=selected]:text-[var(--color-status-critical-text)]",
  neutral: "",
  success:
    "data-[interaction-state~=selected]:border-[var(--color-status-ok-border)] data-[interaction-state~=selected]:bg-[var(--color-status-ok-surface)] data-[interaction-state~=selected]:text-[var(--color-status-ok-text)]",
  warning:
    "data-[interaction-state~=selected]:border-[var(--color-status-warning-border)] data-[interaction-state~=selected]:bg-[var(--color-status-warning-surface)] data-[interaction-state~=selected]:text-[var(--color-status-warning-text)]",
};

export const INTERACTION_TARGET_CLASSNAME: Record<InteractionTarget, Partial<Record<InteractionState, string>>> = {
  button: {
    "ai-active":
      "data-[interaction-state~=ai-active]:border-[var(--prim-blue-700)] data-[interaction-state~=ai-active]:bg-[var(--prim-blue-950)] data-[interaction-state~=ai-active]:text-[var(--prim-blue-300)]",
    active:
      "data-[interaction-state~=active]:border-[var(--color-border-default)] data-[interaction-state~=active]:bg-[var(--color-surface-overlay)] data-[interaction-state~=active]:text-[var(--color-text-secondary)]",
    critical:
      "data-[interaction-state~=critical]:border-[var(--color-status-critical-border)] data-[interaction-state~=critical]:bg-[var(--color-status-critical-surface)] data-[interaction-state~=critical]:text-[var(--color-status-critical-text)]",
    disabled: "data-[interaction-state~=disabled]:cursor-not-allowed data-[interaction-state~=disabled]:opacity-60",
    focus: "data-[interaction-state~=focus]:shadow-[0_0_0_var(--focus-ring-width)_rgba(224,140,15,0.22)]",
    hover:
      "data-[interaction-state~=hover]:border-[var(--color-border-default)] data-[interaction-state~=hover]:bg-[var(--color-surface-overlay)] data-[interaction-state~=hover]:text-[var(--color-text-secondary)]",
    loading: "data-[interaction-state~=loading]:cursor-wait data-[interaction-state~=loading]:opacity-80",
    locked:
      "data-[interaction-state~=locked]:border-[var(--color-border-subtle)] data-[interaction-state~=locked]:bg-[var(--color-surface-primary)] data-[interaction-state~=locked]:text-[var(--color-text-muted)]",
    pending:
      "data-[interaction-state~=pending]:border-[var(--color-status-pending-border)] data-[interaction-state~=pending]:bg-[var(--color-status-pending-surface)] data-[interaction-state~=pending]:text-[var(--color-status-pending-text)]",
    pressed:
      "data-[interaction-state~=pressed]:bg-[var(--color-surface-raised)] data-[interaction-state~=pressed]:text-[var(--color-text-primary)]",
    reviewed:
      "data-[interaction-state~=reviewed]:border-[var(--prim-blue-800)] data-[interaction-state~=reviewed]:text-[var(--prim-blue-200)]",
    selected:
      "data-[interaction-state~=selected]:border-[var(--color-accent-operational-border)] data-[interaction-state~=selected]:bg-[var(--color-accent-operational-surface)] data-[interaction-state~=selected]:text-[var(--color-accent-operational-muted)]",
    success:
      "data-[interaction-state~=success]:border-[var(--color-status-ok-border)] data-[interaction-state~=success]:bg-[var(--color-status-ok-surface)] data-[interaction-state~=success]:text-[var(--color-status-ok-text)]",
    warning:
      "data-[interaction-state~=warning]:border-[var(--color-status-warning-border)] data-[interaction-state~=warning]:bg-[var(--color-status-warning-surface)] data-[interaction-state~=warning]:text-[var(--color-status-warning-text)]",
  },
  "icon-button": {
    "ai-active":
      "data-[interaction-state~=ai-active]:border-[var(--prim-blue-700)] data-[interaction-state~=ai-active]:bg-[var(--prim-blue-950)] data-[interaction-state~=ai-active]:text-[var(--prim-blue-300)]",
    active:
      "data-[interaction-state~=active]:border-[var(--color-border-default)] data-[interaction-state~=active]:bg-[var(--color-surface-overlay)] data-[interaction-state~=active]:text-[var(--color-text-secondary)]",
    disabled: "data-[interaction-state~=disabled]:cursor-not-allowed data-[interaction-state~=disabled]:opacity-60",
    focus: "data-[interaction-state~=focus]:shadow-[0_0_0_var(--focus-ring-width)_rgba(224,140,15,0.22)]",
    hover:
      "data-[interaction-state~=hover]:border-[var(--color-border-default)] data-[interaction-state~=hover]:bg-[var(--color-surface-overlay)] data-[interaction-state~=hover]:text-[var(--color-text-secondary)]",
    loading: "data-[interaction-state~=loading]:cursor-wait data-[interaction-state~=loading]:opacity-80",
    pressed: "data-[interaction-state~=pressed]:bg-[var(--color-surface-raised)]",
    selected:
      "data-[interaction-state~=selected]:border-[var(--color-accent-operational-border)] data-[interaction-state~=selected]:bg-[var(--color-accent-operational-surface)] data-[interaction-state~=selected]:text-[var(--color-accent-operational-muted)]",
  },
  cell: {
    active: "data-[interaction-state~=active]:shadow-[inset_0_0_0_1px_var(--color-border-focus)]",
    critical: "data-[interaction-state~=critical]:bg-[rgba(220,38,38,0.06)] data-[interaction-state~=critical]:shadow-[inset_0_0_0_1px_var(--prim-red-700)]",
    focus: "data-[interaction-state~=focus]:shadow-[inset_0_0_0_1px_var(--color-border-focus)]",
    hover: "data-[interaction-state~=hover]:bg-[var(--color-surface-overlay)]",
    loading: "data-[interaction-state~=loading]:opacity-80",
    reviewed: "data-[interaction-state~=reviewed]:shadow-[inset_0_0_0_1px_var(--prim-blue-700)]",
    selected: "data-[interaction-state~=selected]:bg-[var(--color-accent-operational-surface)]",
    warning: "data-[interaction-state~=warning]:bg-[rgba(224,140,15,0.06)] data-[interaction-state~=warning]:shadow-[inset_0_0_0_1px_var(--prim-amber-700)]",
  },
  dock: {
    active: "data-[interaction-state~=active]:shadow-[inset_2px_0_0_var(--color-accent-operational)]",
    "ai-active": "data-[interaction-state~=ai-active]:shadow-[inset_2px_0_0_var(--prim-blue-700)]",
    critical: "data-[interaction-state~=critical]:border-[var(--color-status-critical-border)]",
    focus: "data-[interaction-state~=focus]:shadow-[inset_2px_0_0_var(--color-border-focus)]",
    locked: "data-[interaction-state~=locked]:opacity-90",
    pending: "data-[interaction-state~=pending]:border-[var(--color-status-pending-border)]",
    selected: "data-[interaction-state~=selected]:shadow-[inset_2px_0_0_var(--color-accent-operational)]",
  },
  input: {
    "ai-active":
      "data-[interaction-state~=ai-active]:border-[var(--color-border-focus-ai)] data-[interaction-state~=ai-active]:shadow-[0_0_0_var(--focus-ring-width)_rgba(47,110,232,0.22)]",
    active: "data-[interaction-state~=active]:border-[var(--color-border-strong)]",
    critical:
      "data-[interaction-state~=critical]:border-[var(--color-status-critical)] data-[interaction-state~=critical]:shadow-[0_0_0_var(--focus-ring-width)_rgba(220,38,38,0.22)]",
    disabled: "data-[interaction-state~=disabled]:cursor-not-allowed data-[interaction-state~=disabled]:opacity-60",
    focus:
      "data-[interaction-state~=focus]:border-[var(--color-border-focus)] data-[interaction-state~=focus]:shadow-[0_0_0_var(--focus-ring-width)_rgba(224,140,15,0.22)]",
    hover: "data-[interaction-state~=hover]:border-[var(--color-border-strong)]",
    loading: "data-[interaction-state~=loading]:cursor-wait",
    locked:
      "data-[interaction-state~=locked]:border-[var(--color-border-subtle)] data-[interaction-state~=locked]:bg-[var(--color-surface-primary)] data-[interaction-state~=locked]:text-[var(--color-text-muted)]",
    reviewed: "data-[interaction-state~=reviewed]:shadow-[inset_0_0_0_1px_var(--prim-blue-700)]",
    success: "data-[interaction-state~=success]:border-[var(--color-status-ok-border)]",
    warning: "data-[interaction-state~=warning]:border-[var(--color-status-warning-border)]",
  },
  popover: {
    active: "data-[interaction-state~=active]:shadow-[var(--shadow-lg)]",
    critical: "data-[interaction-state~=critical]:border-[var(--color-status-critical-border)]",
    reviewed: "data-[interaction-state~=reviewed]:border-[var(--prim-blue-800)]",
    warning: "data-[interaction-state~=warning]:border-[var(--color-status-warning-border)]",
  },
  "resize-handle": {
    active: "data-[interaction-state~=active]:opacity-100",
    disabled: "data-[interaction-state~=disabled]:cursor-not-allowed data-[interaction-state~=disabled]:opacity-40",
    hover: "data-[interaction-state~=hover]:opacity-100",
    locked: "data-[interaction-state~=locked]:opacity-40",
    pressed: "data-[interaction-state~=pressed]:opacity-100",
  },
  row: {
    "ai-active": "data-[interaction-state~=ai-active]:shadow-[inset_2px_0_0_var(--prim-blue-700)]",
    critical: "data-[interaction-state~=critical]:bg-[rgba(220,38,38,0.06)] data-[interaction-state~=critical]:shadow-[inset_2px_0_0_var(--prim-red-500)]",
    disabled: "data-[interaction-state~=disabled]:opacity-60",
    hover: "data-[interaction-state~=hover]:bg-[var(--table-row-bg-hover)]",
    locked: "data-[interaction-state~=locked]:opacity-70",
    pending: "data-[interaction-state~=pending]:shadow-[inset_2px_0_0_var(--prim-amber-600)]",
    reviewed: "data-[interaction-state~=reviewed]:shadow-[inset_2px_0_0_var(--prim-blue-700)]",
    selected: "data-[interaction-state~=selected]:bg-[var(--table-row-bg-selected)]",
    success: "data-[interaction-state~=success]:shadow-[inset_2px_0_0_var(--prim-green-700)]",
    warning: "data-[interaction-state~=warning]:bg-[rgba(224,140,15,0.06)] data-[interaction-state~=warning]:shadow-[inset_2px_0_0_var(--prim-amber-500)]",
  },
  surface: {
    "ai-active": "data-[interaction-state~=ai-active]:border-[var(--prim-blue-700)] data-[interaction-state~=ai-active]:shadow-[inset_2px_0_0_var(--prim-blue-700)]",
    active: "data-[interaction-state~=active]:shadow-[inset_2px_0_0_var(--color-accent-operational)]",
    critical: "data-[interaction-state~=critical]:border-[var(--color-status-critical-border)] data-[interaction-state~=critical]:shadow-[inset_2px_0_0_var(--color-status-critical)]",
    disabled: "data-[interaction-state~=disabled]:opacity-60",
    focus: "data-[interaction-state~=focus]:shadow-[inset_2px_0_0_var(--color-border-focus)]",
    loading: "data-[interaction-state~=loading]:opacity-90",
    locked: "data-[interaction-state~=locked]:border-[var(--color-border-subtle)]",
    pending: "data-[interaction-state~=pending]:border-[var(--color-status-pending-border)] data-[interaction-state~=pending]:shadow-[inset_2px_0_0_var(--color-status-pending)]",
    reviewed: "data-[interaction-state~=reviewed]:shadow-[inset_2px_0_0_var(--prim-blue-700)]",
    selected: "data-[interaction-state~=selected]:shadow-[inset_2px_0_0_var(--color-accent-operational)]",
    success: "data-[interaction-state~=success]:border-[var(--color-status-ok-border)]",
    warning: "data-[interaction-state~=warning]:border-[var(--color-status-warning-border)]",
  },
  toolbar: {
    "ai-active": "data-[interaction-state~=ai-active]:border-[var(--prim-blue-800)]",
    active: "data-[interaction-state~=active]:shadow-[inset_0_-1px_0_var(--color-accent-operational)]",
    reviewed: "data-[interaction-state~=reviewed]:shadow-[inset_0_-1px_0_var(--prim-blue-700)]",
    warning: "data-[interaction-state~=warning]:border-[var(--color-status-warning-border)]",
  },
  viewport: {
    active: "data-[interaction-state~=active]:shadow-[inset_0_0_0_1px_var(--color-border-strong)]",
    critical: "data-[interaction-state~=critical]:shadow-[inset_0_0_0_1px_var(--color-status-critical-border)]",
    focus: "data-[interaction-state~=focus]:shadow-[inset_0_0_0_1px_var(--color-border-focus)]",
    locked: "data-[interaction-state~=locked]:opacity-95",
    reviewed: "data-[interaction-state~=reviewed]:shadow-[inset_0_0_0_1px_var(--prim-blue-700)]",
    selected: "data-[interaction-state~=selected]:shadow-[inset_0_0_0_1px_var(--color-accent-operational-border)]",
    warning: "data-[interaction-state~=warning]:shadow-[inset_0_0_0_1px_var(--color-status-warning-border)]",
  },
};
