# Phase 2 — Component consistency: buttons, forms, cards, tabs, icons

**Priority:** High | **Effort:** Large | **Depends on:** Phase 1

## Goal
Make every screen use ONE set of primitives. Convert shadcn primitives to proper CVA
variants, migrate the 147 raw `<button>`s and 9 local re-defs, consolidate icons on lucide,
and standardize the shared compositions (StatCard, Section, EmptyState, PageHeader).

## Preconditions
- Phase 1 done (tokens/accent unified, cn merges). shadcn/Magic MCP available.

## Tasks

### 2.1 — Upgrade primitives to CVA (now that deps exist)
- Refactor `web/src/components/ui/button.tsx` to use `class-variance-authority` with
  variants `{ primary, secondary, outline, ghost, destructive }` and sizes `{ sm, md, lg,
  icon }`. Add `asChild` via `@radix-ui/react-slot`. Keep the existing token-based styles;
  ensure default size meets 44px min height.
- Same treatment for `badge.tsx` (status variants: success/warning/danger/signal/neutral).
- Keep the public API backward compatible (`variant="primary"` still valid).

### 2.2 — Pull missing primitives via shadcn MCP
- Add through the shadcn MCP (or CLI fallback): `dialog`, `dropdown-menu`, `select`, `form`,
  `label`, `separator`, `toast`/`sonner`, `tooltip`, `sheet` (for mobile drawer),
  `scroll-area`. Review each `add` diff so it does NOT overwrite our `globals.css` tokens.
- Re-skin each to our tokens immediately (token pass).

### 2.3 — Kill local component re-definitions
- Find them: `grep -rlE "function (TabButton|StatCard|Stat|MetricCard|Pill|Chip|Badge|SectionCard)\b" web/src --include=*.tsx`
- Replace `TabButton` usages with `ui/tabs.tsx` (Radix Tabs) — e.g.
  `web/src/components/workflow/steel-financial-intelligence-page.tsx:67`.
- Create ONE shared `StatCard`/`MetricCard` in `web/src/components/shared/` and delete the
  local copies.

### 2.4 — Migrate raw `<button>` -> `Button`
- 147 occurrences. Do it area-by-area (commit per area) to keep diffs reviewable. Order by
  worst offenders (steel-*, approvals, ocr-scan). Icon-only buttons -> `<Button size="icon"
  aria-label="...">`.
- After each area: `grep -rn "<button" web/src/components/<area>` should trend to 0
  (allow genuinely-needed native buttons only with justification).

### 2.5 — Consolidate icons on `lucide-react`
- Replace the 32 files' inline `<svg>` helpers (e.g. `ShieldSm/ZapSm/LockSm` in
  `access/page.tsx`) with lucide imports at fixed sizes (16/20/24). Add `aria-label` on
  icon-only controls.

### 2.6 — Standard compositions
- Build shared: `PageHeader`, `Section`, `EmptyState` (fixes the repeated "Restricted"
  cards on mobile reports), `Toolbar`. Use Magic MCP for the EmptyState visual, then
  token-adapt. Place in `web/src/components/shared/`.

## Verification
- [ ] `Button` uses CVA; `cn` override test still passes; default height >= 44px.
- [ ] `grep -rc "<button" web/src --include=*.tsx` significantly reduced (target < 20, each
      justified) vs Phase 0 baseline of 147.
- [ ] No local `TabButton/StatCard/...` definitions remain (grep returns only the shared one).
- [ ] `lucide-react` used across former inline-SVG files; inline `<svg>` count down sharply.
- [ ] `npm --prefix web run build` clean; `audit:tokens` clean for all touched files.
- [ ] Storybook (if used, `storybook-static/` exists) or a screenshot sheet shows primitives
      consistent.

## Notes
- This is the largest phase. It's safe to split across many sessions/PRs — one component
  family or one feature area per PR. Log each in `progress/CHANGELOG.md`.
