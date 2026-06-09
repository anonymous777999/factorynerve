# Performance Governance

## 1. Virtualization Law
**Law:** Any data-driven list or table expected to render more than **100 rows** MUST use `@tanstack/react-virtual`.
*   **Audit Ref:** The Performance Audit found severe main-thread locking in non-virtualized OCR grids. 
*   **Enforcement:** PRs introducing new manual loops over large datasets are BLOCKED.

## 2. Re-render Prevention
**Law:** Component state MUST be localized to the smallest possible branch of the tree.
*   **Rule:** Lifting state to a parent component strictly for "convenience" is FORBIDDEN.
*   **Constraint:** Form inputs MUST use localized state or `react-hook-form` to prevent full-page re-renders during typing.

## 3. Polling Budgets
**Law:** Background polling MUST NOT exceed the following aggregate budgets:
*   **High Priority (OCR Processing):** Max 1 query every 2 seconds.
*   **Medium Priority (Alerts/Badges):** Max 1 query every 20 seconds.
*   **Rule:** If a tab is inactive for >60 seconds, all polling MUST pause.

## 4. Animation Restrictions
**Law:** High-CPU animations (e.g., complex SVG morphing, heavy blur transitions) are FORBIDDEN on mobile routes.
*   **Requirement:** Animations MUST use `will-change: transform` or `opacity` and must be capped at 60fps.

## 5. Mobile CPU Governance
**Law:** Heavy client-side data processing (e.g., sorting 5,000 ledger rows) MUST be moved to the backend or a Web Worker.
*   **Audit Ref:** The Performance Audit identified OCR table editing as "sluggish" on mobile. 

## 6. Memoization Rules
**Law:** `useMemo` and `useCallback` MUST NOT be used for simple primitive values or trivial calculations.
*   **Audit Ref:** `AppShell` was found to contain 50+ unnecessary memoization hooks.
*   **Rule:** Only memoize when:
    1.  Passing an object/function to a memoized child component.
    2.  Performing an expensive loop (>100 iterations).

## 7. Render Budgets
**Law:** The initial JS bundle for any route MUST NOT exceed **250KB** (gzipped).
*   **Constraint:** Heavy libraries (e.g., `pdfjs`, `apexcharts`) MUST be dynamically imported using `next/dynamic`.
*   **Audit Ref:** `pdfjs` was found in the critical path of the initial bundle. This is now BLOCKED.
