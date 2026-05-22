# 07. Layout Rules

## 1. Architectural Hierarchy
DPR.ai uses a **Container-Based Layout** strategy.

1.  **AppShell:** The global container owning the Navigation Rail, Workspace Rail, and Header.
2.  **Page Container:** Standardized 32px margins for desktop; 16px for mobile.
3.  **Grid/Section:** Multi-column layout with standard 16px gaps (`gap-4`).
4.  **Card/Surface:** The atomic unit of data display with `p-4` or `p-5` padding.

## 2. Global Shell Modes

### 2.1 Standard Mode
*   **Usage:** Dashboards, Hubs, Lists.
*   **UI:** Sidebar Open, Header visible, standard margins.
*   **Focus:** Discoverability and Navigation.

### 2.2 Focus Mode
*   **Usage:** Entry Screens, Review Workspace.
*   **UI:** Sidebar Closed/Hidden, Header minimal.
*   **Focus:** Zero-distraction task execution.

### 2.3 Camera Mode (Mobile)
*   **Usage:** OCR Capture.
*   **UI:** Full-screen immersive canvas. 0px margins. No AppShell controls visible.
*   **Focus:** Hardware-native performance.

## 3. Responsive Column Standards

| Viewport | Page Margin | Column Count (Grid) | Sidebars |
| :--- | :--- | :--- | :--- |
| **Mobile (<640px)** | 16px | 1 | Hidden (Bottom Nav) |
| **Tablet (640-1024px)** | 24px | 2 | Hidden (Drawer) |
| **Desktop (1024-1280px)** | 32px | 3-4 | Sidebar Fixed |
| **Wide (>1280px)** | 32px | 4-6 | Sidebar + Context Rail |

## 4. Padding & Spacing Standards
*   **Section Separation:** `gap-8` (32px).
*   **Card Internal:** `p-5` (20px).
*   **Inline Controls:** `gap-3` (12px).

## 5. Domain Boundary Protection
**Law:** Layout primitives MUST NOT import domain logic. 
*   **Finding:** `AppShell` was directly importing `listSteelReconciliations`.
*   **Correction:** Use a `BadgeRegistry` context or a standardized `useNavBadges` hook that decouples the shell from the API.

## 6. Anti-Patterns (Layout)
*   ❌ **Custom Margin Overrides:** Individual components setting their own outer margins (breaking the Grid).
*   ❌ **Z-Index War:** Manually setting `z-[999]` for overlays. Use the naming system in `03-design-tokens.md`.
*   ❌ **Non-Fluid Tables:** Tables that break the layout on mobile instead of using `ResponsiveScrollArea`.
