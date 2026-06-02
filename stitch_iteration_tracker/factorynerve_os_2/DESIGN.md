---
name: FactoryNerve OS
colors:
  surface: '#0f131d'
  surface-dim: '#0f131d'
  surface-bright: '#353944'
  surface-container-lowest: '#0a0e17'
  surface-container-low: '#171c25'
  surface-container: '#1b2029'
  surface-container-high: '#262a34'
  surface-container-highest: '#31353f'
  on-surface: '#dfe2f0'
  on-surface-variant: '#c3c6d7'
  inverse-surface: '#dfe2f0'
  inverse-on-surface: '#2c303b'
  outline: '#8d90a0'
  outline-variant: '#434655'
  surface-tint: '#b4c5ff'
  primary: '#b4c5ff'
  on-primary: '#002a78'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#0053db'
  secondary: '#5de6ff'
  on-secondary: '#00363e'
  secondary-container: '#00cbe6'
  on-secondary-container: '#00515d'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#007d55'
  on-tertiary-container: '#bdffdb'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#a2eeff'
  secondary-fixed-dim: '#2fd9f4'
  on-secondary-fixed: '#001f25'
  on-secondary-fixed-variant: '#004e5a'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0f131d'
  on-background: '#dfe2f0'
  surface-variant: '#31353f'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.01em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 12px
  margin: 16px
  panel-padding: 12px
---

## Brand & Style

The design system is engineered for high-stakes industrial environments where information density and rapid cognitive processing are paramount. It adopts an **Ultra-Dark Workstation** aesthetic, prioritizing reduced eye strain during long shifts and maximum contrast for critical data points.

The personality is clinical, authoritative, and precise. It draws from **Minimalism** and **Corporate Modern** movements but executes them with the raw efficiency of a financial terminal. Every pixel is leveraged for utility, favoring a "data-first" hierarchy where chrome and ornamentation are stripped back to their essential structural forms. The goal is to evoke a sense of total operational control and unwavering reliability.

## Colors

The palette is anchored by a deep obsidian base (`#070b14`), creating a void-like canvas that allows high-chroma signals to pop without causing visual fatigue. 

- **Primary Action (Blue-600):** Used exclusively for intentional user interactions and primary calls to action.
- **Active State (Cyan-400):** Reserved for indicating focus, selection, and "live" processes.
- **Semantic Signals:** Emerald-500, Amber-500, and Rose-500 are used strictly for status reporting (Nominal, Warning, Critical).
- **Surface Ramps:** A sophisticated ramp of Slate neutrals (Slate-800 to Slate-950) defines the spatial architecture, using subtle value shifts rather than borders to separate panels.

## Typography

This design system utilizes a dual-type strategy to balance readability with technical precision. 

- **Inter** handles all proportional UI text, providing a neutral and highly legible foundation for navigation and labels. 
- **JetBrains Mono** is the workhorse for all telemetry, industrial metrics, and tabular data. Its fixed-width nature ensures that fluctuating numbers do not cause layout jitter and columns remain perfectly aligned for vertical scanning.

Typography remains compact. For desktop-native density, we avoid large display sizes, capping headlines at 24px to preserve vertical real estate for operational data.

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid** model optimized for ultra-wide workstation monitors. It utilizes a strict 4px baseline grid.

- **Persistent Sidebar:** A 240px fixed-width left navigation ensures immediate access to top-level modules.
- **Command Shell:** The main workspace is divided into multi-panel layouts (Bento-style or tiled) that stretch to fill the screen. 
- **Density:** We use an aggressive high-density rhythm. Padding within components is kept to a minimum (8px - 12px) to maximize "at-a-glance" data visibility. 
- **Operational Tables:** Tables use a "Condensed" mode by default, with 4px vertical cell padding and 12px horizontal padding.

## Elevation & Depth

In an ultra-dark environment, shadows are ineffective. Instead, this design system uses **Tonal Layering** and **Low-Contrast Outlines**.

- **Level 0 (Background):** `#070b14` - The deepest layer.
- **Level 1 (Panels):** `#0f172a` (Slate-900) - Used for primary workspace tiles.
- **Level 2 (Popovers/Modals):** `#1e293b` (Slate-800) - Used for elements that temporarily overlay the workspace.
- **Outlines:** All containers use a subtle 1px border (`Slate-800`) to define edges. Active or "Focused" panels use a `Cyan-400` 1px border to indicate the current command context.

## Shapes

The shape language is **Soft (0.25rem)**. While sharp corners (0px) can feel overly aggressive, a 4px radius provides just enough modern refinement while maintaining a rigid, "engineered" structure that aligns perfectly with the 4px grid.

- **Standard Elements:** 4px (Buttons, Inputs, Cards).
- **Control Indicators:** 2px (Small toggle pips, radio inner circles).
- **Data Tags:** 2px (Status badges, micro-labels).

## Components

### Buttons
Buttons are strictly functional. 
- **Primary:** Solid Blue-600 with white text. 
- **Secondary/Ghost:** Slate-800 background with a 1px Slate-700 border. 
- **Critical:** Solid Rose-500 for destructive actions (e.g., E-Stop, Delete).

### Operational Tables
The core of the OS. Features must include:
- Zebra-striping (10% opacity white) on hover.
- Sticky headers with a Slate-800 background.
- Monospaced numeric columns right-aligned for comparative scanning.

### Input Fields
Inputs are recessed. Use a background of `#020617` (deeper than panels) with a Slate-700 border. On focus, the border transitions to Cyan-400 with a subtle outer glow.

### Status Chips
Minimalist capsules. No background fill by default—only a 1px colored border and a matching dot indicator to maintain a high signal-to-noise ratio.

### Multi-Panel Shell
A component that allows users to "Split" a view into halves or quadrants. Each panel has a header bar containing the module title in `label-caps` and a set of utility icons (Refresh, Expand, Close).