# FRONTEND ARCHITECTURE: DPR.ai / FactoryNerve

## 1. Executive Summary
The DPR.ai frontend architecture is built as an **Industrial Operating System**. It prioritizes **operational speed**, **data density**, and **transactional integrity** over consumer-grade aesthetics. The system is designed to be "Dark-First," keyboard-navigable, and resilient to network instability, ensuring that factory operators never lose progress.

---

## 2. Design System Overview: FactoryNerve OS
*   **Philosophy:** "Industrial Muscle Memory." The UI behaves like a predictable machine.
*   **Primary Theme:** Dark Mode (Optimized for factory environments and low-light operations).
*   **Core Framework:** Next.js (TypeScript) + Tailwind CSS.
*   **State Management:** React Query (Server), URL (Workflow), LocalStorage (Drafts).
*   **Density:** High-Density 4px Grid System.

---

## 3. Layout Architecture
The platform uses a **Container-Based Layout** strategy with strict shell modes.

### 3.1 Global Shell Modes
*   **Standard Mode:** Sidebars open, fixed header. Used for Dashboards and Hubs.
*   **Focus Mode:** Sidebars hidden, minimal header. Used for high-speed data entry (OCR Review, Production Record).
*   **Camera Mode (Mobile):** Full-screen immersive canvas for document capture.

### 3.2 Canonical Screen Taxonomy
1.  **Dashboard:** Priority-first entry point. "What do I do right now?"
2.  **Hub:** Domain index (Search/Filter). "Where is this record?"
3.  **Detail:** 360-degree entity view. "Tell me everything about this Batch."
4.  **Entry:** High-speed data capture. Focus mode enabled.
5.  **Review Workspace:** Trust engine for AI verification. Spreadsheet-style logic.

---

## 4. Spacing Rules
DPR.ai operates on a **4px Base Unit**.

*   **Page Margins:** Desktop: 32px (`p-8`); Mobile: 16px (`p-4`).
*   **Section Gaps:** `gap-8` (32px) for major layout sections.
*   **Card Padding:** `p-5` (20px) default; `p-4` (16px) for compact widgets.
*   **Grid Gaps:** `gap-4` (16px) for standard UI grids.
*   **Inline Spacing:** `gap-3` (12px) for control groups; `gap-1.5` (6px) for label-input pairs.

---

## 5. Typography Rules
Optimized for **Data Scanning** and high-speed reading.

### 5.1 Font Stacks
*   **Primary (UI):** `Inter` (Sans-serif).
*   **Data (Numeric):** `JetBrains Mono` (Monospaced for IDs, Weights, and Currency).

### 5.2 Type Scale
| Role | Size (px) | Weight | Token |
| :--- | :--- | :--- | :--- |
| **Page Title** | 24px | 600 | `text-page-title` |
| **Panel Title** | 18px | 600 | `text-panel-title` |
| **Primary Body** | 14px | 400 | `text-md` / `text-body` |
| **Table Cell** | 13px | 400 | `text-base` / `text-table-cell` |
| **Metadata/Label**| 12px | 500 | `text-sm` / `text-label` |
| **Small Label** | 11px | 600 | `text-2xs` |

---

## 6. Component Standards
Components are governed by a **4-Tier Hierarchy**.

*   **Tier 1: Primitives (`components/ui/`):** Stateless, Tailwind-only components (Button, Input, Badge).
*   **Tier 2: Shared Patterns (`components/shared/`):** Context-aware layout wrappers (AppShell, Card, ResponsiveScrollArea).
*   **Tier 3: Domain Components (`components/[domain]/`):** Business logic components (SteelTable, OcrVerificationGrid).
*   **Tier 4: Page Components (`app/`):** Composition roots that orchestrate URL state and global hooks.

### 6.1 Table Standards (The Workspace)
*   **Virtualization:** Required for >100 rows (`@tanstack/react-virtual`).
*   **Sticky behavior:** Headers and First Columns MUST be sticky.
*   **Alignment:** Identity (Left), Numeric (Right), Status (Center).

### 6.2 Form Standards
*   **Validation:** Trigger on `onBlur`.
*   **Continuity:** Draft system (LocalStorage) required for >5 fields.
*   **Controls:** Numeric inputs MUST use `inputMode="decimal"`.

---

## 7. Token System
All styles MUST reference semantic tokens defined in `web/tailwind.config.ts`.

### 7.1 Semantic Colors
*   **Surface:** `surface-app` (base), `surface-panel` (elevated), `surface-card` (interactive).
*   **Action:** `action-primary` (Amber), `action-secondary` (Neutral), `action-destructive` (Red).
*   **Status:** `status-success` (Green), `status-warning` (Amber), `status-danger` (Red), `status-processing` (Blue).
*   **AI:** `workflow-ai-processing` (Blue glow), `workflow-ai-bg` (Faint blue).

---

## 8. Visual Hierarchy Rules
*   **Primary Surface:** `var(--surface-app)` (The dark canvas).
*   **Elevation:** achieved via `border-subtle` and slight background shifts (`--surface-panel`), not heavy shadows.
*   **Operational Emphasis:** `var(--action-primary)` (Amber) is reserved for the current primary task action.
*   **Focus Patterns:** `ring-2 ring-border-focus` for all keyboard interactions.

---

## 9. Interaction Rules
*   **100ms Feedback Law:** Every interaction must produce a visual response (active state, spinner, shimmer) within 100ms.
*   **Destructive Confirmation:** Double-action required for Delete/Void (Modal confirm).
*   **Zero-Click Access:** Full Tab-key support for all forms and navigation.
*   **Human-in-the-Loop:** AI data MUST remain in a `Pending` state until human approval.

---

## 10. Responsive Rules
| Breakpoint | Margin | Columns | Sidebar Behavior |
| :--- | :--- | :--- | :--- |
| **Mobile (<640px)** | 16px | 1 | Bottom Nav Only |
| **Tablet (<1024px)** | 24px | 2 | Drawer (Hidden by default) |
| **Desktop (<1280px)** | 32px | 3-4 | Fixed Sidebar |
| **Wide (>1280px)** | 32px | 6+ | Fixed Sidebar + Context Rail |

---

## 11. Operational UX Patterns
*   **The Draft System:** Auto-save form state to LocalStorage every 10s.
*   **The Jobs Drawer:** Global visibility for background tasks (exports, AI processing).
*   **Confidence Tiering:** Visual indicators for AI confidence levels (Red/Yellow/Green cells).
*   **URL-as-State:** All filters, tabs, and wizard steps MUST be deep-linkable via query params.

### 11.1 Review & Verification Patterns
*   **Before/After Comparison:** AI-extracted data vs. Human-verified data MUST be shown in a split-pane or side-by-side comparison.
*   **Confidence Badging:** Cells with low AI confidence MUST use `var(--status-warning-bg)` or `var(--status-danger-bg)`.
*   **Evidence Affordance:** Every AI field should allow clicking to see the source artifact (e.g., image crop).

### 11.2 Data Visualization Patterns
*   **KPI Strips:** 4-column grid of `ProfessionalCard` widgets at the top of dashboards.
*   **Status Distribution:** High-level summary of "Processed vs Pending" at the top of Hub screens.
*   **Bulk Actions Bar:** Fixed bar appearing when rows are selected in a table, providing context-aware actions.

---

## 12. Existing Consistency Problems
*   **Legacy Components:** Older pages in `/frontend` use hardcoded hex values instead of `var(--tokens)`.
*   **AppShell Bloat:** The global shell currently imports too much domain-specific logic (e.g., direct Steel API calls).
*   **Inconsistent Modals:** Some wizard modals do not update the URL, breaking the "Back" button.
*   **Mobile Padding:** Several Hub screens lack the mandatory 16px safe-area margins.

---

## 13. Recommended Standardization Areas
1.  **Token Migration:** Replace all remaining `text-[#hex]` and `bg-[#hex]` with semantic Tailwind classes.
2.  **Table Refactoring:** Standardize all grids on the `TanStack Table` + `Virtualization` pattern.
3.  **AppShell Decoupling:** Move domain badges (counts) to a central `useNavBadges` hook.
4.  **Error Handling:** Unify the "Retry" pattern for all failed mutations using a shared `ApiErrorBoundary`.

---

## 14. Reusable Primitive Inventory
*   `Button`: Multi-mode (Primary, Secondary, Ghost) with `isBusy` state.
*   `Badge`: Status-mapped colors (success, danger, draft).
*   `AppShell`: Global responsive layout with Navigation Rail.
*   `ResponsiveScrollArea`: Horizontal table scrolling wrapper.
*   `LoadingBoundary`: Skeleton shimmer orchestration.
*   `FormDraft`: Automated LocalStorage persistence for inputs.

---

## 15. Architectural Constraints
*   **BANNED:** Absolute positioning for layout (use Grid/Flex).
*   **BANNED:** Inline styles or `!important` overrides.
*   **BANNED:** Manual `sessionStorage` for workflow state.
*   **FORBIDDEN:** Direct imports across domain boundaries (e.g., `OCR` component importing from `Steel` hooks).
*   **LIMIT:** Prop drilling capped at **3 levels** (use Context or React Query for deeper state).
