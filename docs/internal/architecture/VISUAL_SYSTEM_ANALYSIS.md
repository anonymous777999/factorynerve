# Visual System Analysis

## Design Token System (Source: `tokens.css`)
FactoryNerve uses a tiered token system:
1.  **Primitive Palette:** Raw HSL values for neutrals and brand colors.
2.  **Semantic Tokens:** Meaning-mapped references (e.g., `text-primary`, `surface-app`).
3.  **Density System:** Spacing and sizing multipliers.

### Color Palette (Light/Dark Support)
The system supports full Dark Mode via `data-theme="dark"` attribute.
- **Surface Hierarchy:** `app-bg` < `shell` < `panel` < `card` < `elevated` < `overlay`.
- **Status Colors:** Standardized tokens for `success`, `warning`, `danger`, `processing`, `paused`, `inactive`, and `draft`.
- **AI Processing:** Dedicated Indigo-based tokens for AI-driven surfaces.

### Typography
- **Primary Font:** IBM Plex Sans (Inter fallback).
- **Monospace Font:** IBM Plex Mono (for numerics and code).
- **Scale:** Optimized for operational readability (Base: 13px/14px).
- **Tabular Numerics:** All numbers use `tabular-nums` by default for alignment in tables.

### Spacing & Density
The system uses a 4px base unit.
- **Default:** Standard factory terminal density (40px rows).
- **Compact:** Maximum density for power users (28px rows).
- **Comfortable:** Review mode/KPI dashboards (48px rows).

### Border Radius & Elevation
- **Restrained Rounding:** 3px to 8px range. Not a "bubbly" consumer aesthetic.
- **Functional Elevation:** Shadows are used to signal layer detachment (e.g., Modals, Drawers) rather than for decoration.

### Animation & Motion
- **ERP-Focused:** Motion is functional, not decorative.
- **Snappy Transitions:** Max duration is 150ms.
- **Feedback-Driven:** Used for state changes, loading indicators, and focus shifts.

## Visual DNA
The visual language is **"Industrial Modern"**. It is clean, high-contrast, and prioritizes data clarity over artistic expression. The use of "Glass" effects for overlays and "Glow" for active status states gives it a premium feel without sacrificing utility.
