# Folder Architecture

## 1. Domain Ownership
**Law:** All business logic MUST be co-located within its primary domain directory. Cross-domain logic sprawl is BLOCKED.

### 1.1 Canonical Root Structure
```text
web/src/
  ├─ app/             # ROUTES (Layouts, Pages, Error boundaries)
  ├─ components/      # UI IMPLEMENTATION
  │   ├─ ui/          # Tier 1: Primitives (Stateless)
  │   ├─ shared/      # Tier 2: Layout Patterns
  │   └─ [domain]/    # Tier 3: Domain Components (OCR, Steel, HR)
  ├─ hooks/           # DATA ACCESS (useQuery/useMutation)
  ├─ lib/             # INFRASTRUCTURE (api, auth, utils)
  ├─ locales/         # CONTENT (json translation files)
  └─ types/           # CONTRACTS (Shared TS interfaces)
```

## 2. Shared vs Feature Separation
**Law:** The root `hooks/` and `lib/` directories MUST contain only infrastructure or multi-domain logic.
*   **Domain Hooks:** MUST be named `use-[domain]-[action].ts` (e.g., `use-ocr-verify.ts`).
*   **Feature UI:** Components inside `components/[domain]` MUST NOT be imported by other domains.

## 3. Provider Placement
**Law:** Global Providers MUST reside in `components/app-providers.tsx`. Domain-specific context MUST reside in `components/[domain]/[domain]-provider.tsx`.
*   **Requirement:** Any new global provider REQUIRES architectural approval to prevent re-render cascades.

## 4. Routing Boundaries
**Law:** `web/src/app/` MUST contain only route definitions. UI implementation in `app/` is FORBIDDEN.
*   **Pattern:** `app/[route]/page.tsx` MUST simply import and render a "Page Component" from `components/[domain]/[domain]-page.tsx`.

## 5. Cross-Domain Import Rules
**Law:** The following import directions are strictly enforced:
1.  **ALLOWED:** `Domain Component` -> `Shared UI` (`@/components/ui/button`)
2.  **ALLOWED:** `Domain Hook` -> `Infrastructure` (`@/lib/api`)
3.  **FORBIDDEN:** `Domain Component A` -> `Domain Component B`
4.  **FORBIDDEN:** `Infrastructure` -> `Domain Component`
5.  **BLOCKED:** Relative imports (`../../`) across domain boundaries. Absolute `@/*` imports are REQUIRED.

## 6. Co-location Rules
**Law:** If a type or helper utility is used by ONLY ONE domain, it MUST be moved from `lib/` or `types/` into that domain's folder.
*   **Audit Ref:** Domain Audit found that `lib/i18n.tsx` contained domain-specific translation strings. These MUST be moved to `@/locales/`.
