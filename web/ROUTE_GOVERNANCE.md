# Phase 2.1 — Route + Layout Governance Foundation

> Version 1.0 — June 2026
> Defines route segment architecture, layout hierarchy, route governance rules, and shell contracts.

---

## 1. Route Segment Architecture

### 1.1 Route Groups

All application routes are organized into **four** route groups:

| Route Group | Segment | Purpose | Shell Visible? |
|---|---|---|---|
| **Public** | `(public)` | Landing pages, error pages | No |
| **Auth** | `(auth)` | Authentication workflow | No |
| **Workspace** | `(workspace)` | Operational pages | Yes |
| **Scanner** | `(scanner)` | Camera/OCR immersive | Yes (minimal shell) |

### 1.2 Route-to-Group Mapping

```
app/
├── (public)/
│   ├── page.tsx              → HomeRoute (landing)           [current: app/page.tsx]
│   ├── loading.tsx           → DashboardPageSkeleton
│   ├── error.tsx             → Chunk reload + error report   [current: app/error.tsx]
│   ├── not-found.tsx         → 404 page                      [current: app/not-found.tsx]
│   ├── 403/
│   │   └── page.tsx          → AccessRestrictedPage
│   └── offline/
│       └── page.tsx          → OfflinePage
│
├── (auth)/
│   ├── layout.tsx            → Minimal shell (no AppShell, no sidebar)
│   ├── login/
│   │   └── page.tsx          → Login page                   [merge /access + /login]
│   ├── register/
│   │   └── page.tsx          → RegisterPage
│   ├── forgot-password/
│   │   └── page.tsx          → ForgotPasswordPage
│   ├── reset-password/
│   │   └── page.tsx          → ResetPasswordPage
│   ├── verify-email/
│   │   └── page.tsx          → VerifyEmailPage
│   └── factory-required/     (moved from /onboarding)
│       └── page.tsx          → FactoryRequiredPage
│
├── (workspace)/
│   ├── layout.tsx            → AppShell + sidebar
│   ├── template.tsx          → Fade-in animation (root)
│   ├── dashboard/
│   │   └── page.tsx          → DashboardPage
│   ├── approvals/
│   │   ├── layout.tsx        → FeatureErrorBoundary
│   │   └── page.tsx
│   ├── attendance/
│   │   ├── layout.tsx        → FeatureErrorBoundary
│   │   ├── page.tsx
│   │   ├── live/page.tsx     → (create from nav config)
│   │   ├── review/page.tsx   → (create from nav config)
│   │   └── reports/page.tsx  → (create from nav config)
│   ├── billing/
│   │   └── page.tsx
│   ├── control-tower/
│   │   └── page.tsx
│   ├── email-summary/
│   │   └── page.tsx
│   ├── entry/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── ocr/
│   │   ├── layout.tsx        → FeatureErrorBoundary
│   │   ├── page.tsx
│   │   ├── scan/page.tsx
│   │   ├── verify/page.tsx
│   │   ├── history/page.tsx
│   │   └── jobs/page.tsx     → (create from nav config)
│   ├── plans/
│   │   └── page.tsx
│   ├── premium/
│   │   └── dashboard/page.tsx
│   ├── profile/
│   │   └── page.tsx
│   ├── reports/
│   │   └── page.tsx
│   ├── settings/
│   │   ├── page.tsx
│   │   └── attendance/page.tsx
│   ├── steel/
│   │   ├── layout.tsx        → FeatureErrorBoundary
│   │   ├── page.tsx
│   │   ├── batches/page.tsx  → (create from nav config)
│   │   ├── charts/page.tsx   → (create from nav config)
│   │   ├── customers/page.tsx → (create from nav config)
│   │   ├── dispatches/page.tsx → (create from nav config)
│   │   ├── inventory/
│   │   │   ├── page.tsx
│   │   │   └── transactions/page.tsx
│   │   ├── invoices/page.tsx → (create from nav config)
│   │   ├── production/
│   │   │   └── record/page.tsx
│   │   └── reconciliations/page.tsx → (create from nav config)
│   ├── tasks/
│   │   └── page.tsx
│   └── work-queue/
│       └── page.tsx           → (create from nav config)
│
└── (scanner)/
    └── scan/
        └── page.tsx           → OCR camera view (immersive)
```

### 1.3 Group Layout Responsibilities

| Group | Layout Provides | Does NOT Provide |
|---|---|---|
| `(public)` | Font loading, metadata, viewport, providers | Sidebar, topbar, auth checks |
| `(auth)` | AuthWorkstationShell, header, skip link | Sidebar, navigation, command palette |
| `(workspace)` | AppShell, sidebar, topbar, context rail, command palette | Auth-only layouts, camera UI |
| `(scanner)` | Camera viewport, minimal chrome | Navigation, sidebar, full shell |

### 1.4 Orphan Route Resolution

Routes that exist as nav config entries but have no `page.tsx` must be created as placeholder pages. Priority:

```typescript
const ORPHAN_ROUTES = {
  P1: ["/work-queue"],              // Critical nav item, no page
  P2: [
    "/attendance/live",
    "/attendance/review",
    "/attendance/reports",
    "/steel/batches",
    "/steel/charts",
    "/steel/customers",
    "/steel/dispatches",
    "/steel/invoices",
    "/steel/reconciliations",
    "/ocr/jobs",
  ],
} as const;
```

---

## 2. Layout Hierarchy

### 2.1 Hierarchy Levels

```
Level 0: RootLayout (app/layout.tsx)
├── Global fonts (IBM Plex Sans, IBM Plex Mono)
├── Viewport metadata
├── Theme/density initialization script
├── Skip-to-content link
├── AppProviders
│   ├── Theme, auth, i18n, RQ, UI preferences
│   └── Error boundary wrappers

Level 1: GroupLayout (app/(workspace)/layout.tsx, app/(auth)/layout.tsx)
├── Route-group-specific shell
├── (workspace) → AppShell with sidebar, topbar, context rail
├── (auth) → Minimal shell, no sidebar
└── (public) → No additional layout (uses RootLayout only)

Level 2: FeatureLayout (app/(workspace)/ocr/layout.tsx)
├── FeatureErrorBoundary
├── Feature-specific providers (if needed)
└── Nested route loading states

Level 3: PageLayout (individual page.tsx)
├── PageShell wrapper (if needed)
├── Page-specific content
└── Page-level suspense boundaries
```

### 2.2 What Each Level Owns

| Level | Owns | Does NOT Own |
|---|---|---|
| RootLayout | Fonts, viewport, global styles, providers, service worker | Navigation, page content, feature-specific state |
| GroupLayout | Shell chrome, sidebar state, route-level auth guard | Feature-specific state, page layout |
| FeatureLayout | Feature error boundary, sub-route navigation | Global state, auth logic |
| PageLayout | Page content, data fetching, page-specific loading/error | Feature-level state, shell chrome |

### 2.3 Provider Placement Rules

| Provider | Placement | Rationale |
|---|---|---|
| Theme/Density | RootLayout `<html>` | Must execute before React hydration |
| Auth (Session) | AppProviders | Required by AppShell and all pages |
| i18n | AppProviders | Required by AppShell and all pages |
| React Query | AppProviders | Required by all data-fetching pages |
| UI Preferences | AppProviders | Required by AppShell |
| Badge Counts | AppProviders → BadgeProvider | Required by sidebar |
| Feature-specific Zustand | FeatureLayout or Page | Scoped to feature |
| Form Providers | Page | Scoped to page workflow |
| Command Registry | AppShell | Scoped to shell interaction |

---

## 3. Route Governance Rules

### 3.1 Loading States (`loading.tsx`)

```
RULE: Every route group directory MUST have a loading.tsx.
RULE: Every leaf page SHOULD have a loading.tsx if it fetches data.
RULE: Root loading.tsx MUST match the app's highest-level skeleton.
RULE: Feature loading.tsx SHOULD match feature-specific content patterns.
RULE: Page loading.tsx MUST NOT use full-page skeletons (use inline spinners).
```

**Compliance Matrix:**

| Location | Current | Requirement | Status |
|---|---|---|---|
| Root | ✅ DashboardPageSkeleton | Group-level skeleton | ✅ |
| (auth) | ❌ None | Auth-themed skeleton | ❌ |
| (workspace) | ❌ None | Workspace skeleton | ❌ |
| Each feature | Varies | Feature skeleton | ⚠️ Partial |
| auth pages | Varied | Login form skeleton | ⚠️ Mixed |
| 403, offline | ❌ None | Minimal page skeleton | ❌ |

### 3.2 Error Boundaries (`error.tsx`)

```
RULE: EVERY route group MUST have an error.tsx.
RULE: EVERY feature group (sub-layout) MUST have an error.tsx.
RULE: error.tsx MUST be a client component ("use client").
RULE: error.tsx MUST include a "retry" mechanism (reset() or reload).
RULE: error.tsx MUST report errors to monitoring (reportFrontendError).
```

**Compliance Matrix:**

| Location | Current | Requirement | Status |
|---|---|---|---|
| Root | ✅ Error with chunk reload + error report | Root error boundary | ✅ |
| (auth) | ❌ None | Auth error boundary | ❌ |
| (workspace) | ❌ None | Workspace error boundary | ❌ |
| ocr | ✅ FeatureErrorBoundary (layout) | Feature error boundary | ✅ |
| steel | ✅ FeatureErrorBoundary (layout) | Feature error boundary | ✅ |
| attendance | ✅ FeatureErrorBoundary (layout) | Feature error boundary | ✅ |
| approvals | ✅ FeatureErrorBoundary (layout) | Feature error boundary | ✅ |
| All other features | ❌ None | Feature error boundary | ❌ |

### 3.3 Not-Found States (`not-found.tsx`)

```
RULE: Root MUST have a not-found.tsx.
RULE: Dynamic route segments SHOULD use notFound() rather than navigating.
```

**Compliance:**
- Root: ✅ `not-found.tsx` exists with dashboard/access links
- Dynamic routes: ❌ No `notFound()` calls detected

### 3.4 Template Rules (`template.tsx`)

```
RULE: Root template SHOULD provide consistent page transition animation.
RULE: Feature templates MAY provide feature-specific transitions.
```

**Current:** Root only has `template.tsx` with `animate-in fade-in duration-200`. No feature templates exist.

### 3.5 Scroll Behavior

```
RULE: AppShell frame controls scroll (overflow-y-auto on content div).
RULE: Individual pages MUST NOT set overflow on body/html.
RULE: Focus pages (entry, scanner, verify) MAY have controlled scroll.
RULE: Modal/drawer content MUST NOT scroll the page behind.
```

**Current:** AppShell sets `overflow-y-auto` on the workstation frame. Pages inside generally don't set scroll. ✅

---

## 4. Shell Contracts

### 4.1 Spacing Rules

```
RULE: PageShell padding MUST be consistent across all routes.
RULE: Padding values MUST use design tokens (px-6, px-10, py-8, py-10).
RULE: Dashboard routes use px-10; standard routes use px-6.
RULE: Content max-width MUST be governed by a shared token.
```

**Current state:**

| Route | Horizontal Padding | Max Width |
|---|---|---|
| Dashboard topbar | `px-10` | none |
| Standard topbar | `px-6` | none |
| HomeRoute | `px-6 lg:px-10` | `max-w-7xl` |
| EmailSummary | (via OperationalPageShell) | `max-w-[1600px]` |
| Auth routes | Shell-managed | Varies |

**Proposed unification:**
- Create a `content-width` CSS variable: `--content-max-width: 1600px`
- Standard content area: `max-w-[var(--content-max-width)] mx-auto px-6 lg:px-10`
- Dashboard: `px-10` (matches current dashboard layout)
- Auth forms: Center with `max-w-md` constrained by auth shell

### 4.2 PageShell Component Contract

```typescript
interface PageShellProps {
  // ── Regions ──
  header?: ReactNode;        // Optional page header
  actions?: ReactNode;       // Action buttons area (top-right)
  breadcrumbs?: ReactNode;   // Breadcrumb navigation
  children: ReactNode;       // Main content
  footer?: ReactNode;        // Optional page footer

  // ── Behavior ──
  variant?: "default" | "dashboard" | "focus";
  className?: string;

  // ── Metadata ──
  title?: string;
  description?: string;
  eyebrow?: string;          // Small label above title

  // ── Content width ──
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
}
```

### 4.3 Scroll Contract

```
RULE: overflow-y-auto lives on the workspace content frame (AppShell).
RULE: Sticky headers use z-sticky inside the scroll container.
RULE: Full-height pages (scanner, camera) use min-h-screen.
RULE: Page content may not set overflow on body, html, or #__next.
```

### 4.4 Density Adaptation

```
RULE: Each shell level responds to [data-density] on <html>.
RULE: Padding scales with density (compact=px-4, default=px-6, comfortable=px-8).
RULE: Row heights scale with density (compact=h-row-compact, default=h-row).
RULE: Typography does NOT scale with density (font sizes are fixed).
```

---

## 5. Implementation Roadmap

### Step 1 — Create Route Groups (P0)
```
Create (public)/, (auth)/, (workspace)/ directories
Move existing pages into appropriate groups
Create group layout files
Consolidate /access + /login
```

### Step 2 — Add Error Boundaries (P0)
```
Add error.tsx to (auth)/ and (workspace)/
Add error.tsx to all feature groups without one
```

### Step 3 — Create PageShell Component (P1)
```
Create shared/operational/page-shell.tsx
Migrate OperationalPageShell to canonical contract
Replace ad-hoc page wrappers
```

### Step 4 — Add Missing Loading States (P1)
```
Add loading.tsx to (auth)/, (workspace), and orphan routes
```

### Step 5 — Create Orphan Route Placeholders (P2)
```
Create minimal page.tsx for all 10 orphan nav items
```

### Step 6 — Standardize Spacing (P2)
```
Create content-width CSS variable
Apply consistent padding across all workspace pages
```

---

## 6. Auth Route Consolidation Plan

### 6.1 Current State
- `/access` → login page via `AuthWorkstationShell`
- `/login` → separate login page with `loading.tsx`
- Shell hidden route set includes BOTH `/access` AND `/login`

### 6.2 Target State
```
(auth)/layout.tsx → Provides AuthWorkstationShell wrapper
(auth)/login/page.tsx → Canonical login page (consolidates /access + /login)
(auth)/register/page.tsx → Registration page
(auth)/forgot-password/page.tsx → Password recovery
(auth)/reset-password/page.tsx → Password reset
(auth)/verify-email/page.tsx → Email verification
(auth)/factory-required/page.tsx → Factory access gate
```

### 6.3 Redirect Strategy
- `/access` → 301 redirect to `/login`
- `/login` → canonical login page
- `isShellHiddenRoute` replaced by route group membership

---

*End of Phase 2.1 — Route + Layout Governance Foundation*
