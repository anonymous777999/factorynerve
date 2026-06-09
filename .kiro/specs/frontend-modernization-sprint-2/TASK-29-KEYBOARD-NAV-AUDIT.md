# Task 29 — Keyboard Navigation Flow Audit (WCAG 2.1 AA)

**Spec**: Frontend Modernization Sprint 2
**Phase**: 3 — AI-Native UX & Accessibility Enhancements
**Task**: Validate Keyboard Navigation Flow
**Standards**:
- WCAG 2.1 AA — 2.1.1 Keyboard (all functionality operable from keyboard)
- WCAG 2.1 AA — 2.1.2 No Keyboard Trap (focus can always move away)
- WCAG 2.1 AA — 2.4.3 Focus Order (logical, meaningful order)
**Risk Level**: Low (accessibility validation, minimal targeted fixes)

## Goal

Validate that keyboard navigation is logical and complete across all pages:
Tab / Shift+Tab move focus in a sensible order, Enter and Space activate
controls, Escape dismisses overlays, intentional modal focus traps release on
close and restore focus to their trigger, and there are no *unintended* focus
traps. Fix any genuine gaps found; document compliant implementations.

## Audit Method

Static analysis across `web/src/**`:

1. **Tab order anti-patterns** — `grep` for positive `tabIndex` values
   (`tabIndex={1}`+) which break natural DOM order.
2. **Custom interactive elements** — `grep` for `role="button"`, and for
   `onClick` on non-button/non-link elements (`<div onClick>`), which must also
   handle Enter/Space.
3. **Overlay focus management** — read every modal/drawer/dropdown/popover
   component and verify: Escape close, focus trap (where modal), focus
   restoration on close, and `role="dialog"`/`aria-modal` semantics.
4. **Keyboard handlers** — `grep` for `onKeyDown`, `Escape`, arrow-key handling
   in tables, comboboxes, and the command palette.

## Findings Summary

| Area | Result |
| --- | --- |
| Positive `tabIndex` values (anti-pattern) | **None found** — natural tab order preserved everywhere |
| `onClick` on bare `<div>`/`<span>` without keyboard handler | **None found** — all clickable elements are `<button>`/`<a>`/`<Link>` |
| Modal focus trap + Escape + restore | Mostly compliant; **3 components fixed** (below) |
| Data table keyboard nav | Compliant (arrow keys, Enter activation, Escape clears selection) |
| Command palette keyboard nav | Compliant (Arrow/Home/End/Enter/Escape, focus trap, restore) |
| Form inputs / combobox | Compliant (Escape closes combobox, Tab order natural) |

## Issues FIXED in this task

Three overlay components opened a modal-style surface but lacked complete
keyboard handling. Each was brought in line with the established
`OperationalDrawer` / `ConfirmationModal` pattern (Escape to close, focus trap
while open, focus restoration to the trigger on close, `role="dialog"` +
`aria-modal`).

| File | Gap | Fix |
| --- | --- | --- |
| `web/src/components/jobs-drawer.tsx` | Modal side-drawer (`fixed inset-0` scrim + `<aside>`) had **no Escape handler, no focus trap, no focus restoration, no dialog role** | Added `keydown` effect (Escape closes, Tab/Shift+Tab wraps within panel), focus moves into panel on open and returns to trigger on close, added `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, scrim `tabIndex={-1}`, panel `tabIndex={-1}` |
| `web/src/components/feedback-widget.tsx` | Feedback sheet overlay (`fixed inset-0` scrim + panel) had **no Escape handler, no focus trap, no focus restoration, no dialog role** | Added `keydown` effect (Escape closes, focus wrap), focus into panel on open and restore on close, added `role="dialog"`, `aria-modal="true"`, `aria-label`, scrim `tabIndex={-1}` |
| `web/src/components/ocr/ocr-notification-dropdown.tsx` | Bell dropdown closed on outside-click but had **no Escape handler** (inconsistent with `NotificationCenter`, which had both) | Added `Escape` keydown handler to close, added `aria-expanded` to the trigger |

All fixes are additive (event handlers + ARIA attributes). No layout, routing,
data, or rendering behavior was changed. TypeScript diagnostics are clean on all
three files.

### Why these are real issues (not intentional traps)

A modal overlay that cannot be dismissed with Escape and does not restore focus
forces keyboard and screen-reader users to Tab blindly out of (or get stuck
behind) the overlay. The `JobsDrawer` and feedback sheet are launched from a
button and cover the workspace; without Escape + restore they violate 2.1.1 and
degrade 2.4.3. The OCR dropdown was a smaller inconsistency but is the same
class of fix already applied to `NotificationCenter`.

## Components verified COMPLIANT (no change needed)

### Modals / drawers (intentional, well-behaved focus traps)

| File | Escape | Focus trap | Focus restore | Dialog role |
| --- | --- | --- | --- | --- |
| `web/src/components/ui/operational-drawer.tsx` | ✅ | ✅ Tab wrap | ✅ `previousActiveElement` | ✅ `role="dialog"` `aria-modal` |
| `web/src/components/ui/confirmation-modal.tsx` | ✅ (+ Cmd/Ctrl+Enter confirm, Enter on cancel) | ✅ Tab wrap | ✅ | ✅ |
| `web/src/components/ui/command-palette.tsx` | ✅ | ✅ Tab wrap | ✅ | ✅ + `role="listbox"`/`option`, Arrow/Home/End nav, `aria-activedescendant` |

These correctly **trap focus while open** (intentional, allowed by 2.1.2 because
Escape always releases) and **return focus to the trigger** on close.

### Tables / grids

- `web/src/components/ui/data-table/data-table.tsx` — cell roving focus,
  Enter activates rows, Escape clears bulk selection, checkboxes keyboard
  reachable with focus rings.
- `web/src/components/ui/data-table-header.tsx` — sortable headers expose
  `role="button"`, `tabIndex={0}`, Enter/Space activation, `aria-sort`.
- `web/src/components/ocr/data-table-grid.tsx` — focusable grid container
  (`tabIndex={0}`) with arrow-key cell navigation and inset focus ring.

### Dropdowns / popovers / inputs

- `web/src/components/notification-center.tsx` — Escape + outside-click close.
- `web/src/components/ocr/ocr-notification-dropdown.tsx` — now Escape + outside-click (fixed above).
- `web/src/components/ui/combobox.tsx` — Arrow navigation, Escape close, Enter select, natural Tab via input.
- `web/src/components/app-sidebar.tsx` — nav links/toggles keyboard reachable with 2px focus rings (Task 13), mobile close button labeled.
- `web/src/components/app-mobile-menu.tsx` — overlay scrim is a labeled `<button>` (Enter/Space/click close); the sidebar it dims is composed of native links/buttons.

### Activation semantics (Enter / Space)

- All actionable controls are native `<button>`, `<a>`, `<Link>`, `<input>`,
  `<textarea>`, or `<select>` elements, which receive Enter/Space activation
  from the browser for free. No `<div onClick>` / `<span onClick>` shims exist
  (verified by grep), so there are no custom elements missing key handlers.

## Tab Order (2.4.3)

- **No positive `tabIndex`** anywhere in `web/src/**` (verified by grep), so tab
  order follows DOM/visual order.
- `tabIndex={-1}` is used only to (a) remove decorative scrim buttons from the
  tab sequence and (b) make modal panels programmatically focusable — both are
  correct patterns.
- `tabIndex={0}` is used only on genuinely interactive custom containers (upload
  drop zone, OCR grid, sortable header, preview pane), each with a visible focus
  ring and key handlers.

## No Keyboard Trap (2.1.2)

- The only focus traps are the **intentional modal traps** (drawer, modal,
  command palette, and now jobs-drawer + feedback sheet). Every one of them
  releases focus via **Escape** and restores focus to the launching control.
- No element was found that captures Tab without an escape path.

## Validation

- **Static audit coverage**: all overlay/interactive components under
  `web/src/**` reviewed; grep sweeps for positive `tabIndex`, `role="button"`,
  and `<div onClick>` returned the expected results (no anti-patterns).
- **TypeScript**: `getDiagnostics` clean on all three modified files. Full
  `tsc --noEmit` reports only the 2 pre-existing errors in the untracked
  `src/components/ui/badge.test.tsx` (missing `@testing-library/react` types +
  a `BadgeStatus` mismatch) — documented in Tasks 26/28, not introduced here and
  not part of product code.
- **Manual keyboard/AT testing**: a full keyboard-only pass and screen-reader
  verification (NVDA / JAWS / VoiceOver) is recommended as follow-up. Static
  analysis confirms the structural requirements (key handlers, focus trap,
  restoration, ARIA) but cannot fully substitute for assistive-technology
  testing.

## Files Modified by Task 29

1. `web/src/components/jobs-drawer.tsx` — Escape close, focus trap, focus restoration, `role="dialog"`/`aria-modal`/`aria-labelledby`, scrim `tabIndex={-1}`.
2. `web/src/components/feedback-widget.tsx` — Escape close, focus trap, focus restoration, `role="dialog"`/`aria-modal`/`aria-label`, scrim `tabIndex={-1}`.
3. `web/src/components/ocr/ocr-notification-dropdown.tsx` — Escape close handler + `aria-expanded` on trigger.

## Validation Checklist (task)

- [x] Tab order is logical (no positive `tabIndex`; DOM order preserved)
- [x] All interactive elements are reachable via keyboard (native controls; custom containers have `tabIndex={0}`)
- [x] No focus traps (only intentional modal traps, all release on Escape + restore focus)
- [x] Enter activates buttons and links (native semantics; data-table rows handle Enter)
- [x] Space activates buttons and toggles checkboxes (native semantics; sortable headers handle Space)
- [x] Escape closes modals and dropdowns (verified across all overlays; 3 gaps fixed)
- [x] Tested across all major overlay/page patterns (sidebar, tables, command palette, modals, drawers, dropdowns)
- [x] No TypeScript errors introduced (only pre-existing badge.test.tsx errors remain)
- [x] No console errors expected (additive handlers/attributes only)

## Rollback

`git revert <commit-hash>` reverts all three edits. Every change is additive
(keyboard event handlers + ARIA attributes) with no behavioral or layout
regression for mouse/touch users.
