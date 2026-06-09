# Scroll Ownership

## Core Principle

**One scroll owner per context.** Scroll ownership must be explicit, predictable, and stable.

## Scroll Hierarchy

```
Application Level
├── AppShell owns page scroll (.factory-workstation-frame)
│
Page Level
├── Page receives scroll container from AppShell
├── Page does NOT create its own scroll container
│
Component Level
├── Tables can have independent scroll (virtualized)
├── Modals can have independent scroll (overlay)
├── Drawers can have independent scroll (overlay)
└── Dropdowns can have independent scroll (small lists)
```

## Rules

### Rule 1: AppShell Owns Page Scroll
- `.factory-workstation-frame` is THE page scroll container
- Pages render INTO this container
- Pages do NOT create their own scroll containers
- Exception: Nested scrollable components (tables, modals)

### Rule 2: One Scroll Container Per Context
- Page content: AppShell's scroll container
- Table content: Table's scroll container
- Modal content: Modal's scroll container
- Drawer content: Drawer's scroll container

### Rule 3: Explicit Height Containment
- All scroll containers MUST have explicit height
- Use `h-[calc(100dvh-200px)]` or similar
- Never rely on implicit height

### Rule 4: Flex Children Need min-h-0
- Flex children that scroll MUST have `min-h-0`
- This allows flex child to shrink below content size
- Without it, flex child won't respect scroll container

## Scroll Container Patterns

### ✅ Pattern 1: Page Content (No Scroll)
```tsx
// Page renders into AppShell's scroll container
export function MyPage() {
  return (
    <div className="p-6">
      <h1>Page Title</h1>
      <div>Content that scrolls with page</div>
    </div>
  );
}
```

### ✅ Pattern 2: Table with Independent Scroll
```tsx
// Table has its own scroll container
export function MyPage() {
  return (
    <div className="p-6">
      <h1>Page Title</h1>
      <div className="h-[calc(100dvh-200px)] overflow-y-auto">
        <DataTable /> {/* Scrolls independently */}
      </div>
    </div>
  );
}
```

### ✅ Pattern 3: Flex Layout with Scrolling Child
```tsx
// Flex child with scroll needs min-h-0
export function MyPage() {
  return (
    <div className="flex flex-col h-screen">
      <div className="flex-none">
        <h1>Fixed Header</h1>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DataTable /> {/* Scrolls */}
      </div>
    </div>
  );
}
```

### ✅ Pattern 4: Modal with Independent Scroll
```tsx
// Modal has its own scroll container
export function MyModal() {
  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="bg-white rounded-lg max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <h2>Modal Title</h2>
          <div>Long content that scrolls</div>
        </div>
      </div>
    </div>
  );
}
```

## Anti-Patterns

### ❌ Anti-Pattern 1: Page Creates Scroll Container
```tsx
// WRONG - page trying to own scroll
export function MyPage() {
  return (
    <div className="h-screen overflow-y-auto"> {/* DON'T DO THIS */}
      <div>Content</div>
    </div>
  );
}
```

**Why It's Wrong**: Conflicts with AppShell's scroll container, breaks sticky headers

**Fix**: Remove scroll container, let AppShell handle it

### ❌ Anti-Pattern 2: Nested Scroll Without Height
```tsx
// WRONG - scroll container without height
export function MyPage() {
  return (
    <div className="overflow-y-auto"> {/* No height! */}
      <DataTable />
    </div>
  );
}
```

**Why It's Wrong**: Scroll container has no height constraint, won't scroll

**Fix**: Add explicit height `h-[calc(100dvh-200px)]`

### ❌ Anti-Pattern 3: Flex Child Without min-h-0
```tsx
// WRONG - flex child won't scroll
export function MyPage() {
  return (
    <div className="flex flex-col h-screen">
      <div className="overflow-y-auto"> {/* Missing min-h-0! */}
        <DataTable />
      </div>
    </div>
  );
}
```

**Why It's Wrong**: Flex child won't shrink, scroll won't work

**Fix**: Add `min-h-0` to flex child

### ❌ Anti-Pattern 4: Multiple Scroll Containers
```tsx
// WRONG - nested scroll containers
export function MyPage() {
  return (
    <div className="h-screen overflow-y-auto">
      <div className="h-[500px] overflow-y-auto">
        <DataTable />
      </div>
    </div>
  );
}
```

**Why It's Wrong**: Confusing scroll behavior, poor UX

**Fix**: Single scroll container per context

## Sticky Elements and Scroll

### Rule: Sticky Needs Scroll Context
Sticky elements need a scroll container to stick within:

```tsx
// ✅ Good - sticky within scroll container
<div className="overflow-y-auto">
  <div className="sticky top-0 bg-white">
    <h1>Sticky Header</h1>
  </div>
  <div>Content that scrolls</div>
</div>

// ❌ Bad - sticky without scroll context
<div>
  <div className="sticky top-0 bg-white">
    <h1>Won't stick!</h1>
  </div>
  <div>Content</div>
</div>
```

### AppShell Sticky Behavior
- `.factory-workstation-topbar` is sticky within `.factory-workstation-frame` scroll
- Table headers are sticky within table scroll container
- Sidebar is fixed (not sticky) - doesn't scroll with page

## Responsive Scroll Behavior

### Desktop
- Page scrolls in `.factory-workstation-frame`
- Sidebar fixed, independent scroll
- Tables can have independent scroll

### Mobile
- Page scrolls in `.factory-workstation-frame`
- Sidebar overlay (fixed position)
- Tables can have independent scroll
- Bottom nav fixed

### Rule
- Scroll ownership must be consistent across breakpoints
- Responsive changes must preserve scroll architecture

## Virtual Scrolling

### When to Use
- Large tables (>1000 rows)
- Long lists (>500 items)
- Performance-critical scrolling

### Pattern
```tsx
// Virtual scroll container
<div className="h-[calc(100dvh-200px)] overflow-y-auto">
  <VirtualizedTable
    data={largeDataset}
    rowHeight={40}
  />
</div>
```

### Rules
- Virtual scroll container still needs explicit height
- Virtual scroll is independent of page scroll
- Virtual scroll must be smooth (60fps)

## Scroll Performance

### Best Practices
1. **Explicit height** - Always set explicit height on scroll containers
2. **GPU acceleration** - Use `transform` and `opacity` for animations
3. **Avoid layout thrashing** - Batch DOM reads/writes
4. **Debounce scroll handlers** - Don't run expensive code on every scroll event
5. **Virtual scrolling** - For large datasets

### Performance Checklist
- [ ] Scroll is smooth (60fps)
- [ ] No jank on scroll
- [ ] No layout shift on scroll
- [ ] Virtual scrolling for large tables
- [ ] Debounced scroll handlers

## Testing Scroll Behavior

### Manual Testing
1. **Page scroll**: Scroll page, verify header stays fixed
2. **Table scroll**: Scroll table, verify independent of page scroll
3. **Sticky headers**: Scroll page, verify headers stick
4. **Mobile**: Test on mobile, verify scroll works
5. **Resize**: Resize window, verify scroll still works

### Automated Testing
```tsx
// Test scroll container exists
expect(screen.getByTestId('scroll-container')).toHaveClass('overflow-y-auto');

// Test explicit height
expect(screen.getByTestId('scroll-container')).toHaveStyle({ height: 'calc(100dvh - 200px)' });

// Test sticky element
expect(screen.getByTestId('sticky-header')).toHaveClass('sticky');
```

## Debugging Scroll Issues

### Symptom: Page Won't Scroll
**Possible Causes**:
1. `.factory-workstation-frame` missing `overflow-y-auto`
2. Content shorter than viewport
3. Page creating its own scroll container

**Debug Steps**:
1. Check `.factory-workstation-frame` has `overflow-y-auto`
2. Check content is taller than viewport
3. Check no page-level scroll containers

### Symptom: Sticky Element Won't Stick
**Possible Causes**:
1. No scroll container
2. Sticky element outside scroll container
3. Parent has `overflow: hidden`

**Debug Steps**:
1. Check sticky element is inside scroll container
2. Check parent doesn't have `overflow: hidden`
3. Check scroll container has `overflow-y-auto`

### Symptom: Flex Child Won't Scroll
**Possible Causes**:
1. Missing `min-h-0` on flex child
2. No explicit height on scroll container
3. Flex parent not tall enough

**Debug Steps**:
1. Add `min-h-0` to flex child
2. Add explicit height to scroll container
3. Check flex parent has height

### Symptom: Nested Scroll Confusion
**Possible Causes**:
1. Multiple scroll containers
2. Unclear scroll ownership
3. Conflicting scroll behavior

**Debug Steps**:
1. Remove nested scroll containers
2. Single scroll container per context
3. Explicit height on scroll containers

## Reference Examples

### Example 1: Simple Page (No Independent Scroll)
```tsx
export function SimplePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Page Title</h1>
      <p>Content that scrolls with page</p>
    </div>
  );
}
```

### Example 2: Page with Table (Independent Scroll)
```tsx
export function TablePage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Table Page</h1>
      <div className="h-[calc(100dvh-200px)] overflow-y-auto">
        <DataTable data={data} />
      </div>
    </div>
  );
}
```

### Example 3: Flex Layout with Scrolling Child
```tsx
export function FlexPage() {
  return (
    <div className="flex flex-col h-screen">
      <div className="flex-none p-6">
        <h1 className="text-2xl font-semibold">Fixed Header</h1>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <DataTable data={data} />
      </div>
    </div>
  );
}
```

### Example 4: Modal with Scroll
```tsx
export function ScrollableModal() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold">Modal Title</h2>
          <div className="mt-4">
            <p>Long content that scrolls...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Summary

1. **AppShell owns page scroll** - Pages render into it
2. **One scroll container per context** - No nested scroll confusion
3. **Explicit height containment** - All scroll containers need height
4. **Flex children need min-h-0** - To respect scroll containers
5. **Sticky needs scroll context** - Sticky elements need scroll container
6. **Test scroll behavior** - Manual and automated testing
7. **Debug systematically** - Check height, overflow, flex, sticky
