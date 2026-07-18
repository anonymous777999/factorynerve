# Redesign Progress Log

Append a dated entry per phase/PR. Newest at top. Use `BLOCKED` headings for anything you
couldn't do so the human can unblock it.

---

## 2026-07-18 — Planning + Phase 0 setup started (by planning agent)
- Created `FRONTEND-REDESIGN-PLAN/` playbook (README, 6 phase files, 5 reference docs).
- Registered MCP servers in repo-root `.mcp.json`: `shadcn` (no key) and `magic` (needs
  `TWENTY_FIRST_API_KEY`).

### BLOCKED (for human)
- **21st.dev Magic API key not set.** Add `TWENTY_FIRST_API_KEY` to the MCP host env, then
  restart, to enable the `magic` server. shadcn MCP works without it. See
  `reference/MCP_SETUP.md`.

### Baseline metrics (Phase 0.6) — measured 2026-07-18
| Metric | Baseline |
|---|---:|
| Raw `#hex` in `web/src/**/*.tsx` | 1332 |
| `rgba(` literals | 1436 |
| Raw `<button>` | 147 |
| Arbitrary `text-[..]` sizes | 321 |
| Files with inline `<svg>` | 32 |

> Later phases must show these trending DOWN (except where a metric is intentionally N/A).

---

## 2026-07-18 — Page-by-page reference map added
- Inventoried all ~88 routes; mapped `page.tsx` -> rendered component; detected structural
  signals (table/chart/tabs/form/grid/kpi/search) per page.
- Collapsed pages into **7 archetypes** (A KPI-dashboard, B data-table, C detail, D form,
  E auth, F marketing, G bespoke).
- Wrote `reference/PAGE_REFERENCE_MAP.md`: for each archetype, the exact shadcn registry item
  + 21st.dev Magic search/prompt, plus a **VERDICT** on which source to use and why.
- Identified the **9-component shared kit** that covers ~80 of 88 pages (StatCard, DataTable,
  PageHeader, EmptyState, Timeline, FilterToolbar, ComingSoon, Section/CardGrid, Auth fields).

> NOTE: MCP servers are registered but not yet loaded in the current tool session (host
> restart needed) and Magic still needs `TWENTY_FIRST_API_KEY`. The map was built from source
> inspection; when MCP is live, pull each shared component from its verdict source.

---

## 2026-07-18 — Exhaustive atomic (element-level) audit added
- Live-grepped web/src for every interactive/atomic element (form controls, overlays,
  feedback, navigation atoms, data display, scroll/overflow, a11y micro-details).
- Wrote reference/ATOMIC_COMPONENT_REFERENCE.md (48 atoms across 8 sections) and
  reference/COMPONENT_COVERAGE_MATRIX.md (one-row-per-atom + build priority).
- Key findings: Select is NATIVE (not Radix); NO shared component for Checkbox, Switch,
  Dialog, Tooltip, Dropdown-menu, Popover, Pagination, Accordion, Progress, Spinner,
  Combobox, Radio, Date-picker, File-dropzone. 454 hand-rolled spinners (one leaks blue
  #185FA5), 280 pagination hits across 48 files, 131 native title= tooltips, 168 ad-hoc empty
  states, custom toast event bus. Existing good pieces: skeleton, tabs (Radix),
  ResponsiveScrollArea (horizontal edge-fade), custom scrollbar CSS, safe-area insets.
- These feed Phase 2 (components). Master shadcn install list + Magic pull list captured in
  section 8 of the atomic reference.

---

## 2026-07-18 — 21st.dev Magic key installed (BLOCKED item resolved)
- Received the TWENTY_FIRST_API_KEY from the user.
- SECURITY: `.mcp.json` was git-TRACKED but also in `.gitignore` (line 54). Ran
  `git rm --cached .mcp.json` so it is now local-only; verified the key string was never in
  git history (`git log -S 21st_sk_` empty). Did NOT put the key in root `.env.local` (that
  file IS tracked — would have leaked).
- Hardcoded the key into the `magic` server's `env.API_KEY` in the now-untracked `.mcp.json`.
- Verified: `.mcp.json` valid JSON; `git check-ignore` confirms it stays local; boot test of
  `@21st-dev/magic@latest` v0.0.46 starts cleanly with the key (no auth error).
- STATUS: shadcn MCP (no key) + Magic MCP (keyed) both ready. Remaining step is a one-time
  MCP host restart so THIS tool session can call them; after that, live component pulls can
  replace the source-inspection verdicts in the reference docs.

## 2026-07-18 — Code-level defect sweep
Deep grep audit of `web/src`; created `reference/UIUX_DEFECT_INVENTORY.md` (~30 DEF-IDs, all with counts + phase mapping).
- **Critical:** DEF-C1 light-gray hex leak (#e7e5e4 ×241, #57534e ×176, #78716c ×173, #111111 ×199); DEF-C2 blue/orange split (sky ×172, cyan ×121, blue ×17, #185FA5 ×25); DEF-A1 form-label gap (14 htmlFor vs 129 placeholders / 53 inputs w/o id).
- **High:** DEF-C5 984 !important (root-caused to broken cn()); DEF-S1 23 distinct radii; DEF-S2 309 sub-12px text; DEF-R1 182 min-h-screen; DEF-D1 duplicated format* helpers (currency ×18, date ×29).
- Added grep-gate rules to `web/scripts/audit-design-tokens.mjs` (fail build on new blue hex, raw #e7e5e4/#111111, native <select>, sub-12px text, !important spam).
- Linked inventory into README supporting-docs.

## 2026-07-18 — Phase 0 EXECUTED (setup + cn() fix + guardrails)
Foundation is live. Four files touched: `web/src/lib/utils.ts`, `web/components.json`,
`web/package.json`, `web/scripts/audit-design-tokens.mjs`.
- **0.2 deps installed:** class-variance-authority ^0.7.1, clsx ^2.1.1, tailwind-merge ^3.6.0,
  tailwindcss-animate ^1.0.7, @radix-ui/react-{slot,dialog,dropdown-menu,select,label,separator,toast}.
  (react-tabs + lucide-react already present.)
- **0.3 cn() fixed:** now `twMerge(clsx(inputs))`. Proven: `cn("px-2","px-4")→"px-4"`,
  `cn("text-sm text-lg")→"text-lg"`. This unblocks killing the 27 !important later.
- **0.4 components.json:** baseColor slate → stone (warm-neutral scaffolds).
- **0.5 guardrail:** `web/scripts/audit-design-tokens.mjs` + `npm run audit:tokens`. Reports by
  default, fails only under `--strict` (matches existing audit:overflow convention).
- **0.6 build:** `next build` → "Compiled successfully in 30.8s". Full typecheck blocked ONLY by
  a pre-existing broken import in the untracked stray folder
  `web/src/features/ocr/components/ocr-editor/` (imports `@/components/ocr-scan/types`, which
  doesn't exist; never git-tracked). Unrelated to Phase 0 — `utils.ts` typechecks clean in isolation.

### Baseline (audit:tokens, web/src) — target = drive these DOWN in Phases 1–4
| rule | count |
|------|-------|
| raw rgba() | 1131 |
| raw hex | 1083 |
| sub-12px text | 309 |
| blue accent leak | 249 |
| raw <button> | 147 |
| !important | 27 |
| native <select> | 9 |
| **total** | **2955** |

## 2026-07-18 — Phase 1 EXECUTED (foundation: color unify + a11y muted + fonts + hook + tokens)
Foundation locked. Verified live in the running app (screenshot + computed-style checks).
- **1.1 blue → warm clay (DONE, 0 remaining):** repainted `globals.css` auth classes
  (.auth-input focus, .auth-button-primary, .auth-button-outline), `ui/button.tsx` primary+outline,
  `ui/input.tsx` focus ring. Then a scoped codemod mapped every remaining blue across **75 files /
  543 replacements**: blue rgba triples (47,125,255 / 62,166,255 / 66,150,255 / 76,176,255 /
  124,191,255) → rgba(197,109,45,a); blue hex (#5ba8ff etc, #185fa5→#8c4218); Tailwind
  sky/cyan/blue utilities → `[var(--accent)]` / `[var(--accent-soft)]`; plus one manual
  `accent-cyan-400`→`accent-[var(--accent)]` checkbox. **audit:tokens blue rule 249 → 0.**
- **1.2 --muted AA:** #ab9f93 → #c4b8a8 (8.45:1 on --card, 9.64:1 on --bg; headroom for opacity
  reductions that were pushing real contrast to ~3.4:1).
- **1.3 type scale:** added `--text-caption..display` (body min 0.875rem/14px) to :root. Definition
  only — mass page rewrite is Phase 4.
- **1.4 next/font:** removed render-blocking Google Fonts `@import`; load IBM Plex Sans +
  Space Grotesk via `next/font/google` in layout.tsx, exposed as `--font-plex-sans` /
  `--font-space-grotesk`, wired into `--font-body`/`--font-display`. Verified: --font-body now
  resolves to 'IBM Plex Sans Fallback' (self-hosted), 0 googleapis @import left.
- **1.5 useMediaQuery:** `src/hooks/use-media-query.ts` — SSR-safe `useMediaQuery` + `useBreakpoint`
  (isMobile/isTablet/isDesktop/isWide, Tailwind sm/md/lg/xl). Swap into app-shell happens in Phase 3.
- **1.6 z-index tokens:** `--z-base..tooltip` (0/10/20/30/40/50/60/70/80) in :root. Used in Phase 3.
- **build:** `next build` → "Compiled successfully in 34.3s". Full typecheck still blocked ONLY by the
  pre-existing OCR stray-folder import (unrelated). Changed files typecheck clean in isolation.
- **audit:tokens total:** 2955 → 2706 (−249, all blue). rgba/hex remainder are the substituted warm
  accent values (legit). Sub-12px (309), raw <button> (147), !important (27), native <select> (9) are
  Phase 2/4 targets.
- **NOTE:** "Reset password" link is `text-slate-400` (cool gray, not a blue accent) — correctly out of
  Phase 1 scope; part of DEF-C1 slate/gray leak handled in Phase 4. Hover already uses --accent.

## 2026-07-18 — Phase 2 IN PROGRESS (primitives to CVA + shared kit + dedup)
Foundational/high-leverage parts done & build-verified ("Compiled successfully"). Remaining
button/SVG/MCP work is the plan's explicit multi-PR tail — checkpointed for review.
- **2.1 CVA primitives (DONE):** `ui/button.tsx` → `class-variance-authority` with
  variants {primary,secondary,outline,ghost,destructive} + sizes {sm,md,lg,icon}, `asChild` via
  @radix-ui/react-slot, default size h-11 (44px min tap target). `ui/badge.tsx` → CVA with
  {default,secondary,outline,success,warning,danger,destructive,signal,neutral}. Public API kept
  backward-compatible (variant="primary" still valid). cn() override still wins.
- **2.3 dedup local re-defs (DONE):** created shared `TabButton`, `EmptyState`, `MetricCard` in
  components/shared/ (exported via shared/index.ts). Removed 6× local TabButton, 5× simple
  EmptyState, 1× MetricCard across steel-financial/fraud/inventory/production/scrap/machine-alerts
  + workforce-intelligence + report-insights-board. 9 files now import the shared kit. Kept
  domain-specific EmptyStates (notifications, approvals) and the OCR compact MetricCard as-is
  (distinct visuals — intentional, not a miss).
- **2.4 raw <button> → primitives (STARTED):** 147 → 140. Migrated severity-tab in
  steel-machine-alerts to shared TabButton. Remaining 140 to be done area-by-area per plan.
- **build:** `next build` "Compiled successfully in 25.1s" after clearing stale `.next` dev cache
  (a routes.d.ts artifact from the Phase-1 preview run — not a source error). Only the pre-existing
  OCR stray-folder import blocks full typecheck.
- **DEFERRED (multi-PR tail, per plan §Notes):** 2.2/2.6 shadcn primitive pulls via MCP (needs host
  restart), 2.4 remaining 140 buttons, 2.5 the 32 inline-SVG→lucide files. audit:tokens: raw
  <button> 147→140; total 2706→2699.

## 2026-07-18 (cont.) — Phase 2.4 button sweep + off-brand color codemods
Continued area-by-area button migration and eliminated three residual off-brand accent leaks
left over from the pre-redesign palette. All changes build-verified ("Compiled successfully in
21.7s"); only the pre-existing OCR stray-folder import blocks full typecheck (unrelated).
- **2.4 buttons (workflow):** steel-fraud-intelligence lifecycle actions — Investigate→outline,
  Dismiss→destructive; Acknowledge (amber) + Resolve (emerald) kept as justified semantic-status
  exceptions (Button has no warning/success variant). ocr-scan-page previously 15→0.
- **2.4 buttons (public):** pricing-page 3 CTAs (plan card + 2 pack cards) → `<Button>` variants;
  removed bespoke gradient classes. Billing toggle switch + text toggles kept (role="switch").
- **2.4 buttons (private):** notifications-page prev/next → `Button size="icon"` + lucide
  Chevrons, tab group → shared `TabButton`, mark-as-read → `Button size="icon"` + lucide Check
  (5→1, remainder is numbered pagination). profile-page 4 mobile section toggles → `Button
  size="icon"` + lucide Plus/Minus (4→0). ai-insights preset chips → `Button` (built-in→outline,
  saved→secondary). Radio-style selection cards + inline text-link actions left as justified
  patterns (reports PDF/Excel links, entry wizard option cards, settings selectors).
- **Color codemods (ONE-accent enforcement):**
  - Green-glow `rgba(57,255,114,α)` (old neon accent) → warm clay in pricing-page +
    (public)/pricing/page.tsx; also cleaned emerald/slate leaks on the standalone pricing page.
  - Cyan-glow `rgba(34,211,238,α)` (old cyan-400 accent) → `rgba(197,109,45,α)`, alpha preserved:
    25 hits across 10 files (entry, auth-shell, app-shell, admin-billing, dashboard-home,
    email-summary, premium-dashboard, profile, reports, approvals).
  - Teal `rgba(45,212,191,α)` → `rgba(140,66,24,α)` (--accent-strong) in auth-shell brand gradient
    + premium-dashboard shift selector (9 hits). Decorative `#22d3ee`+violet gradients LEFT for
    Phase 4 (DEF-C1) — that's a deliberate multi-hue decision, not a token leak.
- **audit:tokens:** raw <button> 125→110; total findings 2699→2635. Build "Compiled successfully
  in 21.7s"; tsc clean except pre-existing OCR folder.


---

## Phase 2.5 — Inline SVG → lucide-react (icon migration)

- **Migrated 93 inline icon `<svg>` blocks → lucide-react components across 27 files.**
  Full inventory + per-icon meaning-verification in `PHASE-2.5-ICON-MIGRATION.md`;
  page-by-page regression checklist in `PHASE-2.5-VISUAL-REGRESSION-CHECKLIST.md`.
- **Method:** matched each source path's geometry to the lucide icon's geometry AND
  cross-checked self-describing local names (`ShieldSm`, `PersonaIcon type="user"`,
  `EngineIcon id="capture"`, …). Where a local icon *component* existed, only the SVG
  body was swapped and the wrapper/name kept → zero missed call sites.
- **Sizing preserved:** original `h-* w-*` classes carried onto each lucide element;
  live DOM confirmed 14/16/20/24/28px groups unchanged (no size drift).
- **Interactions preserved & verified live:** password Eye⇄EyeOff toggle (aria-label +
  icon swap in sync), FAQ ChevronDown rotation, mobile nav Menu⇄X toggle.
- **Areas:** auth flow (access/register/forgot/reset/verify + password-field),
  notifications (page/detail/bell), OCR (upload-box/progress/mobile-entry), system
  (403/factory-required), landing sections (hero/personas/problem/engines/nav/
  product-preview/pricing-preview/how-it-works/final-cta/faq-section), content pages
  (contact/faq/disclosure/eula/pricing-page).
- **Justified exceptions (36 raw `<svg>` remain, all documented):**
  app-shell ×26 (deferred to Phase 3 decomposition), fn-logo ×6 (brand mark),
  premium-dashboard chart ×1 (data-viz, not an icon), engines `intelligence` ×1 +
  contact emergency-beacon ×1 + disclosure `BugIcon` ×1 (bespoke glyphs with no exact
  lucide twin — commented in-code).
- **Color leaks flagged for Phase 4 (NOT changed here — geometry-only pass):** landing
  icon colors `text-teal-300` / `text-amber-300`, premium chart `#3EA6FF`/`#2DD4BF`.
- **Verification:** `next build` → `✓ Compiled successfully in 24.3s` (only the
  pre-existing unrelated `ocr-partial-result.tsx` stray-folder type error remains).
  Dev server: 0 console errors on `/`, `/access`, `/register`, `/contact`; lucide icons
  confirmed rendering (34 on `/`, 26 on `/contact`).
