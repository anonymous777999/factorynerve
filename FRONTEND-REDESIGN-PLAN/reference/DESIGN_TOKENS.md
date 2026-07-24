# Design Token Contract

The tokens already exist in `web/src/app/globals.css`. This is the canonical list plus the
decisions the redesign locks in. Treat this as the API for styling. If you need a value that
isn't here, add a token — don't inline a literal.

## Source of truth
- `:root { ... }` in `web/src/app/globals.css` defines the raw values.
- `@theme inline { ... }` maps them into Tailwind v4 utilities.
- `web/tailwind.config.ts` exposes `base/card/text/muted/accent` + `shadow-soft`.

## Color (DECISION: warm clay is the single accent; blue is removed)
| Token | Value | Use |
|---|---|---|
| `--bg` / `--bg-soft` | `#0d1218` / `#151d24` | page background layers |
| `--card` / `--card-strong` / `--card-elevated` | `#172028` / `#202b35` / `#253528` | surfaces |
| `--border` / `--border-strong` | `rgba(171,154,137,.2)` / `rgba(201,180,157,.34)` | hairlines |
| `--text` | `#ece7df` | primary text |
| `--muted` | **RAISE to >=4.5:1 on `--card`** (Phase 1) | secondary text |
| `--accent` / `--accent-strong` | `#c56d2d` / `#8c4218` | THE accent (buttons, active, focus) |
| `--accent-soft` / `--accent-quiet` | rgba clay .18 / .10 | tints, hovers |
| `--signal` `--success` `--warning` `--danger` | teal / green / amber / red | status only |

**Removed:** all `#5ba8ff`, `#89bcf8`, `#8ec4ff`, `#82c0ff`, `rgba(47,125,255,*)`,
`rgba(62,166,255,*)` and other blues. Replace with accent tokens.

## Spacing (8px base) — use `--space-*` or Tailwind steps
`--space-1:8` `--space-2:16` `--space-3:24` `--space-4:32` `--space-5:48` `--space-6:64`.
Prefer Tailwind `gap-2/4/6/8` etc. mapped to this rhythm. No arbitrary `p-[13px]`.

## Radius
`--radius-sm:.75rem` `md:1rem` `lg:1.5rem` `xl:2rem` `card:1.7rem` `section:2rem` `full:9999px`.
Cards use `rounded-card`; pills use `rounded-full`; inputs use `rounded-md`.

## Typography scale (DECISION: enforce this, kill the 321 arbitrary sizes)
| Role | Size (mobile -> desktop) | Notes |
|---|---|---|
| display | `text-3xl` -> `text-5xl` | Space Grotesk, tracking-tight |
| h1 | `text-2xl` -> `text-3xl` | |
| h2 | `text-xl` -> `text-2xl` | |
| h3 | `text-lg` -> `text-xl` | |
| body | `text-sm` -> `text-base` | **min 14px on mobile** |
| caption | `text-xs` | reserve `text-[10px]/[11px]` for non-essential meta only |
- Fonts: `--font-body` IBM Plex Sans, `--font-display` Space Grotesk.
  Phase 1 moves these from CSS `@import` to `next/font`.
- Dial back uppercase + wide tracking; reserve `--tracking-*` for short labels, not body.

## Shadow / elevation
`--shadow-md`, `--shadow-lg`, `shadow-soft`. No new inline box-shadows with raw rgba.

## Z-index scale (DECISION: define, to fix FAB/tooltip overlap)
Add tokens (Phase 3): `--z-base:0` `--z-rail:10` `--z-header:30` `--z-drawer:40`
`--z-fab:45` `--z-overlay:50` `--z-toast:60`. Everything floating references these.

## Breakpoints (align JS to Tailwind)
`sm:640` `md:768` `lg:1024` (sidebar) `xl:1280` (context rail). One `useMediaQuery` hook for
JS branches; never re-hardcode `innerWidth < 1024`.
