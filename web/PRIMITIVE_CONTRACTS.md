# DPR.ai Primitive Architecture Contracts

> Version 1.0 — Generated from codebase audit (June 2026)

> **Definition:** A **primitive** is a component that maps 1:1 to a native HTML element or ARIA pattern, has zero data-fetching or business-logic dependencies, and is reusable across any feature. Components in `shared/operational/` are composite layouts that compose primitives — they follow a subset of this contract (loading/error/empty states) but skip element-level requirements like `forwardRef` or size variants.

---

## 1. Universal Primitive Rules

Every primitive in `shared/primitives/`, `shared/forms/`, and `shared/operational/` **must** support the following contract. Exceptions are documented per-component below.

### 1.1 Loading State

| Rule | Enforcement |
|---|---|
| Every interactive primitive MUST support a loading/busy state | `isBusy` or `isLoading` prop |
| Loading state MUST disable interaction | `disabled` prop, `pointer-events-none`, or `aria-busy` |
| Loading state MUST announce to assistive tech | `aria-busy="true"` on root |
| Loading state SHOULD show a visible indicator | Spinner, skeleton, or opacity change |
| Loading label SHOULD be customizable | `busyLabel` prop (Button), `loadingTitle`/`loadingMessage` props (LoadingBoundary) |

**Current compliance:**

| Component | Loading Support | Status |
|---|---|---|
| Button | ✅ `isBusy`, spinner, `aria-busy`, `busyLabel`, disabled | ✅ |
| Combobox | ❌ No loading state for async options | ❌ |
| Input/Select/Textarea | ❌ No loading state (not applicable — form controls) | N/A |
| Badge | ❌ Not interactive; no loading needed | N/A |
| Note | `shared/operational/*` components follow a subset of this contract: they do not require React.forwardRef or size variants, but must support loading/error/empty states | |
| Card | ❌ Not interactive by default; no loading | N/A |
| LoadingBoundary | ✅ Full loading skeleton, `LoadingStateSkeleton`, `aria-busy` | ✅ |
| TabNav | ❌ No loading state for async tabs | ❌ |
| GlassPanel | ❌ Not interactive; no loading needed | N/A |

### 1.2 Disabled State

| Rule | Enforcement |
|---|---|
| Every interactive primitive MUST support a `disabled` prop | Boolean prop |
| Disabled state MUST prevent interaction | `pointer-events-none`, `cursor-not-allowed`, or `disabled` attribute |
| Disabled state MUST visually communicate inactivity | Reduced opacity (`opacity-50`) and/or muted colors |
| Disabled state MUST NOT trap focus | `tabIndex={-1}` or skip focus management |
| Disabled options in lists MUST be skippable | Keyboard navigation skips `option.disabled` |

**Current compliance:**

| Component | Disabled Support | Status |
|---|---|---|
| Button | ✅ `disabled`, `opacity-50`, `cursor-not-allowed` | ✅ |
| Input | ✅ Via `disabled` HTML attr, `bg-surface-shell` | ✅ |
| Select | ✅ Via `disabled` HTML attr | ✅ |
| Textarea | ✅ Via `disabled` HTML attr | ✅ |
| Combobox | ✅ Via `disabled` prop on input + options | ✅ |
| TabNav | ✅ `disabled` per-tab, `opacity-50`, `cursor-not-allowed` | ✅ |
| Badge | ❌ Not interactive; no disabled needed | N/A |
| Card | ❌ No disabled state for interactive cards | ❌ |

### 1.3 Focus State

| Rule | Enforcement |
|---|---|
| Every focusable element MUST have a visible focus ring | `focus-visible:ring-2` using `--border-focus` or `--accent` |
| Focus ring MUST use theme tokens | `ring-[color:var(--border-focus)]`, `ring-accent` |
| Focus ring MUST have sufficient contrast on all surfaces | Minimum 3:1 against background |
| Focus ring MUST be `focus-visible:` not `focus:` | Prevents mouse-click flash |
| Focus ring SHOULD use `ring-offset-2` | Separates ring from element background |

**Current compliance:**

| Component | Focus Support | Status |
|---|---|---|
| Button | ✅ `focus-visible:ring-2 focus-visible:ring-[color:var(--border-focus)] focus-visible:ring-offset-2` | ✅ |
| Input/Select/Textarea | ✅ `focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2` — uses `focus:` not `focus-visible:` but acceptable for form fields | ✅ |
| Combobox | ✅ `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent` on options | ✅ |
| TabNav | ✅ Implicit via `<button>` native focus | ✅ |
| Card (interactive) | ❌ No focus ring on clickable cards | ❌ |
| Badge | ❌ Not focusable | N/A |
| GlassPanel | ❌ Not focusable | N/A |

### 1.4 Responsive Behavior

| Rule | Enforcement |
|---|---|
| Primitives MUST NOT depend on fixed viewport widths | Use `min-w-0`, `max-w-full`, `truncate` |
| Text SHOULD truncate with ellipsis when overflowed | `truncate` class on inner `<span>` |
| Horizontal overflow MUST be handled | `overflow-hidden`, `overflow-safe-text`, or `truncate` |
| Mobile touch targets MUST meet 44×44px minimum | `--min-touch-target: 44px` |

### 1.5 Accessibility Baseline

| Rule | Enforcement |
|---|---|
| Every primitive MUST use semantic HTML where possible | `<button>` for buttons, `<input>` for inputs |
| Custom interactive elements MUST have `role` attribute | `role="button"`, `role="combobox"`, `role="listbox"` |
| Every primitive MUST support `className` merging | `cn()` utility for class merging |
| Every interactive primitive MUST forward `ref` | `React.forwardRef` for form controls and interactive elements |
| Display-only primitives (Badge, Card, Skeleton) MAY omit `forwardRef` | Native element semantics via `{...props}` spread |
| Every primitive MUST spread unknown props | `{...props}` on the root element |
| Loading announcements MUST use `aria-busy` | `aria-busy="true"` during loading |

---

## 2. Variant Governance

### 2.1 Variant Naming Rules

| Pattern | Example | Rule |
|---|---|---|
| `variant` prop | `variant="primary"` | Use semantic purpose, not visual description |
| Semantic names | `primary`, `secondary`, `ghost`, `destructive` | Standard across all primitives |
| Avoid visual names | ❌ `blue`, `bordered`, `filled` | Use `info`, `success`, `warning`, `danger` |
| Status names | `success`, `warning`, `error`, `info`, `processing` | For status-related variants only |

### 2.2 Size Naming Rules

| Pattern | Example | Rule |
|---|---|---|
| Density-aware | `default`, `compact`, `icon` | Match density system naming |
| Use `compact` not `sm` | ❌ `sm` → ✅ `compact` | Align with Tailwind v4 |
| Use `default` not `md` | ❌ `md` → ✅ `default` | Align with density system |

### 2.3 Tone Naming Rules (Status/Action)

| Tone | Semantic | Used By |
|---|---|---|
| `default` | Neutral, no emphasis | StatusBadge, TabNav |
| `success` | Positive completion | Badge, StatusBadge |
| `warning` | Non-blocking attention | Badge, StatusBadge |
| `error` / `danger` | Blocking failure | Button (destructive), Badge (error) |
| `info` | Informational | Badge, StatusBadge (approval) |
| `processing` | In-progress | Badge, StatusBadge |
| `paused` | Suspended | Badge, StatusBadge |
| `synced` | Synchronization complete | Badge, StatusBadge |

### 2.4 Current Variant Landscape

| Component | Variants | Sizes | Notes |
|---|---|---|---|
| Button | primary, secondary, outline→secondary, ghost, destructive | default, compact, icon | `outline` is a duplicate of `secondary` |
| Badge | success, warning, info, secondary, destructive, processing, paused, draft, synced, error | compact, standard | compact=standard (identical padding) |
| StatusBadge | default→draft, success, warning, error, processing, paused, synced, approval→info, reconciliation→warning | inherited from Badge | Wraps Badge with tone→status mapping |
| ConfidenceBadge | high, medium, low | fixed | No size variants |
| Card | interactive (via `group` class) | fixed | No formal variant system |
| GlassPanel | default, subtle, elevated, accent | fixed | Active hover on elevated/accent |
| TabNav | surface, inline | fixed | No compact/standard sizing; `aria-label` is hardcoded English |

---

## 3. Component Boundaries

### 3.1 What Primitives CAN Do

| Area | Scope |
|---|---|
| Props | Accept standard HTML attributes via spread + custom props |
| Styling | Use token-based Tailwind classes only (no inline `style` objects) |
| Composition | Compose other primitives via `children` |
| State | Manage internal UI state only (open/close, active option) |
| Accessibility | Forward ARIA attributes, manage focus, announce state changes |
| Density | Respond to `data-density` attribute via CSS variables |
| Dark mode | Use token-based colors only; never define local dark values |

### 3.2 What Primitives CANNOT Do

| Area | Boundary |
|---|---|
| Data fetching | ❌ No API calls, no server state |
| Business logic | ❌ No domain-specific calculations |
| Routing | ❌ No navigation, no URL manipulation |
| Form validation | ❌ Delegate to `react-hook-form` / Zod |
| Store access | ❌ No direct store subscriptions (props only) |
| Inline styles | ❌ No `style={{...}}` objects; use Tailwind tokens |
| | ⚠️ Exception: SVG child properties (fill, stroke) that cannot be targeted via utilities |
| Hardcoded colors | ❌ No hex/rgb values; use `var(--token)` |
| Hardcoded sizes | ❌ No `px` values outside the spacing/token system |
| Layout composition | ❌ No page-level layout logic |
| Theme overrides | ❌ No `@media (prefers-color-scheme: dark)` in primitives |

---

## 4. Per-Component Contracts

### 4.1 Button

```typescript
interface ButtonContract {
  variant: "primary" | "secondary" | "ghost" | "destructive";  // outline maps to secondary
  size: "default" | "compact" | "icon";
  isBusy?: boolean;        // Shows spinner, disables
  busyLabel?: string;      // Replaces children when busy
  asChild?: boolean;       // Radix Slot for polymorphic rendering
  disabled?: boolean;
  type?: "button" | "submit" | "reset";  // defaults to "button"
}
```

| Behavior | Status |
|---|---|
| ✅ Primary variant with teal accent background | Verified |
| ✅ Secondary variant with surface background + border | Verified |
| ✅ Ghost variant with transparent background + link text | Verified |
| ✅ Destructive variant with red background | Verified |
| ✅ Loading spinner with `aria-busy` | Verified |
| ✅ `data-variant` and `data-size` attributes | Verified |
| ✅ `focus-visible` ring with theme token | Verified |
| ✅ Disabled with reduced opacity + cursor change | Verified |
| ✅ `asChild` via Radix Slot for custom wrappers | Verified |
| ✅ `truncate` on inner span for overflow | Verified |
| ⚠️ `outline` variant maps to `secondary` — consider deprecating | Identified |
| ⚠️ No `data-testid` attribute for testing | Gap |

### 4.2 Badge

```typescript
interface BadgeContract {
  status: BadgeStatus;     // success | warning | info | secondary | destructive | processing | paused | draft | synced | error
  size: "compact" | "standard";  // currently identical
  showIndicator?: boolean; // Leading dot indicator
  monospace?: boolean;     // Monospace font for code statuses
}
```

| Behavior | Status |
|---|---|
| ✅ 10 status variants with distinct visual styles | Verified |
| ✅ Leading dot indicator with status-appropriate color | Verified |
| ✅ `data-status` attribute for targeting | Verified |
| ✅ `truncate` on inner span | Verified |
| ⚠️ `compact` and `standard` sizes are identical | Gap |
| ⚠️ `info` status uses `processing` class (wrong mapping) | Bug — should use distinct blue-themed styling via `--status-info-*` tokens |
| ⚠️ No disabled state (not applicable — not interactive) | N/A |

### 4.3 Input / Select / Textarea

```typescript
interface FieldControlContract {
  validationState?: FieldValidationState;  // "default" | "invalid" | "valid"
  // Inherits from React.InputHTMLAttributes / SelectHTMLAttributes / TextareaHTMLAttributes
}
```

| Behavior | Status |
|---|---|
| ✅ Field context integration via `useFieldContext()` | Verified |
| ✅ Programmatic label association via `registerControl` | Verified |
| ✅ `aria-invalid` for validation errors | Verified |
| ✅ `aria-describedby` linking to HelperText | Verified |
| ✅ Error styling via `--border-danger`, `--bg-danger` | Verified |
| ✅ Valid state styling via `--border-success` | Verified |
| ✅ Disabled state with `bg-surface-shell` | Verified |
| ✅ Focus ring with `ring-accent` | Verified |
| ⚠️ `fieldBase` uses hardcoded `text-[14px]` instead of token | Gap |
| ⚠️ `fieldBase` uses `bg-[var(--color-background-primary)]` — may be undefined | Gap |

### 4.4 Card

```typescript
interface CardContract {
  // Interactive via `group` class in className
  // No formal contract — uses standard HTMLAttributes
}
```

| Behavior | Status |
|---|---|
| ✅ Interactive hover effects via `group` class detection | Verified |
| ✅ `bg-surface-panel`, `border-border-subtle`, `rounded-panel` | Verified |
| ✅ `CardHeader`, `CardTitle`, `CardContent` parts | Verified |
| ✅ Polymorphic heading level via `as` prop on CardTitle | Verified |
| ⚠️ No keyboard support for interactive cards | Gap |
| ⚠️ No `role="button"` for interactive cards | Gap |
| ⚠️ No focus ring for interactive cards | Gap |
| ⚠️ No `tabIndex` for interactive cards | Gap |

### 4.5 Combobox

```typescript
interface ComboboxContract {
  value: string;
  options: ComboboxOption[];  // { value, label, keywords?, meta?, disabled? }
  onValueChange: (value: string) => void;
  disabled?: boolean;
  validationState?: FieldValidationState;
  placeholder?: string;
  emptyMessage?: string;
}
```

| Behavior | Status |
|---|---|
| ✅ Full keyboard navigation (ArrowUp/Down, Enter, Escape) | Verified |
| ✅ ARIA: `combobox`, `listbox`, `option` roles | Verified |
| ✅ `aria-expanded`, `aria-autocomplete`, `aria-activedescendant` | Verified |
| ✅ Filtered search with keyword matching | Verified |
| ✅ Disabled options skippable in keyboard nav | Verified |
| ✅ Scroll-into-view for active option | Verified |
| ✅ Blur timeout for click-outside handling | Verified |
| ⚠️ No loading state for async options | Gap |
| ⚠️ No `aria-label` on listbox when no visible label | Gap |
| ⚠️ Blur timeout uses magic number (120ms) | Smell |

### 4.6 GlassPanel

```typescript
interface GlassPanelContract {
  variant?: "default" | "subtle" | "elevated" | "accent";
  blur?: boolean;     // Backdrop blur filter
  border?: boolean;   // Toggle border visibility
}
```

| Behavior | Status |
|---|---|
| ✅ 4 visual variants with distinct glass effects | Verified |
| ✅ Backdrop blur support | Verified |
| ✅ Border toggle | Verified |
| ✅ Gradient overlay for depth | Verified |
| ✅ `GlassPanelHeader`, `GlassPanelContent`, `GlassPanelFooter` parts | Verified |
| ⚠️ No interactive states (not designed for interaction) | N/A |

### 4.7 TabNav

```typescript
interface TabNavContract {
  tabs: TabNavItem[];        // { id, label, hint?, disabled? }
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: "surface" | "inline";
}
```

| Behavior | Status |
|---|---|
| ✅ `aria-label` on nav element | Verified |
| ✅ `aria-current="page"` on active tab | Verified |
| ✅ `disabled` per-tab with visual feedback | Verified |
| ✅ 2 variants (surface with border, inline without) | Verified |
| ⚠️ **No keyboard navigation** (ArrowLeft/Right) | Critical Gap |
| ⚠️ No `role="tablist"` / `role="tab"` on tabs | Gap |
| ⚠️ No `aria-controls` linking tab to panel | Gap |

### 4.8 Skeleton

```typescript
interface SkeletonContract {
  // className only — inherits HTMLAttributes
}
```

| Behavior | Status |
|---|---|
| ✅ Shimmer animation via CSS `after:` pseudo-element | Verified |
| ✅ `rounded-panel` and `bg-surface-skeleton` | Verified |
| ✅ Shine color via `--surface-skeleton-shine` | Verified |
| ⚠️ No `aria-hidden="true"` (should be hidden from AT) | Gap |
| ⚠️ No `aria-label` for context | Gap |
| ⚠️ No reduced-motion respect | Gap |

### 4.9 ConfidenceBadge

```typescript
interface ConfidenceBadgeContract {
  level: "high" | "medium" | "low";
  label?: string;       // Custom label, defaults to "X confidence"
  hideIndicator?: boolean;
}
```

| Behavior | Status |
|---|---|
| ✅ 3 confidence levels with distinct visual styles | Verified |
| ✅ Leading dot indicator toggle | Verified |
| ✅ `data-confidence` attribute | Verified |
| ✅ Helper: `confidenceLevelFromScore()` utility | Verified |
| ✅ Helper: `truncateReasoning()` utility | Verified |
| ⚠️ No `data-testid` for testing | Gap |

### 4.10 SafeText

```typescript
interface SafeTextContract {
  as?: ElementType;     // Polymorphic element
  children: ReactNode;
  // Overflow-safe display with user-selectable text
}
```

| Behavior | Status |
|---|---|
| ✅ Polymorphic `as` prop for semantic HTML | Verified |
| ✅ `overflow-safe-text` class for overflow safety | Verified |
| ✅ `ui-select-text` for user text selection | Verified |

---

## 5. Accessibility Rules (Checklist)

### 5.1 Keyboard Support

| Rule | Required For |
|---|---|
| Tab to focus | All interactive elements |
| Enter/Space to activate | Buttons, links, interactive cards |
| Arrow keys to navigate | Combobox, TabNav, listboxes |
| Escape to dismiss | Combobox, modals, dropdowns |
| No keyboard traps | All interactive elements |
| Focus order matches visual order | All layouts |

**Current gaps:**
- TabNav: ❌ No ArrowLeft/ArrowRight navigation
- Interactive cards: ❌ No Enter/Space activation

### 5.2 ARIA Attributes

| Attribute | Required For |
|---|---|
| `aria-label` or `aria-labelledby` | All interactive containers, nav elements |
| `aria-current` | Active tab, active step |
| `aria-expanded` | Expandable elements (combobox, accordion) |
| `aria-controls` | Elements that control another element's visibility |
| `aria-selected` | Listbox options, tab items |
| `aria-busy` | Loading states |
| `aria-invalid` | Form controls with validation errors |
| `aria-describedby` | Form controls with helper/error text |
| `role="alert"` | Error messages (live region) |
| `role="status"` | Non-critical status updates |

**Current gaps:**
- Combobox listbox: ❌ No `aria-label` when no visible label
- TabNav tabs: ❌ No `role="tablist"` / `role="tab"` / `aria-controls`

### 5.3 Focus Management

| Rule | Required For |
|---|---|
| Focus must move predictably on interaction | All interactive elements |
| Focus must not be lost on state change | Dropdowns, modals, combobox |
| Programmatic focus MUST use `ref.focus()` | Not `scrollIntoView` alone |
| Focus trap for modals | Modal containers |

### 5.4 Screen Reader

| Rule | Required For |
|---|---|
| Loading state announcements | `aria-busy="true"` |
| Error announcements | `role="alert"` with `aria-live` |
| Dynamic content updates | `aria-live="polite"` or `"assertive"` |
| Decorative elements hidden | `aria-hidden="true"` on icons, indicators |
| Status updates without context switch | `role="status"` |

**Current gaps:**
- Skeleton: ❌ Should have `aria-hidden="true"`

---

## 6. Testing Requirements

| Test Type | Coverage Target |
|---|---|
| Unit tests (Vitest + RTL) | All states: default, loading, disabled, error |
| Keyboard navigation | Tab, Enter, Escape, Arrow keys |
| Accessibility (axe) | No violations in any variant |
| Visual regression | All variants, all sizes, all states |
| Dark mode | All primitives render correctly in dark mode |
| Density modes | Standard, floor, executive |

---

## 7. Enforcement Strategy

These contracts are currently **documentation-only**. Enforcement mechanisms are planned:

| Mechanism | Status |
|---|---|
| ESLint rules for ARIA attributes (`jsx-a11y`) | Ready — enable in eslint config |
| ESLint rule: no hardcoded colors in primitives | Planned — custom rule |
| ESLint rule: no inline styles in primitives (except SVG) | Planned — custom rule |
| ESLint rule: enforce `forwardRef` on interactive primitives | Planned — `react/forwardRef-uses-ref` |
| TypeScript: enforce `cn()` usage for className merging | IDE-level only |
| CI: audit step to compare primitives against contracts | Planned — Phase 1.10 |

---

## 8. Migration Roadmap

| Priority | Component | Fix Needed |
|---|---|---|
| P0 | TabNav | Add ArrowLeft/Right keyboard navigation, `role="tablist"` / `role="tab"` |
| P0 | Card (interactive) | Add keyboard support, `role="button"`, focus ring, `tabIndex` |
| P1 | Skeleton | Add `aria-hidden="true"`, reduced-motion media query |
| P1 | Button | Deprecate `outline` variant (duplicate of `secondary`) |
| P1 | Badge | Fix `info` → `processing` class mapping; differentiate `compact`/`standard` sizes |
| P1 | Input fieldBase | Replace `text-[14px]` with `text-sm` token |
| P2 | Combobox | Add loading state for async options, add `aria-label` fallback |
| P2 | ConfidenceBadge | Add `data-testid` attribute |
