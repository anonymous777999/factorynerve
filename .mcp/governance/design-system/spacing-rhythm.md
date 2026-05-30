# Spacing Rhythm

## Core Principle

**Consistent spacing creates visual rhythm and hierarchy.** Use the 4px base scale for all spacing.

## Base Scale (4px)

```
--space-0:    0px
--space-0-5:  2px
--space-1:    4px
--space-1-5:  6px
--space-2:    8px
--space-2-5:  10px
--space-3:    12px
--space-3-5:  14px
--space-4:    16px
--space-5:    20px
--space-6:    24px
--space-7:    28px
--space-8:    32px
--space-9:    36px
--space-10:   40px
--space-12:   48px
--space-14:   56px
--space-16:   64px
--space-20:   80px
--space-24:   96px
```

## Semantic Spacing

### Use These in Components
```
--space-xs:   4px   (icon gaps, tight badge padding)
--space-sm:   8px   (inline gaps, compact cell padding)
--space-md:   16px  (standard element padding)
--space-lg:   24px  (section gaps, card padding)
--space-xl:   40px  (layout section separation)
--space-2xl:  64px  (page-level padding)
```

## Density System

### Default Density (Operational)
- **Row height**: 40px
- **Cell padding**: 10px horizontal, 8px vertical
- **Section gaps**: 16px
- **Card padding**: 20-24px

### Compact Density (Power Users)
- **Row height**: 36px
- **Cell padding**: 8px horizontal, 6px vertical
- **Section gaps**: 12px
- **Card padding**: 16px

### Comfortable Density (Review Mode)
- **Row height**: 48px
- **Cell padding**: 16px horizontal, 12px vertical
- **Section gaps**: 24px
- **Card padding**: 24-32px

## Component Spacing

### Buttons
- **Padding**: 12px horizontal, 8px vertical (default)
- **Gap**: 8px between buttons
- **Icon gap**: 8px between icon and text

### Form Fields
- **Label margin**: 8px below label
- **Field padding**: 12px horizontal, 8px vertical
- **Field gap**: 16px between fields
- **Helper text margin**: 4px above helper text

### Cards
- **Padding**: 20-24px (default)
- **Gap**: 16px between cards
- **Internal gap**: 16px between sections

### Tables
- **Cell padding**: 10px horizontal, 8px vertical (default)
- **Row height**: 40px (default)
- **Header padding**: 10px horizontal, 8px vertical
- **Table margin**: 24px from surrounding content

### Sections
- **Gap**: 24px between sections (default)
- **Padding**: 24px section padding
- **Margin**: 32px from page edges

### Page Layout
- **Page padding**: 24px (mobile), 32px (desktop)
- **Content max-width**: 1440px
- **Section gap**: 32-40px

## Spacing by Context

### Tight Spacing (4-8px)
- **Usage**: Icon gaps, inline elements, compact lists
- **Example**: Icon + text, badge padding, chip gaps

### Standard Spacing (12-16px)
- **Usage**: Element padding, form field gaps, card internal spacing
- **Example**: Button padding, input padding, card sections

### Generous Spacing (24-32px)
- **Usage**: Section gaps, card padding, page margins
- **Example**: Between cards, page padding, section separation

### Loose Spacing (40-64px)
- **Usage**: Major section separation, page-level spacing
- **Example**: Between major page sections, hero padding

## Vertical Rhythm

### Principle: Consistent Vertical Spacing
Use consistent vertical spacing to create visual rhythm.

### Pattern
```
Page padding: 32px
  ↓
Section gap: 24px
  ↓
Card gap: 16px
  ↓
Element gap: 8px
```

### Example
```tsx
<div className="p-8">              {/* Page padding: 32px */}
  <div className="space-y-6">      {/* Section gap: 24px */}
    <Card className="p-6">         {/* Card padding: 24px */}
      <div className="space-y-4">  {/* Element gap: 16px */}
        <h2>Title</h2>
        <p>Content</p>
      </div>
    </Card>
  </div>
</div>
```

## Horizontal Rhythm

### Principle: Consistent Horizontal Spacing
Use consistent horizontal spacing for inline elements.

### Pattern
```
Inline gap: 8px (buttons, badges, chips)
Form gap: 16px (form fields side-by-side)
Column gap: 24px (grid columns)
```

### Example
```tsx
<div className="flex gap-2">       {/* Inline gap: 8px */}
  <Button>Save</Button>
  <Button>Cancel</Button>
</div>

<div className="grid grid-cols-2 gap-6"> {/* Column gap: 24px */}
  <FormField />
  <FormField />
</div>
```

## Touch Targets

### Minimum Touch Target: 44x44px
All interactive elements must be at least 44x44px for touch.

### Button Heights
- **Compact**: 32px (desktop only)
- **Default**: 40px (touch-friendly)
- **Large**: 48px (prominent actions)

### Spacing Around Touch Targets
- **Minimum**: 8px between touch targets
- **Recommended**: 12px between touch targets

## Responsive Spacing

### Mobile (<768px)
- **Page padding**: 16-24px
- **Section gap**: 16px
- **Card padding**: 16px
- **Element gap**: 8px

### Tablet (768px-1024px)
- **Page padding**: 24-32px
- **Section gap**: 20px
- **Card padding**: 20px
- **Element gap**: 12px

### Desktop (>1024px)
- **Page padding**: 32-40px
- **Section gap**: 24px
- **Card padding**: 24px
- **Element gap**: 16px

## Anti-Patterns

### ❌ Random Spacing Values
```tsx
// WRONG - random values
<div className="p-[13px] mb-[17px] gap-[23px]">
```

**Fix**: Use spacing scale
```tsx
// CORRECT
<div className="p-3 mb-4 gap-6">
```

### ❌ Inconsistent Spacing
```tsx
// WRONG - inconsistent gaps
<div className="space-y-3">
  <Card />
  <div className="mb-5">
    <Card />
  </div>
  <div className="mt-7">
    <Card />
  </div>
</div>
```

**Fix**: Consistent spacing
```tsx
// CORRECT
<div className="space-y-4">
  <Card />
  <Card />
  <Card />
</div>
```

### ❌ Cramped Spacing
```tsx
// WRONG - too cramped
<div className="p-1 gap-1">
  <Button />
  <Button />
</div>
```

**Fix**: Generous spacing
```tsx
// CORRECT
<div className="p-4 gap-2">
  <Button />
  <Button />
</div>
```

### ❌ No Whitespace
```tsx
// WRONG - no breathing room
<div>
  <Card />
  <Card />
  <Card />
</div>
```

**Fix**: Add gaps
```tsx
// CORRECT
<div className="space-y-4">
  <Card />
  <Card />
  <Card />
</div>
```

## Implementation Examples

### Page Layout
```tsx
<div className="p-6 lg:p-8">           {/* Page padding */}
  <div className="space-y-6">          {/* Section gap */}
    <h1>Page Title</h1>
    <Card className="p-6">             {/* Card padding */}
      <div className="space-y-4">      {/* Element gap */}
        <h2>Card Title</h2>
        <p>Content</p>
      </div>
    </Card>
  </div>
</div>
```

### Form Layout
```tsx
<form className="space-y-4">           {/* Field gap */}
  <div>
    <label className="mb-2">Label</label>  {/* Label margin */}
    <input className="px-3 py-2" />        {/* Input padding */}
    <p className="mt-1 text-sm">Helper</p> {/* Helper margin */}
  </div>
</form>
```

### Button Group
```tsx
<div className="flex gap-2">           {/* Button gap */}
  <Button className="px-4 py-2">      {/* Button padding */}
    Save
  </Button>
  <Button className="px-4 py-2">
    Cancel
  </Button>
</div>
```

### Table Layout
```tsx
<div className="space-y-4">            {/* Table margin */}
  <h2>Table Title</h2>
  <table>
    <thead>
      <tr>
        <th className="px-3 py-2">     {/* Header padding */}
          Column
        </th>
      </tr>
    </thead>
    <tbody>
      <tr className="h-10">            {/* Row height */}
        <td className="px-3 py-2">     {/* Cell padding */}
          Data
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Card Grid
```tsx
<div className="grid grid-cols-3 gap-6"> {/* Card gap */}
  <Card className="p-6">                  {/* Card padding */}
    <h3>Card Title</h3>
  </Card>
</div>
```

## Validation Checklist

Before shipping spacing changes:

- [ ] Uses 4px base scale
- [ ] Consistent spacing throughout
- [ ] Generous whitespace (not cramped)
- [ ] Touch targets ≥44px
- [ ] Responsive spacing (mobile/desktop)
- [ ] Vertical rhythm is consistent
- [ ] Horizontal rhythm is consistent
- [ ] No random spacing values
- [ ] Spacing matches density mode
- [ ] Accessible spacing (not too tight)

## Reference Examples

### ✅ Good: Linear
- Consistent 4px scale
- Generous whitespace
- Clear visual rhythm
- Breathable spacing

### ✅ Good: Stripe Dashboard
- Consistent spacing
- Clear hierarchy
- Operational density
- Professional feel

### ❌ Bad: Cramped Layouts
- Inconsistent spacing
- Too tight
- Hard to scan
- Dated feel
