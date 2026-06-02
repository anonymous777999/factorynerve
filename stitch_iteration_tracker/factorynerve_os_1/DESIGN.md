---
name: FactoryNerve OS
colors:
  surface: '#111318'
  surface-dim: '#111318'
  surface-bright: '#37393f'
  surface-container-lowest: '#0c0e13'
  surface-container-low: '#1a1b21'
  surface-container: '#1e2025'
  surface-container-high: '#282a2f'
  surface-container-highest: '#33353a'
  on-surface: '#e2e2e9'
  on-surface-variant: '#d9c3ae'
  inverse-surface: '#e2e2e9'
  inverse-on-surface: '#2e3036'
  outline: '#a18d7b'
  outline-variant: '#534435'
  surface-tint: '#ffb868'
  primary: '#ffb868'
  on-primary: '#482900'
  primary-container: '#e08c0f'
  on-primary-container: '#502e00'
  inverse-primary: '#885200'
  secondary: '#b1c5ff'
  on-secondary: '#002c71'
  secondary-container: '#0459d3'
  on-secondary-container: '#d1dcff'
  tertiary: '#62df7d'
  on-tertiary: '#003914'
  tertiary-container: '#33b559'
  on-tertiary-container: '#003f17'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffddbb'
  primary-fixed-dim: '#ffb868'
  on-primary-fixed: '#2b1700'
  on-primary-fixed-variant: '#673d00'
  secondary-fixed: '#dae2ff'
  secondary-fixed-dim: '#b1c5ff'
  on-secondary-fixed: '#001946'
  on-secondary-fixed-variant: '#00419f'
  tertiary-fixed: '#7ffc97'
  tertiary-fixed-dim: '#62df7d'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005320'
  background: '#111318'
  on-background: '#e2e2e9'
  surface-variant: '#33353a'
  surface-ground: '#0a0b0d'
  surface-canvas: '#111318'
  surface-primary: '#161a21'
  surface-elevated: '#1c2029'
  surface-raised: '#212633'
  surface-overlay: '#252b36'
  border-default: '#333b48'
  border-subtle: '#252b36'
  border-strong: '#4a5568'
  text-primary: '#f1f5f9'
  text-secondary: '#cbd5e1'
  text-muted: '#64748b'
  status-critical: '#dc2626'
  status-caution: '#ea580c'
typography:
  display-4xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.15'
    letterSpacing: -0.026em
  page-title:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.25'
    letterSpacing: -0.018em
  panel-title:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.40'
    letterSpacing: -0.010em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.50'
    letterSpacing: -0.006em
  table-cell:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.50'
    letterSpacing: 0em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.45'
    letterSpacing: 0.004em
  metadata-xs:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1.45'
    letterSpacing: 0.05em
  page-title-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.25'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  micro: 4px
  xs: 8px
  sm: 12px
  base: 16px
  md: 20px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-desktop: 32px
  margin-mobile: 16px
---

## Brand & Style

The design system follows a **Dark Industrial** aesthetic, engineered for high-stakes manufacturing environments. It prioritizes "Industrial Muscle Memory"—where the UI behaves like a predictable, precision instrument. The personality is technical, authoritative, and AI-augmented, blending the rugged reliability of a factory control room with the sophisticated clarity of modern data science.

The visual style is **Corporate / Modern** with a high-density, utility-first approach. It utilizes a strict hierarchy where "Operational" elements are highlighted in Amber to signify human intervention and system-critical actions, while "AI" features are anchored in Blue to denote automated insights and processing. This clear semantic split ensures operators can distinguish between machine logic and human responsibility at a glance.

**Key Brand Pillars:**
- **Operational Integrity:** High-contrast signaling and deterministic layouts.
- **Precision Density:** Optimized for expert users managing complex data streams.
- **AI-Native Trust:** Distinct visual treatment for AI-generated content to ensure "Human-in-the-loop" accountability.

## Colors

The system is fundamentally **dark-first**, designed to reduce eye strain in low-light factory environments. 

### Core Palette
- **Primary (Amber #e08c0f):** Reserved for operational actions, primary CTAs, and manufacturing alerts.
- **Secondary (Blue #2f6ee8):** Dedicated to AI Copilot features, information signals, and system processing.
- **Neutral:** A 13-step scale of deep slates and grays that define the layering of the "Industrial Shell."

### Tiered Border Strategy
- **Strong Borders:** Use `neutral.400` (#64748b) or `neutral.500` (#4a5568) for primary authentication containers and high-priority hubs to create clear structural boundaries.
- **Default Borders:** Use `neutral.600` (#333b48) for standard dividers and card outlines.
- **Subtle Borders:** Use `neutral.700` (#252b36) for supporting sections like "Guardrails" or secondary metadata panels to reduce visual noise.

## Typography

Typography is optimized for **data scanning** and transactional integrity. 

- **Inter (Sans-Serif):** The workhorse for all UI controls, body text, and headings. It provides the necessary clarity for high-density layouts.
- **JetBrains Mono (Monospace):** Used strictly for numeric data, IDs, timestamps, and status labels. The monospaced nature ensures that columns of numbers align perfectly for rapid ocular comparison.

**Key Rule:** All table headers and technical labels must use `metadata-xs` with the `JetBrains Mono` font and a 0.05em letter spacing to evoke the "instrument panel" aesthetic.

## Layout & Spacing

This design system uses a strict **4px Grid System** to maintain vertical rhythm, particularly critical for authentication screens and dense data tables.

### Layout Philosophy
- **Fixed-Fluid Hybrid:** Sidebars and AI panels use fixed widths (`sidebar: 220px`, `ai-panel: 360px`), while the primary workspace canvas is fluid.
- **Auth Vertical Rhythm:** In auth screens, use `spacing-xl` (32px) for gaps between the header and the primary container, and `spacing-sm` (12px) for gaps between label-input pairs.
- **Grid Gaps:** Standard UI grids should utilize a 16px (`spacing-base`) gutter to ensure touch targets remain accessible while maintaining density.

### Breakpoints
- **Mobile (<640px):** 16px margins, single-column reflow, bottom navigation active.
- **Desktop (>1024px):** 32px margins, multi-column grid, fixed sidebar enabled.

## Elevation & Depth

Hierarchy is achieved primarily through **Tonal Layering** rather than heavy shadows, ensuring clarity in high-density environments.

- **Ground Layer (#0a0b0d):** Used for the deepest underlays and modal backdrops.
- **Canvas Layer (#111318):** The default application background.
- **Surface Tiering:** Elements rise in elevation by shifting toward lighter slate tones (e.g., `#1c2029` for cards).
- **Ambient Shadows:** Only used for floating panels and modals. Shadows must be high-opacity and "tight" (e.g., `0px 8px 24px rgba(0,0,0,0.5)`) to feel grounded on the dark canvas.
- **Glow Effects:** AI-processing states use a subtle Blue outer glow (`0px 0px 8px rgba(47, 110, 232, 0.3)`) to indicate active background logic.

## Shapes

The shape language is **Soft (0.25rem base)**, reinforcing the "precision tool" feel. Sharp edges are avoided to prevent the UI from feeling aggressive, but large radii are rejected to maintain professional density.

- **Standard (4px):** Buttons, inputs, and small badges.
- **Container (6px):** Standard cards and primary containers.
- **Panel (10px):** Modals and high-level layout panels.
- **AI Radius (16px):** AI-specific components use a more generous curve to visually distinguish "soft" intelligence from "hard" operational controls.

## Components

### Premium Operational Header
The header for DPR.ai / Factory Access must be the most stable element in the UI. 
- **Structure:** 48px height, `surface-primary` background, `border-strong` bottom stroke.
- **Typography:** The product name uses `panel-title`, while the organization context (e.g., "Steel Industry") uses `metadata-xs` in `text-muted`.

### OAuth Sections (High-Trust)
OAuth buttons (Google, Microsoft, Facebook) must feel production-ready and integrated.
- **Default State:** 1px `border-default` with a slight `surface-raised` background.
- **Disabled State:** Use `text-muted` and `border-subtle`. Instead of hiding them, use a "SOON" badge (Pill-shaped, `metadata-xs`, `surface-overlay`) to maintain layout stability and signal upcoming features.
- **Trust Indicators:** Include a subtle lock icon and "Securely Connected" micro-copy in `metadata-xs`.

### Primary Auth Container
- **Border:** 2px `border-strong` to anchor the user's attention.
- **Padding:** `p-8` (32px) to provide focus space.
- **Shadow:** `shadow-xl` to separate the auth flow from the canvas during setup.

### Guardrails (Support Section)
- **Border:** 1px `border-subtle` to indicate it is secondary information.
- **Background:** `surface-ground` (deeper than the canvas) to create a "inset" look.
- **Content:** Use `table-cell` font size for instructional text to maintain density.

### Buttons & Inputs
- **Primary Operational:** Amber background, black text for maximum contrast.
- **Inputs:** `surface-raised` background with a 1px `border-default`. Focus state uses a 2px Amber ring with a 1px offset.