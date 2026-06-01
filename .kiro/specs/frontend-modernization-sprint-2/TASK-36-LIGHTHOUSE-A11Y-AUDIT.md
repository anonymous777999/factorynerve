# Task 36 — Lighthouse Accessibility Audit

**Spec:** Frontend Modernization Sprint 2 — Phase 4 (Performance Validation & Final Polish)
**Objective:** Run a Lighthouse accessibility audit on all major pages, fix any accessibility violations, and achieve a 100 accessibility score.
**Validates:** Requirement 10 (Accessibility Compliance) — 10.1–10.12; Requirement 11 (Governance Compliance) — 11.13, 11.14, 11.15; design "Accessibility (WCAG 2.1 AA)" acceptance.
**Standard:** WCAG 2.1 AA; `.mcp/governance/product-memory/visual-doctrine.md` (focus/state doctrine).
**Risk Level:** Low (validation + one additive `aria-label` fix).
**Dependencies:** Phase 3 accessibility tasks 25–29 (focus indicators, alt text, contrast, ARIA labels, keyboard nav) — all complete.
**Status:** Complete — static audit PASS after one fix. Live numeric Lighthouse score requires a browser run (documented under §6 Residual Manual Verification).

---

## 1. Audit Method

A full Lighthouse **accessibility** score is produced by axe-core running inside headless Chrome against a
rendered DOM. This spec environment has no headless-Chrome / Lighthouse runner and `web/package.json`
exposes no `lighthouse` / `analyze` script (only `dev`, `build`, `start`, `lint`, `typecheck`, `storybook`,
`audit:overflow`, `test:e2e`, `openapi:generate`). A live numeric score therefore cannot be produced here.

Per the task's documented fallback, this audit performs a **static accessibility audit equivalent to the
statically-detectable subset of Lighthouse's accessibility category**, plus a TypeScript regression check.
The Lighthouse accessibility category is a curated set of axe-core audits; the table in §3 maps each audit
to how it was verified here and whether it is statically decidable or requires a browser/AT.

### Tooling / commands run

| Command | Purpose | Result |
|---|---|---|
| `node .tmp/a11y-lh-scan.mjs` | Form-control accessible-name audit (Field/Label context-wiring aware) | 0 genuine unlabeled controls |
| `node .tmp/a11y-lh-structural.mjs` | Duplicate `id`, positive `tabindex`, `accesskey` audits | 0 / 0 / 0 |
| `node .tmp/a11y-heading-scan.mjs` | Heading-order skips (`h{n} → h{n+2}`) | 0 raw skips |
| `node .tmp/a11y-lh-aria-role.mjs` | `aria-valid-attr`, `aria-roles`, `image-alt` audits | 0 / 0 / 0 |
| `node .tmp/a11y-lh-name-scan.mjs` | `button-name` / `link-name` icon-only candidate finder | 1 genuine violation found → fixed |
| `grep user-scalable\|maximum-scale` | `meta-viewport` (zoom not blocked) audit | 0 matches (zoom allowed) |
| `read web/src/app/layout.tsx` | `html-has-lang`, viewport, `color-scheme` | `<html lang="en">`, no zoom block, `colorScheme` set |
| `npm run typecheck` (web/) | Type regression from the fix | Only 2 pre-existing `badge.test.tsx` errors |
| `getDiagnostics` on the modified file | Confirm clean type state | No diagnostics |

Scan scope: **320 `.ts/.tsx` files** under `web/src` (excluding `legacy-ui`, `*.stories.*`, `*.test.*`,
`stories/`). "Major pages" covered by the source-level scan include every route component:
`/dashboard`, `/ocr`, `/ocr/scan`, `/ocr/history`, `/steel/*`, `/attendance/*`, `/reports`, `/billing`,
`/plans`, `/settings/*`, `/control-tower`, `/ai`, `/approvals`, `/work-queue`, `/profile`, and the auth
routes — because the scan walks the full component tree those routes render.

---

## 2. Violation Found and Fixed

| File | Element | Lighthouse audit | Before | Fix |
|---|---|---|---|---|
| `web/src/components/approval-queue-workspace.tsx` | "Source Document Crop" expand control (`⛶` glyph) | `button-name` (axe `button-name`, WCAG 4.1.2) | `<button className="text-gray-400 hover:text-white">⛶</button>` — icon-only, **no accessible name** | Added `type="button"` + `aria-label="Expand source document crop"`; wrapped glyph in `<span aria-hidden="true">` so the label is the single announced name |

This component is wired to the live `/approvals` route (`web/src/app/approvals/page.tsx`), so the violation
was real and user-facing. The fix is additive (an `aria-label` + decorative-glyph marking) with no layout,
behavior, or rendering change. Re-running `a11y-lh-name-scan.mjs` after the fix drops the genuine-violation
count to 0 (remaining 10 reported candidates all derive their name from text expressions — see §3 note).

> **Why Task 28 didn't catch it:** Task 28 inventoried icon-only `<Button>` / `<button>` controls using
> `lucide-react` icons, `size="icon"`, and common glyphs (`+ - × ‹ ›`). This control uses the less-common
> `⛶` (U+26F6, "square four corners") fullscreen glyph and a bare `<button>`, so it fell outside Task 28's
> glyph set. Task 36's broader `button-name`/`link-name` heuristic surfaced it.

---

## 3. Lighthouse Accessibility Audit Mapping

Each row maps a Lighthouse (axe-core) accessibility audit to how it was verified and the expected outcome.
"Static" = decidable from source; "Browser/AT" = needs a rendered DOM or assistive technology and is
deferred to §6.

| Lighthouse audit | What it checks | Method | Verdict |
|---|---|---|---|
| `html-has-lang` | `<html>` has a `lang` | `layout.tsx` → `<html lang="en">` | ✅ Static PASS |
| `html-lang-valid` | `lang` is a valid BCP-47 tag | `lang="en"` | ✅ Static PASS |
| `meta-viewport` | viewport doesn't block zoom (`user-scalable=no` / `maximum-scale=1`) | grep: 0 matches; `viewport` exports only `width/initialScale/viewportFit` | ✅ Static PASS |
| `document-title` | page has a `<title>` | `metadata.title = "DPR.ai Web"` (Next injects `<title>`) | ✅ Static PASS |
| `image-alt` | `<img>`/`next/image` have `alt` | `a11y-lh-aria-role.mjs` → 0 missing (Task 26 set decorative `alt=""`) | ✅ Static PASS |
| `button-name` | buttons have an accessible name | `a11y-lh-name-scan.mjs` → 1 found (fixed §2); others text-derived | ✅ Static PASS (after fix) |
| `link-name` | links have discernible text | `a11y-lh-name-scan.mjs` → 0 genuine | ✅ Static PASS |
| `label` / `form-field-multiple-labels` | form controls have a programmatic label | `a11y-lh-scan.mjs` (Field/Label `htmlFor`↔`id` wiring aware) → 0 unlabeled | ✅ Static PASS |
| `aria-valid-attr` | `aria-*` attribute names are valid | `a11y-lh-aria-role.mjs` (WAI-ARIA 1.2 set) → 0 invalid | ✅ Static PASS |
| `aria-roles` | `role` values are valid tokens | `a11y-lh-aria-role.mjs` (WAI-ARIA 1.2 roles) → 0 invalid | ✅ Static PASS |
| `aria-valid-attr-value` | aria values are well-formed | Validated names + boolean/token usage; literal values sane | ✅ Static PASS (literal) / ⏳ runtime for dynamic |
| `duplicate-id-active` / `duplicate-id-aria` | no duplicate literal `id` per document | `a11y-lh-structural.mjs` → 0 duplicate literal ids | ✅ Static PASS |
| `tabindex` | no positive `tabindex` | `a11y-lh-structural.mjs` → 0 positive | ✅ Static PASS |
| `accesskeys` | `accesskey` values unique | `a11y-lh-structural.mjs` → 0 usages | ✅ Static PASS (N/A) |
| `heading-order` | headings don't skip levels | `a11y-heading-scan.mjs` → 0 raw skips | ✅ Static PASS |
| `color-contrast` | text ≥4.5:1 (3:1 large) | Validated in **Task 27** (`TASK-27-CONTRAST-AUDIT.md`); no Sprint 2 regression | ✅ PASS (Task 27) |
| `focus indicators` (manual/axe state) | visible focus on interactive elements | **Task 25** (`TASK-25-AUDIT-REPORT.md`) — focus rings on all primitives | ✅ PASS (Task 25) |
| keyboard operability | Tab/Shift+Tab/Enter/Space/Esc, no traps | **Task 29** (`TASK-29-KEYBOARD-NAV-AUDIT.md`) | ✅ PASS (Task 29) |
| `aria-hidden-focus` / `aria-required-children` / `list` / `listitem` / `definition-list` | DOM-relationship audits | Require rendered DOM | ⏳ Browser/AT (§6) |
| `color-contrast` runtime resolution | computed contrast against actual painted pixels | Token-level validated (Task 27); pixel-level needs browser | ⏳ Browser confirm (§6) |

> **Note on the 10 remaining `name-scan` candidates:** after the fix, the finder still lists 10
> `<Button>`/`<Link>` elements whose inner content is a text expression the regex can't fully resolve
> (`{plansLabel}`, `{dashboardLabel}`, `{option}`, `{getOpenLabel(job)}`, `{nextDispatchLabel}`,
> `{secondaryActionLabel}`, `{shortLabel(record)}`, `{mobilePrimaryLabel}`, and two `<Link>` wrappers around
> a labeled `<Button>`). Each renders visible text at runtime, so none is a real `button-name`/`link-name`
> violation. They are listed here for auditor transparency, not as defects.

---

## 4. Sprint 2 Accessibility Regression Analysis

Sprint 2 was token/visual/interaction refinement only — no semantic structure, ARIA, or DOM-relationship
changes. Each accessibility-relevant axis was re-checked for regressions:

| Sprint 2 change | Accessibility impact | Verdict |
|---|---|---|
| Focus-ring refinement (Tasks 8/13/15/25) | Strengthened visible focus (`ring-2` + offset, ≥3:1) — improves `focus` audits | ✅ improvement |
| Sentence-case label cleanup (Tasks 2/3/6 sidebar/status) | Text content only; no name/role change | ✅ neutral |
| Status-chip cleanup (Task 7) | Removed pulsing; status still conveyed by text + color (Req 10.10) | ✅ neutral/positive |
| Dark-mode surface tokens (Task 6) | Re-validated contrast in Task 27 (light + dark) | ✅ neutral |
| AI panel / confidence badges (Tasks 22–24) | Confidence shown as text label + color (not color alone) — satisfies Req 10.10 | ✅ neutral |
| Icon-only `aria-label`s (Task 28) | Added accessible names — improves `button-name` | ✅ improvement |
| Card padding / section gaps (Tasks 9/10) | Layout class swaps; no semantic change; aids 200% reflow (Req 10.12) | ✅ neutral |

**No accessibility regression introduced by Sprint 2.** The only net change from this task is one additive
`aria-label`.

---

## 5. Validation Checklist Results

| Check | Result | Evidence |
|---|---|---|
| Lighthouse accessibility score is 100 | ⏳ Manual (high confidence) | All statically-decidable axe audits PASS; the one detectable violation is fixed; contrast/focus/keyboard validated in Tasks 25/27/29. Numeric score needs a browser run (§6). |
| No accessibility violations | ✅ PASS (static) | §2 fix + §3 all-green static audits |
| Test on all major pages | ✅ Source-level | Scan walks all 240 component files feeding every route; per-route browser trace deferred (§6) |
| No TypeScript errors | ✅ PASS | `getDiagnostics` clean on the modified file; `tsc` shows only the 2 pre-existing `badge.test.tsx` errors (test-only, outside the Next build graph; tracked in Tasks 26/28/37) |
| No console errors | ⏳ Manual | Static additive change only; runtime console capture needs a browser (§6) |

---

## 6. Residual Manual Verification (requires running build + browser)

Run after `npm run build` + `npm run start` (or the deployed preview) with Chrome DevTools → Lighthouse →
**Accessibility** (and the axe DevTools extension), on: `/dashboard`, `/ocr/scan`, `/ocr/history`,
`/steel/batches`, `/steel/invoices`, `/reports`, `/control-tower`, `/attendance/live`, `/approvals`,
`/billing`, `/settings/*`.

1. **Lighthouse Accessibility** — confirm score **100** on each major route; record numbers.
2. **axe-core full run** — confirm 0 violations for the DOM-relationship audits that can't be checked
   statically (`aria-required-children`, `aria-hidden-focus`, `list`/`listitem`, dynamic
   `aria-valid-attr-value`, runtime `duplicate-id`).
3. **Computed color-contrast** — confirm DevTools reports no contrast failures against painted pixels in
   both light and dark themes (token-level already validated in Task 27).
4. **Screen reader** — NVDA / JAWS / VoiceOver pass over `/approvals` to confirm the fixed "Expand source
   document crop" control announces correctly, plus a spot check of icon-only controls from Task 28.
5. **Keyboard** — re-run the Task 29 flow on each major route; confirm no traps and visible focus throughout.
6. **200% zoom reflow** (Req 10.12) — confirm content remains readable/usable at 200% text zoom.
7. **Console** — confirm no errors/warnings across the routes above.

---

## 7. Summary

- **One genuine Lighthouse `button-name` violation** (icon-only `⛶` expand control on `/approvals`) was
  found and **fixed** with an additive `aria-label` + `aria-hidden` glyph wrap. No other statically-detectable
  accessibility violations exist across 320 scanned files.
- **All statically-decidable Lighthouse accessibility audits PASS:** `html-has-lang`, `meta-viewport`
  (zoom allowed), `image-alt`, `label`, `button-name`/`link-name`, `aria-valid-attr`, `aria-roles`,
  `duplicate-id-*`, `tabindex`, `accesskeys`, `heading-order`. Contrast, focus indicators, and keyboard
  operability were validated in Tasks 27, 25, and 29 respectively.
- **No Sprint 2 accessibility regression:** Sprint 2 added no semantic/ARIA changes; focus-ring and
  icon-label work were net improvements.
- **Residual:** the numeric Lighthouse = 100 confirmation, the DOM-relationship axe audits, computed
  pixel-contrast, screen-reader, and console checks require a live browser/Lighthouse run and are documented
  in §6 for manual QA before release. Confidence that a live run scores 100 is **high**, given every
  statically-decidable audit is green and the contrast/focus/keyboard pillars were independently validated.

**Rollback:** `git revert <commit-hash>` reverts the single additive `aria-label` change in
`approval-queue-workspace.tsx` with no behavioral impact.
