# Requirements Document

## Introduction

This document defines the requirements for **Sprint 4 — Frontend Critical Fixes & Beauty** of the
DPR.ai (FactoryNerve OS) web frontend (`web/` — Next.js 16 + React 19 + Tailwind v4). Sprint 4 is a
**direct remediation sprint** driven by a completed manual audit. The broken areas are already known;
this sprint fixes them in four ordered phases so that the application is correct, internally consistent,
visually modern, and renders correctly in both light and dark mode.

The four phases are executed strictly in order, and each phase ends with a TypeScript compile gate
(`npx tsc --noEmit`, zero errors) before the next begins:

1. **Phase 1 — Critical bug fixes**: theming conflicts and hardcoded colors that produce visibly broken
   UI.
2. **Phase 2 — Design system consistency**: single accent, corrected light-mode surface hierarchy,
   reskin of two "cyberpunk-aesthetic" surfaces, dead-code deletion, and a merge-safe `cn()`.
3. **Phase 3 — Beauty & modern aesthetics**: `next/font` typography, micro-interactions, beautiful
   empty/loading states, page-transition polish, and a unified `lucide-react` icon system.
4. **Phase 4 — Final polish & quality**: replace `window.confirm`, fix z-index/image/`any`-type issues,
   final static sweep, and verify with `tsc --noEmit` and `npm run build`.

**Accent decision (recorded):** Sprint 4 designates `--action-primary` (`#1D6EEB`, blue) as the single
brand accent. This is a deliberate, documented divergence from Sprint 3 governance (which names indigo
`#6366f1`), chosen because `--action-primary` is already the most widely wired token across the
component tree. See `design.md` "Accent Decision".

**Critical constraint:** This is controlled remediation, NOT a redesign. Changes MUST NOT break
AppShell scroll ownership (`app-shell.tsx` `.factory-workstation-frame` keeps `overflow-y-auto`),
routing, list virtualization, or backend/API contracts. `tokens.css` and `globals.css` are edited
intentionally per the approved design; `app-shell.tsx` is not touched.

## Glossary

- **Frontend**: The Next.js + React + TypeScript + Tailwind application rooted at `web/src`.
- **Theme**: The active visual mode, light or dark, controlled exclusively by the `data-theme`
  attribute on the root `<html>` element.
- **Design_Token**: A named CSS custom property defined in `web/src/styles/tokens.css` (or the
  globals token layer) — e.g. `--surface-card`, `--text-primary`, `--action-primary`, `--status-*`,
  `--z-toast`, `--border-focus`.
- **Hardcoded_Value**: A color, spacing, font, or z-index value written as a literal (hex, rgb/rgba,
  arbitrary Tailwind bracket value, or inline style) rather than referencing a Design_Token.
- **Accent**: The single brand-action color, `--action-primary` (`#1D6EEB`), used for primary actions,
  links, focus rings, and active states.
- **Surface_Token**: One of `--surface-app`, `--surface-shell`, `--surface-panel`, `--surface-card`,
  `--surface-elevated`.
- **Cyberpunk_Aesthetic**: The discouraged visual style characterized by cyan text, near-black
  hardcoded backgrounds, decorative monospace, UPPER_SNAKE_CASE labels, and wide letter-tracking.
- **Type_Gate**: A successful `npx tsc --noEmit` run (zero errors) executed at the end of a phase.
- **Build_Gate**: A successful `npm run build` run executed at the end of Phase 4 and after dependency
  installs.
- **Primitive**: A reusable UI component in `web/src/components/ui/*` (Button, Card, Badge, Field,
  EmptyState, ConfirmationModal, etc.).

---

## Requirements

### Requirement 1: Theming Correctness (Phase 1)

**User Story:** As a user on a dark-OS machine who selects light mode, I want the entire UI to render
in light mode, so that I never see a broken half-dark interface.

#### Acceptance Criteria

1. THE Frontend SHALL NOT contain any `@media (prefers-color-scheme: dark)` block that overrides
   `--surface-*`, `--text-*`, `--border-*`, or shadow Design_Tokens in `web/src/app/globals.css` or
   `web/src/styles/professional-enhancements.css`.
2. THE Frontend SHALL derive all Theme-dependent colors exclusively from the `[data-theme="light"]` and
   `[data-theme="dark"]` token blocks, such that rendered colors depend only on the `data-theme`
   attribute and not on the OS `prefers-color-scheme` preference.
3. WHEN a user with an OS dark preference selects light mode, THE Frontend SHALL render every screen in
   light-mode surfaces and text colors with no dark-surface bleed.
4. THE Frontend SHALL preserve dark mode rendering via the existing `[data-theme="dark"]` token block
   after the `prefers-color-scheme` blocks are removed.

### Requirement 2: Token-Driven Colors and Single Accent (Phase 1 & Phase 2)

**User Story:** As a developer, I want every color to reference a semantic Design_Token and a single
accent, so that theming is consistent and one change propagates everywhere.

#### Acceptance Criteria

1. THE Frontend SHALL reference a Design_Token for every color it sets in `.tsx`/`.ts` files, except
   for literals inside `tokens.css`, the `globals.css` token layer, and test files.
2. WHERE `web/src/components/toast-center.tsx` styles a tone, THE Frontend SHALL map success to
   `--status-success-*` tokens, error to `--status-danger-*` tokens, and the default to
   `--status-info-*` tokens, and SHALL NOT use hardcoded `rgba()` tone colors or `text-white`.
3. WHERE `web/src/app/error.tsx`, `web/src/app/not-found.tsx`, and
   `web/src/components/page-skeletons.tsx` set colors, THE Frontend SHALL replace dark-only hardcodes
   (`bg-[rgba(20,24,36,…)]`, `text-white`, `text-slate-300`, `text-slate-400`, `border-white/10`) with
   the corresponding `--surface-*`, `--text-*`, and `--border-*` tokens.
4. THE Frontend SHALL use `--action-primary` (`#1D6EEB`) as the single Accent for primary actions,
   links, focus rings, and active states, and SHALL NOT use `#6366f1`, `#3EA6FF`, or `#2DD4BF` as a
   literal outside `tokens.css`.
5. WHERE `web/src/app/globals.css` defines `--accent`, THE Frontend SHALL set `--accent` to
   `var(--action-primary)` rather than a raw `#6366f1` literal.
6. WHERE `web/src/components/premium-dashboard-page.tsx` uses
   `bg-[linear-gradient(90deg,#3EA6FF,#2DD4BF)]` or other `#3EA6FF`/`#2DD4BF` literals, THE Frontend
   SHALL replace them with `var(--action-primary)` or the appropriate Design_Token.

### Requirement 3: Button Focus Ring and Destructive Variant (Phase 1)

**User Story:** As a user, I want a consistent focus indicator and a destructive button that clearly
looks destructive, so that I can navigate by keyboard and recognize dangerous actions.

#### Acceptance Criteria

1. WHERE `web/src/components/ui/button.tsx` sets the base focus ring, THE Frontend SHALL use
   `focus-visible:ring-[color:var(--border-focus)]` rather than a hardcoded `#6366f1`.
2. THE Frontend SHALL render the `destructive` button variant using the existing `--action-destructive`
   and `--action-destructive-hover` Design_Tokens for background, with `--action-primary-text`
   foreground, and SHALL NOT introduce new red literals.
3. THE Frontend SHALL render the `destructive` button variant visually distinct from the `primary`
   variant, including the `data-variant` attribute reflecting `destructive` rather than collapsing to
   `primary`.
4. WHEN any interactive element receives keyboard focus, THE Frontend SHALL display a visible focus ring
   derived from `--border-focus`.

### Requirement 4: Surface Hierarchy and Cyberpunk Reskin (Phase 2)

**User Story:** As an operator, I want cards to stand out against the background and screens to look
clean and professional, so that the interface is easy to scan and trustworthy.

#### Acceptance Criteria

1. THE Frontend SHALL define light-mode Surface_Tokens as a monotonic light-to-light ramp where
   `--surface-app` ≤ `--surface-shell` ≤ `--surface-panel` ≤ `--surface-card` in lightness, with
   `--surface-card` and `--surface-elevated` being the lightest (white), so that cards are visually
   distinguishable from the background.
2. WHERE `web/src/components/work-queue-page.tsx` and `web/src/components/settings-users-tab.tsx` use
   the Cyberpunk_Aesthetic, THE Frontend SHALL replace `text-cyan-*` with `--text-*` tokens, near-black
   hardcoded backgrounds (`#151b24`, `#0a0e14`, `#0d1117`, `rgba(8,12,20,…)`) with `--surface-*` tokens,
   and cyan borders with `--border-subtle`.
3. THE Frontend SHALL render UI labels in `work-queue-page.tsx` and `settings-users-tab.tsx` in sentence
   case rather than UPPER_SNAKE_CASE, and SHALL remove decorative `font-mono` and reduce
   `tracking-[0.3em]` to at most `tracking-wide`.
4. WHERE interactive elements in `settings-users-tab.tsx` use an accent color, THE Frontend SHALL use
   `--action-primary` rather than cyan.
5. WHEN the reskin is complete, THE Frontend SHALL continue to render both the worker view and the
   coordinator view of `work-queue-page.tsx` correctly.

### Requirement 5: Dual-Theme Parity (Phase 2 & Phase 4)

**User Story:** As a user, I want every screen to look correct in both light and dark mode, so that I
can work comfortably in either.

#### Acceptance Criteria

1. THE Frontend SHALL render every remediated screen (`/`, `/work-queue`, `/settings`, the dashboard)
   correctly in both light and dark Theme, with no white text on white backgrounds and no unreadable
   contrast.
2. THE Frontend SHALL NOT display any residual Cyberpunk_Aesthetic decoration (cyan text, decorative
   monospace, near-black hardcoded surfaces) after the reskin.

### Requirement 6: Dead Code Removal and Class Merging (Phase 2)

**User Story:** As a developer, I want dead files removed and `cn()` to merge Tailwind classes safely,
so that conditional overrides win and no stray CSS can globally override tokens.

#### Acceptance Criteria

1. THE Frontend SHALL delete `web/src/components/ui/professional-button.tsx`,
   `web/src/components/ui/professional-card.tsx`, and `web/src/styles/professional-enhancements.css`,
   only after confirming each has zero imports.
2. THE Frontend SHALL implement `cn()` in `web/src/lib/utils.ts` using `twMerge(clsx(inputs))` so that
   later conditional class names override earlier conflicting base classes.
3. THE Frontend SHALL include `tailwind-merge` and `clsx` as dependencies of the `web` package.

### Requirement 7: Modern Typography and Theme Color (Phase 3)

**User Story:** As a user, I want fast-loading, crisp typography and a correct browser theme color, so
that the app feels modern and integrated with my device.

#### Acceptance Criteria

1. THE Frontend SHALL load the Inter font via `next/font/google` (with `subsets:['latin']`,
   `display:'swap'`, `variable:'--font-inter'`, `weight:['400','500','600']`) and apply the font
   variable to the root `<html>` element.
2. THE Frontend SHALL NOT contain a render-blocking `@import url("https://fonts.googleapis.com/…")`
   line in `web/src/app/globals.css`.
3. THE Frontend SHALL set `--font-sans` in `tokens.css` to lead with `var(--font-inter)` followed by
   `system-ui, -apple-system, sans-serif`.
4. THE Frontend SHALL configure the viewport `themeColor` in `layout.tsx` as a responsive array with a
   dark value (`#09111B`) for `prefers-color-scheme: dark` and a light value (`#f0f2f5`) for
   `prefers-color-scheme: light`.

### Requirement 8: Micro-Interactions and Beautiful States (Phase 3)

**User Story:** As a user, I want responsive hover/active feedback and informative empty/loading states,
so that the interface feels alive and I always understand system status.

#### Acceptance Criteria

1. THE Frontend SHALL apply to the button base `transition-all duration-150 ease-out` and
   `active:scale-[0.97]` while preserving the existing focus ring.
2. WHERE a card is interactive (a `group` card), THE Frontend SHALL apply
   `hover:border-border-secondary hover:shadow-sm transition-all duration-150`.
3. THE Frontend SHALL render the empty state (`web/src/components/ui/empty-state.tsx`) centered with a
   48px tertiary-colored icon, a 16px/500-weight `--text-primary` title, a 14px `--text-secondary`
   description (max-width 320px, centered), an optional primary CTA, and no container border.
4. THE Frontend SHALL render loading skeletons (`web/src/components/page-skeletons.tsx`) using the card
   radius (`rounded-xl` / `--radius-card`) and `bg-surface-card animate-pulse`, with card skeletons
   showing a header bar plus 2–3 body bars and table skeletons matching the real column count, so that
   no layout shift occurs on data arrival.
5. THE Frontend SHALL apply a fade-in page transition (`animate-in fade-in duration-200`) to routed page
   content, installing `tailwindcss-animate` if `animate-in` is otherwise unavailable.

### Requirement 9: Unified Icon System (Phase 3)

**User Story:** As a developer, I want a single icon system, so that icons are visually consistent and
maintainable.

#### Acceptance Criteria

1. THE Frontend SHALL replace hand-authored inline SVG icons in the sidebar, header, and navigation with
   `lucide-react` equivalents.
2. THE Frontend SHALL render sidebar navigation icons at `size={18} strokeWidth={1.5}` and header icons
   at `size={16} strokeWidth={1.5}`.
3. THE Frontend SHALL color icons with `text-text-secondary` by default and `text-action-primary` for
   the active or selected state.

### Requirement 10: Confirmation, Z-Index, Images, and Types (Phase 4)

**User Story:** As a user and developer, I want native confirms replaced by accessible modals, stable
image layout, and sound types, so that the app is accessible, stable, and maintainable.

#### Acceptance Criteria

1. WHERE `web/src/components/ocr-scan-page.tsx` uses `window.confirm`, THE Frontend SHALL replace it with
   the existing `ConfirmationModal` driven by `confirmOpen`/`pendingAction` state, using the
   `destructive` variant and a "Replace existing scan?" title.
2. WHERE `web/src/components/toast-center.tsx` sets a stacking level, THE Frontend SHALL use
   `z-[var(--z-toast)]` rather than `z-[70]`.
3. WHERE a raw `<img>` renders a blob/object-URL preview (e.g. in `ocr-scan-page.tsx`,
   `profile-page.tsx`), THE Frontend SHALL wrap it in an aspect-ratio container
   (`relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-surface-panel`) with the image absolutely
   filling it via `object-contain`.
4. WHERE a static image is rendered, THE Frontend SHALL use `next/image` with explicit `width` and
   `height` props.
5. THE Frontend SHALL replace `any` types in `web/src/lib/steel.ts` (~line 623, the `items` array) and
   `web/src/components/ocr-scan-page.tsx` (~lines 1289–1300, `result as any`) with the correct typed
   interfaces derived from the actual API/OCR response shapes.

### Requirement 11: Final Sweep and Verification (Phase 4)

**User Story:** As a maintainer, I want a final static sweep and a clean build, so that no regressions
or stragglers remain.

#### Acceptance Criteria

1. THE Frontend SHALL replace remaining `text-white` occurrences (outside test files) with
   `text-text-primary` or the appropriate `--text-*` token.
2. THE Frontend SHALL evaluate every six-digit hex literal outside `tokens.css`, `globals.css`, and test
   files and replace each with the nearest Design_Token.
3. THE Frontend SHALL remove decorative `font-mono` usage outside genuine code, keyboard-shortcut, and
   data-value contexts.
4. THE Frontend SHALL convert decorative `uppercase` UI labels to sentence case.
5. THE Frontend SHALL pass the Type_Gate (`npx tsc --noEmit`, zero errors) at the end of each phase.
6. THE Frontend SHALL pass the Build_Gate (`npm run build`, success) at the end of Phase 4.

### Requirement 12: Architecture Preservation

**User Story:** As a platform owner, I want the remediation to preserve critical architecture, so that
nothing regresses functionally.

#### Acceptance Criteria

1. THE Frontend SHALL preserve AppShell scroll ownership: `app-shell.tsx` `.factory-workstation-frame`
   SHALL retain `overflow-y-auto` and SHALL NOT be modified by this sprint.
2. THE Frontend SHALL preserve existing routing such that every route resolves to the same destination
   component after remediation.
3. THE Frontend SHALL preserve existing list virtualization behavior.
4. THE Frontend SHALL NOT change any backend endpoint, request parameter, or response field.
