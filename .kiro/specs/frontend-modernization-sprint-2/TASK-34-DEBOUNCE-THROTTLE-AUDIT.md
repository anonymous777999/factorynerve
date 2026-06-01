# Task 34 - Debounce & Throttle Pattern Audit

**Spec:** Frontend Modernization Sprint 2 - Phase 4 (Performance Validation)
**Acceptance criterion:** Requirement 12.8 - "THE System SHALL debounce search operations with 300ms delay and filter operations with 150ms delay."
**Risk level:** Low (performance validation with targeted fixes)
**Status:** Complete

---

## Objective

Validate that:
- Search operations use a 300ms debounce.
- Filter operations use a 150ms throttle.
- Interaction stays responsive and avoids excessive API calls / expensive recomputation.

Only make changes where there is a genuine performance issue (debounce missing on
API-triggering search, throttle missing on expensive filtering). Client-side
filtering of already-loaded data does not require debounce.

---

## Audit Method

Searched the `web/src` tree for:
- Debounce/throttle usage: `debounce|throttle|useDebounce|useThrottle`
- Deferred value usage: `useDeferredValue`
- Search state/handlers: `setSearch|setQuery|searchTerm|onSearchChange`
- Filter handlers: `FilterBar`, `enableColumnFilters`, `setFilterValue`, `DataTableFilterCell`

Then classified each search/filter surface by **what the change drives**:
- **API call** (search/filter feeds a network request or React Query key) -> needs debounce.
- **Expensive client recompute** (re-runs a filtered row model over many rows) -> benefits from throttle.
- **Cheap client filter / discrete change** (in-memory filter, select/date pickers) -> no debounce/throttle required.

---

## Findings

### Already compliant (no change needed)

| Location | Mechanism | Notes |
|---|---|---|
| `web/src/hooks/use-data-table-route-state.ts` | `setSearch` clears + sets `setTimeout(..., options.debounceMs ?? 300)` | 300ms search debounce already in place. Used by `steel-batches-page.tsx`. Matches Requirement 12.8 search delay. |
| `web/src/components/attendance-review-page.tsx` | `useDeferredValue(search)` | React concurrent deferral keeps the input responsive while client-side filtering recomputes. Filtering is over already-loaded data (no API per keystroke). |
| `web/src/components/ui/command-palette.tsx` | `useDeferredValue(query)` | Command list filtering is in-memory and deferred. No API per keystroke. |
| `web/src/components/steel-batches-page.tsx` | Client `useMemo` filter over loaded rows + debounced URL search | Search routes through the 300ms-debounced route-state hook; date filter is a discrete `<input type="date">` (no debounce needed). |
| `web/src/components/attendance-live-page.tsx` | Status filter is a discrete `<select>`; query key is keyed on `attendanceDate` only | Filters do not stream keystrokes into the network. |
| `web/src/components/steel-reconciliations-page.tsx` | Status / item filters are discrete `<select>` values in the URL | Discrete changes, no per-keystroke work. |
| `web/src/components/ui/combobox.tsx` | In-memory option filtering on `query` | Cheap client filter; blur uses an intentional 120ms timeout for click capture, unrelated to filtering. |
| `FilterBar` select/date fields | Discrete change events | Selects and date inputs fire on commit, not per character. |

### Genuine issues found and fixed

| # | Location | Problem | Fix |
|---|---|---|---|
| 1 | `web/src/components/ocr-history-page.tsx` | `search` state was placed **directly into the React Query `filters` object**, which is part of `queryKeys.ocrVerify.history(filters)`. Every keystroke produced a new query key and fired a new `listOcrVerifications(...)` **backend request**. This is exactly the "excessive API calls" case Requirement 12.8 targets. | Added `useDebouncedValue(search, 300)` and fed the **debounced** value into the query filters. The text input still updates instantly (`searchValue={search}`); only the network request is debounced to once per 300ms pause. |
| 2 | `web/src/components/ui/data-table/data-table-filter-cell.tsx` | The text column filter called `column.setFilterValue(...)` on **every keystroke**, re-running TanStack Table's filtered row model. For large / virtualized tables (the data table virtualizes at >100 rows) this is the "expensive filter operation" case. No throttle. | Introduced local input state (instant typing) plus `useThrottledCallback(..., 150)` that throttles the `setFilterValue` call to at most once per 150ms (leading + trailing). External resets (e.g. "Clear filters") sync back via an "adjust state during render" pattern. Select/date variants are left unchanged (discrete). |

### Reviewed - intentionally not changed

- `web/src/legacy-ui/ocr/ocr-verification-v2-page.tsx` and
  `web/src/legacy-ui/ocr/ocr-verification-page.tsx`: the v2 queue search feeds
  `useOcrVerifyQueueQuery`, but the underlying query fetches the full list once
  and filters **client-side in `select`** (see `use-ocr-verify-queries.ts`), and
  search is written to the URL via `router.replace`. These are legacy pages
  behind the `?workspace=legacy` override; the default OCR experience is the
  governed workspace (`USE_GOVERNED_OCR_WORKSPACE`). No per-keystroke backend
  call occurs, so no change was made to avoid touching legacy/governed-bypassed code.

---

## Changes Made

### New shared primitives

1. `web/src/lib/interaction-timing.ts` - framework-agnostic `debounce()` and
   `throttle()` helpers plus the canonical constants:
   - `SEARCH_DEBOUNCE_MS = 300`
   - `FILTER_THROTTLE_MS = 150`
   Both helpers expose `cancel()` / `flush()`. These are pure and unit-tested.

2. `web/src/hooks/use-interaction-timing.ts` - React bindings:
   - `useDebouncedCallback(fn, 300)` - stable debounced callback, cleans up on unmount.
   - `useThrottledCallback(fn, 150)` - stable throttled callback (leading + trailing), cleans up on unmount.
   - `useDebouncedValue(value, 300)` - debounced value for use as a query-key input.
   Implemented with refs + `setTimeout` to satisfy the repo's React Compiler lint
   rules (no ref reads during render, no setState-in-effect).

### Targeted fixes

3. `web/src/components/ocr-history-page.tsx` - debounce (300ms) the search value
   that feeds the history query key.

4. `web/src/components/ui/data-table/data-table-filter-cell.tsx` - throttle
   (150ms) text column filter updates while keeping the input responsive.

### Tests

5. `web/__tests__/interaction-timing.test.ts` - 8 `node:test` unit tests covering:
   - Default delays equal 300ms / 150ms (Requirement 12.8).
   - Debounce fires once after the last call; resets the window; respects `cancel`.
   - Throttle fires on the leading edge; one trailing call per window with the
     latest value; allows a fresh leading call after the window; `cancel` drops
     the trailing call.

---

## Validation

| Check | Result |
|---|---|
| Search operations use 300ms debounce | PASS - route-state hook (existing) + OCR history (new). Constant `SEARCH_DEBOUNCE_MS = 300`. |
| Filter operations use 150ms throttle | PASS - data-table filter cell (new). Constant `FILTER_THROTTLE_MS = 150`. |
| Interaction is responsive | PASS - inputs use immediate local/visible state; only the network/expensive work is deferred. |
| No excessive API calls | PASS - OCR history now issues one request per typing pause instead of one per keystroke. |
| Tested on multiple search/filter components | PASS - audited OCR history, OCR verify (legacy), steel batches, steel reconciliations, attendance live/review, command palette, combobox, FilterBar, data-table filter cell. |
| No TypeScript errors (changed files) | PASS - `getDiagnostics` clean on all changed files. (Pre-existing unrelated errors remain in `badge.test.tsx`: missing `@testing-library/react` and a stale `danger` badge status - out of scope for Task 34.) |
| Lint (changed files) | PASS - `eslint --max-warnings=0` clean on all changed files. |
| Unit tests | PASS - 8/8 in `web/__tests__/interaction-timing.test.ts`. |

### Commands run

```
# Unit tests (Node built-in test runner, matches existing __tests__ convention)
node --test __tests__/interaction-timing.test.ts
# -> tests 8 | pass 8 | fail 0

# Lint (matches CI quality gate: eslint src --max-warnings=0)
npx eslint src/lib/interaction-timing.ts src/hooks/use-interaction-timing.ts \
  src/components/ui/data-table/data-table-filter-cell.tsx \
  src/components/ocr-history-page.tsx --max-warnings=0
# -> clean
```

---

## Adoption Guidance (for future search/filter surfaces)

- Search that triggers an **API request / query key**: feed the value through
  `useDebouncedValue(value, 300)` (or `useDebouncedCallback`), keep the input
  bound to the raw value so typing stays instant.
- Filter that triggers **expensive client recompute** over many rows: wrap the
  state update in `useThrottledCallback(fn, 150)`.
- **Discrete** controls (select, date, checkbox) and cheap in-memory filtering:
  no debounce/throttle required.

---

## Rollback

`git revert <commit-hash>`. The two component fixes are additive (debounce/throttle
wrappers); reverting restores per-keystroke behavior without breaking functionality.
The new `lib/interaction-timing.ts` and `hooks/use-interaction-timing.ts` are
standalone and safe to leave in place if only the component edits need reverting.
