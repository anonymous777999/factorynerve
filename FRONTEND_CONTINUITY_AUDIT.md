# DPR.ai Frontend Route-Architecture & Application Continuity Audit

## PHASE 1 — ROUTE MAP

| ROUTE | FILE |
| :--- | :--- |
| `/` | `web/src/app/page.tsx` |
| `/login` | `web/src/app/login/page.tsx` |
| `/access` | `web/src/app/access/page.tsx` |
| `/dashboard` | `web/src/app/dashboard/page.tsx` |
| `/ocr` | `web/src/app/ocr/page.tsx` |
| `/ocr/scan` | `web/src/app/ocr/scan/page.tsx` |
| `/ocr/verify` | `web/src/app/ocr/verify/page.tsx` |
| `/billing` | `web/src/app/billing/page.tsx` |
| `/plans` | `web/src/app/plans/page.tsx` |
| `/settings` | `web/src/app/settings/page.tsx` |
| `/steel` | `web/src/app/steel/page.tsx` |
| Root Layout | `web/src/app/layout.tsx` |
| App Providers | `web/src/components/app-providers.tsx` |
| App Shell | `web/src/components/app-shell.tsx` |
| Auth Guard | `web/src/components/auth-guard.tsx` |

## PHASE 3 — FINDINGS

[🔴 CRITICAL] CONTINUITY | `web/src/components/ocr-scan-page.tsx:L314` | Step-based workflow (upload -> processing -> result) is managed entirely in local state without URL synchronization | Refreshing the page resets the visual step to "entry" unless restored from heavy `sessionStorage` blobs; URL remains static `/ocr/scan`.
[🔴 CRITICAL] CONTINUITY | `web/src/lib/api.ts:L347` | `bootstrapCsrfCookie` triggers an implicit `/health` GET on first non-safe request if token is missing | Causes race conditions during concurrent early-app initialization requests (e.g., fetching session and notifications simultaneously).
[🔴 CRITICAL] CONTINUITY | `web/src/lib/session-store.ts:L81` | `hydrateSessionFromStorage` performs synchronous hydration from `sessionStorage` before verifying with backend | Risk of stale "flash of old state" where a user sees another user's (or a previous session's) organization/factory data for up to 8 seconds.
[🟡 MEDIUM] CONTINUITY | `web/src/components/app-shell.tsx:L1578` | `handleLogout` uses `window.location.href = "/access"` for forced reload | Sudden application state destruction and hard reload prevents smooth transition to login screen.
[🟡 MEDIUM] CONTINUITY | `web/src/components/ocr-verification-page.tsx:L857` | `mobileWorkspaceOpen` state is local and not mirrored in URL | Mobile users lose their active review context if they switch apps or if the browser kills the tab background.
[🟡 MEDIUM] CONTINUITY | `web/src/lib/ocr-ui-state.ts:L419` | `saveOcrUiState` serializes large base64 image strings into `sessionStorage` | Can cause frame drops and performance lag during high-frequency UI updates; risks exceeding storage limits.
[🔵 LOW] CONTINUITY | `web/src/lib/auth.ts:L220` | Redundant `getMe()` call after successful login response | Unnecessary network overhead of ~200-400ms on a critical path.
[🔵 LOW] CONTINUITY | `web/src/components/ocr-scan-page.tsx:L689` | Camera capture is a modal-like overlay instead of a sub-route | Cannot deep-link directly into capture mode or handle browser "back" button to cancel capture safely.

## PHASE 4 — WORKFLOW BREAK MAP

| WORKFLOW | BREAKPOINT | FILE:LINE | WHY STATE BREAKS |
| :--- | :--- | :--- | :--- |
| `subscription → billing` | `Link` navigate | `web/src/components/plans-page.tsx:L220` | Relies on transient query params. If the user navigates away to check a feature and returns to `/billing`, the plan selection is lost. |
| `auth → org switching` | Context Update | `web/src/lib/session-store.ts:L49` | Syncs to `sessionStorage` but does not trigger a cross-tab synchronization; other open tabs will hold stale `activeFactoryId`. |
| `route refreshes` | `useEffect` Hydration | `web/src/components/ocr-scan-page.tsx:L361` | URL remains `/ocr/scan` while `sessionStorage` holds "step: result". The URL does not represent the application state. |
| `OCR verification` | Workspace Reset | `web/src/components/ocr-verification-page.tsx:L930` | Clears local state but does not navigate "back" to a list view via the router, leading to disconnected URL/state. |

## PHASE 5 — TRUE ROUTE OWNERSHIP REPORT

| PAGE | ROUTE OWNER | HYDRATION SOURCE | RATING |
| :--- | :--- | :--- | :--- |
| `OCR Scan` | Local State | `sessionStorage` | 🔴 FRAGMENTED |
| `OCR Verification` | URL (`verification_id`) | Backend API | 🟡 PARTIAL |
| `Billing` | URL / Backend | Backend API | 🔵 STABLE |
| `Plans` | Backend | Backend API | 🔵 STABLE |
| `Dashboard` | Backend | Backend API | 🔵 STABLE |
| `Steel Workflow` | Local State | `sessionStorage` (shared) | 🔴 FRAGMENTED |

### Forensic Summary
DPR.ai behaves more like a **Multi-SPA** (Single Page Application) than a cohesive routing-driven platform. The **OCR Scan** and **Steel** workflows are essentially "black box" screens where the URL is a placeholder and the real application state is hidden in `sessionStorage` and local state hooks. This creates a "popup-like" feeling because the browser's navigation tools (back, forward, refresh, share) are largely decoupled from the actual workflow progress.
