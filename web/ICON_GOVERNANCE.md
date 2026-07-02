# DPR.ai Icon Governance

> Version 1.0 — Generated from codebase audit (June 2026)

---

## 1. Icon Library

The codebase uses **[lucide-react](https://lucide.dev/icons)** v1.16+ as the sole icon library. All UI icons must be imported from `lucide-react`.

```tsx
import { Lock, Mail, ShieldCheck } from "lucide-react";
```

**Rule:** Do NOT add alternative icon libraries (FontAwesome, Heroicons, Phosphor, etc.). lucide-react provides consistent stroke-based icons that align with the DPR.ai visual system.

---

## 2. AppIcon Wrapper

All icons should be rendered through the `AppIcon` wrapper component, which enforces size and stroke-width governance:

```tsx
import { AppIcon } from "@/shared/primitives";
import { Lock } from "lucide-react";

// ✅ Correct — uses governed sizing
<AppIcon icon={Lock} size="md" tone="primary" />

// ❌ Avoid — bypasses governance
<Lock size={16} className="h-4 w-4 text-text-secondary" />
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `icon` | `LucideIcon` | required | lucide-react icon component |
| `size` | `"xs" \| "sm" \| "md" \| "lg" \| "xl" \| "2xl"` | `"md"` | Governed size token |
| `strokeWidth` | `1 \| 1.5 \| 2` | `1.5` | Governed stroke width |
| `tone` | `"default" \| "primary" \| "teal" \| "success" \| "warning" \| "danger" \| "info" \| "muted" \| "inverse"` | `"default"` | Semantic color via token |
| `className` | string | — | Additional classes (width/height overrides) |
| `...props` | SVGAttributes | — | Forwarded to the icon element |

---

## 3. Size Governance

| Token | Pixels | Tailwind Class | Use Case |
|---|---|---|---|
| `xs` | 12 | `h-3 w-3` | Inline with caption text, small status dots |
| `sm` | 14 | `h-3.5 w-3.5` | Badge indicators, compact table icons |
| `md` | 16 | `h-4 w-4` | **Standard** — buttons, navigation, form controls |
| `lg` | 18 | `h-[18px]` | Panel headers, sidebar nav items |
| `xl` | 20 | `h-5 w-5` | Page headers, hero areas, large buttons |
| `2xl` | 24 | `h-6 w-6` | Empty states, modal illustrations, feature icons |

**Rule:** Prefer `md` (16px) for most UI. Use `sm` for dense areas, `lg`/`xl` for headings. Never use arbitrary pixel values (e.g., `size={14}`, `size={18}`).

### Current size audit

| Size | Usage Count | Status |
|---|---|---|
| `size={14}` (sm) | 6 | ✅ Matches `sm` governance |
| `size={18}` (lg) | 3 | ✅ Matches `lg` governance |
| `size={16}` (md) | 1 | ✅ Matches `md` governance |
| `size={12}` (xs) | 1 | ✅ Matches `xs` governance |
| `className="h-4 w-4"` | ~10 | ⚠️ Should use `<AppIcon size="md">` |
| `className="h-5 w-5"` | ~3 | ⚠️ Should use `<AppIcon size="xl">` |

---

## 4. Stroke Width Governance

| Width | Use Case |
|---|---|
| `2` | Small icons (xs, sm) — keeps lines crisp |
| `1.5` | **Default** — standard UI icons at md size |
| `1` | Large icons (2xl) — lighter, more elegant feel |

**Rule:** Default `strokeWidth={1.5}` for all standard icons. Use `strokeWidth={2}` only for `xs`/`sm` icons. Use `strokeWidth={1}` only for `2xl` icons.

---

## 5. Semantic Tone

| Tone | Token | Visual | Use Case |
|---|---|---|---|
| `default` | `--text-secondary` | Medium gray | Standard UI icons |
| `primary` | `--text-primary` | High contrast | Active/navigation icons |
| `teal` | `--teal-500` | Accent teal | Brand-aligned icons |
| `success` | `--status-success-icon` | Green | Success states |
| `warning` | `--status-warning-icon` | Amber | Warning states |
| `danger` | `--status-danger-icon` | Red | Error/destructive states |
| `info` | `--status-info-icon` | Blue | Informational states |
| `muted` | `--text-tertiary` | Low contrast | Disabled/de-emphasized |
| `inverse` | `--text-inverse` | White | On dark surfaces |

**Rule:** Use `tone` instead of `className="text-xxx"` for semantic colors. Reserve `className` for positioning/layout overrides.

---

## 6. Accessibility

| Rule | Implementation |
|---|---|
| All decorative icons MUST have `aria-hidden="true"` | `AppIcon` applies this automatically |
| Icons MUST never be used without text context | If text is absent, add `aria-label` to parent |
| Interactive icon labels MUST use `aria-label` | `<button aria-label="Close"><AppIcon icon={X} /></button>` |
| Status icons MUST be paired with screen-reader text | `<AppIcon icon={CheckCircle} /> <span className="sr-only">Verified</span>` |

---

## 7. Migration Pattern

### Current pattern (direct usage — replace gradually):
```tsx
// Before
import { Lock } from "lucide-react";
<Lock className="h-4 w-4 text-text-secondary" aria-hidden="true" />

// After
import { AppIcon } from "@/shared/primitives";
import { Lock } from "lucide-react";
<AppIcon icon={Lock} size="md" tone="default" />
```

### With explicit size prop:
```tsx
// Before
<Mail size={14} className="text-text-secondary" aria-hidden="true" />

// After
<AppIcon icon={Mail} size="sm" tone="default" />
```

---

## 8. Top Icons by Usage

| Icon | Count | Common Context |
|---|---|---|
| `Lock` | 7 | Auth pages, permission indicators |
| `ShieldCheck` | 6 | Security badges, verification |
| `Mail` | 6 | Email fields, notifications |
| `AlertTriangle` | 4 | Warnings, error banners |
| `PanelLeftClose` / `PanelLeft` | 4 | Sidebar toggles |
| `KeyRound` | 2 | API keys, auth tokens |
| `Eye` / `EyeOff` | 2 | Password visibility toggles |
| `ChevronRight` / `ChevronLeft` | 2 | Navigation, expand/collapse |
| `CheckCircle2` | 2 | Success confirmations |
| `Building2` | 2 | Factory/entity selectors |
| `ArrowUpDown` / `ArrowUp` / `ArrowDown` | 6 | Sort indicators, trends |

---

## 9. Governance Rules (Summary)

| Rule | Pattern |
|---|---|
| Use only lucide-react | `import { Icon } from "lucide-react"` |
| Use AppIcon wrapper | `<AppIcon icon={Icon} size="md" />` |
| Use governed sizes only | `xs`/`sm`/`md`/`lg`/`xl`/`2xl` — no raw numbers |
| Default strokeWidth 1.5 | Adjust to 2 for small, 1 for large |
| Use tone prop for color | Not `className="text-xxx"` |
| aria-hidden="true" by default | Applied automatically by AppIcon |
| Pair with text or aria-label | Never render icons in isolation |
| No hardcoded sizes | No `h-4 w-4` or `size={16}` directly on lucide icons |
