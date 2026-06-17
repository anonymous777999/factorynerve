# Shell Contracts — DPR.ai Application Shell Governance

**Last updated:** June 2026  
**Scope:** Phase 2 — Application Shell + Navigation Architecture  
**Status:** Active — enforced by ESLint rules

---

## 1. Purpose

These contracts define how the DPR.ai application shell must behave and how
consumers must use it. Violations create layout drift, navigation entropy,
and regressions in responsive behavior. All new code must comply.

---

## 2. Page Wrapper Requirements

### 2.1 Every workspace page MUST use `PageShell` or `WorkstationShell`

```tsx
// ✅ Correct
import { PageShell } from "@/shared/operational";

function MyPage() {
  return (
    <PageShell
      eyebrow="Reports"
      title="Monthly summary"
      actions={[{ id: "export", label: "Export" }]}
    >
      <MyContent />
    </PageShell>
  );
}
```

| Shell | When to use |
|---|---|
| `PageShell` | Standard workspace pages with breadcrumbs, footer, max-width control |
| `WorkstationShell` | Focus-mode pages without breadcrumbs or footer |

### 2.2 Pages MUST NOT create their own layout wrappers

No `min-h-screen`, `px-*`, or `py-*` on the outermost page container.
These are the shell's responsibility.

#### ❌ Forbidden patterns

```tsx
// NEVER do this:
<main className="min-h-screen px-4 py-8 md:px-8">...</main>
<main className="px-6 py-6">...</main>
```

### 2.3 Pages MUST NOT inline their own header regions

The header region (eyebrow, title, description, actions, metrics) MUST
be delegated to `ShellHeader`. Both `PageShell` and `WorkstationShell`
handle this delegation internally.

#### ❌ Forbidden imports

```tsx
// NEVER import from these — use @/shared/operational instead
import { WorkstationShell } from "@/components/ui/workstation-shell";  // ❌
import { PageShell } from "@/components/ui/page-shell";                // ❌
import { OperationalPageShell } from "@/components/ui/...";            // ❌
```

---

## 3. Header Requirements

### 3.1 All page headers MUST use `ShellHeader`

`ShellHeader` is the single canonical header component for all workspace pages.
Do not inline `route-header` markup manually.

```tsx
// ✅ Correct — ShellHeader handles all variants
<ShellHeader
  variant="default"
  eyebrow="Reports"
  title="Production summary"
  metrics={[...]}
/>

// ❌ Wrong — inline route-header
<section className="route-header rounded-panel">
  <h1>Production summary</h1>
</section>
```

### 3.2 Header variants

| Variant | Purpose | Key characteristics |
|---|---|---|
| `default` | Standard operation page | Browser-width, title, description, metrics, actions |
| `dashboard` | Overview/dashboard views | Larger title, generous spacing, live indicator |
| `focus` | Immersive workflows | Compact, reduced spacing, minimal chrome |
| `workflow` | Multi-step processes | Progress bar, back navigation, step counter |

---

## 4. Navigation Requirements

### 4.1 Navigation data MUST come from `@/lib/navigation`

Do not hardcode role checks, permission logic, or navigation item lists
inside page components.

```tsx
// ✅ Correct
import { useVisibleNavItems } from "@/lib/navigation";

// ❌ Wrong — inline role check
if (user.role === "manager") { /* render nav item */ }
```

### 4.2 Route matching MUST use the canonical `match()` functions

Nav items define their own route matching via the `match` property.
Do not re-implement route matching logic.

### 4.3 `PageShellAction` and `ShellHeaderAction` are interchangeable

These types are structurally identical. Use either depending on context:

```tsx
import type { ShellHeaderAction } from "@/shared/operational/shell-header";
import type { PageShellAction } from "@/shared/operational/page-shell";
```

---

## 5. Responsive Requirements

### 5.1 Breakpoint detection MUST use `useBreakpoint()` hook

```tsx
// ✅ Correct
import { useBreakpoint } from "@/hooks/use-breakpoint";
const { isMobile } = useBreakpoint();

// ❌ Wrong — hardcoded width check
const isMobile = window.innerWidth < 768;
```

### 5.2 Density adaptation MUST use the CSS variable system

Density is controlled via `data-density` on `<html>`. Do not hardcode
different font sizes or spacing for density modes.

### 5.3 Mobile shell behavior

| Device | Sidebar | Bottom nav | Context rail |
|---|---|---|---|
| Mobile (<768px) | Hidden (overlay) | Visible | Hidden |
| Tablet (768–1023) | Hidden (overlay) | Visible | Hidden |
| Desktop (≥1024) | Persistent | Hidden | Visible |

---

## 6. Import Restrictions (ESLint-enforced)

The following import patterns are **forbidden** and will fail ESLint:

| Forbidden import | Use instead |
|---|---|
| `@/components/ui/workstation-shell` | `@/shared/operational` |
| `@/components/ui/operational-page-shell` | `@/shared/operational` |
| `@/components/ui/page-shell` | `@/shared/operational` |
| `@/components/app-header` | `ShellHeader` from `@/shared/operational` |
| `@/components/layout/app-sidebar` (for data) | `@/lib/navigation` |
| `src/rollback-ui/**` (any import) | Migrate to current feature directory |

---

## 7. Testing Requirements

All shell behavior MUST be covered by Playwright E2E tests in `web/e2e/`:

| Test | File | Coverage |
|---|---|---|
| SHELL-01 | `shell-navigation.spec.ts` | Desktop sidebar renders |
| SHELL-02 | `shell-navigation.spec.ts` | Mobile bottom nav visible |
| SHELL-03 | `shell-navigation.spec.ts` | Route switching stability |
| SHELL-04 | `shell-navigation.spec.ts` | Interactive controls render |
| SHELL-05 | `shell-navigation.spec.ts` | Responsive viewport adaptation |

---

## 8. Performance Budgets

| Metric | Target | Enforcement |
|---|---|---|
| Shell hydration | < 200ms | Lighthouse CI (future) |
| Sidebar render | < 50ms | Manual profiling |
| Route transition (CLS) | < 0.1 | Core Web Vitals |

---

## 9. Violation Handling

Contracts are enforced by:
1. **ESLint rules** — import restrictions fail CI
2. **Code review** — shell contract violations must be flagged
3. **Playwright tests** — responsive / navigation tests fail CI

To bypass an enforced rule, disable the specific ESLint rule with a
justification comment:

```tsx
// eslint-disable-next-line no-restricted-imports -- <justification>
```
