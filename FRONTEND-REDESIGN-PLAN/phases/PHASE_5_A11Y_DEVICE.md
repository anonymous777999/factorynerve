# Phase 5 — Accessibility & device matrix

**Priority:** High | **Effort:** Medium | **Depends on:** Phases 1-4

## Goal
Meet WCAG AA basics and prove the app works across the real device matrix (mobile phone,
tablet, laptop, desktop). Lock it in with automated tests so it doesn't regress.

## Tasks

### 5.1 — Contrast
- Verify `--muted` (raised in Phase 1) and all text/accent pairs hit >= 4.5:1 (>=3:1 for
  large text). Fix any status-on-tint combos that fail.

### 5.2 — Tap targets & focus
- All interactive controls >= 44x44px (the 230 `py-1`/`py-1.5` controls — bump padding or
  min-height). Every control has a visible `focus-visible` ring (mostly free after Phase 2's
  Button migration; audit remaining custom controls).

### 5.3 — Semantics & labels
- Landmarks: `<header><nav><main><aside><footer>` in the shell. One `<h1>` per page.
- Icon-only buttons/links have `aria-label`; decorative SVGs `aria-hidden`.
- Form fields associated with `<label>` (shadcn `form`/`label` from Phase 2).
- Keyboard: drawer/dialog focus trap + Escape; skip-to-content link.

### 5.4 — Device matrix testing
- Extend Playwright (`web/e2e`, scripts `test:a11y`/`test:e2e` already exist) with viewport
  projects: 360x800 (phone), 768x1024 (tablet), 1024x768 (laptop), 1440x900 (desktop).
- Add axe-core a11y assertions on key routes (dashboard, reports, billing, ocr, approvals,
  access). Wire `audit:overflow` into the same matrix.

### 5.5 — Manual pass
- Real-device or emulator smoke on: login -> dashboard -> a steel page -> reports -> billing,
  on phone + desktop widths. Note issues in the changelog.

## Verification
- [ ] `npm --prefix web run test:a11y` passes (axe: no serious/critical violations on key routes).
- [ ] `npm --prefix web run audit:overflow` clean at 360/768/1024/1440.
- [ ] Keyboard-only traversal of shell + one dense page works (tab order, focus visible, Esc).
- [ ] Contrast checker: no AA failures on primary text/controls.
- [ ] `npm --prefix web run build` clean.

## Definition of done (whole redesign)
See `../README.md` section 5. When all five checks here pass AND every prior phase is ticked,
the redesign meets its bar.
