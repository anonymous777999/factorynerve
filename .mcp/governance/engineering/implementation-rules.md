# Implementation Rules

## Core Principles

1. **Read before writing** - Understand existing patterns before adding new code
2. **Match existing style** - Follow project conventions, not personal preferences
3. **Test before shipping** - Verify changes work across breakpoints and contexts
4. **Document decisions** - Update governance docs when making architectural changes

## Before Making Changes

### 1. Read Governance Docs
- [ ] Read relevant governance files
- [ ] Check anti-patterns.md
- [ ] Verify against visual doctrine
- [ ] Understand scroll ownership (if layout change)

### 2. Understand Existing Code
- [ ] Read related components
- [ ] Understand current patterns
- [ ] Check for similar implementations
- [ ] Review recent changes (git log)

### 3. Plan the Change
- [ ] Identify affected files
- [ ] List potential side effects
- [ ] Plan testing approach
- [ ] Consider responsive behavior

## Implementation Guidelines

### Typography Changes
```tsx
// ✅ CORRECT - follows typography rules
<h1 className="text-[18px] font-semibold text-text-primary">
  Steel batches
</h1>

// ❌ WRONG - violates typography rules
<h1 className="text-[16px] font-bold uppercase tracking-[0.2em]">
  STEEL BATCHES
</h1>
```

**Rules**:
- Sentence case (not UPPERCASE)
- Inter font (not IBM Plex Sans)
- 14px body, 18px page titles
- Use design tokens

### Color Changes
```tsx
// ✅ CORRECT - single accent, design tokens
<button className="bg-[#6366f1] text-white">
  Save changes
</button>

// ❌ WRONG - gradient background
<button className="bg-gradient-to-r from-orange-500 to-amber-600">
  Save changes
</button>
```

**Rules**:
- Single indigo accent #6366f1
- No gradient backgrounds
- No glow effects
- Use design tokens

### Layout Changes
```tsx
// ✅ CORRECT - explicit height, min-h-0
<div className="flex flex-col h-screen">
  <div className="flex-none">Header</div>
  <div className="min-h-0 flex-1 overflow-y-auto">
    <DataTable />
  </div>
</div>

// ❌ WRONG - no height, no min-h-0
<div className="flex flex-col">
  <div>Header</div>
  <div className="overflow-y-auto">
    <DataTable />
  </div>
</div>
```

**Rules**:
- Explicit height on scroll containers
- `min-h-0` on flex children that scroll
- Page does NOT create scroll containers
- AppShell owns page scroll

### Spacing Changes
```tsx
// ✅ CORRECT - 4px scale, consistent
<div className="p-6 space-y-4">
  <Card className="p-6" />
  <Card className="p-6" />
</div>

// ❌ WRONG - random values, inconsistent
<div className="p-[13px] space-y-[17px]">
  <Card className="p-[19px]" />
  <Card className="p-[23px]" />
</div>
```

**Rules**:
- Use 4px base scale
- Consistent spacing
- Generous whitespace
- Use semantic tokens

## Component Patterns

### Button Component
```tsx
// ✅ CORRECT
<Button
  variant="primary"
  size="default"
  className="px-4 py-2"
>
  Save changes
</Button>

// ❌ WRONG
<button className="bg-gradient-to-r from-orange-500 to-amber-600 uppercase tracking-widest">
  SAVE CHANGES
</button>
```

### Form Field
```tsx
// ✅ CORRECT
<div className="space-y-2">
  <label className="text-[14px] font-medium text-text-primary">
    Factory name
  </label>
  <input
    className="px-3 py-2 border border-border-default rounded-md"
    placeholder="Enter factory name"
  />
  <p className="text-[12px] text-text-secondary">
    This field is required
  </p>
</div>

// ❌ WRONG
<div>
  <label className="text-[11px] uppercase tracking-[0.2em]">
    FACTORY NAME
  </label>
  <input className="p-1" />
</div>
```

### Card Component
```tsx
// ✅ CORRECT
<div className="bg-surface-card border border-border-subtle rounded-lg p-6">
  <h2 className="text-[16px] font-semibold text-text-primary">
    Card title
  </h2>
  <p className="mt-2 text-[14px] text-text-secondary">
    Card content
  </p>
</div>

// ❌ WRONG
<div className="bg-gradient-to-br from-orange-500/20 to-teal-500/20 border-2 border-orange-500 p-2">
  <h2 className="uppercase tracking-widest">CARD TITLE</h2>
  <p>Card content</p>
</div>
```

## Testing Requirements

### Before Committing
- [ ] Visual inspection (does it look right?)
- [ ] Responsive testing (mobile, tablet, desktop)
- [ ] Scroll behavior (if layout change)
- [ ] Keyboard navigation (if interactive)
- [ ] Dark mode (if visual change)

### Responsive Testing
```
Mobile:   375px, 414px
Tablet:   768px, 1024px
Desktop:  1280px, 1440px, 1920px
```

### Scroll Testing
- [ ] Page scrolls vertically
- [ ] Tables scroll independently
- [ ] Sticky headers stay sticky
- [ ] No horizontal scroll (unless intentional)
- [ ] Smooth scrolling (60fps)

### Accessibility Testing
- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] Color contrast ≥4.5:1
- [ ] Screen reader friendly
- [ ] Touch targets ≥44px

## Code Quality

### TypeScript
- [ ] No `any` types (use proper types)
- [ ] No TypeScript errors
- [ ] No unused imports
- [ ] Proper type inference

### React
- [ ] Proper hooks usage
- [ ] No unnecessary re-renders
- [ ] Proper key props in lists
- [ ] Clean component structure

### CSS/Tailwind
- [ ] Use design tokens
- [ ] Consistent class ordering
- [ ] No arbitrary values (unless necessary)
- [ ] Responsive classes where needed

## Performance

### Best Practices
- [ ] Optimize images (WebP, appropriate size)
- [ ] Lazy load heavy components
- [ ] Debounce expensive operations
- [ ] Virtual scrolling for large lists
- [ ] Minimize re-renders

### Avoid
- ❌ Large gradient backgrounds
- ❌ Excessive backdrop filters
- ❌ Unoptimized images
- ❌ Blocking animations
- ❌ Expensive scroll handlers

## Git Workflow

### Commit Messages
```
✅ GOOD:
fix: correct scroll behavior in steel batches table
feat: add sentence case to all button labels
refactor: migrate to indigo accent color

❌ BAD:
fix stuff
update
changes
```

### Commit Frequency
- Commit after each logical change
- Don't commit broken code
- Test before committing
- Small, focused commits

### Branch Naming
```
✅ GOOD:
fix/scroll-ownership-steel-batches
feat/sentence-case-migration
refactor/indigo-accent-color

❌ BAD:
fix
updates
my-branch
```

## Documentation

### When to Update Docs
- Architectural changes
- New patterns introduced
- Breaking changes
- Design system changes

### What to Document
- Why the change was made
- What alternatives were considered
- How to use the new pattern
- Migration guide (if breaking)

## Review Checklist

Before requesting review:

### Visual
- [ ] Follows visual doctrine
- [ ] Sentence case (not UPPERCASE)
- [ ] Single indigo accent
- [ ] No gradient backgrounds
- [ ] Generous spacing

### Architecture
- [ ] Scroll ownership correct
- [ ] Layout stability maintained
- [ ] Responsive behavior works
- [ ] No AppShell changes (or approved)

### Code Quality
- [ ] TypeScript errors resolved
- [ ] No console errors
- [ ] Clean, readable code
- [ ] Proper component structure

### Testing
- [ ] Manual testing done
- [ ] Responsive testing done
- [ ] Accessibility checked
- [ ] Performance verified

### Documentation
- [ ] Governance docs updated (if needed)
- [ ] Code comments added (if complex)
- [ ] Commit messages clear
- [ ] PR description complete

## Common Mistakes

### Mistake 1: Not Reading Governance Docs
**Problem**: Violates established patterns
**Fix**: Read governance docs before making changes

### Mistake 2: Introducing New Patterns
**Problem**: Inconsistent with existing code
**Fix**: Match existing patterns, don't introduce new ones

### Mistake 3: Not Testing Responsively
**Problem**: Breaks on mobile or desktop
**Fix**: Test across all breakpoints

### Mistake 4: Modifying AppShell Without Approval
**Problem**: Breaks scroll ownership for entire app
**Fix**: Get approval before modifying AppShell

### Mistake 5: Using Arbitrary Values
**Problem**: Inconsistent spacing, colors, sizes
**Fix**: Use design tokens and spacing scale

## Emergency Fixes

### If Production is Broken

1. **Identify the issue**
   - Check error logs
   - Reproduce the bug
   - Identify affected files

2. **Quick fix**
   - Minimal change to fix issue
   - Test the fix
   - Deploy immediately

3. **Proper fix**
   - Understand root cause
   - Implement proper solution
   - Add tests to prevent regression
   - Update governance docs if needed

4. **Post-mortem**
   - Document what went wrong
   - Update testing checklist
   - Improve review process

## Approval Requirements

### Changes That Need Approval
1. AppShell modifications
2. Scroll ownership changes
3. Design system changes
4. Breaking changes
5. New architectural patterns

### Changes That Don't Need Approval
1. Bug fixes (following existing patterns)
2. Content changes
3. Styling changes (following design system)
4. New features (using existing patterns)

## Summary

1. **Read governance docs** before making changes
2. **Match existing patterns** - don't introduce new ones
3. **Test thoroughly** - responsive, scroll, accessibility
4. **Use design tokens** - no arbitrary values
5. **Follow visual doctrine** - sentence case, indigo accent, no gradients
6. **Respect scroll ownership** - AppShell owns page scroll
7. **Document decisions** - update governance docs
8. **Get approval** - for architectural changes
9. **Commit frequently** - small, focused commits
10. **Review checklist** - before requesting review
