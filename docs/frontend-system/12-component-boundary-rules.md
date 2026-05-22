# Component Boundary Rules

## 1. Component Tier Governance
**Law:** Every component MUST belong to a tier. Tiers dictate ownership and capability.

| Tier | Capability | Data Ownership | Location |
| :--- | :--- | :--- | :--- |
| **1: Primitive** | Stateless UI | Props only | `components/ui/` |
| **2: Shared Pattern**| Context-aware UI | Context (i18n, Theme) | `components/shared/` |
| **3: Domain Component**| Feature logic | Local state + Domain hooks | `components/[domain]/` |
| **4: Page Component** | Composition root | URL state + Global hooks | `app/` (via redirect) |

## 2. Shared Component Rules
**Law:** Tier 1 and 2 components MUST NOT import from any business domain (`ocr/`, `steel/`, etc.).
*   **Requirement:** If a shared component needs business data, it MUST receive it via pure props.
*   **Audit Ref:** `AppShell` was found to be a Tier 2 component importing directly from Steel and OCR domains. This is now BLOCKED.

## 3. Domain Component Rules
**Law:** Domain components MUST NOT import from other domains.
*   **Requirement:** Cross-domain interaction MUST be handled by the **Page Component** (Tier 4) through composition.
*   **Violation:** `SteelDispatchesPage` importing OCR-specific table formatting is FORBIDDEN.

## 4. Layout Primitive Ownership
**Law:** Layout rules (margins, gaps, responsive grids) MUST be owned by Tier 2 components.
*   **Requirement:** Domain components MUST NOT define their own outer page margins. They MUST fill the container provided by the layout.

## 5. Forbidden Coupling (Dependency Hierarchy)
**Law:** Circular dependencies are strictly FORBIDDEN.
*   **Hierarchy:** `Page` -> `Domain Component` -> `Shared Pattern` -> `Primitive`.
*   **Rule:** A component MUST NOT import another component from a higher tier.
*   **Constraint:** Prop drilling beyond **3 levels** is BLOCKED. If state is needed deeper, move to a domain-specific Context or React Query.

## 6. Component Splitting Triggers
**Law:** A component MUST be split if it meets any of the following:
1.  **Line Count:** Exceeds 400 lines (Audit Ref: `app-shell.tsx`).
2.  **State Soup:** Manages more than 10 `useState` hooks (Audit Ref: `steel-dispatches-page.tsx`).
3.  **Mixed Concerns:** Performs data fetching AND complex manual layout.
4.  **Prop Bloat:** Accepts more than 12 props.
