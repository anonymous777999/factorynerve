# Task 28 — ARIA Labels for Icon-Only Buttons (WCAG 2.1 AA — 4.1.2)

**Spec**: Frontend Modernization Sprint 2
**Phase**: 3 — AI-Native UX & Accessibility Enhancements
**Task**: Add ARIA Labels to Icon-Only Buttons
**Standard**: WCAG 2.1 AA — 4.1.2 Name, Role, Value
**Risk Level**: Low (accessibility enhancement — additive attributes only)

## Goal

Every icon-only button (a `<button>` / `<Button>` whose only content is an icon,
SVG, or single glyph such as `+`, `-`, `×`) must expose an accessible name so
screen readers can announce its purpose. The accessible name is supplied via an
`aria-label` written in sentence case that describes the **action** (e.g. "Zoom
in", "Close dialog").

Buttons that already have a visible text label, an `sr-only` text node, or an
existing `aria-label` are **not** modified — adding a redundant `aria-label`
would either duplicate or override the visible name.

## Scope of Audit

All interactive `<button>` and `<Button>` elements across `web/src/**` were
inventoried for accessible names. Search strategy:

1. `grep` for `aria-label` to map already-labeled controls.
2. `grep` for `size="icon"` (the icon-only Button size variant).
3. `grep` for single-glyph button content (`+`, `-`, `×`, `‹`, `›`, arrows,
   chevrons, emoji/symbol marks).
4. `grep` for `<svg`, `lucide-react` icon imports, and square sizing classes
   (`h-8 w-8`, `h-10 w-10`, `h-11 w-11`, etc.) to find buttons whose only child
   is a graphic.
5. `grep` for `sr-only` to confirm which icon buttons already carry a
   visually-hidden text name.

## Findings — buttons FIXED in this task

Two components contained icon-only buttons with no accessible name. Descriptive
`aria-label`s were added.

| File | Button | Glyph | Added `aria-label` |
| --- | --- | --- | --- |
| `web/src/components/ocr-scan-page.tsx` | Result preview zoom-out | `-` | `"Zoom out"` |
| `web/src/components/ocr-scan-page.tsx` | Result preview zoom-in | `+` | `"Zoom in"` |
| `web/src/components/billing-page.tsx` | Add-on quantity decrement | `-` | `` `Decrease ${addon.name} quantity` `` |
| `web/src/components/billing-page.tsx` | Add-on quantity increment | `+` | `` `Increase ${addon.name} quantity` `` |

For the billing steppers the label is interpolated with the add-on name (e.g.
"Decrease OCR scan packs quantity") so a screen-reader user knows exactly which
add-on the stepper controls when multiple add-ons are listed.

## Findings — icon-only buttons ALREADY compliant (no change)

These icon-only controls were verified to already expose an accessible name and
were intentionally left unchanged (changing them was out of scope and would risk
double-announcement). Several were labeled in Task 26.

| File | Control | Existing accessible name |
| --- | --- | --- |
| `web/src/components/app-shell.tsx` | Command-palette glyph | `aria-label="Workspace tools"` |
| `web/src/components/app-shell.tsx` | Sidebar toggle (wordmark) | `aria-label={"Hide/Show sidebar"}` |
| `web/src/components/app-header.tsx` | Hamburger toggle | `aria-label={sidebarLabel}` |
| `web/src/components/app-header.tsx` | Go back / command palette | `aria-label` (translated) |
| `web/src/components/app-sidebar.tsx` | Favorite pin toggle | `aria-label={"Pin/Unpin ..."}` + `aria-pressed` |
| `web/src/components/app-sidebar.tsx` | Mobile close sidebar | `aria-label="Close sidebar"` |
| `web/src/components/app-mobile-menu.tsx` | Overlay close | `aria-label="Close sidebar overlay"` |
| `web/src/components/notification-center.tsx` | Bell | `aria-label="Open notifications"` + `sr-only` "Notifications" |
| `web/src/components/ocr/ocr-notification-dropdown.tsx` | Bell + dismiss | `aria-label="Notifications"` / `aria-label="Dismiss"` |
| `web/src/components/ocr/mobile-entry.tsx` | Camera FAB | `aria-label="Scan with camera"` |
| `web/src/components/ocr/camera-capture.tsx` | Shutter | `aria-label="Capture document"` |
| `web/src/components/ocr-scan-page.tsx` | Review-rail show/hide (Eye/EyeOff) | `aria-label="Show/Hide review rail"` |
| `web/src/components/profile-page.tsx` | 4× section expand toggles (`+`/`-`) | `aria-label="Toggle ... section"` |
| `web/src/components/jobs-drawer.tsx` | Overlay close | `aria-label="Close jobs drawer"` |
| `web/src/components/feedback-widget.tsx` | Open / close feedback | `aria-label="Open feedback"` / `"Close feedback"` |
| `web/src/components/password-field.tsx` | Eye toggle | `sr-only` "Show/Hide password" + `aria-pressed` |
| `web/src/components/ui/operational-drawer.tsx` | Close panel | `aria-label={closeLabel}` (default "Close panel") |
| `web/src/components/ui/command-palette.tsx` | Overlay close | `aria-label={closeLabel}` |

## Findings — NOT icon-only (correctly excluded)

The following controls render a glyph/SVG **alongside visible text** or **are
themselves text buttons**, so they already have an accessible name from their
text content and must NOT receive an `aria-label`:

- `web/src/components/google-auth-button.tsx` — "G" mark + "Continue with Google" text.
- `web/src/components/ocr/edit-toolbar.tsx` — "+ Row", "+ Col", "Undo", "Redo", "Header row" (text labels).
- `web/src/components/ocr-scan/ocr-editor.tsx` — "Rotate", "Crop Tighter", etc. (text labels).
- `web/src/components/ocr/prep-toolbar.tsx` — "Original / Clean / Contrast" + "Retake" (text labels).
- `web/src/components/ocr/share-link-generator.tsx` — "Generate link" / "Copy" (text labels).
- `web/src/components/ocr/RawDataView.tsx` — "Expand/Collapse", "Copy", "Download" (text labels).
- `web/src/components/toast-center.tsx` / `camera-capture.tsx` / `jobs-drawer.tsx` — "Close" text buttons.
- `web/src/components/ocr/data-table-grid.tsx` — cell button shows cell value + confidence text.
- `web/src/components/ui/data-table-header.tsx` — sort arrows sit beside the column header text; the header cell carries `aria-sort`.
- `web/src/components/ui/login-1.tsx` — password toggle shows "Show"/"Hide" text.
- `web/src/components/ocr-scan-page.tsx` source toolbar — "Zoom -", "Zoom +", "Fit width", "Magnifier", "Reset" (text labels).
- `web/src/components/billing-page.tsx` — primary actions are text buttons; only the quantity steppers were icon-only (fixed above).
- `web/src/components/ui/filter-bar.tsx` — the active-filter chip button wraps a `<Badge>` whose visible text reads `"{label}: {value} x"`, so the chip already has a text-derived accessible name and is not icon-only.

## Files Modified by Task 28

1. `web/src/components/ocr-scan-page.tsx` — added `aria-label="Zoom out"` / `aria-label="Zoom in"` to the result-preview zoom steppers.
2. `web/src/components/billing-page.tsx` — added interpolated `aria-label` to the add-on quantity decrement/increment steppers.

Both edits are additive `aria-label` attributes only — no layout, behavior, or
rendering changes.

## Validation

- **Audit coverage**: All `<button>`/`<Button>` icon-only candidates across
  `web/src/**` reviewed. Only 4 lacked an accessible name; all 4 are now labeled.
- **TypeScript**: `getDiagnostics` clean on both modified files. Full
  `tsc --noEmit` reports only the 2 pre-existing errors in the untracked
  `src/components/ui/badge.test.tsx` (documented in Task 26; not modified here).
- **ESLint**: No new findings introduced by the aria-label additions. Pre-existing,
  unrelated lint warnings remain in `billing-page.tsx` (setState-in-effect on
  lines 166/230, React-compiler memoization on 257) and `ocr-scan-page.tsx`
  (variable-before-declaration on line 1297); these predate and are unrelated to
  this task.
- **Screen reader**: Manual verification with NVDA / JAWS / VoiceOver is
  recommended as a follow-up. Static analysis confirms every icon-only button now
  exposes a descriptive name; assistive-technology testing cannot be fully
  substituted by static checks.

## Out of Scope / Notes

- Storybook starter files (`web/src/stories/Header.tsx`, `Button.tsx`, `Page.tsx`)
  are not product UI and were left unchanged.
- Decorative SVGs inside labeled buttons already carry `aria-hidden="true"` +
  `focusable="false"` from Task 26, so the button's `aria-label` is the single
  announced name (no double-announcement).

## Rollback

`git revert <commit-hash>` reverts both edits. All changes are additive
accessibility attributes with no behavioral impact.
