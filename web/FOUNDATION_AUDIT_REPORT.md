# Phase 1.0 — Foundation Audit Report

Generated: automated scan
Scope: shared/ primitives, forms, operational, tables + components/ui

---

## 1. Primitive Inventory

### 1.1 shared/primitives/ (14 files + 1 orphaned)

| Component | Status | Loading | Disabled | Focus | Aria | Variants | Notes |
|---|---|---|---|---|---|---|---|
| Button | ✅ | `isBusy` + spinner | ✅ `disabled` | `focus-visible` | `aria-busy` | primary/secondary/outline/ghost/destructive + default/compact/icon | outline maps to secondary at runtime — duplicate |
| Badge | ✅ | — | — | — | — | 10 statuses (success/warning/info/.../error) + compact/standard | ✅ clean |
| Card | ✅ | — | — | — | — | interactive via `group` class | No base loading/empty state; aria not wired |
| Input | ✅ | — | ✅ | via Field | `aria-invalid`, `aria-describedby` | validation states via Field | ✅ clean |
| Select | ✅ | — | ✅ | via Field | `aria-invalid`, `aria-describedby` | validation states via Field | ✅ clean |
| Textarea | ✅ | — | ✅ | via Field | `aria-invalid`, `aria-describedby` | validation states via Field | ✅ clean |
| Skeleton | ✅ | n/a | — | — | — | — | ✅ clean |
| label.tsx | ⚠️ | — | — | — | — | — | Re-exports from field.tsx — not a standalone component |
| safe-text | ✅ | — | — | — | — | — | ✅ clean |
| status-badge | ✅ | — | — | — | — | 9 tones → Badge statuses | Thin wrapper — could merge into Badge |
| confidence-badge | ✅ | — | — | — | — | high/medium/low | Duplicates Badge concept |
| combobox | ✅ | — | ✅ | `focus-visible` | role, aria-*, full set | — | ✅ excellent accessibility |
| glass-panel | ✅ | — | — | — | — | default/subtle/elevated/accent | Visual overlap with Card |
| tab-nav | ✅ | — | ✅ tab | `aria-current` | `aria-label` | surface/inline | ✅ clean |
| data-table-header | ⚠️ | — | — | — | — | — | **ORPHANED** — copied but not in any barrel |

### 1.2 shared/forms/ (5 files)

| Component | Status | Notes |
|---|---|---|
| Field | ✅ | Full validation context, `useFieldContext`, `getFieldControlClassName` |
| FormField | ? | Not audited |
| FormWrapper | ? | Not audited |
| PasswordVisibilityToggle | ? | Not audited |
| PanelToggleButton | ? | Not audited |

**Issue:** `Field.Label`, `Input`, `Select`, `Textarea` re-exported from primitives barrel AND forms barrel — dual source of truth for `Label`.

### 1.3 shared/operational/ (23 files)

| Component | Status | Notes |
|---|---|---|
| WorkstationShell | ✅ | Page-level layout shell — clean |
| OperationalPageShell | ? | Not audited |
| QueueWorkspaceLayout | ? | Not audited |
| OperationalDrawer | ? | Not audited |
| SectionPanel | ✅ | Panel container — clean |
| StickyActionBar | ? | Not audited |
| FilterBar | ? | Not audited |
| MetricStrip | ? | Not audited |
| ActionDock | ? | Not audited |
| EmptyState | ✅ | Loading-free, clean container — no loading variant |
| EmptyOperationalState | ? | Not audited |
| LoadingBoundary | ✅ | Handles loading/error/empty/fetching states — well-designed |
| ResponsiveScrollArea | ? | Not audited |
| GuidanceBlock | ? | Not audited |
| WorkflowPanel | ? | Not audited |
| RecoveryBanner | ? | Not audited |
| ConfirmationModal | ? | Not audited |
| CommandPalette | ? | Not audited |
| PageMain | ? | Not audited |
| OperationalTable | ? | Not audited |
| LoginOne | ? | Page-specific component — not generic |
| RouteHeader | ✅ | Pre-existing — clean |
| DisclosurePanel | ✅ | Pre-existing — clean |

### 1.4 shared/tables/ (8 files)

| Component | Status | Notes |
|---|---|---|
| DataTable | ✅ | TanStack-based — uses inline `style` for dynamic heights |
| DataTableTypes | ✅ | Type definitions |
| DataTableToolbar | ? | Not audited |
| DataTableBulkToolbar | ? | Not audited |
| DataTableFilterCell | ? | Not audited |
| DataTableSortButton | ? | Not audited |
| UseDataTableKeyboard | ✅ | Keyboard navigation hook |
| UseDensityMetric | ✅ | Density measurement hook |

---

## 2. Duplicate Detection

| Duplicate Pair | Severity | Recommendation |
|---|---|---|
| `outline` Button variant → maps to `secondary` | 🟡 MEDIUM | Remove `outline`, consumers should use `secondary` |
| `ConfidenceBadge` vs `Badge` | 🟡 MEDIUM | `ConfidenceBadge` is a specialized Badge — merge as `Badge` variant or keep as thin wrapper |
| `StatusBadge` vs `Badge` | 🟢 LOW | Thin wrapper is fine — keeps status-tone mapping centralized |
| `GlassPanel` vs `Card` | 🟢 LOW | Different visual purposes (glass vs solid) — keep separate |

---

## 3. Hardcoded Color Values

| File | Value | Severity | Fix |
|---|---|---|---|
| `src/features/profile/profile-page.tsx` | `rgb(62,166,255)` | 🟡 MEDIUM | Replace with `--interactive-accent` or `--color-accent-operational` |
| `src/lib/quota-health.ts` | `#fb7185`, `#ef4444`, `#f59e0b`, `#f97316`, `#34d399`, `#22c55e` | 🟡 MEDIUM | Replace with status/chart tokens |
| `src/lib/razorpay.ts` | `#0F6E56` | 🟢 LOW | Replace with `--color-accent` |
| `src/app/layout.tsx` | `#111714`, `#F9F8F5` | 🟢 LOW | These are theme-color meta tags — acceptable |
| `src/stories/Header.tsx` | `#FFF`, `#555AB9`, `#91BAF8`, `#999` | 🟢 LOW | Storybook only — acceptable |

**Total hardcoded colors:** ~11 values across 5 files

---

## 4. Arbitrary Tailwind Values

| Pattern | Count (approx) | Severity | Recommendation |
|---|---|---|---|
| `text-[11px]` | ~30+ uses | 🟡 MEDIUM | Missing typography token — add `--text-2xs: 11px` |
| `tracking-[0.14em]` / `[0.16em]` / `[0.18em]` | ~20+ uses | 🟡 MEDIUM | Missing tracking tokens — add `--tracking-label` etc. |
| `border-[0.5px]` | ~5 uses | 🟢 LOW | Add `--border-width-thin: 0.5px` |
| `min-h-[38px]` | ~10 uses | 🟢 LOW | Use `--density-input-height` consistently |
| `w-[16.5rem]` | sparse | 🟢 LOW | Add layout token |
| `top-[calc(...)]` / `bottom-[calc(...)]` | moderate | 🟢 LOW | Legitimate for dynamic positioning |
| `max-w-[320px]` / `max-w-[48ch]` | ~5 uses | 🟢 LOW | Add content-width tokens |
| `text-[14px]` | moderate | 🟡 MEDIUM | Should be `text-sm` or `text-base` |

**Estimated total arbitrary values:** 80-100 across ~30 files

---

## 5. Inline Styles (Governance Violations)

| File | Property | Severity | Recommendation |
|---|---|---|---|
| `shared/primitives/button.tsx` | `color: var(--spinner-color)` | 🟢 LOW | Acceptable for SVG — CSS-only would require complex class |
| `shared/tables/data-table/data-table.tsx` | `height` (dynamic) | 🟢 LOW | Acceptable for virtualized row height |
| `shared/ai/anomaly-strip.tsx` | `background`, `color` | 🟡 MEDIUM | Move to CSS class with token references |
| `shared/ai/confidence-meter.tsx` | `background` | 🟡 MEDIUM | Move to CSS class |
| `shared/audit/audit-timeline.tsx` | `background` | 🟡 MEDIUM | Move to CSS class |

---

## 6. Accessibility Audit

### ✅ Good
- `focus-visible` ring on all interactive elements (Button, Combobox, TabNav)
- `aria-busy` on Button (loading) and LoadingBoundary (fetching)
- `aria-invalid` + `aria-describedby` on form controls
- Full ARIA combobox pattern (role, expanded, autocomplete, activedescendant, listbox)
- `aria-current="page"` on TabNav
- `role="alert"` for error states
- `role="status"` for loading states

### ❌ Missing / Needs Improvement

| Issue | Location | Severity | Fix |
|---|---|---|---|
| `role="button"` missing | Card (interactive mode) | 🟡 MEDIUM | Add `role="button"` + `tabIndex={0}` + keyboard handler |
| No `aria-label` | Button (icon-only variant) | 🟡 MEDIUM | Add `aria-label` when children is only icon |
| No reduced-motion check | Skeleton | 🟢 LOW | Respect `prefers-reduced-motion` for shimmer |
| No keyboard dismiss | GlassPanel / Drawer | 🟡 MEDIUM | Add `Escape` handler for overlay components |
| No loading announcement | Skeleton | 🟢 LOW | Add `aria-busy="true"` + `aria-label="Loading"` |
| Focus indicator missing for dark mode | All components | 🟡 MEDIUM | Verify `focus-visible:ring` uses theme-aware tokens |

---

## 7. Summary

| Metric | Value |
|---|---|
| Total components in shared/ | ~52 (14 primitives + 5 forms + 23 operational + 8 tables + 2 pre-existing) |
| Components audited | 20 (primitives + key operational) |
| Duplicate components | 2 (ConfidenceBadge duplicates Badge; outline button maps to secondary) |
| Hardcoded colors | ~11 values across 5 files |
| Arbitrary Tailwind values | ~80-100 across ~30 files |
| Inline styles (governance violations) | 5 |
| Accessibility issues | 6 identified |
| Orphaned files | 1 (data-table-header.tsx in primitives) |
| Label dual-source | 1 (primitives exports label.tsx, forms exports field.tsx's Label) |
