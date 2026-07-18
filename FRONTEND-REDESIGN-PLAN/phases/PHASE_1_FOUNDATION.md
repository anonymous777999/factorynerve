# Phase 1 — Foundation: tokens, color unification, breakpoints, fonts

**Priority:** Critical | **Effort:** Medium | **Depends on:** Phase 0

## Goal
Lock the visual foundation: ONE accent identity (kill blue/orange split), a fixed type
scale, WCAG-safe muted text, JS breakpoints moved to CSS/a hook, and fonts via `next/font`.
Nothing below can look consistent until this is done.

## Preconditions
- Phase 0 complete: `cn()` merges, shadcn stack installed, guardrail script exists.

## Tasks

### 1.1 — Unify on the warm-clay accent (remove all blue)
- Blues to eliminate (grep them): `#5ba8ff`, `#89bcf8`, `#8ec4ff`, `#82c0ff`, `#9bc9ff`,
  `#63b2ff`, `#55a9ff`, and `rgba(47,125,255,*)`, `rgba(62,166,255,*)`, `rgba(66,150,255,*)`,
  `rgba(76,176,255,*)`, `rgba(124,191,255,*)`.
  ```bash
  grep -rEn "#(5ba8ff|89bcf8|8ec4ff|82c0ff|9bc9ff|63b2ff|55a9ff)|rgba\((47,125,255|62,166,255|66,150,255|76,176,255|124,191,255)" web/src
  ```
- Fix locations:
  - `web/src/app/globals.css` `.auth-input`, `.auth-button-primary`, `.auth-button-outline`
    (lines ~357-420): repaint to `--accent`/`--accent-strong`, focus ring `--accent`.
  - `web/src/components/ui/button.tsx` primary variant: replace blue shadow/hover borders
    with accent-derived shadow (`rgba` from `--accent`) — keep the orange gradient.
  - `web/src/components/ui/input.tsx`: `focus:border-sky-300/45` / `ring-[rgba(76,176,255,.14)]`
    -> accent focus ring.
  - `web/src/app/(public)/access/page.tsx` and any auth page: `text-[#8ec4ff]` etc -> tokens.
- Acceptance: the blue grep above returns **zero** matches.

### 1.2 — Raise `--muted` to AA contrast
- File: `web/src/app/globals.css:15`. `#ab9f93` on `#172028` ~= 3.4:1. Lighten to reach
  >= 4.5:1 on `--card` (target ~`#c4b8a8` or lighter; verify with a contrast checker or the
  a11y test in Phase 5). Keep it warm.

### 1.3 — Codify the type scale
- Add semantic helpers (either Tailwind `@utility` in `globals.css` or a tiny `Text`/heading
  convention) matching `reference/DESIGN_TOKENS.md`. Do NOT mass-rewrite pages yet — that's
  Phase 4. Here you only DEFINE the scale + document it so new work uses it.
- Ensure mobile body text is >= 14px going forward (no new `text-[10px]` for body).

### 1.4 — Move fonts to `next/font`
- Remove the CSS `@import url("https://fonts.googleapis.com/...")` at `globals.css:1`.
- In `web/src/app/layout.tsx`, load IBM Plex Sans + Space Grotesk via `next/font/google`,
  expose as CSS vars (`--font-body`, `--font-display`) on `<html>`/`<body>`, so the existing
  `var(--font-body)` references keep working. This removes render-blocking + font CLS.

### 1.5 — Add a single SSR-safe `useMediaQuery` hook
- Create `web/src/hooks/use-media-query.ts` (or `use-breakpoint.ts`) returning booleans for
  `isMobile/isTablet/isDesktop/isWide` aligned to `sm/md/lg/xl`. SSR-safe (default to a
  sensible value, subscribe on mount). This replaces `window.innerWidth` reads — the actual
  swap in `app-shell.tsx` happens in Phase 3, but the hook lands here.

### 1.6 — Add z-index tokens
- Add `--z-*` scale (see DESIGN_TOKENS.md) to `globals.css`. Used in Phase 3 to fix the
  FAB/tooltip overlap. Just define here.

## Verification
- [ ] Blue-color grep returns 0 matches.
- [ ] `--muted` contrast >= 4.5:1 on `--card` (record the ratio in the changelog).
- [ ] No `@import` of Google Fonts in `globals.css`; fonts render via `next/font`; no FOUT.
- [ ] `use-media-query` hook exists and is unit-importable.
- [ ] `npm --prefix web run build` clean; `npm --prefix web run audit:tokens` shows hex/rgba
      count DOWN vs Phase 0 baseline.
- [ ] Manual: login/auth screens now read as ORANGE, not blue.

## Rollback
Scoped to `globals.css`, `layout.tsx`, `ui/button.tsx`, `ui/input.tsx`, auth pages, and the
new hook. Revert per-file with git.
