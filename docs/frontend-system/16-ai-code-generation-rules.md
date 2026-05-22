# AI Code Generation Rules

## 1. AI Forbidden Patterns
**Law:** AI tools (Gemini, Codex, etc.) are strictly FORBIDDEN from generating the following:
1.  **Manual `sessionStorage`:** Use React Query + Draft ID.
2.  **Relative Path Chaos:** Use `@/*` absolute imports.
3.  **Ad-hoc Fetching:** Use `apiFetch` and `useQuery`.
4.  **Inline CSS:** Use Tailwind classes only.
5.  **Global Logic in Shell:** Adding domain-specific logic to `AppShell.tsx` is BLOCKED.

## 2. Mandatory Prompt Context
**Law:** Every AI generation prompt MUST include the following files as context to prevent pattern drift:
*   `docs/frontend-system/10-react-query-governance.md`
*   `docs/frontend-system/11-folder-architecture.md`
*   `lib/api.ts` (Network standard)
*   `lib/query-keys.ts` (Key factory standard)

## 3. Banned Implementation Patterns
**Law:** The following patterns found in AI-generated drifts are strictly BLOCKED:
*   **Double Caching:** Creating a local `Map` to cache API responses.
*   **Hallucinated Redirects:** Adding `router.push` in components that should be handled by `middleware.ts`.
*   **Type Invention:** Creating local `interface` definitions for data already typed in `types/`.

## 4. Query Governance Enforcement
**Law:** AI MUST use the `queryKeys` factory.
*   **Verification:** Any AI output containing an array key (e.g., `['batches']`) is a FAIL. It must use `queryKeys.steel.root()`.

## 5. Component Generation Boundaries
**Law:** AI MUST be told which **Component Tier** (1-4) it is generating.
*   **Tier 1 (Primitive):** Must be stateless, Tailwind-only.
*   **Tier 4 (Page):** Must contain logic only for URL params and hook orchestration.

## 6. AI Review Requirements
**Law:** All AI-generated code MUST pass a 3-point human review gate:
1.  **Pattern Check:** Does it follow the established hooks/utils or re-invent them?
2.  **Boundary Check:** Does it import across forbidden domain boundaries?
3.  **Artifact Scrub:** Remove all AI instructions, "AUDIT" comments, and unused imports.

## 7. AI-Safe Implementation Contracts
**Law:** When asking AI to implement a new feature, the Human MUST provide the **Domain Boundary** and **State Ownership** decision first. 
*   **Forbidden:** "How should I store this data?" 
*   **Required:** "Store this data in React Query. Here is the key factory."
