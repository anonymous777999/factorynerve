# Accessibility Governance

## 1. Keyboard Navigation Law
**Law:** All primary operational workflows MUST be executable using only a keyboard.
*   **Requirement:** Every interactive element MUST have a visible `:focus-visible` state using the `ring-2 ring-[var(--accent)]` pattern.
*   **Audit Ref:** Dashboard charts were found to be non-keyboard-focusable. This is now BLOCKED.

## 2. Focus Persistence & Trap
**Law:** Modals and Drawers MUST implement a focus trap.
*   **Requirement:** On open, focus MUST move to the first interactive element. On close, focus MUST return to the previous trigger element.
*   **Constraint:** Use the `Dialog` primitive from `@/components/ui/dialog` (or equivalent accessible base) to ensure correct behavior.

## 3. Screen Reader Standards
**Law:** Meaningful images and icons MUST have descriptive `alt` or `aria-label` tags.
*   **Rule:** Purely decorative icons MUST use `aria-hidden="true"`.
*   **Status Badges:** Status indicators MUST include text labels or specific ARIA descriptions (e.g., "Status: Pending Approval") rather than relying on color alone.

## 4. ARIA Governance
**Law:** Ad-hoc ARIA attributes are FORBIDDEN unless no native HTML element or UI primitive suffices.
*   **Requirement:** Use native `<button>`, `<input>`, and `<label>` whenever possible.
*   **Tables:** Tables MUST use `<thead>`, `<tbody>`, and `<th>` tags correctly to ensure accessibility for high-density data.

## 5. Contrast & Motion Rules
**Law:** The interface MUST maintain a minimum contrast ratio of **4.5:1** for all text labels.
*   **Audit Ref:** The Design Tokens Audit found inconsistent "Muted" text usage. 
*   **Rule:** Text using `var(--muted)` MUST NOT be used for critical operational data (e.g., Qty, Status).
*   **Motion:** All non-essential animations MUST respect the `prefers-reduced-motion` media query.

## 6. Input Accessibility
**Law:** Every input MUST have an associated `<label>` element. Placeholder text is FORBIDDEN as a replacement for labels.
*   **Requirement:** Error messages MUST be associated with their inputs using `aria-describedby`.
