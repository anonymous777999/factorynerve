# Color Philosophy

## Core Principle

**Single accent, calm surfaces, functional status colors.** Color communicates meaning, not decoration.

## Accent Color

### Primary: Indigo #6366f1
- **Usage**: Primary actions, links, focus states, active states, AI processing
- **Why**: Modern, trustworthy, professional, calm
- **Contrast**: Works in light and dark mode
- **Emotional**: Intelligent, reliable, operational

### Rule: ONE Accent Only
- No secondary accent colors
- No multiple competing colors
- No warm orange, no teal, no multiple blues
- Indigo is THE accent color

### Forbidden Accents
- ❌ Warm orange #c56d2d (dated, cyberpunk)
- ❌ Amber #ffb868 (too warm, old industrial)
- ❌ Teal #1f8a78 (too many accents)
- ❌ Multiple blues (confusing)

## Status Colors

### Success: Green #22c55e
- **Meaning**: Complete, verified, healthy, synced
- **Usage**: Success states, completed tasks, verified data
- **Emotional**: Positive, reliable, confirmed

### Warning: Amber #f59e0b
- **Meaning**: Attention needed, caution, degraded, review
- **Usage**: Warnings, degraded states, attention needed
- **Emotional**: Alert but not alarming, actionable

### Danger: Red #ef4444
- **Meaning**: Error, critical, failure, stop
- **Usage**: Errors, critical alerts, destructive actions
- **Emotional**: Serious but not panic-inducing

### Processing: Indigo #4338ca
- **Meaning**: AI in-progress, async task running, computing
- **Usage**: AI processing, async operations, loading states
- **Emotional**: Calm, intelligent, working

### Paused: Slate #64748b
- **Meaning**: Hold, awaiting, queued, inactive
- **Usage**: Paused workflows, queued items, inactive states
- **Emotional**: Neutral, waiting, not urgent

## Surface System

### Principle: Surface Differentiation Over Border Differentiation
Use different background shades to create hierarchy, not heavy borders.

### Light Mode Surfaces
```
--surface-app:      #F5F7FA  (lightest - app background)
--surface-shell:    #EBEEF2  (shell background)
--surface-panel:    #F7F9FB  (panel background)
--surface-card:     #FAFBFC  (card background)
--surface-elevated: #FCFDFD  (elevated elements)
--surface-overlay:  #FCFDFD  (modals, dropdowns)
```

### Dark Mode Surfaces
```
--surface-app:      #09111B  (darkest - app background)
--surface-shell:    #0D1523  (shell background)
--surface-panel:    #111B2B  (panel background)
--surface-card:     #152131  (card background)
--surface-elevated: #1B293B  (elevated elements)
--surface-overlay:  #203148  (modals, dropdowns)
```

### Rule: 2-3% Lightness Steps
Each surface level must be visually distinguishable but subtle.

## Text Colors

### Light Mode
```
--text-primary:    #1E293B  (headings, labels, key data)
--text-secondary:  #475569  (supporting text, descriptions)
--text-tertiary:   #64748B  (placeholders, hints, metadata)
--text-disabled:   #94A3B8  (disabled fields)
```

### Dark Mode
```
--text-primary:    #EDF2F7  (headings, labels, key data)
--text-secondary:  #94A3B8  (supporting text, descriptions)
--text-tertiary:   #546E8A  (placeholders, hints, metadata)
--text-disabled:   #42546E  (disabled fields)
```

### Rule: 4.5:1 Minimum Contrast
All text must meet WCAG AA contrast requirements.

## Border Colors

### Light Mode
```
--border-subtle:   #E2E8F0  (subtle dividers)
--border-default:  #CBD5E1  (default borders)
--border-strong:   #94A3B8  (emphasized borders)
```

### Dark Mode
```
--border-subtle:   #1B2A3F  (subtle dividers)
--border-default:  #23344C  (default borders)
--border-strong:   #314865  (emphasized borders)
```

### Rule: Borders Are Subtle
Borders should be barely visible, not heavy lines.

## Forbidden Patterns

### ❌ Gradient Backgrounds
```css
/* WRONG */
background: linear-gradient(180deg, rgba(222, 145, 80, 0.96), rgba(185, 98, 38, 0.96));
```

**Why**: Dated, cyberpunk, visually heavy

**Fix**: Use solid colors
```css
/* CORRECT */
background: var(--surface-card);
```

### ❌ Colored Radial Gradients
```css
/* WRONG */
background: radial-gradient(circle at 12% 14%, rgba(197, 109, 45, 0.24), transparent);
```

**Why**: Cyberpunk, SOC dashboard aesthetic

**Fix**: Use solid colors or subtle white overlay
```css
/* CORRECT */
background: var(--surface-app);
```

### ❌ Glow Effects
```css
/* WRONG */
box-shadow: 0 0 26px rgba(197, 109, 45, 0.18);
```

**Why**: Cyberpunk, aggressive, dated

**Fix**: Use functional shadows
```css
/* CORRECT */
box-shadow: var(--shadow-sm);
```

### ❌ Multiple Accent Colors
```css
/* WRONG */
.primary { color: #3b82f6; }
.secondary { color: #c56d2d; }
.tertiary { color: #1f8a78; }
```

**Why**: Confusing, cluttered, no clear hierarchy

**Fix**: Single accent
```css
/* CORRECT */
.primary { color: #6366f1; }
```

### ❌ Neon Colors
```css
/* WRONG */
color: #00ffff; /* Bright cyan */
color: #00ff00; /* Bright green */
```

**Why**: Cyberpunk, aggressive, hard to read

**Fix**: Use muted professional colors
```css
/* CORRECT */
color: var(--status-success-fg);
```

## Color Usage by Context

### Primary Actions
- **Color**: Indigo #6366f1
- **Usage**: Primary buttons, links, focus states
- **Example**: "Save changes" button

### Secondary Actions
- **Color**: Neutral (surface-based)
- **Usage**: Secondary buttons, ghost buttons
- **Example**: "Cancel" button

### Destructive Actions
- **Color**: Red #ef4444
- **Usage**: Delete buttons, destructive actions
- **Example**: "Delete batch" button

### Success States
- **Color**: Green #22c55e
- **Usage**: Success messages, completed tasks
- **Example**: "Batch created successfully"

### Warning States
- **Color**: Amber #f59e0b
- **Usage**: Warning messages, attention needed
- **Example**: "Review required"

### Error States
- **Color**: Red #ef4444
- **Usage**: Error messages, validation errors
- **Example**: "Invalid input"

### AI/Processing States
- **Color**: Indigo #4338ca
- **Usage**: AI processing, async operations
- **Example**: "OCR processing..."

### Inactive/Paused States
- **Color**: Slate #64748b
- **Usage**: Paused workflows, inactive items
- **Example**: "Workflow paused"

## Status Badge Colors

### Success Badge
```tsx
<Badge status="success">Verified</Badge>
```
- **Background**: Light green #F0FDF4
- **Text**: Dark green #15803D
- **Border**: Medium green #BBF7D0

### Warning Badge
```tsx
<Badge status="warning">Review needed</Badge>
```
- **Background**: Light amber #FFFBEB
- **Text**: Dark amber #B45309
- **Border**: Medium amber #FDE68A

### Danger Badge
```tsx
<Badge status="danger">Failed</Badge>
```
- **Background**: Light red #FEF2F2
- **Text**: Dark red #B91C1C
- **Border**: Medium red #FECACA

### Processing Badge
```tsx
<Badge status="processing">AI processing</Badge>
```
- **Background**: Light indigo #EEF2FF
- **Text**: Dark indigo #4338CA
- **Border**: Medium indigo #C7D2FE

### Paused Badge
```tsx
<Badge status="paused">Queued</Badge>
```
- **Background**: Light slate #F8FAFC
- **Text**: Dark slate #334155
- **Border**: Medium slate #CBD5E1

## Dark Mode Philosophy

### Approach
- **Modern dark**: Clean, professional, readable
- **NOT cyberpunk**: No colored gradients, no glow
- **Subtle surfaces**: 2-3% differentiation
- **Good contrast**: Readable text, clear hierarchy

### Forbidden in Dark Mode
- ❌ Colored radial gradients
- ❌ Glow effects
- ❌ Neon accents
- ❌ Pure black backgrounds (#000)
- ❌ Low contrast text

### Dark Mode Best Practices
1. Use dark gray backgrounds, not pure black
2. Maintain 4.5:1 text contrast
3. Subtle surface differentiation (2-3%)
4. Same accent color as light mode (indigo)
5. Slightly heavier shadows for depth

## AI Indicator Colors

### AI Processing (Active)
- **Color**: Indigo #4338ca
- **Usage**: AI is actively processing
- **Visual**: Subtle indigo indicator, no glow
- **Example**: OCR scanning, AI suggestions

### AI Confidence: High
- **Color**: Green #22c55e
- **Usage**: AI is confident in result
- **Visual**: Green indicator or badge
- **Example**: "High confidence: 95%"

### AI Confidence: Medium
- **Color**: Amber #f59e0b
- **Usage**: AI has moderate confidence
- **Visual**: Amber indicator or badge
- **Example**: "Medium confidence: 70%"

### AI Confidence: Low
- **Color**: Slate #64748b
- **Usage**: AI has low confidence
- **Visual**: Slate indicator or badge
- **Example**: "Low confidence: 45%"

### Rule: AI Indicators Are Subtle
- No pulsing animations
- No glow effects
- Calm, professional appearance
- Clear but not alarming

## Accessibility

### Contrast Requirements
- **Body text**: 4.5:1 minimum (WCAG AA)
- **Large text**: 3:1 minimum (WCAG AA)
- **UI components**: 3:1 minimum (WCAG AA)

### Color Blindness
- Don't rely on color alone
- Use icons + color for status
- Use text labels + color for badges
- Test with color blindness simulators

### Focus States
- Clear focus ring (indigo)
- 1px offset from element
- Visible in light and dark mode
- Never remove focus indicators

## Implementation Examples

### Primary Button
```tsx
<button className="bg-[#6366f1] text-white hover:bg-[#5558e3]">
  Save changes
</button>
```

### Success Message
```tsx
<div className="bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D]">
  Batch created successfully
</div>
```

### Warning Badge
```tsx
<span className="bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309]">
  Review needed
</span>
```

### AI Processing Indicator
```tsx
<div className="flex items-center gap-2 text-[#4338ca]">
  <Spinner className="text-[#4338ca]" />
  <span>Processing...</span>
</div>
```

### Surface Card
```tsx
<div className="bg-surface-card border border-border-subtle rounded-lg p-6">
  Card content
</div>
```

## Validation Checklist

Before shipping color changes:

- [ ] Single accent color (indigo #6366f1)
- [ ] No gradient backgrounds
- [ ] No glow effects
- [ ] No colored radial gradients
- [ ] Surface differentiation (not border differentiation)
- [ ] 4.5:1 text contrast minimum
- [ ] Status colors are functional (not decorative)
- [ ] AI indicators are subtle (not pulsing/glowing)
- [ ] Dark mode is clean (not cyberpunk)
- [ ] Color + icon/text (not color alone)

## Reference Examples

### ✅ Good: Linear
- Single accent color (purple)
- Subtle surface differentiation
- Clean, modern, professional
- No gradients, no glow

### ✅ Good: Stripe Dashboard
- Single accent color (blue)
- Clear status colors
- Functional, not decorative
- Professional, trustworthy

### ❌ Bad: SOC Dashboards
- Multiple accent colors
- Colored radial gradients
- Glow effects everywhere
- Cyberpunk aesthetic

### ❌ Bad: Old Enterprise Software
- Dated color palette
- Heavy borders everywhere
- No clear hierarchy
- Generic, uninspired
