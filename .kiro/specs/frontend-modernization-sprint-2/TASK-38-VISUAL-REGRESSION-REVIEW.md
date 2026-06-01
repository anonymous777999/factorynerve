# Task 38 — Final Visual Regression Review (Sprint 2)

**Spec:** frontend-modernization-sprint-2
**Phase / Wave:** Phase 4 / Wave 14
**Objective:** Confirm that the cumulative Sprint 2 visual changes are *intentional* and
that no *unintended* visual regressions were introduced — across light/dark themes and
mobile (375px) / tablet (768px) / desktop (1440px) breakpoints.

---

## 1. Review method

True pixel-diff visual regression testing requires (a) committed baseline screenshots,
(b) a running build, and (c) a screenshot-diff tool. This repo has the *tooling* for that
path (Storybook 10 + `@chromatic-com/storybook`, `@storybook/addon-vitest`,
`@storybook/addon-a11y`, Playwright) **but no committed baseline image set** to diff
against. There is no `__screenshots__`, no Chromatic project token in the repo, and the
Playwright `e2e/` suite asserts layout/overflow behaviour, not image snapshots.

With no baseline to diff, this task was executed as a **static, source-level visual-change
review** plus **build/compile verification**:

1. **Change catalogue** — enumerate every visual change Sprint 2 introduced (Tasks 8–10
   spacing, 12–20 interactions, 22–24 AI panels, 27 contrast tokens) and confirm each maps
   to an explicit spec task.
2. **Token blast-radius analysis** — for every design token added/changed (especially the
   Task 27 contrast tokens, which have the widest reach), grep every consumer and confirm
   the change only affects the intended text/badge/AI surfaces.
3. **Build + type verification** — run `tsc --noEmit`, `next build`, and the new
   interaction-timing unit tests to prove the changes compile and render without errors.
4. **Storybook checkpoint inventory** — confirm stories exist for the highest-blast-radius
   primitives (button, card, badge, confidence-badge, smart-insights-panel, data-table,
   OCR review/queue) so a future Chromatic/test-runner pass has visual checkpoints ready.
5. **Residual manual steps** — document what still requires a live browser run.

> **Note on scope:** Per the task brief, no visual changes were made *unless* a genuine
> unintended regression was found. Two genuine build-breaking regressions were found and
> fixed (see §5); both were code/type defects, not deliberate visual edits.

---

## 2. Catalogue of intentional Sprint 2 visual changes

All changes below are controlled refinements (NOT a redesign). Architecture, routing,
backend contracts, and AppShell scroll ownership are unchanged.

### Phase 1 — Token foundation & visual base (Tasks 1–10)

| Task | Intentional visual change | Surface | Verified |
| --- | --- | --- | --- |
| 1 | Interaction timing tokens (`--transition-fast/standard/expand`, `--ease-standard`) | `globals.css :root` | Tokens present |
| 2 | A11y tokens (`--focus-ring-offset/width`, `--min-touch-target`) | `globals.css :root` | Tokens present |
| 3 | Density tokens (default/compact/comfortable row + cell padding) | `globals.css :root` | Tokens present |
| 4 | AI processing tokens (`--ai-processing-bg/fg/border`, `--confidence-*-fg`) | `globals.css :root` | Tokens present |
| 5 | Feedback timing tokens (`--feedback-*`, `--spinner-color`) | `globals.css :root` | Tokens present |
| 6 | Dark-mode surface differentiation (`--surface-app/shell/panel/card`), text + borders | dark mode | Present (`@media` + `[data-theme]`) |
| 7 | Badge compliance — sentence case, no pulsing, no glow, calm status colors | `badge.tsx` | Story + compliance test |
| 8 | Button hover 80ms, 2px focus ring + offset, indigo spinner, disabled/active states | `button.tsx` | Story present |
| 9 | Generous card padding (20–24px) | kpi-box, smart-insights-panel, card, professional-card | Catalogued |
| 10 | Generous section gaps (24–32px) | factory dashboard, dashboard-home, control-tower | Catalogued |

### Phase 2 — Interaction refinements (Tasks 12–20)

| Task | Intentional visual change | Surface |
| --- | --- | --- |
| 12 | Sidebar hover (8% bg opacity, 80–120ms), indigo active state, 8px icon gap | `app-sidebar.tsx` |
| 13 | Sidebar focus ring (2px, inset, indigo, ≥3:1) | `app-sidebar.tsx` |
| 14 | Sidebar touch targets (min 44px) | `app-sidebar.tsx` |
| 15 | Form input/textarea/select focus ring (2px indigo + offset) | `input/textarea/select`, `field.tsx` |
| 16 | Submit button loading state (indigo spinner, disabled) | `button.tsx` + forms |
| 17 | Calm-red error state + ARIA (`aria-invalid`, `aria-describedby`) | `field.tsx`, input, textarea |
| 18 | Data-table row hover (8% bg, 80ms) | operational-table, data-table, ocr-review-table |
| 19 | Data-table cell padding (12px×8px), 40px rows, tabular numbers | operational-table, data-table, ocr-review-table |
| 20 | Sticky header validation (`sticky top-0 z-10`), no scroll-ownership conflict | operational-table, data-table |

### Phase 3 — AI-native UX & accessibility (Tasks 22–29)

| Task | Intentional visual change | Surface |
| --- | --- | --- |
| 22 | AI insight panel — calm indigo tokens, 16px padding, 12px spacing, no pulsing | `smart-insights-panel.tsx`, OCR |
| 23 | Confidence badges — High green / Medium amber / Low slate, ≤280-char reasoning | `confidence-badge.tsx`, smart-insights, OCR |
| 24 | OCR result presentation — AI content visually distinct via `ai-processing` surface | ocr-review-table, OcrSpreadsheetGrid, ocr-result-form |
| 25 | Focus indicators across all interactive elements (2px, ≥3:1) | app-wide |
| 26 | Alt text / decorative marking on images | app-wide |
| 27 | **Contrast token adjustments** (see §3 blast radius) | tokens.css + globals.css |
| 28 | ARIA labels on icon-only buttons | app-wide |
| 29 | Keyboard navigation flow | app-wide |

### Phase 4 — Validation (Tasks 31–37)

Validation/audit tasks (transitions, lazy loading, virtual scrolling, debounce/throttle,
AppShell scroll, Lighthouse a11y + perf). These produce audit reports rather than visual
edits and are documented in their respective `TASK-3x-*.md` files.

---

## 3. Token blast-radius analysis (Task 27 — highest risk)

Token changes have the widest blast radius because a single value can cascade to every
component that consumes it. Task 27 was the largest token change in Sprint 2, so each
adjusted token was grepped for *every* consumer to confirm the change lands only on the
intended text/badge/AI surfaces.

### 3.1 Tokens changed by Task 27

| Token | Light change | Dark change | Hue preserved? |
| --- | --- | --- | --- |
| `--text-tertiary` | neutral-500 46% → `hsl(210 9% 42%)` | `#546E8A` → `#8499B2` | Yes (neutral) |
| `--text-link` | `#1D6EEB` → `#175FCC` | `#1D6EEB` → `#60A5FA` | Yes (blue) |
| `--text-link-hover` | `#175FCC` → `#1453B0` | `#2379F3` → `#93C5FD` | Yes (blue) |
| `--confidence-high-fg` | `#22c55e` → `#137a39` | (new dark) `#4ade80` | Yes (green) |
| `--confidence-medium-fg` | `#f59e0b` → `#a8490a` | (new dark) `#fbbf24` | Yes (amber) |
| `--confidence-low-fg` | `#64748b` → `#4b5563` | (new dark) `#94a3b8` | Yes (slate) |
| `--ai-processing-fg` | unchanged `#4338ca` | (new dark) `#c7d2fe` | Yes (indigo) |

All adjustments are **lightness/saturation-only within the same hue family**, which is the
key reason no *visual character* regression occurs — green stays green, amber stays amber,
indigo stays indigo, blue stays blue. Only the shade darkens (light mode) or lightens
(dark mode) enough to clear WCAG AA on the relevant surfaces.

### 3.2 `--text-tertiary` — wide reach, intended

`--text-tertiary` (and its Tailwind alias `text-text-tertiary`) is the most-consumed
changed token. It is used for metadata / placeholder / secondary-icon text in: data-table
headers and sort buttons, command palette group labels and shortcuts, combobox meta,
guidance-block eyebrows, login field icons, field placeholder text, steel-summary eyebrow
labels, and more. This is **exactly the surface class the token is meant to color** —
low-emphasis supporting text. The change makes that text *darker in light mode / lighter in
dark mode* (more readable), with no hue shift, so the only visible effect is improved
legibility. **No regression** — this is the intended Task 27 outcome.

### 3.3 `--text-link` — scoped to links + ghost button

Consumers: link text and the `ghost` button variant (`button.tsx` uses
`text-[var(--text-link)]` / `hover:text-[var(--text-link-hover)]`). Both are link-style
affordances, which is the intended surface. Shade shift only, hue preserved. **No regression.**

### 3.4 `--confidence-*-fg` — scoped to confidence badges only

Wired through `tailwind.config.ts` as `text-confidence-{high,medium,low}-fg` and
`bg-confidence-*-fg`. The *only* consumers are `confidence-badge.tsx` (text + dot) and its
story/test, transitively used by `smart-insights-panel` and OCR confidence displays. These
tokens render on their own 10% tinted badge backgrounds. The Task 27 fix darkens the
light-mode 500-level fills (which were 1.9–2.2:1, failing AA) to hue-matched 700-level
shades, and adds lighter dark-mode overrides. **Blast radius is confined to confidence
badges.** No other surface consumes these tokens. **No regression.**

### 3.5 `--ai-processing-*` — scoped to AI/OCR surfaces

Wired as `bg/text/border-ai-processing-{bg,fg,border}`. Consumers (grepped): 
`smart-insights-panel`, `OcrSpreadsheetGrid`, `ocr-review-table`, `ocr-result-form`, OCR
`progress-indicator`. All are AI-content surfaces — the intended target. The dark-mode
`--ai-processing-fg` override (`#4338ca` → `#c7d2fe`) only affects these AI panels in dark
mode, lifting the foreground from ~1.9:1 to ~10:1. **No regression.**

### 3.6 Cascade safety check

- Light-mode `:root` confidence values and dark-mode `[data-theme="dark"]` overrides are
  **separate blocks** — the dark override cannot leak into light mode and vice-versa.
- The app sets theme via `data-theme` on `<html>` (see `layout.tsx`), so the
  `[data-theme="dark"]` overrides are authoritative; the `@media (prefers-color-scheme)`
  block in `globals.css` is a consistent fallback.
- Compiled `.next` CSS was spot-checked and contains the expected resolved values
  (`--ai-processing-bg:#6366f114; --confidence-high-fg:#137a39; …`), confirming the tokens
  compile as intended with no accidental override.

**Conclusion:** every Task 27 token change is hue-preserving and lands only on its intended
surface. No unintended cascade detected.

---

## 4. Storybook visual-checkpoint inventory

Storybook is configured (`web/.storybook/main.ts`, `preview.tsx`) with a theme + density
toolbar (default dark/desktop) and the a11y + vitest + chromatic addons. Stories exist for
the highest-blast-radius modified primitives, which serve as visual checkpoints for a
future Chromatic / `@storybook/addon-vitest` run:

- `ui/button.stories.tsx` (Task 8)
- `ui/card.stories.tsx` (Task 9)
- `ui/badge.stories.tsx` (Task 7)
- `ui/confidence-badge.stories.tsx` (Tasks 23/27) — asserts the wired confidence utilities
- `ui/action-dock.stories.tsx`
- `ui/loading-boundary.stories.tsx`
- `ui/data-table.stories.tsx` (Tasks 18/19 — modified in this working tree)
- `dashboard/smart-insights-panel.stories.tsx` (Tasks 22/23/27)
- `ocr/verification-v2/ocr-verification-queue-table.stories.tsx`
- `ocr/verification-v2/ocr-review-workspace.stories.tsx`

These cover the components touched by the riskiest token changes (badge / confidence /
AI panels / data table). Page-level compositions (dashboard, steel, OCR scan, billing,
reports) do **not** have stories and remain manual-verification surfaces (see §6).

---

## 5. Regressions found and fixed

The static review surfaced **two genuine, build-/type-breaking regressions** introduced by
the Sprint 2 working-tree changes. Both were code/type defects (not deliberate visual
edits), so they were fixed under the task's "fix genuine unintended regressions" allowance.

### 5.1 `field.tsx` — incomplete `FieldContextValue` type (Task 17 area)

- **Symptom:** `tsc` error TS2739 at `field.tsx:105` — the `Field` provider's
  `contextValue` was missing `registerControl` / `unregisterControl`.
- **Root cause:** the `FieldContextValue` type was extended (working-tree change) with
  `labelTargetId`, `registerControl`, and `unregisterControl`, but the provider was never
  updated to supply them, and **none of the three new members are consumed anywhere** in
  the codebase (verified by grep). An incomplete edit left dead type members that broke the
  type check.
- **Fix:** removed the three unused type members, restoring the type to match the actual
  (working) provider implementation. No runtime/visual behaviour change — the form error
  state, ARIA wiring, and focus styling from Task 17 are untouched.

### 5.2 `interaction-timing.test.ts` — `.ts` import extension (Task 34 area)

- **Symptom:** `tsc` error TS5097 — `import … from "../src/lib/interaction-timing.ts"`;
  `tsc` rejects `.ts` import extensions unless `allowImportingTsExtensions` is enabled.
- **Root cause:** this new unit test runs under Node's native `node:test` runner with TS
  type-stripping, which **requires** the explicit `.ts` extension at runtime. Removing the
  extension would fix `tsc` but break the test run.
- **Fix:** enabled `"allowImportingTsExtensions": true` in `web/tsconfig.json` (safe because
  the project already sets `"noEmit": true`). This satisfies both `tsc` and the runtime
  runner. Verified: all 8 interaction-timing tests pass under `node --test`.

> Neither fix changes any pixels. They restore a clean type check that the Sprint 2 edits
> had broken.

### 5.3 Pre-existing issues — NOT Sprint 2 regressions (left unchanged)

- `src/components/ui/badge.test.tsx` — 2 `tsc` errors (`@testing-library/react` is not
  installed; uses an invalid `"danger"` badge status). This file is **committed at HEAD and
  unchanged** in the working tree, so it is a pre-existing defect, not a Sprint 2
  regression. It is also outside the `next build` graph (test files aren't bundled), so it
  does not affect the production build or the CI quality gate.
- `npx eslint src` reports ~97 pre-existing errors (`react-hooks/set-state-in-effect`,
  `rules-of-hooks`, `react/no-unescaped-entities`, `no-explicit-any`) spread across files
  Sprint 2 never modified (e.g. `steel-customers-page`, `work-queue-page`,
  `badge-provider`, `legacy-ui/ocr/*`, `stories/Page.tsx`). These are repo-baseline lint
  debt, unrelated to visual changes, and out of scope for Task 38. Sprint 2-modified files
  (`field.tsx`, `data-table-filter-cell.tsx`, the new interaction-timing files) report
  **no diagnostics**.

---

## 6. Build & verification results

| Check | Command | Result |
| --- | --- | --- |
| Production build (CI gate) | `npm run build` | ✅ **Compiled successfully in ~28.6s**, all ~55 routes built |
| TypeScript (Sprint 2 files) | `tsc --noEmit` | ✅ 0 errors in Sprint 2 files (2 remaining are pre-existing `badge.test.tsx`, outside build graph) |
| Interaction-timing unit tests | `node --test __tests__/interaction-timing.test.ts` | ✅ 8/8 pass |
| Editor diagnostics | `field.tsx`, `interaction-timing.test.ts`, `data-table-filter-cell.tsx` | ✅ No diagnostics |
| Token compile spot-check | compiled `.next` CSS | ✅ Confidence/AI tokens resolve to expected values |

The **production build is the authoritative gate** (CI runs `eslint src` + `npm run build`,
not `tsc`). It compiles cleanly, which confirms there are no rendering/type errors in any
shipped route after the Sprint 2 changes + the two fixes above.

---

## 7. Residual manual verification (requires a live browser)

The following items **cannot** be verified by static review or build alone. They require a
running app (`npm run dev`) and, ideally, a Chromatic / Storybook test-runner baseline.
They map directly to the unchecked items in the Task 38 validation checklist.

1. **Establish a screenshot baseline.** Run Storybook + Chromatic (or
   `@storybook/addon-vitest` snapshots) once on `main` to capture baselines for the stories
   in §4, then diff future runs. This is the missing piece for *true* visual regression.
2. **Light mode pass.** Toggle `data-theme="light"`; verify Task 27 light-mode contrast
   (text-tertiary, text-link, confidence badges) and that spacing/interaction changes read
   correctly. Use Chrome DevTools accessibility contrast readout / WebAIM checker.
3. **Dark mode pass.** Default theme; verify dark-mode surface differentiation (Task 6) and
   the dark `[data-theme="dark"]` AI/confidence overrides (Task 27).
4. **Breakpoints.** Capture each major page at **375px / 768px / 1440px** and confirm no
   layout breaks from the padding (Task 9) and section-gap (Task 10) changes. The
   `e2e/mobile-overflow.spec.ts` Playwright suite already guards horizontal overflow on
   ~20 core routes and can be run via `npm run test:e2e`.
5. **Console errors.** Confirm zero console errors/warnings on each major page in both
   themes.
6. **Page-level compositions without stories.** Manually review dashboard, steel pages,
   OCR scan/review, billing, reports, entry — these have no Storybook checkpoints.
7. **Task 27 follow-ups (flagged, non-blocking):** standalone bright status *dots*
   (`--status-success-icon` #22C55E, `--status-warning-icon` #F59E0B) on a neutral surface
   measure <3:1, and white text on those bright fills (steel-summary "watch/healthy" chips
   in `steel-summary-primitives.tsx`) is ~2.2:1. These pre-date Task 38's text-token scope
   and were intentionally left for design review; confirm during the live pass whether any
   standalone-dot-on-surface case is actually rendered.

---

## 8. Outcome

- **Cumulative Sprint 2 visual changes are intentional and catalogued** (§2), each traced
  to its originating task.
- **Token blast radius is contained** (§3): every changed token — especially the wide-reach
  Task 27 contrast tokens — is hue-preserving and lands only on its intended surface, with
  no accidental cascade (verified against the compiled CSS).
- **Two genuine build-breaking regressions were found and fixed** (§5) — both code/type
  defects, neither a pixel change.
- **The production build compiles cleanly** and the new timing tests pass (§6).
- **True pixel-diff regression remains a residual manual/CI step** (§7) because no baseline
  image set exists in this environment; the Storybook + Chromatic tooling is in place to
  establish one.

No further automated action is possible without a live browser and a committed screenshot
baseline. The static review found no unintended *visual* regressions; the only defects were
the two build/type issues, now resolved.
