# Typography Rules

## Font Family

### Primary: Inter
- **Usage**: All UI text (labels, buttons, body, headings)
- **Why**: Modern, readable, operational, professional
- **Weights**: 400 (regular), 500 (medium), 600 (semibold)

### Monospace: JetBrains Mono
- **Usage**: Code, IDs, technical data, timestamps
- **Why**: Clear distinction, tabular alignment
- **NOT for**: UI labels, buttons, headings, body text

### Forbidden Fonts
- ❌ IBM Plex Sans (dated, too warm)
- ❌ Space Grotesk (too decorative)
- ❌ System fonts (inconsistent)

## Case Rules

### Sentence Case (Default)
**Usage**: All UI text
- Labels: "Factory name"
- Buttons: "Save changes"
- Headings: "Steel batches"
- Menu items: "User settings"

### lowercase
**Usage**: Technical identifiers, code
- IDs: "batch_id", "user_123"
- Code: `const userName = "John"`
- URLs: "/steel/batches"

### UPPERCASE
**FORBIDDEN** except for:
- Acronyms: OCR, API, ID, PDF
- Technical constants: `const MAX_RETRIES = 3`
- Keyboard shortcuts: CMD, CTRL, ALT

### Examples

✅ **Correct**:
- "Review pending approvals"
- "Steel batch created"
- "OCR verification"
- "Press CMD+K to open"

❌ **Incorrect**:
- "REVIEW PENDING APPROVALS"
- "Steel Batch Created"
- "Ocr Verification"
- "Press cmd+k to open"

## Size Scale (Operational)

### Micro (10px)
- **Usage**: Badge text, count indicators, micro labels
- **Line height**: 1.2
- **Weight**: 600 (semibold)
- **Example**: Badge counts, notification dots

### Extra Small (11px)
- **Usage**: Table metadata, timestamps, secondary badges
- **Line height**: 1.35
- **Weight**: 400 (regular) or 500 (medium)
- **Example**: "Updated 2 hours ago", table footer text

### Small (12px)
- **Usage**: Secondary labels, helper text, captions
- **Line height**: 1.5
- **Weight**: 400 (regular) or 500 (medium)
- **Example**: Form helper text, table column headers

### Base (13px)
- **Usage**: Table cell text (operational default)
- **Line height**: 1.35
- **Weight**: 400 (regular)
- **Example**: Data table cells, dense operational text

### Medium (14px) - Primary Body
- **Usage**: Primary body text, form labels
- **Line height**: 1.5
- **Weight**: 400 (regular) or 500 (medium)
- **Example**: Form labels, descriptions, body paragraphs

### Large (16px)
- **Usage**: Panel headings, workflow titles
- **Line height**: 1.2
- **Weight**: 600 (semibold)
- **Example**: Card titles, section headings

### Extra Large (18px)
- **Usage**: Page titles, section titles
- **Line height**: 1.2
- **Weight**: 600 (semibold)
- **Example**: Page headings, modal titles

### 2XL (22px)
- **Usage**: Modal titles, major headings
- **Line height**: 1.2
- **Weight**: 600 (semibold)
- **Example**: Dialog titles, major section headings

### 3XL (28px)
- **Usage**: KPI numbers, dashboard metrics
- **Line height**: 1
- **Weight**: 600 (semibold)
- **Example**: Large numbers, key metrics

## Line Height

### None (1.0)
- **Usage**: Large numbers, KPIs
- **Example**: Dashboard metrics

### Tight (1.2)
- **Usage**: Headings, titles
- **Example**: Page titles, card headings

### Snug (1.35)
- **Usage**: Dense table rows, operational text
- **Example**: Table cells, compact lists

### Normal (1.5)
- **Usage**: Body text, descriptions
- **Example**: Form labels, paragraphs

### Relaxed (1.65)
- **Usage**: Long-form text, help text
- **Example**: Documentation, descriptions

## Font Weight

### Regular (400)
- **Usage**: Body text, table cells, descriptions
- **Example**: Paragraphs, data values

### Medium (500)
- **Usage**: Labels, secondary headings, emphasis
- **Example**: Form labels, table headers

### Semibold (600)
- **Usage**: Headings, buttons, primary emphasis
- **Example**: Page titles, button text, card headings

### Forbidden Weights
- ❌ 300 (too light, hard to read)
- ❌ 700+ (too heavy, aggressive)

## Letter Spacing

### Normal (0)
- **Usage**: All body text, headings, labels
- **Example**: 99% of UI text

### Wide (0.03em)
- **Usage**: Table headers (12px, uppercase)
- **Example**: Column headers in tables

### Wider (0.06em)
- **Usage**: Micro labels (10px, uppercase)
- **Example**: Badge labels, status indicators

### Forbidden
- ❌ 0.18em or higher (too spaced, hard to read)
- ❌ Letter spacing on body text (unnecessary)

## Tabular Numbers

### When to Use
- Tables with numeric data
- KPI dashboards
- Financial data
- Timestamps
- IDs

### How to Use
```css
font-variant-numeric: tabular-nums;
```

### Example
```tsx
<span className="font-mono tabular-nums">
  1,234.56
</span>
```

## Typography Tokens

### Semantic Tokens (Use These)
```css
--type-table-cell: 13px;      /* Table cell text */
--type-table-header: 12px;    /* Table column headers */
--type-label: 12px;           /* Form labels */
--type-label-dense: 11px;     /* Compact labels */
--type-body: 14px;            /* Primary body text */
--type-panel-title: 16px;     /* Card/panel headings */
--type-page-title: 18px;      /* Page headings */
--type-numeric-lg: 28px;      /* Large KPI numbers */
--type-numeric-md: 18px;      /* Medium numbers */
--type-numeric-sm: 14px;      /* Small numbers */
--type-status: 11px;          /* Status badges */
--type-code: 12px;            /* Code snippets */
--type-timestamp: 11px;       /* Timestamps */
```

## Component-Specific Rules

### Buttons
- **Size**: 14px
- **Weight**: 600 (semibold)
- **Case**: Sentence case
- **Example**: "Save changes", "Create batch"

### Form Labels
- **Size**: 14px
- **Weight**: 500 (medium)
- **Case**: Sentence case
- **Example**: "Factory name", "Batch number"

### Table Headers
- **Size**: 12px
- **Weight**: 500 (medium)
- **Case**: Sentence case
- **Letter spacing**: 0.03em (optional)
- **Example**: "Batch ID", "Created at"

### Table Cells
- **Size**: 13px
- **Weight**: 400 (regular)
- **Case**: Sentence case (or data-appropriate)
- **Example**: "Steel batch 123", "1,234.56 kg"

### Badges
- **Size**: 10-11px
- **Weight**: 600 (semibold)
- **Case**: Sentence case
- **Example**: "Pending", "Verified"

### Page Titles
- **Size**: 18px
- **Weight**: 600 (semibold)
- **Case**: Sentence case
- **Example**: "Steel batches", "User settings"

### Card Headings
- **Size**: 16px
- **Weight**: 600 (semibold)
- **Case**: Sentence case
- **Example**: "Recent activity", "Quick actions"

### Helper Text
- **Size**: 12px
- **Weight**: 400 (regular)
- **Case**: Sentence case
- **Color**: Secondary text
- **Example**: "This field is required"

## Accessibility

### Minimum Sizes
- **Body text**: 14px minimum
- **Table text**: 13px minimum (operational exception)
- **Helper text**: 12px minimum
- **Never**: Below 10px

### Contrast
- **Primary text**: 4.5:1 minimum contrast
- **Secondary text**: 4.5:1 minimum contrast
- **Disabled text**: 3:1 minimum contrast

### Line Length
- **Optimal**: 50-75 characters per line
- **Maximum**: 90 characters per line
- **Use**: `max-w-prose` for long-form text

## Anti-Patterns

### ❌ UPPERCASE EVERYWHERE
```tsx
// WRONG
<button>SAVE CHANGES</button>
<h1>STEEL BATCHES</h1>
<label>FACTORY NAME</label>
```

**Fix**: Use sentence case
```tsx
// CORRECT
<button>Save changes</button>
<h1>Steel batches</h1>
<label>Factory name</label>
```

### ❌ Monospace for UI Text
```tsx
// WRONG
<button className="font-mono">Save Changes</button>
<h1 className="font-mono">Steel Batches</h1>
```

**Fix**: Use Inter for UI
```tsx
// CORRECT
<button className="font-sans">Save changes</button>
<h1 className="font-sans">Steel batches</h1>
```

### ❌ Excessive Letter Spacing
```tsx
// WRONG
<p className="tracking-[0.18em]">Body text with too much spacing</p>
```

**Fix**: Use normal letter spacing
```tsx
// CORRECT
<p>Body text with normal spacing</p>
```

### ❌ Tiny Body Text
```tsx
// WRONG
<p className="text-[11px]">Primary body text</p>
```

**Fix**: Use 14px for body
```tsx
// CORRECT
<p className="text-[14px]">Primary body text</p>
```

### ❌ Multiple Font Families
```tsx
// WRONG
<div>
  <h1 className="font-display">Heading</h1>
  <p className="font-body">Body</p>
  <code className="font-mono">Code</code>
</div>
```

**Fix**: Use Inter for UI, mono for code only
```tsx
// CORRECT
<div>
  <h1 className="font-sans">Heading</h1>
  <p className="font-sans">Body</p>
  <code className="font-mono">code</code>
</div>
```

## Implementation Examples

### Page Title
```tsx
<h1 className="text-[18px] font-semibold text-text-primary">
  Steel batches
</h1>
```

### Card Heading
```tsx
<h2 className="text-[16px] font-semibold text-text-primary">
  Recent activity
</h2>
```

### Body Text
```tsx
<p className="text-[14px] text-text-primary leading-normal">
  This is primary body text with normal line height.
</p>
```

### Form Label
```tsx
<label className="text-[14px] font-medium text-text-primary">
  Factory name
</label>
```

### Helper Text
```tsx
<p className="text-[12px] text-text-secondary">
  This field is required
</p>
```

### Table Header
```tsx
<th className="text-[12px] font-medium text-text-secondary tracking-wide">
  Batch ID
</th>
```

### Table Cell
```tsx
<td className="text-[13px] text-text-primary">
  Steel batch 123
</td>
```

### Badge
```tsx
<span className="text-[11px] font-semibold">
  Pending
</span>
```

### KPI Number
```tsx
<span className="text-[28px] font-semibold tabular-nums">
  1,234
</span>
```

### Timestamp
```tsx
<time className="text-[11px] font-mono tabular-nums text-text-tertiary">
  2024-01-15 14:30
</time>
```

## Validation Checklist

Before shipping typography changes:

- [ ] Font family: Inter for UI, JetBrains Mono for code only
- [ ] Case: Sentence case (not UPPERCASE)
- [ ] Size: 14px body, 13px tables, 18px page titles
- [ ] Weight: 400 body, 500 labels, 600 headings
- [ ] Line height: 1.5 body, 1.35 tables, 1.2 headings
- [ ] Letter spacing: Normal (0) for body, wide for headers only
- [ ] Tabular numbers: For numeric data in tables
- [ ] Contrast: 4.5:1 minimum for body text
- [ ] Accessibility: Minimum 12px (except badges)
- [ ] Consistency: Matches design tokens
