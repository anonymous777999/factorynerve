# 01. Screen Taxonomy

## 1. Purpose
This document defines the canonical screen types for the DPR.ai platform. Every route MUST map to one of these types to ensure architectural consistency and predictable operator mental models.

## 2. Canonical Screen Types

### 2.1 Dashboard (Priority-First)
*   **Purpose:** The daily entry point for specific roles. Aggregates alerts, pending work, and live status.
*   **Interaction:** "What do I do right now?"
*   **Layout:** Standard `AppShell`.
*   **Constraint:** No deep data tables. Only summaries and high-level signals.
*   **Example:** `/dashboard`, `/premium/dashboard`.

### 2.2 Hub (Domain Index)
*   **Purpose:** Search, filter, and navigate to entities within a domain.
*   **Interaction:** "Where is this record?"
*   **Layout:** Standard `AppShell` + Filter Bar.
*   **Constraint:** Primary action MUST be navigation or creation.
*   **Example:** `/steel`, `/ocr/history`, `/reports`.

### 2.3 Detail (Entity Trace)
*   **Purpose:** 360-degree view of a single entity. Historical audit and state changes.
*   **Interaction:** "Tell me everything about this Batch."
*   **Layout:** Immersive or Tabbed Detail View within `AppShell`.
*   **Constraint:** MUST be deep-linkable via ID in pathname.
*   **Example:** `/steel/batches/[id]`, `/profile`.

### 2.4 Entry (Data Capture)
*   **Purpose:** High-speed, focused data entry.
*   **Interaction:** "Commit these records as fast as possible."
*   **Layout:** `Focus` mode layout (Sidebar closed/hidden).
*   **Constraint:** Minimal navigation. Maximum vertical space.
*   **Example:** `/entry`, `/steel/production/record`.

### 2.5 Scanner (Document Capture)
*   **Purpose:** Mobile-first camera digitized capture.
*   **Interaction:** "Capture, crop, enhance."
*   **Layout:** `Camera` mode layout (Full-screen canvas).
*   **Constraint:** Specialized hardware-native controls.
*   **Example:** `/ocr/scan`.

### 2.6 Review Workspace (Trust Engine)
*   **Purpose:** Verification and correction of risky or extracted data.
*   **Interaction:** "Correct and Approve."
*   **Layout:** Spreadsheet-style or Split-Pane review within `Focus` mode.
*   **Constraint:** MUST own its state in the URL (Draft ID).
*   **Example:** `/ocr/verify`, `/attendance/review`.

## 3. Screen Type Matrix

| Screen Type | Primary Action | Shell Mode | Mobile UI |
| :--- | :--- | :--- | :--- |
| **Dashboard** | Decision | Standard | Top Bar + Bottom Nav |
| **Hub** | Navigation | Standard | Top Bar + Bottom Nav |
| **Detail** | Audit | Standard | Top Bar + Action Tray |
| **Entry** | Capture | Focus | Full Screen + Back Button |
| **Scanner** | Digitize | Camera | Immersive Canvas |
| **Review** | Verify | Focus | Top Bar + Action Footer |

## 4. Hierarchy Rules
1.  **Engine -> Hub -> Detail:** Navigation flows from broad engine indexes to specific entity traces.
2.  **No Dead Ends:** Every Detail screen MUST provide a clear path back to its parent Hub or Dashboard.
3.  **Role-Aware Visibility:** Screens visible to a user MUST be filtered at the AppShell/Middleware level based on the Role-Based Product View defined in the system blueprint.
