---
name: DPR Operational Interface
colors:
  surface: '#121416'
  surface-dim: '#121416'
  surface-bright: '#38393c'
  surface-container-lowest: '#0c0e10'
  surface-container-low: '#1a1c1e'
  surface-container: '#1e2022'
  surface-container-high: '#282a2c'
  surface-container-highest: '#333537'
  on-surface: '#e2e2e5'
  on-surface-variant: '#c3c5d7'
  inverse-surface: '#e2e2e5'
  inverse-on-surface: '#2f3133'
  outline: '#8d90a0'
  outline-variant: '#434655'
  surface-tint: '#b5c4ff'
  primary: '#b5c4ff'
  on-primary: '#00287c'
  primary-container: '#2a5ee6'
  on-primary-container: '#e6e9ff'
  inverse-primary: '#1652da'
  secondary: '#b7c8e1'
  on-secondary: '#213145'
  secondary-container: '#3a4a5f'
  on-secondary-container: '#a9bad3'
  tertiary: '#ffb597'
  on-tertiary: '#591d00'
  tertiary-container: '#b74400'
  on-tertiary-container: '#ffe5db'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b5c4ff'
  on-primary-fixed: '#00164e'
  on-primary-fixed-variant: '#003bae'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb597'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7e2c00'
  background: '#121416'
  on-background: '#e2e2e5'
  surface-variant: '#333537'
typography:
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.02em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.05em
spacing:
  unit: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  gutter: 1px
---

## Brand & Style
The design system is engineered for mission-critical industrial operations where cognitive load management is paramount. The brand personality is clinical, precise, and stoic. It targets professional operators and data scientists who require high-density information environments without the fatigue of decorative UI.

The style is **Industrial Minimalism**. It rejects depth metaphors, shadows, and gradients in favor of a flat, architectural approach. Visual hierarchy is established through structural alignment and purposeful value shifts. The interface should feel like a piece of high-precision hardware—reliable, utilitarian, and secondary to the data it presents.

## Colors
The palette is monochromatic and restrained to ensure that operational status indicators remain highly salient. 

- **Primary Backgrounds:** Use `neutral_color_hex` for the base canvas.
- **Surface Tiering:** Use `surface_container` to differentiate functional zones. 
- **Accents:** The primary blue is used strictly for interactive focus and primary actions. 
- **Status Semantic:** Success, warning, and error colors are desaturated by 10% from standard web values to prevent "vibration" against the dark background, ensuring they are readable but not distracting during normal operations.
- **Borders:** All containment is handled by 1px borders using `border_muted`.

## Typography
This design system utilizes a dual-font strategy. **Hanken Grotesk** provides a clean, contemporary sans-serif for UI labels and headings, ensuring legibility at small sizes. **JetBrains Mono** is utilized for all telemetry, data points, timestamps, and input values, providing the rhythmic consistency required for scanning columns of numbers.

Typography is compact. We prioritize information density over whitespace. Large "hero" typography is forbidden; the largest heading size is capped to maintain the industrial density of the workstation.

## Layout & Spacing
The layout is governed by a rigid **8px spacing rhythm** and a 1px border-grid. 

### Grid Philosophy
- **Fixed-Fluid Hybrid:** The interface uses a multi-pane workstation layout. 
- **The Navigation Rail:** A narrow (64px) fixed left rail for global switches.
- **The Operational Lane:** The primary central workspace, fluid width.
- **The Telemetry Lane:** A fixed-width (320px) right-hand panel for real-time monitoring.

### Containment
Avoid margins between functional blocks. Instead, use "border-sharing" where 1px borders touch, creating a seamless, technical grid. Internal padding within blocks should be `8px` or `12px` to maximize data density.

## Elevation & Depth
This design system is strictly **Flat**. 
- **No Shadows:** Depth is never indicated by drop shadows.
- **Tonal Tiers:** Elevation is communicated through background value shifts. A "raised" element (like a header or active tab) uses a slightly lighter hex code than the canvas.
- **Active States:** Indicated by a high-contrast 2px accent border-left or a subtle change in background value (e.g., from `#16191C` to `#24282D`).
- **Overlays:** Modals and tooltips use the same `surface_container` background but are defined by a high-contrast border (`#475569`) to separate them from the background.

## Shapes
In line with the industrial aesthetic, all UI elements utilize **Sharp (0px)** corners. This reinforces the "production-grade" feel and ensures that elements tile perfectly within the 1px grid system. Buttons, input fields, and panel containers must adhere to this zero-radius rule.

## Components

### Buttons & Controls
- **Operational Buttons:** Small (28px height), flat, with 1px borders. Use `label-caps` for text.
- **Toggle Groups:** Segmented buttons with 0px gap, using a primary blue background for the active state.
- **Keyboard Shortcuts:** Ghost labels (e.g., `[ CMD+K ]`) should be visible within components to reinforce keyboard-first usage.

### Data Display
- **Density Tables:** No row padding beyond 4px. Use zebra-striping with a 2% value shift. 
- **Telemetry Tiles:** Compact modules with a `label-caps` header and a large `data-mono` value. Sparklines should be 1px weight, monochromatic blue.

### Inputs
- **Terminal Inputs:** Single-line inputs with no background, only a bottom 1px border. The cursor should be a solid block or high-visibility pipe.
- **Command Palette:** A centered, high-density search interface that appears as an overlay, focused on speed and filterable results.

### Lists
- **Scan-friendly lists:** Grouped by category with sticky headers. Each item should have a fixed height to ensure predictable scrolling.