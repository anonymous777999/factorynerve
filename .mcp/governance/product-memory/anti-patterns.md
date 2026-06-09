# Anti-Patterns

This document catalogs **forbidden patterns** that violate DPR.ai's visual doctrine and emotional direction.

## Typography Anti-Patterns

### ❌ UPPERCASE EVERYWHERE
**Problem**: Aggressive, hard to read, dated enterprise feel
**Example**: "REVIEW PENDING APPROVALS", "STEEL BATCHES", "FACTORY SETTINGS"
**Fix**: Use sentence case - "Review pending approvals", "Steel batches", "Factory settings"

### ❌ Monospace for UI Text
**Problem**: Makes UI feel like a terminal, not modern software
**Example**: Using JetBrains Mono for labels, buttons, headings
**Fix**: Use Inter for all UI text; reserve monospace for code, IDs, technical data

### ❌ Excessive Letter Spacing
**Problem**: Makes text hard to read, feels dated
**Example**: `letter-spacing: 0.18em` on body text
**Fix**: Use normal letter spacing (0) for body; 0.03-0.06em only for uppercase labels

### ❌ Tiny Body Text
**Problem**: Hard to read, feels cramped
**Example**: 11px or 12px body text
**Fix**: Use 14px for body text, 13px for table cells

### ❌ Multiple Font Families
**Problem**: Inconsistent, cluttered visual hierarchy
**Example**: IBM Plex Sans + Space Grotesk + JetBrains Mono all in UI
**Fix**: Inter for UI, JetBrains Mono only for code/technical

## Color Anti-Patterns

### ❌ Multiple Accent Colors
**Problem**: Confusing, cluttered, no clear hierarchy
**Example**: Orange #c56d2d + Teal #1f8a78 + Blue #3b82f6 all as accents
**Fix**: Single indigo accent #6366f1 for all primary actions

### ❌ Warm Orange/Amber Accents
**Problem**: Dated industrial feel, cyberpunk aesthetic
**Example**: `--accent: #c56d2d`, `--accent-strong: #8c4218`
**Fix**: Use indigo #6366f1 for primary accent

### ❌ Colored Radial Gradients
**Problem**: Cyberpunk, SOC dashboard aesthetic
**Example**: `radial-gradient(circle at 12% 14%, rgba(197, 109, 45, 0.24), transparent)`
**Fix**: Use solid colors or subtle linear gradients (white overlay only)

### ❌ Glow Effects
**Problem**: Cyberpunk, aggressive, dated
**Example**: `box-shadow: 0 0 26px rgba(197, 109, 45, 0.18)`
**Fix**: Use functional shadows (elevation), not glow

### ❌ Neon Colors
**Problem**: Cyberpunk, aggressive, hard to read
**Example**: Bright cyan, bright green, bright magenta
**Fix**: Use muted, professional colors from design tokens

## Surface Anti-Patterns

### ❌ Gradient Backgrounds
**Problem**: Dated, cyberpunk, visually heavy
**Example**: `background: linear-gradient(180deg, rgba(222, 145, 80, 0.96), rgba(185, 98, 38, 0.96))`
**Fix**: Use solid colors from surface tokens

### ❌ Multiple Gradient Layers
**Problem**: Visually overwhelming, performance impact
**Example**: 3-5 radial gradients stacked on background
**Fix**: Single solid color or subtle linear gradient (white overlay)

### ❌ Heavy Borders Everywhere
**Problem**: Cluttered, dated, visually heavy
**Example**: 2px borders on every card, panel, section
**Fix**: Use surface differentiation (background shades) instead of borders

### ❌ Border Differentiation Over Surface Differentiation
**Problem**: Cluttered, hard to see hierarchy
**Example**: Same background color, different border colors/weights
**Fix**: Different background shades, subtle 1px borders

## Spacing Anti-Patterns

### ❌ Cramped Row Heights
**Problem**: Hard to read, feels dated, poor touch targets
**Example**: 34px row height, 28px row height
**Fix**: 40px default, 36px compact, 48px comfortable

### ❌ Tiny Padding
**Problem**: Cramped, hard to read, poor touch targets
**Example**: 4px padding on cards, 6px cell padding
**Fix**: 20-24px card padding, 10-12px cell padding

### ❌ Inconsistent Spacing
**Problem**: Feels unpolished, hard to scan
**Example**: Random gaps (13px, 17px, 23px)
**Fix**: Use spacing scale (4px base: 8px, 12px, 16px, 24px, 32px)

### ❌ No Whitespace
**Problem**: Overwhelming, hard to focus
**Example**: Sections touching, no gaps between cards
**Fix**: Generous gaps (24-32px between sections)

## Layout Anti-Patterns

### ❌ Page-Level Scrolling
**Problem**: Breaks sticky headers, unstable layout
**Example**: `<body>` or `<html>` scrolls
**Fix**: Page fixed, content area scrolls (AppShell architecture)

### ❌ Flex Children Without min-h-0
**Problem**: Flex children don't respect scroll containers
**Example**: `<div className="flex flex-col">` without `min-h-0` on scrolling child
**Fix**: Add `min-h-0` to flex children that need to scroll

### ❌ Scroll Containers Without Explicit Height
**Problem**: Scroll doesn't work, layout breaks
**Example**: `overflow-y-auto` without `height` or `max-height`
**Fix**: Explicit height containment (`h-[calc(100dvh-200px)]`)

### ❌ Nested Scroll Containers
**Problem**: Confusing scroll behavior, poor UX
**Example**: Scrollable div inside scrollable div
**Fix**: Single scroll container per content area

## Motion Anti-Patterns

### ❌ Decorative Animations
**Problem**: Distracting, slows down UI, feels gimmicky
**Example**: Floating elements, parallax, page transitions
**Fix**: Motion only for state changes (hover, focus, expand)

### ❌ Slow Transitions
**Problem**: Feels sluggish, frustrating
**Example**: 300ms, 500ms transitions
**Fix**: 80-120ms for state changes, 150ms max for expand/collapse

### ❌ Spring Physics
**Problem**: Feels bouncy, not professional
**Example**: `cubic-bezier(0.68, -0.55, 0.265, 1.55)` (bounce)
**Fix**: Standard easing `cubic-bezier(0.2, 0, 0, 1)`

### ❌ Pulsing/Glowing Effects
**Problem**: Anxious, distracting, cyberpunk
**Example**: Infinite pulse animation on badges
**Fix**: Static states, motion only on interaction

## Component Anti-Patterns

### ❌ Generic Admin Template Components
**Problem**: Dated, uninspired, no personality
**Example**: Bootstrap-style cards, panels, buttons
**Fix**: Custom components following visual doctrine

### ❌ Inconsistent Button Styles
**Problem**: Confusing hierarchy, unprofessional
**Example**: Different border radius, padding, font size per button
**Fix**: Consistent button system (primary, secondary, ghost, destructive)

### ❌ Unclear Interactive States
**Problem**: Users don't know what's clickable
**Example**: No hover state, no focus state, no active state
**Fix**: Clear hover (background change), focus (ring), active (pressed)

### ❌ Missing Loading States
**Problem**: Feels broken, unresponsive
**Example**: Button click with no feedback
**Fix**: Loading spinner, disabled state, clear feedback

## Dark Mode Anti-Patterns

### ❌ Cyberpunk Dark Mode
**Problem**: Aggressive, neon, dated
**Example**: Colored radial gradients, glow effects, neon accents
**Fix**: Clean dark mode (solid colors, subtle differentiation)

### ❌ Pure Black Backgrounds
**Problem**: Too harsh, poor contrast
**Example**: `background: #000000`
**Fix**: Dark gray (#09111B, #0D1523)

### ❌ Low Contrast Text
**Problem**: Hard to read, accessibility fail
**Example**: #666 text on #333 background
**Fix**: #EDF2F7 primary text, #94A3B8 secondary text

## AI/Intelligence Anti-Patterns

### ❌ Aggressive AI Indicators
**Problem**: Anxious, distracting, intrusive
**Example**: Pulsing "AI is thinking!" with glow effect
**Fix**: Subtle indigo indicator, calm "Processing" label

### ❌ Unclear Confidence Levels
**Problem**: Users don't trust AI suggestions
**Example**: No confidence indicator, no explanation
**Fix**: Clear confidence (High/Medium/Low), brief reasoning

### ❌ Intrusive Suggestions
**Problem**: Interrupts workflow, feels pushy
**Example**: Modal popup "AI suggests this!"
**Fix**: Inline suggestions, easy to dismiss, non-blocking

### ❌ Hidden AI Reasoning
**Problem**: Black box, no trust
**Example**: AI result with no explanation
**Fix**: Brief reasoning, data sources, confidence level

## Data Display Anti-Patterns

### ❌ Unclear Data Hierarchy
**Problem**: Can't scan quickly, hard to find key info
**Example**: All text same size/weight/color
**Fix**: Clear hierarchy (primary/secondary/tertiary text)

### ❌ Non-Tabular Numbers
**Problem**: Hard to compare, misaligned
**Example**: Proportional numbers in tables
**Fix**: Tabular numbers (`font-variant-numeric: tabular-nums`)

### ❌ Unclear Status Indicators
**Problem**: Can't quickly assess state
**Example**: Text-only status, no color coding
**Fix**: Color-coded badges (green=success, amber=warning, red=danger)

### ❌ Missing Metadata
**Problem**: No context, can't verify data
**Example**: Number with no unit, timestamp with no timezone
**Fix**: Clear units, relative timestamps, data provenance

## Form Anti-Patterns

### ❌ Unclear Validation States
**Problem**: Users don't know what's wrong
**Example**: Red border with no error message
**Fix**: Clear error message, specific guidance

### ❌ Aggressive Error Colors
**Problem**: Feels like being yelled at
**Example**: Bright red #ff0000 everywhere
**Fix**: Calm red #ef4444, clear but not alarming

### ❌ Missing Focus States
**Problem**: Keyboard users can't see where they are
**Example**: No focus ring on inputs
**Fix**: Clear focus ring (indigo, 1px offset)

### ❌ Unclear Required Fields
**Problem**: Users submit incomplete forms
**Example**: No asterisk, no label, no indication
**Fix**: Clear required indicator, validation on blur

## Accessibility Anti-Patterns

### ❌ Low Contrast
**Problem**: Hard to read, WCAG fail
**Example**: #999 text on #eee background (2.5:1 contrast)
**Fix**: Minimum 4.5:1 contrast for body text

### ❌ Missing Focus Indicators
**Problem**: Keyboard users can't navigate
**Example**: `outline: none` with no alternative
**Fix**: Clear focus ring on all interactive elements

### ❌ Non-Semantic HTML
**Problem**: Screen readers can't understand structure
**Example**: `<div onClick>` instead of `<button>`
**Fix**: Semantic HTML (`<button>`, `<nav>`, `<main>`)

### ❌ Missing Alt Text
**Problem**: Screen readers can't describe images
**Example**: `<img src="chart.png">`
**Fix**: `<img src="chart.png" alt="Steel batch production chart">`

## Performance Anti-Patterns

### ❌ Excessive Backdrop Filters
**Problem**: Slow rendering, janky scrolling
**Example**: `backdrop-filter: blur(20px)` on many elements
**Fix**: Use sparingly, disable on low-end devices

### ❌ Large Gradient Backgrounds
**Problem**: Slow rendering, high memory
**Example**: 5 radial gradients on body
**Fix**: Solid colors or single subtle gradient

### ❌ Unoptimized Images
**Problem**: Slow loading, poor UX
**Example**: 5MB PNG for icon
**Fix**: Optimized WebP, appropriate size

### ❌ Blocking Animations
**Problem**: Janky, unresponsive
**Example**: JavaScript animation on scroll
**Fix**: CSS transitions, GPU-accelerated properties

## Validation Process

Before shipping any change, check against this list:

1. **Typography**: Sentence case? Inter font? 14px body?
2. **Color**: Single indigo accent? No gradients? No glow?
3. **Surface**: Solid colors? Subtle borders? Surface differentiation?
4. **Spacing**: 40px rows? Generous padding? Consistent gaps?
5. **Layout**: Content scrolls? Explicit height? No page scroll?
6. **Motion**: Functional only? <150ms? No decorative?
7. **Dark Mode**: Clean? No cyberpunk? Good contrast?
8. **AI**: Subtle? Clear confidence? Non-intrusive?
9. **Accessibility**: Good contrast? Focus states? Semantic HTML?
10. **Performance**: Fast? Optimized? No jank?

If any answer is "no", revise before shipping.
