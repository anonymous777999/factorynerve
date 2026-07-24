# Phase 3 — Layout & shell: decompose app-shell, responsive grids, fix known bugs

**Priority:** High | **Effort:** Large | **Depends on:** Phase 1 (hook, z-tokens), Phase 2 (primitives)

## Goal
Turn the 2,311-line `app-shell.tsx` monolith into composable, correct, responsive parts;
replace JS breakpoints with CSS + `useMediaQuery`; fix the duplicate-sidebar-sections and
overlapping-tooltip/FAB bugs; give dense pages a real responsive grid + summary-first order.

## Preconditions
- `useMediaQuery` hook (1.5) and `--z-*` tokens (1.6) exist. Primitives standardized (Phase 2).

## Tasks

### 3.1 — Decompose `web/src/components/layout/app-shell.tsx`
- Extract into focused components under `web/src/components/layout/`:
  `Sidebar` (desktop, `lg+`), `MobileBottomNav` (`lg:hidden`), `TopBar`, `ContextRail`
  (`xl`), `MobileDrawer` (use shadcn `sheet`). `AppShell` becomes a thin composer.
- Move data-fetching (`listEntries`, `listUnreadAlerts`, `listOcrVerifications`, rail counts)
  into hooks (use `@tanstack/react-query`, already a dependency) — no fetching inside layout JSX.
- **Behavior must be identical.** This is structural. Diff nav output before/after.

### 3.2 — Replace JS breakpoints with the hook / CSS
- Remove `window.innerWidth < 1024` reads (`app-shell.tsx:1672,1689,1704`) -> `useMediaQuery`.
- Prefer pure-CSS visibility (`hidden lg:block`, `lg:hidden`) wherever JS isn't required.
- Fixes hydration mismatch + first-paint CLS.

### 3.3 — Fix the duplicate sidebar section headers
- Root cause is in the nav config rendering (REVIEW/ADMIN/ACCOUNT render twice — see billing
  screenshot). Audit `lib/role-navigation.ts` grouping + the sidebar map; de-dupe groups.

### 3.4 — Fix floating-element overlap (tooltip/FAB/help/jobs/feedback/scanner)
- Apply the `--z-*` scale. Consolidate the bottom-right FAB cluster into one stack with
  consistent spacing so `Help`/`8 1`/jobs don't collide (billing screenshot bug).

### 3.5 — Responsive grid pass on dense pages
- Standardize container: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` patterns
  via a shared `CardGrid`. Remove fixed `w-[..px]`/`h-[..px]` on containers (40 occurrences).
- **Mobile reports** (`127.0.0.1_3000_reports(iPhone SE).png`): break the endless scroll into
  collapsible sections with a summary-first order; collapse repeated "Restricted" into one
  `EmptyState`.
- **Desktop billing**: rebuild the 3-col checkout grid so it fills space (no empty left
  column); this is `(private)/billing` + its components.

### 3.6 — Verify overflow across breakpoints
- Use the existing `npm --prefix web run audit:overflow` and Playwright at 360/768/1024/1440.

## Verification
- [ ] `app-shell.tsx` reduced to a thin composer (<~400 lines); children extracted.
- [ ] Zero `window.innerWidth` in `web/src` (`grep -rn innerWidth web/src` -> 0).
- [ ] Sidebar shows each section group exactly once (visual + code review).
- [ ] No overlapping FABs/tooltips at any breakpoint (screenshots at 360/768/1024/1440).
- [ ] `audit:overflow` clean; no horizontal scroll on any audited route.
- [ ] `npm --prefix web run build` clean; nav behavior unchanged (manual smoke of key routes).
