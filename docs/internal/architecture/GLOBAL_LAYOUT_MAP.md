# Global Layout Map

## 1. AppShell (The Main Interface)
**Files:** `web/src/components/app-shell.tsx`, `web/src/components/app-sidebar.tsx`, `web/src/components/app-header.tsx`
- **Structure:** Sticky header, persistent collapsible sidebar on the left, and a main content area.
- **Purpose:** Primary navigation and workspace for authenticated users.

## 2. AuthShell (Authentication & Onboarding)
**Files:** `web/src/components/auth-shell.tsx`
- **Structure:** Centered card-based layout with a focus on branding and clean input fields.
- **Purpose:** Login, Registration, Password Reset, and Email Verification.

## 3. WorkstationShell (Task-Focused Workspace)
**Files:** `web/src/components/ui/workstation-shell.tsx`
- **Structure:** High-density, multi-panel layout often used for data-heavy tasks like OCR verification or production recording.
- **Purpose:** Minimizes distractions and maximizes screen real estate for specific operational workflows.

## 4. SettingsShell (Application Configuration)
**Files:** `web/src/components/settings-shell.tsx`, `web/src/components/settings-tab-nav.tsx`
- **Structure:** Vertically tabbed navigation within a main panel.
- **Purpose:** User profile, factory settings, users management, and billing.

## 5. Dashboard Layouts
**Files:** `web/src/components/dashboard/industrial-factory-dashboard.tsx`
- **Structure:** Grid-based layout of KPI boxes and charts.
- **Purpose:** High-level overview of factory metrics and system status.

## 6. Page Shells & Wrappers
- `OperationalPageShell`: Standard wrapper for pages that need a header and consistent padding.
- `QueueWorkspaceLayout`: Specialized for list/detail views.
- `SectionPanel`: Used within pages to group related fields or tables.
