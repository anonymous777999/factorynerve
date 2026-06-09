# 06. Form Standards

## 1. Purpose: Rapid, Verified Entry
Forms are the primary ingestion mechanism for daily execution data. They MUST be zero-friction, error-resistant, and optimized for numeric entry.

## 2. Validation Governance

### 2.1 The onBlur Standard
**Rule:** Validate fields as the operator leaves them (`onBlur`). Do NOT wait until final submission to flag a missing required field.
*   **Implementation:** Use `react-hook-form` mode: `onBlur`.

### 2.2 Inline Error Logic
**Rule:** Errors MUST appear immediately below the input field in `var(--critical)` color.
*   **Requirement:** The input border MUST change to `var(--border-danger)`.

### 2.3 Success Confirmation
**Rule:** High-value entries (Production Quantity) SHOULD show a subtle green checkmark or border on valid entry.

## 3. Operational Performance (Keyboard First)

### 3.1 Tab Order
**Rule:** Every form MUST have a logical Tab-index flow from Top-Left to Bottom-Right.
*   **Requirement:** Modals MUST auto-focus the first empty required field on mount.

### 3.2 Action Defaults
**Rule:** The `Enter` key MUST trigger the primary action (Save/Submit).
*   **Requirement:** Submit buttons MUST show a `isBusy` spinner immediately upon press and disable to prevent double-commits.

### 3.3 Numeric Optimization
**Rule:** Use `inputMode="decimal"` for all Quantity/Weight/Currency fields to trigger numeric keyboards on mobile.
*   **Masking:** Use numeric masks (e.g., `10,000.00`) for visual confirmation.

## 4. Continuity Standards

### 4.1 Form Drafts
**Rule:** Any form with more than 5 fields MUST implement the `FormDraft` pattern.
*   **Sync:** Auto-save field values to LocalStorage every 10 seconds.
*   **Audit Ref:** Steel Production Record clears on refresh; this is now BLOCKED.

### 4.2 Leave Confirmation
**Rule:** If a form is "Dirty" (has unsaved edits), the UI MUST warn the user before they navigate away or close the tab.

## 5. Anti-Patterns (Form Entropy)
*   ❌ **Select Search Hunt:** Forcing users to scroll through 100+ items without a search filter.
*   ❌ **Ambiguous Submit:** Buttons labeled "Go" or "Proceed". Use "Save Batch", "Register Punch".
*   ❌ **Vanishing Errors:** Errors that disappear as soon as the user starts typing (unless corrected).
