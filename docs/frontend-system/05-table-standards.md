# 05. Table Standards

## 1. Purpose: Operational Intelligence Surface
Tables in DPR.ai are not lists; they are workspaces. They must handle high volume, remain performant, and support rapid data comparison.

## 2. Technical Laws

### 2.1 The Virtualization Threshold
**Law:** Any table or grid expected to render more than **100 rows** MUST use `@tanstack/react-virtual`.
*   **Audit Ref:** Performance Audit found 5,000+ DOM nodes in OCR grids causing main-thread locking.

### 2.2 Standard Layout Requirements
Every table MUST implement:
*   **Sticky Header:** `position: sticky top-0 z-10` for `<thead>`.
*   **Sticky First Column:** Primary identity (Batch ID, Name) MUST stay visible during horizontal scroll.
*   **ResponsiveScrollArea:** Use the `ResponsiveScrollArea.tsx` wrapper to handle overflow.

## 3. High-Density Interactions

### 3.1 Sorting & Filtering
*   **URL Bound:** Active sort column and filter state MUST be reflected in query params.
*   **Persistent Indicators:** Sorting MUST be visually permanent (arrow up/down), not just on hover.
*   **Debounced Search:** Global search input MUST be debounced to 300ms.

### 3.2 Cell Alignment Standards
| Data Type | Alignment | Rationale |
| :--- | :--- | :--- |
| **Primary Identity** | Left | Scan readability |
| **Quantity (KG/Units)**| Right | Numeric comparison |
| **Currency (INR)** | Right | Financial alignment |
| **Status Badge** | Center | visual balance |
| **Actions** | Right | Standard end-of-row placement |

## 4. Density Modes (Exact Pixels)

| Mode | Row Height | Font Size | Cell Padding (X/Y) |
| :--- | :--- | :--- | :--- |
| **Compact** | 28px | 12px | 8px / 4px |
| **Default** | 36px | 13px | 12px / 8px |
| **Comfortable** | 48px | 14px | 16px / 12px |

## 5. Audit Findings & Fixes
*   **Finding:** Steel Dispatch table lacked sticky behavior.
*   **Correction:** Wrap the table in a fixed-height container with `overflow-auto` and sticky-thead.
*   **Finding:** Inconsistent sort metaphors between Steel and OCR.
*   **Correction:** Standardize on TanStack Table API for all new grid implementations.
