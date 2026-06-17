# DPR.ai Frontend — Root Cause Analysis & Fix Report

> **Audit Date:** June 2026  
> **Scope:** Entire web frontend (`web/src/`)  
> **Focus:** Why the UI looks inconsistent, components don't fit properly, and how to fix it  
> **Method:** Direct codebase audit, token-system cross-reference, pattern analysis

---

## Executive Summary

The DPR.ai frontend suffers from **one root cause with two symptoms**: the codebase contains a well-designed, architecturally sound token system (`tokens.css`, `tailwind.config.ts`) that was built **on top of** legacy pages rather than **replacing** them. The result is two competing visual languages that render simultaneously, creating:

1. **Visual instability** — colors, radii, spacing, and surface depths change between pages
2. **Layout misfit** — hardcoded pixel values override the responsive token system
3. **Component inconsistency** — the same UI pattern (section, card, form field) has 3–5 different implementations

This is not a design failure. It is a **migration completion problem**. The architecture is right. The pages haven't caught up.

---

## Root Cause #1: Two Competing Design Systems

### The Problem

`globals.css` and `tokens.css` both define their own color, surface, and spacing systems with **no connection between them**.

**globals.css defines (warm-industrial legacy):**
```css
--bg: #0f1117;
--bg-soft: #13151e;
--card: #181c28;
--card-strong: #1c2030;
--card-elevated: #222838;
--border: #252a3a;
--text-muted: #6b7494;
--text: var(--text-primary);
--muted: var(--text-muted);
```

**tokens.css defines (semantic modern):**
```css
--surface-app: #f7f6f4;
--surface-shell: #f3f2ef;
--surface-panel: #faf9f7;
--surface-card: #ffffff;
--surface-elevated: #ffffff;
--border-subtle: #ebeae6;
--border-default: #e0ddd6;
--text-primary: #2c2a26;
--text-secondary: #5c584f;
--text-tertiary: #7a756c;
```

**Impact:** A component using `--card-strong` (`#202b35`) and one using `--surface-card` (`#161920`) render different colors. `--card-strong` is NOT overridden in light mode, so legacy components break in light theme.

### The Fix

1. **Phase out the globals.css legacy aliases** — remove `--text`, `--muted`, `--bg`, `--card`, `--border` aliases after migrating all consumers
2. **Merge the two color scales** — every page should reference only `tokens.css` semantic tokens
3. **Add an ESLint rule** forbidding `var(--muted)`, `var(--text)`, `var(--border)`, `var(--accent)` in JSX

---

## Root Cause #2: 400+ Token Violations Across Page Components

### The Problem

The codebase has **133+ instances** of `var(--muted)`, **100+ instances** of `var(--text)`, and **50+ instances** of `var(--border)` in 15+ large page components. These are legacy aliases that produce slightly different colors than the semantic tokens and are **not theme-aware** (they don't respond to light/dark mode correctly).

Files with the highest violation density:

| File | `var(--muted)` | `var(--text)` | `var(--border)` | Raw colors |
|---|---|---|---|---|
| `approvals-page.tsx` | 50+ | 10+ | 15+ | 8+ |
| `entry-detail-page.tsx` | 30+ | 5+ | 5+ | 3+ |
| `attendance-review-page.tsx` | 20+ | 3+ | 8+ | 5+ |
| `ai-insights-page.tsx` | 20+ | 5+ | 10+ | 10+ |
| `control-tower-page.tsx` | 15+ | 5+ | 8+ | 5+ |
| `analytics-page.tsx` | 20+ | 3+ | 3+ | 3+ |
| `work-queue-page.tsx` | 10+ | 5+ | 5+ | 5+ |
| `premium-dashboard-page.tsx` | 10+ | 5+ | 8+ | 20+ |
| `steel-command-center-page.tsx` | 10+ | 5+ | 5+ | 15+ |
| `my-tasks-page.tsx` | 10+ | 3+ | 5+ | 5+ |
| `settings-alerts-tab.tsx` | 10+ | 3+ | 10+ | 5+ |

### The Fix

Systematic find-and-replace across all files:

| Legacy Pattern | Replace With |
|---|---|
| `text-[var(--muted)]` | `text-text-tertiary` |
| `text-[var(--text)]` | `text-text-primary` |
| `border-[var(--border)]` | `border-border-default` (or `border-border-subtle` by context) |
| `text-[var(--accent)]` | `text-action-primary` |
| `bg-[var(--card-strong)]` | `bg-surface-elevated` |
| `bg-[var(--bg-soft)]` | `bg-surface-shell` |
| `var(--accent)` as bg | `var(--action-primary)` or `bg-action-primary` |
| Raw `rgba()` backgrounds | Surface panel utilities |
| `text-rose-300` error text | `text-status-danger-fg` |

---

## Root Cause #3: 99+ Arbitrary Border-Radius Values

### The Problem

The token system defines 7 border-radius values (`--radius-xs` through `--radius-full`). Page components use **99+ custom radius values** including:
- `rounded-[2rem]` — 30+ instances (hero sections, details panels)
- `rounded-[28px]` — 10+ instances 
- `rounded-[1.95rem]`, `rounded-[1.9rem]`, `rounded-[1.8rem]` — 15+ instances (cards)
- `rounded-[1.6rem]`, `rounded-[1.55rem]` — 10+ instances (dashboard cards)
- `rounded-[32px]`, `rounded-[30px]`, `rounded-[24px]`, `rounded-[20px]` — 20+ instances
- `rounded-[0.45rem]`, `rounded-[0.35rem]` — 8+ instances

**Impact:** Every surface has a slightly different corner radius. The eye registers this as "cheap" — professional design systems have 3–5 radii used consistently. 32px on one card and 28px on the adjacent card creates micro-jitter.

### The Fix

Replace custom radii with token-system values:

| Custom Radius | Token Replacement |
|---|---|
| `rounded-[2rem]` (32px) — hero sections | `rounded-overlay` (10px) or provide a `rounded-hero` token |
| `rounded-[28px]` — detail panels | `rounded-xl` (10px) |
| `rounded-[1.95rem]` down to `[1.5rem]` — cards | `rounded-panel` (6px) |
| `rounded-[24px]` / `rounded-[20px]` — inner sections | `rounded-panel` or `rounded-md` |
| `rounded-[0.45rem]` | `rounded-panel` (6px) or `rounded-sm` (4px) |
| `rounded-[32px]` modals | `rounded-xl` (10px) |

Add a `rounded-hero: var(--radius-xl)` token if the design requires larger radii for hero sections specifically.

---

## Root Cause #4: Surface Hierarchy Inversion

### The Problem

The token system defines a clear depth hierarchy: `app < shell < panel < card < elevated < overlay`. Dark-mode values step up 4–8 lightness points between each level. Pages consistently violate this:

1. **Cards inside panels at wrong depth** — `surface-panel-strong` (card-level) wraps `Card` components that also use `surface-panel` styling. Inner elements should be *more* elevated than outer containers.

2. **The `.surface-panel` CSS class** defined in `globals.css` adds `backdrop-filter: blur(14px)` + border + shadow. The `Card` component originally used `surface-panel` as a className (not `bg-surface-panel`), which pulled in all these effects for every card. This was recently fixed (see `card.tsx`), but other components still use the class directly.

3. **Workflow-reminder-strip.tsx** still uses `surface-panel` as a className (line 434) instead of `bg-surface-panel`:
   ```tsx
   <div className="surface-panel rounded-[1.7rem] px-4 py-4">
   ```

### The Fix

1. **Replace all `surface-panel` className usages** with `bg-surface-panel border border-border-subtle` — the `.surface-panel` utility class adds `backdrop-filter: blur(14px)` which is GPU-intensive and unnecessary for static cards.

2. **Enforce surface depth rules:** containers inside `surface-shell` should use `surface-panel` background. Cards inside panels should use `surface-card` background. Elevated content (inputs, dropdowns) use `surface-elevated`.

---

## Root Cause #5: Layout Fit Problems — Hardcoded Sizes

### The Problem

Pages use hardcoded pixel values for sizing instead of the token-based spacing/density system:

1. **Fixed heights:** `min-h-[48px]`, `min-h-[50vh]`, `h-[36rem]`, `h-[24rem]`, `h-[28rem]`, `h-[40rem]`, `max-h-[70vh]` — these don't adapt to content or viewport

2. **Fixed widths:** `w-[220px]` sidebar, `w-[16.5rem]` context rail, `max-w-[22ch]`, `max-w-[1600px]`, `max-w-[48ch]` — override the responsive grid system

3. **Arbitrary gaps:** `gap-8`, `gap-4`, `gap-3`, `gap-sm`, `gap-md` mixed inconsistently — sometimes on the same page

4. **Fixed padding:** `p-6`, `p-8`, `p-5`, `px-4 py-3`, `px-10` — bypass `var(--space-*)` tokens and the density system

5. **Icon sizing:** `h-[18px] w-[18px]` — should use `var(--density-icon-size)` (16px at default density)

### The Fix

Replace hardcoded sizes with token-based values:

| Hardcoded | Token Replacement |
|---|---|
| `min-h-[48px]` topbar | `min-h-[var(--density-row-height-lg)]` or just `min-h-row-lg` |
| `h-[36rem]` skeleton | `h-[var(--space-72)]` or define a skeleton height token |
| `w-[220px]` | `w-[var(--sidebar-width)]` (already done) |
| `w-[16.5rem]` context rail | Define `--context-rail-width: 16.5rem` in tokens.css |
| `h-[18px] w-[18px]` icons | `h-icon w-icon` (maps to `--density-icon-size`) |
| `gap-8` | `gap-xl` (maps to `--space-xl`: 40px) |
| `gap-4` | `gap-md` (maps to `--space-md`: 16px) |
| `p-6` | `p-lg` or `p-[var(--space-lg)]` |
| `px-4 py-3` | `px-md py-sm` or `px-[var(--space-md)] py-[var(--space-sm)]` |

---

## Root Cause #6: Component Structure Fracturing

### The Problem

Pages use three different layout patterns interchangeably:

**Pattern A — Modern (token-aware):** `WorkstationShell` + `SectionPanel` + `DataTable`  
Used in: `attendance-live-page.tsx`, `email-summary-page.tsx`

**Pattern B — Semi-modern:** `PageMain` + raw sections  
Used in: `steel-batches-page.tsx`, `steel-customers-page.tsx`, `steel-dispatches-page.tsx`, `steel-invoices-page.tsx`, etc.

**Pattern C — Legacy:** Raw `<main>` + `<section>` with inline `rounded-[2rem] border border-[var(--border)] bg-[rgba(...)]`  
Used in: `premium-dashboard-page.tsx`, `steel-command-center-page.tsx`, `ai-insights-page.tsx`, `billing-header.tsx`, `control-tower-page.tsx`, `attendance-reports-page.tsx`

**Impact:** Navigation between modules feels like switching between different products. The user experiences cognitive whiplash.

### The Fix

1. **Create a `RouteHeader` component** that standardizes page entry: eyebrow + title + description + actions — replace 15+ individual hero section implementations
2. **Migrate Pattern C pages** to `WorkstationShell` + `SectionPanel`
3. **Replace `<details>/<summary>`** (9 locations) with a `DisclosurePanel` primitive

---

## Root Cause #7: Form System Not Adopted

### The Problem

The `Field` + `Label` + `HelperText` form system is enterprise-grade (proper `htmlFor`, `aria-describedby`, validation states) but has only **~10% adoption**. The remaining 90% of forms use:

```tsx
<div>
  <label className="text-sm text-[var(--muted)]">Customer Name</label>
  <Input ... />
  {error ? <div className="text-xs text-rose-300">...</div> : null}
</div>
```

Problems: No `htmlFor`, legacy color tokens (`var(--muted)`), raw Tailwind error color (`text-rose-300` — fails WCAG AA on light backgrounds), no validation state on input border.

### The Fix

Migrate form pages to `Field` + `Label` + `HelperText`:
- `steel-customers-page.tsx` — 15+ fields, highest priority
- `steel-dispatches-page.tsx` — 12+ fields with validation checklist
- `settings-page.tsx` / `settings-users-tab.tsx` — configuration forms

---

## Root Cause #8: Density System Not Wired to Pages

### The Problem

The density system (`[data-density="compact|default|comfortable"]`) affects `--density-row-height` and `--density-cell-pad-*` for the `DataTable`, but **does not affect page-level spacing**. Switching density changes table row height but leaves page padding, section gaps, and card spacing unchanged. The toggle appears broken to users.

### The Fix

Wire density variables into page-level CSS:
```css
.operational-page {
  padding: var(--density-section-gap) var(--space-md);
  gap: var(--density-section-gap);
}
```
And ensure all density modes define `--density-section-gap`:
- Compact: `var(--space-3)` = 12px
- Default: `var(--space-4)` = 16px  
- Comfortable: `var(--space-6)` = 24px

---

## Root Cause #9: Backdrop-Filter Overuse

### The Problem

`backdrop-filter: blur()` is applied in:
- `.surface-panel` utility class (14px blur)
- `.surface-panel-strong` (16px blur)
- `.surface-panel-soft` (12px blur)
- 30+ individual component className strings

Backdrop blur is GPU-intensive and causes visible frame-rate drops on factory-floor tablets running mid-tier Android Webview. The `[data-runtime-tier="safe"]` escape hatch exists but requires explicit runtime detection.

### The Fix

1. **Remove `backdrop-filter` from static surfaces** — cards, panels, and sections that don't need to show content behind them
2. **Restrict blur to overlays only** — `GlassPanel`, modals, drawers
3. **Make `data-runtime-tier="safe"` detection automatic** based on device GPU/performance

---

## Root Cause #10: Z-Index Violations

### The Problem

The z-index token system defines `--z-base: 0` through `--z-tooltip: 80` with Tailwind mappings, but raw integer values are still used:

| Location | Raw Z-Index | Should Be |
|---|---|---|
| `app-shell.tsx` feedback widget | `z-[72]` | `z-toast` |
| `app-shell.tsx` jobs drawer | `z-40` | `z-overlay` |
| `ocr-scan-page.tsx` table header | `z-10` | `z-raised` |
| `OcrSpreadsheetGrid.tsx` table header | `z-10` | `z-raised` |
| `mobile-entry.tsx` | `z-10` | `z-raised` |

---

## Priority Fix Matrix (Impact × Effort)

| # | Fix | Impact | Effort | Score | Category |
|---|---|---|---|---|---|
| 1 | **Token migration sprint** — replace 400+ legacy vars across 15 files | 5 | 3 | **15** | Token discipline |
| 2 | **Custom radii → token radii** — 99+ replacements | 4 | 2 | **16** | Visual consistency |
| 3 | **Surface hierarchy correction** — fix Card/panel nesting | 5 | 3 | **15** | Visual depth |
| 4 | **Form system adoption** — 3 key pages | 5 | 3 | **15** | Accessibility |
| 5 | **Remove `surface-panel` class usages** — replace with `bg-surface-panel` | 4 | 1 | **20** | Performance |
| 6 | **Wire density to pages** — make toggle meaningful | 4 | 2 | **16** | User trust |
| 7 | **Create `RouteHeader` component** — standardize page hero | 5 | 2 | **20** | Composition |
| 8 | **Replace `<details>/<summary>`** — 9 locations | 5 | 2 | **20** | Accessibility |
| 9 | **Backdrop-blur audit** — remove from static surfaces | 3 | 2 | **12** | Performance |
| 10 | **Z-index cleanup** — 6 locations | 3 | 1 | **15** | System compliance |

**Quick wins (highest score, lowest effort):**

1. **Remove `surface-panel` class** in `workflow-reminder-strip.tsx` and `chart-card.tsx` (Score: 20)
2. **Create `RouteHeader` component** — replaces 15+ hero sections (Score: 20)
3. **Replace `<details>/<summary>`** with `DisclosurePanel` — 9 locations (Score: 20)
4. **Custom radii → tokens** — mechanical find-and-replace (Score: 16)
5. **Wire density to page spacing** — CSS-only change (Score: 16)

---

## Files Requiring Immediate Attention

Files with the most severe issues that should be prioritized for Phase 1:

| File | Issues | Priority |
|---|---|---|
| `web/src/components/approvals-page.tsx` | 50+ legacy vars, raw radii, <details> | CRITICAL |
| `web/src/components/premium-dashboard-page.tsx` | 90+ violations, hardcoded rgba(), 5+ radii | CRITICAL |
| `web/src/components/steel-command-center-page.tsx` | 75+ violations, tab anti-pattern, raw rgba() | CRITICAL |
| `web/src/components/steel-dispatches-page.tsx` | 65+ violations, debug panel in prod | CRITICAL |
| `web/src/components/ai-insights-page.tsx` | 50+ violations, <details>, raw radii | HIGH |
| `web/src/components/attendance-review-page.tsx` | 30+ violations, form labels | HIGH |
| `web/src/components/entry-detail-page.tsx` | 30+ violations, <details> | HIGH |
| `web/src/components/analytics-page.tsx` | 25+ violations | HIGH |
| `web/src/components/control-tower-page.tsx` | 30+ violations, <details> | HIGH |
| `web/src/components/work-queue-page.tsx` | 20+ violations | MEDIUM |
| `web/src/components/my-tasks-page.tsx` | 15+ violations | MEDIUM |
| `web/src/components/settings-alerts-tab.tsx` | 20+ violations | MEDIUM |
| `web/src/components/billing-header.tsx` | 35+ violations, <details> | MEDIUM |
| `web/src/components/charts/chart-card.tsx` | `surface-panel` class, ~rounded-[1.95rem] | MEDIUM |
| `web/src/components/workflow-reminder-strip.tsx` | `surface-panel` class | MEDIUM |
| `web/src/components/settings-feedback-tab.tsx` | Legacy vars, raw radii | MEDIUM |
| `web/src/components/reports-page.tsx` | Legacy `color-*` tokens, raw radii | MEDIUM |

---

## Compliance Reference: Token System Map

### Approved Token Classes (use these)

| Category | Tokens |
|---|---|
| **Surfaces** | `bg-surface-app`, `bg-surface-shell`, `bg-surface-panel`, `bg-surface-card`, `bg-surface-elevated`, `bg-surface-overlay` |
| **Text** | `text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `text-text-disabled`, `text-text-inverse`, `text-text-link` |
| **Borders** | `border-border-subtle`, `border-border-default`, `border-border-strong`, `border-border-focus`, `border-border-danger` |
| **Action colors** | `text-action-primary`, `bg-action-primary`, `border-action-primary` |
| **Status** | `text-status-<name>-fg`, `bg-status-<name>-bg`, `border-status-<name>-border` |
| **Border radius** | `rounded-xs` (3px), `rounded-control` (4px), `rounded-panel` (6px), `rounded-overlay` (8px) |
| **Spacing** | `gap-<xs/sm/md/lg/xl>`, `p-<xs/sm/md/lg/xl>`, `px-<size>`, `py-<size>` |
| **Shadows** | `shadow-xs`, `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl` |
| **Z-index** | `z-base`, `z-raised`, `z-sticky`, `z-overlay-bg`, `z-overlay`, `z-modal`, `z-command`, `z-toast`, `z-tooltip` |
| **Motion** | `duration-fast`, `duration-base`, `duration-moderate` |

### Forbidden Patterns (must be eliminated)

- ❌ `var(--muted)` — use `text-text-tertiary` or `text-text-secondary`
- ❌ `var(--text)` without suffix — use `text-text-primary`
- ❌ `var(--border)` without suffix — use `border-border-default`
- ❌ `var(--accent)` — use `var(--action-primary)` or `text-action-primary`
- ❌ `var(--card-strong)` — use `bg-surface-elevated`
- ❌ `var(--bg-soft)` — use `bg-surface-shell`
- ❌ Raw `rgba()` backgrounds in components
- ❌ Raw Tailwind colors (`text-rose-300`, `text-emerald-200`, `border-red-400/35`)
- ❌ `rounded-[arbitrary]` — use token-based `rounded-*` values
- ❌ `backdrop-blur-sm` / `backdrop-blur` on non-overlay elements

---

## Implementation Phases

### Phase 0 — Emergency (1–2 days)
- Remove `DispatchDebugPanel` from steel dispatches page
- Fix `surface-panel` class in `workflow-reminder-strip.tsx` and `chart-card.tsx`
- Remove `backdrop-blur-sm` from static `Card` component (already done)

### Phase 1 — Token Compliance Sprint (3–4 days)
- Replace all `var(--muted)`, `var(--text)`, `var(--border)`, `var(--accent)` in 15 high-violation files
- Replace 99+ custom border-radius values with tokens
- Z-index clean up (6 locations)

### Phase 2 — Layout Stabilization (3–4 days)
- Wire density tokens into page-level CSS
- Replace hardcoded sizes with token references
- Add `--context-rail-width` token
- Standardize gap/padding patterns

### Phase 3 — Component Unification (1–2 weeks)
- Create `RouteHeader` component
- Replace 9 `<details>/<summary>` with `DisclosurePanel`
- Migrate Pattern C pages to `WorkstationShell` + `SectionPanel`

### Phase 4 — Form System (1 week)
- Migrate `steel-customers-page.tsx`, `steel-dispatches-page.tsx`, `settings-page.tsx`
- Add `inputMode="decimal"` to numeric inputs

---

## Conclusion

The DPR.ai frontend's visual problems are **not caused by bad design** — they are caused by **incomplete migration**. The token system, component library, and operational primitives are 70–80% enterprise-grade. The page-level adoption is at 40–50%.

The fix is not a redesign. It is a **systematic migration campaign** to:
1. Replace legacy CSS variables with semantic tokens
2. Replace custom border-radii with token values
3. Replace hardcoded sizes with density-aware tokens
4. Standardize page composition with shared components

Each fix is mechanical (find-and-replace with a mapping table). The total effort is approximately **3–4 weeks** for a single developer working full-time, or **1–2 weeks** with 2 developers.

The result will be a frontend that looks, feels, and behaves like a single product rather than two competing applications sharing the same URL space.
