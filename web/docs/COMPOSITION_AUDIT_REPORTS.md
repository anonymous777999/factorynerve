# Composition Audit — reports-page.tsx

**Status:** ⬜ Not refactored (Phase 2 candidate)

## Shell Usage
- Uses `OperationalPageShell` ✅ (contentClassName: `mx-auto max-w-7xl`)

## Loading State
- Uses dedicated `ReportsPageSkeleton` ✅ — good adoption of existing primitive.

## Issues Found

### Custom CSS Variable Overrides
- Defines its own CSS-variable-based class strings:
  ```tsx
  const reportPanelClass = "rounded-[1.5rem] border-[0.5px] border-[color:var(--color-border-secondary)] bg-[var(--color-background-secondary)] shadow-[var(--shadow-soft)]";
  const reportInsetClass = "rounded-[1rem] border-[0.5px] border-[color:var(--color-border-tertiary)] bg-[var(--color-background-primary)]";
  ```
  These use `var(--color-border-*)` and `var(--color-background-*)` tokens that may not be in the design system. Should use standard `border-border-default` and `bg-surface-*` tokens.

### Composition Fragmentation
- **Connected lanes**: Raw `details`/`summary` with `reportPanelClass`. Should be `DisclosurePanel`.
- **Range + Export**: Mixed `GlassPanel` + `Card` in a two-column grid. Range controls use `Field`/`Input` directly.
- **Trust and insights**: Raw `details`/`summary`. Contains `ReportInsightsBoard` (properly extracted) + OCR trust Card.
- **Executive summary**: Raw `details`/`summary` containing `Card` with AI summary.
- **Results table**: `Card` with pagination controls, table, and row actions.
- **DisclosurePanel**: Used once for "More" links ✅ — should extend to other collapsible sections.

### Status Class Patterns
- `text-status-danger-fg`, `text-status-success-fg`, `text-status-info-fg`, `text-status-warning-fg` used inline for error banners, status messages, OCR trust cards. Could use `textClass()`.
- `border-status-danger-border bg-status-danger-bg` used for error banners. Could use `toneClass("danger")`.
- No custom badge/tone functions found ✅.

### Spacing
- `var(--space-xl)`, `var(--space-md)` — uses CSS variable spacing which may not be standard.
- `px-4 py-4`, `p-4`, `px-4 py-3` — consistent within the file but not necessarily aligned with semantic spacing.

## Refactor Priority
Medium — uses ReportsPageSkeleton ✅ but has custom CSS variable tokens that bypass the design system. Heavy use of raw `details`/`summary` instead of primitives.
