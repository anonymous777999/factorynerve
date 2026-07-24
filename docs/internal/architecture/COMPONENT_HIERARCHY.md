# Component Hierarchy

## 1. Root & Providers
- `RootLayout` (`web/src/app/layout.tsx`)
    - `AppProviders`
        - `AppShell`
        - `ToastCenter`
        - `FrontendErrorMonitor`
        - ...

## 2. Shells & Layouts
- **AppShell** (Authenticated)
    - `AppHeader`
    - `AppSidebar`
    - `AppMobileMenu`
    - `ContentArea`
- **AuthShell** (Unauthenticated)
    - Login/Register forms
- **WorkstationShell** (High Focus)
    - Specialized sidebars/panels
- **SettingsShell** (Tabbed Config)
    - `SettingsTabNav`

## 3. Shared Primitives (Atoms)
*Found in `web/src/components/ui/` and re-exported via `web/src/shared/primitives/`*
- `Button`, `Badge`, `Card`, `Input`, `Select`, `Textarea`
- `StatusBadge`, `ConfidenceBadge`
- `SafeText`, `Skeleton`
- `GlassPanel`

## 4. Operational Components (Molecules/Organisms)
- **Data Entry:** `Field`, `Combobox`, `PasswordVisibilityToggle`
- **Display:** `DataTable`, `OperationalTable`, `MetricStrip`
- **Containers:** `SectionPanel`, `WorkflowPanel`, `OperationalDrawer`
- **Actions:** `StickyActionBar`, `ActionDock`, `CommandPalette`

## 5. Dashboard Primitives
- `IndustrialFactoryDashboard`
- `KPIBox`
- `SmartInsightsPanel`
- `IndustrialKPITable`

## 6. Workflow Components
- `OCRScanPage` (Specialized workspace)
- `AttendanceReviewPage`
- `SteelCommandCenterPage`

## Data Flow
1.  **Global:** Providers manage Auth, Theme, Density, and Toasts.
2.  **Layout:** Shells manage navigation and structural zones.
3.  **Feature:** Pages use `OperationalTable` and `SectionPanel` to display business data.
4.  **Atomic:** All components consume `Design Tokens` via Tailwind classes.
