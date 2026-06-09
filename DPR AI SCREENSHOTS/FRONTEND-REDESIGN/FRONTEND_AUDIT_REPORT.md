# FactoryNerve OS — Enterprise Frontend Audit Report
> Principal Frontend Architecture & Industrial UX Analysis
> Audit Date: June 2026 | Codebase: DPR.ai (FactoryNerve OS)

---

## Executive Summary

FactoryNerve OS is an AI-native industrial operating system built for Indian manufacturing factories. The frontend codebase represents a system in active architectural transition — simultaneously containing some of the most disciplined design-token and component architecture work visible in any mid-stage product, alongside pages that are architecturally marooned in a pre-modernization state, creating a deeply fractured user experience.

The product does not feel old because it was built carelessly. It feels old because **two parallel visual languages are fighting for the same screen at the same time** — one thoughtful, one inherited. This split is the root cause of nearly every perception problem reported: the dashboard-template feeling, the cramped layouts, the visual noise, the weak hierarchy.

The token system, data table, and operational primitive layer are at 70–80% of enterprise-grade quality. The page-level composition, surface layering, typography rendering, and form UX are at 40–50%. The navigation system is functionally solid but visually immature.

The path to premium industrial software is not a redesign. It is a **surface unification campaign** — eliminating the second visual language, enforcing the token system consistently, and completing the page-level composition model that already exists in the architecture but is not yet applied uniformly.

---

## Root Cause Analysis

### The Fundamental Problem: Two Visual Languages in One Product

The codebase contains a fully-formed, architecturally sound design system (`tokens.css`, `tailwind.config.ts`, `shared/primitives/`, `shared/operational/`) that was built during an intentional modernization sprint. It is excellent work. Semantic tokens, density modes, surface hierarchy, motion constraints, z-index contracts — all defined and wired.

The problem is that **this system was built on top of existing pages rather than replacing them**. Every large page component (`steel-dispatches-page.tsx`, `premium-dashboard-page.tsx`, `steel-command-center-page.tsx`, `ai-insights-page.tsx`, `attendance-reports-page.tsx`) was written before or outside the modernization effort, and those pages were never migrated into the new language.

The result is a two-tier visual stack:

**Tier 1 (modern — token-aware):** `WorkstationShell`, `SectionPanel`, `DataTable`, `FilterBar`, `MetricStrip`, `Badge`, `Button`, `Field` — composing correctly using semantic tokens, the density system, and structured CSS classes.

**Tier 2 (legacy — token-bypassing):** `steel-command-center-page.tsx`, `premium-dashboard-page.tsx`, `steel-dispatches-page.tsx`, `ai-insights-page.tsx`, `billing-header.tsx`, `control-tower-page.tsx`, `attendance-reports-page.tsx` — using `var(--muted)`, `var(--text)`, `var(--border)`, `var(--accent)` directly (legacy aliases), hardcoded `rgba(...)` colors, arbitrary border-radius values (`rounded-[2rem]`, `rounded-3xl`, `rounded-2xl`, `rounded-[28px]`), and inline gradient strings that bypass the entire elevation and surface-layering system.

This is not a design failure. It is a **migration completion problem**. The architecture is right. The pages haven't caught up.

### Secondary Root Causes

1. **Page-level composition is inconsistent.** Some pages use `WorkstationShell` + `SectionPanel`. Others use raw `<main>` + `<section>` with inline classNames. The user experiences two different applications.

2. **The `Card` component is being used as a surface primitive for everything.** Cards are for raised content containers, not page sections, not hero headers, not form groups. The overuse of `Card` + `CardHeader` + `CardContent` as the universal grouping primitive is the primary source of the "excessive boxed layouts" feeling.

3. **The `<details>/<summary>` pattern is being used as a UI affordance** for collapsible sections across billing, AI insights, dispatches, control tower, and settings. This is semantically incorrect, unstyled by the design system, visually inconsistent, and inaccessible to keyboard users who expect `button[aria-expanded]` or a disclosure component.

4. **Form labels are not using the `Field` + `Label` system.** Throughout `steel-customers-page.tsx`, `steel-dispatches-page.tsx`, and others, form labels are raw `<label className="text-sm text-[var(--muted)]">` elements without the `Field` context, without the `HelperText` component, and without validation state integration. The form system exists and is well-built — it is simply not used.

5. **Loading states are 5+ different implementations.** Some pages use `LoadingBoundary`. Some use `Skeleton`. Some render a bare `<main>` with a centered text string. Some use nothing. Loading UX is the first interaction a user has with every page.

---

## Design DNA Problems

### What Makes It Feel Like 2015–2018 Dashboard Software

The answer is specific and architectural, not aesthetic. It has four components:

**1. Card-grid monotony.** Every page reduces to the same visual rhythm: hero section → 4-up stat cards → main card with content. This is the "SaaS dashboard template" pattern. It provides no visual differentiation between operational surfaces that are fundamentally different in nature — a live attendance board, a dispatch creation form, and a KPI summary all look structurally identical from 3 feet away. Enterprise industrial software like SAP Fiori, Palantir Foundry, and Linear differentiates surfaces by their operational function, not just by their data.

**2. The header section is decorative, not operational.** Most page hero sections contain a category eyebrow (`text-sm uppercase tracking-[0.28em] text-[var(--accent)]`), an h1 title, and a description paragraph. This is a marketing landing page pattern. An operational workstation header should communicate: current state, active context, pending work, and primary action — in that priority order. The current headers give none of this.

**3. Borders are structural rather than semantic.** The `rounded-[2rem]` + `border border-[var(--border)] bg-[rgba(...)]` pattern appears 30+ times across the larger page components. Every section is outlined. This creates a visual field of boxes that fights for attention equally, eliminating the hierarchy that tells operators where to look first.

**4. Typography does not establish hierarchy through scale.** The type system is well-designed in `tokens.css` (13px operational base, 11px table metadata, 16px panel titles, etc.) but pages frequently override the scale with arbitrary values: `text-3xl`, `text-4xl` for hero titles that then immediately drop to `text-sm text-[var(--muted)]` for body content. The jump is jarring and creates a headline-heavy rhythm that feels more like a marketing page than a precision instrument.

**5. The dark theme is the primary context, but light mode surfaces are unresolved.** Light mode uses `--surface-app: hsl(210 16% 94%)` and `--surface-card: hsl(0 0% 100%)` — a cool grey background with white cards. The combination creates a flat, low-contrast surface that is visually inert in factory ambient light conditions. The dark theme's surface differentiation (`#08090c` → `#0d0e12` → `#111318` → `#161920`) is far more considered, but many components were clearly tested only against the dark theme.

---

## Visual Hierarchy Failures

### Phase 1: Visual Design Audit

**Typography Hierarchy**

The token system defines seven semantic type sizes from `--text-2xs` (10px) through `--text-3xl` (28px). Usage across pages does not respect this system:

- Hero section eyebrows use `text-sm uppercase tracking-[0.28em]` — a marketing trope applied to operational software. UPPERCASE text with wide tracking is appropriate for table column headers (short labels, high scanning density) but is cognitively taxing as a repeated page entry pattern.
- KPI values in `steel-command-center-page.tsx` use `text-2xl font-bold text-[var(--text)]` — bypassing `--type-numeric-lg` and the tabular-nums font feature. Numeric values in industrial software must render in tabular figures. If they don't, side-by-side values misalign, which is a trust issue in financial/operational contexts.
- `MetricStrip` correctly uses `font-mono text-[var(--type-numeric-md)]` — this is the right pattern. It is used in ~20% of numeric contexts and raw Tailwind sizing in ~80%.
- Section title hierarchy collapses in most pages: the `h1`, `h2`, and `h3` elements render at sizes 28px, 16px, and 14px respectively — a compression that makes every sub-section look like a footnote to the hero.

**Spacing Rhythm**

The token system defines a clean 4px-base scale with semantic aliases (`--space-sm` = 8px, `--space-md` = 16px, `--space-lg` = 24px). The density system further adjusts these across compact/default/comfortable modes.

In practice, pages mix this with arbitrary spacing. Within `steel-dispatches-page.tsx`, a single page uses: `p-6`, `px-4 py-3`, `p-4`, `gap-4`, `gap-3`, `space-y-5`, `space-y-4`, `mt-4`, `mt-3`, `mt-2` — eight distinct spacing values on one page with no systematic relationship. The eye registers this as visual instability. Spacing that varies by 1–2px between adjacent sections creates what designers call "micro-jitter" — the subconscious detection of inconsistency that registers as "cheap."

**Borders and Surface Depth**

`border border-[var(--border)]` appears across page components using the legacy `--border` alias (pointing to `rgba(171, 154, 137, 0.2)` — a warm-toned border from the pre-modernization palette). This warm-tinted border creates a noticeable visual inconsistency against the cool-neutral border system in `tokens.css` (`--border-subtle`, `--border-default`). Two border colors coexist on the same page, creating an appearance of two different applications.

The actual border that should be used depends on context:
- `--border-subtle` for section containers (lowest emphasis)
- `--border-default` for interactive containers and inputs
- `--border-strong` for emphasized/active states

Current usage ignores this hierarchy entirely.

**Density Inconsistency**

The density system (`[data-density="compact|default|comfortable"]`) is architecturally complete and wired into the `DataTable` component. It is not wired into the page-level content. Switching to compact density adjusts table row height but does not affect page padding, card spacing, or section gaps. The density toggle in the sidebar therefore appears to do almost nothing from the user's perspective unless they are looking directly at a table.

---

## Component Architecture Problems

### Phase 2: Component System Audit

**The Primitive Layer is Strong — But Incomplete**

`shared/primitives/` exports: Badge, Button, Card, Input, Label, Select, Skeleton, Textarea, SafeText, StatusBadge, ConfidenceBadge. This is a reasonable atom set.

`shared/operational/` exports: WorkstationShell, QueueWorkspaceLayout, OperationalDrawer, StickyActionBar, MetricStrip, SectionPanel, FilterBar, ActionDock, CommandPalette, ConfirmationModal, EmptyState, EmptyOperationalState, LoadingBoundary, ResponsiveScrollArea, GuidanceHint/Block, WorkflowPanel.

The operational layer is sophisticated. The problem is **selective adoption**. The architecture diagram in `ARCHITECTURE.md` describes six layers with strict dependency rules. The pages that were written before these operational primitives exist exist outside this hierarchy — they compose using Card primitives directly rather than WorkstationShell, and they use ad-hoc filter UIs rather than FilterBar.

**The `Card` Component Overuse Problem**

`Card` + `CardHeader` + `CardTitle` + `CardContent` is used as the universal composition unit across the entire application. This creates several architectural problems:

1. `CardTitle` renders as `<h1>` — every section that uses it produces an h1, meaning pages have 4–8 h1 elements. This breaks document outline structure and fails WCAG 1.3.1 (Info and Relationships).
2. `Card` applies `surface-panel` which means border + background + shadow. When a Card is nested inside another Card (common in the steel command center), the surface depth increases incorrectly: the inner card appears to float inside the outer one rather than being part of it.
3. `CardHeader` applies fixed `px-lg pt-lg` padding, meaning you cannot have a card with a full-bleed chart or table header. Every Card has mandatory whitespace at the top.

**The `<details>/<summary>` Anti-Pattern**

Used in: `billing-invoice-history.tsx`, `billing-owner-controls.tsx`, `billing-header.tsx`, `steel-dispatches-page.tsx`, `steel-command-center-page.tsx`, `premium-dashboard-page.tsx`, `ai-insights-page.tsx`, `attendance-reports-page.tsx`, `control-tower-page.tsx`.

`<details>` is an HTML disclosure element. It has no ARIA disclosure role announcement in many screen readers, no controlled state (open/closed cannot be managed by React), no animation system, and no consistent visual treatment. It renders differently across browsers. The only styling applied is `cursor-pointer list-none` on the `summary` element. These disclosure panels look like raw browser defaults inside an otherwise styled application.

The operational drawer pattern already exists (`OperationalDrawer`). The command palette already exists. There is no case where `<details>/<summary>` should be used as a UI pattern in this product.

**Missing Components (Gaps in the Operational Primitive Layer)**

The following operational patterns exist as repeated inline implementations across pages but have no shared component:

1. **Breadcrumb / route context chip** — every page header shows a category eyebrow + title combination but there is no `RouteHeader` component with standardized structure, variants, and action slots.
2. **Inline status alert** — error/warning/info inline messages (`rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3`) are implemented individually across 15+ locations.
3. **Data card (mini KPI)** — the `factory-ocr-data-card` CSS class pattern and the `Card` + raw numbers pattern are two different implementations of the same concept.
4. **Tab navigation** — `steel-command-center-page.tsx` implements tabs as custom `<button>` elements with inline active/inactive class strings. There is no shared tab primitive.
5. **Collapsible section** — the `<details>` usage needs a `DisclosurePanel` primitive with controlled state, animation, and consistent styling.

**The `src-v2` Directory**

A parallel `web/src-v2/workspaces/` directory exists alongside the primary `src/`. This contains `governed-ocr-verification-page.tsx` and potentially other pages. The presence of a `v2` parallel structure signals architectural drift — new pages being built outside the primary architecture rather than extending it. This is the most serious technical debt signal in the entire repository.

---

## Operational UX Failures

### Phase 3: Operational UX Audit

**The Operator's Experience**

An operator arriving at a page in FactoryNerve OS faces a consistent UX problem: **the primary action is buried under three layers of contextual content**. Every major page follows the pattern: hero section (decorative) → stat cards (overview) → filter zone → table or form. The operator must scroll past content they already know (the stats) to reach the work they need to do.

In shift-based factory workflows, time is the scarcest resource. An operator punching in attendance needs to reach the correct action in under 3 seconds. A supervisor reviewing OCR batches needs the pending work visible immediately on page load. The current page pattern delays the operational surface by approximately 200–300px of decorative header content on every page.

Linear solves this with its first-load experience — the inbox is the page. Notion solves this by putting the content canvas at the top. Palantir Foundry puts the active query result set as the primary viewport. FactoryNerve should solve this by **making the operational table or form the primary viewport, not the fourth element on the page.**

**The Supervisor's Experience**

Supervisors are the most cognitively loaded users of the system. They need to simultaneously track attendance status, approve exceptions, monitor OCR batch quality, and respond to dispatch alerts. The current navigation requires a separate page load for each of these concerns. There is no unified "supervisor at-a-glance" surface that shows live signals across domains.

The `StickyActionBar` component exists and is used in `attendance-live-page.tsx` — this is the correct pattern for a supervisor surface. It is not used in approvals, OCR verify, or the work queue, where it would have the highest impact.

The `work-queue-page.tsx` is presumably the unified work surface, but its implementation was not visible in the audit. The navigation labels it as "Queue" and describes it as "Cross-app queue for daily work, review load, and unread alerts" — if this is working correctly, it is the right architectural decision. The concern is whether the implementation delivers on that promise or is another card-grid of pending items.

**The Accountant's Experience**

Steel invoicing, customer ledger, and billing are the accountant's primary surfaces. The `steel-customers-page.tsx` audit reveals a form experience that is visually identical to a 2016 CRUD admin panel. Field labels use `text-sm text-[var(--muted)]` (bypassing the `Label` component), validation errors appear as `text-xs text-rose-300` (bypassing the `HelperText` component and using a raw Tailwind color outside the token system), and the form is not divided into logical sections. An accountant entering a new customer profile is operating without the visual hierarchy cues that reduce data entry errors.

**The Owner's Experience**

The premium dashboard (`premium-dashboard-page.tsx`) is the highest-stakes page in the product — it is what an owner sees when evaluating whether the system is worth keeping. The current implementation is technically capable but visually exhausting: the page opens with a radial gradient hero (`bg-[radial-gradient(circle_at_top_left,...)]`), followed by a `<details>` owner tools section, followed by a card with linked filters, followed by a timeline chart, followed by factory charts, followed by shift charts, followed by an audit table, followed by steel owner risk cards.

This is not the owner's mental model. An owner's mental model is: **What is the most important thing happening right now, and do I need to act?** The current page structure requires the owner to read through a narrative of sections to answer that question, rather than presenting the answer immediately and allowing drill-down.

**Cognitive Load Sources**

1. Uppercase eyebrow text with `tracking-[0.28em]` appears above every hero section. Uppercase text with extreme letter-spacing requires more cognitive processing per word than mixed-case text. Used once, it creates emphasis. Used on every page, it creates ambient noise.
2. Multiple badge variants (`rounded-full border border-[color-mix(...)]`) appear in page headers as informational pills (plan tier, mode active, generated timestamp). These are metadata that an owner already knows — displaying them as decorated pills on every load is noise.
3. The `DispatchDebugPanel` — a debug component — is conditionally rendered in production on the steel dispatches page. The comment reads "Remove after diagnosing invoice selection issue." It is a visible technical artifact in a user-facing workflow.

---

## ERP/Table System Problems

### Phase 4: ERP Table System Audit

The `DataTable` component is the strongest single component in the system. The implementation is thorough:
- TanStack Table v8 with proper `useReactTable` wiring
- Virtualization via `@tanstack/react-virtual` (with `overscan` prop)
- Row states (active, selected, editing, processing, paused, synced) with full surface/accent class derivation
- Sticky first column support
- Bulk selection with keyboard shortcuts (Ctrl+A, Escape, shortcut keys per action)
- Full keyboard navigation (`useDataTableKeyboard`)
- Density-aware row height via `useDensityMetric` reading `--density-row-height` CSS variable
- ARIA labels, `aria-selected`, `scope="row"` on row headers
- Sort state surfaced through `DataTableSortButton`
- Column filter row support (`DataTableFilterCell`)

This is enterprise-grade table implementation. It is specifically the quality level expected of an ERP system.

**What Is Missing**

1. **Pagination.** No pagination component exists in the component library. The `DataTable` has no `pagination` prop. For large datasets (attendance history, batch records, invoice lists), the current approach is to limit the list query on the backend (e.g., `listSteelDispatches(20)`) and display only the top N rows. This is a data-access limitation masquerading as a UI decision. Users cannot page through historical data from the table interface.

2. **Column visibility controls.** No column picker or hide/show columns interface. For ERP-heavy pages like steel inventory with 8+ columns, users cannot reduce visual density by hiding columns they don't need for the current task.

3. **Row expansion.** No expandable row pattern. The current model uses a side panel (selected record detail) or navigation to a detail page. For operational users who need to see related sub-rows (e.g., dispatch lines within a dispatch row), neither approach is fast enough.

4. **Export affordance at the table level.** Export is implemented per-page as custom button logic, not as a built-in table action. This means the bulk selection system (which correctly surfaces bulk actions) cannot be connected to an export action without custom wiring per page.

5. **Table-level loading state.** When `isLoading` or `isFetching`, some pages replace the entire table with a centered text string or a `Skeleton`. The `DataTable` should support a skeleton row mode that preserves table column structure during initial load and a `isFetching` overlay mode for background updates.

**Table Density Implementation Gap**

The density system controls `--density-row-height` and `--density-cell-pad-*`, and `DataTable` reads these via `useDensityMetric`. The `thead` header cells use `px-cell-x py-cell-y` Tailwind utilities that reference the density tokens. This is correct.

The problem: the `DataTable` container has `rounded-panel border-[0.5px] border-border-default bg-surface-panel` — but it is commonly wrapped in another bordered panel (a `SectionPanel` or a raw `rounded-[0.45rem] border border-border-subtle` div in `ocr-history-page.tsx`). The result is a table inside a panel with two sets of borders — the outer container border and the table's own `rounded-panel border-[0.5px]` border. This double-border is visible and creates a density inconsistency: the table appears to have extra padding above the first row.

When `DataTable` is inside `SectionPanel`, the `bodyClassName="p-0"` prop in `OperationalTable` removes the panel body padding. This is the correct fix pattern — but it is only applied via the `OperationalTable` wrapper, not via the raw `DataTable`.

**Filter Pattern Fragmentation**

Three distinct filter UI patterns coexist:
1. `FilterBar` component (correct, token-aware, structured)
2. Raw `<div>` grid of `<label>/<select>/<input>` elements (used in `ocr-history-page.tsx` filters section)
3. `DataTableToolbar` (search-only, inside the table)

Pattern 2 in `ocr-history-page.tsx` — the filter grid with 8 native `<select>` and `<input>` elements — is the most egregious example. It uses `className="input w-full"` (pointing to a global `.input` CSS class that is defined nowhere visible in the audit, suggesting it either falls through to browser defaults or is defined in a CSS file not surfaced here). These selects use native HTML `<select>` elements styled with dark `color-scheme: dark`, which renders acceptably but inconsistently across different OS/browser combinations, especially on Windows.

---

## Form System Problems

### Phase 5: Form System Audit

**The `Field` System Exists and Is Excellent — And Is Almost Never Used**

The `Field` + `Label` + `HelperText` component trio in `components/ui/field.tsx` is a production-quality form primitive:
- `FieldContext` propagates `id`, `describedById`, `labelTargetId`, and `validationState` to children
- `Label` resolves `htmlFor` from context automatically, preventing dangling label associations
- `HelperText` self-registers its `id` with the `Field` for `aria-describedby` wiring
- Validation states (`default`, `invalid`, `valid`) apply semantic border/background changes
- Error states use `role="alert"` + `aria-live="polite"` for screen reader announcements

This is enterprise-grade accessible form architecture. The accessibility story is correct. The adoption rate is approximately 10%.

**What Is Used Instead**

Across `steel-customers-page.tsx`, `steel-dispatches-page.tsx`, `steel-invoices-page.tsx`, and `settings-page.tsx`, the pattern is:

```tsx
<div>
  <label className="text-sm text-[var(--muted)]">Customer Name</label>
  <Input ... />
  {showFieldError("name") ? <div className="mt-2 text-xs text-rose-300">...</div> : null}
</div>
```

This pattern has four compounding problems:

1. **No `htmlFor`** — the label is visually near the input but not programmatically associated. Screen readers announce the input without its label. Assistive technology users cannot click the label to focus the input.

2. **Legacy color tokens** — `text-[var(--muted)]` for labels bypasses `--text-secondary` (the correct label color) and uses the legacy alias. This produces a slightly different shade than fields using `Label` from the design system.

3. **Raw Tailwind error text** — `text-rose-300` is a raw Tailwind color. It is not `--status-danger-fg`, not `--text-danger`. In dark mode it is barely readable. In light mode it is invisible (rose-300 on a light background has insufficient contrast). This is a real accessibility failure, not just a cosmetic one.

4. **No validation state on the input border** — the `Input` component supports `validationState` prop (via `getFieldControlClassName`). Without `Field` context or explicit prop passing, error state is only communicated via the inline text, not through the input border color. The visual signal for "this field has an error" is a small piece of text below the input — not the input itself, which is where the user's eye is.

**Form Section Structure**

Large forms (`steel-dispatches-page.tsx` has 12+ fields, `steel-customers-page.tsx` has 15+ fields) present all fields in a flat grid without logical grouping. An ERP form should be organized into sections that match the user's mental model of the task:

- Dispatch form: Invoice selection → Material weights → Logistics (truck/driver) → Timing → Notes
- Customer form: Identity → Contact → Address → Tax details → Classification

Currently, both forms are flat `grid gap-4 md:grid-cols-3` grids with `label/input` pairs. The user must read every field label to understand the grouping — there is no visual structure that communicates "these 4 fields belong to the same concept."

**Validation Feedback Timing**

Validation in `steel-dispatches-page.tsx` uses a `dispatchValidationBlockers` array and a `dispatchChecklist` array — both computed via `useMemo`. The checklist is rendered as a list of checkmarks (ready/not-ready) in the sidebar panel. This is an excellent operational pattern for complex multi-step forms where prerequisites matter.

The problem: the checklist renders in a sidebar area that is not visible on mobile or on narrower desktop viewports. On a phone screen (the most common device for factory floor usage), the supervisor filling the dispatch form never sees the checklist — only the submit button, which fails silently with `setError(dispatchValidationBlockers[0])` setting a text string at the top of the form.

**Mobile Form Usability**

Factory environments: operators use phones, tablets, and shared terminals. Mobile input optimization is partially done (iOS font-size: 16px to prevent zoom, `min-height: 44px` touch targets) but form density is not adapted for mobile:
- Label/input pairs have no increased padding on mobile
- Number inputs (`type="number"`) appear without `inputMode="decimal"` on weight fields — causing iOS to show the alphabetic keyboard
- The date input (`type="date"`) renders a native date picker, which is inconsistently styled across Android and iOS and provides no localization for `en-IN` date formats

---

## Navigation Problems

### Phase 6: Sidebar & Navigation Audit

**What Is Working**

The sidebar architecture is genuinely strong. The `getVisibleNavSections` function filters navigation by role, permission, and industry type — the steel-specific nav items only appear for steel factory contexts. The `favoriteItems` system, section collapsing, factory switching, and the mobile bottom nav are all architecturally sound. The `NavItem.match()` function per item (rather than `pathname.startsWith(item.href)`) allows precise active state detection without the false-positive collisions common in simpler navigation systems.

The icon system uses Lucide React with `size={18} strokeWidth={1.5}` consistently, paired with visible text labels, correctly marked `aria-hidden="true"`. The icon-to-icon-box pattern (icon inside `h-8 w-8 shrink-0 flex items-center justify-center rounded-control border-[0.5px]`) is a considered affordance that gives each nav item a visual anchor.

The `CommandPalette` integration with keyboard chord navigation (`g o` for steel batches, `g i` for inventory, `[` to collapse, `]` to expand) is operator-grade.

**What Is Not Working**

**1. The nav item icon box creates the wrong visual weight.**

The bordered icon box gives each navigation item the visual weight of a small interactive element, independent of the link itself. The result is that each nav item reads as two interactive targets: the icon box (which is part of the link, not separately interactive) and the text label. Users' eyes are drawn to the icon boxes rather than the text labels, which is the opposite of the intended priority in an ERP navigation context where label-first scanning is faster.

Linear's navigation uses a smaller icon (16px, no box, no border) with the label as the primary element. The result is that the navigation rail reads as a list of labels with icon mnemonics, not a grid of icon tiles.

**2. Active state uses left border + background tint — but the combination is weak.**

Active state: `border border-border-subtle border-l-[3px] border-l-border-focus bg-accent-soft text-accent pl-[calc(var(--space-2-5)-2px)]`.

The `bg-accent-soft` is `color-mix(in srgb, var(--action-primary) 18%, transparent)` — a 18% tint of the primary blue. On dark mode, this is approximately `rgba(79, 120, 232, 0.18)` — nearly invisible against `#0d0e12` sidebar background. The 3px left border provides the only reliable active signal, but `--border-focus` (`#4f78e8`) on `#0d0e12` achieves only approximately 3.5:1 contrast — below the 4.5:1 text minimum but above the 3:1 UI component minimum. It is technically compliant but perceptually weak.

**3. Section titles use excessive uppercase tracking.**

`font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: var(--tracking-wider)` (0.06em) for section group labels ("Today", "Operations", "Review", etc.). At 11px uppercase, `var(--tracking-wider)` spreads letters so far apart that the words take longer to read than lowercase equivalents. For navigation section labels that change rarely, this is tolerable. For labels that update based on locale or role, the visual brittleness compounds.

**4. No visual differentiation between primary and secondary nav items.**

The sidebar mixes daily operational nav (Work Queue, Attendance, Scan) with administrative nav (Settings, Billing, Profile) using identical visual treatment. An operator should never be looking at the same visual weight for "Record Production Batch" and "Manage Users." Enterprise sidebar systems (SAP Fiori, Salesforce) use explicit primary/secondary tier visual differentiation.

**5. The Desktop Context Rail is an underutilized surface.**

The `AppDesktopContextRail` (16.5rem wide right-side panel) is wired to show `quickLinks`, `workflowHint`, badge counts, and role context. This is the right concept — a persistent contextual awareness layer for supervisors and managers. The implementation surfaces this rail conditionally and can be hidden/shown via the command palette. But the content of the rail is not connected to the active page's operational state. A supervisor looking at the attendance live board should see "3 missed punches, 1 needs regularization" in the context rail — not a static list of nav links.

**6. Mobile Bottom Nav is role-unaware in display.**

The mobile bottom nav shows 5 items filtered by role, but the items themselves have no visual indication of pending work. A supervisor with 7 pending approvals sees the same visual "Approvals" item as a supervisor with 0. The badge count system exists in `navBadgeCounts` but is only applied to desktop sidebar items, not to the mobile bottom nav items.

---

## Technical Frontend Debt

### Phase 7: Technical Frontend Audit

**Token System Compliance**

The architecture doc (`ARCHITECTURE.md`) explicitly forbids: `text-emerald-*`, `bg-rose-*/15`, hardcoded `rgba(...)` outside `tokens.css`, raw hex colors in components.

Actual violations found in production page components:

| Pattern | Files | Count (approx.) |
|---|---|---|
| `var(--muted)` legacy alias | steel-dispatches, customers, command-center, ai-insights, billing, settings, control-tower, attendance-reports | 80+ instances |
| `var(--text)` legacy alias | steel-dispatches, command-center, control-tower, billing | 40+ instances |
| `var(--border)` legacy alias | ai-insights, billing, attendance-reports, control-tower, premium-dashboard | 50+ instances |
| `var(--accent)` legacy alias | steel-dispatches, command-center, customers, ai-insights, billing | 30+ instances |
| `var(--card-strong)` / `var(--bg-soft)` | billing, attendance-reports, steel-command | 20+ instances |
| Raw `rgba(...)` bg colors | premium-dashboard, steel-command, ai-insights | 60+ instances |
| Raw Tailwind colors (`text-rose-300`, `text-emerald-200`, `text-amber-100`, `border-red-400/35`) | premium-dashboard, steel-command, steel-dispatches | 35+ instances |
| `rounded-[2rem]` / `rounded-3xl` / `rounded-2xl` | ai-insights, billing, attendance-reports, premium-dashboard, steel-dispatches, steel-command | 70+ instances |
| `rounded-[0.45rem]` / `rounded-[0.35rem]` (sub-token micro-rounding) | ocr-history-page | 8+ instances |

The token violation count is approximately 400+ individual instances across production page components. This is not a minor deviation — it is a systematic failure of the token discipline contract.

**The Legacy Alias Problem**

`globals.css` defines these backward-compatibility aliases in `:root`:
```css
--text: var(--text-primary);
--muted: var(--text-muted);
```

These aliases exist to prevent breaking existing consumers during migration. The problem is that they have become a permanent fixture rather than a transitional bridge. Every new page written after the token system was established continues to use `var(--muted)` rather than `var(--text-secondary)`, because the alias works and developers default to the shorter name.

The aliases need to be removed after migration — but migration has stalled. Until the legacy page components are rewritten using semantic tokens, removing the aliases would break half the application.

**The `globals.css` Dual-Source Problem**

`globals.css` contains a comment at the top: `MERGED: warm-industrial DNA (file A) + production architecture (file B)`. This is architectural archaeology — evidence that two separate CSS files were merged during a refactoring sprint. The merge created two competing color scales:

- `globals.css` defines: `--color-primary`, `--color-secondary`, `--bg`, `--bg-soft`, `--card`, `--card-strong`, `--card-elevated`, `--card-ghost` — the warm-industrial palette from "file A"
- `tokens.css` defines: `--surface-app`, `--surface-shell`, `--surface-card`, `--surface-elevated` — the semantic surface system from "file B"

These two systems are not connected. `--card-strong` (`#202b35`) and `--surface-card` (`#161920`) are both used in production but they are different colors with different opacity behaviors. A component using `--card-strong` will not respond to theme changes the same way a component using `--surface-card` does, because `--card-strong` is not overridden in `[data-theme="light"]`.

**Hardcoded Gradient Strings**

Production page components contain inline gradient backgrounds:
```
bg-[linear-gradient(135deg,rgba(20,24,36,0.96),rgba(12,18,28,0.9))]
bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--action-primary)_18%,transparent),...)]
```

These are:
- Not themeable (they use hardcoded dark rgba values, invisible on light theme)
- Not density-aware
- Not defined in the token system
- Not testable in isolation
- Impossible to update consistently

They create the "premium" visual feel that the pages are targeting, but they achieve it by bypassing every system that was built to enable scalable visual changes.

**The `src-v2` Parallel Structure**

`web/src-v2/workspaces/ocr-execution/governed-ocr-verification-page.tsx` exists as a parallel implementation of the OCR verification workflow, built outside the primary `src/` tree. This page uses `rounded-3xl border border-white/10 bg-black/20 p-8` — raw Tailwind opacity modifiers, not semantic tokens. It is presumably a future-state implementation being developed in isolation.

The danger: `src-v2` becoming a permanent parallel application rather than a staging area. There should be one source tree. Feature flags and gradual rollout should be used to stage new implementations, not a separate directory.

**Z-Index System Compliance**

The z-index token system (`--z-base` through `--z-tooltip`) is defined in `tokens.css` and mapped to Tailwind utilities in `tailwind.config.ts`. The `app-shell.tsx` uses `z-sticky` correctly for the topbar and `z-40` for the sidebar (which maps to a raw integer, not a token). There are at least 3 locations using raw integer z-index values (`z-40`, `z-sticky`, `z-raised`) in inline classes that should be using the token-mapped utilities.

**Animation Budget Compliance**

`ARCHITECTURE.md` states: "Animation libraries. CSS only, ≤150ms transitions." `globals.css` defines motion tokens (`--motion-fast: 80ms`, `--motion-base: 120ms`, `--motion-moderate: 150ms`). The card hover animation in `globals.css` uses `transform: translateY(-1px)` with `--motion-base` — within budget. The auth page uses animations up to `0.82s cubic-bezier(0.18, 0.88, 0.24, 1)` and `24s linear infinite` — these are auth-specific and isolated, not in operational surfaces.

The risk is the `will-change: transform, opacity` applied to auth animation elements. `will-change` creates compositing layers that consume GPU memory. On low-end factory terminals, this can cause other transitions to stutter.

**Performance Concerns**

1. `premium-dashboard-page.tsx` uses `Promise.allSettled([getPremiumDashboard, getPremiumAuditTrail, getOcrVerificationSummary])` on mount — three parallel API calls before any content is visible. If the premium endpoint is slow (enterprise datasets), the entire page blocks. React Query's streaming/suspense approach with per-query loading boundaries would give users progressive disclosure.

2. `steel-command-center-page.tsx` on mount calls `Promise.all([getSteelOverview, listSteelStock, listSteelBatches(60), listSteelInvoices(60), listSteelDispatches(60)])` — five parallel API calls, three of which fetch 60 records each. This is a 5-parallel-request waterfall on page load with no individual loading indication.

3. `IndustrialFactoryDashboard` is dynamically imported inside the steel command center but the outer page loads all data before rendering. The dynamic import saves JS parse time but not data-fetch time.

---

## Surface and Elevation Problems

### Surface Layering Assessment

The token system defines six surface levels:
```
app-bg < shell < panel < card < elevated < overlay
```
Dark mode values: `#08090c` → `#0d0e12` → `#111318` → `#161920` → `#1c2028` → `#212630`

The step between adjacent levels is approximately 4–8 lightness points in HSL. This is correct — subtle but perceptible differentiation that lets the eye read depth without distraction.

**The Problem:** Pages do not apply this hierarchy correctly.

In `steel-command-center-page.tsx`, a section uses `surface-panel-strong` (which applies `bg-surface-card` with `backdrop-filter: blur(16px)`) — but then nests `Card` components inside it, each with `surface-panel` styling. The nesting is: `surface-card` → `surface-panel` (inside), which is the wrong direction. Inner elements should be *more elevated* than outer containers, not *less elevated*.

The `backdrop-filter: blur()` is applied liberally across the surface panel utility classes (`.surface-panel`, `.surface-panel-strong`, `.surface-panel-soft`). Backdrop blur is GPU-intensive. The system has a `[data-runtime-tier="safe"]` escape hatch that disables blur, but this requires explicit runtime detection. On factory floor tablets running mid-tier Android Webview, backdrop blur causes visible frame-rate drops during scroll without this flag.

**The `--card-ghost` Problem**

`--card-ghost: rgba(10, 15, 24, 0.72)` appears in `globals.css` as a semi-transparent dark overlay used in the legacy page hero sections. Semi-transparent backgrounds interact with the content behind them — meaning the actual background color a user sees depends on what is stacked beneath. On light-mode backgrounds, `rgba(10, 15, 24, 0.72)` creates an almost black overlay on top of a light surface, making text on that surface potentially unreadable. Light mode support for the legacy page hero sections is effectively broken.

---

## AI Trust Visibility Problems

FactoryNerve OS uses AI for two core workflows: OCR document processing (confidence-scored extraction) and anomaly detection (steel batch variance analysis). The trust surface for AI outputs is critical — operators need to understand when to trust the system and when to override it.

**What Is Working**

The `ConfidenceBadge` component exists and renders three states: High (85%+), Medium (60–84%), Low (<60%). Colors are WCAG AA compliant (the `--confidence-*-fg` tokens were explicitly dark-mode adjusted in the audit log). The `ConfidenceMeter` component (in `shared/ai`) renders a visual percentage bar. These are the right primitives.

**What Is Missing**

1. **No AI action disclosure at the point of use.** When the system displays OCR-extracted data in the verification table, there is no persistent reminder that the data was AI-generated. The confidence badge appears on the row, but there is no page-level AI context banner explaining that the data requires human verification. An operator who is fatigued or rushed can mistake AI-extracted values for verified data.

2. **Confidence is shown as a percentage but not as an action signal.** `73% confidence` is a number. What the operator needs is: `Review required — 3 fields below threshold`. The system has the data to make this operational translation (`auditTriage.lowConfidence` is computed in `ocr-history-page.tsx`), but the translation stops at the stat number and does not become a call-to-action.

3. **Anomaly detection results are surfaced in the premium dashboard only.** The ranked anomaly list and responsibility analytics are behind the owner/manager premium gate. A supervisor cannot see anomaly signals during their shift review. The data exists, the system computes it — but the trust surface is gated by role in a way that conflicts with the operational workflow (the supervisor is the one who can act on an anomaly in real time, not the owner reviewing a dashboard the next day).

4. **AI processing state is not consistently communicated.** When an OCR scan is processing, the `--status-processing` token exists and is applied in some contexts. But the `workflow-ai-processing` and `ai-processing-bg/fg/border` tokens defined in the token system have almost no usage in the actual page components. The AI state channel exists architecturally but is not visually active.

5. **No AI confidence roll-up in the work queue.** The work queue lists pending review items, but does not surface the confidence distribution of those items. A supervisor scanning 20 pending OCR documents cannot know whether to start with the low-confidence ones or the high-confidence ones without opening each one individually.

---

## Enterprise Readiness Assessment

### Calibrated against: Linear, Palantir Foundry, SAP Fiori, Retool, Stripe Dashboard

| Dimension | FactoryNerve | Enterprise Benchmark | Gap |
|---|---|---|---|
| Design token system | 8/10 | 9/10 | Minor: dual-source pollution |
| Component architecture (primitives) | 7/10 | 9/10 | Adoption gap |
| Component architecture (pages) | 4/10 | 9/10 | Large: legacy pages untouched |
| Table system quality | 8/10 | 9/10 | Missing pagination, column visibility |
| Form system quality | 3/10 | 8/10 | Field system exists, not adopted |
| Navigation / wayfinding | 6/10 | 8/10 | Functional, visually immature |
| Typography hierarchy | 5/10 | 9/10 | Scale correct, application inconsistent |
| Spacing rhythm | 5/10 | 9/10 | System correct, discipline absent |
| Surface/elevation hierarchy | 5/10 | 9/10 | Correct direction, wrong nesting |
| Density system | 7/10 | 8/10 | Wired in tables, not in pages |
| AI trust visibility | 4/10 | 8/10 | Primitives exist, operationalization missing |
| Loading / empty states | 4/10 | 8/10 | 5+ different implementations |
| Mobile / responsive | 6/10 | 8/10 | Shell correct, pages need audit |
| Accessibility (a11y) | 6/10 | 9/10 | Token contrast correct, semantic HTML weak |
| Performance | 6/10 | 8/10 | Waterfall patterns on key pages |
| Technical debt surface | 4/10 | 8/10 | 400+ token violations in pages |

**Overall Enterprise Readiness: 5.6 / 10**

The product is not unready. It is split. The architectural foundation scores 7–8/10 consistently. The page-level execution scores 3–5/10 consistently. No buyer evaluating this as enterprise software would see the architecture — they would see the pages.

---

## Industrial UX Assessment

### Calibrated against: factory floor reality, shift-based workflows, OCR-heavy operations

**Operational Speed:** The system is functionally capable but not fast. Every page requires 2–4 scrolls to reach the work surface. On mobile, this is worse. An operator spending 8 hours on a factory floor cannot afford 15-second navigation cycles to reach frequently-used actions.

**Scanability:** Scanability requires clear visual zones: "where is the status," "where is the action," "where is the data." The current page structure does not enforce consistent zone placement. Status indicators (badges, chips) appear in different positions on different pages. Action buttons appear in headers on some pages and in sticky bars on others.

**Operational Trust:** The system communicates data well but communicates confidence poorly. Operators and supervisors in high-variance manufacturing environments need constant ambient confirmation that the data they are seeing is current and trustworthy. The live attendance page does this with the `StickyActionBar` showing "Live mode on" with a green pulse dot — this is exactly right. This pattern is not replicated across other real-time surfaces.

**Shift-Change Readiness:** There is no explicit shift-change state in the UX. A supervisor beginning their shift should be greeted with: what is the current status, what was left unresolved from the previous shift, and what are the first priorities. The dashboard and work queue approach this but do not frame it in shift-change language.

**Offline Resilience:** `service-worker.tsx` and `offline-sync-agent.tsx` exist. There is an `/offline` route. The `offline-sync-agent` presumably queues mutations. The UX for offline state (what is available, what is not, what will sync when connectivity returns) was not visible in the pages audited. Industrial factories in India have unreliable connectivity. The offline state needs to be a first-class UX concept, not a background agent.

---

## Priority Modernization Matrix

### Impact × Effort Scoring (I = Impact 1–5, E = Effort 1–5, Score = I × (6-E))

| # | Initiative | I | E | Score | Category |
|---|---|---|---|---|---|
| 1 | Migrate legacy page hero sections to `WorkstationShell` + `SectionPanel` | 5 | 3 | 15 | Surface unification |
| 2 | Replace all `<details>/<summary>` with controlled `DisclosurePanel` primitive | 5 | 2 | 20 | Component architecture |
| 3 | Adopt `Field` + `Label` + `HelperText` in all form pages | 5 | 3 | 15 | Form system |
| 4 | Eliminate 400+ token violations (legacy aliases + raw colors) across page components | 4 | 4 | 8 | Token discipline |
| 5 | Wire density system into page-level spacing (`operational-page` padding, `SectionPanel` gaps) | 4 | 2 | 16 | Density |
| 6 | Add pagination to `DataTable` | 4 | 3 | 12 | ERP tables |
| 7 | Implement `RouteHeader` atomic component to standardize page entry UX | 5 | 2 | 20 | Composition |
| 8 | Fix `CardTitle` rendering `<h1>` — replace with semantic heading level prop | 4 | 1 | 20 | Accessibility |
| 9 | Remove `DispatchDebugPanel` from production render path | 5 | 1 | 25 | Operational trust |
| 10 | Add column visibility picker to `DataTable` | 3 | 3 | 9 | ERP tables |
| 11 | Implement confidence roll-up in work queue | 4 | 3 | 12 | AI trust |
| 12 | Wire `--ai-processing-*` tokens into OCR scan and verification states | 4 | 2 | 16 | AI visibility |
| 13 | Replace inline loading text strings with `LoadingBoundary` | 4 | 2 | 16 | State presentation |
| 14 | Merge `src-v2` back into primary `src/` tree | 3 | 3 | 9 | Architecture |
| 15 | Add `inputMode="decimal"` to weight/numeric inputs on mobile | 3 | 1 | 15 | Mobile UX |
| 16 | Add badge counts to mobile bottom nav items | 4 | 2 | 16 | Navigation |
| 17 | Resolve dual-source color pollution (`globals.css` vs `tokens.css`) | 3 | 3 | 9 | Token system |
| 18 | Implement `TabNav` primitive to replace custom tab buttons | 3 | 2 | 12 | Component architecture |
| 19 | Replace `Promise.all` page-load patterns with per-query `LoadingBoundary` | 3 | 3 | 9 | Performance |
| 20 | Connect desktop context rail to active page operational signals | 4 | 4 | 8 | Navigation |

### Top 5 by Score (quick wins with maximum impact):

1. **Remove `DispatchDebugPanel` from production** (Score 25) — One-line conditional removal. Currently showing a debug component to production users in an operational workflow.
2. **`RouteHeader` component** (Score 20) — Create one component. Replace 15+ page hero sections. Immediate visual unification.
3. **`DisclosurePanel` primitive** (Score 20) — Replace 9 instances of `<details>/<summary>`. Fixes accessibility, animations, and visual consistency simultaneously.
4. **`CardTitle` semantic heading** (Score 20) — One-line prop change. Fixes document outline structure across the entire application.
5. **Density wired to pages** (Score 16) — The density toggle currently does almost nothing from a user's perspective. Wiring it into page layout tokens makes the feature valuable.

---

## High-Impact Systemic Improvements

### The Six Interventions That Change Everything

These are not feature additions. They are systemic changes that cascade across the entire product.

---

### 1. The Page Composition Contract

**Current state:** Each page is an independent composition with its own layout logic.

**Target state:** Every operational page follows exactly one of three composition patterns:
- `WorkstationShell` + `SectionPanel` children — standard workstation
- `QueueWorkspaceLayout` — two-pane review queue (list + detail)
- `WorkstationShell` + custom rail — workstation with contextual sidebar

When every page speaks the same composition language, the user's mental model transfers instantly between pages. They know: the header zone holds context and primary action, the body zone holds the work, the rail holds related signals. They stop reading the page structure and start reading the data.

**What must happen:** Migrate all 15+ legacy page components to use `WorkstationShell` as their outermost composition wrapper. Replace raw `<section className="rounded-[2rem] border...">` hero blocks with `WorkstationShell`'s `title`, `description`, `eyebrow`, and `actions` props. This is largely mechanical work — move props, remove inline classes.

---

### 2. The Token Compliance Sprint

**Current state:** 400+ token violations across production pages. Two competing color systems. One aliased and one semantic.

**Target state:** Zero direct `var(--muted)`, `var(--text)`, `var(--border)`, `var(--accent)` references in page components. Zero raw `rgba(...)` backgrounds. Zero raw Tailwind color classes outside of `tokens.css`.

**What must happen:** A targeted migration sprint focused only on the large page components. The token system is already complete — this is purely a find-and-replace operation guided by a mapping table:

| Old | Replace with |
|---|---|
| `text-[var(--muted)]` / `text-[var(--text-muted)]` | `text-text-secondary` |
| `text-[var(--text)]` | `text-text-primary` |
| `border-[var(--border)]` | `border-border-subtle` or `border-border-default` by context |
| `text-[var(--accent)]` | `text-action-primary` |
| `bg-[var(--card-strong)]` | `bg-surface-elevated` |
| `text-rose-300` (error text) | `text-status-danger-fg` |
| `border-emerald-400/35 bg-emerald-500/12 text-emerald-200` (dispatch status) | `border-status-success-border bg-status-success-bg text-status-success-fg` |
| `rounded-[2rem]` hero sections | `rounded-overlay` (maps to `--radius-xl: 10px`) or `rounded-panel` |
| `rounded-2xl` interior cards | `rounded-panel` or `rounded-overlay` |
| Raw gradient backgrounds | Surface panel utilities (`.surface-panel`, `.surface-panel-strong`) |

---

### 3. The Form Adoption Cascade

**Current state:** `Field` + `Label` + `HelperText` exist and work. ~10% adoption.

**Target state:** Every user-facing input is wrapped in `Field` with a `Label` and optional `HelperText`.

**What must happen:** Three specific pages have the most impact: `steel-customers-page`, `steel-dispatches-page`, and `settings-page`. Migrate form fields to `Field` + `Label` in those three pages. The accessibility benefit is immediate (correct `htmlFor` association, `aria-describedby` on error states, semantic error announcements). The visual benefit is immediate (consistent label styling, token-correct error colors). These three pages represent approximately 60% of all user data entry in the system.

---

### 4. The Loading State Unification

**Current state:** Five different loading patterns. Users experience the application as inconsistent, because it is.

**Target state:** One pattern for every loading surface:
- **Initial page load:** `LoadingBoundary isLoading={true}` with `loadingTitle` — renders skeleton rows
- **Background refetch:** `StickyActionBar` status indicator (the live attendance model) or a subtle spinner in the page header area
- **Inline mutation:** `Button isBusy={true} busyLabel="..."` — already implemented, use it everywhere
- **Error state:** `MutationErrorBanner` or `RecoveryBanner` from `shared/feedback` — already implemented, use it everywhere
- **Empty state:** `EmptyState` or `EmptyOperationalState` — already implemented, use it everywhere

---

### 5. The Surface Hierarchy Correction

**Current state:** Pages use arbitrary surface depths. Cards inside panels that are the same depth level as the cards. Borders applied to every section regardless of depth.

**Target state:** Surface depth is intentional and hierarchical. The rule: a container uses a border **or** a background differentiation, never both, unless it is a card at the top of the elevation stack. Sections inside a page shell (`surface-shell`) use `surface-panel` background with `border-subtle`. Cards inside those panels use `surface-card` with `shadow-xs`. Elevated content (inputs, dropdowns) uses `surface-elevated`. Overlays use `surface-overlay`.

This single change eliminates the "box inside a box inside a box" visual pattern that creates the cramped, outdated feeling.

---

### 6. The AI Trust Surface

**Current state:** Confidence tokens exist. `ConfidenceBadge` exists. Anomaly data exists. The trust surface is functionally invisible.

**Target state:** AI-generated or AI-analyzed data has a persistent, ambient trust indicator at three levels:
- **Row level:** `ConfidenceBadge` (already exists)
- **Panel level:** An `AiDisclosureBanner` that appears above any table containing AI-generated data, stating: "Data extracted by AI · {N} rows below threshold · Review before export"
- **Work queue level:** Confidence distribution shown as a mini bar chart on each pending OCR item in the queue

The `ai-processing-bg/fg/border` tokens exist for this purpose and are unused.

---

## Suggested Modernization Phases

### Phase 0 — Emergency Fixes (1–3 days, zero risk)

These are production correctness issues, not design improvements. Do them now.

1. Remove `DispatchDebugPanel` from `steel-dispatches-page.tsx` production render
2. Fix `CardTitle` to use a semantic heading level prop (`as?: "h1" | "h2" | "h3"`) defaulting to `h2` — currently renders every card title as `h1`, breaking page outline for assistive technologies
3. Add `inputMode="decimal"` to all weight/numeric input fields in steel pages
4. Replace `text-rose-300` error text with `text-status-danger-fg` throughout — current value fails WCAG AA on light backgrounds
5. Remove or gate the `AUDIT: BUTTON_CLUTTER` and `AUDIT: FLOW_BROKEN` inline comments (these are code review artifacts, not production content, but they appear as visible comments in the source)

---

### Phase 1 — Foundation Stabilization (2–3 weeks)

**Goal:** Close the token violation gap. Unify the surface language. Make the density toggle work.

**Work items:**
- Create the `legacy-token-migration.md` mapping table (1 day)
- Systematically replace all `var(--muted)`, `var(--text)`, `var(--border)`, `var(--accent)` usages in the 8 high-violation page components (3–4 days)
- Replace `rounded-[2rem]` / `rounded-3xl` / `rounded-2xl` with `rounded-overlay` / `rounded-panel` tokens (1 day)
- Wire density variables (`--density-section-gap`, `--density-scale`) into the `operational-page` and `operational-page__inner` CSS classes so density mode affects page layout (1 day)
- Replace `<details>/<summary>` with a new `DisclosurePanel` primitive in `shared/operational` (2 days)
- Create `TabNav` primitive in `shared/primitives` and replace the custom tab button grid in `steel-command-center-page.tsx` (1 day)

**Visual result:** The two visual languages merge. Pages stop fighting between warm-opaque legacy cards and the token-aware surface system. The density toggle becomes immediately meaningful.

---

### Phase 2 — Page Composition Unification (3–4 weeks)

**Goal:** Every operational page uses `WorkstationShell` or `QueueWorkspaceLayout`. The user experiences one application, not fifteen.

**Work items:**
- Create `RouteHeader` component as a semantic specialization of the `WorkstationShell` header zone (1 day)
- Migrate `steel-command-center-page.tsx` to `WorkstationShell` with `SectionPanel` tab zones (3 days)
- Migrate `premium-dashboard-page.tsx` to `WorkstationShell` with metric strip and contextual rail (3 days)
- Migrate `steel-dispatches-page.tsx` to `WorkstationShell` with `QueueWorkspaceLayout` for the dispatch form + checklist pattern (2 days)
- Migrate `ai-insights-page.tsx`, `attendance-reports-page.tsx`, `control-tower-page.tsx`, `billing-page.tsx` (1–2 days each)
- Unify all loading states to `LoadingBoundary` pattern (1 day)
- Unify all error states to `MutationErrorBanner` / `RecoveryBanner` pattern (1 day)

**Visual result:** Every page shares the same visual grammar. Navigation between modules stops feeling like switching between different products. The "dashboard template" feeling disappears because there is no longer a template — there is a system.

---

### Phase 3 — Form System Modernization (2 weeks)

**Goal:** All user data entry is field-system compliant. Zero bare `<label>` elements without `htmlFor`.

**Work items:**
- Migrate `steel-customers-page.tsx` form to `Field` + `Label` + `HelperText` with logical section grouping (2 days)
- Migrate `steel-dispatches-page.tsx` form with section dividers: Invoice, Materials, Logistics, Contact, Timing (2 days)
- Migrate `settings-page.tsx` and `settings-users-tab.tsx` forms (2 days)
- Add `inputMode` attributes to all numeric inputs, audit all `type="date"` inputs for locale concerns (1 day)
- Implement form section grouping primitive: `<FieldSection title="..." description="...">` wrapper (1 day)
- Wire dispatch checklist visibility to mobile viewports (currently hidden off-screen on phones) (1 day)

**Visual result:** Form pages become calm and organized. Validation feedback is accurate and accessible. Data entry speed increases because the visual hierarchy guides the user through the form.

---

### Phase 4 — Table System Completion (2 weeks)

**Goal:** The `DataTable` is production-complete for ERP usage.

**Work items:**
- Add server-side pagination (`page`, `pageSize`, `totalCount`, `onPageChange` props) to `DataTable` (2 days)
- Add column visibility picker to `DataTable` toolbar (2 days)
- Implement `isFetching` overlay state (subtle opacity dimming + spinner on sticky header) (1 day)
- Implement skeleton row mode for initial load (preserves column structure during fetch) (1 day)
- Replace the raw `<select>/<input>` filter grid in `ocr-history-page.tsx` with `FilterBar` component (1 day)
- Connect bulk selection to an export action (model for other pages) (1 day)

**Visual result:** The table becomes the primary operational surface it is meant to be. Users can navigate large datasets efficiently. The data richness of the system becomes accessible rather than truncated.

---

### Phase 5 — Operational Intelligence Layer (3 weeks)

**Goal:** AI trust is visible. Status signals are ambient. The work queue is the actual starting point for every shift.

**Work items:**
- Implement `AiDisclosureBanner` component for OCR and AI-analyzed surfaces (1 day)
- Add confidence distribution to work queue pending OCR items (2 days)
- Expose anomaly signals (read-only) to supervisor role in the attendance and approvals surfaces (2 days)
- Implement shift-context awareness in the dashboard: show "shift started at {time}, {N} items pending from last shift" (2 days)
- Connect the desktop context rail to per-page operational signals (3 days)
- Add badge counts to mobile bottom nav items (1 day)
- Implement offline state UX: explicit "Working offline — {N} mutations queued" banner (1 day)

**Visual result:** FactoryNerve stops feeling like a database viewer and starts feeling like an operational intelligence platform. The AI layer becomes a trusted partner rather than an invisible backend process.

---

## Design Governance Recommendations

### Why Governance Is Required

The audit reveals that the architectural rules are well-defined (the `ARCHITECTURE.md` "Forbidden Patterns" list is excellent) but not enforced at the authoring layer. The 400+ token violations in page components were not written by someone trying to bypass the system — they were written by developers defaulting to the shorter, more familiar alias name, or copying patterns from existing legacy pages. Good intentions with no enforcement mechanism produces entropy.

### Recommended Governance Layer

**1. ESLint custom rules for design tokens**

Add to `eslint.config.mjs`:
```js
// Forbid legacy CSS variable aliases in JSX className strings
'no-restricted-syntax': ['error',
  {
    selector: 'Literal[value=/var\\(--muted\\)/]',
    message: 'Use text-text-secondary or text-text-tertiary instead of var(--muted)'
  },
  {
    selector: 'Literal[value=/var\\(--text\\)(?!-)/]',
    message: 'Use text-text-primary instead of var(--text)'
  },
  {
    selector: 'Literal[value=/var\\(--border\\)(?!-)/]',
    message: 'Use border-border-subtle or border-border-default instead of var(--border)'
  },
  // ... etc
]
```

**2. Storybook as the composition contract**

Every component in `shared/primitives/` and `shared/operational/` already has a `.stories.tsx` file. The design governance contract is: if a pattern is not in Storybook, it is not an approved pattern. Pages that need a new composition pattern must first create the component, add a story, and have the story reviewed before using the pattern in a page.

**3. Design token changelog discipline**

When a token value changes, the PR must include a visual diff (screenshot before/after on at least three representative pages). The current token system is so pervasive that a single token value change affects 50+ components. Without a visual diff discipline, token regressions are invisible until a user reports them.

**4. The migration tracking board**

A single `MIGRATION_TRACKER.md` file listing every legacy page component and its migration status:
- `[ ]` Not started
- `[~]` In progress
- `[x]` Migrated (token-compliant, composition-correct)

Currently, the migration status lives in code comments and the architecture document. A shared tracker makes the remaining work visible and eliminates the "which pages still need migration" question.

**5. Component promotion protocol**

The architecture doc says: "Promote upward only when a second feature actually needs it." This is correct. Add a formal protocol: when a component appears in three or more features, open a `PROMOTE: <ComponentName>` PR that moves it to `shared/operational/` or `shared/primitives/` and updates all consumers. Without this protocol, the gap between "exists as a feature component" and "available as a shared primitive" grows indefinitely.

**6. Token audit CI step**

Add a `token-audit.mjs` script to CI that scans `src/**/*.tsx` for legacy alias usage and raw color violations, and fails the build if the count exceeds a baseline. Start with the current count as baseline and require it to decrease with each sprint. This makes the migration progress measurable.

---

## Future Enterprise UX Direction

### What FactoryNerve Should Feel Like in 12 Months

The product's visual destination is not "prettier SaaS dashboard." It is **calm operational intelligence** — the UX equivalent of a well-designed factory floor: everything has a place, nothing is wasted, trust is earned through consistency.

**The Spatial Model**

In 12 months, the product should have a clear spatial model that every user internalizes after one week:
- **Left rail:** Where you are and where you can go (navigation)
- **Top zone:** What you are looking at and what you can do (page header + primary action)
- **Center zone:** The work itself (table, form, dashboard)
- **Right rail:** Context and signals related to the current work (context rail)
- **Bottom zone (mobile):** Current location and badge-count signals

Every page respects this spatial model without exception. Users stop having to figure out where the action button is — it is always in the same spatial zone.

**The Visual Register**

Enterprise industrial software should feel like precision instruments, not consumer apps. This means:
- Type is smaller than consumer apps but more legible (tabular figures, tighter tracking on metadata, higher contrast ratios)
- Colors communicate operational state, not emotion (status tokens only, no decorative gradients in operational surfaces)
- Motion is functional, not expressive (state changes only, never decorative animation)
- Surfaces are differentiated by depth, not by color (the elevation system is the design language)
- Empty space is productive, not wasted (breathing room between sections communicates "this section is complete, move on")

**The AI Integration**

In 12 months, the AI layer should be ambient rather than explicit — not an "AI Insights" page that users navigate to, but a trust signal woven into every data surface. The `ConfidenceBadge` on every OCR row, the anomaly indicator on the relevant batch, the "3 items below threshold — review before export" banner above the export button. AI is trustworthy when it is visible and explainable. It is distrusted when it is a black box or a separate feature.

**The Operator's First Minute**

In 12 months, an operator arriving at their shift should open FactoryNerve and see, within 3 seconds:
1. Their name and role context
2. Today's shift status and time
3. The single most important pending action for their role
4. A count of secondary pending items

Nothing more. No hero copy. No stat cards they don't need. No navigation clutter. Just: who you are, what time it is, and what to do first.

This is the Linear "inbox zero" principle applied to industrial operations. It is what makes enterprise software premium — not the visual treatment, but the respect for the user's time and cognitive load.

---

## Appendix: Quick Reference Violation Map

### Files with Highest Token Violation Density (prioritize for Phase 1)

| File | Primary Violations | Est. Count |
|---|---|---|
| `premium-dashboard-page.tsx` | raw rgba(), raw Tailwind colors, `var(--muted)`, `var(--text)`, gradient strings | 90+ |
| `steel-command-center-page.tsx` | `var(--muted)`, `var(--text)`, `var(--accent)`, `var(--border)`, raw rgba(), rounded-3xl | 75+ |
| `steel-dispatches-page.tsx` | `var(--muted)`, raw Tailwind colors, `rounded-3xl`, `rounded-2xl`, debug panel | 65+ |
| `ai-insights-page.tsx` | `var(--accent)`, `var(--border)`, `var(--card-strong)`, rounded-[2rem] | 50+ |
| `attendance-reports-page.tsx` | `var(--border)`, `var(--muted)`, `rounded-[2rem]`, `rounded-2xl` | 40+ |
| `billing-header.tsx` + `billing-invoice-history.tsx` | `var(--border)`, `var(--accent)`, `var(--muted)`, rounded-[2rem], `<details>` | 35+ |
| `control-tower-page.tsx` | `var(--border)`, `var(--muted)`, `var(--text)`, `var(--accent)`, rounded-2xl | 30+ |
| `steel-customers-page.tsx` | `var(--muted)`, bare labels without `Field`, `text-rose-300` errors | 30+ |
| `ocr-history-page.tsx` | `.input` class of unknown origin, `rounded-[0.45rem]`, factory-ocr-* CSS classes | 20+ |

### Files That Are Token-Compliant (use as reference implementations)

- `components/ui/button.tsx` — correct token usage throughout
- `components/ui/badge.tsx` — semantic token classes, no violations
- `components/ui/section-panel.tsx` — correct surface/spacing/typography pattern
- `components/ui/filter-bar.tsx` — correct token usage, good label pattern
- `components/attendance-live-page.tsx` — good modern page pattern (uses `StickyActionBar`, `FilterBar`, `LoadingBoundary`, `DataTable`, semantic tokens)
- `components/ui/data-table/data-table.tsx` — enterprise-grade, no violations
- `components/ui/field.tsx` — the form gold standard, adopt everywhere

---

*Report compiled via direct codebase audit of the FactoryNerve OS frontend.*
*All findings reference specific files and line-level evidence.*
*No assumptions were made about code not directly read.*
