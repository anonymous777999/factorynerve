# UI/UX Defect Inventory — code-level, fixable line items

> Deepest-level companion to AUDIT.md / ATOMIC_COMPONENT_REFERENCE.md. Where those describe
> WHAT to build, this file lists concrete, measured DEFECTS in the current code with exact
> grep-able evidence so each becomes a fixable task. Every number is a live grep of web/src
> on 2026-07-18. Fix these as part of the phase noted in [brackets].

Format: DEFECT-ID | severity | evidence (count) | why it hurts UI/UX | fix | [phase]

---

## A. COLOR SYSTEM DEFECTS

### DEF-C1 — Two stray palettes leaking everywhere  [Phase 1] CRITICAL
- Evidence: ~1,332 raw hex in tsx. Two foreign palettes dominate:
  - LIGHT warm-gray theme values on a DARK app: `#e7e5e4` (241x), `#57534e` (176x),
    `#78716c` (173x), `#f5f5f4` (37x), `#fafaf9` (31x), `#e3e8ef`, `#d6d3d1`, `#a8a29e`.
  - Near-black text `#111111` (199x), `#2f2f2f` (8x) — light-mode ink used on dark cards.
- Why: these are Stone/Tailwind light-theme defaults pasted in; they wash out or clash on the
  dark clay theme, and guarantee per-page drift.
- Fix: map every one to a token (`--text`, `--muted`, `--card*`, `--border*`). Add to the
  `audit:tokens` blocklist so they can't return.

### DEF-C2 — Blue/cyan identity split (should be clay)  [Phase 1] CRITICAL
- Evidence: `sky-*` 172 hits/43 files, `cyan-*` 121/17, `blue-*` 17/5, `indigo-*` 4,
  plus hex blues `#185FA5` (25x), `#3ea6ff` (10x), `#3B82F6` (7x), `#60a5fa` (6x),
  `#1D4ED8` (8x), `#8ec4ff`, `#89bcf8`, `#55a9ff`, `#0E1524`, `#0B0F19`.
- Why: the app reads as two products — orange brand chrome, blue interior. Single biggest
  "unpolished" signal.
- Fix: replace all blue/cyan/indigo with `--accent`/`--signal` tokens. Grep gate for these.

### DEF-C3 — Emerald/teal/violet used decoratively, not as status  [Phase 4] HIGH
- Evidence: `emerald-*` 499 hits/71 files, `teal-*` 7, `violet-*` 7, `#2dd4bf` (10x).
- Why: status greens used as decoration dilutes their meaning; success no longer reads as
  success. Should route through `--success`/`--signal` and only signal state.
- Fix: audit each; keep for genuine positive-status, tokenize the rest.

### DEF-C4 — 137 inline gradient literals  [Phase 2/4] MEDIUM
- Evidence: `linear-gradient`/`bg-gradient` 137 hits.
- Why: bespoke gradients per component = inconsistent surfaces/buttons.
- Fix: define ~4 gradient tokens (surface, surface-strong, accent, beam) in globals.css; reference them.

### DEF-C5 — 984 `!important` occurrences in tsx  [Phase 2] MEDIUM
- Evidence: `!` important flags ~984 (many are Tailwind `!` prefixes forcing overrides).
- Why: `!important` spam is a symptom of the broken `cn()` (no tailwind-merge) — people force
  overrides because merge doesn't work. Phase 0 `cn()` fix removes the NEED for most.
- Fix: after cn() fix, delete `!` prefixes that were compensating for merge failures.

---

## B. SPACING, RADIUS, TYPOGRAPHY RHYTHM

### DEF-S1 — 23 distinct arbitrary border-radii  [Phase 4] HIGH
- Evidence: `rounded-[2rem]` 97x, `rounded-[24px]` 45x, `rounded-[28px]` 40x, `rounded-[20px]`
  32x, `rounded-[1.5rem]`, `[1.4rem]`, `[1.35rem]`, `[1.6rem]`, `[1.7rem]`, `[32px]`, `[18px]`,
  `[1.75rem]` ... 23 unique values.
- Why: corners never match between cards/buttons/pills; the eye reads it as sloppy.
- Fix: collapse to the 6 radius tokens (sm/md/lg/xl/card/section). One radius per element class.

### DEF-S2 — 309 sub-12px text hits  [Phase 4] HIGH
- Evidence: `text-[11px]` 170x, `text-[10px]` 127x, `text-[9px]` 8x, `text-[0.65rem]` 3x,
  `text-[8px]` 1x.
- Why: unreadable on mobile, fails comfortable-reading; 8-9px is effectively decorative noise.
- Fix: raise to the type scale; min 12px for meta, 14px for body on mobile. Reserve 11px for
  rare non-essential captions only.

### DEF-S3 — 60+ arbitrary tracking values  [Phase 4] MEDIUM
- Evidence: `tracking-[0.1em]` 22x, `[0.08em]` 17x, `[0.12em]` 14x, `[0.18em]` 9x, `[0.32em]`
  4x, `[0.15em]`, `[0.14em]` + the token tracking scale also exists (double system).
- Why: two tracking systems (tokens + arbitraries) = inconsistent label spacing.
- Fix: use only the `--tracking-*` tokens; delete arbitraries.

### DEF-S4 — 40 fixed-px width/height on containers  [Phase 3] HIGH
- Evidence: `[wh]-[NNpx]` 40 hits.
- Why: fixed boxes overflow on 360px screens (why you needed the overflow audit + scroll area).
- Fix: replace with fluid `w-full`/`max-w-*`/`min-w-0`/grid; keep px only for icons.

---

## C. RESPONSIVE / LAYOUT DEFECTS

### DEF-R1 — 182 `min-h-screen` (iOS viewport trap)  [Phase 3] HIGH
- Evidence: `min-h-screen` 182 hits.
- Why: `100vh`/`min-h-screen` on mobile Safari/Chrome includes the URL bar area, causing
  content to sit under the toolbar and jump when it hides — a classic mobile UX bug.
- Fix: switch to `min-h-[100dvh]` (dynamic viewport) or `svh`/`lvh` where full-height is meant.

### DEF-R2 — 1 stray `100vw` (horizontal scroll risk)  [Phase 3] LOW
- Evidence: `100vw` 1 hit.
- Why: `100vw` includes the scrollbar width -> horizontal overflow on desktop.
- Fix: use `w-full`/`100%`.

### DEF-R3 — Only 1 `aspect-ratio` usage; 5 raw `<img>`, 0 next/image  [Phase 3] MEDIUM
- Evidence: `aspect-` 1 hit; `<img>` 5; `next/image` 0 files.
- Why: images without reserved aspect boxes cause layout shift (CLS); raw `<img>` misses
  Next optimization, lazy-loading, and sizing.
- Fix: use `next/image` with width/height or `aspect-*` wrappers. (Alts are present — good.)

### DEF-R4 — Only 19 `truncate` + 1 `line-clamp` across 48 table pages  [Phase 2/3] HIGH
- Evidence: `truncate` 19, `line-clamp-2` 1.
- Why: long values (customer names, SKUs, notes) break table layouts and wrap ugly on mobile;
  almost nothing clamps. SafeText exists but is underused.
- Fix: apply `truncate`/`line-clamp` + tooltip reveal on table cells and card titles broadly.

---

## D. Z-INDEX / STACKING DEFECTS

### DEF-Z1 — Ad-hoc z-index ladder, overlaps confirmed  [Phase 1 tokens / Phase 3 apply] HIGH
- Evidence: mixed `z-10/20/30/40/50` plus arbitraries `z-[80]`, `z-[75]`, `z-[72]`, `z-[70]`,
  `z-[55]`. No scale.
- Why: the desktop billing screenshot shows a tooltip rendering OVER content and FABs
  colliding — direct result of no z-order contract.
- Fix: define `--z-*` tokens (base/rail/header/drawer/fab/overlay/toast) and replace every
  numeric/arbitrary z with a token. Never invent a new z number.

---

## E. ACCESSIBILITY DEFECTS

### DEF-A1 — Forms lack label association  [Phase 2/5] CRITICAL
- Evidence: `htmlFor` only 14 vs `placeholder=` 129 and ~53 inputs without `id`.
- Why: placeholders-as-labels disappear on focus and are invisible to screen readers; missing
  `htmlFor`/`id` breaks label-click and AT. Fails WCAG.
- Fix: shadcn `form`+`label` with `htmlFor`/`id`; every input gets a real, persistent label.

### DEF-A2 — Sparse ARIA + roles  [Phase 5] HIGH
- Evidence: `aria-label` 39, `role=` 11, `tabIndex` 2 across 287 files.
- Why: icon-only buttons (32 inline-SVG files) and custom widgets are unlabeled/unnavigable.
- Fix: label every icon-only control; add landmarks; the shadcn primitives supply most roles.

### DEF-A3 — Weak focus visibility  [Phase 2/5] HIGH
- Evidence: `focus-visible` only 13 hits/8 files, but `outline-none` 38 hits.
- Why: `outline-none` without a replacement ring = keyboard users lose their place. Only the
  8 primitive files have proper rings; the 147 raw buttons + raw checkboxes don't.
- Fix: every interactive element gets a token focus ring; never `outline-none` alone.

### DEF-A4 — No reduced-motion honoring in components  [Phase 4] MEDIUM
- Evidence: `motion-reduce:` 0 in tsx (globals.css has ONE block for auth anims only).
- Why: 275 transition/duration + `animate-pulse` (13) / `animate-spin` (3) ignore users who
  set reduce-motion.
- Fix: extend the reduced-motion block to spinners/skeletons/toasts/accordions, or use
  `motion-reduce:` utilities.

### DEF-A5 — Hover-only affordances (276 hover: hits)  [Phase 2] MEDIUM
- Evidence: `hover:` 276; row actions/tooltips are hover-driven.
- Why: touch devices have no hover — kebab actions and `title=` tooltips are unreachable.
- Fix: every hover affordance needs a tap/focus equivalent (persistent action buttons or
  tap-to-open menus/tooltips).

---

## F. CONSISTENCY / DRY DEFECTS

### DEF-D1 — Duplicated formatting helpers  [Phase 2] MEDIUM
- Evidence: local `formatCurrency` defined in 18 files, `formatDate` in 29, `formatKg/Number/
  Percent/Weight` in 22.
- Why: currency/date formatting drifts (₹ placement, decimals, locale) between screens; a
  fix in one page doesn't propagate.
- Fix: one `lib/format.ts` (currency INR, weight kg, %, date) imported everywhere. Delete locals.

### DEF-D2 — Native `<select>` primitive  [Phase 2] HIGH
- Evidence: ui/select.tsx wraps native `<select>`; 9 raw `<select>` remain.
- Why: unstyleable option list, OS-inconsistent, no search/multi, poor mobile sheet.
- Fix: shadcn `select` (Radix) behind the same export name; `combobox` for long lists.

### DEF-D3 — 24 files build layout via inline `style={{}}`  [Phase 2/3] MEDIUM
- Evidence: `style={{` in 24 files.
- Why: inline styles escape the token system and Tailwind's responsive engine; can't be
  themed or made responsive.
- Fix: move to token classes; keep inline only for truly dynamic values (computed widths, chart
  colors from data).

### DEF-D4 — Local re-defined UI atoms  [Phase 2] HIGH
- Evidence: 9 files define local `TabButton/StatCard/Badge/Pill/SectionCard` (see AUDIT).
- Fix: delete; use shared primitives. (Tracked in ATOMIC_COMPONENT_REFERENCE.)

---

## G. INTERNATIONALIZATION DEFECTS

### DEF-I1 — Only 20/287 files use the i18n `t()`  [Phase 4/5] MEDIUM
- Evidence: `useI18n`/`t(` in 20 files; 5 locale folders exist (en/gu/hi/mr/ta).
- Why: the vast majority of UI strings are hardcoded English despite a full i18n system and 5
  translated locales — non-English users see mixed-language screens.
- Fix: route user-facing strings through `t()`; this is large — schedule per-area with the
  component migration. At minimum, all NEW/redesigned components must use `t()`.

### DEF-I2 — Hardcoded currency/number locale assumptions  [Phase 2] LOW
- Evidence: `Intl.NumberFormat("en-IN", ...)` inline in the format helpers.
- Fix: centralize in lib/format.ts; make locale a parameter tied to the active i18n locale.

---

## H. MOTION / FEEDBACK DEFECTS

### DEF-M1 — 454 hand-rolled spinners, inconsistent + 1 blue leak  [Phase 2] HIGH
- Evidence: `animate-spin` usage across 79 files/454 hits; ocr/progress-indicator.tsx uses
  `#185FA5` (blue) border.
- Fix: shared `Spinner` + `Button loading` prop (see ATOMIC ref 3.1).

### DEF-M2 — `animate-pulse` used as loading indicator (13)  [Phase 4] LOW
- Evidence: `animate-pulse` 13.
- Why: pulse-as-loading is ambiguous vs skeletons; standardize on Skeleton for content
  placeholders and Spinner for actions.

---

## SEVERITY ROLLUP (fix order within phases)
- CRITICAL: DEF-C1 (light-gray leak), DEF-C2 (blue split), DEF-A1 (form labels).
- HIGH: DEF-C3, DEF-S1, DEF-S2, DEF-S4, DEF-R1, DEF-R4, DEF-Z1, DEF-A2, DEF-A3, DEF-D2,
  DEF-D4, DEF-M1.
- MEDIUM: DEF-C4, DEF-C5, DEF-S3, DEF-R3, DEF-A4, DEF-A5, DEF-D1, DEF-D3, DEF-I1.
- LOW: DEF-R2, DEF-I2, DEF-M2.

## Grep gates to add to scripts/audit-design-tokens.mjs (Phase 0)
Block in web/src/**/*.tsx (allowlist ui/**):
- `#[0-9a-fA-F]{6}` (raw hex)  ·  `(bg|text|border|ring|from|to|via)-(sky|cyan|blue|indigo)-`
  (blue leak)  ·  `text-\[(8|9|10|11)px\]` (tiny text)  ·  `min-h-screen` (suggest dvh)  ·
  `rounded-\[` (arbitrary radius)  ·  `z-\[[0-9]` (arbitrary z)  ·  `outline-none` without
  `focus-visible` in same element  ·  `<button` (raw button)  ·  local `function (Tab
  Button|StatCard|formatCurrency|formatDate)`.
