# Operational Resilience

## 1. Zero-Loss Workflow Continuity
**Law:** No operator MUST ever lose manual entry work due to a crash, refresh, or network failure.
*   **Audit Ref:** The State Ownership Audit found critical data loss risk in OCR spreadsheet edits.
*   **Requirement:** Any form or grid with >5 inputs MUST implement a **Draft System**.
    1.  **Local Draft:** Auto-save to LocalStorage every 10 seconds.
    2.  **Server Draft:** Auto-save to the `Drafts API` every 60 seconds (for cross-device recovery).

## 2. Offline Recovery
**Law:** The UI MUST function in read-only mode during network outages.
*   **Requirement:** Critical data (Active Shift, Pending Dispatches) MUST be cached in IndexedDB or a persistent React Query cache.
*   **Constraint:** On network re-connection, the UI MUST perform a "Silent Re-sync" without forcing a full page reload.

## 3. Sync Failure & Retry UX
**Law:** All failed mutations MUST provide an actionable "Retry" button.
*   **Rule:** Error messages MUST NOT be just error codes. They MUST state:
    1.  What went wrong (in plain language).
    2.  What the impact is (e.g., "Dispatch record not saved").
    3.  How to fix it (e.g., "Retry when network returns").
*   **Audit Ref:** The Interaction Laws Audit identified the need for actionable recovery affordances.

## 4. Workflow Recovery Prompt
**Law:** If an un-submitted draft exists on page mount, the UI MUST show a mandatory recovery prompt:
> "We found an unsaved session from [Timestamp]. Would you like to resume or start fresh?"

## 5. Background Sync Visibility
**Law:** Background operations (e.g., OCR processing, Excel exports) MUST be visible at all times via the `JobsDrawer.tsx`.
*   **Requirement:** The job status MUST persist across page navigations. 
*   **Rule:** The operator MUST NOT be forced to stay on the "Upload" page to wait for a job to complete.

## 6. Stale Data Handling
**Law:** The UI MUST visually signal when displayed data is older than the configured `staleTime`.
*   **Implementation:** Use a subtle "Last updated: [Time]" label or an "Out of Sync" badge for critical ledger data (Inventory).

## 7. Operational Trust UX
**Law:** Destructive actions (Delete, Void, Close Batch) MUST require a **Double-Action** (e.g., Confirmation Modal or Press-and-Hold).
*   **Audit Ref:** Workflow Audit identified high risk in immediate ledger impact from manual mis-entry.
*   **Requirement:** High-value submissions MUST show a "Review Summary" before final commit.
