# Composition Governance — Phased Roadmap

## Current State Summary (Audited May 2026)

### Primitives Available

| Primitive | Location | Status |
|---|---|---|
| `WorkstationShell` | `components/ui/workstation-shell.tsx` | ✅ Stable — embeds RouteHeader internally |
| `RouteHeader` | `shared/operational/route-header.tsx` | ✅ Stable — standalone (not used by most pages) |
| `SectionPanel` | `components/ui/section-panel.tsx` | ✅ Stable — title, eyebrow, actions, meta, footer |
| `OperationalPageShell` | `components/ui/operational-page-shell.tsx` | ✅ Stable — wraps WorkstationShell + stagger loading |
| `Card` | `components/ui/card.tsx` | ⚠️ Used as SectionPanel replacement in many pages |
| `GlassPanel` | `components/ui/glass-panel.tsx` | ⚠️ Overused for structural sections vs decorative use |
| `DisclosurePanel` | `shared/operational/disclosure-panel.tsx` | ✅ Stable — collapsible section |

### Common Anti-Patterns Found

1. **Inline status classes** — `badgeTone()` functions duplicating `status-badge-classes.ts`
2. **Card-over-SectionPanel** — `Card` used where `SectionPanel` should be
3. **Inconsistent loading** — Some pages use `OperationalPageShell` loading, others use custom skeletons
4. **Mixed composition** — Alternating `Card`/`GlassPanel`/`section` with no structural rhythm
5. **Arbitrary spacing** — Custom px values, `space-y-*` mixing, no semantic spacing
6. **Custom headers** — Pages re-implement header/hero sections inline
7. **Inline EmptyState** — Some pages define their own, duplicating shared primitives

---

## Phase 0 — Primitive Gap Analysis & Hardening (Weeks 1-2)

**Goal:** Ensure all primitives are complete before any page refactor.

| Task | Details |
|---|---|
| **0.1** Add `borderClass` to `status-badge-classes.ts` | Needed by recovery-banner and similar components that need a status border without the status bg |
| **0.2** Audit `RouteHeader` embed vs standalone | `WorkstationShell` embeds its own RouteHeader; standalone `RouteHeader` falls out of sync. Decision: keep embedded in shell, deprecate standalone, or keep both for pages with custom shell needs |
| **0.3** Add density-aware spacing to SectionPanel | SectionPanel should accept `density` prop and adjust `px-lg py-lg` → `px-{density} py-{density}` |
| **0.4** Create `LoadingSkeleton` page primitive | Standard loading shell so pages stop implementing custom skeletons |
| **0.5** Create `EmptyOperationalState` with variants | Already exists in shared/operational; verify it covers all use cases across 8 target pages |

---

## Phase 1 — High-Fragmentation Pages — ✅ Complete

### Summary

| Page | Inline Functions | Inline Status Classes | Loading |
|---|---|---|---|
| **steel-command-center-page.tsx** | `badgeTone()` → `badgeToneClass()` via `badgeClass()` | 7 call sites refactored | Already using OperationalPageShell isLoading ✅ |
| **premium-dashboard-page.tsx** | Already using `badgeClass()`/`iconClass()` ✅ | 4 ownerRiskCards + 3 OCR cards + 1 Warning → `toneClass()`/`badgeClass()` | Already using OperationalPageShell ✅ |
| **analytics-page.tsx** | N/A | Locked banner → `badgeClass("info")` | Custom skeleton → `OperationalPageShell isLoading` with `title` |
| **approvals-page.tsx** | Already using `badgeClass()`/`textClass()` ✅ | 9 inline strings → `badgeClass()`/`toneClass()` | Already using OperationalPageShell isLoading ✅ |

**Validation:** ✅ Zero TypeScript errors, ✅ Code review approved

---

## Phase 2 — Moderate-Fragmentation Pages — ✅ Complete

### Summary

| Page | Changes | Status |
|---|---|---|
| **work-queue-page.tsx** | Already refactored in prior phase: aliased imports removed, local helpers delegate to `badgeClass()`/`toneClass()`/`borderClass()` | ✅ |
| **ai-insights-page.tsx** | Custom loading skeleton → `OperationalPageShell isLoading` with required `title` prop | ✅ |
| **reports-page.tsx** | 2 error GlassPanel inline classes → `badgeClass("danger")`; 3 OCR trust card borders → `borderClass("info")`/`borderClass("warning")` | ✅ |

**Validation:** ✅ Zero TypeScript errors (unrelated `login-1.tsx` excluded), ✅ Code review approved

---

## Phase 3 — Low-Fragmentation Pages — ✅ Complete

### 3a. `control-tower-page.tsx` ✅

**Formal audit confirmed:** This page is the composition governance reference implementation.

| Check | Result |
|---|---|
| Shell | ✅ `OperationalPageShell` |
| Loading | ✅ `DashboardPageSkeleton` |
| Primitives | ✅ `DisclosurePanel`, `Card` |
| Spacing | ✅ Semantic tokens only |
| Inline badge classes | ✅ Zero found |
| Hierarchy | ✅ Clean: Shell → section → Cards |

**Audit report:** `docs/COMPOSITION_AUDIT_CONTROL_TOWER.md`

---

## Phase 4 — Cross-Cutting Finishing (Week 8)

| Task | Details |
|---|---|
| **4.1** Spacing audit | ✅ Automated scan created — `scan_arbitrary_spacing.py` found 307 real violations + 185 CSS var refs across 73 files |
| **4.2** Density integration | Wire density settings through SectionPanel, RouteHeader, all primitives |
| **4.3** Responsive audit | ✅ All 8 refactored pages + 4 primitives verified — report at `docs/RESPONSIVE_AUDIT_PHASE_43.md` |
| **4.2** Border-radius fix | ✅ Top 10 arbitrary radius patterns (58 replacements, 26 files) migrated to `rounded-2xl`/`rounded-3xl` |
| **4.5** Documentation update | Update COMPONENT_HIERARCHY.md with final composition patterns |

---

## Execution Process Per Page

For each page in Phases 1-3:

1. **Operational Analysis** — Understand workflow purpose (0.5h)
2. **Composition Audit** — Map existing structure (0.5h)
3. **Root Cause** — Identify structural causes (0.5h)
4. **Stabilization Plan** — Write specific refactor plan (1h)
5. **Systematic Refactor** — Implement using primitives (2-4h)
6. **Validation** — Typecheck + visual review (1h)

**Estimated total: ~5-8 hours per page** (Phase 1 pages may take longer)

---

## Current Phase 0 Priority Action Items

1. ✅ Audit `status-badge-classes.ts` vs inline tone functions — Done
2. ✅ Add `borderClass()` to `status-badge-classes.ts` — Done (also updated recovery-banner.tsx)
3. ✅ Audit standalone `RouteHeader` usage — **Zero pages import the standalone `RouteHeader`**. `WorkstationShell` embeds route-header markup inline. Standalone `RouteHeader` is only re-exported from `shared/operational/index.ts`. Recommend: keep for future custom-shell pages, but document that `WorkstationShell` is the canonical shell.
4. ✅ Audit `LoadingSkeleton` availability — **Already exists comprehensively**: `DashboardPageSkeleton`, `EntryPageSkeleton`, `ReportsPageSkeleton` in `page-skeletons.tsx` plus a full `skeletons/` directory. The issue is page-level adoption, not availability.
5. ⬜ Document the canonical page architecture visually
