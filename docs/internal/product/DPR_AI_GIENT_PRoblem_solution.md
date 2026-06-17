# DPR.ai Frontend Problem → Solution Plan

> **Derived from:** `DPR_AI_GIENTrefactory.md` (Architecture Audit)
> **Date:** June 7, 2026
> **Stack:** Next.js 16 · React 19 · Tailwind CSS 4 · TypeScript · TanStack Query/Table · React Hook Form · Zod · ApexCharts

---

## Table of Contents

1. [Problem Index](#1-problem-index)
2. [Phase 1: Emergency Containment (Week 1–2)](#phase-1-emergency-containment-week-12)
3. [Phase 2: Structural Reorganization (Week 3–4)](#phase-2-structural-reorganization-week-34)
4. [Phase 3: God Component Decomposition (Week 5–8)](#phase-3-god-component-decomposition-week-58)
5. [Phase 4: Styling System Enforcement (Week 9–10)](#phase-4-styling-system-enforcement-week-910)
6. [Phase 5: State Architecture & Quality (Week 11–14)](#phase-5-state-architecture--quality-week-1114)
7. [Phase 6: Prevention & Governance (Week 15+)](#phase-6-prevention--governance-week-15)
8. [Dependency Graph](#8-dependency-graph)
9. [Validation Checkpoints](#9-validation-checkpoints)
10. [Do NOT Touch List](#10-do-not-touch-list)

---

## 1. Problem Index

Each problem maps to one or more solution phases. The **Risk** column uses the audit's severity rating.

| # | Problem | Files/Lines | Risk | Solution Phase |
|---|---------|-------------|------|----------------|
| P1 | God component: `ocr-scan-page.tsx` | 1 file, 2,937 lines, 49 useState | 🔴 CRITICAL | Phase 3, Step 3.1 |
| P2 | God component: `approvals-page.tsx` | 1 file, 2,605 lines, 175 returns | 🔴 CRITICAL | Phase 3, Step 3.2 |
| P3 | God component: `dashboard-home-workspace.tsx` | 1 file, 2,525 lines, 31 useState | 🔴 CRITICAL | Phase 3, Step 3.3 |
| P4 | 4 competing dashboard implementations | 4 files, ~4,900 lines total | 🔴 CRITICAL | Phase 3, Step 3.4 |
| P5 | 3 competing OCR implementations | 3+ files, ~5,800 lines total | 🟠 HIGH | Phase 2, Step 2.3 |
| P6 | Monolithic `globals.css` (3,829 lines) | 1 file | 🔴 CRITICAL | Phase 4, Step 4.5 |
| P7 | Token bypassing (500+ hardcoded colors) | 50+ files | 🔴 CRITICAL | Phase 4, Steps 4.1–4.4 |
| P8 | Only 1 error boundary for 50 pages | 1 file | 🔴 CRITICAL | Phase 1, Step 1.1 |
| P9 | Near-zero test coverage (4 test files) | 209 untested components | 🔴 CRITICAL | Phase 5, Step 5.4 |
| P10 | Empty `src/core/` (62 lines) | 2 hollow files | 🟠 HIGH | Phase 2, Step 2.5 |
| P11 | `src/lib/` contains everything (12,938 lines) | 1 directory | 🟠 HIGH | Phase 2, Step 2.6 |
| P12 | `src/features/` only has 2 of 8 workflows | 2 feature folders | 🟠 HIGH | Phase 2, Steps 2.1–2.4 |
| P13 | 200+ flat components with no structure | `src/components/` | 🟠 HIGH | Phase 2, Step 2.7 |
| P14 | Zero `useReducer` usage | 0 across codebase | 🟠 HIGH | Phase 5, Step 5.1 |
| P15 | No centralized UI state store | 0 Zustand/Redux | 🟠 HIGH | Phase 5, Step 5.2 |
| P16 | i18n monolith (1,316 lines, 1,720 refs) | 1 file | 🟠 HIGH | Phase 5, Step 5.3 |
| P17 | 46 routes missing `loading.tsx` | 46 routes | 🟠 HIGH | Phase 1, Step 1.3 |
| P18 | 168 custom `shadow-[...]` values | 50+ files | 🟠 HIGH | Phase 4, Step 4.3 |
| P19 | 94 glassmorphism remnants | 30+ files | 🟡 MEDIUM | Phase 4, Step 4.4 |
| P20 | 56 inline `style=` attributes | 30+ files | 🟡 MEDIUM | Phase 4, Step 4.2 |
| P21 | React Hook Form low adoption (13 uses) | 13 files | 🟡 MEDIUM | Phase 5, Step 5.5 |
| P22 | No barrel exports (1 file) | 213 components | 🟡 MEDIUM | Phase 2, Step 2.8 |
| P23 | Border radius fragmentation (6+ variants) | 100+ files | 🟡 MEDIUM | Phase 4, Step 4.6 |
| P24 | Stale "modern indigo accent" comments | globals.css | 🟡 LOW | Phase 1, Step 1.4 |
| P25 | 11 console statements in production | 11 occurrences | 🟡 LOW | Phase 1, Step 1.5 |
| P26 | 7 TODO stubs in OCR scanner | `ocr-scan-page.tsx` | 🟡 LOW | Phase 1, Step 1.6 |

---

## Phase 1: Emergency Containment (Week 1–2)

> **Goal:** Stop the bleeding. Zero-risk changes that prevent cascading failures.
> **Risk Level:** LOW — All changes are deletions, additions, or comment-only edits.

### Step 1.1: Add Per-Feature Error Boundaries

**Problem:** P8 — Single error boundary for 50 pages. One bug crashes the entire app.

**Solution:** Create a reusable `FeatureErrorBoundary` component and wrap each feature route.

```tsx
// src/components/shared/feature-error-boundary.tsx
"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  feature: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class FeatureErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="text-sm font-semibold text-status-danger-fg">
              {this.props.feature} encountered an error
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="rounded-lg bg-action-primary px-4 py-2 text-sm text-action-primary-text"
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
```

**Files to create:**
- `src/components/shared/feature-error-boundary.tsx`

**Files to modify (wrap existing page content):**
- `src/app/ocr/layout.tsx` — new file
- `src/app/approvals/layout.tsx` — new file
- `src/app/attendance/layout.tsx` — new file
- `src/app/steel/layout.tsx` — new file

**Validation:**
- `npm run build` passes
- Manually trigger error in dev mode → error boundary catches it, rest of app unaffected

---

### Step 1.2: Delete Dead Code

**Problem:** P5 (partial) — `legacy-ui/ocr/ocr-verification-v2-page.tsx` is 1,147 lines of dead code.

**Solution:**
```bash
# Verify no imports reference this file
grep -rn "ocr-verification-v2" web/src/
# If zero results, delete
rm web/src/legacy-ui/ocr/ocr-verification-v2-page.tsx
# If legacy-ui/ is now empty, remove it
rmdir web/src/legacy-ui/ocr/ 2>/dev/null
rmdir web/src/legacy-ui/ 2>/dev/null
```

**Validation:**
- `npm run build` passes with zero references to deleted file
- `grep -rn "legacy-ui" web/src/` returns nothing

---

### Step 1.3: Add Loading States for 46 Missing Routes

**Problem:** P17 — Only 4 of 50 routes have `loading.tsx`.

**Solution:** Create a reusable `PageSkeleton` and add `loading.tsx` to every route that lacks one.

```tsx
// src/components/shared/page-skeleton.tsx
export function PageSkeleton() {
  return (
    <div className="operational-page animate-pulse">
      <div className="operational-page__inner">
        <div className="skeleton-shimmer h-24 w-full rounded-lg" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-shimmer h-32 rounded-lg" />
          ))}
        </div>
        <div className="skeleton-shimmer h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}
```

Then add a `loading.tsx` to each route:
```tsx
// e.g., src/app/analytics/loading.tsx
import { PageSkeleton } from "@/components/shared/page-skeleton";
export default function Loading() {
  return <PageSkeleton />;
}
```

**Routes needing `loading.tsx` (46 total):**
```
/analytics, /approvals, /attendance, /attendance/live,
/attendance/reports, /attendance/review, /billing,
/control-tower, /email-summary, /entry, /ocr,
/ocr/history, /ocr/scan, /ocr/verify, /plans,
/premium/dashboard, /settings, /settings/attendance,
/steel, /steel/batches, /steel/charts, /steel/customers,
/steel/dispatches, /steel/inventory, /steel/invoices,
/steel/reconciliations, /tasks, /work-queue, /access,
/403, /offline, /onboarding/factory-required,
/ai, /profile, /forgot-password, /reset-password,
/verify-email, /register, /login, ... (all routes)
```

**Validation:**
- Navigate to each route → loading skeleton appears briefly before content loads
- `find web/src/app -name 'loading.tsx' | wc -l` → ≥40

---

### Step 1.4: Clean Stale Comments

**Problem:** P24 — "modern indigo accent" comments reference old palette.

**Solution:**
```bash
cd web
grep -rn "modern indigo accent" src/ --include='*.css' --include='*.tsx' | head -20
```
Replace each occurrence with `/* Iron & Teal accent */` or remove the comment entirely.

**Validation:**
- `grep -rn "modern indigo accent" src/` returns 0 results

---

### Step 1.5: Remove Console Statements

**Problem:** P25 — 11 console.log/error/warn in production components.

**Solution:**
```bash
cd web
grep -rn 'console\.\(log\|error\|warn\)' src/components/ --include='*.tsx' -l
```
Remove each occurrence. For console.error that provides useful debugging context, convert to a comment or use a proper error reporting service.

**Validation:**
- `grep -rn 'console\.\(log\|error\|warn\)' src/components/ --include='*.tsx' | wc -l` → 0

---

### Step 1.6: Fix TODO Stubs in OCR Scanner

**Problem:** P26 — 7 `// TODO: requires backend endpoint` in `ocr-scan-page.tsx`.

**Solution:** For each TODO, either:
1. Implement the stub if the backend endpoint exists
2. Add a `toast.warning("Feature coming soon")` placeholder
3. Disable the UI element with a tooltip explaining why

**Validation:**
- `grep -rn "TODO" src/components/ocr-scan-page.tsx` returns 0 results
- Build passes

---

## Phase 2: Structural Reorganization (Week 3–4)

> **Goal:** Establish correct file boundaries. Move code to the right folders.
> **Risk Level:** MEDIUM — Import path changes, but no logic changes.

### Step 2.1: Create `src/features/steel/` and Move Steel Components

**Problem:** P12 — Steel components are in `src/components/` instead of `src/features/steel/`.

**Solution:**
```
mkdir -p src/features/steel/components
mkdir -p src/features/steel/hooks
```

Move files:
```bash
mv src/components/steel-customer-ledger-page.tsx src/features/steel/
mv src/components/steel-dispatch-detail-page.tsx src/features/steel/
mv src/components/steel-command-center-page.tsx src/features/steel/
mv src/components/steel-dispatches-page.tsx src/features/steel/
mv src/components/steel-customers-page.tsx src/features/steel/
mv src/components/steel-production-record-page.tsx src/features/steel/
mv src/components/steel-reconciliations-page.tsx src/features/steel/
mv src/components/steel-invoices-page.tsx src/features/steel/
mv src/components/steel-summary-primitives.tsx src/features/steel/components/
mv src/components/steel-charts-page.tsx src/features/steel/
```

**Update imports in route files:**
```bash
# Find all files importing moved components
grep -rn "from.*steel-" src/app/ --include='*.tsx' -l
# Update each import path
```

**Validation:**
- `npm run build` passes
- Navigate to `/steel/*` routes → all render correctly

---

### Step 2.2: Create `src/features/ocr/` and Consolidate OCR

**Problem:** P5 — OCR components scattered across 5+ locations.

**Solution:**
```
mkdir -p src/features/ocr/components
mkdir -p src/features/ocr/hooks
mkdir -p src/features/ocr/lib
```

Move files:
```bash
# Move main OCR pages
mv src/components/ocr-scan-page.tsx src/features/ocr/
mv src/components/ocr-page.tsx src/features/ocr/
mv src/components/ocr-history-page.tsx src/features/ocr/

# Move OCR sub-components
mv src/components/ocr/ src/features/ocr/components/

# Move OCR library code
mv src/lib/ocr.ts src/features/ocr/lib/

# Update route imports
grep -rn "from.*ocr-scan-page\|from.*ocr-page\|from.*ocr-history" src/app/ --include='*.tsx' -l
```

**Validation:**
- `npm run build` passes
- Navigate to `/ocr/*` routes → all render correctly

---

### Step 2.3: Create `src/features/approvals/` and Consolidate

**Problem:** P2 — Approval logic exists in monolithic page AND in feature adapters.

**Solution:**
```
mkdir -p src/features/approvals/components
mkdir -p src/features/approvals/hooks
```

Move files:
```bash
mv src/components/approvals-page.tsx src/features/approvals/
```

**Decision point:** The `features/entry/` approval adapters — keep them in `entry/` since they're entry-specific, but extract shared approval utilities to `features/approvals/lib/approval-utils.ts`.

**Validation:**
- `npm run build` passes
- Navigate to `/approvals` → renders correctly

---

### Step 2.4: Create `src/features/attendance/` and Consolidate

**Solution:**
```
mkdir -p src/features/attendance/components
mkdir -p src/features/attendance/hooks
```

Move files:
```bash
mv src/components/attendance-page.tsx src/features/attendance/
mv src/components/attendance-review-page.tsx src/features/attendance/
mv src/components/settings-attendance-page.tsx src/features/attendance/
```

**Validation:** Build passes, routes render.

---

### Step 2.5: Populate `src/core/` with Real Abstractions

**Problem:** P10 — `src/core/` is 62 lines of hollow placeholders.

**Solution:** Extract session management, permission checks, and role resolution from scattered locations.

```typescript
// src/core/permissions.ts
import type { CurrentUser } from "@/lib/auth";

export function hasPermission(user: CurrentUser | null, permission: keyof Permissions): boolean {
  if (!user) return false;
  return user.permissions[permission] === true;
}

export function requirePermission(user: CurrentUser | null, permission: keyof Permissions): void {
  if (!hasPermission(user, permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export type Permissions = {
  can_view_billing: boolean;
  can_manage_users: boolean;
  can_view_admin_panel: boolean;
  can_approve_entries: boolean;
  can_manage_factory: boolean;
  can_view_reports: boolean;
  can_manage_ocr: boolean;
  can_manage_attendance: boolean;
  can_manage_inventory: boolean;
  // ... all permissions from auth.ts
};
```

```typescript
// src/core/session.ts
import type { CurrentUser } from "@/lib/auth";

export type SessionState = {
  user: CurrentUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

export function createInitialSession(): SessionState {
  return { user: null, isLoading: true, isAuthenticated: false };
}
```

**Validation:**
- Build passes
- All existing auth/permission checks still work (they import from `src/lib/auth.ts` which re-exports)

---

### Step 2.6: Split `src/lib/` into Services, Domain, Utils

**Problem:** P11 — `src/lib/` is 12,938 lines mixing business logic + API + utilities.

**Solution:**
```
mkdir -p src/services    # API call functions
mkdir -p src/domain      # Business logic
```

Move files:
```bash
# API layer → src/services/
mv src/lib/api.ts src/services/
mv src/lib/steel.ts src/services/steel-api.ts
mv src/lib/ocr.ts src/services/ocr-api.ts
mv src/lib/attendance.ts src/services/attendance-api.ts
mv src/lib/auth.ts src/services/auth-api.ts

# Business logic → src/domain/
mv src/lib/industrial-dashboard.ts src/domain/
mv src/lib/offline-entries.ts src/domain/

# Pure utilities → stays in src/lib/
# Keep: cn.ts, formatters, validators
```

**Create re-export barrel:**
```typescript
// src/services/index.ts
export { apiFetch, ApiError } from "./api";
export * as steelApi from "./steel-api";
export * as ocrApi from "./ocr-api";
```

**Validation:**
- Build passes (update all imports)
- `grep -rn "from.*@/lib/steel\|from.*@/lib/ocr\|from.*@/lib/attendance" src/ --include='*.tsx' | wc -l` → 0

---

### Step 2.7: Organize `src/components/` into Subdirectories

**Problem:** P13 — 200+ flat components with no structure.

**Solution:**
```
src/components/
├── ui/                  # Shared primitives (keep as-is)
├── layout/              # NEW: App shell, Sidebar, TopBar
├── shared/              # NEW: Cross-feature components
├── charts/              # KEEP: Chart components
├── dashboard/           # KEEP: Dashboard-specific (will move to features/)
├── motion/              # KEEP: Animation wrappers
└── [remaining files]    # Will migrate to features/ in Phase 3
```

Move:
```bash
mkdir -p src/components/layout
mkdir -p src/components/shared

mv src/components/app-sidebar.tsx src/components/layout/
mv src/components/feedback-widget.tsx src/components/shared/
mv src/components/notification-center.tsx src/components/shared/
mv src/components/error-feedback-prompt.tsx src/components/shared/
mv src/components/micro-feedback-prompt.tsx src/components/shared/
mv src/components/beta-rollout-banner.tsx src/components/shared/
```

**Validation:** Build passes, all pages render.

---

### Step 2.8: Add Barrel Exports

**Problem:** P22 — 1 barrel file across 213 components.

**Solution:** Create `index.ts` barrel files for key directories:

```typescript
// src/components/ui/index.ts
export { Button } from "./button";
export { Card } from "./card";
export { Badge } from "./badge";
export { DataTable } from "./data-table/data-table";
// ... etc

// src/components/shared/index.ts
export { FeatureErrorBoundary } from "./feature-error-boundary";
export { PageSkeleton } from "./page-skeleton";
export { FeedbackWidget } from "./feedback-widget";
// ... etc
```

**Validation:** Build passes, imports work with barrel paths.

---

## Phase 3: God Component Decomposition (Week 5–8)

> **Goal:** Break monolithic components into focused, testable modules.
> **Risk Level:** HIGH — Logic refactoring, state redistribution, prop interface changes.
> **Prerequisite:** Phase 1 (error boundaries) and Phase 2 (folder structure) must be complete.

### Step 3.1: Decompose `ocr-scan-page.tsx` (2,937 lines → 6 files)

**Problem:** P1 — 49 useState, 10 useEffect, 129 conditionals, 7 TODOs in one file.

**Decomposition Strategy:**

```
src/features/ocr/
├── ocr-scan-page.tsx           # ~200 lines — orchestrator only
├── components/
│   ├── ocr-upload-zone.tsx     # ~300 lines — file upload, drag-drop, preview
│   ├── ocr-scan-controls.tsx   # ~250 lines — language, mode, scan trigger
│   ├── ocr-review-workspace.tsx # ~400 lines — cell editing, verification
│   ├── ocr-export-panel.tsx    # ~200 lines — export format, download
│   ├── ocr-source-viewer.tsx   # ~250 lines — image viewer, magnifier
│   └── ocr-stage-bar.tsx       # ~100 lines — upload → scan → review → export
├── hooks/
│   ├── use-ocr-state.ts        # useReducer for workflow steps
│   └── use-ocr-scan.ts         # TanStack Query for scan API
└── lib/
    ├── ocr-utils.ts            # Pure helpers
    └── ocr-api.ts              # API calls (moved from lib/ocr.ts)
```

**State Redistribution:**
```typescript
// src/features/ocr/hooks/use-ocr-state.ts
type OcrState = {
  step: "upload" | "scan" | "review" | "export";
  files: File[];
  jobId: string | null;
  results: OcrResult[];
  selectedCells: string[];
};

type OcrAction =
  | { type: "SET_STEP"; payload: OcrState["step"] }
  | { type: "ADD_FILES"; payload: File[] }
  | { type: "SET_JOB_ID"; payload: string }
  | { type: "SET_RESULTS"; payload: OcrResult[] }
  | { type: "TOGGLE_CELL"; payload: string }
  | { type: "RESET" };

function ocrReducer(state: OcrState, action: OcrAction): OcrState {
  switch (action.type) {
    case "SET_STEP": return { ...state, step: action.payload };
    case "ADD_FILES": return { ...state, files: [...state.files, ...action.payload] };
    case "SET_JOB_ID": return { ...state, jobId: action.payload };
    case "SET_RESULTS": return { ...state, results: action.payload };
    case "TOGGLE_CELL": {
      const id = action.payload;
      const selected = state.selectedCells.includes(id)
        ? state.selectedCells.filter(c => c !== id)
        : [...state.selectedCells, id];
      return { ...state, selectedCells: selected };
    }
    case "RESET": return initialState;
    default: return state;
  }
}
```

**Orchestrator Pattern:**
```typescript
// src/features/ocr/ocr-scan-page.tsx (~200 lines)
"use client";
import { useReducer } from "react";
import { ocrReducer, initialState } from "./hooks/use-ocr-state";
import { OcrUploadZone } from "./components/ocr-upload-zone";
import { OcrScanControls } from "./components/ocr-scan-controls";
import { OcrReviewWorkspace } from "./components/ocr-review-workspace";
import { OcrExportPanel } from "./components/ocr-export-panel";
import { OcrStageBar } from "./components/ocr-stage-bar";

export default function OcrScanPage() {
  const [state, dispatch] = useReducer(ocrReducer, initialState);

  return (
    <div className="factory-ocr-scope">
      <OcrStageBar currentStep={state.step} />
      {state.step === "upload" && <OcrUploadZone onFilesSelected={(files) => dispatch({ type: "ADD_FILES", payload: files })} />}
      {state.step === "scan" && <OcrScanControls jobId={state.jobId} onComplete={(results) => dispatch({ type: "SET_RESULTS", payload: results })} />}
      {state.step === "review" && <OcrReviewWorkspace results={state.results} />}
      {state.step === "export" && <OcrExportPanel results={state.results} />}
    </div>
  );
}
```

**Validation:**
- `npm run build` passes
- Navigate to `/ocr/scan` → full workflow works end-to-end
- Each sub-component renders independently in isolation
- `wc -l src/features/ocr/ocr-scan-page.tsx` → ~200 lines

---

### Step 3.2: Decompose `approvals-page.tsx` (2,605 lines → 5 files)

**Problem:** P2 — 28 useState, 175 returns, 136 conditionals.

**Decomposition:**
```
src/features/approvals/
├── approvals-page.tsx           # ~250 lines — orchestrator
├── components/
│   ├── approval-list.tsx        # ~400 lines — queue, filters, selection
│   ├── approval-detail.tsx      # ~350 lines — detail panel, facts, history
│   ├── approval-ai-insights.tsx # ~200 lines — AI interpretation panel
│   ├── approval-actions.tsx     # ~150 lines — approve/reject/escalate buttons
│   └── approval-header.tsx      # ~100 lines — title, meta, bulk actions
├── hooks/
│   ├── use-approvals.ts         # TanStack Query for approval data
│   └── use-approval-actions.ts  # Mutations for approve/reject
└── lib/
    └── approval-utils.ts        # Shared helpers
```

**State Redistribution:**
- `useReducer` for selection state (selected items, active detail item)
- TanStack Query for server data (approvals list, detail)
- Local state only for UI concerns (filters, search text, sort)

**Validation:** Build passes, `/approvals` route works end-to-end.

---

### Step 3.3: Decompose `dashboard-home-workspace.tsx` (2,525 lines → 5 files)

**Problem:** P3 — 31 useState, 109 conditionals.

**Decomposition:**
```
src/features/dashboard/workspaces/
├── dashboard-home-workspace.tsx  # ~300 lines — orchestrator
├── components/
│   ├── dashboard-kpis.tsx        # ~350 lines — KPI cards grid
│   ├── dashboard-reminders.tsx   # ~250 lines — reminder strip
│   ├── dashboard-workflows.tsx   # ~400 lines — workflow lanes
│   ├── dashboard-feed.tsx        # ~300 lines — activity feed
│   └── dashboard-intelligence.tsx # ~350 lines — AI insights panel
├── hooks/
│   ├── use-dashboard-data.ts     # TanStack Query for dashboard data
│   └── use-dashboard-filters.ts  # Filter state (date range, role)
└── lib/
    └── dashboard-utils.ts        # KPI calculations, formatters
```

**Validation:** Build passes, `/dashboard` route works.

---

### Step 3.4: Resolve 4 Dashboard Variants

**Problem:** P4 — 4 competing dashboard implementations.

**Solution:**
1. **Determine canonical:** Check which dashboard is routed to which role in `app-sidebar.tsx` navigation config
2. **Keep `dashboard-home-workspace.tsx`** as the primary (already decomposed in Step 3.3)
3. **Archive `dashboard-refined.tsx`** and `industrial-factory-dashboard.tsx` — move to `src/deprecated/`
4. **Merge `premium-dashboard-page.tsx`** unique features into the canonical dashboard, then archive

```bash
# Archive duplicates
mkdir -p src/deprecated/dashboards
mv src/components/dashboard-refined.tsx src/deprecated/dashboards/
mv src/components/premium-dashboard-page.tsx src/deprecated/dashboards/
mv src/components/dashboard/industrial-factory-dashboard.tsx src/deprecated/dashboards/

# Remove old dashboard directory (after extracting unique features)
rm -rf src/components/dashboard/
```

**Validation:**
- Only one dashboard variant remains active
- Build passes
- All role-based dashboard routing works

---

## Phase 4: Styling System Enforcement (Week 9–10)

> **Goal:** Make the token system the single source of truth. Eliminate hardcoded styles.
> **Risk Level:** MEDIUM — Many files touched, but changes are mechanical.

### Step 4.1: Replace Hardcoded Hex Colors

**Problem:** P7 — 50+ hardcoded hex colors in TSX files.

**Solution:** Systematic find-and-replace using the token mapping:

| Hardcoded Value | Token Replacement |
|----------------|-------------------|
| `#111827` | `text-text-primary` |
| `#e5e7eb` / `#e7eaee` | `border-border-default` |
| `#8a93a0` | `text-text-tertiary` |
| `#ffffff` | `text-text-inverse` or `bg-white` |
| `rgba(62,166,255,...)` | `border-border-info` / `bg-bg-info` |
| `rgba(239,68,68,...)` | `border-status-danger-border` |
| `rgba(34,211,238,...)` | `text-text-teal` / `bg-bg-teal-subtle` |

```bash
# Find all hardcoded hex colors in TSX
grep -rn '#[0-9a-fA-F]\{6\}\|#[0-9a-fA-F]\{3\}\b' src/components/ src/app/ --include='*.tsx' | grep -v 'node_modules'
```

**Tool:** Use `sed` or a codemod script for bulk replacement, then manually review edge cases.

**Validation:**
- `grep -rn '#[0-9a-fA-F]\{6\}' src/components/ src/app/ --include='*.tsx' | wc -l` → 0
- Visual QA in both light and dark modes

---

### Step 4.2: Replace Inline `style=` Attributes

**Problem:** P20 — 56 inline style attributes.

**Solution:** Classify each:
- **Dynamic values** (progress bars, bounding boxes) → Keep (justified)
- **Font config** → Replace with `font-body` / `font-mono` classes
- **Background colors** → Replace with token classes
- **Shadow values** → Replace with `shadow-sm` / `shadow-md` / `shadow-lg`

```bash
grep -rn 'style=' src/components/ --include='*.tsx' | grep -v 'progress\|width.*%\|height.*%'
# These are the candidates for replacement
```

**Validation:** Visual QA, build passes.

---

### Step 4.3: Replace Custom Shadow Arbitrary Values

**Problem:** P18 — 168 `shadow-[...]` custom values.

**Solution:**

| Pattern | Replacement |
|---------|-------------|
| `shadow-[0_1px_2px_rgba(...)]` | `shadow-sm` |
| `shadow-[0_4px_12px_rgba(...)]` | `shadow-md` |
| `shadow-[0_8px_24px_rgba(...)]` | `shadow-lg` |
| `shadow-[0_20px_25px_rgba(...)]` | `shadow-xl` |
| `shadow-[inset_0_1px_0_rgba(...)]` | Keep if unique, otherwise `shadow-inner` |
| `shadow-[0_0_0_3px_rgba(...)]` | `shadow-focus` (token) |

```bash
grep -rn 'shadow-\[' src/components/ --include='*.tsx' | wc -l
# Target: 0
```

**Validation:** Visual QA (shadows should look identical or better).

---

### Step 4.4: Remove or Consolidate Glassmorphism

**Problem:** P19 — 94 glassmorphism references.

**Solution:** Decision matrix:
- **Auth pages** → Keep `backdrop-blur` (it's intentional for the auth aesthetic)
- **Cards/panels** → Remove `backdrop-blur` (industrial palette should be opaque)
- **Drawers/modals** → Keep `backdrop-blur` on backdrop overlay only

```bash
# Audit glassmorphism usage
grep -rn 'backdrop-blur\|glass-panel\|glass-' src/components/ --include='*.tsx' | wc -l
```

For each occurrence, decide: keep or remove based on context.

**Validation:** Visual QA — no broken blur effects.

---

### Step 4.5: Decompose `globals.css` (3,829 lines → 8 files)

**Problem:** P6 — Monolithic stylesheet.

**Solution:**
```
src/styles/
├── tokens.css              # KEEP: design tokens (656 lines)
├── globals.css             # SLIM: only resets, base typography, Tailwind bridge (~200 lines)
├── animations.css          # NEW: all @keyframes + animation utilities (~300 lines)
├── auth.css                # NEW: auth page styles (~400 lines)
├── ocr.css                 # NEW: OCR workstation styles (~300 lines)
├── dashboard.css           # NEW: dashboard component styles (~500 lines)
├── industrial.css          # NEW: industrial component classes (~600 lines)
├── approvals.css           # NEW: approval queue styles (~200 lines)
├── scrollbar.css           # NEW: scrollbar + utility classes (~100 lines)
└── third-party.css         # NEW: ApexCharts overrides (~50 lines)
```

**Import order in `globals.css`:**
```css
@import "../styles/tokens.css";
@import "../styles/animations.css";
@import "../styles/scrollbar.css";
@import "../styles/auth.css";
@import "../styles/ocr.css";
@import "../styles/dashboard.css";
@import "../styles/industrial.css";
@import "../styles/approvals.css";
@import "../styles/third-party.css";
@import "tailwindcss";
```

**Validation:**
- `npm run build` passes
- Visual QA — all pages look identical before and after
- `wc -l src/styles/globals.css` → ~200 lines

---

### Step 4.6: Standardize Border Radius

**Problem:** P23 — 6+ border radius variants used inconsistently.

**Solution:** Establish clear convention:

| Context | Token to Use |
|---------|-------------|
| Buttons | `rounded-md` (Tailwind default) |
| Cards | `rounded-lg` (Tailwind default) |
| Modals/overlays | `rounded-xl` (Tailwind default) |
| Badges/pills | `rounded-full` |
| Input fields | `rounded-md` |
| Custom panels (factory-specific) | `rounded-panel` (token) |

Add ESLint rule to catch non-standard radius values in new code.

**Validation:** `grep -roh 'rounded-[a-z]*' src/components/ --include='*.tsx' | sort | uniq -c | sort -rn` → only standard variants remain.

---

## Phase 5: State Architecture & Quality (Week 11–14)

> **Goal:** Establish predictable state patterns and testing safety net.
> **Risk Level:** MEDIUM — New patterns introduced, existing code updated incrementally.

### Step 5.1: Introduce `useReducer` for Complex Workflows

**Problem:** P14 — Zero useReducer usage. 49 useState in OCR, 28 in approvals.

**Solution:** Already demonstrated in Step 3.1 (OCR reducer). Apply same pattern to:
- Approval workflow (selection, detail view, action states)
- Attendance review (shift selection, conflict resolution)
- Work queue (filter state, bulk selection, pagination)

**Target files:**
- `src/features/ocr/hooks/use-ocr-state.ts` (Step 3.1)
- `src/features/approvals/hooks/use-approval-state.ts`
- `src/features/attendance/hooks/use-attendance-state.ts`
- `src/components/work-queue-page.tsx` (extract reducer)

**Validation:**
- Build passes
- Each workflow still functions correctly
- `grep -rn 'useReducer' src/ --include='*.tsx' | wc -l` → ≥4

---

### Step 5.2: Introduce Zustand for Global UI State

**Problem:** P15 — No centralized UI state store.

**Solution:** Install Zustand and create stores for cross-cutting concerns:

```bash
cd web && npm install zustand
```

```typescript
// src/stores/ui-store.ts
import { create } from "zustand";

type UiStore = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  commandPaletteOpen: boolean;
  toggleCommandPalette: () => void;
};

export const useUiStore = create<UiStore>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  commandPaletteOpen: false,
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
}));
```

**Migration path:** Gradually replace context-based state in `use-app-shell-state.ts` (489 lines) with Zustand stores.

**Validation:**
- Build passes
- Sidebar toggle, command palette work correctly

---

### Step 5.3: Split i18n Monolith

**Problem:** P16 — 1,316-line translation file with 1,720 references.

**Solution:**
```
src/i18n/
├── index.ts              # Re-exports useTranslation hook
├── en/
│   ├── common.json       # Shared strings (buttons, labels)
│   ├── auth.json         # Auth pages
│   ├── dashboard.json    # Dashboard
│   ├── ocr.json          # OCR workflow
│   ├── approvals.json    # Approvals
│   ├── steel.json        # Steel module
│   ├── attendance.json   # Attendance
│   └── settings.json     # Settings
```

**Migration:** Use `next-intl` or the existing i18n system's namespace support to lazy-load per-feature translations.

**Validation:**
- All translated strings still render correctly
- `wc -l src/i18n/index.ts` → <50 lines
- `wc -l src/i18n/en/*.json` → each <200 lines

---

### Step 5.4: Add Smoke Tests for Top 10 Dangerous Files

**Problem:** P9 — Near-zero test coverage.

**Solution:** Start with smoke tests (render + basic interaction) for the most dangerous files:

```typescript
// src/features/ocr/__tests__/ocr-scan-page.test.tsx
import { render, screen } from "@testing-library/react";
import { OcrScanPage } from "../ocr-scan-page";

describe("OcrScanPage", () => {
  it("renders the upload zone initially", () => {
    render(<OcrScanPage />);
    expect(screen.getByText(/upload/i)).toBeInTheDocument();
  });

  it("shows stage bar with 4 stages", () => {
    render(<OcrScanPage />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });
});
```

**Target files for smoke tests (10):**
1. `ocr-scan-page.tsx`
2. `approvals-page.tsx`
3. `dashboard-home-workspace.tsx`
4. `work-queue-page.tsx`
5. `attendance-review-page.tsx`
6. `shift-entry-workspace.tsx`
7. `app-sidebar.tsx`
8. `reports-page.tsx`
9. `data-table.tsx`
10. `profile-page.tsx`

**Validation:**
- `npm test` passes
- `find src -name '*.test.*' | wc -l` → ≥14

---

### Step 5.5: Standardize React Hook Form Usage

**Problem:** P21 — Only 13 uses of React Hook Form across dozens of forms.

**Solution:** Create a shared `FormField` component that wraps React Hook Form + Zod:

```typescript
// src/components/ui/form-field.tsx
"use client";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { cn } from "@/lib/cn";

interface FormFieldProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  type?: "text" | "email" | "password" | "number";
  placeholder?: string;
  className?: string;
}

export function FormField<T extends FieldValues>({
  name, label, type = "text", placeholder, className
}: FormFieldProps<T>) {
  const { register, formState: { errors } } = useFormContext<T>();
  const error = errors[name];

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-sm font-medium text-text-secondary">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        {...register(name)}
        className="factory-auth-input rounded-md border px-3 py-2 text-sm"
      />
      {error && (
        <span className="text-xs text-status-danger-fg">{String(error.message)}</span>
      )}
    </div>
  );
}
```

Then migrate forms incrementally — each form conversion is a small, testable PR.

**Validation:**
- Build passes
- Converted forms still validate correctly

---

## Phase 6: Prevention & Governance (Week 15+)

> **Goal:** Prevent future entropy. Establish rules that catch problems before they ship.
> **Risk Level:** LOW — Configuration changes, no code logic changes.

### Step 6.1: ESLint Rules for Token Enforcement

```json
// .eslintrc.json additions
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "JSXAttribute[name.name='className'] TemplateLiteral",
        "message": "Avoid template literals in className. Use cn() or clsx()."
      }
    ]
  },
  "overrides": [
    {
      "files": ["src/components/**/*.tsx", "src/features/**/*.tsx"],
      "rules": {
        "no-restricted-properties": [
          "error",
          {
            "object": "style",
            "message": "Avoid inline styles. Use Tailwind classes or token-based CSS."
          }
        ]
      }
    }
  ]
}
```

### Step 6.2: File Size Limits via ESLint

```json
{
  "overrides": [
    {
      "files": ["src/**/*.tsx"],
      "rules": {
        "max-lines": ["warn", 400],
        "max-lines-per-function": ["warn", 80],
        "max-params": ["warn", 5]
      }
    }
  ]
}
```

### Step 6.3: Establish PR Checklist

Add to `.github/pull_request_template.md`:
```markdown
## Frontend Checklist
- [ ] No new hardcoded colors (use tokens)
- [ ] No new inline styles (use Tailwind/token classes)
- [ ] New components go in `src/features/<domain>/` or `src/components/ui/`
- [ ] File <400 lines (decompose if larger)
- [ ] Loading state included for new routes
- [ ] Error boundary wraps new feature sections
```

### Step 6.4: CI Enforcement

```yaml
# .github/workflows/frontend-checks.yml
- name: Check file sizes
  run: |
    find web/src -name '*.tsx' -exec wc -l {} + | awk '$1 > 500 {print "WARNING: " $2 " is " $1 " lines"}'

- name: Check for hardcoded colors
  run: |
    grep -rn '#[0-9a-fA-F]\{6\}' web/src/components/ web/src/features/ --include='*.tsx' && \
    echo "ERROR: Hardcoded hex colors found in components" && exit 1 || echo "OK"
```

---

## 8. Dependency Graph

```
Phase 1 (Week 1-2) ─── LOW RISK ──────────────────────┐
  Step 1.1 Error boundaries                             │
  Step 1.2 Delete dead code                             │
  Step 1.3 Loading states                               │
  Step 1.4-1.6 Cleanup                                  │
                                                        │
Phase 2 (Week 3-4) ─── MEDIUM RISK ───────────────────┤
  Step 2.1-2.4 Feature folders (depends on 1.1)         │
  Step 2.5 Core abstractions                            │
  Step 2.6 Lib split                                    │
  Step 2.7-2.8 Component organization                   │
                                                        │
Phase 3 (Week 5-8) ─── HIGH RISK ─────────────────────┤
  Step 3.1 OCR decomposition (depends on 2.2)           │
  Step 3.2 Approvals decomposition (depends on 2.3)     │
  Step 3.3 Dashboard decomposition (depends on 2.1)     │
  Step 3.4 Dashboard consolidation (depends on 3.3)     │
                                                        │
Phase 4 (Week 9-10) ─── MEDIUM RISK ──────────────────┤
  Step 4.1-4.4 Token enforcement (depends on 3.x)       │
  Step 4.5 CSS decomposition (depends on 3.x)           │
  Step 4.6 Border radius standardization                │
                                                        │
Phase 5 (Week 11-14) ─── MEDIUM RISK ─────────────────┤
  Step 5.1 useReducer (depends on 3.x)                  │
  Step 5.2 Zustand (depends on 2.5)                     │
  Step 5.3 i18n split                                   │
  Step 5.4 Tests (depends on 3.x decomposition)         │
  Step 5.5 Form standardization                         │
                                                        │
Phase 6 (Week 15+) ─── LOW RISK ──────────────────────┘
  Step 6.1-6.4 Prevention & governance
```

---

## 9. Validation Checkpoints

After each phase, run these validation commands:

### After Phase 1:
```bash
cd web
npm run build                    # Must pass
npm run lint                     # Must pass
grep -rn "legacy-ui" src/        # Must return nothing
grep -rn "console\." src/components/ --include='*.tsx' | wc -l  # Must be 0
find src/app -name 'loading.tsx' | wc -l  # Must be ≥40
```

### After Phase 2:
```bash
npm run build                    # Must pass
find src/features -type d | wc -l  # Must be ≥6 (steel, ocr, approvals, attendance, dashboard, entry)
wc -l src/core/*.ts | tail -1    # Must be >62 lines
find src/components/ui/index.ts  # Must exist
```

### After Phase 3:
```bash
npm run build                    # Must pass
wc -l src/features/ocr/ocr-scan-page.tsx     # Must be <300
wc -l src/features/approvals/approvals-page.tsx  # Must be <300
wc -l src/features/dashboard/workspaces/dashboard-home-workspace.tsx  # Must be <400
find src/deprecated -name '*.tsx' | wc -l    # Must be ≥3
```

### After Phase 4:
```bash
npm run build                    # Must pass
wc -l src/styles/globals.css     # Must be <300
grep -rn '#[0-9a-fA-F]\{6\}' src/components/ src/features/ --include='*.tsx' | wc -l  # Must be 0
grep -rn 'backdrop-blur' src/components/ --include='*.tsx' | wc -l  # Must be <20
grep -rn 'shadow-\[' src/components/ --include='*.tsx' | wc -l  # Must be <30
```

### After Phase 5:
```bash
npm run build                    # Must pass
npm test                         # Must pass
grep -rn 'useReducer' src/ --include='*.tsx' | wc -l  # Must be ≥4
grep -rn 'from "zustand"' src/ --include='*.ts' | wc -l  # Must be ≥1
find src -name '*.test.*' | wc -l  # Must be ≥14
wc -l src/i18n/index.ts          # Must be <50
```

### After Phase 6:
```bash
npm run lint                     # Must pass with new rules
cat .github/workflows/frontend-checks.yml  # Must exist
cat .github/pull_request_template.md       # Must include frontend checklist
```

---

## 10. Do NOT Touch List

These files require extreme caution. Changes must be reviewed by multiple team members and tested thoroughly.

| File | Reason | Safe to Touch After |
|------|--------|---------------------|
| `src/lib/api.ts` | Core API — CSRF, error handling | Phase 2.6 (move to services/) |
| `src/lib/auth.ts` | Security-critical role management | Phase 2.5 (extract to core/) |
| `src/app/layout.tsx` | Root layout — cascades to 50 pages | Phase 2 (add nested layouts) |
| `src/components/ui/button.tsx` | 109 imports — cascading changes | Phase 2.8 (barrel exports) |
| `src/components/ui/data-table/data-table.tsx` | 31 imports — core shared primitive | Never without full regression test |
| `src/lib/i18n.tsx` | 1,720 references — atomic string changes | Phase 5.3 (split per feature) |
| `src/styles/tokens.css` | Design token source of truth | Phase 4 (enforcement) |
| `src/hooks/use-app-shell-state.ts` | Central state orchestration (489 lines) | Phase 5.2 (Zustand migration) |
| `src/components/app-shell.tsx` | App shell — affects entire app | Phase 2.7 (move to layout/) |
| `web/middleware.ts` | Route protection — security critical | Never without security review |

---

*This solution plan maps every problem from the architecture audit to a concrete, actionable step with validation criteria. Follow the phase order strictly — each phase depends on the previous one.*
