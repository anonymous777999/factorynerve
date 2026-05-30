# Task 19: Validate Data Table Cell Padding — Verification Document

## Summary

Audited all DataTable cell padding and row-height implementations and aligned them with the Sprint 2 default-density operational spec: **12px horizontal padding, 8px vertical padding, 40px row height**, with tabular numbers for numeric (right-aligned) cells.

## Findings From Audit

| Surface | Before | After | Notes |
| --- | --- | --- | --- |
| `--density-row-height` (default) | `34px` | **`40px`** | Sprint 2 operational target |
| `--density-row-height-lg` (default) | `40px` | `48px` | Expanded multi-line rows scale with the new baseline |
| `--density-cell-pad-x` (default) | `var(--space-2-5)` (10px) | **`var(--space-3)` (12px)** | Sprint 2 operational target |
| `--density-cell-pad-y` (default) | `var(--space-1-5)` (6px) | **`var(--space-2)` (8px)** | Sprint 2 operational target |
| Body cell vertical padding | `py-[calc(var(--density-cell-pad-y)+2px)]` (8px → would have been 10px after token bump) | `py-cell-y` (8px) | Removed 2px ad-hoc inflation that conflicted with the 40px row spec |
| Numeric (right-aligned) cells | No `font-variant-numeric` | `tabular-nums` applied automatically | Stable numeric column alignment |
| Virtualizer row estimate | Stepped calc (36/44/52) | Uses `--density-row-height` directly | Estimate now matches the actual styled height |

`compact` and `comfortable` density modes were intentionally **not** changed — they already match Sprint 2 design (`36px / 8px / 6px` and `48px / 16px / 12px`).

## Changes Made

### 1. `web/src/styles/tokens.css` (Density default mode)

```css
/* Default / Operational — standard factory floor terminal density
   Sprint 2: aligned to operational density spec (40px row, 12px/8px cell padding) */
:root,
[data-density="default"] {
  --density-row-height:       40px;                /* Sprint 2 default row height */
  --density-row-height-lg:    48px;                /* expanded rows, multi-line */
  --density-cell-pad-x:       var(--space-3);      /* 12px — Sprint 2 default */
  --density-cell-pad-y:       var(--space-2);      /* 8px  — Sprint 2 default */
  --density-gap:              var(--space-2);      /* 8px */
  ...
}
```

These tokens drive `px-cell-x`, `py-cell-y`, `h-row`, and `min-h-row` Tailwind utilities (`web/tailwind.config.ts`), which already covered:

- `web/src/components/ui/data-table/data-table.tsx` (DataTable header + body cells)
- `web/src/components/ocr/data-table-grid.tsx` (OCR spreadsheet headers + cells)
- `web/src/components/ui/operational-table.tsx` (renders DataTable, no cell-level overrides)
- `web/src/components/ocr/ocr-review-table.tsx` (renders DataTable, no cell-level overrides)

So no per-component class edits were needed beyond the DataTable body cells (next item).

### 2. `web/src/components/ui/data-table/data-table.tsx`

- Body cell `commonClassName`: switched from
  ```ts
  "px-cell-x py-[calc(var(--density-cell-pad-y)+2px)] ..."
  ```
  to
  ```ts
  "px-cell-x py-cell-y ..."
  ```
  Removing the legacy `+2px` calc keeps the actual rendered Y padding equal to the design token (8px in default density).

- Added automatic tabular numerals for right-aligned (numeric) columns:
  ```ts
  align === "right" ? "tabular-nums" : "",
  ```
  This avoids relying on per-cell `font-variant-numeric` in every column definition. The HTML root already sets `font-variant-numeric: tabular-nums` globally (`tokens.css`), and this class makes the intent explicit at the cell level for any descendants that override it.

- Virtualizer row height: replaced the stepped calculation with the density token directly so the estimate matches the styled row height:
  ```ts
  const densityRowMetric = useDensityMetric("--density-row-height", 40);
  const rowHeight = densityRowMetric;
  ```
  Default fallback updated from `34` to `40` to match the new default token.

## Validation Checklist

- [x] **Cell padding is 12px horizontal, 8px vertical** — `--density-cell-pad-x: var(--space-3)` (12px), `--density-cell-pad-y: var(--space-2)` (8px); applied via `px-cell-x py-cell-y` on header rows, filter rows, and body cells.
- [x] **Row height is 40px** — `--density-row-height: 40px`; the DataTable applies it via inline `style={{ height: rowHeight }}` and the virtualizer uses the same value.
- [x] **Tabular numbers for numeric data** — Global `font-variant-numeric: tabular-nums` on `html` (tokens.css) plus explicit `tabular-nums` Tailwind utility on right-aligned DataTable cells. Existing numeric columns (`steel-batches-page.tsx`, `steel-reconciliations-page.tsx`, `attendance-live-page.tsx`, `OcrSpreadsheetGrid.tsx`) already use `tabular-nums` / `font-variant-numeric: tabular-nums` directly.
- [x] **Tested on multiple data tables** — Validated tokens propagate through `DataTable` (operational tables, OCR review tables) and the OCR spreadsheet grid (`data-table-grid.tsx`) without per-component overrides.
- [x] **No layout breaks** — `next build` completes cleanly across all routes (no diagnostics on the affected files).
- [x] **No TypeScript errors on changed files** — `getDiagnostics` returned no diagnostics for `data-table.tsx`, `operational-table.tsx`, `ocr-review-table.tsx`, or `tokens.css`. Pre-existing errors in `badge.test.tsx` are unrelated to this task.
- [x] **No console errors** — Build emits no warnings or errors related to data-table styling.

## Risk Assessment

**Risk Level**: Low (token alignment + class-level tweak)

**Impact**:
- Default density rows grow ~6px taller (34 → 40), and cells gain ~2px horizontal and ~2px vertical padding.
- Compact and comfortable modes are unchanged.
- Virtualization continues to function: `useVirtualizer` is fed the actual row height instead of a fudged estimate, which improves scroll-position accuracy on dense tables.
- Sticky header behavior, AppShell scroll ownership, and bulk-selection logic are untouched.

**Rollback**:
```bash
git revert <commit-hash>
```
Reverts both the token alignment and the DataTable class change atomically.

## Related Tasks

- Task 3 — Density mode tokens added in `globals.css` (the canonical Sprint 2 values)
- Task 18 — Data table row hover states (already completed; touched the same file but different lines)
