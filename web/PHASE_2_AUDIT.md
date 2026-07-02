# Phase 2.0 — Shell Architecture Audit + Route Mapping

> Generated from codebase audit (June 2026)
> Covers: route inventory, layout duplication, navigation entropy, responsive issues

---

## 1. Route Architecture Map

### 1.1 Route Directory Structure

All 27 route directories under `src/app/`:

```
src/app/
├── (root pages)
│   ├── page.tsx          → HomeRoute (landing)
│   ├── layout.tsx        → RootLayout (fonts, providers, AppShell)
│   ├── template.tsx      → Fade-in animation on navigation
│   ├── loading.tsx       → DashboardPageSkeleton
│   ├── error.tsx         → Chunk reload + error reporting
│   ├── not-found.tsx     → Card with links to /access and /dashboard
│   └── globals.css
│
├── 403/                  → page.tsx (AccessRestrictedPage)
├── access/               → page.tsx, loading.tsx
├── ai/                   → page.tsx, loading.tsx
├── analytics/            → page.tsx, loading.tsx
├── approvals/            → layout.tsx, page.tsx, loading.tsx
├── attendance/           → layout.tsx, page.tsx, loading.tsx
│   ├── live/             → (no page.tsx found)
│   ├── reports/          → (no page.tsx found)
│   └── review/           → (no page.tsx found)
├── billing/              → page.tsx, loading.tsx
├── control-tower/        → page.tsx, loading.tsx
├── dashboard/            → page.tsx, loading.tsx
├── email-summary/        → page.tsx, loading.tsx
├── entry/                → page.tsx, loading.tsx
│   └── [id]/             → (dynamic route segment)
├── forgot-password/      → page.tsx, loading.tsx
├── login/                → page.tsx, loading.tsx
├── ocr/                  → layout.tsx, page.tsx, loading.tsx
│   ├── scan/             → page.tsx, loading.tsx
│   ├── verify/           → page.tsx, loading.tsx
│   ├── history/          → page.tsx, loading.tsx
│   └── jobs/             → (no page.tsx found)
├── offline/              → page.tsx
├── onboarding/
│   └── factory-required/ → page.tsx
├── plans/                → page.tsx, loading.tsx
├── premium/
│   └── dashboard/        → page.tsx, loading.tsx
├── profile/              → page.tsx, loading.tsx
├── register/             → page.tsx
├── reports/              → page.tsx, loading.tsx
├── reset-password/       → page.tsx, loading.tsx
├── settings/             → page.tsx, loading.tsx
│   └── attendance/       → page.tsx, loading.tsx
├── steel/                → layout.tsx, page.tsx, loading.tsx
│   ├── batches/          → (no page.tsx found)
│   ├── charts/           → (no page.tsx found)
│   ├── customers/        → (no page.tsx found)
│   ├── dispatches/       → (no page.tsx found)
│   ├── inventory/        → page.tsx, loading.tsx
│   │   └── transactions/ → page.tsx
│   ├── invoices/         → (no page.tsx found)
│   ├── production/
│   │   └── record/       → page.tsx
│   └── reconciliations/  → (no page.tsx found)
├── tasks/                → page.tsx, loading.tsx
├── verify-email/         → page.tsx, loading.tsx
└── work-queue/           → (no page.tsx found)
```

### 1.2 Route Statistics

| Metric | Count |
|---|---|
| Route directories | 27 |
| Pages (page.tsx) | 32 (root + 27 subdirs + nested) |
| Sub-layouts (layout.tsx) | 5 (root, ocr, steel, attendance, approvals) |
| Route loading states | 21 (root + 20 sub-routes) |
| Route error states | 1 (root only) |
| Route not-found states | 1 (root only) |
| Route group layouts `(group)` | 0 — **no route grouping exists** |

### 1.3 Critical Findings

**Finding R1: No Route Grouping**
All 27 routes are flat in `app/`. No `(auth)`, `(dashboard)`, `(operator)`, `(settings)`, or `(admin)` route groups exist. This means:
- Auth pages (login, register, forgot-password, reset-password, verify-email) share the same layout as operational pages
- Shell hiding for auth routes is handled by `isShellHiddenRoute()` runtime check in `AppShell` rather than by route-level segment configuration
- Every page inherits RootLayout → AppShell, even pages that don't need the shell

**Finding R2: Orphan Route Directories**
Several route directories exist in the filed listing but have no `page.tsx`:
- `attendance/live/` — no page
- `attendance/reports/` — no page
- `attendance/review/` — no page
- `steel/batches/` — no page
- `steel/charts/` — no page
- `steel/customers/` — no page
- `steel/dispatches/` — no page
- `steel/invoices/` — no page
- `steel/reconciliations/` — no page
- `work-queue/` — no page
- `ocr/jobs/` — no page
- `entry/[id]/` — dynamic segment

These may be:
- Dead routes with only `loading.tsx` left behind
- Placeholder directories awaiting implementation
- Routes that exist only as nav registry entries without backing pages

**Finding R3: Inconsistent loading/error Boundaries**
- Root has: `loading.tsx` + `error.tsx`
- 20 sub-routes have `loading.tsx` but ZERO have their own `error.tsx`
- Missing loading states: 403, offline, register, work-queue, onboarding/factory-required, steel/inventory/transactions, steel/production/record, several steel sub-routes
- Template.tsx exists at root only — no sub-route templates

**Finding R4: Duplicate Auth Routes**
Both `/access` and `/login` exist as separate routes with different page implementations:
- `/access` → login page
- `/login` → separate login page with loading.tsx

This creates a split authentication surface.

---

## 2. Layout Duplication Report

### 2.1 Layout Hierarchy (Current)

```
RootLayout (app/layout.tsx)
├── AppProviders
│   ├── BetaRolloutBanner
│   ├── BadgeProvider
│   │   └── AppShell (app-shell.tsx)
│   │       ├── FeedbackActivityTracker
│   │       ├── AppMobileMenu
│   │       ├── AppHeader
│   │       ├── AppSidebar (w/ Favorites, NavContent, NavIcon, ChevronIcon)
│   │       ├── Workstation Frame
│   │       │   ├── TopBar (sticky header / dashboard header)
│   │       │   ├── Content Area
│   │       │   │   └── (sub-layout or page)
│   │       │   │       ├── ocr/layout.tsx
│   │       │   │       ├── steel/layout.tsx
│   │       │   │       ├── attendance/layout.tsx
│   │       │   │       └── approvals/layout.tsx
│   │       │   └── AppDesktopContextRail (conditional)
│   │       ├── AppMobileBottomNav (conditional)
│   │       ├── JobsDrawer
│   │       ├── FeedbackWidget
│   │       ├── MicroFeedbackPrompt
│   │       ├── ErrorFeedbackPrompt
│   │       └── CommandPalette
│   ├── ToastCenter
│   ├── FrontendErrorMonitor
│   ├── OfflineSyncAgent
│   ├── FeedbackSyncAgent
│   └── ServiceWorker
```

### 2.2 Duplicate Wrappers Identified

**Finding L1: AuthPageShell Duplication**
Three different auth shell components exist with significant overlap:
- `components/auth-shell.tsx` — wraps AuthWorkstationShell with i18n defaults
- `components/auth-workstation-shell.tsx` — the actual implementation (~300 lines, 4 variants)
- `components/ui/login-1.tsx` — renders AuthWorkstationShell with hardcoded content

The `auth-workstation-shell.tsx` is the canonical implementation, but `login-1.tsx` duplicates its content by rendering a second copy of support items, steps, and metrics inline.

**Finding L2: PageShell vs OperationalPageShell**
No canonical `PageShell` component exists. Instead:
- `components/ui/operational-page-shell.tsx` — used by email-summary, reports
- `components/app-shell.tsx` — the main app shell (non-reusable, app-specific)
- Pages use ad-hoc containers (divs with `mx-auto max-w-*`, `flex min-h-screen`, etc.)

No shared page-level wrapper component exists for consistent spacing, headers, and breadcrumbs.

**Finding L3: Icon and Toggle Components Duplicated**
- `panel-toggle-button.tsx` exists in BOTH `components/ui/` AND `shared/forms/` — identical implementations
- `password-visibility-toggle.tsx` exists in BOTH `components/ui/` AND `shared/forms/` — identical implementations
- `login-1.tsx` exists in BOTH `components/ui/` AND `shared/operational/` — identical implementations
- `data-table-header.tsx` exists in BOTH `components/ui/` AND `shared/primitives/` — identical implementations

**Finding L4: Error/Not Found Pages Use Inconsistent Styling**
- `error.tsx` uses `var(--border)`, `var(--accent)`, `var(--muted)` — raw CSS variables, not token classes
- `not-found.tsx` uses `text-[var(--muted)]` — raw CSS variable
- These bypass the token system used everywhere else

### 2.3 Shell Variant Analysis

| Shell Variant | Implementation | Pages Using It |
|---|---|---|
| Full shell | AppShell with sidebar + topbar + context rail | dashboard, approvals, reports, etc. |
| Auth shell | AuthWorkstationShell | login, register, forgot-password, reset-password, verify-email |
| Minimal shell | isShellHiddenRoute (no shell) | 403, offline, error pages |
| Focus mode | shellLayout.mode === "focus" | scanner/OCR routes |
| Immersive scanner | immersiveScannerRoute | OCR scan routes (hidden sidebar) |

---

## 3. Navigation Entropy Report

### 3.1 Navigation Architecture (Current)

```
lib/navigation/
├── registry.ts          → 32-item NavItem array, typed NavDomain/NavIcon/NavBadge
├── role-registry.ts     → NAV_ROLE_MAP (per-item role arrays)

app-sidebar.tsx (monolith ~900 lines)
├── navItemMetadataById  → Duplicates registry (descriptions, match functions)
├── NAV_ICON_COMPONENTS  → Icon component map (23 entries)
├── NavIcon              → Renders icon from NAV_ICON_COMPONENTS
├── FavoriteIcon         → Renders star icon
├── ChevronIcon          → Renders chevron icon
├── NavContent           → Section-aware nav rendering (favorites, primary, collapsible)
├── AppSidebar           → Main sidebar component (~300 lines, 30+ props)
├── AppDesktopContextRail → Right-side context panel
├── AppMobileBottomNav   → Mobile bottom navigation
└── Helper functions     → getVisibleNavSections, getMobileNavItems, localizedItemText, roleLabel, etc.
```

### 3.2 Entropy Sources

**Finding N1: Registry Duplication in Sidebar**
The `navItemMetadataById` object inside `app-sidebar.tsx` duplicates the `NAV_ITEMS` registry with:
- 32 hardcoded `match` functions (duplicating route matching logic)
- 32 hardcoded `description` strings (duplicating the registry's own data)
- 32 hardcoded `permission` and `industryTypes` fields (duplicating role-registry.ts)

This means adding a new nav item requires editing THREE places:
1. `lib/navigation/registry.ts` — add to `NAV_ITEMS` array
2. `lib/navigation/role-registry.ts` — add role mapping
3. `app-sidebar.tsx` — add metadata, icon, match function

**Finding N2: Two Role/Permission Systems**
- `NAV_ROLE_MAP` in `role-registry.ts` — typed, centralized role→nav-item mapping
- `getVisibleNavSections` in `app-sidebar.tsx` — SEPARATE role filtering logic that also checks `permissions` from the user object
- `RoleGate` component in `shared/permissions/` — THIRD permission check mechanism

A nav item goes through 3 permission gates: role-registry → getVisibleNavSections → RoleGate.

**Finding N3: Mobile Navigation Duplication**
- `getMobileNavItems()` in `app-sidebar.tsx` — selects 5 items for bottom nav
- `MOBILE_NAV_LABELS` in `app-sidebar.tsx` — hardcoded label overrides for mobile
- `APP_MOBILE_NAV_ITEMS` / `getRoleMobileNavHrefs` in `lib/role-navigation.ts` — separate mobile nav configuration

**Finding N4: Hardcoded Labels**
- `SECTION_LABEL_KEY` — hardcoded section name→i18n-key mapping
- `ITEM_TRANSLATION_KEY` — hardcoded href→i18n-key mapping (32 entries)
- i18n structure duplicates the nav registry instead of deriving from it

### 3.3 Nav Item → Page Coverage

| Nav Item | Route | page.tsx exists? | Error state? |
|---|---|---|---|
| work-queue | /work-queue | ❌ | ❌ |
| attendance | /attendance | ✅ | ❌ |
| today-board | /dashboard | ✅ | ❌ |
| my-day | /tasks | ✅ | ❌ |
| document-desk | /ocr/scan | ✅ | ❌ |
| shift-entry | /entry | ✅ | ❌ |
| steel-hub | /steel | ✅ | ❌ |
| inventory | /steel/inventory | ✅ | ❌ |
| inventory-transactions | /steel/inventory/transactions | ✅ | ❌ |
| production-record | /steel/production/record | ✅ | ❌ |
| steel-batches | /steel/batches | ❌ | ❌ |
| steel-charts | /steel/charts | ❌ | ❌ |
| customers | /steel/customers | ❌ | ❌ |
| sales-invoices | /steel/invoices | ❌ | ❌ |
| dispatch | /steel/dispatches | ❌ | ❌ |
| attendance-review | /attendance/review | ❌ | ❌ |
| approvals | /approvals | ✅ | ❌ |
| review-documents | /ocr/verify | ✅ | ❌ |
| ocr-history | /ocr/history | ✅ | ❌ |
| stock-review | /steel/reconciliations | ❌ | ❌ |
| attendance-reports | /attendance/reports | ❌ | ❌ |
| reports-exports | /reports | ✅ | ❌ |
| performance | /analytics | ✅ | ❌ |
| owner-desk | /premium/dashboard | ✅ | ❌ |
| factory-network | /control-tower | ✅ | ❌ |
| scheduled-updates | /email-summary | ✅ | ❌ |
| ai-insights | /ai | ✅ | ❌ |
| attendance-admin | /settings/attendance | ✅ | ❌ |
| factory-admin | /settings | ✅ | ❌ |
| subscription | /plans | ✅ | ❌ |
| billing-invoices | /billing | ✅ | ❌ |
| profile | /profile | ✅ | ❌ |

**10 out of 32 nav items have no page.tsx backing** — these are orphan nav entries that render in the sidebar but route to black holes.

---

## 4. Responsive Issue Report

### 4.1 Current Responsive Architecture

| Breakpoint | Behavior | Components |
|---|---|---|
| Mobile (< 1024px) | Sidebar hidden (overlay), bottom nav visible, top bar shown | AppMobileBottomNav, AppMobileMenu, AppHeader (mobile) |
| Desktop (≥ 1024px) | Sidebar persistent, desktop topbar, optional context rail | AppSidebar, topbar, AppDesktopContextRail |
| Tablet (hidden) | No explicit tablet layout | Falls through to mobile behavior |

### 4.2 Responsive Issues

**Finding R1: No Tablet Breakpoint**
The codebase only has a single `lg:` breakpoint (1024px). There is no tablet-specific layout. On tablets:
- The sidebar slide-over is mobile-style (too cramped for tablets)
- Bottom nav takes up significant screen space
- No split-panel or side-panel tablet optimizations

**Finding R2: Density Infrastructure Exists but is Incomplete**
- `data-density` attribute is set on `<html>` element (compact/default/comfortable)
- Density choices are exposed in the sidebar UI
- But many primitives don't use density-aware sizing:
  - Input uses hardcoded `min-h-[38px]` instead of density token
  - Sidebar items use hardcoded `h-8` / `px-2.5 py-2` / `h-11`
  - No density-responsive typography scale

**Finding R3: Touch Target Compliance Uncertain**
- Mobile bottom nav items use `h-11 w-11` (44px ✓)
- Sidebar nav items use `min-h-row-lg` which maps to density variable
- But no systematic audit of touch targets against 44×44px minimum exists
- Some interactive elements (command palette toggle icon, chevron icon in disclosure) are small (< 44px)

**Finding R4: Immersive Scanner Route Mobile Layout**
- `immersiveScannerRoute` hides sidebar completely
- `AppShell` changes padding on the workstation frame
- Top bar is hidden for scanner routes
- No explicit scanner-optimized mobile layout

**Finding R5: Hardcoded Spacing in Pages**
- `app-shell.tsx` uses `px-10` (40px) for dashboard topbar, `px-6` for other page topbars
- Pages define their own `max-w-*` constraints (max-w-6xl, max-w-[1600px], max-w-2xl, etc.)
- No shared `content-width` token or `page-container` component
- `space-y-*` gaps vary between pages and are not governed

---

## 5. Actionable Findings Summary

### P0 — Blocking (must fix before Phase 2.1)

| ID | Issue | Location | Impact |
|---|---|---|---|
| R1 | No route group segments | app/ layout | All pages inherit full app shell; auth pages use runtime check instead of route grouping |
| N1 | Registry metadata duplicated in sidebar | app-sidebar.tsx | Adding nav items requires 3 edits; match/description drift inevitable |
| R3 | No per-route error.tsx boundaries | app/*/ | A crash in any sub-page falls through to root error handler — no isolated recovery |
| R4 | Duplicate auth routes /access and /login | Both exist | Split authentication surface; inconsistent user experience |

### P1 — High Priority (fix in Phase 2.2–2.3)

| ID | Issue | Location | Impact |
|---|---|---|---|
| N2 | Three permission systems | sidebar + registry + RoleGate | Permission logic is duplicated and hard to audit |
| L3 | Component duplication across shared/ and components/ui/ | 4 duplicate components | Dual maintenance surface; one copy inevitably drifts |
| R2 | Density infrastructure incomplete | Multiple primitives | Density setting doesn't fully affect form controls, sidebar, or typography |
| N4 | Hardcoded i18n nav labels | app-sidebar.tsx | i18n keys duplicate nav structure instead of deriving from it |

### P2 — Important (fix in Phase 2.4–2.7)

| ID | Issue | Location | Impact |
|---|---|---|---|
| R5 | No canonical PageShell component | All pages | Every page invents spacing, headers, containers |
| N3 | Mobile nav config duplicated | sidebar + role-navigation.ts | Mobile nav items drift from master nav config |
| R1 (tablet) | No tablet-responsive layout | All layouts | Tablet users get suboptimal mobile experience |
| L2 | Auth shell has 3 variants | Multiple files | Auth page pattern is unclear; new auth pages may create a 4th variant |

### Orphan Routes (no page.tsx)

| Route | Nav Item | Priority |
|---|---|---|
| /attendance/live | attendance | P2 |
| /attendance/review | attendance-review | P2 |
| /attendance/reports | attendance-reports | P2 |
| /steel/batches | steel-batches | P2 |
| /steel/charts | steel-charts | P2 |
| /steel/customers | customers | P2 |
| /steel/dispatches | dispatch | P2 |
| /steel/invoices | sales-invoices | P2 |
| /steel/reconciliations | stock-review | P2 |
| /work-queue | work-queue | P1 |

---

## 6. Phase 2 Sequencing Recommendations

Based on audit findings, the Phase 2 execution order should be:

```
2.0  Audit (this document)                          ← You are here
2.1  Route + Layout Governance Foundation
     └─ Fix R1 (route group segments)
     └─ Define route governance rules
2.2  PageShell Foundation
     └─ Fix R5 (canonical page wrapper)
     └─ Fix L2 (auth shell consolidation)
2.3  Sidebar System Refactor
     └─ Fix N1 (registry duplication)
     └─ Fix N2 (permission consolidation)
2.4  Navigation Config System
     └─ Hardened registry with metadata
     └─ Single source of truth for nav
2.5  Role + Permission Infrastructure
     └─ Centralize permission checks
2.6  Topbar + Header System
     └─ Governed header patterns
2.7  Mobile + Responsive System
     └─ Fix tablet gap, density, touch targets
2.8  Shell State + UI Infrastructure
2.9  Shell Testing + Validation
2.10 Final Governance + Enforcement
```

---

*End of Phase 2.0 Audit Report*
