# Task 26 — Image Alt Text & Non-text Content Audit

**Spec**: Frontend Modernization Sprint 2
**Phase**: 3 — AI-Native UX & Accessibility Enhancements
**Task**: Audit All Images for Alt Text
**Standard**: WCAG 2.1 AA — 1.1.1 Non-text Content
**Related requirements**: Requirement 10.6 (alt text for informative images), Requirement 10.7 (mark decorative images as decorative), Requirement 10.5 (semantic roles/labels for interactive elements).

## Goal

Every image must either:

1. Convey its content and function through descriptive `alt` text (informative images), or
2. Be removed from the accessibility tree when it is purely decorative (`aria-hidden="true"` / empty `alt` / wrapped in a labeled control).

## Scope of Audit

Three categories of non-text content were inventoried across `web/src/**`:

1. Raster images — `<img>` tags and Next.js `<Image>` components.
2. Inline `<svg>` elements (hand-authored icons and one data chart).
3. Icon-library glyphs (`lucide-react`) and CSS-rendered marks (initials avatars, the text logo).

Search method: `grep` for `<img`, `next/image`, `<svg`, `viewBox`, `alt=`, `aria-hidden`, `role="img"`, `[Ll]ogo`, `[Aa]vatar`, and `background-image`/`url(`.

## Findings — Raster Images (`<img>`)

There is **no usage of the Next.js `<Image>` component** anywhere in the app (`next/image` import count: 0). All raster images use the native `<img>` element, and **every one already carried an `alt` attribute** before this task. They are all informative (user-uploaded OCR source documents and profile photos), so descriptive alt text is the correct treatment.

| File | Image | `alt` value | Classification | Result |
| --- | --- | --- | --- | --- |
| `web/src/components/ocr/image-preview.tsx` | OCR preview (reusable) | `alt` prop (required, no default) | Informative | Compliant — `alt` is a required prop, callers pass document-specific text |
| `web/src/components/ocr/verification-v2/ocr-review-preview-pane.tsx` | OCR source | `source_filename` ?? `OCR source {id}` | Informative | Compliant |
| `web/src/components/ocr/progress-indicator.tsx` | OCR processing preview | `"OCR processing preview"` | Informative | Compliant |
| `web/src/components/ocr/camera-capture.tsx` | Captured photo | `"Captured preview"` | Informative | Compliant |
| `web/src/components/ocr-scan/ocr-progress.tsx` | Scan preview | `"Scan preview"` | Informative | Compliant |
| `web/src/components/ocr-scan/ocr-editor.tsx` | Edited scan | `"Edited scan"` | Informative | Compliant |
| `web/src/components/ocr-scan-page.tsx` (×2) | Source document | `"Source document"` | Informative | Compliant |
| `web/src/components/profile-page.tsx` | Saved profile photo | `` `${profile.name} profile` `` | Informative | Compliant |
| `web/src/components/profile-page.tsx` | Crop preview | `"Selected profile crop"` | Informative | Compliant |
| `web/src/components/profile-page.tsx` | Final crop preview | `"Final profile preview"` | Informative | Compliant |
| `web/src/legacy-ui/ocr/ocr-verification-page.tsx` | OCR source | `source_filename` ?? `"OCR source"` | Informative | Compliant |

No raster image required changes.

## Findings — Inline SVG

Inline `<svg>` elements fall into two groups.

### Decorative icons (need removal from the a11y tree)

These icons sit next to a visible text label, or live inside a button/control that already exposes an `aria-label`/`sr-only` name. They were marked `aria-hidden="true"` and `focusable="false"` so screen readers announce the surrounding text/label instead of an unnamed graphic.

| File | Icon | Accompanying accessible name | Change |
| --- | --- | --- | --- |
| `web/src/components/app-sidebar.tsx` | 23 nav icons (`NavIcon`) | Adjacent nav label text | Refactored to single `<svg aria-hidden focusable="false">` wrapper over a path map |
| `web/src/components/app-sidebar.tsx` | `FavoriteIcon` | Inside labeled favorite toggle button | `aria-hidden` + `focusable="false"` |
| `web/src/components/app-sidebar.tsx` | `ChevronIcon` | Inside labeled section toggle | `aria-hidden` + `focusable="false"` |
| `web/src/components/app-shell.tsx` | Command-palette glyph | Button `aria-label="Workspace tools"` | `aria-hidden` + `focusable="false"` |
| `web/src/components/app-header.tsx` | Hamburger glyph | Button `aria-label={sidebarLabel}` | `aria-hidden` + `focusable="false"` |
| `web/src/components/notification-center.tsx` | Bell glyph | Button `aria-label` + `sr-only` "Notifications" | `aria-hidden` + `focusable="false"` |
| `web/src/components/ocr/ocr-notification-dropdown.tsx` | Bell glyph | Button `aria-label="Notifications"` | `aria-hidden` + `focusable="false"` |
| `web/src/components/ocr/ocr-notification-dropdown.tsx` | Dismiss "×" glyph | Button `aria-label="Dismiss"` | `aria-hidden` + `focusable="false"` |
| `web/src/components/ocr/mobile-entry.tsx` | Camera glyph | Button `aria-label="Scan with camera"` | `aria-hidden` + `focusable="false"` |
| `web/src/components/ocr/upload-box.tsx` | Upload glyph | Adjacent "Load source document" heading | `aria-hidden` + `focusable="false"` |
| `web/src/components/ocr/progress-indicator.tsx` | Stage "done" check glyph | Adjacent stage label text | `aria-hidden` + `focusable="false"` |
| `web/src/app/403/page.tsx` | `LockIcon` | Adjacent "Access Restricted" text | `aria-hidden` + `focusable="false"` |

Already compliant before this task (no change needed):

- `web/src/components/ui/button.tsx` — loading spinner already `aria-hidden="true"`.
- `web/src/components/password-field.tsx` — both eye glyphs are wrapped in a `<span aria-hidden="true">`, and the toggle button carries `aria-pressed` + label, so the SVGs are already hidden.

### Informative SVG (needs an accessible name)

| File | SVG | Change |
| --- | --- | --- |
| `web/src/components/premium-dashboard-page.tsx` | Units/performance trend line chart | Added `role="img"` + descriptive `aria-label` summarizing the chart and pointing to the adjacent per-day text summary |

## Findings — Logo, Avatars, Backgrounds

- **Logo**: The "DPR.ai" wordmark in `app-shell.tsx` is rendered as live text inside a `<button>` (with `aria-label` for the sidebar toggle), not an image. No alt text needed.
- **Avatars**: `attendance-review-page.tsx` and `profile-page.tsx` fallbacks render user initials as text in a styled `<div>` (`getAvatarLabel` / `initialsFromName`). These are text, not images.
- **Icon library**: `lucide-react` icons render SVGs with `aria-hidden="true"` by default; the icon-only controls that use them (e.g. `app-header`, `ocr-scan-page` Eye/EyeOff) carry `aria-label` or `aria-hidden` already.
- **CSS backgrounds**: The only decorative `background`/`radial-gradient` usages (e.g. `mobile-entry.tsx`) are presentational and correctly excluded from the accessibility tree by virtue of being CSS, not content images.

## Files Modified by Task 26

1. `web/src/components/app-sidebar.tsx` — refactored `NavIcon` to a path map and added `aria-hidden`/`focusable="false"` to `NavIcon`, `FavoriteIcon`, `ChevronIcon`; added `ReactNode` type import.
2. `web/src/components/app-shell.tsx` — command-palette icon `aria-hidden`.
3. `web/src/components/app-header.tsx` — hamburger icon `aria-hidden`.
4. `web/src/components/notification-center.tsx` — bell icon `aria-hidden`.
5. `web/src/components/ocr/ocr-notification-dropdown.tsx` — bell + dismiss icons `aria-hidden`.
6. `web/src/components/ocr/mobile-entry.tsx` — camera icon `aria-hidden`.
7. `web/src/components/ocr/upload-box.tsx` — upload icon `aria-hidden`.
8. `web/src/components/ocr/progress-indicator.tsx` — stage check icon `aria-hidden`.
9. `web/src/app/403/page.tsx` — lock icon `aria-hidden`.
10. `web/src/components/premium-dashboard-page.tsx` — trend chart `role="img"` + `aria-label`.

## Validation

- **`<img>` coverage**: 11 `<img>` instances, all with descriptive `alt`. 0 `next/image` usages. No raster image gaps.
- **Decorative SVGs**: all hand-authored decorative icons now removed from the accessibility tree via `aria-hidden="true"` (`focusable="false"` added to suppress legacy IE/Edge tab stops).
- **Informative SVG**: the dashboard chart now exposes an accessible name.
- **TypeScript**: `getDiagnostics` clean on all 10 modified files. (`tsc --noEmit` reports 2 pre-existing errors in the untracked `src/components/ui/badge.test.tsx`, which is unrelated to this task and was not modified.)
- **ESLint**: clean (exit 0) across all modified files, including the `@next/next/no-img-element` rule (existing eslint-disable comments preserved).
- **Screen reader**: Manual verification with NVDA/JAWS/VoiceOver is recommended as a follow-up; the static analysis above confirms decorative graphics are silenced and informative ones are named. Automated checks cannot fully substitute for assistive-technology testing.

## Out of Scope / Notes

- Storybook example files (`web/src/stories/Header.tsx`, `web/src/stories/Page.tsx`) contain template SVGs from the Storybook starter; they are not part of the product UI and were left unchanged.
- The reusable `ImagePreview` component keeps `alt` as a **required** prop (no default), which is the safest contract — callers are forced to supply meaningful text rather than silently rendering an empty alt.

## Rollback

`git revert <commit-hash>` reverts every change above. All edits are additive accessibility attributes plus one non-behavioral refactor of the sidebar icon switch into a path lookup map — no layout, behavior, or rendering changes expected.
