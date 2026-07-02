# DPR.ai Composition Governance Specification v1.0

**Date:** June 9, 2026  
**Author:** Composition Governance System (Sub-Phase B output)  
**Purpose:** Formal, enforceable governance rules governing page-level composition for all DPR.ai pages. This specification is the input to Sub-Phase C (Cognitive Flow Architecture) and the constraint file for all Phase 3 and Phase 4 page generation prompts.

---

## 1. Overview and Purpose

DPR.ai has a functioning token system (`tokens.css` with 150+ CSS custom properties), a governed shell (`PageShell`, `WorkstationShell`, `OperationalPageShell`), and a comprehensive primitive library (`Card`, `SectionPanel`, `DisclosurePanel`, `GlassPanel`, `MetricStrip`, etc.). What it does **not** have is a composition layer — rules governing how these components assemble into pages.

The result is **Systemic Orchestration Drift**: architecturally correct pages that feel cognitively noisy, over-boxed, and visually flat. A source-code audit of all 40+ operational pages identified 5 systemic problems:

| Finding | Prevalence | Root Cause |
|---------|-----------|------------|
| **1. Pervasive Equal-Card Grid** | 18+ pages | Card is the default container for EVERY content section regardless of importance |
| **2. Uniform Spacing** | 30+ pages | `space-y-6` / `space-y-4` used as the sole spacing token between all sections |
| **3. Section Duplication** | 8+ pages | Same data appears at two visual weights (metric bar + body card) |
| **4. Disclosure Inconsistency** | 8+ pages | H1/H2 content hidden behind disclosure panels; H3 content left visible |
| **5. Two-Surface Trap** | 25+ pages | Only page-bg and card-bg exist; no governed intermediate surface level |

This specification introduces 5 formal contracts that govern page-level composition. Each contract includes:
- **Rules** — specific, enforceable directives
- **Tokens** — new CSS custom properties added to the token system
- **Archetype mappings** — how the rule applies to each of the 9 page archetypes
- **Migration notes** — specific remediation for the 10 highest-severity pages

### How to use this document

1. **New page authors**: Find your archetype in Section 8, follow the template, reference the contracts for decisions.
2. **Refactoring existing pages**: Find the page's archetype, apply the migration notes in Section 9, validate against each contract.
3. **AI coding tools**: Prepend this document as a constraint file for any page generation or modification prompt.

---

## 2. Contract 1: Page Hierarchy Contract

### 2.1 Purpose

Define four hierarchy levels (H0–H3) that govern how any section is rendered. These are not component types — they are visual weight designations that determine surface level, spacing, container type, and interaction permissions.

### 2.2 The Four Hierarchy Levels

#### H0 — Page Identity

| Property | Value |
|----------|-------|
| **Maximum per page** | Exactly 1. No exceptions. |
| **Purpose** | Communicates what this page is and its current operational status |
| **DPR.ai implementation** | The existing `PageShell` / `ShellHeader` with `MetricStrip` |
| **Surface level** | Surface 0 (bare — no card border, no card background) |
| **Spacing below** | `--rhythm-breathing` (48–64px) to H1 |
| **Density** | Sparse |
| **Interaction** | None — display only |
| **Canonical component** | `PageShell` / `WorkstationShell` with `metrics` prop |

**Rules:**
- Every operational page MUST use `PageShell` or `WorkstationShell` as its outermost wrapper.
- The H0 zone is ALWAYS the `ShellHeader` region. No custom headers.
- Metrics in the H0 zone use the `MetricStrip` component — never inline stat boxes.
- Status indicators and live dots use `StatusBadge` — never inline CSS classes.

#### H1 — Primary Operational Content

| Property | Value |
|----------|-------|
| **Maximum per page** | 1 dominant H1 section. Additional H1 sections require architect approval. |
| **Purpose** | The operational heart — the thing the user came to do |
| **Surface level** | Surface 2 (Card) for interactive content; Surface 1 (zone) for non-interactive; Surface 0 (bare) for H1 that is its own workspace |
| **Spacing above** | `--rhythm-breathing` from H0 |
| **Spacing below** | `--rhythm-breathing` to next H2 section |
| **Density** | Standard or Dense depending on content type |
| **Interaction** | Full — primary actions, edit controls, navigation live here |

**Rules:**
- The H1 section MUST be visually dominant. No other section may have equal or greater visual weight.
- If H1 is interactive (form, workspace, control panel), it MUST use Surface 2 (Card with border).
- If H1 is non-interactive (primary chart, read-only summary), it MUST use Surface 1 (zone tint) or Surface 0 (bare).
- The H1 section MUST be fully visible above the fold on desktop (no scrolling required to reach H1 content).

#### H2 — Supporting Context

| Property | Value |
|----------|-------|
| **Maximum per page** | 3 H2 sections |
| **Purpose** | Filters, secondary metrics, contextual panels, related data |
| **Surface level** | Surface 1 (zone) or Surface 0 (bare). Surface 2 (Card) only if the H2 contains interactive sub-elements. |
| **Spacing above** | `--rhythm-structural` from H1 or previous H2 |
| **Spacing between H2 sections** | `--rhythm-structural` (24–32px) |
| **Density** | Standard |
| **Interaction** | Mild — secondary actions only; no primary CTAs |

**Rules:**
- H2 sections MUST NOT contain primary actions (primary buttons, main CTAs).
- H2 sections MUST NOT be placed above H1 in document order.
- If using a Card container for H2, the border opacity MUST be reduced to 0.5× the H1 card border (`--border-subtle` instead of `--border-default`).
- H2 content MUST be visible by default — never behind a disclosure panel.

#### H3 — Background Information

| Property | Value |
|----------|-------|
| **Maximum per page** | 2 H3 sections |
| **Purpose** | Metadata, audit trails, timestamps, supplementary reference |
| **Surface level** | Surface 0 (bare) only. No Card, no zone background. |
| **Spacing** | `--rhythm-tight` (8–16px) |
| **Density** | Sparse |
| **Interaction** | None — reference only |

**Rules:**
- H3 content is the ONLY content that may go behind a `DisclosurePanel` by default.
- H3 sections use muted text colors (`--text-secondary` or `--text-tertiary` tokens).
- H3 sections NEVER have a Card border or card background.
- H3 sections NEVER appear above H1 in document order.

### 2.3 Overflow Rule

When a developer needs to add a fifth section to a page that already has 4 sections, they MUST first demote the weakest existing section to a lower H-level. New sections are added by **demotion**, not by addition.

**Process:**
1. Identify the lowest-value section on the page.
2. Demote it one H-level (H1→H2, H2→H3).
3. If no section can be demoted (all are at minimum viable H-level), restructure the page into a tabbed or detail-view pattern instead of adding to the flat list.

This rule prevents the `/settings` and `/reports` patterns from recurring.

### 2.4 Archetype H-Level Assignments

#### Archetype A — Dashboard / Home
```
H0: PageShell metric bar (role, live status, key metrics)
H1: Primary content grid (workflow feed, KPI cards, intelligence panel)
H2: Secondary panels (reminders, recent activity)
H3: Audit timestamps, version info
```

#### Archetype B — Operational Data Table
```
H0: PageShell metric bar (record count, status summary)
H1: DataTable (the table is the primary reason for the page)
H2: Filter bar + search (H2 because it serves H1)
H3: Pagination info, export status, last-updated timestamp
```

#### Archetype C — Workflow / Stepper
```
H0: Step indicator + workflow header
H1: Form/workspace panel (the current step)
H2: Sidebar summary panel (context)
H3: Supplementary help text, disclosure panels
```

#### Archetype D — Detail / Edit View
```
H0: PageShell metric bar (entity name, status, key identifiers)
H1: Read-only data sections or edit form (the entity detail)
H2: Inline edit disclosures, action controls
H3: Audit trail, timestamps, metadata
```

#### Archetype E — Management / Settings
```
H0: PageShell metric bar (current factory, active users, plan status)
H1: Identity/security settings (the 1–2 sections that matter most)
H2: Billing summary, notification preferences (consulted occasionally)
H3: Billing history table, plan comparison, audit log (reference only)
```

#### Archetype F — Intelligence / Analytics
```
H0: PageShell metric bar (plan, weekly avg, trend)
H1: Primary insight chart/visualization
H2: Trend diagnostics, manager insights, secondary charts
H3: Monthly summary sidebar (reference), data freshness note
```

#### Archetype G — Approval / Review
```
H0: PageShell metric bar (approval counts, status)
H1: List panel (items to review) + Detail panel (selected item)
H2: Filter bar
H3: Action bar context, timestamps
```

#### Archetype H — OCR & Capture
```
H0: PageShell metric bar (runtime status, job status, template count)
H1: Job control workspace (the primary OCR workflow)
H2: Template manager, job status panel, guide card (supporting context)
H3: Metadata rows, audit timestamps
```

#### Archetype I — Operations Summary
```
H0: PageShell metric bar (factory name, trusted output count)
H1: Primary summary cards (the 2–4 most important metrics)
H2: Report-type grid, secondary data sections
H3: Comparison tables, export details, filtering disclosure
```

### 2.5 Composition Tokens Added

```css
/* Page Hierarchy Spacing Tokens */
--composition-h0-spacing-below: var(--space-12);    /* 48px — maps to --space-12 */
--composition-h1-spacing-above: var(--space-10);    /* 40px — maps to --space-10 */
--composition-h1-spacing-below: var(--space-10);    /* 40px — maps to --space-10 */
--composition-h2-spacing-between: var(--space-6);   /* 24px — maps to --space-6 */
--composition-h3-spacing: var(--space-4);            /* 16px — maps to --space-4 */

/* H-level data attributes for dev tools and testing */
/* Usage: <section data-h-level="h1"> */
```

**Token mapping rationale:**
- `--space-12` (48px) is the largest non-oversize spacing token — correct for Breathing zones
- `--space-10` (40px) is the next step down — correct for H1 adjacency
- `--space-6` (24px) is the existing `space-y-6` value — correct for Structural rhythm
- `--space-4` (16px) is the existing `space-y-4` value — correct for Tight rhythm

---

## 3. Contract 2: Card Governance Contract

### 3.1 Purpose

Directly addresses **Finding 1 (Pervasive Equal-Card Grid)** and **Finding 3 (Section Duplication)**. Makes Card the exception, not the default. Establishes exactly when Card is the correct container, when a bare zone is appropriate, and when no container is needed.

### 3.2 When to Use Card (Surface 2, Bordered)

**Card is REQUIRED in these cases:**

| Section Type | Examples | Rationale |
|-------------|----------|-----------|
| H1 interactive workspaces | OCR job control, entry form, approval detail | User interacts directly with the content |
| Navigable data records | DataTable rows, entity cards, job cards | User clicks to open detail view |
| Isolated single-task zones | The job form in `/ocr`, the approval panel | Task boundaries need clear visual separation |
| Forms and input groups | Settings forms, profile editor, checkout | Input groups need container boundaries |

**Card maximum rule:** Maximum **4** bordered Card sections visible simultaneously in the primary content area. A 5th card requires demotion of an existing card.

**Card border rules:**
- H1 Cards: `--border-default` (full opacity border)
- H2 Cards (if needed): `--border-subtle` (reduced opacity — 0.5× visual weight)
- Interactive Cards: add the `group` class to enable hover effects (`hover:shadow-lg`, `hover:-translate-y-0.5`)

### 3.3 When to Use Bare Section with Divider (Surface 1)

**Use Surface 1 (zone tint) in these cases:**

| Section Type | Examples | Rationale |
|-------------|----------|-----------|
| H2 supporting panels | Metric rows, status summaries, contextual text | Informational, not directly interactive |
| Section zones grouping related cards | A group of 3 billing sections on `/settings` | Signals "these belong together" without adding a card wrapper |
| Filter bars above DataTable | All Archetype B pages | Filter controls are interactive but the bar as a section doesn't need card elevation |
| H1 non-interactive content | Primary chart on `/analytics` | Read-only but important — needs zone distinction from H2 but not card weight |

### 3.4 When to Use No Container (Surface 0)

**Surface 0 is REQUIRED in these cases:**

| Section Type | Examples | Rationale |
|-------------|----------|-----------|
| H0 zone | PageShell metric bar | Always bare, always Surface 0 |
| H3 reference information | Comparison tables, billing history, audit logs | Minimal visual weight |
| Transition zones | Space between sections of different density | No content, just rhythm |
| Stat boxes nested inside a Card | `/profile` stat grid inside identity card | Must use bare text, NOT a second bordered container |

### 3.5 Prohibited Patterns

| Pattern | Why | Pages Affected |
|---------|-----|----------------|
| Card nested inside Card (both bordered) | Double border creates visual noise | `/profile`, `/control-tower` |
| Two identical-weight bordered cards side-by-side | Unless truly parallel/comparable data | `/ocr`, `/billing`, `/reports` |
| Card container around H0 | The PageShell metric bar must never have a card border | Would break on every page |
| More than 4 bordered Cards in primary content area | Creates /settings pattern | `/settings` (8+ cards) |
| `GlassPanel` or inline `rgba()` as ad-hoc surface levels | Bypasses governance — creates /steel pattern | `/steel`, `/reports` |
| `<section>` used as a Card substitute | Section has no border, no elevation — creates inconsistency | `/ocr`, `/control-tower` |

### 3.6 Decision Tree: Which Container Does This Section Need?

```
┌─ Is the content interactive (forms, controls, CTAs)? ──── YES ──→ Surface 2 (Card, bordered)
│                                                                     │
│                                                                     └─ Is it the primary H1 workspace?
│                                                                        YES → Card with --border-default
│                                                                        NO  → Card with --border-subtle
│
└─ NO → Is the content navigable (clickable to detail view)? ── YES ──→ Surface 2 (Card, bordered)
│                                                                 
└─ NO → What H-level is it?
         ├─ H0 ──→ Surface 0 (bare)
         ├─ H1 ──→ Surface 1 (zone tint) or Surface 0 (bare)
         ├─ H2 ──→ Surface 1 (zone tint) or Surface 0 (bare)
         └─ H3 ──→ Surface 0 (bare, muted text)

┌─ Does this section contain interactive controls?
│  YES → Surface 2 (Card, bordered)
│  NO  → Proceed to H-level check
│
└─ Is the section's H-level clear from its parent structure?
   YES → Use that H-level's default surface
   NO  → Default to Surface 1 (zone tint) — it's the safest middle ground
```

**Checklist for every new section:**
1. What H-level is this section? (H0/H1/H2/H3)
2. Is the content interactive? (Yes → Card | No → continue)
3. How many Cards already exist on this page? (>4 → demote or restructure)
4. Does this data already appear in the H0 metric bar? (Yes → one-source rule applies)

### 3.7 One-Source Rule

**Every piece of information has exactly one canonical visual location.**

If the metric bar (H0) shows a value, no body section may also show that same value at equal or greater visual weight. The body section may reference it as H3 metadata (muted text), but never as a primary metric card.

**Specific DPR.ai applications of this rule:**

| Page | Current Violation | Fix |
|------|------------------|-----|
| `/ocr` | "Current job" in metric bar AND in body job status card | Remove from body card — metric bar is canonical location |
| `/plans` | Plan features in plan cards AND in comparison table below | Demote comparison table to H3 disclosure. Plan cards are canonical. |
| `/ai` | Quota in metric bar AND in accordion disclosure body | Remove quota detail from disclosure. Metric bar is canonical. |
| `/ocr/history` | Audit workspace and selected record duplicate status info | Status lives in the selected record panel only. Audit workspace gets summary text only. |
| `/billing` | Plan/summary in metric bar AND in billing plan summary cards | Summary cards reference specific billing details not in metric bar. Acceptable — details differ. |

### 3.8 Disclosure Panel Rule

**Disclosure panels (both HTML `<details>`/`<summary>` and `DisclosurePanel` component) contain H3 content only.**

| Correct Usage | Currently Correct? |
|--------------|-------------------|
| `/entry` — Supplementary sidebar info in a disclosure panel | ✅ CORRECT (H3 content) |
| `/plans` — Comparison table in disclosure panel | ✅ CORRECT after demotion (H3 content) |
| `/ocr` — Guide card affecting primary workflow in a disclosure panel | ❌ INCORRECT — must be H2, visible by default |
| `/ai` — Core quota context in a disclosure panel | ❌ INCORRECT — quota headlines belong in H0 metric bar; detail may remain in disclosure as H3 reference |
| `/reports` — Trust & insights behind a disclosure panel | ❌ INCORRECT — trust status is H2, must be visible by default |

**Rule:** If a user needs the information to complete the primary workflow, it is NOT H3 and NOT behind a disclosure. If the information is supplementary reference ("how this affects my billing cycle"), it IS H3 and MAY be behind a disclosure.

### 3.9 Migration Notes — Top 10 Severity Pages

#### Page: `/ocr` (Severity 5)
- **Current:** 7 equal-weight bordered cards, flat hierarchy
- **Changes:**
  1. Demote the 3 runtime stat cards (OCR Runtime, Languages, Templates) from full Card to Surface 1 stat strips inside the H0-like metric bar zone
  2. The "Start OCR Job" + "Job Status" pair become the H1 workspace — keep as Card but ensure they dominate the layout (wider column, more padding)
  3. The "Create Template" area stays as Card (it's a form) but gets demoted to H2 visual weight
  4. The "Template Manager" list becomes Surface 1 zone tint, not individual Cards per template
  5. The guide card moves out of DisclosurePanel and becomes a compact H2 hint row (visible by default)
  6. Remove "Current job" from metric bar section — it duplicates the job status panel below

#### Page: `/settings` (Severity 5)
- **Current:** 8+ equal cards, zero differentiation between critical and occasional settings
- **Changes:**
  1. The factory/profile settings tab content becomes H1 — Card (bordered, full weight)
  2. Users tab content becomes H2 — Surface 1 (zone tint, no Card per user)
  3. Usage, Alerts, Feedback tabs become H2 — Surface 1 zone
  4. The settings summary cards at the top (3 metrics) stay in H0 metric bar — they are canonical there, not duplicated below
  5. Tab navigation stays as TabNav — it's the correct H1/H2 switching mechanism
  6. The `SettingsShell` wrapper component should not have its own card border — it's an H2 container, not H1

#### Page: `/reports` (Severity 5)
- **Current:** Grid of identical report-type cards, no cognitive entry point, no usage-based prominence
- **Changes:**
  1. The "Range + Export" area becomes H1 — it is the primary workflow on this page
  2. The results DataTable below becomes H2 — Surface 1 zone, not a Card wrapper
  3. The "Trust and Insights" section moves OUT of disclosure panel — it's H2 and must be visible
  4. The 3 report hub cards in "Connected lanes" become H2 — Surface 1, not Card or GlassPanel
  5. The "Executive summary" section stays behind disclosure — it's H3 supplementary reference
  6. The "More" disclosure panel at the top stays — it's H3 navigation auxiliary

#### Page: `/control-tower` (Severity 4)
- **Current:** Two dense grids stacked directly, nested bordered sub-containers inside factory cards
- **Changes:**
  1. The 4 stat cards (Total Factories, Industries, Members, Active Context) use Surface 1, not individual Cards — they are H2 metrics
  2. The factory card grid stays as Card per factory (they are navigable entities) but the inner stat containers ("Factory Code", "Members") use bare text inside the card — not nested bordered containers
  3. The "Open desk" sub-containers inside factory cards use Surface 0 text links, not `<details>` bordered boxes
  4. The "Control tools" disclosure stays — it's H3 navigation auxiliary

#### Page: `/profile` (Severity 4)
- **Current:** 13 cards/stat boxes, two dense adjacent columns
- **Changes:**
  1. The identity card stays as H1 Card (it's the primary section)
  2. The stat boxes inside identity (Name, Role, Phone, Email) use bare Surface 0 text, NOT bordered stat boxes — this eliminates the nested card problem
  3. The security card stays as Card but is H2 weight (--border-subtle)
  4. The workspace card is H2 — Surface 1 zone, not a full Card
  5. The activity card (if present) is H3 — Surface 0, bare text
  6. The actions card is H3 — Surface 0, the disclosure panel is correct here

#### Page: `/ai` (Severity 4)
- **Current:** Core quota behind disclosure, metric bar duplicates accordion data
- **Changes:**
  1. Apply the One-Source Rule: Quota values live ONLY in the metric bar (H0). The accordion body showing quota details is H3 reference only
  2. The primary insight card becomes H1 — visually dominant over everything else
  3. The anomaly scanner panel is H2 — Surface 1 zone
  4. Quota details behind disclosure is correct IF the headline values are already visible in H0

#### Page: `/plans` (Severity 4)
- **Current:** Plan cards + comparison table both show same features, 11 total bordered cards
- **Changes:**
  1. Plan cards (3-column grid) are H1 — they ARE the primary content
  2. OCR addon cards are H2 — Surface 1 zone tint, not individual Cards
  3. The comparison table moves behind a DisclosurePanel — it's H3 reference
  4. "Current billing context" disclosure stays — H3 reference
  5. "Current AI usage" disclosure needs evaluation: if usage headlines aren't in H0 metric bar, this must be surface-visible, not behind disclosure
  6. The "Enterprise" and "Billing access" info cards are H3 — Surface 0 text

#### Page: `/steel` (Severity 4)
- **Current:** Status strip + summary cards + TabNav competing, GlassPanel ad-hoc surface elevation
- **Changes:**
  1. `GlassPanel` used for structural step cards (Production, Commercial, Logistics) → convert to governed surface: Surface 1 (zone tint, no glass effect). These are H2 step indicators, not decorative surfaces.
  2. `GlassPanel` used for "Quick actions" → keep GlassPanel only if decorative accent, else convert to Surface 1
  3. The hub section cards (Stock, Production, Sales, Risk) → keep as Card (navigable entities) but use `--border-subtle` for H2 weight
  4. The inventory tab's confidence stat boxes → Surface 0 text, not bordered containers
  5. The sales/inventory/risk tab cards → Surface 1 zone tint for grouped content areas
  6. GlassPanel usages that are purely decorative (with `variant="subtle"` for filter bar, sidebar hints) are acceptable — the issue is GlassPanel used as a structural container instead of governed surfaces

#### Page: `/billing` (Severity 4)
- **Current:** 8+ bordered sections all at equal weight
- **Changes:**
  1. The checkout section becomes H1 — it's the primary action on this page
  2. Plan summary cards are H2 — Surface 1 zone tint cards
  3. Billing usage diagnostics are H2 — Surface 1 zone
  4. Owner controls section is H2 — Surface 1 zone
  5. Invoice history is H3 — Surface 0 text (demoted from current card weight)
  6. The checkout sequence steps panel is H2 support content — Surface 1

#### Page: `/analytics` (Severity 4)
- **Current:** All charts in identical card containers, no primary chart distinguished
- **Changes:**
  1. The weekly production visualization becomes H1 — must be visually dominant
  2. Trend diagnostics become H2 — Surface 1 zone
  3. Manager insights become H2 — Surface 1 zone (or merge with trend)
  4. Monthly summary sidebar is correctly H3 reference — kept as-is
  5. All charts inside Card containers: only the weekly chart (H1) keeps Card border. Trend and manager charts use Surface 1 zone.

---

## 4. Contract 3: Spacing Rhythm Contract

### 4.1 Purpose

Directly addresses **Finding 2 (Uniform Spacing — No Rhythm Signal)**. Establishes three distinct spacing modes that operate between sections at the page composition level. These are NOT within-component spacing (those remain governed by the existing token system in `tokens.css`).

### 4.2 The Three Spacing Modes

| Mode | Token | Value | Between | Ratio |
|------|-------|-------|---------|-------|
| **Breathing** | `--rhythm-breathing` | `var(--space-12)` = 48px | H0↔H1, H1↔H2, Dense↔adjacent | 2.0× Structural |
| **Structural** | `--rhythm-structural` | `var(--space-6)` = 24px | H2↔H2, filter↔table, form groups | 2.0× Tight |
| **Tight** | `--rhythm-tight` | `var(--space-3)` = 12px | H3↔H3, label↔value, icon↔text | — |

### 4.3 Critical Ratio Rule

The three spacing values MUST maintain these minimum ratios to ensure the spacing communicates transition, not just margin:

| Pair | Minimum Ratio | Current DPR.ai Values | Status |
|------|--------------|----------------------|--------|
| Breathing : Structural | 1.75× | 48px / 24px = 2.0× | ✅ PASS |
| Structural : Tight | 1.75× | 24px / 12px = 2.0× | ✅ PASS |

**Initial analysis:** The original spec proposed `--rhythm-tight: var(--space-4)` (16px), giving a Structural:Tight ratio of 24px/16px = 1.5× — below the minimum 1.75× threshold.

**Fix applied:** Option B was chosen — change `--rhythm-tight` to `--space-3` (12px). This gives ratio 24/12 = **2.0×**, well above the minimum 1.75× threshold. ✅

```css
/* Implemented in tokens.css */
--rhythm-breathing: var(--space-12);  /* 48px */
--rhythm-structural: var(--space-6);   /* 24px */
--rhythm-tight: var(--space-3);        /* 12px (was originally proposed as --space-4) */
```

Both ratios now pass: Breathing:Structural = 2.0× and Structural:Tight = 2.0×.

### 4.4 Spacing Application Rules

**Breathing (48px) is used between:**
- H0 and H1 (page identity → primary content)
- H1 and first H2 section
- A Dense section and any adjacent section (both above AND below)
- Distinct workflow stages (step indicator → form panel in `/entry`)
- Two sections of different density states (Dense ↔ Sparse)

**Structural (24px) is used between:**
- H2 sections
- Filter bar and the DataTable below it (they are related)
- Components within the same H1 section
- Form field groups within a form
- TabNav content area and its panels

**Tight (12px) is used between:**
- Elements inside a single component
- Label and its value in a stat block
- Icon and text in a header action
- Badge and title within a card
- Nested stat items within a Surface 1 zone

### 4.5 Archetype Spacing Application Table

| Archetype | H0→H1 | H1→H2 | Between H2 Sections | H1 Components | Dense Adjacency |
|-----------|-------|-------|--------------------|---------------|-----------------|
| A — Dashboard | Breathing | Breathing | Structural | Structural | Breathing |
| B — Data Table | Breathing | Structural* | Structural | Structural | Breathing |
| C — Workflow | Breathing | Breathing | Structural | Structural | Breathing |
| D — Detail View | Breathing | Breathing | Structural | Structural | Breathing |
| E — Settings | Breathing | Breathing | Structural | Structural | Breathing |
| F — Analytics | Breathing | Breathing | Structural | Structural | Breathing |
| G — Approval | Breathing | Structural* | Structural | Structural | Breathing |
| H — OCR | Breathing | Breathing | Structural | Structural | Breathing |
| I — Operations Summary | Breathing | Breathing | Structural | Structural | Breathing |

*Archetypes B and G: H1 is the DataTable or list/detail split. The filter bar is structurally between H0 and H1 but is part of the H1 zone. Use Breathing between H0 and filter bar, then Structural between filter bar and the table itself (they are related).

### 4.6 Specific Fixes for Current Pages

| Page | Current Spacing | Fixed Spacing |
|------|----------------|---------------|
| `/entry` | Uniform space-y-4 between all sections | Breathing between step indicator → form panel. Structural between form fields. Tight within field groups. |
| `/control-tower` | Uniform gap-4 between stat strip → factory grid | Breathing between stat strip → factory grid (they are Dense adjacent). Structural between stat cards. |
| `/ocr` | Uniform space-y-6 at every level | Breathing before job control area. Structural between H2 panels. Tight within card content. |
| `/settings` | Uniform space-y-6 before all sections | Breathing between H0 → H1 (first active tab content). Structural between tab content sections. |
| `/reports` | Uniform space-y-6 across entire page | Breathing between H0 → H1 (range+export area). Structural between H1 → H2 (results table). Breathing around Dense (results table) sections. |
| `/profile` | Uniform gap-6 between identity, security, workspace | Breathing between identity card (H1) and security card (H2). Structural between workspace and activity (both H2). Tight within stat boxes. |

---

## 5. Contract 4: Surface Layering Contract

### 5.1 Purpose

Directly addresses **Finding 5 (Two-Surface Trap)** and the ad-hoc `GlassPanel` usage found in `/steel`. Establishes four governed surface levels — including the missing intermediate Surface 1 that currently does not exist in DPR.ai's token system.

### 5.2 The Four Surface Levels

#### Surface 0 — Page / Bare

| Property | Value |
|----------|-------|
| **Token** | `--surface-0-background` = `--bg-canvas` (page background) |
| **Border** | `--surface-0-border` = none |
| **Use for** | H0 zones, H3 information, transition zones, stat text inside larger components |
| **Current DPR.ai token** | `--bg-canvas` (light: `--stone-50`, dark: `--iron-950`) |

#### Surface 1 — Section Zone (THE MISSING LEVEL)

| Property | Value |
|----------|-------|
| **Token (new)** | `--surface-1-background` |
| **Light value** | A tonal shift from Surface 0 of ~4–6%. Suggestion: `--stone-100` → equivalent to `--bg-surface-sunken` |
| **Dark value** | A tonal shift from Surface 0 of ~4–6%. Suggestion: `--iron-900` → `--bg-surface` |
| **Border** | `--surface-1-border` = none, or at most `--border-subtle` with 0.5px width |
| **Use for** | Grouping H2 panels, tinted section backgrounds, filter bar backgrounds, zone-level containers |

**This is the level DPR.ai currently lacks.** It is how you signal "these three cards belong to the same zone" without adding another Card wrapper.

#### Surface 2 — Card / Elevated

| Property | Value |
|----------|-------|
| **Token** | `--surface-2-background` = `--bg-surface` |
| **Border** | `--surface-2-border` = `--border-subtle` (H2 weight) or `--border-default` (H1 weight) |
| **Use for** | H1 interactive content, navigable data records, isolated workspace |
| **Current DPR.ai token** | `--bg-surface` (light: `#FFFFFF`, dark: `--iron-900`) |

#### Surface 3 — Overlay

| Property | Value |
|----------|-------|
| **Token** | `--surface-3-background` = `--bg-overlay` |
| **Shadow** | `--surface-3-shadow` = `--shadow-lg` |
| **Use for** | Modals, drawers, command palette ONLY |
| **Rule** | NEVER applied to an in-page section |

### 5.3 Active Level Rule

A maximum of **3 surface levels** may be simultaneously visible in the primary content area:
- Surface 0 (page background)
- Surface 1 (zone grouping)
- Surface 2 (card/elevated)

Surface 3 (overlay) may appear on top of any of these when triggered by user action (modal, drawer).

**Prohibited:** Mixing Surface 1 and Surface 3 in the same page region without Surface 2 between them. This creates the "floating on nothing" effect currently seen in `/steel`.

### 5.4 Archetype E Surface Mapping (Settings Pages)

These pages currently operate at only 2 levels (Surface 0 + Surface 2). They need Surface 1 to group related sections.

#### `/settings` and `/settings/attendance`
| Section | Current Surface | Correct Surface | Rationale |
|---------|----------------|-----------------|-----------|
| H0 metric bar | 0 (bare) | 0 (bare) | Already correct |
| Active tab content (e.g. Factory tab) | 2 (Card) | 2 (Card) | H1 interactive — correct |
| Tab navigation | 0 (bare) | 1 (zone) | Tab bar is a grouping zone |
| Tab content sections within a tab | 2 (Card per section) | 1 (zone grouping all sections) | Sections belong together; 1 zone tint replaces multiple card borders |
| Individual form sections within a tab | 2 (Card — nested) | 0 (bare section within Surface 1 zone) | Eliminates nesting |

#### `/profile`
| Section | Current Surface | Correct Surface | Rationale |
|---------|----------------|-----------------|-----------|
| H0 metric bar | 0 (bare) | 0 (bare) | Already correct |
| Identity card | 2 (Card) | 2 (Card) | H1 interactive — correct |
| Identity internal stat boxes | 2 (nested bordered) | 0 (bare text) | Eliminate nested Card |
| Security card | 2 (Card) | 2 (Card) | H2 interactive — keep Card, reduce border to --border-subtle |
| Workspace card | 2 (Card) | 1 (zone) | H2 support — doesn't need Card elevation |
| Activity card | 2 (Card) | 0 (bare text rows) | H3 information — demoted |
| Actions card | 2 (Card) | 1 (zone with disclosure) | H3 reference |

#### `/billing`
| Section | Current Surface | Correct Surface | Rationale |
|---------|----------------|-----------------|-----------|
| H0 metric bar | 0 (bare) | 0 (bare) | Already correct |
| Checkout sequence | 0 (bare steps) | 1 (zone) | H2 support context |
| Plan summary cards | 2 (Card each) | 2 (Card each) | H2 support — keep Card, but border-subtle |
| Usage diagnostics | 2 (Card) | 1 (zone) | H2 — grouped zone |
| Checkout panel | 2 (Card) | 2 (Card) | H1 interactive — correct |
| Owner controls | 2 (Card) | 1 (zone) | H2 — support |
| Invoice history | 2 (Card) | 0 (bare table) | H3 — demoted |

#### `/plans`
| Section | Current Surface | Correct Surface | Rationale |
|---------|----------------|-----------------|-----------|
| H0 metric bar | 0 (bare) | 0 (bare) | Already correct |
| Plan cards (3-column grid) | 2 (Card each) | 2 (Card each) | H1 — correct |
| OCR addon cards | 2 (Card each) | 2 (Card each) | H2 — keep Card but border-subtle |
| Comparison table | 2 (Card) | 0 (bare in disclosure) | H3 — demoted |
| AI usage cards (in disclosure) | 2 (Card each) | 2 (Card each) | Acceptable inside disclosure, but usage headlines must also be in H0 |

### 5.5 `/steel` Remediation — GlassPanel Audit

The `/steel` command center page uses `GlassPanel` extensively in ways that bypass governed surface tokens. Here is the specific remediation:

| Current Usage | Variant | Proposed Replacement | Rationale |
|--------------|---------|---------------------|-----------|
| Filter bar (factory info panel) | `subtle` | `--surface-1-background` | Structural element, not decorative |
| Step 1/2/3 cards (Production, Commercial, Logistics) | `subtle` | `--surface-2-background` with `--border-subtle` | Navigable entity cards — use Card, not Glass |
| Quick actions panel | `elevated` | Keep GlassPanel (decorative accent) | Acceptable — this IS a decorative emphasis element |
| Hub section cards (Stock, Production, Sales, Risk) | `subtle` | `--surface-2-background` with `--border-subtle` | Navigable entities — use Card |
| Security/access messages | `accent` / `subtle` | Keep GlassPanel (alert emphasis) | Acceptable — alert/signal is appropriate for GlassPanel |
| Owner control board sections | `subtle` | `--surface-1-background` | Structural grouped zone |
| Zone summary cards inside stock lane | — | `--surface-1-background` | Grouped stat display |

**Rule for GlassPanel going forward:**
- `GlassPanel` is for **decorative accent only** — elements that need a distinctive surface treatment for emphasis (alerts, highlighted features, decorative welcome cards).
- `GlassPanel` is **never** a structural container for interactive content, navigable records, or form sections.
- If the content would work with `--surface-1` or `--surface-2`, do NOT use GlassPanel.

### 5.6 Surface Tokens to Add

```css
/* NEW: Section Zone — the missing intermediate surface */
--surface-0-background: var(--bg-canvas);
--surface-0-border: none;

--surface-1-background: var(--bg-surface-sunken);  /* ~4-6% shift from Surface 0 */
--surface-1-border: none;  /* or: var(--border-subtle) with 0.5px */

--surface-2-background: var(--bg-surface);
--surface-2-border: var(--border-default);
--surface-2-border-subtle: var(--border-subtle);  /* H2 weight */

--surface-3-background: var(--bg-overlay);
--surface-3-shadow: var(--shadow-lg);
```

---

## 6. Contract 5: Density Transitions Contract

### 6.1 Purpose

Define three density states for sections and establish rules for their adjacency. Density failures are one of the most common audit FAILs — 14 out of 40 pages failed the density adjacency check.

### 6.2 The Three Density States

| State | Density | Data Points / 100px Height | DPR.ai Examples |
|-------|---------|---------------------------|-----------------|
| **Sparse** (S0) | Low | Fewer than 3 | PageShell metric bar, step indicator, page title row, single-value status headers |
| **Standard** (S1) | Medium | 3–8 | Filter bars, 4-stat metric rows, form groups, sidebar summary, pagination |
| **Dense** (S2) | High | More than 8 | DataTable, factory card grid, stat box matrix, invoice list, OCR result table |

### 6.3 Component Density Classification

| Component | Density State | Notes |
|-----------|--------------|-------|
| PageShell metric bar (4+ metrics) | S1 (Standard) | Sparse if fewer than 3 metrics |
| PageShell metric bar (1–2 metrics) | S0 (Sparse) | Minimal display |
| DataTable (3+ columns, 5+ rows) | S2 (Dense) | Always dense |
| DataTable (filters loaded) | S1 (Standard) | Related controls |
| Card — single stat | S0 (Sparse) | Just one value |
| Card — multi-stat (4+ metrics) | S1 (Standard) | Several values |
| FormGroup (3+ fields) | S1 (Standard) | Multiple inputs |
| FilterBar (3+ controls) | S1 (Standard) | Interactive but not dense |
| TabNav | S0 (Sparse) | Navigation tabs |
| StepIndicator | S0 (Sparse) | Workflow steps |
| DisclosurePanel | S0 (Sparse) | Collapsed by default |
| StatBox (bordered, inside Card) | S0 (Sparse) | One value |
| StatBox grid (4+ boxes) | S1 (Standard) | Multiple related values |
| ChartCard | S1 (Standard) | Visual data |
| GlassPanel (decorative) | S0 (Sparse) | Emphasis element |
| ActionBar (2+ actions) | S0 (Sparse) | Buttons |
| DetailRail (sidebar) | S1 (Standard) | Context data |

### 6.4 Density Transition Rules

**Rule 1 — Every page must begin with Sparse (H0)**
The PageShell metric bar is always Sparse. No page starts with a Dense section.

**Rule 2 — Two Dense sections may NEVER be directly adjacent**
A Standard or Sparse zone must exist between them. This prevents the information overload currently found on `/profile` and `/control-tower`.

**Rule 3 — Dense sections must always be preceded by Breathing rhythm**
The Breathing rhythm (48px) between a Dense section and whatever precedes it provides necessary visual rest before the density.

**Rule 4 — At tablet breakpoints, Dense sections scroll, they don't reflow**
A Dense DataTable does not become a single-column card stack at tablet. It scrolls horizontally within its container.

**Rule 5 — Adjacent Dense + Sparse sections must use Breathing rhythm**
The transition from a dense information zone to a sparse one needs maximum separation to signal: "content type changed."

### 6.5 Density Adjacency Failure Fixes

| Page | Failure | Fix |
|------|---------|-----|
| `/control-tower` | Stat card strip (S1) → Factory card grid (S2) directly adjacent | Add a section label (Standard zone, S1) between them, or increase spacing to Breathing (48px) |
| `/profile` | Dense stat column (S2) adjacent to dense card column (S2) | Demote stat boxes to bare H3 text (eliminates the dense column — becomes S0). The card column becomes the single S2 zone. |
| `/plans` | Plan cards (S1) → Addon cards (S1/S2) adjacent | Add a section label + Breathing spacing between plan cards and addon cards. |
| `/billing` | 8+ dense sections adjacent | Group into Surface 1 zones. Invoice history is S2 (Dense). Current plan summary is S1 (Standard). Separate with labeled zone + Breathing. |
| `/settings` | Multiple dense settings sections adjacent | Group into Surface 1 zones. Use Breathing between zones. Each tab panel is one S2 zone + supporting S1 sections. |

### 6.6 Density Maps — All 9 Archetypes

#### Archetype A — Dashboard / Home
```
[S0: PageShell metric bar] → B → [S1: KPI cards + workflow feed] → Str → [S1: Activity panel] → B → [S0: Timestamp footer]
```

#### Archetype B — Operational Data Table
```
[S0: PageShell metric bar] → B → [S1: Filter bar + search] → Str → [S2: DataTable] → B → [S1: Pagination + export controls]
```

#### Archetype C — Workflow / Stepper
```
[S0: Step indicator (H0)] → B → [S1: Form/workspace panel (H1)] → B → [S1: Sidebar summary (H2)]
```

#### Archetype D — Detail / Edit View
```
[S0: PageShell metric bar] → B → [S1: Read-only data (H1)] → B → [S0: Inline edit disclosures (H2)] → Str → [S0: Audit trail (H3)]
```

#### Archetype E — Management / Settings
```
[S0: PageShell metric bar] → B → [S1: TabNav] → Str → [S2: Active tab content (H1)] → B → [S1: Secondary tab content (H2)] → Str → [S0: Footer info (H3)]
```

#### Archetype F — Intelligence / Analytics
```
[S0: PageShell metric bar] → B → [S1: Primary chart (H1)] → B → [S1: Trend diagnostics (H2)] → Str → [S1: Secondary charts (H2)] → B → [S0: Monthly summary rail (H3)]
```

#### Archetype G — Approval / Review
```
[S0: PageShell metric bar] → B → [S1: Filter bar] → Str → [S2: List panel + Detail panel (H1 split)] → B → [S0: Action bar (H2)]
```

#### Archetype H — OCR & Capture
```
[S0: PageShell metric bar] → B → [S2: Job control workspace (H1)] → B → [S1: Template manager (H2)] → Str → [S1: Job status panel (H2)]
```

#### Archetype I — Operations Summary
```
[S0: PageShell metric bar] → B → [S1: Primary metric cards (H1, 2-4 cards)] → B → [S1: Secondary summary grid (H2)] → Str → [S0: Reference tables (H3)]
```

---

## 7. Composition Token Reference

### 7.1 All Tokens Introduced by This Specification

| Token | Value | Contract | Maps to Existing |
|-------|-------|----------|-----------------|
| `--composition-h0-spacing-below` | `var(--space-12)` = 48px | Contract 1 | `--space-12` |
| `--composition-h1-spacing-above` | `var(--space-10)` = 40px | Contract 1 | `--space-10` |
| `--composition-h1-spacing-below` | `var(--space-10)` = 40px | Contract 1 | `--space-10` |
| `--composition-h2-spacing-between` | `var(--space-6)` = 24px | Contract 1 | `--space-6` |
| `--composition-h3-spacing` | `var(--space-4)` = 16px | Contract 1 | `--space-4` |
| `--rhythm-breathing` | `var(--space-12)` = 48px | Contract 3 | `--space-12` |
| `--rhythm-structural` | `var(--space-6)` = 24px | Contract 3 | `--space-6` |
| `--rhythm-tight` | `var(--space-3)` = 12px | Contract 3 | `--space-3` |
| `--surface-0-background` | `var(--bg-canvas)` | Contract 4 | `--bg-canvas` |
| `--surface-0-border` | none | Contract 4 | — |
| `--surface-1-background` | `var(--bg-surface-sunken)` | Contract 4 | `--bg-surface-sunken` |
| `--surface-1-border` | none (or `--border-subtle` 0.5px) | Contract 4 | `--border-subtle` |
| `--surface-2-background` | `var(--bg-surface)` | Contract 4 | `--bg-surface` |
| `--surface-2-border` | `var(--border-default)` | Contract 4 | `--border-default` |
| `--surface-2-border-subtle` | `var(--border-subtle)` | Contract 4 | `--border-subtle` |
| `--surface-3-background` | `var(--bg-overlay)` | Contract 4 | `--bg-overlay` |
| `--surface-3-shadow` | `var(--shadow-lg)` | Contract 4 | `--shadow-lg` |

### 7.2 Data Attributes for Tooling

```html
<!-- Page-level composition metadata for dev tools and governance validation -->
<div data-composition-page data-archetype="b" data-h-count="3">
  <section data-h-level="h0" data-surface="0" data-density="sparse">...</section>
  <section data-h-level="h1" data-surface="2" data-density="dense">...</section>
  <section data-h-level="h2" data-surface="1" data-density="standard">...</section>
  <section data-h-level="h3" data-surface="0" data-density="sparse">...</section>
</div>
```

---

## 8. Composition Templates — Archetypes A through I

### Archetype A — Dashboard / Home

**Pages:** `/dashboard`, `/premium/dashboard`, `/control-tower`

**Structure:**
```
PageShell (H0 — mandatory, max 1)
└─ ShellHeader with metrics (Sparse, Surface 0)
   └─ Breathing rhythm (48px)
├─ Primary content grid (H1 — mandatory, max 1)
│  ├─ Workflow/KPI feed (Standard, Surface 1)
│  └─ Intelligence panel (Standard, Surface 1)
│  └─ Breathing rhythm (48px)
├─ Secondary panels (H2 — optional, max 3)
│  ├─ Reminders (Standard, Surface 1)
│  └─ Recent activity (Standard, Surface 1)
│  └─ Structural rhythm (24px) between H2 sections
└─ Footer info (H3 — optional, max 1)
   └─ Timestamps (Sparse, Surface 0)
```

**Section specifications:**

| Section | H-Level | Surface | Rhythm Before | Density | Mandatory | Max Count |
|---------|---------|---------|---------------|---------|-----------|-----------|
| Metric bar | H0 | 0 (bare) | — (first) | Sparse | Yes | 1 |
| Primary content grid | H1 | 1 (zone) | Breathing | Standard | Yes | 1 |
| Secondary panel | H2 | 1 (zone) | Breathing | Standard | No | 3 |
| Footer info | H3 | 0 (bare) | Structural | Sparse | No | 1 |

**Card restrictions:** Max 4 bordered cards total. Cards in the primary grid must be distinguishable by size or content density — no equal-weight grid beyond 4 items.

---

### Archetype B — Operational Data Table

**Pages:** `/ocr/history`, `/work-queue`, `/tasks`, `/attendance`, `/attendance/live`, `/attendance/reports`, `/attendance/review`, `/steel/batches`, `/steel/invoices`, `/steel/inventory`, `/steel/dispatches`, `/steel/customers`

**Structure:**
```
PageShell (H0 — mandatory, max 1)
└─ ShellHeader with metrics (Sparse, Surface 0)
   └─ Breathing rhythm (48px)
├─ Filter bar (H2 — mandatory, max 1)
│  └─ Standard, Surface 1
│  └─ Structural rhythm (24px)
├─ DataTable (H1 — mandatory, max 1)
│  └─ Dense, Surface 2 (Card with bordered table)
│  └─ Breathing rhythm (48px) above
├─ Pagination + export (H2 — optional, max 1)
│  └─ Standard, Surface 0 (bare controls)
│  └─ Structural rhythm (24px)
└─ Detail rail (H2 — optional, max 1)
   └─ Standard, Surface 1
```

**Section specifications:**

| Section | H-Level | Surface | Rhythm Before | Density | Mandatory | Max Count |
|---------|---------|---------|---------------|---------|-----------|-----------|
| Metric bar | H0 | 0 (bare) | — (first) | Sparse | Yes | 1 |
| Filter bar | H2 | 1 (zone) | Breathing | Standard | Yes | 1 |
| DataTable | H1 | 2 (Card) | Structural | Dense | Yes | 1 |
| Pagination | H2 | 0 (bare) | Breathing | Standard | No | 1 |
| Detail rail | H2 | 1 (zone) | Structural | Standard | No | 1 |

**Key rules:** The DataTable IS the page. Filter bar serves it (Structural gap, not Breathing). No secondary tables or dense stat grids that compete with the primary table.

---

### Archetype C — Workflow / Stepper

**Pages:** `/entry`, `/ocr/scan`

**Note:** This archetype is already the best-composed in the application. Template documents correct patterns for replication.

**Structure:**
```
PageShell (H0 — mandatory, max 1)
└─ ShellHeader with workflow step indicator (Sparse, Surface 0)
   └─ Breathing rhythm (48px)
├─ Form/workspace panel (H1 — mandatory, max 1)
│  └─ Standard, Surface 2 (Card with border)
│  └─ Breathing rhythm (48px)
├─ Sidebar summary panel (H2 — optional, max 1)
│  └─ Standard, Surface 1 (zone)
│  └─ Structural rhythm (24px)
└─ Supplementary hints (H3 — optional, max 2)
   └─ Sparse, Surface 0, may be behind disclosure
```

**Section specifications:**

| Section | H-Level | Surface | Rhythm Before | Density | Mandatory | Max Count |
|---------|---------|---------|---------------|---------|-----------|-----------|
| Step indicator + header | H0 | 0 (bare) | — (first) | Sparse | Yes | 1 |
| Form/workspace panel | H1 | 2 (Card) | Breathing | Standard | Yes | 1 |
| Sidebar summary panel | H2 | 1 (zone) | Structural | Standard | No | 1 |
| Supplementary hints | H3 | 0 (bare) | Structural | Sparse | No | 2 |

**What this archetype does right (replicate elsewhere):**
- Clear H0 → H1 → H2 hierarchy progression
- Sidebar is visually subordinate to the form panel (Surface 1 vs Surface 2)
- Step indicator communicates progress without competing with content
- Only one Card section (the form) — clean hierarchy

---

### Archetype D — Detail / Edit View

**Pages:** `/entry/[id]`, `/steel/batches/[id]`, `/steel/invoices/[id]`, `/steel/dispatches/[id]`, `/steel/customers/[id]`

**Structure:**
```
PageShell (H0 — mandatory, max 1)
└─ ShellHeader with entity name + status (Sparse, Surface 0)
   └─ Breathing rhythm (48px)
├─ Read-only data sections (H1 — mandatory, max 1)
│  └─ Standard/Dense, Surface 2 (Card) for structured data
│  └─ Breathing rhythm (48px)
├─ Inline edit disclosures (H2 — optional, max 3)
│  └─ Standard, Surface 1 (zone) for disclosure group
│  └─ Structural rhythm (24px)
├─ Action controls (H2 — optional, max 1)
│  └─ Standard, Surface 0 (bare button row)
│  └─ Structural rhythm (24px)
└─ Audit trail (H3 — optional, max 1)
   └─ Sparse, Surface 0
```

**Section specifications:**

| Section | H-Level | Surface | Rhythm Before | Density | Mandatory | Max Count |
|---------|---------|---------|---------------|---------|-----------|-----------|
| Metric bar | H0 | 0 (bare) | — (first) | Sparse | Yes | 1 |
| Read-only data | H1 | 2 (Card) | Breathing | Standard/Dense | Yes | 1 |
| Inline edits | H2 | 1 (zone) | Breathing | Standard | No | 3 |
| Action controls | H2 | 0 (bare) | Structural | Standard | No | 1 |
| Audit trail | H3 | 0 (bare) | Structural | Sparse | No | 1 |

**Key rule:** Read data and edit controls must be clearly differentiated. Read data uses Card (Surface 2). Edit controls use inline sections within Surface 1 zones.

---

### Archetype E — Management / Settings

**Pages:** `/settings`, `/settings/attendance`, `/profile`, `/billing`, `/plans`

**Structure:**
```
PageShell (H0 — mandatory, max 1)
└─ ShellHeader with key metrics (Sparse, Surface 0)
   └─ Breathing rhythm (48px)
├─ Tab Navigation (H2 — mandatory for multi-tab pages)
│  └─ Sparse, Surface 0
│  └─ Structural rhythm (24px)
├─ Primary settings content (H1 — mandatory, max 1 per tab)
│  └─ Standard, Surface 2 (Card — form inputs, critical settings)
│  └─ Breathing rhythm (48px)
├─ Secondary settings groups (H2 — optional, max 3)
│  └─ Standard, Surface 1 (zone tint groups related settings)
│  └─ Structural rhythm (24px) between groups
└─ Reference content (H3 — optional, max 2)
   └─ Sparse, Surface 0 (muted text, may be behind disclosure)
```

**Section specifications:**

| Section | H-Level | Surface | Rhythm Before | Density | Mandatory | Max Count |
|---------|---------|---------|---------------|---------|-----------|-----------|
| Metric bar | H0 | 0 (bare) | — (first) | Sparse | Yes | 1 |
| TabNav | H2 | 0 (bare) | Breathing | Sparse | If multi-tab | 1 |
| Primary content | H1 | 2 (Card) | Structural | Standard | Yes | 1 per tab |
| Secondary content | H2 | 1 (zone) | Breathing | Standard | No | 3 |
| Reference content | H3 | 0 (bare) | Structural | Sparse | No | 2 |

**Key rules:** 
- Each tab panel has exactly ONE H1 section (the most important settings on that tab)
- Secondary settings are grouped into Surface 1 zones — no individual Cards for each setting section
- Billing history, audit logs, and plan comparison tables are H3 — always

---

### Archetype F — Intelligence / Analytics

**Pages:** `/ai`, `/analytics`, `/email-summary`

**Structure:**
```
PageShell (H0 — mandatory, max 1)
└─ ShellHeader with plan/metric bar (Sparse, Surface 0)
   └─ Breathing rhythm (48px)
├─ Primary insight card (H1 — mandatory, max 1)
│  └─ Standard, Surface 2 (Card — dominant chart or insight)
│  └─ Breathing rhythm (48px)
├─ Secondary detail sections (H2 — optional, max 3)
│  ├─ Trend diagnostics (Standard, Surface 1)
│  ├─ Manager insights (Standard, Surface 1)
│  └─ Secondary charts (Standard, Surface 1)
│  └─ Structural rhythm (24px) between sections
└─ Monthly/telemetry sidebar (H3 — optional, max 1)
   └─ Sparse, Surface 0 (reference rail)
```

**Section specifications:**

| Section | H-Level | Surface | Rhythm Before | Density | Mandatory | Max Count |
|---------|---------|---------|---------------|---------|-----------|-----------|
| Metric bar | H0 | 0 (bare) | — (first) | Sparse | Yes | 1 |
| Primary insight | H1 | 2 (Card) | Breathing | Standard | Yes | 1 |
| Secondary detail | H2 | 1 (zone) | Breathing | Standard | No | 3 |
| Telemetry sidebar | H3 | 0 (bare) | Structural | Sparse | No | 1 |

**Key rule:** The primary insight chart MUST be visually dominant — wider column, Card border, distinct from secondary charts. Secondary charts use Surface 1 zone tint only.

---

### Archetype G — Approval / Review

**Pages:** `/approvals`

**Note:** This archetype is already well-composed. Template standardizes the action bar position only.

**Structure:**
```
PageShell (H0 — mandatory, max 1)
└─ ShellHeader with counts + status (Sparse, Surface 0)
   └─ Breathing rhythm (48px)
├─ Filter bar (H2 — mandatory, max 1)
│  └─ Standard, Surface 1
│  └─ Structural rhythm (24px)
├─ List panel + Detail panel (H1 — mandatory, max 1 split)
│  ├─ List panel: Dense, Surface 2 (Card)
│  └─ Detail panel: Standard, Surface 2 (Card)
│  └─ Breathing rhythm (48px) above
└─ Action bar (H2 — mandatory, max 1)
   └─ Standard, Surface 0 (bare button row pinned at bottom)
   └─ Structural rhythm (24px)
```

**Section specifications:**

| Section | H-Level | Surface | Rhythm Before | Density | Mandatory | Max Count |
|---------|---------|---------|---------------|---------|-----------|-----------|
| Metric bar | H0 | 0 (bare) | — (first) | Sparse | Yes | 1 |
| Filter bar | H2 | 1 (zone) | Breathing | Standard | Yes | 1 |
| List + Detail | H1 | 2 (Card) | Structural | Dense + Standard | Yes | 1 each |
| Action bar | H2 | 0 (bare) | Structural | Standard | Yes | 1 |

**What this archetype does right (replicate elsewhere):**
- Clear split-panel layout with list (Dense) + detail (Standard)
- Action bar is visually distinct (Surface 0, bare button row) — not competing with content
- Only 2 Card sections (list + detail) — minimal, focused

---

### Archetype H — OCR & Capture

**Pages:** `/ocr`, `/ocr/scan`, `/ocr/jobs/[jobId]`

**Structure:**
```
PageShell (H0 — mandatory, max 1)
└─ ShellHeader with OCR status metrics (Sparse, Surface 0)
   └─ Breathing rhythm (48px)
├── Job control workspace (H1 — mandatory, max 1)
│   ├── Upload / scan controls (Standard, Surface 2 — Card)
│   ├── Live job progress (Standard, Surface 2 — Card)
│   └── Both cards in a side-by-side or stacked layout
│   └── Breathing rhythm (48px)
├── Template manager (H2 — optional, max 1)
│   ├── Template list (Standard, Surface 1 — zone)
│   └── Create template form (Standard, Surface 2 — Card)
│   └── Structural rhythm (24px)
├── Guide card (H2 — optional, max 1)
│   └── Sparse, Surface 1 — VISIBLE by default, never behind disclosure
│   └── Structural rhythm (24px)
└── Job metadata / timestamps (H3 — optional, max 1)
    └── Sparse, Surface 0
```

**Section specifications:**

| Section | H-Level | Surface | Rhythm Before | Density | Mandatory | Max Count |
|---------|---------|---------|---------------|---------|-----------|-----------|
| Metric bar | H0 | 0 (bare) | — (first) | Sparse | Yes | 1 |
| Job control workspace | H1 | 2 (Card) | Breathing | Standard | Yes | 1 |
| Template manager | H2 | 1 (zone) | Breathing | Standard | No | 1 |
| Guide card | H2 | 1 (zone) | Structural | Sparse | No | 1 |
| Job metadata | H3 | 0 (bare) | Structural | Sparse | No | 1 |

**Key rules:**
- The job control workspace is H1 — it must dominate the page
- Runtime stat cards (OCR Runtime, Languages, Templates) are Surface 1 stat strips, NOT individual Cards
- The guide card is H2 — VISIBLE by default, NOT behind a disclosure panel
- Template list items use Surface 0 text items, not individual bordered cards per template

---

### Archetype I — Operations Summary

**Pages:** `/reports`, `/steel`, `/steel/charts`, `/steel/reconciliations`, `/email-summary`

**Structure:**
```
PageShell (H0 — mandatory, max 1)
└─ ShellHeader with factory/summary metrics (Sparse, Surface 0)
   └─ Breathing rhythm (48px)
├── Primary metric cards (H1 — mandatory, max 1 group)
│   ├── 2–4 summary cards (Standard, Surface 2 — Card with border)
│   └── Breathing rhythm (48px)
├── Secondary report/summary grid (H2 — optional, max 3)
│   ├── Report-type cards or sections (Standard, Surface 1 — zone)
│   └── Structural rhythm (24px) between sections
├── Results / DataTable (H1 or H2 depending on page)
│   └── Dense, Surface 2 (Card with table) if H1
│   └── Standard, Surface 1 (zone) if H2
│   └── Breathing rhythm (48px) before if Dense
└── Reference tables / disclosures (H3 — optional, max 2)
    └── Sparse, Surface 0 (may be behind disclosure)
```

**Section specifications:**

| Section | H-Level | Surface | Rhythm Before | Density | Mandatory | Max Count |
|---------|---------|---------|---------------|---------|-----------|-----------|
| Metric bar | H0 | 0 (bare) | — (first) | Sparse | Yes | 1 |
| Primary metric cards | H1 | 2 (Card) | Breathing | Standard | Yes | 1 (group) |
| Secondary grid | H2 | 1 (zone) | Breathing | Standard | No | 3 |
| Results DataTable | H1/H2 | 2/1 | Breathing/Structural | Dense/Standard | Varies | 1 |
| Reference tables | H3 | 0 (bare) | Structural | Sparse | No | 2 |

**Key rules:**
- Summary cards beyond 4 use Surface 1 (zone tint), not individual Cards — the 4th card is the hierarchy cap
- No "card explosion" — the 4-card maximum applies strictly
- The primary metric cards MUST be visually distinct from the secondary grid (Card vs zone)

---

## 9. Migration Notes — Top 10 Severity Pages

A summary of the minimal Card Governance change for each page. These are not full redesigns — just which sections need to stop using Card and what they should use instead.

| Page | Severity | Primary Fix | Container Changes |
|------|----------|-------------|-------------------|
| `/ocr` | 5 | Demote 3 runtime stat cards to Surface 1 stat strips. Guide card out of disclosure. | 7 Card → 3 Card (job control + template form + job status). Stat cards → bare MetricStrip items. Template list → Surface 1 zone. |
| `/settings` | 5 | Group tab content sections into Surface 1 zones. TabNav becomes the primary navigation. | 8+ Card → 1 Card (active tab H1 content). Summary metrics stay in H0. Tab content sections → Surface 1 zone. |
| `/reports` | 5 | Make Range+Export the H1. Move Trust+Insights out of disclosure. Demote report hub cards. | 4+ Card + GlassPanel → 2 Card (range panel + export panel). Trust cards → Surface 1. Hub cards → Surface 1. |
| `/control-tower` | 4 | Stat cards → Surface 1 stat strips. Inner bordered containers → bare text. | 6+ Card → 4 Card (factory cards only). Stat cards → Surface 1. Nested borders → bare text. |
| `/profile` | 4 | Demote stat boxes inside identity card. Workspace card → Surface 1. Activity card → H3 text. | 5 Card → 2 Card (identity + security). Stat boxes → bare text. Nested borders → removed. |
| `/ai` | 4 | Apply one-source rule for quota. Primary insight card becomes visually dominant. | 3+ Card → 1 Card (primary insight). Quota detail → bare text in disclosure. |
| `/plans` | 4 | Comparison table → H3 disclosure. Addon cards → Surface 1 zone. | 11+ Card → 3 Card (plan cards). Addon cards → Surface 1 zone. Comparison table → H3 bare. |
| `/billing` | 4 | Invoice history → H3 table. Owner controls → Surface 1 zone. | 8+ Card → 2 Card (checkout panel + summary cards). Invoice → bare table. Controls → Surface 1 zone. |
| `/steel` | 4 | GlassPanel structural usages → governed surfaces. Step cards → Surface 1 zone. | 5+ GlassPanel → 0 GlassPanel for structural. Step cards → Card (H2 weight). Zone backgrounds → Surface 1. |
| `/analytics` | 4 | Primary chart → H1. Secondary charts → Surface 1 zone. | 4 Card → 1 Card (only weekly chart). Trend+manager → Surface 1 zone. Monthly → Surface 0 bare. |

---

## Appendix: Quick Reference Card

### Before adding ANY section, ask:

1. **What H-level is this?** (H0/H1/H2/H3 — Contract 1)
2. **Does this data already appear in H0?** (One-Source Rule — Contract 2)
3. **How many Cards already on this page?** (>4 → demote — Contract 2)
4. **What surface level?** (0/1/2 — Contract 4)
5. **What spacing before it?** (Breathing/Structural/Tight — Contract 3)
6. **What density state?** (Sparse/Standard/Dense — Contract 5)
7. **Is the preceding section also Dense?** (If yes, add Standard/Sparse zone — Contract 5)

### Default values when in doubt:

| Property | Default |
|----------|---------|
| H-level | H2 (always demote before promote) |
| Surface | 1 (zone tint — safest middle ground) |
| Spacing before | Structural (24px — unless Dense or H1 transition) |
| Container | Surface 1 zone, NOT Card (Card is exceptional) |
| Density | Standard (default for most content) |
