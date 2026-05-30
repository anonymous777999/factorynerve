# Visual Doctrine

## Core Identity

DPR.ai is **modern AI-native operational software** for industrial manufacturing. The visual system must communicate:
- **Calm intelligence** - Not aggressive or overwhelming
- **Operational trust** - Reliable, professional, precise
- **Premium quality** - Thoughtful, refined, elegant
- **AI-native** - Forward-looking, intelligent, assistive

## Reference Products

Our visual language should feel closer to:

### ✅ Primary References
- **Linear** - Clean, breathable, sentence case, single accent
- **Arc Browser** - Modern, calm, intelligent surfaces
- **Stripe Dashboard** - Professional, trustworthy, operational
- **Attio** - Elegant data density, refined interactions
- **Notion** - Calm hierarchy, readable typography
- **Vercel** - Modern developer UX, clean surfaces
- **Perplexity** - AI-native, intelligent, calm

### ❌ Anti-References (What We Are NOT)
- SOC dashboards - Too aggressive, cyberpunk
- SIEM systems - Too dark, hacker aesthetic
- Bootstrap admin panels - Generic, dated
- Old enterprise software - Heavy, rigid, cluttered
- Cyberpunk UI - Neon, glow effects, excessive gradients
- Terminal aesthetics - Monospace overuse, green-on-black

## Visual Principles

### 1. Calm Over Aggressive
- Use subtle surface differentiation, not heavy borders
- Prefer single accent color, not multiple competing colors
- Use sentence case, not UPPERCASE EVERYWHERE
- Employ generous whitespace, not cramped density

### 2. Operational Over Decorative
- Every visual element serves a functional purpose
- No decorative gradients or glow effects
- Motion is functional (state changes), not decorative
- Shadows signal elevation/layer, not decoration

### 3. Modern Over Legacy
- Contemporary typography (Inter, not IBM Plex Sans)
- Clean surfaces (solid colors, not gradient layers)
- Refined spacing (40-44px rows, not 34px)
- Modern color palette (indigo #6366f1, not warm orange #c56d2d)

### 4. Intelligent Over Generic
- AI indicators are subtle and confident
- Intelligence is assistive, not intrusive
- Confidence levels are clear but not alarming
- Processing states are calm, not anxious

## Typography Doctrine

### Font Family
- **Primary**: Inter (modern, operational, readable)
- **Monospace**: JetBrains Mono (code, IDs, technical data only)
- **Display**: Inter (no separate display font needed)

### Case Rules
- **Sentence case** for all UI labels, buttons, headings
- **lowercase** for technical identifiers, code
- **UPPERCASE** FORBIDDEN except for:
  - Acronyms (OCR, API, ID)
  - Technical constants in code
  - Keyboard shortcuts (CMD, CTRL)

### Size Scale (Operational)
- **10px** - Micro labels, badge text
- **11px** - Table metadata, timestamps
- **12px** - Secondary labels, helper text
- **13px** - Table cell text (operational default)
- **14px** - Primary body, form labels
- **16px** - Panel headings
- **18px** - Page titles
- **22px** - Modal titles
- **28px** - KPI numbers

## Color Doctrine

### Accent Color
- **Primary**: Indigo #6366f1 (modern, trustworthy, operational)
- **Usage**: Primary actions, links, focus states, active states
- **Rule**: ONE accent color only, no secondary accents

### Forbidden Colors
- ❌ Warm orange #c56d2d (dated, cyberpunk)
- ❌ Amber #ffb868 (too warm, old industrial)
- ❌ Multiple accent colors (confusing, cluttered)
- ❌ Neon colors (cyberpunk, aggressive)

### Surface System
- Use **surface differentiation** (different background shades)
- NOT **border differentiation** (heavy borders everywhere)
- Hierarchy: app-bg < shell < panel < card < elevated < overlay
- Each level must be visually distinguishable

### Status Colors
- **Success**: Green #22c55e (operational complete)
- **Warning**: Amber #f59e0b (caution, attention)
- **Danger**: Red #ef4444 (error, critical)
- **Processing**: Indigo #4338ca (AI in-progress)
- **Paused**: Slate #64748b (hold, queued)

## Surface Doctrine

### Background Layers
- **Solid colors only** - No gradient backgrounds
- **Subtle differentiation** - 2-3% lightness steps
- **Functional elevation** - Shadows signal layer, not decoration

### Forbidden Patterns
- ❌ Radial gradients on backgrounds
- ❌ Multiple gradient layers
- ❌ Glow effects
- ❌ Colored radial gradients (cyberpunk)
- ❌ Heavy borders everywhere

### Card/Panel Design
- **Border**: 1px solid, subtle color
- **Background**: Solid color, slightly elevated from parent
- **Shadow**: Subtle, functional (xs or sm)
- **Radius**: 6-8px (modern, not too rounded)

## Spacing Doctrine

### Density
- **Default row height**: 40px (modern, breathable)
- **Compact row height**: 36px (dense tables)
- **Comfortable row height**: 48px (review mode)
- **NOT**: 34px (too cramped, dated)

### Padding
- **Card padding**: 20-24px (generous, modern)
- **Cell padding**: 10-12px horizontal, 8-10px vertical
- **Section gaps**: 24-32px (breathable)

## Motion Doctrine

### Functional Motion Only
- **State changes**: 80-120ms (hover, focus)
- **Panel expand/collapse**: 150ms max
- **NO**: Page transitions, decorative animations, spring physics

### Forbidden Motion
- ❌ Decorative animations
- ❌ Page transitions
- ❌ Parallax effects
- ❌ Floating/drifting elements
- ❌ Pulsing/glowing effects

## Dark Mode Doctrine

### Approach
- **Modern dark** - Clean, professional
- **NOT cyberpunk** - No colored radial gradients
- **Subtle surfaces** - 2-3% differentiation
- **Readable text** - #EDF2F7 primary, #94A3B8 secondary

### Forbidden in Dark Mode
- ❌ Colored radial gradients (warm orange, teal)
- ❌ Glow effects
- ❌ Neon accents
- ❌ Cyberpunk aesthetics

## Implementation Rules

### Before Making Visual Changes
1. Read this doctrine
2. Check anti-patterns.md
3. Verify against reference products
4. Ensure changes align with "calm, intelligent, operational"

### When Uncertain
- Default to Linear/Stripe visual language
- Choose calm over aggressive
- Choose modern over legacy
- Choose functional over decorative

### Validation Questions
- Does this feel like Linear or like a SOC dashboard?
- Is this calm and intelligent or aggressive and cyberpunk?
- Would this fit in Stripe Dashboard or Bootstrap admin?
- Is this modern operational software or old enterprise?
