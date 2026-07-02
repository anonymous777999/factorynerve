# DPR.ai Typography Governance

## 1. Font Family

| Token | Stack | Usage |
|---|---|---|
| `--font-sans` | `'IBM Plex Sans', system-ui, -apple-system, sans-serif` | Primary UI text |
| `--font-mono` | `'IBM Plex Mono', 'Fira Code', monospace` | Code, shortcuts, numeric data |
| `--font-display` | alias → `--font-sans` | Page titles, hero headings |
| `--font-numeric` | alias → `--font-sans` | Tabular figures, metrics |

**Rule:** Never override `--font-sans` or `--font-mono`. Use `font-sans`, `font-mono`, or `font-numeric` utilities. Do NOT use `font-[var(--font-*)]` — use the bare utility class instead.

---

## 2. Font Size Scale

| Utility | Token | Size | Default Line-Height | Use Case |
|---|---|---|---|---|
| `text-2xs` | `--text-2xs` | 10px | snug (1.4) | Timestamps, legal copy |
| `text-xs` | `--text-xs` | 11px | snug (1.4) | Status labels, captions |
| `text-sm` | `--text-sm` | 13px | normal (1.6) | Body text, table cells, labels |
| `text-base` | `--text-base` | 15px | normal (1.6) | Standard body copy |
| `text-md` | `--text-md` | 16px | normal (1.6) | Floor-worker body, numeric-sm |
| `text-lg` | `--text-lg` | 18px | tight (1.25) | Panel titles, subheadings |
| `text-xl` | `--text-xl` | 22px | tight (1.25) | Page titles, numeric-md |
| `text-2xl` | `--text-2xl` | 28px | tight (1.25) | Section headings |
| `text-3xl` | `--text-3xl` | 36px | none (1) | Hero numbers, numeric-lg |

**Rule:** Never use `text-[Npx]` arbitrary values. Every pixel value has a governed token:
- `text-[11px]` → `text-xs` ✓ _(migrated in Phase 1.2)_
- `text-[13px]` → `text-sm` ✓
- `text-[16px]` → `text-md` ✓
- `text-[10px]` → `text-2xs` ✓

**Values without a governed token:** `12px` (35 uses), `14px` (13 uses) — consider adding as extension tokens if usage warrants.

---

## 3. Font Weight

| Utility | Token | Value | Usage |
|---|---|---|---|
| `font-normal` | `--weight-regular` | 400 | Body text, labels |
| `font-medium` | `--weight-medium` | 500 | Interactive text, nav items |
| `font-semibold` | `--weight-semibold` | 600 | Section headers, emphasis |
| `font-bold` | `--weight-bold` | 700 | Page titles, strong emphasis |

**Rule:** Use only these four weights. Do NOT use `font-[weight]` arbitrary values. `font-bold` is governed but use sparingly — prefer `font-semibold` for most operational emphasis.

---

## 4. Line Height (Leading)

| Utility | Token | Value | Use Case |
|---|---|---|---|
| `leading-none` | `--leading-none` | 1 | Hero numbers, single-line labels |
| `leading-tight` | `--leading-tight` | 1.25 | Headings, panel titles |
| `leading-snug` | `--leading-snug` | 1.4 | Table cells, status, captions |
| `leading-comfortable` | `--leading-comfortable` | 1.5 | Dense body copy, tooltips |
| `leading-normal` | `--leading-normal` | 1.6 | Body text, paragraphs |
| `leading-relaxed` | `--leading-relaxed` | 1.65 | Long-form reading |
| `leading-loose` | `--leading-loose` | 1.75 | Spacious layouts |

**Rule:** Use the utility class directly (`leading-snug`) — not `leading-[var(--leading-snug)]` or `leading-[1.4]`.

---

## 5. Letter Spacing (Tracking)

| Utility | Token | Value | Use Case |
|---|---|---|---|
| `tracking-tighter` | `--tracking-tighter` | -0.02em | Tight headlines |
| `tracking-tight` | `--tracking-tight` | -0.01em | Compact headings |
| `tracking-normal` | `--tracking-normal` | 0 | Default body text |
| `tracking-wide` | `--tracking-wide` | 0.03em | Mild emphasis |
| `tracking-mild` | `--tracking-mild` | 0.04em | Subtle spacing |
| `tracking-nav` | `--tracking-nav` | 0.05em | Navigation items |
| `tracking-wider` | `--tracking-wider` | 0.06em | Labels, captions |
| `tracking-widest` | `--tracking-widest` | 0.08em | Section titles |
| `tracking-label` | `--tracking-label` | 0.10em | Form labels |
| `tracking-moderate` | `--tracking-moderate` | 0.12em | Button text |
| `tracking-overline` | `--tracking-overline` | 0.14em | Overline labels |
| `tracking-caption` | `--tracking-caption` | 0.16em | Caption text |
| `tracking-heading` | `--tracking-heading` | 0.18em | Section headings |
| `tracking-2xl` | `--tracking-2xl` | 0.20em | Large headings |
| `tracking-2xl-wide` | `--tracking-2xl-wide` | 0.22em | Extra-wide headings |
| `tracking-3xl` | `--tracking-3xl` | 0.24em | Hero headings |
| `tracking-3xl-wide` | `--tracking-3xl-wide` | 0.26em | Extended hero |
| `tracking-4xl` | `--tracking-4xl` | 0.28em | Maximum spacing |

**Rule:** Never use `tracking-[Npx]` or `tracking-[Nem]`. All values are governed — use the named utility class. Prefer `tracking-normal` for body text, `tracking-caption` or `tracking-overline` for status/operational labels.

---

## 6. Semantic Type Aliases

These are the **preferred** typography utilities for operational UI. They provide semantic meaning beyond raw size.

| Utility | Maps To | Pixel Size | Line Height | Usage |
|---|---|---|---|---|
| `text-table-cell` | `--type-table-cell` = `--text-base` | 15px | snug | Data table cell content |
| `text-table-header` | `--type-table-header` = `--text-sm` | 13px | snug | Data table column headers |
| `text-table-density` | `--density-font-table` | varies* | snug | Density-aware table font |
| `text-label` | `--type-label` = `--text-sm` | 13px | snug | Form labels |
| `text-label-dense` | `--type-label-dense` = `--text-xs` | 11px | snug | Compact form labels |
| `text-body` | `--type-body` = `--text-md` | 16px | normal | Paragraph body copy |
| `text-panel-title` | `--type-panel-title` = `--text-lg` | 18px | tight | Card/panel section titles |
| `text-page-title` | `--type-page-title` = `--text-xl` | 22px | tight | Page-level headings |
| `text-numeric-lg` | `--type-numeric-lg` = `--text-3xl` | 36px | none | Large metric display |
| `text-numeric-md` | `--type-numeric-md` = `--text-xl` | 22px | tight | Medium metric display |
| `text-numeric-sm` | `--type-numeric-sm` = `--text-md` | 16px | snug | Small metric display |
| `text-status` | `--type-status` = `--text-xs` | 11px | snug | Status badges, tags |
| `text-code` | `--type-code` = `--text-sm` | 13px | snug | Inline code, monospace |
| `text-timestamp` | `--type-timestamp` = `--text-xs` | 11px | snug | Dates, times, metadata |

_\* `text-table-density` varies by density mode — see Section 7 below._

**Rule:** Prefer semantic type aliases over raw size utilities for content-level typography. Use `text-body` for paragraphs, `text-label` for form fields, `text-status` for badges, etc. Reserve `text-sm`/`text-xs`/etc. for structural/layout typography.

---

## 7. Density-Aware Typography

The `--density-font-table` token changes value based on `data-density` attribute, allowing table typography to scale across density modes:

| Mode | `data-density` | `--density-font-table` | `--density-font-label` | `--density-scale` |
|---|---|---|---|---|
| **Standard** (default) | `standard` or unset | `text-base` (15px) | `text-sm` (13px) | 1 |
| **Floor** (factory floor) | `floor` | `text-md` (16px) | `text-base` (15px) | 1.2 |
| **Executive** (desktop) | `executive` | `text-sm` (13px) | `text-xs` (11px) | 0.85 |

**How to use:** Apply `text-table-density` as the utility class in table cells. It automatically scales with the density setting:

```tsx
// Table cell adapts to data-density automatically:
<td className="text-table-density">{value}</td>

// Labels adapt to density:
<label className="text-label-dense">Name</label> // 11px standard, 13px floor, 10px executive
```

**Verification:** The `@theme inline` block maps `--text-table-density` → `var(--density-font-table)`, `--text-label-dense` → `var(--type-label-dense)`, etc. All density-aware utilities are wired correctly.

---

## 8. Usage Frequency (current codebase)

| Utility | Count | Governance |
|---|---|---|
| `text-sm` | 1006 | ✓ General use |
| `text-xs` | 967 | ✓ General use |
| `text-xl` | 119 | ✓ General use |
| `text-base` | 103 | ✓ General use |
| `text-lg` | 93 | ✓ General use |
| `text-2xl` | 87 | ✓ General use |
| `text-md` | 18 | ✓ General use |
| `text-2xs` | 12 | ✓ General use |
| `text-3xl` | 10 | ✓ General use |
| `font-semibold` | 826 | ✓ Use for most emphasis |
| `font-medium` | 360 | ✓ Use for interactive text |
| `font-mono` | 126 | ✓ Use for code/monospace |
| `font-bold` | 34 | ✓ Use sparingly |
| `font-sans` | 7 | ✓ Default, rarely needed explicitly |
| `font-normal` | 3 | ✓ Default, rarely needed |
| `font-numeric` | 2 | ✓ Use for metrics |
| `text-status` | 374 | ✓ Preferred for status badges |
| `text-label-dense` | 178 | ✓ Preferred for compact labels |
| `text-body` | 62 | ✓ Preferred for prose/paragraphs |
| `text-label` | 38 | ✓ Preferred for form labels |
| `text-panel-title` | 19 | ✓ Preferred for section titles |
| `text-table-cell` | 14 | ✓ Preferred for table cells |
| `text-table-density` | 5 | ✓ Use for density-aware tables |
| `text-numeric-sm` | 5 | ✓ Preferred for small metrics |
| `text-page-title` | 1 | ✓ Preferred for page headings |

---

## 9. Reduced Motion Typography

At `@media (prefers-reduced-motion: reduce)`, animation-related typography tokens are flattened:

```css
--motion-fast: 0ms;
--motion-base: 0ms;
--motion-moderate: 0ms;
```

No font-size, weight, leading, or tracking changes occur. Typography remains stable across motion preferences.

---

## 10. Governance Rules (Summary)

| Rule | Pattern | Enforced |
|---|---|---|
| Use governed font sizes only | `text-xs` ✓ / `text-[11px]` ✗ | Partially |
| Use governed tracking only | `tracking-heading` ✓ / `tracking-[0.18em]` ✗ | ✓ |
| Use governed leading only | `leading-snug` ✓ / `leading-[1.4]` ✗ | ✓ |
| Use bare font utilities | `font-mono` ✓ / `font-[var(--font-mono)]` ✗ | ✓ |
| Use semantic aliases for content | `text-status`, `text-label`, `text-body` | Recommended |
| Use density-aware table font | `text-table-density` for dynamic tables | Recommended |
| Never use hex/rgb text colors | Use `text-text-primary` etc. | ✓ |
| Prefer `font-semibold` for emphasis | Over `font-bold` in most operational UI | Recommended |
