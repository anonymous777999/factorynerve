# Composition Audit — ai-insights-page.tsx

**Status:** ⬜ Not refactored (Phase 2 candidate)

## Shell Usage
- Uses `OperationalPageShell` ✅ (contentClassName: `mx-auto max-w-7xl space-y-6`)

## Issues Found

### Loading State
- Custom loading skeleton outside `OperationalPageShell.isLoading`:
  ```tsx
  <main className="min-h-screen px-4 py-8 md:px-8">
  ```
  Should use `OperationalPageShell`'s built-in `isLoading` prop instead.

### Composition Fragmentation
- **Quota section**: Raw `details`/`summary` with custom classes (`rounded-[2rem] shadow-[var(--shadow-xl)]`). Should be `DisclosurePanel` or `SectionPanel`.
- **NLQ card**: `Card` + raw `details`/`summary` for presets, query details, data points. Mixed nesting.
- **Anomaly alerts**: Raw `details`/`summary` with same custom rounded/shadow. Should be `SectionPanel`.

### Spacing Inconsistencies
- `rounded-[2rem]` — non-standard radius
- `shadow-[var(--shadow-xl)]` — custom shadow token
- `bg-[color-mix(in_srgb,var(--surface-panel),transparent_8%)]` — custom background mix
- `px-6 py-5` on summary headers, `px-4 py-4` on details content

### Status Class Patterns
- Uses `summaryHealth.badgeClass` and `summaryHealth.barClass` from `quota-health.ts` — these appear to be properly delegated to shared utilities. No inline status class issues found.

## Refactor Priority
Medium — well-structured but uses raw `details`/`summary` instead of proper primitives. Loading state bypasses OperationalPageShell.
