# Frontend Audit — Evidence & Findings

Snapshot date: 2026-07-18. App under audit: `web/` (Next.js 16, React 19, Tailwind v4).
This is the "why" behind the redesign. Every claim below has a file/line or a metric.

## Inventory
- ~94 route files, 287 `.tsx` files, 5 locales (`en/gu/hi/mr/ta`).
- Token system: `web/src/app/globals.css` (544 lines) + `web/tailwind.config.ts`.
- Primitives: `web/src/components/ui/{button,card,input,tabs,select,badge,table,label,textarea,separator,skeleton}.tsx`.
- Shell: `web/src/components/layout/app-shell.tsx` — **2,311 lines / 91KB** (monolith).
- Largest components: `approvals-page.tsx` (123KB), `ocr-scan-page.tsx` (99KB),
  `ocr-verification-v2-page.tsx` (98KB), `dashboard-home.tsx` (96KB).

## Hard metrics (the smell test)
| Metric | Count | Meaning |
|---|---:|---|
| Raw `#hex` literals in `.tsx` | ~1,332 | palette scattered across pages, not tokenized |
| `rgba(...)` literals in `.tsx` | ~1,436 | same problem, opacity variants inline |
| Raw `<button>` elements | 147 | bypassing the shared `Button` primitive |
| `Button` primitive imports | 96 | primitive exists but under-used |
| Arbitrary text sizes `text-[..]` | 321 | no enforced type scale |
| `py-1` / `py-1.5` (tiny controls) | 230 | tap-target risk on mobile |
| `h-11`/`min-h-11` (44px targets) | ~51 | too few; most controls too small |
| Files hand-rolling inline `<svg>` | 32 | vs `lucide-react` used in only **2** files |
| `window.innerWidth` reads | multiple (app-shell:1672,1689,1704) | JS breakpoints -> CLS/hydration risk |
| Fixed `w-[..px]`/`h-[..px]` | 40 | overflow risk on small screens |

Worst hex offenders: `steel-financial-intelligence-page.tsx` (210), `steel-quality-page.tsx`
(202), `steel-sales-intelligence-page.tsx` (87), `ocr-scan-page.tsx` (76).

## 1. Visual design
- **Blue vs orange identity split.** App accent is warm clay `--accent: #c56d2d`
  (`globals.css:16`). Auth surface is cold blue: `.auth-input` focus `#5ba8ff`
  (`globals.css:373`), `.auth-button-primary` blue gradient (`globals.css:384`),
  `access/page.tsx` labels `text-[#8ec4ff]`. Even `ui/button.tsx` primary uses an ORANGE
  gradient with a BLUE shadow `rgba(47,125,255,0.28)` and blue hover borders — internally
  contradictory.
- **Typography:** dominated by `text-sm` (1,876) and `text-xs` (1,434); many `text-[10px]`,
  `text-[9px]`, `text-[8px]`. Heavy uppercase + extreme tracking tokens (`--tracking-display:
  0.36em`) hurt legibility at small sizes.

## 2. Layout & responsiveness
- **Good bones:** `app-shell.tsx` has a real desktop sidebar (`xl:block`), mobile bottom nav
  (`lg:hidden`), safe-area insets, optional context rail (`xl:grid-cols-[minmax(0,1fr)_19rem]`).
- **Bad execution:** breakpoints decided in JS via `window.innerWidth < 1024`
  (`app-shell.tsx:1672,1689,1704`) -> hydration mismatch + layout shift; disconnected from
  Tailwind breakpoints.
- **Desktop billing screenshot** (`FRONTEND-REDESIGN/www.factorynerve.online_billing.png`):
  help tooltip overlaps content, 3-col grid leaves a huge empty column, `8/1` collides with
  a Help FAB, and the sidebar renders DUPLICATE section headers (REVIEW/ADMIN/ACCOUNT twice).
- **Mobile reports screenshot** (`127.0.0.1_3000_reports(iPhone SE).png`): endless
  single-column scroll of near-identical dense cards + repeated "Restricted" empty states,
  no sectioning or summary-first hierarchy.

## 3. Component consistency
- 147 raw `<button>` vs 96 `Button` imports. 9 files re-define local
  `TabButton`/`StatCard`/`Badge`/`Pill`. Example: `steel-financial-intelligence-page.tsx:67`
  defines a blue `TabButton` while `ui/tabs.tsx` (Radix, accent-colored) already exists.
- **`cn()` is broken for merging:** `lib/utils.ts` is `values.filter(Boolean).join(" ")` —
  no `tailwind-merge`. `className` overrides on primitives don't reliably win.
- **shadcn claimed, not installed:** `web/components.json` exists, but `package.json` has no
  `class-variance-authority`, `clsx`, `tailwind-merge`, or the Radix set (only
  `@radix-ui/react-tabs`). The `ui/*` are shadcn-shaped but hand-written.

## 4. Navigation & flow
- Right patterns (sidebar desktop / bottom-nav+drawer mobile, role-driven via
  `lib/role-navigation.ts`), buggy execution (duplicate sidebar groups, innerWidth state,
  crowded bottom-right FAB stack: help + jobs + feedback + scanner).

## 5. Accessibility
- Contrast: `--muted: #ab9f93` on `--card: #172028` ~= 3.4:1 (below AA 4.5:1), used widely.
- Tap targets: 230 `py-1`/`py-1.5`; many interactive `text-[10px]/[11px]` pills < 44px.
- Focus: shared `Button` has good `focus-visible`; the 147 raw buttons mostly don't.
- Semantics: only 39 `aria-label` across 287 files; 32 inline SVGs without titles.

## 6. Performance-relevant
- Google Fonts via CSS `@import` (`globals.css:1`) — render-blocking; should be `next/font`.
- Mega client components (`"use client"` everywhere) -> large bundles.
- JS breakpoints -> CLS at first paint.
- `apexcharts` + `react-apexcharts` with global `!important` tooltip overrides
  (`globals.css:525-544`).

## MCP / tooling state at audit time
- `.mcp.json` had: code-review-graph, playwright, chrome-devtools, filesystem, git.
- NO shadcn MCP, NO 21st.dev Magic MCP. (Added in Phase 0.)
- `node v24`, `npx 11.9`, shadcn CLI reachable. No `TWENTY_FIRST_API_KEY` set yet.
