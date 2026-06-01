# Task 37 — Lighthouse Performance Audit

**Spec:** Frontend Modernization Sprint 2 — Phase 4 (Performance Validation & Final Polish), Wave 14
**Objective:** Run a Lighthouse performance audit on all major pages, fix performance issues, and achieve a ≥90 performance score.
**Validates:** Requirement 12 (Performance Optimization) — 12.1, 12.2, 12.3, 12.4, 12.6, 12.7, 12.8, 12.9; design "Performance Benchmarks" (Lighthouse ≥90, Core Web Vitals all green, bundle increase <5%).
**Risk Level:** Low (validation + targeted fixes)
**Status:** Complete — static audit PASS, production build PASS. Live Lighthouse score requires a browser run (documented under Residual Manual Verification).

---

## 1. Audit Method

A full Lighthouse score requires a running production server driven by headless Chrome with network/CPU
throttling. This spec environment has no headless-Chrome/Lighthouse runner and no `lighthouse` / `analyze`
npm script (`web/package.json` exposes only `dev`, `build`, `start`, `lint`, `typecheck`, `storybook`,
`audit:overflow`, `test:e2e`, `openapi:generate`). A live score therefore cannot be produced here.

Per the task's documented fallback, this audit combines:

1. **Production build verification** — `npm run build` in `web/` to catch any build-time performance
   regression (type errors, failed code-splitting, broken route generation). This is the strongest signal
   available without a browser.
2. **Static audit against the Lighthouse performance checklist** — render-blocking resources,
   layout-triggering animation (CLS/INP risk), main-thread work, code-splitting / unused JS, image policy,
   and bundle weight.
3. **Sprint 2 regression analysis** — Sprint 2 was visual/token/interaction refinement only. Every
   performance-relevant axis Sprint 2 touched (transitions, spacing, status chips, dark-mode tokens) was
   re-checked for regressions against the Phase 4 audits (Tasks 31–35).

### Tooling / commands run

| Command | Purpose | Result |
|---|---|---|
| `npm run build` (web/) | Production build / build-time regression check | ✅ Exit 0 — all 50 routes generated |
| `npm run typecheck` (web/) | Full `tsc --noEmit` | 2 pre-existing `badge.test.tsx` errors only (test-file, not in build graph); 0 app errors |
| `getDiagnostics` on `field.tsx`, `input.tsx`, `textarea.tsx` | Confirm clean type state on disk | No diagnostics |
| grep audits | `transition-all`, `transition-[layout-prop]`, `backdrop-blur`, `animate-*`/`infinite` | See §4 |
| chunk-size measurement | Largest emitted JS chunks | See §3 |

---

## 2. Build Verification Result — PASS

`npm run build` completes successfully (**Exit Code 0**) and statically prerenders / configures all
**50 routes** (`/`, `/dashboard`, `/ocr`, `/ocr/scan`, `/ocr/history`, `/steel/*`, `/attendance/*`,
`/reports`, `/billing`, `/settings/*`, `/control-tower`, `/ai`, etc.). Dynamic routes
(`/entry/[id]`, `/ocr/jobs/[jobId]`, `/ocr/verify`, `/steel/*/[id]`) are correctly marked server-rendered
on demand. No build-time performance regression exists.

### Build-time issue found and resolved (stale incremental cache)

The first two `next build` attempts failed type-checking with:

```
./src/components/ui/field.tsx:105:11
Type error: Type '{ id; describedById; validationState; registerHelperText; unregisterHelperText; }'
is missing the following properties from type 'FieldContextValue': registerControl, unregisterControl
```

**Triage:** The on-disk `field.tsx` was verified at the byte level (`registerControl`/`labelTargetId`
absent) and both `tsc --noEmit` and `getDiagnostics` reported the file clean. The error came from Next.js
**stale incremental type-check caches** (`tsconfig.tsbuildinfo` + `.next/cache`) replaying a previous file
revision, not from the current source.

**Fix:** Cleared `.next/cache` and `tsconfig.tsbuildinfo`, then re-ran a clean build → **PASS**. No source
change to `field.tsx` was required (the file was already self-consistent). This is documented so the
team treats `tsconfig.tsbuildinfo`/`.next/cache` as expendable when a build error cannot be reproduced by
`tsc`/diagnostics.

> Note: the 2 `badge.test.tsx` `tsc` errors (missing `@testing-library/react`, stale `danger` badge
> status) are **pre-existing**, live only in a test file outside the Next build graph (so they do not
> block `next build`), and are tracked across Tasks 31–35. Out of scope for Task 37.

---

## 3. Static Performance Checklist

| Lighthouse / CWV axis | Finding | Verdict |
|---|---|---|
| **Render-blocking / CSS** | Tailwind v4 single stylesheet; no synchronous third-party CSS added by Sprint 2. | ✅ |
| **JS code-splitting / unused JS** | All heavy libs code-split (Task 32): `react-apexcharts`+`apexcharts`, `jspdf`(+autotable), `pdfjs-dist`, `heic2any`, `browser-image-compression`, TanStack grids — via `next/dynamic({ssr:false})` or on-demand `import()`. None enter the initial bundle. | ✅ (Req 12.7) |
| **Largest emitted chunks** | Top chunks (~1320KB, ~1127KB, ~508KB raw/un-gzipped) correspond to the lazily-loaded ApexCharts/pdf/jspdf code-split bundles — they download only on the routes/actions that need them, not on first load. | ✅ deferred |
| **CSS animations vs JS** | All state changes use CSS transitions; no JS animation libraries (no gsap/framer). | ✅ (Req 12.2) |
| **Layout-triggering animation (CLS/INP)** | `transition-all` = **0 occurrences** (eliminated in Task 31). Remaining `transition-[width]` are 12 progress-bar fills, each a leaf node inside `overflow-hidden` fixed-height parents (contained reflow, low-frequency). | ✅ contained |
| **AppShell exception** | `.factory-workstation-frame` animates `padding-left` (layout-triggering) on sidebar toggle — accepted architecture exception (Task 31/35), infrequent, off-limits for modification. | ✅ documented |
| **Backdrop filters (max 2 concurrent, Req 12.3)** | `backdrop-blur` used on page header sections / overlays. At most one header backdrop + one transient overlay (modal/drawer/toast) is on-screen at a time; not stacked >2 concurrently in a single view. Pre-existing pattern, not introduced by Sprint 2. | ✅ |
| **Scroll performance (60fps, Req 12.6)** | Virtual scrolling intact (Task 33, `@tanstack/react-virtual`, constant mounted-row count); row transitions use `background-color`/`border-color` only. | ✅ |
| **Virtual scrolling >100 rows (Req 12.9)** | Auto-virtualizes above 100 rows; validated with 1200-row story. | ✅ |
| **Debounce/throttle (Req 12.8)** | Search 300ms debounce, filter 150ms throttle (Task 34). | ✅ |
| **Images (Req 12.4/12.5)** | Below-the-fold multi-page document stack lazy-loads pages 2+ (Task 32); above-the-fold previews correctly eager. No oversized decorative images added by Sprint 2. | ✅ |
| **`will-change` hygiene** | Confined to auth/login background decorative animations in `globals.css` (pre-existing, login route only). | ✅ no regression |
| **Reduced motion** | `prefers-reduced-motion: reduce` collapses all motion tokens to 0ms (Task 31). | ✅ |

---

## 4. Sprint 2 Regression Analysis

Sprint 2 changed tokens, spacing, interaction states, status chips, and dark-mode surfaces — **no new
runtime libraries, no architectural changes**. Each performance-relevant change re-verified:

| Sprint 2 change | Performance impact | Verdict |
|---|---|---|
| Interaction timing tokens (80/120/150ms) | Shorter, GPU-friendly transitions; faster perceived INP | ✅ neutral/positive |
| Transition scoping (Task 31) | Removed all 14 `transition-all` → explicit cheap props; lowers paint/layout risk | ✅ improvement |
| Card padding / section gaps (Tasks 9–10) | Pure layout class swaps (`p-*`, `space-y-*`); no animation, no new nodes | ✅ neutral |
| Status chip cleanup (Task 7) | Removed pulsing animation paths from badges; color-only | ✅ improvement |
| Dark-mode surface tokens (Task 6) | CSS variable value changes; no extra layers/filters | ✅ neutral |
| AI panel / confidence badges (Tasks 22–24) | Calm indigo indicator + spinner (border + `animate-spin`); replaced pulsing/glow | ✅ neutral |
| Focus rings (Tasks 13/15/25) | `box-shadow`/`ring` — compositor-friendly | ✅ neutral |

**Dependency check:** `web/package.json` adds no new runtime dependency for Sprint 2 visual work. Runtime
deps remain the established set (React 19, Next 16, TanStack query/table/virtual, ApexCharts, pdf/jspdf,
zod, react-hook-form, lucide). **No bundle-weight regression from Sprint 2** (design budget: <5% increase).

### Minor observations (not Sprint 2 regressions, not blocking)

- `animate-pulse` on a live-status dot in `attendance-live-page.tsx` and a draft-ready dot in
  `email-summary-page.tsx`; auth background `*-infinite` animations in `globals.css`. These are tiny,
  pre-existing decorative indicators (auth animations only on the login route). They are negligible for
  performance but are mild deviations from the "no pulsing" visual doctrine — flagged for a future
  governance pass, **out of scope for Task 37** and not a Sprint 2 performance regression.

---

## 5. Validation Checklist Results

| Check | Result | Evidence |
|---|---|---|
| Lighthouse performance score ≥90 | ⏳ Manual | Static checklist clean + build PASS; numeric score needs a browser run (§6) |
| Core Web Vitals all green | ⏳ Manual | LCP: heavy libs deferred, no blocking CSS. CLS: no layout-animation regressions, lazy images preserve box. INP: ≤120ms GPU transitions, debounce/throttle. Empirical capture needs a browser (§6) |
| No performance regressions | ✅ PASS | §4 — Sprint 2 is token/visual only; transitions improved; no new deps |
| Test on all major pages | ✅ Build / ⏳ runtime | All 50 routes build cleanly; per-route runtime trace needs a browser (§6) |
| Test on low-end devices | ⏳ Manual | `prefers-reduced-motion` 0ms + constant mounted-row count are the code-level guarantees; device trace needs hardware (§6) |
| No TypeScript errors | ✅ PASS | Clean `next build`; app diagnostics clean (2 pre-existing test-only `badge.test.tsx` errors excluded from build) |
| No console errors | ⏳ Manual | Static-only changes; runtime console capture needs a browser (§6) |

---

## 6. Residual Manual Verification (requires running build + browser)

Run after `npm run build` + `npm run start` (or against the deployed preview), with Chrome DevTools:

1. **Lighthouse (Performance)** — DevTools → Lighthouse → Performance, mobile + desktop presets, on:
   `/dashboard`, `/ocr/scan`, `/ocr/history`, `/steel/batches`, `/steel/invoices`, `/reports`,
   `/control-tower`, `/attendance/live`. Confirm score **≥90** each; record numbers.
2. **Core Web Vitals** — confirm LCP < 2.5s, CLS < 0.1, INP < 200ms (DevTools Performance panel / web-vitals).
3. **60fps scroll** — DevTools → Performance, record while scrolling a 100+ row data table; confirm green 60fps bars.
4. **Paint flashing** — DevTools → Rendering → Paint flashing; confirm hover/focus transitions don't repaint large regions.
5. **CPU throttle 6×** — repeat hover/scroll/typing; confirm smoothness on simulated low-end device.
6. **Console** — confirm no errors/warnings across the major routes above.
7. **(Optional) Bundle baseline** — wire a `lighthouse`/`@next/bundle-analyzer` script + Lighthouse CI to
   record an empirical First Load JS baseline and enforce the design's <5% bundle-increase budget in CI.

---

## 7. Summary

- **Production build PASSES** (exit 0, 50 routes) — no build-time performance regression. A stale
  incremental-cache type error on `field.tsx` was triaged to a cache artifact and resolved by clearing
  `.next/cache` + `tsconfig.tsbuildinfo`; no source change needed.
- **Static performance checklist is clean:** zero `transition-all`, contained leaf-node `width` fills only,
  all heavy libraries code-split out of the initial bundle, virtual scrolling intact, debounce/throttle in
  place, reduced-motion honored.
- **No Sprint 2 performance regression:** Sprint 2 added no runtime dependencies and only refined
  tokens/spacing/interaction; transition scoping is a net improvement.
- **Residual:** the numeric Lighthouse ≥90 score, Core Web Vitals green confirmation, 60fps trace, low-end
  device test, and console-error check require a live browser/Lighthouse run and are documented in §6 for
  manual QA before release.

**Rollback:** No source changes were made by this task (cache clearing only). The documented contingency
(`git revert <commit-hash>` for any fix that breaks functionality) remains available.
