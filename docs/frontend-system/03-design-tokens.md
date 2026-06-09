# 03. Design Tokens

## 1. Governance: The Semantic Lock
**Law:** Components MUST NOT use raw color hex codes or arbitrary pixel spacing. All styling MUST reference CSS variables defined in `web/src/styles/tokens.css`.

## 2. Semantic Color Palette
Color is a **signal**, not a decoration.

| Variable | Semantic Meaning | Usage Example |
| :--- | :--- | :--- |
| `var(--bg)` | Outermost App Background | `html` background |
| `var(--card)` | Elevated Data Surface | Dashboard widgets, Table rows |
| `var(--accent)`| Primary Action / Focus | Buttons, Tabs, Focus rings |
| `var(--success)`| Complete / Verified | Approved OCR, Healthy Sync |
| `var(--warning)`| Attention Required | Low confidence cells, Drafts |
| `var(--critical)`| Blocked / Error | Failed dispatches, Sync loss |
| `var(--muted)` | Passive / Decorative | Placeholder text, secondary labels |

## 3. Density & Spacing
DPR.ai uses a **High-Density 4px Grid**.

*   **Base Unit:** 4px.
*   **Scale:** `var(--space-1)` (4px) to `var(--space-24)` (96px).
*   **Operational Sizing:** Standard button height is 34px; Compact is 28px.

## 4. Typography
Optimized for **Data Scanning**.

*   **Font Stack:** "Inter" (Sans) for UI; "JetBrains Mono" for numeric data and IDs.
*   **Scale:**
    *   `var(--text-md)` (14px): Primary body and form labels.
    *   `var(--text-base)` (13px): Operational default for table cells.
    *   `var(--text-sm)` (12px): Secondary metadata.
*   **Weights:** 400 (Regular), 500 (Medium), 600 (Semibold).

## 5. Z-Index Layering
Named layers prevent rendering collisions.

| Layer | Value | Purpose |
| :--- | :--- | :--- |
| `var(--z-base)` | 0 | Default flow |
| `var(--z-raised)` | 10 | Sticky Headers |
| `var(--z-overlay)` | 40 | Drawers |
| `var(--z-modal)` | 50 | Dialogs |
| `var(--z-command)` | 60 | CMD+K Bar |

## 6. Command System Tokens
Specific tokens for the keyboard-first command interface.

*   **Surface:** `--command-bg`, `--command-panel-bg`.
*   **Interaction:** `--command-hover`, `--command-selected`.
*   **Typography:** `--command-font-size`, `--command-shortcut-font`.

## 7. Audit Regression Fixes
*   **Finding:** Inconsistent Green/Red for Attendance.
*   **Correction:** Use `var(--status-success-fg)` and `var(--status-danger-fg)` exclusively.
*   **Finding:** Hardcoded hex values in AI-generated charts.
*   **Correction:** Map Chart Series colors to the token palette in the chart configuration.
