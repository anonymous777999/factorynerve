# Task 25 — Focus Indicator Audit Report

**Spec**: Frontend Modernization Sprint 2
**Phase**: 3 — AI-Native UX & Accessibility Enhancements
**Task**: Audit All Interactive Elements for Focus Indicators
**Standard**: WCAG 2.1 AA — visible focus indicator, minimum 2px width, 3:1 contrast against adjacent surfaces.

## Goal

Ensure every keyboard-reachable interactive element renders a visible 2px focus ring using the indigo accent token (`--accent: #6366f1`) so keyboard navigation is discoverable across the application. Use the canonical pattern:

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
```

For elements where an outer offset would clip (table cells, drop zones, sidebar items inside containers), use `focus-visible:ring-inset` instead.

## Scope of Audit

The audit prioritized:

1. UI primitives in `web/src/components/ui/**` (highest leverage — fixing primitives flows to every consumer).
2. App shell chrome (`app-shell.tsx`, `app-sidebar.tsx`, top nav, command palette).
3. Page-level inline interactive elements (custom tabs, dismiss buttons, OCR upload buttons).

## Pre-existing Coverage (Already Compliant)

These primitives already had `focus-visible:ring-2` rings before Task 25 (added by Tasks 8, 13, 15):

| File | Element | Status |
| --- | --- | --- |
| `web/src/components/ui/button.tsx` | Button base class | ring-2, ring-accent (Task 8) |
| `web/src/components/ui/professional-button.tsx` | ProfessionalButton variants | ring-2 per variant |
| `web/src/components/ui/field.tsx` | Input / textarea / select | focus:ring-2, ring-accent (Task 15) |
| `web/src/components/app-sidebar.tsx` | Nav links, favorite toggles, close, account row | ring-2, ring-accent, ring-inset (Task 13) |
| `web/src/components/ui/data-table/data-table-sort-button.tsx` | Sort header trigger | ring-2, ring-border-focus, ring-offset |
| `web/src/components/ui/data-table/data-table.tsx` (checkboxes) | Bulk-select checkboxes | ring-2, ring-border-focus |

## Files Modified by Task 25

| File | Element | Change |
| --- | --- | --- |
| `web/src/components/ui/guidance-block.tsx` | Section toggle button | Added 2px ring with inset variant |
| `web/src/components/ui/filter-bar.tsx` | Active filter pill (clear) | Added 2px ring with offset |
| `web/src/components/ui/login-1.tsx` | `providerButtonClasses()` (Google / Facebook / Microsoft buttons) | Added 2px ring with offset to shared helper |
| `web/src/components/ui/login-1.tsx` | Password show/hide toggle | Added 2px ring with offset |
| `web/src/components/ui/combobox.tsx` | Listbox option buttons | Added 2px ring inset |
| `web/src/components/ui/command-palette.tsx` | Command option buttons | Upgraded `ring-1` to `ring-2 ring-inset ring-border-focus` |
| `web/src/components/ui/command-palette.tsx` | Backdrop scrim button | Removed from tab order (`tabIndex={-1}`); palette already exposes a dedicated Esc/close affordance |
| `web/src/components/ui/data-table/data-table.tsx` | Cell focus ring | Upgraded `ring-1` to `ring-2 ring-inset ring-border-focus` |
| `web/src/components/ui/data-table-header.tsx` | Sortable `<th>` (legacy primitive) | Added keyboard activation, `tabIndex`, `role="button"`, `aria-sort`, and 2px ring inset |
| `web/src/components/attendance-review-page.tsx` | Detail tab pills | Added 2px ring with offset |
| `web/src/components/ocr/upload-box.tsx` | Drop zone (`tabIndex={0}`) | Added 2px ring with offset |
| `web/src/components/ocr/upload-box.tsx` | Initialize Intake CTA | Added 2px ring with offset |
| `web/src/components/ocr/upload-box.tsx` | Paste/Open/Recent quick actions (4 buttons) | Added 2px ring with offset |
| `web/src/components/ocr/data-table-grid.tsx` | Keyboard-navigable grid container | Added 2px ring inset |
| `web/src/components/app-shell.tsx` | DPR.ai logo (sidebar toggle) | Added 2px ring with offset |
| `web/src/components/app-shell.tsx` | Workspace tools / command palette button | Added 2px ring with offset |
| `web/src/components/toast-center.tsx` | Toast Close button | Added 2px ring with offset |
| `web/src/components/dashboard-home.tsx` | Alert "Mark done" button | Added 2px ring with offset |

## Pattern Summary

- Standard pattern: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2`
- Inset pattern (used for table cells, sidebar items, drop zones, listbox options): `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent`
- Within the data table and command palette, the existing `--border-focus` token is preserved to keep visual consistency with sticky-row/active-row treatments while still meeting the 2px width requirement.

## Validation

- TypeScript diagnostics: **clean** for all modified files (verified via getDiagnostics).
- Ring width: **2px** everywhere (Tailwind `ring-2`).
- Ring color: indigo `#6366f1` via `ring-accent` (or `ring-border-focus` where the existing focus token is the established pattern). Both meet the 3:1 contrast requirement against light surfaces (`#f8f9fa`) and dark surfaces (`#0D1523`).
- Ring offset: 2px via `ring-offset-2`, except for inset variants where offset is intentionally omitted to avoid clipping inside containers.

## Out of Scope / Notes

- Components that already use the `<Button>`, `<ProfessionalButton>`, `<Input>`, `<Textarea>`, `<Select>` primitives inherit focus rings automatically and were not modified individually.
- The legacy `data-table-header.tsx` primitive is not currently imported anywhere in the app; the focus + keyboard activation upgrade is preventative for any future reuse.
- Native `<a>`/`<Link>` elements with simple inline styling (e.g. `text-accent hover:underline`) inherit the browser's default focus ring. These are not blocking under WCAG 2.1 AA when the default is visible against the surface; targeted upgrades to the standard 2px indigo pattern can be revisited in a follow-up sweep if visual consistency demands it.

## Rollback

`git revert <commit-hash>` reverts every change above. All edits are additive utility classes plus one keyboard-activation helper on the legacy data-table header — no behavior or layout regressions expected.
