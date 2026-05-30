# AppShell Doctrine

## Critical Importance

**AppShell is architecture-critical.** Changes to AppShell require explicit approval because:
- It controls scroll ownership for the entire application
- It manages layout stability across all routes
- It defines the shell/content boundary
- Breaking it breaks every page

## Architecture Overview

```
<AppShell>
  ├── <AppHeader> (fixed, never scrolls)
  ├── <AppSidebar> (fixed, independent scroll)
  ├── <factory-workstation-frame> (SCROLLS - content area)
  │   └── <factory-workstation-shell>
  │       └── {children} (page content)
  └── <AppMobileBottomNav> (fixed, never scrolls)
</AppShell>
```

## Core Principles

### 1. Page Does NOT Scroll
- `<html>` and `<body>` are fixed height
- Page-level scrolling is FORBIDDEN
- Only content areas scroll

### 2. Content Area Scrolls
- `.factory-workstation-frame` has `overflow-y-auto`
- This is the ONLY scroll container for page content
- All page content scrolls within this container

### 3. Shell Elements Are Fixed
- AppHeader: `position: sticky` or fixed
- AppSidebar: Fixed position, independent scroll
- AppMobileBottomNav: Fixed position
- These NEVER scroll with content

## Scroll Ownership Rules

### ✅ Correct Scroll Ownership
```tsx
// AppShell owns the scroll container
<div className="factory-workstation-frame overflow-y-auto">
  <div className="factory-workstation-shell">
    {children} // Page content scrolls here
  </div>
</div>
```

### ❌ Incorrect Scroll Ownership
```tsx
// Page trying to own scroll - FORBIDDEN
<div className="page-container overflow-y-auto">
  <div className="content">...</div>
</div>
```

### Rule
- **AppShell owns scroll** - Pages receive scroll container
- **Pages do NOT create scroll containers** - They render into AppShell's container
- **Exception**: Nested scrollable areas (tables, modals) are allowed

## Layout Stability Rules

### 1. Explicit Height Containment
All scroll containers MUST have explicit height:
```tsx
// ✅ Good - explicit height
<div className="overflow-y-auto h-[calc(100dvh-200px)]">

// ❌ Bad - no height constraint
<div className="overflow-y-auto">
```

### 2. Flex Children Need min-h-0
Flex children that scroll MUST have `min-h-0`:
```tsx
// ✅ Good
<div className="flex flex-col">
  <div className="min-h-0 overflow-y-auto">...</div>
</div>

// ❌ Bad - flex child won't respect scroll
<div className="flex flex-col">
  <div className="overflow-y-auto">...</div>
</div>
```

### 3. Sticky Elements Need Scroll Context
Sticky elements need a scroll container:
```tsx
// ✅ Good - sticky within scroll container
<div className="overflow-y-auto">
  <div className="sticky top-0">Header</div>
  <div>Content...</div>
</div>

// ❌ Bad - sticky without scroll context
<div>
  <div className="sticky top-0">Header</div>
  <div>Content...</div>
</div>
```

## AppShell Class Names

### `.factory-workstation-scope`
- **Purpose**: Root container for entire app
- **Behavior**: `min-h-screen`, `overflow-hidden`
- **Rule**: Never modify

### `.factory-workstation-frame`
- **Purpose**: Main content scroll container
- **Behavior**: `overflow-y-auto`, `flex-1`
- **Rule**: This is THE scroll container - changes require approval

### `.factory-workstation-shell`
- **Purpose**: Content wrapper inside scroll container
- **Behavior**: `min-w-0`, `flex-1`
- **Rule**: Layout wrapper - changes require approval

### `.factory-workstation-topbar`
- **Purpose**: Desktop top bar (sticky)
- **Behavior**: `sticky top-0`, `z-sticky`
- **Rule**: Must remain sticky - changes require approval

## Responsive Behavior

### Desktop (lg+)
- Sidebar: Fixed, 220px width (`lg:pl-[13.75rem]`)
- Content: Scrolls independently
- Top bar: Sticky within content scroll

### Mobile (<lg)
- Sidebar: Overlay (fixed position)
- Content: Full width, scrolls
- Bottom nav: Fixed position

### Rule
- Responsive changes must preserve scroll ownership
- Mobile and desktop must have same scroll architecture

## Common Mistakes

### ❌ Mistake 1: Page Creates Scroll Container
```tsx
// WRONG - page trying to own scroll
export function MyPage() {
  return (
    <div className="h-screen overflow-y-auto">
      <div>Content</div>
    </div>
  );
}
```

**Fix**: Remove scroll container, let AppShell handle it
```tsx
// CORRECT - page renders into AppShell's scroll
export function MyPage() {
  return (
    <div className="p-6">
      <div>Content</div>
    </div>
  );
}
```

### ❌ Mistake 2: Flex Child Without min-h-0
```tsx
// WRONG - flex child won't scroll
<div className="flex flex-col h-screen">
  <div className="overflow-y-auto">
    <DataTable />
  </div>
</div>
```

**Fix**: Add `min-h-0`
```tsx
// CORRECT
<div className="flex flex-col h-screen">
  <div className="min-h-0 overflow-y-auto">
    <DataTable />
  </div>
</div>
```

### ❌ Mistake 3: Scroll Container Without Height
```tsx
// WRONG - no height constraint
<div className="overflow-y-auto">
  <DataTable />
</div>
```

**Fix**: Add explicit height
```tsx
// CORRECT
<div className="overflow-y-auto h-[calc(100dvh-200px)]">
  <DataTable />
</div>
```

## Testing Checklist

Before shipping AppShell changes, verify:

### Scroll Behavior
- [ ] Page scrolls vertically (content area)
- [ ] Sidebar does NOT scroll with page
- [ ] Header does NOT scroll with page
- [ ] Bottom nav does NOT scroll with page
- [ ] Tables scroll independently within page scroll

### Sticky Behavior
- [ ] Top bar stays sticky while page scrolls
- [ ] Table headers stay sticky while table scrolls
- [ ] Sidebar remains fixed while page scrolls

### Responsive Behavior
- [ ] Mobile (375px): Layout works, no cutoff
- [ ] Tablet (768px): Layout works, transitions correctly
- [ ] Desktop (1920px): Layout works, proper spacing

### Layout Stability
- [ ] No layout shift on load
- [ ] No layout shift on scroll
- [ ] No layout shift on resize
- [ ] No horizontal scroll (unless intentional)

### Performance
- [ ] Smooth scrolling (60fps)
- [ ] No scroll lag
- [ ] No jank on resize
- [ ] Virtual scrolling works (if applicable)

## Approval Process

### Changes That Require Approval
1. Modifying `.factory-workstation-frame` scroll behavior
2. Changing scroll ownership architecture
3. Adding/removing scroll containers in AppShell
4. Modifying sticky behavior of shell elements
5. Changing responsive breakpoints for shell layout

### Changes That Don't Require Approval
1. Styling changes (colors, spacing) that don't affect layout
2. Adding content inside existing containers
3. Modifying page-level content (not shell)
4. Adding new routes (using existing shell)

### How to Request Approval
1. Document the change and reason
2. Show before/after behavior
3. Demonstrate testing across breakpoints
4. Explain impact on scroll ownership
5. Get explicit approval before merging

## Emergency Fixes

If AppShell is broken in production:

### Symptoms
- Page won't scroll
- Sidebar scrolls with page
- Layout shifts on scroll
- Horizontal scroll appears
- Sticky elements don't stick

### Immediate Actions
1. Check `.factory-workstation-frame` has `overflow-y-auto`
2. Check flex children have `min-h-0` if needed
3. Check scroll containers have explicit height
4. Check no page-level scroll containers
5. Revert recent AppShell changes if needed

### Prevention
- Always test scroll behavior before shipping
- Always test responsive behavior
- Always test sticky behavior
- Never modify AppShell without testing
- Never merge AppShell changes without approval

## Reference Implementation

Current AppShell structure (as of last audit):
```tsx
<div className="factory-workstation-scope">
  <AppHeader /> {/* Fixed/sticky */}
  <AppSidebar /> {/* Fixed, independent scroll */}
  
  <div className="factory-workstation-frame overflow-y-auto"> {/* SCROLL OWNER */}
    <div className="factory-workstation-shell">
      <div className="factory-workstation-topbar sticky top-0"> {/* Sticky within scroll */}
        {/* Desktop top bar */}
      </div>
      {children} {/* Page content */}
    </div>
  </div>
  
  <AppMobileBottomNav /> {/* Fixed */}
</div>
```

This structure is **architecture-critical** and must be preserved.
