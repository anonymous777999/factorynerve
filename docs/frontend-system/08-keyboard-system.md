# 08. Keyboard System

## 1. Purpose: Keyboard-First Operations
DPR.ai power users (supervisors, operators) work faster with keys than mice. The system MUST be fully navigable and executable without a mouse.

## 2. Global Shortcut Registry

| Key Combo | Action | Scope |
| :--- | :--- | :--- |
| **`CMD + K`** | **Global Command Bar** | App-wide |
| **`/`** | Focus Search on page | Lists / Hubs |
| **`ESC`** | Close Modal / Cancel Action | App-wide |
| **`CMD + S`** | Force Save Draft | Forms / Review |
| **`[`** / **`]`**| Toggle Workspace Sidebar | App-wide |
| **`N`** | Create New (Entity) | Domain Hubs |
| **`CMD + Enter`**| Submit Primary Action | Modals / Forms |

## 3. Command System Architecture
The Command Bar is the primary workflow accelerator.

### 3.1 Command System Tokens
*   **Surface:** `--command-bg`, `--command-panel-bg`, `--command-border`, `--command-shadow`.
*   **Interaction:** `--command-hover`, `--command-active`, `--command-selected`, `--command-focus-ring`.
*   **Typography:** `--command-font-size`, `--command-shortcut-font`, `--command-group-label`.
*   **Status:** `--command-match-highlight`, `--command-shortcut-muted`, `--command-danger`.

### 3.2 Command Governance Rules
*   **Keyboard-First:** Command interactions MUST remain keyboard-first; mouse is secondary.
*   **Explicit Focus:** Focus visibility MUST remain explicit with high contrast.
*   **Workflow Continuity:** Command overlays MUST preserve the background workflow state.
*   **Determinism:** Command actions MUST be deterministic; no hidden side-effects.
*   **Zero Noise:** Visual noise and non-functional motion are FORBIDDEN inside the command system.

## 4. Interaction Standards

### 4.1 Focus Management
**Rule:** When a Modal/Drawer opens, focus MUST move to the first interactive element.
**Rule:** When a Modal closes, focus MUST return to the previous trigger element.
**Rule:** Active elements MUST have a high-contrast focus ring (`ring-2 ring-[var(--accent)]`).

### 4.2 Data Navigation
**Rule:** operators MUST be able to navigate table cells using **Arrow Keys**.
**Rule:** `Home`/`End` MUST jump to the first/last columns of a row.
**Rule:** `Space` MUST toggle row selection.

## 5. Audit Findings & Fixes
*   **Finding:** OCR spreadsheet grid lacked arrow-key navigation.
*   **Correction:** Implement `useTableKeyboard` hook to manage cell focus management.
*   **Finding:** Dashboard charts were not focusable.
*   **Correction:** Wrap data visualizations in a focusable container with `ARIA` summary labels.
