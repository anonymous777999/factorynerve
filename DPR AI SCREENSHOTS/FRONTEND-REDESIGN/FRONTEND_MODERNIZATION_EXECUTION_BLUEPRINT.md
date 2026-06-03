# FactoryNerve OS — Frontend Modernization Execution Blueprint
> Principal Frontend Architecture & Industrial UX Transformation Strategy
> Status: Active Execution Document | Supersedes: Audit Phase Findings
> Reference: FRONTEND_AUDIT_REPORT.md

---

## PREAMBLE: What This Document Is

This is the operational execution contract for transforming FactoryNerve OS from a fragmented multi-language frontend into a unified, premium industrial operational platform.

It is not a redesign document. It is a systemic evolution strategy.

Every decision herein is constrained by three realities:
1. The architecture investment already made is sound and must be preserved
2. Production workflows must not be interrupted during transformation
3. The target is operational effectiveness, not visual aesthetics

Read this before writing a single line of modernization code.

---

---

## SECTION 1 — Executive Transformation Strategy

### What FactoryNerve Is Evolving Into

FactoryNerve OS is not becoming a better-looking dashboard. It is evolving into a **precision operational workstation** — a class of software that has more in common with air traffic control interfaces and surgical scheduling systems than with SaaS analytics products.

The distinction matters at every design decision. A SaaS dashboard optimizes for first-impression delight — the 30-second demo, the screenshot, the investor review. An operational workstation optimizes for the 300th hour of use — the shift supervisor who opens it at 6am, the operator who processes 40 OCR documents before lunch, the owner who reads the risk signals at 9pm. The people who use this product daily, under pressure, in environments where a mistake in data entry is a real business loss.

**The target product feeling has three qualities:**

**Calm.** Not minimal. Not sparse. Calm. A well-designed factory floor is not empty — it is dense with purposeful activity, but the layout is so legible that your eye lands on the right thing immediately. A supervisor standing at a terminal should be able to read the current state of their department in 4 seconds without hunting. Calm is achieved through consistent visual hierarchy, not through whitespace. It means every element earns its place, and no element competes with elements of higher operational priority.

**Intelligent.** The interface knows things. It surfaces AI confidence signals, anomaly indicators, and workflow states without requiring users to seek them out. Intelligent UX is proactive about context: when you open the dispatch form, the system already shows you which invoice has the highest remaining weight. When you open attendance review, the system already highlights the shift's critical exceptions. Intelligence in the UI means: the data the user needs most is already visible when they arrive.

**Trustworthy.** In industrial operations, trust is the product. Every data point shown must communicate its provenance: was this human-entered, AI-extracted, system-calculated, or imported? What is its verification status? When was it last confirmed? Trust is not achieved through design polish — it is achieved through information completeness and status visibility. A number without a source is noise. A number with a confidence level and a timestamp is operational intelligence.

### What "Modern Industrial Software" Means

Modern industrial software is not defined by its visual trends. It is defined by its operational performance characteristics:

- **Scan speed:** How fast can an experienced user find the critical signal on a page?
- **Action latency:** How many interactions between intent and execution?
- **State transparency:** Can the user always answer "what is the current state of this record?"
- **Error recovery:** When something goes wrong, does the interface tell you what happened and how to fix it?
- **Context preservation:** Does the interface remember where you were and what you were doing?
- **Density control:** Can power users see more data, and can casual users see less, without redesigning the page?

Linear achieves this for software teams. Palantir Foundry achieves this for data operations. SAP Fiori attempts it for enterprise processes. FactoryNerve must achieve it for Indian manufacturing factory floors — where the stakes are physical, the users are multilingual, the devices are varied, and the workflows are time-constrained.

### Why FactoryNerve Requires a Different UX Philosophy Than Startup SaaS

Startup SaaS UX philosophy:
- First-use delight over expert efficiency
- Feature discovery over workflow speed
- Emotional engagement over cognitive precision
- Visual novelty over visual consistency
- Mobile-first over workstation-first

FactoryNerve operational UX philosophy:
- Expert efficiency over first-use delight (operators use this 8 hours/day)
- Workflow speed over feature discovery (every second in the UI is a second not on the floor)
- Cognitive precision over emotional engagement (wrong data = real business loss)
- Visual consistency over visual novelty (consistency builds trust over 300 hours of use)
- Workstation-first with mobile adequacy (terminals, shared tablets, factory-floor phones)

The modernization strategy must be governed by this philosophical difference at every decision point.

---

---

## SECTION 2 — Frontend Transformation Principles

These are the foundational laws of the modernization. Every implementation decision is evaluated against them. They do not change between sprints.

### Principle 1: Operational-First UX

Every UI surface exists to complete a workflow, not to display information. The primary question for every page is not "what data does this show?" but "what action does this enable, and how fast can a user complete it?"

In practice: the most important action on any page must be reachable within two interactions from page load. If it requires scrolling, the layout is wrong. If it requires three navigations, the architecture is wrong.

### Principle 2: Trust-First UI

Every data point shown to the user must have a legible provenance signal. The UI must communicate, at all times: this data is live / confirmed / AI-extracted / pending verification / stale. Users operating on stale or unverified data in an industrial context make real mistakes with real consequences.

In practice: no number appears without a timestamp or status indicator. No AI-generated value appears without a confidence signal. No pending record appears without a clear unverified state indicator.

### Principle 3: Hierarchy-First Composition

Visual hierarchy is the primary design tool. Every page has exactly one primary element — the thing the user should look at first. Everything else is secondary or tertiary. The hierarchy must be achievable through size, weight, and spatial position alone — not through color, decoration, or animation.

In practice: if removing all color from a page makes it impossible to understand the hierarchy, the hierarchy is broken. Color is used only to communicate operational state — not to create visual interest.

### Principle 4: Typography-First Readability

Type is the primary medium of an operational interface. The typography system must optimize for reading speed under cognitive load, not for visual beauty. This means: appropriate size/weight contrasts between hierarchy levels, tabular figures for all numeric data, monospace for timestamps and codes, and restrained tracking (letter-spacing that aids reading, not decoration).

In practice: no uppercase label uses tracking wider than 0.06em. No body text uses font-size below 13px in default density. Every numeric value uses `font-variant-numeric: tabular-nums`.

### Principle 5: Calm-Density Systems

Density is not a visual preference — it is an operational mode. Compact density is for power users scanning large datasets. Default density is for standard operational workflows. Comfortable density is for review, approval, and audit work where data accuracy matters more than data volume.

In practice: the density system must propagate through every layer — table rows, form fields, card padding, section gaps, sidebar items. Switching density must visibly and meaningfully change the entire page, not just the table.

### Principle 6: Industrial Visual Language

Industrial interfaces communicate through precision, not persuasion. This means: surfaces are differentiated by elevation, not by color. Status is communicated through semantic tokens, not through decorative styling. Borders define structure, not decoration — a border on a panel means "this is a distinct operational zone," not "this looks nice."

In practice: every border in the application has a reason. "It looks contained" is not a reason. "It separates the filter zone from the data zone" is a reason.

### Principle 7: Workflow-Oriented Composition

Page layout follows workflow logic, not information architecture logic. An information architecture lens asks: "what categories of data exist?" A workflow lens asks: "what does the user do first, then second, then third?" The layout must mirror the task sequence, not the data taxonomy.

In practice: the dispatch creation page puts invoice selection first because that is the first workflow step, not because invoices are the most important data entity.

### Principle 8: AI-Visible Trust Systems

AI contributions to the interface must be visible as AI contributions, with explicit confidence and provenance. AI is not magic — it is a probabilistic system that sometimes extracts incorrect data. Making this visible is not a weakness — it is a trust signal. Users who understand AI limitations trust the system more, not less, because they know when to verify.

In practice: every surface that displays AI-extracted or AI-analyzed data has a persistent, ambient disclosure indicator. Confidence levels are shown as operational signals ("review required" / "high confidence") not as raw percentages.

### Principle 9: Audit-Aware Interaction Design

In manufacturing contexts, auditability is a legal and operational requirement. The interface must make it easy to answer: "who did what, when, to which record, with what outcome?" Audit events should be surfaced at the point of use, not hidden behind a separate audit log page.

In practice: every record that has an action history shows that history in a collapsible audit timeline at the record level. Destructive actions (delete, reject, override) require explicit confirmation with the consequence stated in plain language.

---

---

## SECTION 3 — Systemic Root Causes

### Why the Product Currently Feels Visually Outdated

The audit identified the technical causes. This section explains the systemic causes — the organizational and architectural conditions that produced the fragmentation.

**Root Cause 1: The Migration Was Built Alongside Production**

The token system, `WorkstationShell`, `SectionPanel`, `DataTable`, and operational primitives were built during an active sprint while the product was shipping new features. The result: the infrastructure was modernized, but the existing pages were not migrated before new pages were added. Each new page defaulted to copying the nearest existing page — which was still using the legacy visual language. The fragmentation compounded with each new page.

This is not a failure of discipline. It is the predictable outcome of building a new design system without a migration gate. Without a gate that says "new pages must use the new system," the system remains optional and legacy patterns persist indefinitely.

**Root Cause 2: The `Card` Component as Universal Container**

The `Card` component was adopted as the universal composition primitive because it is available, generic, and works everywhere. But `Card` is a surface-level primitive — it signals "this content is raised above the page surface." When applied to every grouping — page sections, form groups, KPI clusters, stat cards, hero banners — it loses that meaning. The surface becomes uniformly raised, creating a flat landscape of identically-depth containers. The eye has no guidance about what matters more.

This is the primary source of the "boxed ERP" feeling. The solution is not removing cards — it is restoring the hierarchy of surface levels by using cards only for card-level containers, and using `SectionPanel` for section-level containers, and using `WorkstationShell` for page-level containers.

**Root Cause 3: Composition Fragmentation Across Page Components**

Each of the ~15 large page components (`steel-command-center-page.tsx`, `premium-dashboard-page.tsx`, etc.) was composed independently. Each developer made independent spacing, border, radius, and color decisions. The decisions are not wrong individually — `rounded-[2rem]` on a hero section is aesthetically defensible. The problem is that 15 independent decisions produce 15 different visual grammars that all appear within the same navigation session.

Users cannot build a mental model of "this is how FactoryNerve looks" when every major surface looks different. The cognitive overhead of re-orienting to each page's layout is the hidden cost of composition fragmentation.

**Root Cause 4: The `<details>/<summary>` Proliferation**

The `<details>/<summary>` pattern spread across 9+ components because it is the fastest way to create a collapsible section without building a component. It requires no imports, no state management, no animation code. In a time-pressured development environment, this is understandable.

The consequences are: no controlled state (cannot programmatically open/close), no animation, no consistent styling, no keyboard interaction model, and semantic confusion (details/summary is an HTML disclosure primitive, not a UI panel pattern). Every instance represents a location where the interaction model is undefined and the visual behavior is browser-default.

**Root Cause 5: The Incomplete Density System**

The density system was built correctly at the token level and wired into the `DataTable` correctly. But it was not wired into page-level layout. The density CSS variables control row height and cell padding. They do not control `--space-lg` values or section gap in `operational-page__inner`. The result: the density toggle is functionally inert from the user's perspective unless they are actively comparing table row heights. A user switching to compact mode expects the whole page to compress — not just the table inside it.

**Root Cause 6: Legacy Alias Permanence**

`--muted`, `--text`, `--border`, `--accent` were defined as temporary aliases to ease migration. They became permanent. Every new page written by a developer who learned the codebase from existing pages inherited the alias pattern. The aliases work — they resolve to the correct colors in dark mode. The problem is that they create a false confidence: the page "looks right" but is not token-compliant, which means it will not respond correctly to future token changes, theme expansions, or white-labeling.

---

---

## SECTION 4 — Design DNA Reconstruction Plan

This section defines the new visual constitution of FactoryNerve OS. These are not aesthetic preferences — they are operational design specifications. They govern every component, every page, and every future addition to the system.

---

### 4.1 Typography System

**Operational Philosophy**

Typography in an industrial interface must optimize for three reading modes that occur simultaneously: **scan** (eye moving fast across a table or dashboard to find an anomaly), **read** (eye slowing down on a record detail to verify data), and **act** (eye landing on a label before making a decision). The type system must support all three with distinct visual signals for each mode.

**The Hierarchy Scale (7 levels)**

| Level | Token | Size | Weight | Tracking | Use |
|---|---|---|---|---|---|
| Page Title | `--type-page-title` | 18px | 600 | -0.02em | Page h1, major modal titles |
| Panel Title | `--type-panel-title` | 16px | 600 | -0.01em | SectionPanel headers, group titles |
| Body | `--type-body` | 14px | 400 | 0 | Descriptions, helper text, paragraph content |
| Table Cell | `--type-table-cell` | 13px | 400 | 0 | All table body cells |
| Label | `--type-label` | 12px | 500 | 0 | Form labels, filter labels, nav labels |
| Metadata | `--type-label-dense` | 11px | 500 | +0.03em | Timestamps, secondary badges, eyebrows |
| Micro | `--text-2xs` | 10px | 600 | +0.04em | Table column headers ONLY |

**The Numeric System**

All numeric values in the interface use tabular figures. No exceptions. This ensures that columns of numbers align correctly, that KPI comparisons are visually scannable, and that financial values communicate precision.

```
font-variant-numeric: tabular-nums;
font-feature-settings: "tnum" 1;
```

Large KPI values (production totals, revenue, weight in KG): `--type-numeric-lg` (28px, 700 weight, mono-stack)
Mid-tier metrics (counts, percentages): `--type-numeric-md` (18px, 600 weight)
Inline data values (table cells with numbers): `--type-numeric-sm` (14px, 400 weight, tabular)
Timestamps and codes: `--type-timestamp` (11px, 400 weight, monospace)

**Uppercase Usage Contract**

Uppercase is permitted in exactly three contexts:
1. **Table column headers** — 10–11px, weight 600, tracking ≤ 0.06em
2. **Section eyebrow labels** — 11px, weight 600, tracking ≤ 0.04em, color `text-tertiary`
3. **Navigation section group titles** — 11px, weight 500, tracking ≤ 0.06em

Uppercase is FORBIDDEN as:
- Hero section category labels on page load (these should use `text-tertiary` mixed-case eyebrow)
- Form field labels
- Button text
- Badge text
- Any text larger than 12px

The current pattern of `text-sm uppercase tracking-[0.28em] text-[var(--accent)]` on page hero sections violates this contract and must be eliminated. At 0.28em tracking on mixed-case 14px text, words like "Steel Operations" require approximately 30% more horizontal space and 15% more cognitive processing time than equivalent mixed-case text.

**Heading Hierarchy Discipline**

Every page must have exactly one `h1`. `CardTitle` must not render `h1` — it must accept a heading level prop defaulting to `h2`. The document outline must be semantically correct:

```
h1: Page title (WorkstationShell title prop)
h2: Section titles (SectionPanel title prop)
h3: Subsection titles, card titles within sections
```

No heading level may be skipped. No decorative element may use a heading tag for size purposes.

---

### 4.2 Spacing System

**Operational Philosophy**

Spacing in an industrial interface is not about breathing room — it is about grouping clarity. Tight spacing means "these elements belong together." Loose spacing means "these elements are separate concerns." The spacing system must be consistent enough that users internalize the grouping language without conscious effort.

**The Four Spacing Contexts**

**Micro spacing** (icon gaps, badge padding, inline element gaps): `--space-xs` (4px), `--space-sm` (8px)

**Component spacing** (padding within a component, gap between a label and its input): `--space-sm` (8px), `--space-md` (16px)

**Section spacing** (gap between sections within a page, padding around a panel's content): `--space-lg` (24px), `--space-xl` (40px)

**Page spacing** (outer page padding, gap between major page zones): `--space-5` (20px) mobile, `--space-6` (24px) tablet, `--space-6` to `--space-8` desktop

**The Density Multiplier**

All page-level spacing responds to the density mode. The `--density-scale` variable (0.75 compact / 1.0 default / 1.25 comfortable) must be applied to page-level gaps:

```css
[data-density="compact"] .operational-page__inner {
  gap: calc(var(--space-lg) * 0.75); /* 18px instead of 24px */
}
[data-density="comfortable"] .operational-page__inner {
  gap: calc(var(--space-lg) * 1.25); /* 30px instead of 24px */
}
```

**Section Rhythm Contract**

Every page has the same visual rhythm:
1. Page header zone — `--space-5` bottom margin
2. Metric/summary strip — `--space-lg` bottom margin
3. Filter zone — `--space-md` bottom margin
4. Primary content zone — fills remaining space
5. Rail/sidebar — `--space-lg` gap from main content

This rhythm must not vary between pages. When users navigate between the attendance board and the dispatch page, the layout settles in the same position.

**The Anti-Cramping Rule**

No two interactive elements (buttons, inputs, badges) may be closer than `--space-sm` (8px) to each other. No interactive element may have less than `--space-xs` (4px) internal padding. These are minimum values, not targets.

---

### 4.3 Surface System

**Operational Philosophy**

Surface depth communicates organizational hierarchy. The deepest surface (app background) is where the page lives. Panels sit above the page. Cards sit above panels. Elevated surfaces (inputs, active zones) sit above cards. Overlays (modals, drawers) float above everything.

This creates a three-dimensional workspace where depth communicates containment.

**The Six-Level Surface Hierarchy**

```
Level 0 — App floor:      --surface-app        (#08090c dark / #edeff2 light)
Level 1 — Shell:          --surface-shell      (#0d0e12 dark / #f1f3f5 light)
Level 2 — Panel:          --surface-panel      (#111318 dark / #f9fafb light)
Level 3 — Card:           --surface-card       (#161920 dark / #ffffff light)
Level 4 — Elevated:       --surface-elevated   (#1c2028 dark / #ffffff light)
Level 5 — Overlay:        --surface-overlay    (#212630 dark / #f9fafb light)
```

**The Border Philosophy**

Borders are structural, not decorative. The three border levels:

- `--border-subtle`: Section/panel containers at the same level as the page. Barely visible — communicates zone boundary, not visual emphasis.
- `--border-default`: Interactive containers, filter bars, input groups. Visible — communicates "this is an interactive zone."
- `--border-strong`: Focused elements, active selections, hovered interactive containers. Emphasis — communicates "this element is currently active."

**The Double-Border Anti-Pattern**

A container must not have both a visible border AND a background that distinguishes it from its parent. Choose one:
- If the container uses `--surface-card` background (visually distinct from `--surface-panel` parent): no border, or use `--border-subtle` at maximum
- If the container uses the same background as its parent: use `--border-default` to define the zone

The current pattern of `border border-[var(--border)] bg-[rgba(20,24,36,0.88)]` uses both a warm rgba background AND a border on the same element. On a dark surface, the rgba background already creates visible differentiation. The border is redundant and contributes to the "boxed" feeling.

**Panel Layering Rule**

A component may not use a surface level higher than its parent's level + 1. Cards inside a `surface-shell` section must use `surface-panel`, not `surface-elevated`. Inputs inside a `surface-card` must use `surface-elevated`. Skipping levels creates false visual depth.

**The Backdrop Blur Contract**

Backdrop blur (`backdrop-filter: blur()`) is permitted only on:
- Overlays (modals, drawers, command palette)
- The sticky topbar on scroll

Backdrop blur is FORBIDDEN on:
- Static page sections
- Cards within a page
- Hero sections
- Any surface that is not floating above an animated or content-dense background

The performance cost on low-end Android devices is real. The `[data-runtime-tier="safe"]` escape hatch exists — it must be the default path, not the exception.

---

### 4.4 Color System

**Operational Philosophy**

Color in an industrial interface communicates operational state, not visual personality. The neutral palette is the primary palette — 90% of the interface by area should use neutral surfaces and text. Color appears at point-of-use: on status badges, confidence indicators, anomaly highlights, and action elements. When everything is colored, nothing is emphasized. Color is maximally effective when it is rare.

**The Neutral-First Architecture**

Primary text: `--text-primary` — near-white in dark, near-black in light
Secondary text: `--text-secondary` — used for descriptions, metadata, supporting labels
Tertiary text: `--text-tertiary` — used for placeholders, timestamps, inactive labels
Disabled text: `--text-disabled` — used only for genuinely inactive/disabled states

The neutral stack must cover 85% of all text by word count across the application.

**Semantic Operational Colors**

These five operational colors cover all state communication needs:

| State | Color family | Token group | When to use |
|---|---|---|---|
| Success / Confirmed | Green | `--status-success-*` | Completed workflows, confirmed data, synced records |
| Warning / Attention | Amber | `--status-warning-*` | Degraded state, needs review, approaching limit |
| Danger / Error | Red | `--status-danger-*` | Failed operations, critical faults, blocked workflows |
| Processing / AI | Indigo | `--status-processing-*` | Active AI work, async operations, pending verification |
| Inactive / Paused | Slate | `--status-paused-*` | Held workflows, queued items, inactive records |

**AI Confidence Colors**

Three confidence states map directly to the three operational trust levels:

| Confidence | Token | Use |
|---|---|---|
| High (85%+) | `--confidence-high-fg` | Green — "proceed with confidence" |
| Medium (60–84%) | `--confidence-medium-fg` | Amber — "verify before proceeding" |
| Low (<60%) | `--confidence-low-fg` | Slate — "manual review required" |

These colors must appear only on confidence-related elements. They must not bleed into general status use.

**The Forbidden Color List**

The following must not appear in any component outside `tokens.css`:
- Raw hex colors (`#ff0000`, `#22c55e`, etc.)
- Raw rgba backgrounds (`rgba(20,24,36,0.88)`)
- Raw Tailwind color classes (`text-emerald-200`, `bg-rose-500/12`, `border-amber-400/35`)
- `color-mix()` inline expressions (these belong in tokens.css only)

---

### 4.5 Motion System

**Operational Philosophy**

Motion in an industrial interface is functional, not expressive. Every transition communicates one thing: a state change has occurred. The user's brain is busy. Motion must not demand attention — it must confirm decisions and smooth perceptual continuity.

**The Motion Budget**

```
--motion-instant:  0ms    — immediate state (checkbox, toggle)
--motion-fast:    80ms    — hover states, focus rings, badge swaps
--motion-base:   120ms   — button press, row selection, expand/collapse
--motion-moderate: 150ms — panel slide, drawer open (maximum allowed)
```

Nothing in the operational interface should take longer than 150ms to transition. This is a hard ceiling, not a guideline. The perception threshold for "this is slow" in operational software is approximately 200ms — staying at 150ms leaves a 50ms margin of safety under load.

**The Functional Motion Contract**

Motion is permitted for:
- Hover state background changes
- Focus ring appearance
- Button press/active feedback
- Panel and drawer slide-in
- Skeleton → content transitions
- Row state changes (active, selected, processing)

Motion is FORBIDDEN for:
- Page entry animations in operational contexts
- Decorative floating/parallax effects
- Route transition animations
- Idle/ambient animations on static content

**The prefers-reduced-motion Contract**

Every transition must respect `prefers-reduced-motion: reduce`. The token system already handles this in `tokens.css` by setting all motion tokens to `0ms` under the media query. This must not be overridden anywhere.

---

### 4.6 Density System

**Operational Philosophy**

Different roles use the interface differently. An operator recording a batch needs legible, touchable targets. A manager scanning 200 dispatch records needs compact, keyboard-navigable rows. An owner reviewing financials needs comfortable spacing for careful reading. The density system must serve all three without requiring different page implementations.

**Three Density Modes**

**Compact** — maximum data per screen, keyboard-first, power users:
- Row height: 28px
- Cell padding: 8px / 4px
- Icon size: 14px
- Section gap: 12px multiplied across the whole page

**Default** — operational standard, balanced:
- Row height: 40px
- Cell padding: 12px / 8px
- Icon size: 16px
- Section gap: 24px

**Comfortable** — review mode, approval queues, detailed reading:
- Row height: 48px
- Cell padding: 16px / 12px
- Icon size: 18px
- Section gap: 30px

**Density Propagation Scope (currently missing, must be added)**

The density system currently controls table-level tokens only. It must be extended to control:
- Page outer padding (`operational-page` padding-inline)
- Section gap (`operational-page__inner` gap)
- `SectionPanel` body padding (`px-lg py-lg`)
- `WorkstationShell` header padding
- `FilterBar` field gap
- `MetricStrip` card padding
- `Card` / `CardContent` padding

The implementation: CSS custom properties in density modifier blocks:
```css
[data-density="compact"] {
  --page-inline-pad: var(--space-3);
  --page-section-gap: var(--space-4);
  --panel-body-pad: var(--space-3);
}
[data-density="comfortable"] {
  --page-inline-pad: var(--space-8);
  --page-section-gap: var(--space-8);
  --panel-body-pad: var(--space-6);
}
```

---

---

## SECTION 5 — Core Primitive Modernization Roadmap

For each primitive: current problems → desired evolution → operational goals → migration strategy → propagation impact.

---

### 5.1 WorkstationShell System

**Current Problems**
The `WorkstationShell` component exists and is well-structured, but ~60% of page components bypass it entirely, composing their own hero sections with raw `<section>` elements, bespoke border radii, and inline gradient backgrounds. The result is that the shell is inconsistently adopted — some pages feel like they belong to FactoryNerve, others feel like independent mini-applications.

**Desired Evolution**
`WorkstationShell` becomes the **mandatory composition entry point** for every operational page. It must support:
- `variant` prop: `"workstation"` (default full-page layout) | `"queue"` (two-pane split) | `"focused"` (narrow single-focus, e.g., form-only pages)
- `eyebrow` prop: replaces the current `text-sm uppercase tracking-[0.28em]` pattern
- `liveIndicator` prop: boolean that shows a pulsing live mode dot and label in the header
- `metrics` prop: already exists — renders `MetricStrip` inline below the header
- `railContent` prop: replaces the manual right-rail pattern
- `isLoading` prop: renders page-level `LoadingBoundary` skeleton automatically

**Operational Goals**
Users should never need to re-orient to a page layout when navigating between modules. The header zone, the content zone, and the rail zone should always be in the same spatial position.

**Migration Strategy**
New wrapper — not a rewrite. Wrap existing page component body inside `WorkstationShell`. Remove the bespoke hero section. Move hero title/description into the `title`/`description` props. Takes 1–2 hours per page for a developer who knows the component.

**Propagation Impact**
Touches every page in the application. After completion: every page shares the same header composition, outer padding, rail structure, and loading behavior.

---

### 5.2 Sidebar System

**Current Problems**
The sidebar navigation is functionally complete but visually immature. The nav item icon box creates false visual weight. Active state contrast is below the perceptually reliable threshold. Section group titles use excessive tracking at an already-small size. Desktop context rail is not connected to page-level operational state.

**Desired Evolution**

**Nav item redesign (no architecture change — visual only):**
- Remove the `h-8 w-8 rounded-control border-[0.5px]` icon box wrapper. Replace with a plain inline icon at `size={16}` with a 4px right gap before the label.
- Increase label font size from `text-sm` to match `--type-body` (14px) for better readability
- Active state: replace `bg-accent-soft` (18% opacity, nearly invisible) with `bg-surface-selected` (more opaque, uses `--surface-selected: #12233f` in dark mode — clearly visible)
- Active left border: replace 3px with 2px, increase opacity to 100%

**Section group labels:**
- Remove uppercase, use `--type-label` (12px, 500 weight) mixed-case
- Reduce tracking to `--tracking-normal` (0em)
- This makes section labels easier to read without reducing visual differentiation

**Desktop context rail:**
- Wire to active page's `workflowHint` and add page-level signal props
- Each page registers its current operational signals via a context hook that the rail reads
- Example: on the attendance live page, the rail shows: working count, missed punch count, next action

**Propagation Impact**
Visual change only — no functional change. Immediate readability improvement across the entire navigation system. Desktop context rail wiring is new functionality, not a visual change.

---

### 5.3 RouteHeader System (New Component)

**Current Problems**
Each page implements its own hero section. 15 different visual treatments for the same conceptual element (page header with title, context, and primary action). The `WorkstationShell` partially addresses this but the header content structure still varies.

**Desired Evolution**
A new `RouteHeader` primitive that lives inside `WorkstationShell`'s header zone. Props:

```tsx
<RouteHeader
  eyebrow="Steel Operations"          // tiny, mixed-case, text-tertiary
  title="Dispatch"                    // h1, large, semibold
  description="..."                   // optional, text-secondary
  status={{ tone: "success", label: "3 ready" }}   // optional status badge
  liveSignal={{ active: true, label: "Live" }}      // optional live pulse
  meta={[                             // contextual chips
    { label: "Factory", value: "Unit 3" },
    { label: "Invoice", value: "INV-2024-0042" },
  ]}
  actions={[                          // primary + secondary actions
    { id: "submit", label: "Create Dispatch", variant: "primary" },
    { id: "draft", label: "Save Draft", variant: "outline" },
  ]}
/>
```

**Operational Goals**
Operators always know: where they are (eyebrow + title), what state the current workflow is in (status badge), what the active context is (meta chips), and what they can do (action buttons). All of this in a single consistent zone.

**Migration Strategy**
Create the component. Refactor `WorkstationShell` to accept a `header` prop that accepts a `RouteHeader` node. Pages gradually adopt as they are migrated.

**Propagation Impact**
One component change propagates correct header composition to all pages that adopt it. Zero page-by-page design decisions for page headers going forward.

---

### 5.4 Card System

**Current Problems**
`CardTitle` renders as `h1`. `Card` is used as a universal container at all depth levels. `CardContent` has fixed padding that prevents full-bleed content. No variant system — every card looks the same regardless of its operational role.

**Desired Evolution**

**Fix `CardTitle` heading level:**
```tsx
export function CardTitle({ as: As = "h2", className, ...props }) {
  return <As className={cn("text-panel-title font-semibold ...", className)} {...props} />;
}
```

**Add Card variants:**
- `variant="default"` — current behavior, `surface-panel` with border
- `variant="metric"` — compact, for KPI displays, no header padding
- `variant="operational"` — `surface-card`, stronger shadow, for primary work zones
- `variant="ghost"` — no border, no background, pure grouping container

**Add `CardContent` padding override:**
- Add `noPadding` prop for full-bleed chart/table scenarios

**Propagation Impact**
Fixing `h1` → `h2` immediately repairs the document outline across every page using `Card`. Variant system enables correct surface hierarchy without requiring full component migrations.

---

### 5.5 Form System

**Current Problems**
The `Field` + `Label` + `HelperText` system is built correctly but adopted in less than 10% of forms. Raw labels without `htmlFor`, error text using non-token colors, no form section grouping, validation state not propagated to input borders.

**Desired Evolution**

**`FieldSection` — new grouping primitive:**
```tsx
<FieldSection title="Logistics" description="Truck and driver details">
  <Field>...</Field>
  <Field>...</Field>
</FieldSection>
```
Renders a subtle divider + section label above a group of related fields. Makes multi-field forms navigable without a modal wizard.

**`Field` improvements:**
- Auto-generate `id` if not provided (already done)
- Add `horizontal` layout variant (label left, input right) for compact review forms
- Add `size` prop (`compact` / `default`) that overrides density for individual fields

**Validation pattern standardization:**
```tsx
// Required pattern going forward
<Field validationState={formErrors.truckNumber ? "invalid" : "default"}>
  <Label required>Truck Number</Label>
  <Input value={truckNumber} onChange={...} />
  {formErrors.truckNumber && <HelperText>{formErrors.truckNumber}</HelperText>}
</Field>
```

**Propagation Impact**
Adopting the `Field` system in three high-traffic form pages (dispatch, customer, settings users) immediately improves accessibility for every form field on those pages. The pattern becomes copyable by example.

---

### 5.6 DataTable System

**Current Problems**
Core table is enterprise-grade. Missing: pagination, column visibility, skeleton row mode, `isFetching` overlay, row expansion, and consistent filter integration.

**Desired Evolution**

**Pagination (server-side):**
```tsx
<DataTable
  pagination={{
    page: 1,
    pageSize: 50,
    totalCount: 240,
    onPageChange: (page) => setPage(page),
    pageSizeOptions: [25, 50, 100],
  }}
/>
```
Renders a `DataTablePagination` footer bar with: prev/next, page indicator, page size selector.

**Column visibility:**
```tsx
<DataTable
  enableColumnVisibility
  defaultHiddenColumns={["notes", "updated_at"]}
/>
```
Renders a column picker button in the `DataTableToolbar`. Persists visibility state to localStorage per table `ariaLabel`.

**Skeleton row mode:**
When `isLoading === true` and `skeletonRowCount` is provided, renders N skeleton rows with the actual column structure. Users see the layout before data arrives.

**`isFetching` overlay:**
When `isFetching === true` and data is already loaded, applies a subtle opacity pulse to the table body (not a spinner, not a blocking overlay — just a gentle dimming that communicates "this is updating").

**Row expansion:**
```tsx
<DataTable
  enableRowExpansion
  renderExpanded={(row) => <DispatchLineDetails lines={row.lines} />}
/>
```
Renders an expandable row body with the slot content. The expanded zone uses `surface-elevated` background. Collapse/expand via chevron in a pre-pended column.

**Propagation Impact**
Pagination unblocks all ERP data-heavy pages (inventory, dispatch history, batch records) that currently truncate to N records. Column visibility immediately reduces cognitive load on wide tables.

---

### 5.7 Drawer System

**Current Problems**
`OperationalDrawer` exists. `<details>/<summary>` is used instead of it in 9+ locations.

**Desired Evolution**

**`DisclosurePanel` — new primitive to replace `<details>/<summary>`:**
```tsx
<DisclosurePanel
  title="Dispatch Tools"
  defaultOpen={false}
  variant="surface"    // renders with surface-panel bg
>
  {/* content */}
</DisclosurePanel>
```
- Controlled via `React.useState` or `defaultOpen` for uncontrolled mode
- Animated with `--motion-base` CSS transition on height
- Keyboard accessible (button with `aria-expanded`)
- Consistent visual treatment across the application

`OperationalDrawer` (side panel): maintain current implementation, add `size` prop (`sm` 320px / `md` 480px / `lg` 640px / `full`) for different content densities.

**Propagation Impact**
Replacing all `<details>/<summary>` instances removes 9 accessibility violations and 9 instances of inconsistent visual behavior.

---

### 5.8 Tabs System

**Current Problems**
No shared tab primitive. `steel-command-center-page.tsx` implements custom tab buttons with inline active/inactive class logic.

**Desired Evolution**

**`TabNav` — new primitive in `shared/primitives`:**
```tsx
<TabNav
  tabs={[
    { id: "overview", label: "Overview", hint: "Live command view" },
    { id: "inventory", label: "Inventory", hint: "Stock trust" },
  ]}
  activeTab={activeTab}
  onTabChange={navigateTab}
  disabledTabs={!isSteelFactory ? ["inventory", "production", "sales", "risk"] : []}
  variant="surface"   // renders on surface-panel-soft bg
/>
```

Design: horizontal pill tabs with active state using `surface-selected` background and `border-focus` left indicator (on mobile: scrollable horizontal). Tab hints appear as `text-tertiary` text below the label on desktop only.

**Propagation Impact**
Replaces custom tab logic in steel command center. Provides a reusable primitive for all future tabbed workspaces.

---

### 5.9 AI Components

**Current Problems**
`ConfidenceBadge` and `ConfidenceMeter` exist. `AiDisclosureBanner` does not exist. AI state tokens (`--ai-processing-*`) are defined but unused. Confidence signals are isolated to OCR surfaces.

**Desired Evolution**

**`AiDisclosureBanner`:**
```tsx
<AiDisclosureBanner
  source="OCR extraction"
  confidence="medium"      // high | medium | low | mixed
  reviewedCount={3}
  totalCount={12}
  onReviewAction={() => router.push('/ocr/verify')}
/>
```
Renders a calm, low-profile banner above AI-assisted data tables: `"AI-extracted data · 3 of 12 rows below confidence threshold · Review before export"`. Uses `--ai-processing-bg/fg/border` tokens. Not alarming — ambient and informational.

**`AnomalyStrip`:**
A compact horizontal strip showing anomaly signal count and severity for steel/production pages. Replaces the ad-hoc anomaly display in the premium dashboard.

**`AiStatusIndicator`:**
Inline processing indicator for when AI is actively analyzing: small animated indigo dot + "Processing..." label using `--status-processing-*` tokens.

**Propagation Impact**
`AiDisclosureBanner` on OCR history, OCR verify, and work queue immediately makes the AI trust layer visible to all users who interact with AI-processed data.

---

---

## SECTION 6 — Operational Workspace Evolution

### The Workspace Composition Standard

Every workspace in FactoryNerve maps to one of three composition patterns. This is a mandatory standard, not a recommendation.

**Pattern A: WorkstationShell + SectionPanel stack**
For: single-mode data-heavy pages (inventory, dispatch list, attendance list, customer ledger)
Structure: RouteHeader → MetricStrip → FilterBar → DataTable (inside SectionPanel)

**Pattern B: QueueWorkspaceLayout**
For: two-pane review/approval workflows (OCR verify, approvals queue, attendance review)
Structure: Left pane (list) + Right pane (detail/action). Both panes scroll independently.

**Pattern C: WorkstationShell + contextual rail**
For: command center and dashboard pages (steel hub, premium dashboard, control tower)
Structure: RouteHeader → primary content → right rail with signals and quick-nav

---

### 6.1 OCR Workspace Evolution

**Current state:** Multi-step wizard with its own shell (`OcrShell`), custom sidebar, and a filter grid using native `<select>` elements outside the `FilterBar` system.

**Target state:**

The OCR history page adopts `QueueWorkspaceLayout`:
- Left pane: `DataTable` with the `AiDisclosureBanner` above it
- Right pane: selected record detail with `ConfidenceMeter`, audit timeline via `AuditTimeline` component, and export action
- Filter zone above the table uses `FilterBar` (not raw selects)
- `AiDisclosureBanner` shows confidence distribution across all visible records

The OCR scan page retains its current immersive scanner mode (scanner route is already flagged as immersive in the shell).

The OCR verify page adopts `QueueWorkspaceLayout` with:
- Left pane: pending document queue with confidence badges and status
- Right pane: verification workspace with field-by-field AI extraction display and human override inputs

**Operational Zones for OCR:**
1. Scan zone (immersive, camera-focused)
2. Queue zone (list of pending documents with AI signals)
3. Verify zone (document review with field confidence and override)
4. History zone (approved documents with export)

---

### 6.2 Approval Workspace Evolution

**Current state:** `approval-queue-workspace.tsx` exists. The adapter pattern is solid. Visual treatment needs to align with the modernized system.

**Target state:**

`QueueWorkspaceLayout` with:
- Left pane: approval queue using `DataTable` with `getRowState` wired to approval status
- Bulk selection enabled for batch approve/reject operations
- Right pane: approval detail with the `AuditTimeline` showing evidence and lineage
- `StickyActionBar` above the left pane showing queue summary (N pending, N high-priority)

The key operational improvement: the approval batch action bar must be keyboard-accessible. A supervisor reviewing 40 pending attendance regularizations should be able to: select all (Ctrl+A), review the top item, approve it (keyboard shortcut), advance to next (arrow key), reject another, approve batch (keyboard shortcut). The `DataTable` keyboard system already supports this — it needs to be wired to the approval actions.

---

### 6.3 Attendance Workflow Evolution

**Current state:** `attendance-live-page.tsx` is one of the most modern pages — uses `StickyActionBar`, `FilterBar`, `LoadingBoundary`, `DataTable`. Use this as the reference implementation.

**Target state:**

The attendance live page is already close to the target. Remaining improvements:
- Route header using `RouteHeader` component with `liveSignal` prop (the pulsing dot is currently in the `StickyActionBar` — move it to the page header where users see it first)
- Missed punch rows should use `getRowState` returning `"processing"` — highlights them in the amber processing background immediately visible on load
- The review queue link from the `StickyActionBar` should pre-populate the review page with the first missed-punch record — already partially implemented, confirm it works on mobile

---

### 6.4 Dispatch Workflow Evolution

**Current state:** Single large page. No workflow zoning. Debug panel in production. Form fields without `Field` context. Custom status badge classes.

**Target state (Pattern A with embedded form):**

The dispatch page must make the workflow sequence explicit:

**Zone 1 — Context (sticky, always visible):**
`RouteHeader` with: title "Create Dispatch", meta chips showing active invoice if selected, `status` showing readiness checklist count (e.g., "4/5 checks clear")

**Zone 2 — Invoice Selection (full attention, first action):**
Large `SectionPanel` titled "Select Invoice" with the invoice select, the invoice summary snapshot (ordered/dispatched/remaining), and the "Use remaining weights" shortcut. Nothing else.

**Zone 3 — Material Weights (second action):**
`SectionPanel` titled "Material Lines" with the line weight grid. Shows remaining quantities inline next to each input. Overweight warning appears inline next to the line, not in a separate section.

**Zone 4 — Logistics (third action):**
`SectionPanel` titled "Truck & Driver" using `FieldSection` grouping. All fields use `Field` + `Label` + `HelperText` with proper validation state.

**Zone 5 — Actions (always visible at bottom):**
`StickyActionBar` with: readiness summary on the left, "Save Draft" and "Post Dispatch" on the right. The checklist moves into a `DisclosurePanel` inside Zone 1 (not hidden in a sidebar), visible by default on mobile.

Remove `DispatchDebugPanel` entirely.

---

### 6.5 Inventory/Steel Hub Evolution

**Current state:** `steel-command-center-page.tsx` is the most visually fragmented page. Uses raw gradients, legacy tokens, `<details>` for tools, custom tab buttons.

**Target state (Pattern C — command center with rail):**

The steel hub adopts `WorkstationShell` with `variant="focused"` for the tab content zones.

**Command bar (above tabs):**
`RouteHeader` with: eyebrow "Steel Operations", title derived from active factory, status badge showing overall system health, actions: "Record Batch", "Create Dispatch" (primary actions, always visible, not in a collapsible).

**Tab zone:**
`TabNav` component replacing the custom button grid. The tab content zones use `SectionPanel` containers, not raw bordered divs.

**Context rail:**
Wired to show: live stock trust counts (green/yellow/red), top anomaly signal, outstanding invoice amount. Updates when the tab changes.

**Remove:**
- The `<details>` "Dispatch tools" collapse pattern
- The `<details>` "Owner tools" collapse pattern
- All `rounded-[2rem]` hero sections
- All `var(--text)` / `var(--muted)` / `var(--accent)` usages

---

---

## SECTION 7 — Enterprise Table Evolution Strategy

### Why Tables Determine ERP Quality Perception

In enterprise software evaluation, tables are the primary quality signal. A table is not a data display — it is the primary operational instrument. ERP users spend 60–80% of their active time inside tables: scanning rows, filtering, sorting, selecting, taking actions, reviewing status. The quality of the table directly determines the quality of the software in the user's perception, because it is what they interact with the most.

A table that is slow to render, difficult to scan, visually inconsistent, or lacking in operational affordances (bulk actions, row states, keyboard navigation) will be perceived as inferior software regardless of how good the surrounding interface is. Conversely, a table that is fast, dense, readable, keyboard-navigable, and responsive to operational state creates a powerful "this software is serious" impression that elevates the entire product.

FactoryNerve already has an excellent technical foundation for tables. The evolution is about completing the operational layer on top of that foundation.

---

### 7.1 Table Architecture Philosophy

**The operational table as a workstation instrument, not a data grid.**

A data grid asks: "what data is stored?" An operational table asks: "what does the user need to do with this data right now?"

The difference manifests in:
- Row states that communicate workflow position (pending, processing, approved, blocked)
- Inline actions that are scoped to the current operational context (not a generic "edit" button)
- Bulk actions that map to real workflow operations (not a generic "delete")
- Filter persistence that remembers the user's operational focus (not reset on navigation)
- Sort defaults that mirror the operational priority (most urgent first, not newest first)

---

### 7.2 Operational Scanning System

**The scan zone model for ERP tables:**

Every table in FactoryNerve has exactly three scan zones:

**Primary scan zone** (column 1, sticky): The record identifier. The first thing the eye sees. Typically: document name/number, batch number, employee name, invoice number. This column never scrolls away. It carries the row state accent (left border color).

**Status scan zone** (always visible on load, near primary): The workflow state of the record. Status badges (`Badge` component) using semantic tokens. For tables with operational urgency (approvals queue, missed punch list), this column should be immediately adjacent to the primary column.

**Data zone** (remaining columns): Supporting data. Numerics right-aligned with tabular figures. Dates in compact localized format (28 May, not 2024-05-28). Weight in formatted KG with comma separation. Financial values in INR with no decimal for whole numbers.

**Action zone** (last column, right-aligned, appears on row hover in default density, always visible in comfortable density): Per-row actions. Maximum 2 actions visible at once — primary action (e.g., "Open", "Approve") and secondary (e.g., "Excel", "Reject"). Additional actions behind a `...` overflow menu.

---

### 7.3 Row State Semantics

The `DataTable` already supports row states. The operational mapping must be standardized:

| Workflow state | Row state | Visual effect |
|---|---|---|
| Currently selected for review | `"selected"` | `--surface-selected` bg, focus ring |
| Active/current item (e.g., next in queue) | `"active"` | `--workflow-active-bg`, blue left accent |
| AI processing in progress | `"processing"` | `--status-processing-bg`, indigo left accent |
| Approved / confirmed | `"synced"` | `--status-synced-bg`, green left accent |
| Paused / on hold | `"paused"` | `--status-paused-bg`, slate left accent |
| Editing in-place | `"editing"` | `--surface-elevated` bg, focus ring border |

These states must be wired into the table via `getRowState` prop on every operational table in the system. Currently, most tables do not pass `getRowState` — rows are visually uniform regardless of their workflow position.

---

### 7.4 Sticky Header & Scroll Behavior

The `DataTable` uses `thead` with `sticky top-0 z-raised bg-surface-shell`. This is correct.

What must be added:
- When the table is inside a `SectionPanel`, the sticky header must clear the `SectionPanel` header. Currently, if the panel scrolls (not the table), the table header scrolls with the page content.
- The table footer (pagination bar when added) must be sticky at the bottom of the table's scroll container, not below the scroll container.
- Horizontal scroll indicators (fade-in gradient at left/right edges when content overflows) — already implemented via `ResponsiveScrollArea`, confirm it is applied to all table scroll containers.

---

### 7.5 Inline Actions Philosophy

**Current problem:** Actions appear as Button components in the last column with no hover-visibility logic. On tables with many rows, the action column creates visual noise even when no action is needed.

**Target behavior:**
- Default density: action column is always visible, buttons are `size="compact"` (28px height)
- Compact density: action column appears on row hover (CSS `opacity-0 group-hover:opacity-100`)
- Comfortable density: action column always visible with slightly more spacious buttons

**Action label philosophy:**
- Primary row action: descriptive verb ("Open", "Approve", "Review", "Download") — never "Action" or "Manage"
- Secondary row action: specific outcome ("Excel", "Reject", "Resend") — never generic "More"
- Destructive actions are never in the inline column — they require a confirmation dialog and live behind the overflow menu

---

### 7.6 Bulk Actions

The `DataTable` already supports bulk selection with `enableBulkSelection` and `bulkActions`. The `DataTableBulkToolbar` renders when rows are selected.

**What needs completion:**

1. `bulkActions` must be defined for every operational table — not just wired in the component, but with real operational actions mapped to real backend endpoints.

2. The bulk toolbar must show the selection context: "12 dispatch records selected · 3 delivered, 9 pending"

3. Bulk actions must have keyboard shortcuts assigned via `shortcutKey` prop. The most common bulk operations (approve, export) should be accessible without mouse interaction.

4. Bulk selection persistence: when a user navigates away and returns (within the same session), their selection is lost. Add optional `selectionPersistKey` prop that stores selection in sessionStorage.

---

### 7.7 Filter Persistence

**Current state:** Filters are managed per-page with local state or URL params. There is no cross-session filter persistence.

**Target state:** Every operational table that is used in a recurring workflow should persist its filter state across navigation via URL params (already done in some pages) and across page reloads via `localStorage` (not yet implemented).

Implement in `DataTable` via optional `filterStorageKey` prop: when provided, the last-used filter state is saved to localStorage under that key and restored on mount.

This matters for operators who run the same filter daily (e.g., attendance supervisor who always filters to "missed_punch") — they should not have to re-apply filters every session.

---

### 7.8 Anomaly Highlighting

For tables that display data with anomaly or quality signals (steel batch list, reconciliations, OCR history), rows with anomalies must be visually distinguishable without requiring the user to open each record.

The mechanism: `getRowState` returning `"processing"` for low-confidence OCR rows, `"paused"` for batches with high variance. The row state system already handles the visual differentiation — it simply needs to be wired to the data signals.

For the steel batch table: a row representing a batch with an anomaly score above a threshold should receive `getRowState` returning `["synced" or "paused"]` based on the batch's risk level. The left border color immediately communicates: "this row needs attention."

---

### 7.9 Keyboard Workflow

The `useDataTableKeyboard` hook already implements keyboard navigation. What must be documented and enforced:

**Navigation:**
- Arrow Up/Down: move between rows
- Enter: open the selected row's primary action
- Space: toggle row selection (when bulk selection enabled)
- Ctrl+A: select all visible rows
- Escape: clear selection / close expanded row

**Actions (when row is selected):**
- Shortcut keys defined in `bulkActions[].shortcutKey` activate on keypress (already implemented)

**Filter interaction:**
- `/` key focuses the search input (convention from Linear, GitHub)
- Escape from search returns focus to table

These interactions must be documented in a `DataTable` usage guide and the filter `/` shortcut must be added to `DataTableToolbar`.

---

### 7.10 Realtime Row Updates

For live operational tables (attendance live, approvals queue), rows update in the background via React Query's `refetchInterval`. The current behavior: the entire table re-renders when new data arrives, causing a flash.

Target behavior:
- Rows that have not changed: no visual update
- Rows that have changed status: apply a brief `"synced"` row state flash (120ms) to draw attention to the update
- New rows added to the top: slide-in animation (150ms, `--ease-decelerate`)
- Rows removed: fade-out (80ms)

Implementation: connect `getRowState` to a diff mechanism that compares the current row data to the previous render's data and applies a transient state on change.

---

---

## SECTION 8 — AI-Native UX Evolution

### How AI Should Feel Inside Industrial Workflows

AI in consumer software often feels like a separate product layer — a chatbot, a "Generate with AI" button, a recommendations panel. In an industrial operational system, AI must feel like a permanent property of the data, not a separate feature. Every AI contribution should feel as natural as a timestamp — always present, unobtrusive, but immediately readable.

The mental model: every piece of data in FactoryNerve has a **provenance** — a source, a confidence level, and a verification status. Human-entered data: "operator entered, verified." AI-extracted data: "AI extracted, 87% confidence, pending human review." System-calculated data: "derived from batch records." The UI surfaces this provenance at every data point, not just in audit logs.

---

### 8.1 AI Confidence Visibility Architecture

**Three ambient signal levels:**

**Level 1 — Inline (row/cell level):**
`ConfidenceBadge` on every row that contains AI-extracted data. Already implemented. Adoption needs to be consistent across all OCR surfaces.

**Level 2 — Surface (table/panel level):**
`AiDisclosureBanner` above any table containing AI-processed records. Shows: source, confidence distribution, action if low-confidence records exist. Non-blocking — purely informational.

**Level 3 — Workflow (page level):**
For pages where AI is actively processing (OCR scan in progress, anomaly scan running), the `RouteHeader` status badge shows `"AI Processing"` with `--status-processing` tone. When processing completes, the status updates to `"Review Ready"` with `--status-warning` tone (because records need verification).

---

### 8.2 AI Provenance Systems

Every field that was populated by AI must carry a visual provenance indicator. This does not mean adding a badge next to every field — it means establishing a convention where AI-populated fields have a subtle visual signal distinguishing them from human-entered fields.

**Proposed convention:**
- Human-entered field: no indicator (default state)
- AI-extracted field pending verification: left border accent using `--ai-processing-border` (a soft indigo)
- AI-extracted field verified by human: no indicator (same as human-entered after approval)
- AI-extracted field rejected/overridden by human: no indicator (show the human's value)

This means the AI provenance indicator **disappears when the record is verified** — which is the correct operational behavior. The goal is verification completion, and the indicator serves as a persistent reminder until that goal is achieved.

---

### 8.3 Anomaly System UX

**Current state:** Anomaly data is computed on the backend (`ranked_anomalies`, `anomaly_summary`). The UX only surfaces it in the premium dashboard — gated behind the owner/manager role.

**Target state:** Anomaly signals surface at the operational level for supervisors, without exposing the full financial analysis that is reserved for owners.

**Supervisor-visible anomaly layer:**
- On the steel batch table: rows with `anomaly_score > 1.5` receive `getRowState` of `"paused"`, making them visually distinct without explaining the financial implication
- On the attendance live table: the `nextAttentionRow` logic already prioritizes missed punches — extend this to show an "attention" row state
- On the work queue: anomaly-flagged items show an amber `AnomalyStrip` indicator below the item title

**Owner-visible financial layer (remains gated):**
- Full financial leakage estimates
- Responsibility analytics (by operator, by shift)
- Ranked anomaly detail with variance amounts

The principle: **operational signals are visible to all roles. Financial implications are visible only to authorized roles.** Supervisors need to act on anomalies; they do not need to know the rupee value of the variance to do so.

---

### 8.4 AI-Assisted Workflows

**OCR Assistance Pattern:**
In the OCR verify workspace, the current UX presents AI-extracted field values for human review. The AI-native evolution adds:
- Confidence-sorted field ordering: fields with the lowest confidence appear first, guiding the reviewer to the highest-risk values immediately
- Auto-advance: when a reviewer approves a high-confidence field, the interface advances to the next low-confidence field automatically
- Batch approve: when all fields above a confidence threshold have been reviewed, a "Approve remaining high-confidence fields" bulk action becomes available

**Dispatch Assistance Pattern:**
When creating a dispatch, the system knows the invoice's remaining weights. The current "Use remaining weights" button fills all lines. The AI-native evolution adds:
- If the truck capacity is entered, auto-suggest a weight distribution that fills the truck optimally across available invoice lines
- Flag the suggestion as AI-calculated with the `--ai-processing-border` provenance indicator
- User can accept, modify, or ignore the suggestion

**Attendance Pattern Recognition:**
If a user consistently misses punch-out on certain days or shifts, the system surfaces a gentle pattern alert: "4 missed punch-outs in the last 2 weeks for morning shift." This appears in the attendance live table's context rail, not as an alert notification.

---

### 8.5 Human Verification Systems

The entire value of AI in manufacturing context is dependent on human verification being easy, fast, and trusted. If verification is slow or confusing, operators will either approve blindly (defeating the purpose) or reject everything (eliminating the AI value).

**Verification speed principles:**

1. **One-click approval for high-confidence records:** When a record's overall confidence is above 85% and no field has been manually flagged, a single "Approve" action should complete verification. No confirmation dialog needed — the approval is logged in the audit trail and is reversible.

2. **Inline override without modal:** Overriding an AI-extracted value should be possible directly in the verification table without opening a modal. The field becomes an inline editable input, the user types the correct value, presses Enter, and the change is saved. The provenance indicator updates to "human-overridden."

3. **Rejection with reason:** Rejecting an OCR record requires a reason — but the reason should be selectable from a short, contextual list rather than a free-text field. Options: "Data unclear," "Wrong document type," "Duplicate entry," "Needs re-scan." Free text is a last resort option.

---

---

## SECTION 9 — Design Governance System

### The Problem Governance Solves

Without governance, every modernization sprint creates temporary improvement followed by gradual entropy. New developers copy existing patterns. Existing patterns are not always the approved patterns. Legacy aliases persist because they work. Arbitrary border radii appear because no one said they were forbidden.

Governance is not about control — it is about lowering the cost of good decisions. When the correct pattern is the easiest pattern, developers default to it. The governance system must make the right choice the path of least resistance.

---

### 9.1 Token Governance

**Layer 1: ESLint (automated, blocking)**

Add to `eslint.config.mjs`:

```js
// Token discipline rules — fail on legacy alias usage
{
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "JSXAttribute[name.name='className'] > Literal[value=/var\\(--muted\\)/]",
        message: "Use text-text-secondary. --muted is a deprecated alias."
      },
      {
        selector: "JSXAttribute[name.name='className'] > Literal[value=/var\\(--text\\)(?!-)/]",
        message: "Use text-text-primary. --text is a deprecated alias."
      },
      {
        selector: "JSXAttribute[name.name='className'] > Literal[value=/var\\(--border\\)(?!-)/]",
        message: "Use border-border-subtle or border-border-default. --border is deprecated."
      },
      {
        selector: "JSXAttribute[name.name='className'] > Literal[value=/rounded-\\[2rem\\]/]",
        message: "Use rounded-overlay (--radius-xl). Arbitrary radius values are forbidden."
      },
      {
        selector: "JSXAttribute[name.name='className'] > Literal[value=/text-rose-|text-emerald-|text-amber-|bg-rose-|bg-emerald-/]",
        message: "Use status token classes (text-status-danger-fg, etc.). Raw Tailwind colors are forbidden."
      },
    ]
  }
}
```

These rules will fail CI on new violations. Existing violations should be tracked by a baseline count that decreases each sprint.

**Layer 2: Token migration map (reference document)**

`docs/TOKEN_MIGRATION_MAP.md` — a living table of every deprecated value and its replacement. Maintained by whoever touches `tokens.css`. Linked from `ARCHITECTURE.md`.

**Layer 3: Token changelog**

Every PR that modifies `tokens.css` or `globals.css` must include a "visual diff" note: which token changed, what it changed from, what it changed to, which components are affected. Required review from at least one team member with design context.

---

### 9.2 Spacing Governance

**The rule:** spacing values in component JSX must come from the Tailwind spacing tokens (`p-md`, `gap-lg`, `px-cell-x`) not from arbitrary values (`p-6`, `gap-[18px]`).

**Enforcement:**
```js
// Add to ESLint
{
  selector: "JSXAttribute[name.name='className'] > Literal[value=/p-\\d|gap-\\d/]",
  message: "Prefer semantic spacing tokens (p-md, gap-sm). Consult tailwind.config.ts for available tokens."
}
```

Note: This rule should be a warning, not an error, during the transition period. Promote to error after the migration sprint completes.

---

### 9.3 Typography Governance

**The uppercase contract:**
```js
{
  selector: "JSXAttribute[name.name='className'] > Literal[value=/uppercase.*tracking-\\[0\\.(2|3)[0-9]/]",
  message: "Tracking wider than 0.18em is forbidden on uppercase text in operational surfaces. Use tracking-[0.04em] maximum."
}
```

**The minimum font size rule:**
`text-[10px]` and `text-[9px]` are already in the forbidden list in `ARCHITECTURE.md`. Add to ESLint as an error.

---

### 9.4 Component Ownership

Every component in `shared/primitives/` and `shared/operational/` has an **owner** — a named team member responsible for reviewing changes and ensuring the component's behavior is consistent with its design intent.

The component registry (`COMPONENT_REGISTRY.md`) lists:
- Component name and location
- Current version
- Owner (responsible for review)
- Adoption count (number of pages using it)
- Last modified
- Known issues

This is a lightweight living document. It does not require tooling — a markdown table is sufficient. Its purpose is to make component health visible and to create a natural pull request review assignment based on component ownership.

---

### 9.5 Visual Review Standards

**Pull request checklist for UI changes:**

Every PR that modifies visual output must include:
- [ ] Screenshot (or video) of before/after on dark mode
- [ ] Screenshot (or video) of before/after on light mode
- [ ] Token compliance: no new `var(--muted)` / `var(--text)` / `var(--border)` usages
- [ ] Accessibility: heading hierarchy confirmed (no new h1 elements outside `WorkstationShell`)
- [ ] Mobile: screenshot at 390px viewport width (iPhone SE baseline)
- [ ] Density: confirmed that compact/comfortable modes do not break the layout

This checklist is enforced by the PR template, not by tooling. It relies on reviewer discipline — but the template makes the expectation explicit.

---

### 9.6 The Anti-Entropy System

**The migration baseline tracker (CI step)**

`scripts/token-audit.mjs` — a Node script that scans `src/**/*.tsx` for known violation patterns and outputs a count per category. Run in CI. Compare against the stored baseline.

```
Token Audit Results:
  --muted usages:    47 (baseline: 80, delta: -33 ✓)
  --text usages:     22 (baseline: 40, delta: -18 ✓)
  --border usages:   38 (baseline: 50, delta: -12 ✓)
  rounded-[2rem]:    12 (baseline: 15, delta: -3  ✓)
  raw Tailwind colors: 28 (baseline: 35, delta: -7 ✓)
```

If any category increases above baseline, CI fails with a clear error. This does not prevent legacy code from existing — it prevents new legacy code from being added.

**The Storybook contract**

New shared primitives must have stories before they can be used in production pages. A story serves as the living documentation, the visual regression baseline, and the design review surface.

**The `MIGRATION_TRACKER.md` file (at workspace root)**

One table, updated with each sprint:

```markdown
| Page | Token Compliant | WorkstationShell | Field System | Status |
|---|---|---|---|---|
| attendance-live-page.tsx | ✓ | ✓ | ✓ | Complete |
| steel-dispatches-page.tsx | ✗ | ✗ | ✗ | Not started |
| premium-dashboard-page.tsx | ✗ | ✗ | N/A | Not started |
```

---

---

## SECTION 10 — Migration Execution Strategy

### Core Migration Principle: Propagation-First

The highest-ROI modernization changes are those that propagate automatically through the primitive layer. One change to `WorkstationShell` propagates to every page that uses it. One change to `DataTable` propagates to every table in the system. One fix to `CardTitle`'s heading level propagates to every card in the application.

The migration sequence is therefore: **primitives first, pages last.**

Every hour spent fixing a primitive is worth 10–50x more than an equivalent hour spent fixing a single page. The primitive change propagates; the page fix does not.

---

### 10.1 Migration Dependency Order

```
tokens.css and globals.css        ← foundation, must be stabilized first
    ↓
Component primitives              ← Button, Card, Badge, Field
(fix heading levels, add variants)
    ↓
Operational primitives            ← WorkstationShell, SectionPanel, DataTable
(add missing props, complete density wiring)
    ↓
New shared primitives             ← RouteHeader, DisclosurePanel, TabNav,
(build what's missing)               AiDisclosureBanner, FieldSection
    ↓
ESLint governance rules           ← make violations detectable before migration
    ↓
High-traffic pages first          ← steal hub, dispatch, premium dashboard
    ↓
Supporting pages                  ← billing, control tower, AI insights
    ↓
Legacy alias removal              ← only safe after all pages migrated
```

### 10.2 Production Safety Rules

**Rule 1: No big-bang migrations.**
No PR may migrate more than one page component at a time. This limits the blast radius of a regression to one page. If migration reveals a bug in a primitive, only one page is affected while the fix is prepared.

**Rule 2: Feature flags for structural changes.**
Any change that alters the spatial layout of a page (not just styling) must be behind a feature flag during the first two weeks of rollout. This allows rollback without a code revert.

**Rule 3: Parallel render for high-risk pages.**
For the most critical pages (steel command center, premium dashboard), implement the modernized version as a new component alongside the existing one. Route a percentage of users to the new version (starting at 10%) and monitor for error rates before full cutover.

**Rule 4: Accessibility regression tests for each migrated page.**
After each page migration, run the accessibility audit suite (heading outline, label associations, color contrast checks via `axe-core`). This is automated — it does not require manual review.

**Rule 5: Rollback capability for 48 hours.**
Every page migration must be revertible within 2 hours without a deployment. This means: keep the old page component file until the new version has been in production for 48 hours with zero reported regressions. Only then delete the old file.

---

### 10.3 Feature Migration Workflow

For each page component migration:

**Step 1 — Snapshot (30 min)**
Screenshot the existing page at three viewport widths (mobile, tablet, desktop) and in both theme modes. Store in `docs/migration-snapshots/<page-name>/before/`. This is the regression reference.

**Step 2 — Token audit (1 hour)**
Run `scripts/token-audit.mjs` against the specific file. List all violations. Create a mapping of each violation to its replacement.

**Step 3 — Structure migration (2–4 hours)**
Replace the page's composition skeleton with `WorkstationShell` + `SectionPanel` pattern. Move title/description into shell props. Remove bespoke hero sections.

**Step 4 — Token compliance (1–2 hours)**
Replace all violations per the mapping from Step 2. Replace `<details>/<summary>` with `DisclosurePanel`. Replace custom tabs with `TabNav`. Replace bare labels with `Field` + `Label`.

**Step 5 — Functional parity check (1 hour)**
Verify all existing functionality works identically. Check: all API calls still fire, all mutations still work, all navigation still works, all loading/error states render correctly.

**Step 6 — Visual diff (30 min)**
Screenshot the migrated page at the same three viewports. Compare against the Step 1 snapshots. Document intentional visual changes (expected) and investigate unintentional changes (regressions).

**Step 7 — PR and review**
Submit with before/after screenshots, token audit diff, and the visual diff results.

---

---

## SECTION 11 — Sprint-by-Sprint Execution Plan

### Overview

| Phase | Duration | Theme | Risk | Propagation Impact |
|---|---|---|---|---|
| Phase 0 | 1–3 days | Emergency fixes | None | Low |
| Phase 1 | 2 weeks | Foundation + governance | Low | High (primitives) |
| Phase 2 | 3 weeks | New shared primitives | Low | Very High |
| Phase 3 | 4 weeks | High-impact page migrations | Medium | High |
| Phase 4 | 3 weeks | Table system completion | Low | High |
| Phase 5 | 2 weeks | Form system modernization | Low | Medium |
| Phase 6 | 3 weeks | AI trust layer | Medium | Medium |
| Phase 7 | 2 weeks | Token compliance finish + legacy alias removal | Low | Permanent |

---

### Phase 0 — Emergency Fixes (Days 1–3)

**Goal:** Remove production defects and the most visible quality failures.

| Task | File | Time | Outcome |
|---|---|---|---|
| Remove `DispatchDebugPanel` from production render | `steel-dispatches-page.tsx` | 15 min | Debug component gone from production |
| Fix `CardTitle` to use `as` prop (default `h2`) | `components/ui/card.tsx` | 30 min | Correct heading hierarchy app-wide |
| Add `inputMode="decimal"` to all weight inputs | steel pages | 45 min | Correct mobile keyboard on number fields |
| Replace `text-rose-300` error text with `text-status-danger-fg` | steel-customers, steel-dispatches | 1 hour | Passes WCAG AA in both modes |
| Add `showIndicator` to NavItem badge pills in mobile bottom nav | `app-sidebar.tsx` | 1 hour | Badge counts visible on mobile nav |

**Success metric:** Zero debug panels in production. Zero `h1` per card. Accessibility scan shows zero color-contrast failures on form error text.

---

### Phase 1 — Foundation Stabilization (Weeks 1–2)

**Goal:** Stabilize the token system. Extend density to the page level. Wire ESLint governance.

**Sprint 1.1 — Token foundation (Week 1)**

| Task | Time | Propagation |
|---|---|---|
| Create `docs/TOKEN_MIGRATION_MAP.md` with full legacy alias → semantic token mapping | 2 hours | Reference |
| Add ESLint rules for `--muted`, `--text`, `--border`, `--accent`, `text-rose-*`, raw `rounded-[Xrem]` | 4 hours | Prevents new violations |
| Add `scripts/token-audit.mjs` CI script with baseline counts | 3 hours | Makes debt visible |
| Create `MIGRATION_TRACKER.md` at workspace root | 1 hour | Progress visibility |
| Resolve `globals.css` dual-source: remove `--bg`, `--bg-soft`, `--card`, `--card-strong`, `--card-elevated` and replace all usages with `--surface-*` equivalents | 6 hours | Eliminates competing color system |

**Sprint 1.2 — Density propagation (Week 1–2)**

| Task | Time | Propagation |
|---|---|---|
| Add page-level density CSS vars to density blocks in `tokens.css`: `--page-inline-pad`, `--page-section-gap`, `--panel-body-pad` | 2 hours | Foundation |
| Wire `--page-section-gap` into `.operational-page__inner` gap | 30 min | All WorkstationShell pages instantly density-responsive |
| Wire `--panel-body-pad` into `SectionPanel` body padding | 30 min | All SectionPanel pages |
| Wire `--page-inline-pad` into `.operational-page` padding-inline | 30 min | All operational pages |
| Verify density toggle in sidebar produces visible page-level change on all three modes | 1 hour | Validation |

**Sprint 1.3 — Primitive quick fixes (Week 2)**

| Task | Time | Propagation |
|---|---|---|
| Add `variant` prop to `Card` (`default`, `metric`, `operational`, `ghost`) | 2 hours | All Card usages |
| Add `noPadding` prop to `CardContent` | 30 min | Enables full-bleed chart/table |
| Add `liveIndicator` prop to `WorkstationShell` | 1 hour | Live pages (attendance, work queue) |
| Standardize `Button` secondary/outline variant (currently identical — differentiate with opacity) | 1 hour | All button usages |

**Phase 1 Success Metrics:**
- ESLint governance rules active in CI
- Token audit baseline count recorded
- Density toggle produces visible change on at least 3 pages
- `globals.css` has zero `--card`, `--bg-soft` definitions (replaced by semantic tokens)

---

### Phase 2 — New Shared Primitives (Weeks 3–5)

**Goal:** Build the missing primitives that enable Phase 3 page migrations.

**Sprint 2.1 — Composition primitives (Week 3)**

| Primitive | Location | Time | Impact |
|---|---|---|---|
| `RouteHeader` | `shared/operational/route-header.tsx` | 1 day | Standardizes all page headers |
| `DisclosurePanel` | `shared/operational/disclosure-panel.tsx` | 1 day | Replaces all `<details>/<summary>` |
| `TabNav` | `shared/primitives/tab-nav.tsx` | 1 day | Replaces custom tab implementations |
| `FieldSection` | `shared/forms/field-section.tsx` | 4 hours | Enables form section grouping |

**Sprint 2.2 — AI primitives (Week 4)**

| Primitive | Location | Time | Impact |
|---|---|---|---|
| `AiDisclosureBanner` | `shared/ai/ai-disclosure-banner.tsx` | 1 day | AI trust surface on all OCR pages |
| `AnomalyStrip` | `shared/ai/anomaly-strip.tsx` | 4 hours | Anomaly signals in work queue |
| `AiStatusIndicator` | `shared/ai/ai-status-indicator.tsx` | 2 hours | Processing state on AI workflows |

**Sprint 2.3 — Table extensions (Week 5)**

| Feature | Time | Impact |
|---|---|---|
| `DataTable` pagination props + `DataTablePagination` footer | 2 days | Unblocks all ERP data-heavy pages |
| `DataTable` skeleton row mode (`isLoading` + `skeletonRowCount`) | 1 day | Unified loading state for tables |
| `DataTable` column visibility (`enableColumnVisibility`) | 1 day | User-configurable table density |
| `DataTable` `isFetching` overlay | 4 hours | Background refresh indicator |

**Phase 2 Success Metrics:**
- All 4 composition primitives have Storybook stories
- All 3 AI primitives have Storybook stories
- `DataTable` pagination renders correctly in Storybook with 200 mock records
- No new `<details>/<summary>` usages added to the codebase after Week 3

---

### Phase 3 — High-Impact Page Migrations (Weeks 6–9)

**Migration order is by user traffic and business criticality.**

**Week 6 — Dispatch & Inventory**

| Page | Current State | Target | Time |
|---|---|---|---|
| `steel-dispatches-page.tsx` | Legacy visual language, no Field system, debug panel | WorkstationShell + 4 FieldSection zones + StickyActionBar | 2 days |
| `steel-inventory-page.tsx` | Not audited in detail but similar pattern | WorkstationShell + DataTable with pagination | 1 day |

**Week 7 — Steel Command Center**

| Page | Current State | Target | Time |
|---|---|---|---|
| `steel-command-center-page.tsx` | Most fragmented page, all legacy patterns | WorkstationShell + TabNav + SectionPanel tabs + context rail | 3 days |

**Week 8 — Owner Dashboard & AI Insights**

| Page | Current State | Target | Time |
|---|---|---|---|
| `premium-dashboard-page.tsx` | Radial gradients, raw colors, `<details>` | WorkstationShell (variant="focused") + MetricStrip + SectionPanels | 3 days |
| `ai-insights-page.tsx` | Legacy visual language, `<details>` | WorkstationShell + AiDisclosureBanner + SectionPanels | 2 days |

**Week 9 — Supporting pages**

| Page | Time |
|---|---|
| `attendance-reports-page.tsx` | 1.5 days |
| `control-tower-page.tsx` | 1.5 days |
| `billing-page.tsx` + billing sub-components | 2 days |

**Phase 3 Success Metrics:**
- All migrated pages pass the accessibility audit (no h1 inside Card, all labels have htmlFor)
- Token audit CI shows 60%+ reduction from baseline
- MIGRATION_TRACKER.md shows 9 pages marked complete
- User-facing: navigation between any two migrated pages feels visually continuous

---

### Phase 4 — Table System Completion (Weeks 10–12)

| Task | Time |
|---|---|
| Wire `getRowState` to operational data signals in all production tables | 3 days |
| Implement filter persistence via `filterStorageKey` | 2 days |
| Wire bulk actions to real operational endpoints (starting with OCR batch approve) | 2 days |
| Add keyboard shortcut `/` to focus search in `DataTableToolbar` | 2 hours |
| Implement realtime row update diff mechanism for live tables | 2 days |
| Audit all inline action labels — replace generic labels with descriptive verbs | 1 day |

**Phase 4 Success Metrics:**
- At least 3 tables have functioning server-side pagination
- Attendance live table shows state-colored rows (missed punch = amber)
- Filter state survives navigation in 5 operational tables
- `/` shortcut focuses search in all DataTable instances

---

### Phase 5 — Form System Modernization (Weeks 13–14)

| Task | Time |
|---|---|
| Migrate `steel-customers-page.tsx` form to Field system with FieldSection grouping | 1.5 days |
| Migrate `steel-dispatches-page.tsx` form to Field system | 1 day |
| Migrate `settings-users-tab.tsx` form to Field system | 1 day |
| Migrate `settings-factory-tab.tsx` form to Field system | 0.5 days |
| Audit all `type="date"` inputs — add locale note to migration map | 0.5 days |
| Add `inputMode="numeric"` to all financial amount inputs | 2 hours |

**Phase 5 Success Metrics:**
- Zero bare `<label>` elements without `htmlFor` in any page
- Zero `text-rose-300` / `text-red-*` error text in any form
- Accessibility scan shows zero form-labeling failures

---

### Phase 6 — AI Trust Layer (Weeks 15–17)

| Task | Time |
|---|---|
| Add `AiDisclosureBanner` to OCR history, OCR verify, and work queue | 1 day |
| Wire `getRowState` to confidence levels in OCR history DataTable | 1 day |
| Expose anomaly row state to supervisor role in steel batch table | 1 day |
| Add confidence sort option to OCR verify verification sequence | 1 day |
| Implement inline field override (no modal) in OCR verify | 2 days |
| Add `AiStatusIndicator` to OCR scan page during processing | 0.5 days |
| Add `AnomalyStrip` to work queue pending items | 1 day |

---

### Phase 7 — Token Compliance Finish (Weeks 18–19)

| Task | Time |
|---|---|
| Migrate remaining non-migrated pages (reports, analytics, email-summary) | 3 days |
| Final token audit — all violations at zero | 2 days |
| Remove legacy aliases from `globals.css` (`--muted`, `--text`, `--border`, `--accent`) | 1 day |
| Remove `--card-ghost`, `--bg-soft`, `--card-strong` from `globals.css` | 1 day |
| Final accessibility audit — full application | 1 day |
| Update ARCHITECTURE.md with confirmed forbidden patterns | 2 hours |
| Archive migration snapshots to `docs/migration-snapshots/` | 2 hours |

**Phase 7 Success Metrics:**
- Token audit CI shows zero violations in all categories
- All legacy aliases removed from `globals.css`
- Full accessibility audit passes
- MIGRATION_TRACKER.md shows all pages complete

---

---

## SECTION 12 — Business Impact Analysis

### Why Frontend Modernization Is a Revenue and Retention Decision

The perception that frontend modernization is a "nice to have" is wrong in the context of operational software. For FactoryNerve OS, the frontend is the product. The backend processes data correctly — users interact with the frontend. Every workflow friction point in the frontend is a direct cost to the operators using the system and an indirect cost to the owner paying for it.

---

### 12.1 Operational Efficiency Impact

**OCR Verification Workflow**

Current: reviewer must navigate to OCR history, apply filters, find low-confidence records, open each one in a separate view, decide, return to list, repeat.

After Phase 6: `QueueWorkspaceLayout` with confidence-sorted queue, inline override (no modal), one-click approval for high-confidence records, `AiDisclosureBanner` showing the queue health upfront.

Estimated time saving: 40–60% reduction in verification time per document (from ~4 minutes to ~2 minutes for a standard 10-row OCR batch). For a factory processing 20 documents per day, this is approximately 40 minutes of supervisor time saved daily.

**Dispatch Creation Workflow**

Current: supervisor must scroll through a large un-zoned form, validate mentally against the checklist (which may not be visible), and guess which fields are required.

After Phase 3: four clearly-zoned sections with logical workflow order, inline validation state on each field, readiness summary always visible in the sticky action bar.

Estimated time saving: 25–35% reduction in dispatch creation time per record. Reduction in dispatch creation errors (wrong truck number, overweight) due to inline validation.

**Attendance Review Workflow**

Current: already one of the better-implemented pages. Marginal improvements from realtime row state updates and the context rail wiring.

**Steel Batch and Inventory Review**

After anomaly row states and filter persistence: supervisors can open the inventory page, have their last-used filter automatically applied, and see anomaly-flagged rows highlighted immediately — without any interaction.

---

### 12.2 Onboarding Impact

**Current onboarding friction:** New operators and supervisors land on pages with inconsistent layouts. Each page requires re-learning where the action button is, where the status indicator is, where the filters are. The learning curve is the sum of 15 different page compositions.

**After unified composition:** One page composition standard. Learning one page teaches the structure of all pages. New user time-to-productive drops from ~3 days (based on typical ERP onboarding timelines for complex multi-module systems) to ~1 day.

For factories that turn over shift supervisors periodically (common in Indian manufacturing), this onboarding efficiency difference has a direct cost impact.

---

### 12.3 Enterprise Trust Impact

The evaluation cycle for factory management software in Indian manufacturing involves a demonstration to the factory owner and at minimum one senior manager. The evaluation is partly rational (does it do what we need?) and partly perceptual (does this feel like serious software that won't embarrass us?).

The current product has the functional capabilities to win every evaluation. The visual fragmentation — the `<details>` panels, the inconsistent border radii, the legacy-token colors that look slightly wrong in different sections — creates a "not quite finished" impression that undermines confidence during the critical evaluation period.

After Phase 3 (page composition unification):
- Every page that an evaluator touches looks like it belongs to the same product
- The "serious enterprise software" impression is consistent across modules
- The evaluation narrative becomes: "this is what a modern Indian manufacturing ERP looks like"

This is not a minor competitive advantage in a market where the primary competition is Excel spreadsheets and outdated SAP implementations.

---

### 12.4 Perceived Product Maturity

**Current perception gap:** The architecture is 2025-quality. The pages are 2017-quality. A developer exploring the codebase sees the architecture and is impressed. A factory owner using the product sees the pages and is uncertain.

**After full modernization:** The gap closes. The surface matches the architecture. The product communicates its actual maturity level at every interaction point.

This gap matters for:
- Enterprise sales cycles where a product demonstration drives the decision
- Developer hiring where code quality signals company quality
- Investor perception where product quality signals team quality
- Customer retention where UI frustration compounds over months of daily use

---

### 12.5 Workflow Completion Speed

A study of ERP user behavior in manufacturing contexts (general ERP ergonomics research, not FactoryNerve-specific) finds that interface inefficiency accounts for 15–25% of total task time in data-entry-heavy workflows. The primary contributors are: navigation to find the right function (5–8%), re-orientation to page layout (3–5%), form completion friction (4–7%), status verification (3–5%).

For FactoryNerve, which is used for shift-level operational tasks (attendance, batch recording, OCR, dispatch):
- Reducing navigation friction: `RouteHeader` + unified composition (-3 to 5%)
- Reducing re-orientation: consistent page structure (-2 to 4%)
- Reducing form friction: `Field` system + `FieldSection` grouping (-3 to 6%)
- Reducing status verification: ambient AI trust signals + row states (-2 to 4%)

Total estimated workflow completion improvement: 10–19% per shift per user. For a factory with 5 supervisors each using the platform for 3 operational hours per shift, this is 1.5–3 hours of recovered productivity per day across the supervision team.

---

---

## SECTION 13 — Future Platform Evolution

### The 6-Month Horizon

**6 months post-modernization completion, FactoryNerve OS should be:**

Visually unified and compositionally mature. Every page uses `WorkstationShell`. Every form uses the `Field` system. Every table has row states, pagination, and keyboard navigation. The density system is fully wired. The AI trust layer is ambient and non-intrusive. The design governance system prevents new entropy from entering the codebase.

**The product experience:** An operator opening FactoryNerve for the first time learns the interface from one page. A supervisor who has used it for 6 months uses it without thinking about the UI — the interface disappears and the work is what remains. An owner reviewing the premium dashboard sees intelligence, not a report.

**The technical baseline at 6 months:**
- Zero legacy alias violations in production code
- Full TypeScript type coverage on all component props
- Storybook stories for every shared primitive
- Automated accessibility testing in CI
- Token audit CI showing baseline at zero

---

### The 12-Month Horizon

**What new capabilities become possible with a unified frontend:**

**1. White-labeling**
When every component uses semantic tokens and the token system is fully adopted, white-labeling for enterprise customers becomes a single `tokens.css` override. A factory group that wants FactoryNerve branded as their own internal system can do it by swapping the brand color tokens. This is currently impossible due to the hardcoded rgba values in page components.

**2. Progressive Web App (PWA) maturity**
The service worker and offline agent already exist. With a unified frontend, the offline experience can be made visually coherent — offline pages use the same design system as online pages. An offline banner using the `RecoveryBanner` component, rather than a bespoke offline page, makes the state transition smooth.

**3. Contextual intelligence in the desktop rail**
With a page-to-rail signal protocol established, the right rail becomes a live operational intelligence surface: anomaly counts, shift timing, workload distribution across the supervisor's team. This is a significant UX capability that is architecturally possible now but requires the rail protocol to be formally defined and implemented.

**4. Multi-factory comparison views**
The control tower page currently shows factories as a list. With the `WorkstationShell` + contextual rail pattern established, a multi-factory comparison workspace becomes a natural extension: left pane is the factory list, right pane is the selected factory's operational signals. The architecture already supports this — the page implementation needs the composition model to be in place first.

**5. Command palette evolution**
The `CommandPalette` is already implemented. With a full component registry and navigation structure, the palette can become a true universal operator interface: execute actions, navigate to records, create records, and invoke AI queries — all from the keyboard. Linear's command palette is the reference implementation.

---

### The 24-Month Horizon: FactoryNerve as an Industrial Operating System

At 24 months, the frontend modernization becomes the foundation for a qualitative evolution in what FactoryNerve is — not just an operational platform, but an **industrial operating system**.

**The distinction:**
An operational platform captures data and displays it. An industrial operating system captures data, analyses it in real time, surfaces actionable intelligence to the right person at the right time, and remembers what happened so that patterns emerge over months and years.

**What this requires from the frontend:**

**1. Workflow orchestration UI**
Instead of navigating to separate modules for attendance, OCR, dispatch, and approvals, the operating system view presents: "here is what needs to happen today, in this order, for this factory, based on what is currently happening." The work queue is the embryo of this — it needs to evolve from a list of pending items to a prioritized, context-aware workflow orchestrator.

**2. Realtime operational event stream**
A live event feed (like a trading terminal's ticker) that shows operational events as they happen: "Batch #0234 recorded — loss 4.2%", "Dispatch #GTP-0891 gate exit confirmed", "5 attendance punch-ins in last 10 minutes." This is the factory's heartbeat, made visible in the interface.

**3. Adaptive density and layout**
Different roles, different sessions, different contexts should automatically adapt the interface density. An owner doing a morning review should default to comfortable density. A supervisor during a busy shift should default to compact. The system should learn from usage patterns.

**4. Natural language query interface**
The AI insights page currently offers a query box for NLQ analysis. At 24 months, this should be ambient: a small query bar accessible from any page via the command palette, that answers operational questions in natural language: "how many trucks were dispatched last week?" "which batch had the highest loss rate in March?" "show me today's missed punches by department."

**5. Operational memory**
The interface remembers operational history not just as an audit trail, but as a context layer. When a supervisor opens a customer's ledger, the interface surfaces: "last time you viewed this customer, they had 3 outstanding invoices, now they have 5." When a batch is recorded for a material that has had high variance historically, the interface notes: "this material has had 12% average loss in the last 6 batches."

**Frontend Architecture Requirements at 24 Months**

For the operating system vision to be achievable, the frontend architecture at 24 months must support:
- Real-time event subscription (WebSocket or SSE) integrated into the React Query layer
- A cross-session state persistence layer (beyond localStorage) for operational context
- Component-level telemetry for understanding which UI patterns drive workflow completion vs. abandonment
- Internationalization matured beyond translation to include locale-appropriate data formats, currency display, and temporal patterns for all 5 supported languages
- A design token system that can be extended by third-party integrations without modifying core tokens

The foundation for all of this is being built now. The primitive modernization, the token discipline, the composition architecture, the AI trust layer — these are not aesthetic improvements. They are the structural conditions that make the operating system evolution possible.

---

## Closing Directive

This document is the operational contract for the next 19 weeks of frontend work. It must be:

1. Read by every developer before beginning a modernization task
2. Reviewed with the team at the start of each phase
3. Updated when decisions change — not treated as frozen
4. Referenced in every PR that touches shared primitives or page components

The goal is not a beautiful product. The goal is a **trustworthy, calm, operationally effective industrial workstation** — software that earns its place in a factory every single shift by making every workflow a little faster and a little clearer than the day before.

That is what frontend modernization means for FactoryNerve OS.

---

*Blueprint version: 1.0*
*Compiled from: FRONTEND_AUDIT_REPORT.md + direct codebase analysis*
*Architecture reference: web/src/ARCHITECTURE.md*
*Design token reference: web/src/styles/tokens.css*
