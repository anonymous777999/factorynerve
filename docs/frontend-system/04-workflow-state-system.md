# 04. Workflow State System

## 1. The Zero-Loss Continuity Standard
**Law:** No operator shall lose progress due to a browser refresh, network drop, or accidental navigation. **State MUST survive the transition.**

## 2. State Ownership decision Tree

| Question | Answer | Canonical Storage |
| :--- | :--- | :--- |
| **"Where am I?"** | Route / Identity | **URL Pathname** |
| **"What am I seeing?"** | Filter / Tab / Step | **URL Query Params** |
| **"What is the data?"** | Entity Record | **React Query Cache** |
| **"I am typing right now"** | Form Progress | **LocalStorage + Draft API**|
| **"How do I like the UI?"** | Preference | **LocalStorage** |

## 3. Storage Purpose Hierarchy

1.  **URL (Canonical):** The only source of truth for workflow identity. If it's not in the URL, it doesn't exist to the browser.
2.  **React Query Cache:** The source of truth for server data.
3.  **LocalStorage:** For persistence across sessions and offline recovery.
4.  **sessionStorage (BANNED):** Forbidden for canonical data. Only used for crash-recovery markers.

## 4. Continuity Rules

### 4.1 URL-Owned Step Wizards
**Rule:** Every step in a multi-step workflow (e.g., `/ocr/verify`) MUST be reflected in the URL.
*   **Requirement:** Users MUST be able to use the "Back" button to return to the previous step.

### 4.2 The "Cold Start" Requirement
**Rule:** Every operational route MUST be functional from a cold start (direct URL paste into a new tab).
*   **Audit Ref:** Route Audit identified that `/ocr/verify` required state from `/ocr/scan`. 
*   **Correction:** Move scanning results to a persistent backend Draft ID immediately after upload.

### 4.3 Background Sync Visibility
**Rule:** Background jobs (Excel exports, AI processing) MUST be visible at all times regardless of current route.
*   **Implementation:** Centralized `JobsDrawer.tsx` consuming a global polling hook.

## 5. Anti-Patterns (Workflow State)
*   ❌ **Invisible IDs:** Storing the `activeEntityId` in a React context instead of the URL.
*   ❌ **Flickering Hydration:** Rendering an empty list while data is fetching from a deep link. Use `LoadingBoundary`.
*   ❌ **Hidden Navigation:** Modals that change significant content without updating the URL (Wizard modals).
