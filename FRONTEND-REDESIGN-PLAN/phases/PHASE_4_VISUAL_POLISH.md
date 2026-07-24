# Phase 4 — Visual polish: type scale, spacing rhythm, micro-interactions

**Priority:** Medium | **Effort:** Medium | **Depends on:** Phases 1-3

## Goal
Now that structure and components are consistent, make it look designed: enforce the type
scale everywhere, apply consistent spacing rhythm, tame the uppercase/tracking, and add
tasteful, reduced-motion-safe micro-interactions.

## Tasks

### 4.1 — Enforce the type scale (retire the 321 arbitrary sizes)
- Replace `text-[10px]/[9px]/[8px]/[2.65rem]/...` with the scale in `DESIGN_TOKENS.md`.
- Ensure headings use `--font-display`, body uses `--font-body`. Mobile body >= 14px.
- Reduce ALL-CAPS + wide `--tracking-*` to short labels only; body/paragraph stays normal case.

### 4.2 — Spacing & rhythm
- Apply `--space-*` via shared `Section`/`Stack` patterns; consistent card padding
  (`Card` already has `px-6 pt-6 sm:px-7`). Remove arbitrary `p-[13px]`-style values.
- Establish vertical rhythm between sections (consistent `space-y`/`gap`).

### 4.3 — Color usage discipline
- Status colors (success/warning/danger/signal) used ONLY for status, never decoration.
- Accent reserved for primary actions / active state / focus. Avoid accent walls.

### 4.4 — Micro-interactions
- Standardize hover-lift, `content-fade-in`, focus transitions into a few reusable classes
  (already partially in `globals.css`). Durations 150-200ms. Everything gated behind
  `@media (prefers-reduced-motion: reduce)` (block already exists at globals.css:509).
- Add loading/skeleton consistency (`ui/skeleton.tsx`, `components/skeleton/*` already exist).

### 4.5 — Chart theming
- Align `apexcharts` palette to tokens; the global `!important` tooltip overrides
  (globals.css:525-544) currently force a LIGHT tooltip on a DARK app — reconcile to the
  dark theme or make it intentional/consistent.

## Verification
- [ ] `grep -rEo "text-\[[0-9]" web/src --include=*.tsx | wc -l` well below the 321 baseline.
- [ ] No body text < 14px on mobile; headings consistently display-font.
- [ ] Spacing uses the scale (spot-check 5 dense pages).
- [ ] Motion respects `prefers-reduced-motion` (toggle OS setting, verify).
- [ ] `npm --prefix web run build` clean.
