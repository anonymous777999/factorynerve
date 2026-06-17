# Frontend Audit: FactoryNerve (DPR.ai)

## Overview
FactoryNerve is a React-based ERP/workflow application built with Next.js and TypeScript. It utilizes a highly structured design system driven by TailwindCSS and semantic CSS variables (Design Tokens). The UI is optimized for high data density and operational efficiency in industrial environments.

## Core Tech Stack
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** TailwindCSS + CSS Modules (globals.css, tokens.css)
- **State Management:** React Query (implied by components)
- **UI Architecture:** Component-driven (Atoms, Molecules, Organisms)
- **Design Pattern:** Design Token System for visual consistency across themes and densities.

## Key Directories
- `web/src/app`: Root layouts, routing, and global providers.
- `web/src/components/ui`: Atomic UI primitives (Button, Card, Badge, etc.).
- `web/src/components/dashboard`: Specialized dashboard widgets and layouts.
- `web/src/shared/layouts`: High-level layout wrappers (AppShell, AuthShell, SettingsShell).
- `web/src/shared/primitives`: Reusable system components re-exported for feature-level usage.
- `web/src/styles`: Design token definitions (`tokens.css`) and global overrides.

## Architectural Patterns
### 1. Design Token Foundation
The visual language is strictly controlled via `tokens.css`. Components do not use hardcoded colors or spacing; they reference semantic tokens (e.g., `bg-surface-app`, `text-primary`).

### 2. Shell/Layout Architecture
The application uses multiple "Shells" to define the operational context:
- `AppShell`: Main authenticated workspace with sidebar and header.
- `AuthShell`: Clean layout for login/onboarding.
- `WorkstationShell`: Specialized high-focus layout for operational tasks.
- `SettingsShell`: Tabbed navigation layout for configuration pages.

### 3. Density System
A unique feature that allows the entire UI to switch between `default`, `compact`, and `comfortable` modes via a `data-density` attribute on the root element. This affects row heights, spacing, and font sizes globally.

### 4. Operational Data Tables
Heavy use of TanStack Table wrapped in an `OperationalTable` component that supports density, virtualization, and sticky headers/columns.

## Observations
- **Consistency:** High. The design system is strictly applied through Tailwind semantic classes.
- **Responsiveness:** Managed via Tailwind's responsive utilities and dedicated mobile components (e.g., `AppMobileMenu`).
- **Extensibility:** The primitive/molecule structure allows for rapid creation of new operational workspaces.
