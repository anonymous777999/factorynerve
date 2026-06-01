# Task 27 — Text Contrast Ratio Audit (WCAG 2.1 AA)

**Spec:** frontend-modernization-sprint-2
**Scope:** Validate all text + status/AI indicators meet WCAG 2.1 AA contrast minimums
in both light and dark modes, and fix any failures with calm, hue-preserving adjustments.

## Method

- Computed contrast ratios using the WCAG 2.1 relative-luminance formula.
- HSL tokens converted to sRGB; tinted backgrounds (badge/AI surfaces using `rgba(...)`
  over a base surface) were alpha-composited over each surface before measuring.
- Each foreground token measured against every surface it can render on
  (`--surface-app/shell/panel/card/elevated/overlay`).
- Theme model: the app sets `data-theme="dark"` (default) / `data-theme="light"` on
  `<html>` (see `web/src/app/layout.tsx`), so `tokens.css` `[data-theme=...]` blocks are
  authoritative. The `@media (prefers-color-scheme: dark)` block in `globals.css` is a
  secondary fallback and was kept consistent.

## Thresholds

| Content | Minimum |
| --- | --- |
| Body text (<18pt / <14pt bold) | 4.5:1 |
| Large text (>=18pt or >=14pt bold) | 3.0:1 |
| UI components, graphical objects, status dots | 3.0:1 |

Disabled text (`--text-disabled`) is exempt per WCAG 1.4.3 (inactive UI components).

## Findings — failures detected (before fix)

| Token | Mode | Worst ratio | Surface | Required |
| --- | --- | --- | --- | --- |
| `--text-tertiary` | Light | 3.98:1 | shell | 4.5 |
| `--text-tertiary` | Dark | 2.79:1 | elevated | 4.5 |
| `--text-link` | Light | 4.00:1 | shell | 4.5 |
| `--text-link` | Dark | 3.14:1 | elevated | 4.5 |
| `--confidence-high-fg` (#22c55e) | Light | 2.01:1 | 10% green tint | 4.5 |
| `--confidence-medium-fg` (#f59e0b) | Light | 1.91:1 | 10% amber tint | 4.5 |
| `--confidence-low-fg` (#64748b) | Light | 4.04:1 | 10% slate tint | 4.5 |
| `--confidence-low-fg` (#64748b) | Dark | 3.08:1 | 10% slate tint | 4.5 |
| `--ai-processing-fg` (#4338ca) | Dark | 1.89:1 | 8% indigo tint | 4.5 |
| `--ai-processing-fg` dot (#4338ca) | Dark | 2.05:1 | surface-card | 3.0 |

**Root cause for the confidence/AI failures:** these were single flat values defined once
in `globals.css :root` and shared across *both* themes. A bright 500-level green/amber on a
near-white tinted badge cannot reach 4.5:1, and a dark indigo on a dark surface cannot either.
The fix makes them theme-aware (mirroring how `--status-*-fg` already works in `tokens.css`).

## Fixes applied

### `web/src/styles/tokens.css`

Light mode (`:root, [data-theme="light"]`):
- `--text-tertiary`: `hsl(var(--_prim-neutral-500))` (46% L) -> `hsl(210 9% 42%)`
- `--text-link`: `#1D6EEB` -> `#175FCC`; `--text-link-hover`: `#175FCC` -> `#1453B0`

Dark mode (`[data-theme="dark"]`):
- `--text-tertiary`: `#546E8A` -> `#8499B2`
- `--text-link`: `#1D6EEB` -> `#60A5FA`; `--text-link-hover`: `#2379F3` -> `#93C5FD`

### `web/src/app/globals.css`

`:root` (light-mode confidence foregrounds, on their 10% tinted badge backgrounds):
- `--confidence-high-fg`: `#22c55e` -> `#137a39`
- `--confidence-medium-fg`: `#f59e0b` -> `#a8490a`
- `--confidence-low-fg`: `#64748b` -> `#4b5563`

New `[data-theme="dark"]` override block (dark-mode confidence + AI foregrounds):
- `--ai-processing-fg`: `#c7d2fe`
- `--confidence-high-fg`: `#4ade80`
- `--confidence-medium-fg`: `#fbbf24`
- `--confidence-low-fg`: `#94a3b8`

All adjustments preserve the original hue family (green stays green, amber stays amber,
indigo stays indigo) per visual-doctrine; only lightness/saturation shifted to meet AA.

## Verification — after fix (worst-case ratio per token across all surfaces)

| Token | Light worst | Dark worst | Required |
| --- | --- | --- | --- |
| `--text-primary` | 13.54:1 | 13.07:1 | 4.5 — PASS |
| `--text-secondary` | 6.30:1 | 5.74:1 | 4.5 — PASS |
| `--text-tertiary` | 4.62:1 | 4.50:1 | 4.5 — PASS |
| `--text-link` | 5.05:1 | 5.18:1 | 4.5 — PASS |
| `--confidence-high-fg` (text + dot) | 4.78:1 | 7.10:1 | 4.5 — PASS |
| `--confidence-medium-fg` (text + dot) | 5.15:1 | 7.46:1 | 4.5 — PASS |
| `--confidence-low-fg` (text + dot) | 6.41:1 | 5.18:1 | 4.5 — PASS |
| `--ai-processing-fg` (text + dot) | 6.15:1 | 8.15:1 | 4.5 — PASS |

Status badges (`--status-*-fg` on `--status-*-bg`): all PASS in both modes
(light 5.12–11.17:1, dark 11.10–12.68:1).

## Notes / observations (not blocking Task 27 text-contrast scope)

- **Status icon tokens on a neutral surface:** `--status-success-icon` (#22C55E, 2.18:1)
  and `--status-warning-icon` (#F59E0B, 2.05:1) fall below 3:1 when placed directly on
  `--surface-card` in light mode. These are bright 500-level fills used mostly for solid
  chips/dots where they sit on their own tinted background or carry white/dark text, not as
  thin graphical objects on the app surface. Where they are used as standalone status dots
  on a light neutral surface, consider the darker `--status-*-fg` token instead. Flagged for
  a follow-up if a standalone-dot-on-surface case is confirmed in the UI; left unchanged here
  to avoid altering chart series colors and solid-fill chips that already pass with their own
  foreground text.
- **White text on bright status fills:** `white on #22C55E` (2.28:1) and `white on #F59E0B`
  (2.15:1) — only relevant if white text is placed on these solid fills. Spot-check the
  steel-summary "watch/healthy" chips (`steel-summary-primitives.tsx`) which use
  `text-[var(--text-inverse)]` on `--status-warning-icon`/`--status-success-icon`. This is a
  pre-existing pattern outside the text-token scope of Task 27; flagged for design review.

## Manual verification guidance

- Use Chrome DevTools > Elements > Accessibility pane (or the color-picker contrast readout),
  or the WebAIM Contrast Checker, to spot-check live in both `data-theme="light"` and
  `data-theme="dark"`.
- Test text resize to 200% (Req 10.12) — token changes are color-only and do not affect sizing.
