# Forbidden Mutations

This document lists **specific changes that are FORBIDDEN** without explicit approval.

## Architecture-Critical Files

### FORBIDDEN: Modify Without Approval

#### 1. AppShell (`web/src/components/app-shell.tsx`)
**Why**: Controls scroll ownership for entire application

**Forbidden Changes**:
- Removing `overflow-y-auto` from `.factory-workstation-frame`
- Changing scroll container architecture
- Modifying shell element positioning (header, sidebar, bottom nav)
- Changing responsive breakpoints for shell layout
- Adding/removing scroll containers

**Allowed Changes**:
- Styling (colors, spacing) that doesn't affect layout
- Adding content inside existing containers
- Bug fixes that preserve scroll architecture

#### 2. Design Tokens (`web/src/styles/tokens.css`)
**Why**: Source of truth for design system

**Forbidden Changes**:
- Changing color values without design approval
- Removing existing tokens (breaking change)
- Changing spacing scale (breaks all spacing)
- Modifying typography scale without approval

**Allowed Changes**:
- Adding new tokens (non-breaking)
- Fixing token bugs
- Updating dark mode values (with approval)

#### 3. Global Styles (`web/src/app/globals.css`)
**Why**: Affects entire application

**Forbidden Changes**:
- Adding gradient backgrounds
- Changing font families
- Modifying scrollbar styles without approval
- Adding global animations

**Allowed Changes**:
- Bug fixes
- Adding utility classes (following design system)
- Updating colors to match design tokens

## Visual Mutations

### FORBIDDEN: Typography Changes

#### ❌ Changing to UPPERCASE
```tsx
// FORBIDDEN
<button className="uppercase">SAVE CHANGES</button>
<h1 className="uppercase tracking-widest">STEEL BATCHES</h1>
```

**Why**: Violates typography doctrine (sentence case only)

#### ❌ Changing Font Family
```tsx
// FORBIDDEN
<div className="font-[IBM_Plex_Sans]">Content</div>
<h1 className="font-[Space_Grotesk]">Title</h1>
```

**Why**: Violates typography doctrine (Inter only for UI)

#### ❌ Excessive Letter Spacing
```tsx
// FORBIDDEN
<p className="tracking-[0.18em]">Body text</p>
<label className="tracking-[0.2em]">Form label</label>
```

**Why**: Hard to read, dated feel

#### ❌ Tiny Body Text
```tsx
// FORBIDDEN
<p className="text-[11px]">Primary body text</p>
<div className="text-[10px]">Content</div>
```

**Why**: Accessibility fail, hard to read

### FORBIDDEN: Color Changes

#### ❌ Adding Gradient Backgrounds
```tsx
// FORBIDDEN
<div className="bg-gradient-to-r from-orange-500 to-amber-600">
<button className="bg-gradient-to-br from-blue-500 to-purple-600">
```

**Why**: Violates color philosophy (solid colors only)

#### ❌ Adding Glow Effects
```tsx
// FORBIDDEN
<div className="shadow-[0_0_26px_rgba(197,109,45,0.18)]">
<button className="shadow-[0_0_40px_rgba(99,102,241,0.5)]">
```

**Why**: Cyberpunk aesthetic, not professional

#### ❌ Multiple Accent Colors
```tsx
// FORBIDDEN
<button className="bg-orange-500">Primary</button>
<button className="bg-teal-500">Secondary</button>
<button className="bg-purple-500">Tertiary</button>
```

**Why**: Violates color philosophy (single indigo accent)

#### ❌ Colored Radial Gradients
```tsx
// FORBIDDEN
<div className="bg-[radial-gradient(circle_at_12%_14%,rgba(197,109,45,0.24),transparent)]">
```

**Why**: Cyberpunk aesthetic, dated

### FORBIDDEN: Spacing Changes

#### ❌ Random Spacing Values
```tsx
// FORBIDDEN
<div className="p-[13px] mb-[17px] gap-[23px]">
<Card className="p-[19px]" />
```

**Why**: Violates spacing rhythm (4px scale only)

#### ❌ Cramped Row Heights
```tsx
// FORBIDDEN
<tr className="h-[28px]">  {/* Too cramped */}
<tr className="h-[32px]">  {/* Too cramped */}
```

**Why**: Poor touch targets, dated feel (40px minimum)

#### ❌ Tiny Padding
```tsx
// FORBIDDEN
<Card className="p-1" />  {/* 4px - too cramped */}
<Card className="p-2" />  {/* 8px - too cramped */}
```

**Why**: Cramped, hard to read (20-24px minimum for cards)

## Layout Mutations

### FORBIDDEN: Scroll Ownership Changes

#### ❌ Page Creates Scroll Container
```tsx
// FORBIDDEN
export function MyPage() {
  return (
    <div className="h-screen overflow-y-auto">
      <div>Content</div>
    </div>
  );
}
```

**Why**: Conflicts with AppShell scroll ownership

#### ❌ Removing overflow-y-auto from AppShell
```tsx
// FORBIDDEN
<div className="factory-workstation-frame"> {/* Missing overflow-y-auto */}
```

**Why**: Breaks page scrolling for entire app

#### ❌ Flex Child Without min-h-0
```tsx
// FORBIDDEN
<div className="flex flex-col h-screen">
  <div className="overflow-y-auto"> {/* Missing min-h-0 */}
    <DataTable />
  </div>
</div>
```

**Why**: Flex child won't respect scroll container

#### ❌ Scroll Container Without Height
```tsx
// FORBIDDEN
<div className="overflow-y-auto"> {/* No height constraint */}
  <DataTable />
</div>
```

**Why**: Scroll won't work without height

### FORBIDDEN: Layout Instability

#### ❌ Page-Level Scrolling
```tsx
// FORBIDDEN
<html className="overflow-y-auto">
<body className="overflow-y-auto">
```

**Why**: Breaks sticky headers, unstable layout

#### ❌ Nested Scroll Containers
```tsx
// FORBIDDEN
<div className="h-screen overflow-y-auto">
  <div className="h-[500px] overflow-y-auto">
    <DataTable />
  </div>
</div>
```

**Why**: Confusing scroll behavior, poor UX

## Component Mutations

### FORBIDDEN: Generic Admin Templates

#### ❌ Bootstrap-Style Components
```tsx
// FORBIDDEN
<div className="card">
  <div className="card-header">
    <h3 className="card-title">Title</h3>
  </div>
  <div className="card-body">Content</div>
</div>
```

**Why**: Generic, dated, not DPR.ai style

#### ❌ Heavy Borders Everywhere
```tsx
// FORBIDDEN
<Card className="border-2 border-gray-500" />
<div className="border-4 border-blue-500" />
```

**Why**: Cluttered, dated (use surface differentiation)

### FORBIDDEN: Motion Patterns

#### ❌ Decorative Animations
```tsx
// FORBIDDEN
<div className="animate-bounce">
<div className="animate-pulse">
<div className="animate-spin"> {/* Unless loading spinner */}
```

**Why**: Distracting, not functional

#### ❌ Slow Transitions
```tsx
// FORBIDDEN
<div className="transition-all duration-500">
<div className="transition-all duration-1000">
```

**Why**: Feels sluggish (150ms max)

#### ❌ Spring Physics
```tsx
// FORBIDDEN
<motion.div
  animate={{ scale: 1 }}
  transition={{ type: "spring", bounce: 0.5 }}
>
```

**Why**: Bouncy, not professional

#### ❌ Pulsing Effects
```tsx
// FORBIDDEN
<div className="animate-pulse">AI is thinking...</div>
<Badge className="animate-pulse">New</Badge>
```

**Why**: Anxious, distracting

## Dark Mode Mutations

### FORBIDDEN: Cyberpunk Dark Mode

#### ❌ Colored Radial Gradients
```tsx
// FORBIDDEN (dark mode)
<body className="bg-[radial-gradient(circle_at_12%_14%,rgba(197,109,45,0.24),transparent)]">
```

**Why**: Cyberpunk aesthetic, not professional

#### ❌ Glow Effects
```tsx
// FORBIDDEN (dark mode)
<div className="shadow-[0_0_40px_rgba(99,102,241,0.5)]">
```

**Why**: Cyberpunk aesthetic, not professional

#### ❌ Pure Black Backgrounds
```tsx
// FORBIDDEN (dark mode)
<div className="bg-black">
```

**Why**: Too harsh, poor contrast (use dark gray)

#### ❌ Low Contrast Text
```tsx
// FORBIDDEN (dark mode)
<p className="text-gray-600">Text</p> {/* On dark background */}
```

**Why**: Accessibility fail, hard to read

## AI/Intelligence Mutations

### FORBIDDEN: Aggressive AI Indicators

#### ❌ Pulsing AI Indicators
```tsx
// FORBIDDEN
<div className="animate-pulse">
  <Spinner />
  <span>AI is thinking!</span>
</div>
```

**Why**: Anxious, distracting

#### ❌ Glow Effects on AI
```tsx
// FORBIDDEN
<div className="shadow-[0_0_40px_rgba(99,102,241,0.5)]">
  AI Processing
</div>
```

**Why**: Cyberpunk, not professional

#### ❌ Unclear Confidence Levels
```tsx
// FORBIDDEN
<div>AI Result</div> {/* No confidence indicator */}
```

**Why**: Users don't trust AI without confidence level

## Performance Mutations

### FORBIDDEN: Performance Killers

#### ❌ Excessive Backdrop Filters
```tsx
// FORBIDDEN
<div className="backdrop-blur-3xl">
  <div className="backdrop-blur-2xl">
    <div className="backdrop-blur-xl">
```

**Why**: Slow rendering, janky scrolling

#### ❌ Large Gradient Backgrounds
```tsx
// FORBIDDEN
<body className="bg-[radial-gradient(...),radial-gradient(...),radial-gradient(...),linear-gradient(...)]">
```

**Why**: Slow rendering, high memory

#### ❌ Unoptimized Images
```tsx
// FORBIDDEN
<img src="5mb-image.png" />
```

**Why**: Slow loading, poor UX

## Accessibility Mutations

### FORBIDDEN: Accessibility Violations

#### ❌ Removing Focus Indicators
```tsx
// FORBIDDEN
<button className="focus:outline-none"> {/* No alternative focus indicator */}
```

**Why**: Keyboard users can't navigate

#### ❌ Low Contrast
```tsx
// FORBIDDEN
<p className="text-gray-400">Text</p> {/* On white background - 2.5:1 contrast */}
```

**Why**: WCAG fail, hard to read

#### ❌ Non-Semantic HTML
```tsx
// FORBIDDEN
<div onClick={handleClick}>Click me</div> {/* Should be <button> */}
```

**Why**: Screen readers can't understand

#### ❌ Missing Alt Text
```tsx
// FORBIDDEN
<img src="chart.png" /> {/* No alt text */}
```

**Why**: Screen readers can't describe

## Approval Process

### How to Request Exception

If you believe a forbidden mutation is necessary:

1. **Document the reason**
   - Why is this change needed?
   - What problem does it solve?
   - What alternatives were considered?

2. **Show the impact**
   - What files will be affected?
   - What are the side effects?
   - How will this affect users?

3. **Demonstrate testing**
   - Screenshots/videos
   - Responsive testing
   - Accessibility testing
   - Performance testing

4. **Get explicit approval**
   - From tech lead or design lead
   - Document the approval
   - Update governance docs

### Emergency Exceptions

In production emergencies, forbidden mutations may be necessary:

1. **Fix the immediate issue** (minimal change)
2. **Document the exception** (why it was necessary)
3. **Create follow-up task** (proper fix)
4. **Update governance docs** (prevent future issues)

## Summary

### Never Do These Without Approval:
1. ❌ Modify AppShell scroll architecture
2. ❌ Change design tokens
3. ❌ Add gradient backgrounds
4. ❌ Use UPPERCASE for UI text
5. ❌ Change font family
6. ❌ Add multiple accent colors
7. ❌ Add glow effects
8. ❌ Use random spacing values
9. ❌ Create page-level scroll containers
10. ❌ Remove focus indicators

### Always Do These:
1. ✅ Read governance docs before changes
2. ✅ Match existing patterns
3. ✅ Test responsively
4. ✅ Use design tokens
5. ✅ Follow visual doctrine
6. ✅ Respect scroll ownership
7. ✅ Maintain accessibility
8. ✅ Document decisions
9. ✅ Get approval for architectural changes
10. ✅ Update governance docs
