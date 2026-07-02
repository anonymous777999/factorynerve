# DPR.ai Cognitive Flow Architecture Specification v1.0

**Date:** June 9, 2026  
**Author:** Cognitive Flow Architecture System (Sub-Phase C output)  
**Input:** Composition Governance Specification v1.0 (Sub-Phase B — `COMPOSITION_GOVERNANCE_SPEC_v1.md`)  
**Purpose:** Define the operator's mental workflow sequence for every page archetype. This specification governs the ORDER in which sections appear — not their visual weight or container type (those are governed by Sub-Phase B).

---

## Table of Contents

1. [Overview: Why Sequence Matters](#1-overview-why-sequence-matters)
2. [Task 1: Cognitive Flow Models](#2-task-1-cognitive-flow-models)
   - 2.1 Archetype A — Dashboard / Home
   - 2.2 Archetype B — Operational Data Table
   - 2.3 Archetype C — Workflow / Stepper
   - 2.4 Archetype D — Detail / Edit View
   - 2.5 Archetype E — Management / Settings
   - 2.6 Archetype F — Intelligence / Analytics
   - 2.7 Archetype G — Approval / Review
   - 2.8 Archetype H — OCR & Capture
   - 2.9 Archetype I — Operations Summary
3. [Task 2: Page Header Contract (H0 Orientation Zone)](#3-task-2-page-header-contract-h0-orientation-zone)
4. [Task 3: Workflow Progress Component Specification](#4-task-3-workflow-progress-component-specification)
5. [Task 4: Updated Composition Templates with Flow Annotations](#5-task-4-updated-composition-templates-with-flow-annotations)
6. [Appendix: Quick Reference — Flow Sequence Decision Tree](#6-appendix-quick-reference)

---

## 1. Overview: Why Sequence Matters

### 1.1 The Problem

The current DPR.ai pages, while architecturally sound after Sub-Phase B governance, still feel like **stacked systems rather than guided workflows**. This is because sections are sequenced by technical data structure (database order), not by the operator's mental task model.

A page that begins with a dense data grid and ends with a status summary presents data in **storage order** — it forces the operator to reverse-engineer the narrative. An operator arriving at a page asks in sequence:

1. **What is this page telling me?** (Orient — this is always first)
2. **What needs my attention right now?** (Scan — identify anomalies/priorities)
3. **What should I focus on?** (Filter/Select — narrow to current task)
4. **What action should I take?** (Act — perform the primary task)
5. **Did it work?** (Confirm — feedback loop)

A page that does NOT follow this sequence forces the operator to visually scan back and forth, increasing cognitive load and error rate.

### 1.2 Terminology

| Term | Definition |
|------|-----------|
| **Flow Stage** | A distinct mental state the operator passes through when using the page. Each stage answers one question. |
| **Flow Sequence** | The order of flow stages for an archetype. This is the definitive order that sections must appear in. |
| **Irrevocable Decision Moment** | The point in the flow where the operator must make a decision that cannot be easily undone. This moment must be architecturally isolated — Breathing space before and after, no competing sections at equal weight nearby. |
| **Section Sequence** | The concrete ordered list of composition sections (H0 → H1 → H2 → H3) that implements the flow stages. |

### 1.3 Relationship to Sub-Phase B

Sub-Phase B governs **what sections look like** (H-level, surface, density, spacing).  
Sub-Phase C governs **what order sections appear in** (cognitive flow sequence).

Both must be satisfied simultaneously. A section may have the correct H-level, surface, and density but still fail if it appears in the wrong position in the flow sequence.

### 1.4 Universal Flow Constraint

**Every page, regardless of archetype, must start with the H0 orientation zone (Orient stage) and end with some form of feedback or closure (Confirm stage).** No page may begin with dense data or end without a completion signal.

---

## 2. Task 1: Cognitive Flow Models

### 2.1 Archetype A — Dashboard / Home

**Pages:** `/dashboard`, `/premium/dashboard`, `/control-tower`

**Operator's mental model:** "I just arrived. Is everything OK? If not, what do I need to know and do?"

#### Flow Model: Status → Anomaly → Drill-down → Action

| # | Flow Stage | Operator Question | Section Maps To | H-Level | Density | Surface |
|---|-----------|-------------------|-----------------|---------|---------|---------|
| 1 | **Orient — Status** | *Is everything normal right now?* | H0: Metric bar (health, critical metrics — readable in <3s) | H0 | Sparse | 0 |
| 2 | **Anomaly — What's Wrong** | *What is NOT normal and needs my attention?* | H1: Primary content grid (anomalies, alerts, off-threshold items visually distinct) | H1 | Standard | 1 |
| 3 | **Drill-down — Investigate** | *Let me understand this anomaly* | H1 cont'd: KPI cards with drill-down links, intelligence panel | H1 | Standard | 1 |
| 4 | **Action — Do Something** | *What should I do about it?* | H2: Quick action shortcuts, workflow reminders, navigation to detail | H2 | Standard | 1 |
| 5 | **Confirm — Feedback** | *Did my action register?* | H3: Last updated timestamp, confirmation toasts (not H2/H1) | H3 | Sparse | 0 |

**Irrevocable Decision Moment:** Stage 4 (Action). The operator chooses to navigate to a detail page or initiate a workflow. This must be preceded by sufficient context (Stages 2-3) and followed by clear exit/return paths.

**Breathing zones:** Between Stages 1→2 (48px), Stages 3→4 (48px), Stages 4→5 (Structural 24px).

**Validation against DPR.ai pages:**
- `/dashboard`: Currently approximates this flow but anomaly items are not visually distinguished from routine items. KPIs and workflow feed compete for attention (H1 weight split). Fix: demote routine feed to H2, elevate anomaly-driven intelligence to H1.
- `/control-tower`: Factory card grid (Stage 3) appears before anomaly flags (Stage 2). Fix: add an anomaly section (Stage 2) above the factory grid.

---

### 2.2 Archetype B — Operational Data Table

**Pages:** `/ocr/history`, `/work-queue`, `/tasks`, `/attendance`, `/attendance/live`, `/attendance/reports`, `/attendance/review`, `/steel/batches`, `/steel/invoices`, `/steel/inventory`, `/steel/dispatches`, `/steel/customers`

**Operator's mental model:** "What's in the list? What needs my attention first? Let me narrow down and act."

#### Flow Model: Orient → Scan → Filter → Act → Confirm

| # | Flow Stage | Operator Question | Section Maps To | H-Level | Density | Surface |
|---|-----------|-------------------|-----------------|---------|---------|---------|
| 1 | **Orient — Context** | *What list am I looking at? How many items? What's the overall status?* | H0: Metric bar (record count, status summary, last updated) | H0 | Sparse | 0 |
| 2 | **Scan — Prioritize** | *Which items need my attention right now?* | H1: DataTable (sorted by urgency/priority, anomalies visually flagged, critical rows at top) | H1 | Dense | 2 |
| 3 | **Filter — Narrow** | *Let me focus on my current task context* | H2: Filter bar + search (serves the table — structurally between H0 and H1) | H2 | Standard | 1 |
| 4 | **Act — Execute** | *Perform action on the item(s) I identified* | H1 cont'd: Inline row actions, bulk action bar, or navigation to detail view | H1 | Dense | 2 |
| 5 | **Confirm — Verify** | *Did my action complete? What changed?* | H2: Pagination info, export status, confirmation toasts, status change indicators | H2 | Standard | 0 |

**⚠️ CRITICAL FLOW ISSUE:** The proposed sequence places **Scan (Stage 2) BEFORE Filter (Stage 3)**. This is intentional: operators scan the default-sorted list first, then filter to narrow. However, the filter bar must remain accessible at all times (not buried). Implementation: filter bar is structurally between H0 and H1 but remains sticky/accessible.

**Irrevocable Decision Moment:** Stage 4 (Act). Inline actions (approve, reject, delete) or navigation to detail views. The row action or bulk action must be visually isolated — never competing with filter controls or pagination.

**Breathing zones:** Between Stages 1→2 (Breathing 48px), Stages 2→3 is handled by filter bar being adjacent to the table (Structural 24px), Stages 3→4 is inline within the table, Stages 4→5 (Structural 24px).

**Validation against DPR.ai pages:**
- `/work-queue`: Currently follows this sequence correctly. The table is sorted by priority (Scan first). ✅
- `/attendance`: Current page places filter controls at the top (Stage 3 before Stage 2). The table shows all records without priority sorting. Fix: default sort by most recent/urgent, flag anomalies visually.
- `/steel/batches`: Currently shows a flat table with sortable columns but no visual urgency indicators. Fix: add status-coded rows or a "needs attention" section at the top.

---

### 2.3 Archetype C — Workflow / Stepper

**Pages:** `/entry`, `/ocr/scan`

**Operator's mental model:** "Where am I in the process? What does this step require? Let me complete it and move forward."

#### Flow Model: Progress Context → Current Step → Input → Next Action → Feedback

| # | Flow Stage | Operator Question | Section Maps To | H-Level | Density | Surface |
|---|-----------|-------------------|-----------------|---------|---------|---------|
| 1 | **Orient — Progress** | *Where am I in the workflow? What's done, what's next?* | H0: Step progress indicator (always visible, always H2-level weight) | H0 | Sparse | 0 |
| 2 | **Current Step — Context** | *What does this specific step require?* | H0 cont'd: Step title, brief description, no surrounding noise | H0 | Sparse | 0 |
| 3 | **Input — The Work** | *Complete the fields/actions for this step* | H1: Form/workspace panel (takes full H1 weight — this is the page's reason to exist) | H1 | Standard | 2 |
| 4 | **Next Action — Advance** | *Let me submit and move to the next step* | H1 footer or H2: Primary advance button, optionally save-draft secondary | H2 | Standard | 0 |
| 5 | **Confirm — Feedback** | *Did the step complete? What's next?* | H3: Success state, error state, or next-step guidance. Toast if transient. | H3 | Sparse | 0 |

**Irrevocable Decision Moment:** Stage 4 (Next Action). Submitting a step may trigger downstream effects (validation, approval routing, data persistence). The advance button must be visually isolated — preceded by the full input area (Breathing zone), no competing CTAs at equal weight.

**Breathing zones:** Between Stages 1→3 (Breathing 48px — the progress indicator is recessed, the input area is H1 weight). Between Stages 3→4 (Structural 24px — the action bar is part of the H1 zone but visually separated). Between Stages 4→5 (Structural or toast overlay).

**Validation against DPR.ai pages:**
- **This archetype is the best-composed in the application.** Sub-Phase B already identified it as the reference implementation. The `/entry` page follows this sequence naturally. `/ocr/scan` also follows it with its upload → process → review → verify steps.
- No changes needed to the core flow. The improvement opportunity is in the **Workflow Progress Component** (Task 3) — standardizing the progress indicator across all workflow-type pages.

---

### 2.4 Archetype D — Detail / Edit View

**Pages:** `/entry/[id]`, `/steel/batches/[id]`, `/steel/invoices/[id]`, `/steel/dispatches/[id]`, `/steel/customers/[id]`

**Operator's mental model:** "What is this record? What information do I need? Can I/Should I change anything?"

#### Flow Model: Identify → Review → Decide → Modify → Confirm

| # | Flow Stage | Operator Question | Section Maps To | H-Level | Density | Surface |
|---|-----------|-------------------|-----------------|---------|---------|---------|
| 1 | **Orient — Identify** | *What entity am I looking at? What's its current status?* | H0: Metric bar (entity name, ID, status badge, key identifiers) | H0 | Sparse | 0 |
| 2 | **Review — Understand** | *What are the full details of this record?* | H1: Read-only data sections (structured data display, not editable by default) | H1 | Standard | 2 |
| 3 | **Decide — Evaluate** | *Do I need to change anything? What are my options?* | H2: Action controls (approve/reject, edit, delete buttons — visible but not dominant) | H2 | Standard | 0 |
| 4 | **Modify — Change** | *Let me make the change* | H2: Inline edit disclosures or navigation to edit mode | H2 | Standard | 1 |
| 5 | **Confirm — Result** | *Did the change take effect?* | H3: Audit trail, timestamps, metadata. Toast for transient confirmation. | H3 | Sparse | 0 |

**Irrevocable Decision Moment:** Stage 3→4 transition (Decide → Modify). The operator decides to make a change (especially destructive: delete, reject, cancel). This decision point must have:
- Breathing space before it (no competing H1-weight content below the data card)
- No competing CTAs at equal visual weight
- The confirmation dialog or inline edit panel is visually distinct from the read-only data

**Breathing zones:** Between Stages 1→2 (Breathing 48px), Stages 2→3 (Breathing 48px — critical separation between reviewing and acting), Stages 3→4 (Structural 24px), Stages 4→5 (Structural 24px).

**Validation against DPR.ai pages:**
- `/steel/invoices/[id]` and `/steel/dispatches/[id]`: Currently mix read-only data and action controls in the same visual zone. The operator sees edit buttons alongside the data they haven't finished reading. Fix: separate Review (H1, read-only) from Decide (H2, action controls) with Breathing spacing and an explicit section heading transition.

---

### 2.5 Archetype E — Management / Settings

**Pages:** `/settings`, `/settings/attendance`, `/profile`, `/billing`, `/plans`

**Operator's mental model:** "What is currently configured? What do I want to change? What will that affect?"

#### Flow Model: Current State → Locate → Change → Confirm → Impact

| # | Flow Stage | Operator Question | Section Maps To | H-Level | Density | Surface |
|---|-----------|-------------------|-----------------|---------|---------|---------|
| 1 | **Orient — Current State** | *What is configured right now?* | H0: Metric bar (current factory, active users, plan status — key summary values) | H0 | Sparse | 0 |
| 2 | **Locate — Navigate** | *Where is the setting I need to change?* | H2: TabNav or navigation (if multi-tab) — helps operator find the right section | H2 | Sparse | 0 |
| 3 | **Change — Modify** | *Let me update this setting* | H1: Primary settings section (form inputs, toggles — the most critical settings on this tab) | H1 | Standard | 2 |
| 4 | **Confirm — Save** | *Did my change save correctly?* | H2: Secondary settings groups, save confirmation, status indicators | H2 | Standard | 1 |
| 5 | **Impact — Understand** | *What did this change affect?* | H3: Impact description, audit log, plan details (reference only — may be behind disclosure) | H3 | Sparse | 0 |

**Irrevocable Decision Moment:** Stage 3→4 (Change → Confirm). Destructive or high-impact settings (user deactivation, plan downgrade, billing changes) must have an explicit confirmation step. The confirmation must be visually separated from the change controls.

**Breathing zones:** Between Stages 1→2 (Breathing 48px), Stages 2→3 (Structural 24px — TabNav is directly related to content below), Stages 3→4 (Breathing 48px), Stages 4→5 (Structural 24px).

**Validation against DPR.ai pages:**
- `/settings`: Currently has 8+ equal sections competing. TabNav (Locate) works correctly as Stage 2. But within each tab, settings sections are at equal visual weight with no flow progression. Fix: identify the ONE H1 section per tab (the most impactful setting), group the rest as H2/H3.
- `/profile`: Currently mixes identity display (Review) with security settings (Change) with no clear separation. Fix: make identity the H1 read-only (Review, Stage 2), then group Change actions as H2 sections.
- `/billing`: Currently shows plan summary, usage, checkout, and history at equal weight. Flow should be: current plan (Stage 1) → checkout (Stage 3) → confirmation (Stage 4) → impact (Stage 5).

---

### 2.6 Archetype F — Intelligence / Analytics

**Pages:** `/ai`, `/analytics`, `/email-summary`

**Operator's mental model:** "What is the most important thing the data is telling me? How has it changed? Let me examine the details."

#### Flow Model: Insight → Trend → Detail → Export

| # | Flow Stage | Operator Question | Section Maps To | H-Level | Density | Surface |
|---|-----------|-------------------|-----------------|---------|---------|---------|
| 1 | **Orient — Summary** | *What is the data saying at the highest level?* | H0: Metric bar (key averages, trends, current period vs prior period) | H0 | Sparse | 0 |
| 2 | **Insight — Key Finding** | *What is the one most important thing I should know?* | H1: Primary insight card/chart (dominant visualization — the main story) | H1 | Standard | 2 |
| 3 | **Trend — Change Over Time** | *How has this changed? Is the trend concerning?* | H2: Trend diagnostics, secondary charts (supporting visualizations) | H2 | Standard | 1 |
| 4 | **Detail — Examine** | *Let me see the specific numbers* | H2: Manager insights, data tables, breakdowns (optional — may be behind disclosure) | H2 | Standard | 1 |
| 5 | **Export — Act On** | *Let me take this data elsewhere* | H3: Export controls, telemetry sidebar (reference — never H1 or H2) | H3 | Sparse | 0 |

**Irrevocable Decision Moment:** Stage 3→4 (Trend → Detail). The operator commits to investigating a specific anomaly or trend. This should be signaled by the detail section being visually distinct — opening a disclosure or expanding a section, not just scrolling.

**Breathing zones:** Between Stages 1→2 (Breathing 48px), Stages 2→3 (Breathing 48px — primary chart must have visual breathing room), Stages 3→4 (Structural 24px), Stages 4→5 (Structural 24px or disclosure).

**Validation against DPR.ai pages:**
- `/analytics`: All charts currently at equal Card weight. No primary insight distinguished (Stage 2 missing). Fix: make weekly production chart H1/Card, demote trend and manager diagnostics to H2/Surface 1.
- `/ai`: Primary insight card currently exists but is not visually dominant over the anomaly scanner panel. Fix: enlarge the insight card, demote anomaly panel to H2 weight.

---

### 2.7 Archetype G — Approval / Review

**Pages:** `/approvals`

**Operator's mental model:** "What needs my approval? Let me review the details and make a decision."

#### Flow Model: Triage → Select → Review → Decide → Confirm

| # | Flow Stage | Operator Question | Section Maps To | H-Level | Density | Surface |
|---|-----------|-------------------|-----------------|---------|---------|---------|
| 1 | **Orient — Triage** | *How many items need my attention? What's the breakdown?* | H0: Metric bar (pending count, approved/rejected counts, urgency flags) | H0 | Sparse | 0 |
| 2 | **Select — Choose Item** | *Which item should I review next?* | H2: Filter bar (narrow by type, status, date) | H2 | Standard | 1 |
| 3 | **Review — Examine** | *What are the details of this item?* | H1: List panel (dense, sorted by priority) + Detail panel (full item details) | H1 | Dense + Standard | 2 |
| 4 | **Decide — Act** | *Approve or reject?* | H2: Action bar (approve/reject buttons — pinned, always visible, visually distinct) | H2 | Standard | 0 |
| 5 | **Confirm — Feedback** | *What happened? What's next?* | H2: Inline status change on the item, next-item auto-selection, toast confirmation | H2 | Sparse | 0 |

**Irrevocable Decision Moment:** Stage 4 (Decide — Approve/Reject). This is the most clear-cut irrevocable decision in the application. The action bar must:
- Be pinned to the bottom of the viewport (not the page)
- Have visual breathing space from the detail panel (Structural 24px minimum)
- Never have competing controls at equal visual weight
- Show clear visual distinction between approve (positive) and reject (destructive) actions

**Breathing zones:** Between Stages 1→2 (Breathing 48px), Stages 2→3 (Structural 24px — filter directly serves the list), Stages 3→4 (Structural 24px), Stages 4→5 is inline/transient.

**Validation against DPR.ai pages:**
- `/approvals`: Already well-composed. The action bar is correctly pinned. The list/detail split is correct. The approval flow maps cleanly to this model. ✅ The only gap: the filter bar could be more visually recessed (Surface 1 zone is already specified) and the "pending count" in H0 metric bar should clearly differentiate between total pending and items the current user can act on.

---

### 2.8 Archetype H — OCR & Capture

**Pages:** `/ocr`, `/ocr/scan`, `/ocr/jobs/[jobId]`

**Operator's mental model:** "I have a document to capture. Let me scan it, verify the results, and save/export."

#### Flow Model: Prepare → Capture → Review → Correct → Export

| # | Flow Stage | Operator Question | Section Maps To | H-Level | Density | Surface |
|---|-----------|-------------------|-----------------|---------|---------|---------|
| 1 | **Orient — Prepare** | *Is the system ready? What am I scanning?* | H0: Metric bar (OCR runtime status, active job status, template count) | H0 | Sparse | 0 |
| 2 | **Capture — Input** | *Let me capture the document* | H1: Upload/scan controls (camera, file picker, warp controls — the primary action) | H1 | Standard | 2 |
| 3 | **Review — Verify** | *Did the OCR get it right?* | H1 cont'd: Result preview, extracted fields, confidence indicators | H1 | Standard | 2 |
| 4 | **Correct — Fix** | *Let me fix what's wrong* | H2: Field editor, inline corrections, re-scan option | H2 | Standard | 1 |
| 5 | **Export — Save** | *Save the result and move on* | H2: Save/submit verification, export to Excel, next document workflow | H2 | Standard | 0 |

**Irrevocable Decision Moment:** Stage 4→5 (Correct → Export). The operator confirms that the OCR data is correct and submits it. This persists the data and triggers downstream effects (Excel generation, approval routing). The confirm/save button must be:
- Visually isolated from the edit controls
- Preceded by a summary/review step (what does the final data look like?)
- The primary CTA should require deliberate action (not accidentally triggered)

**Breathing zones:** Between Stages 1→2 (Breathing 48px), Stages 2→3 (Structural 24px — capture and review are closely related within H1), Stages 3→4 (Structural 24px), Stages 4→5 (Breathing 48px — critical separation between editing and finalizing).

**Validation against DPR.ai pages:**
- `/ocr/scan`: Currently follows this sequence naturally as a multi-step workflow. The improvements from Sub-Phase B (guide card visible, stat cards demoted) will strengthen the flow. ✅
- `/ocr` (main page): Currently mixes status info, job controls, template creation, and guide card at equal weight. Fix: the job control workspace (Capture + Review) must be H1. Template management and guide card are H2 support.

---

### 2.9 Archetype I — Operations Summary

**Pages:** `/reports`, `/steel`, `/steel/charts`, `/steel/reconciliations`, `/email-summary`

**Operator's mental model:** "What is the overall state of operations? What metrics matter? Let me examine a specific area."

#### Flow Model: Overview → Metrics → Explore → Export

| # | Flow Stage | Operator Question | Section Maps To | H-Level | Density | Surface |
|---|-----------|-------------------|-----------------|---------|---------|---------|
| 1 | **Orient — Overview** | *What is the current operational state?* | H0: Metric bar (factory name, trusted output count, key high-level metrics) | H0 | Sparse | 0 |
| 2 | **Metrics — Key Numbers** | *What are the 2-4 most important metrics right now?* | H1: Primary metric cards (summary cards with the most critical KPIs) | H1 | Standard | 2 |
| 3 | **Explore — Investigate** | *Let me look at a specific area in more detail* | H2: Secondary grids, tabbed sections (report-type data, charts, breakdowns) | H2 | Standard | 1 |
| 4 | **Detail — Drill Down** | *Let me see the raw data* | H2/H3: DataTable or detail grid (results, comparison tables) | H2/H3 | Dense/Standard | 2/1 |
| 5 | **Export — Take Action** | *Let me export this or navigate to detail* | H3: Export controls, navigation links to detail pages (reference — never dominant) | H3 | Sparse | 0 |

**Irrevocable Decision Moment:** Stage 3→4 (Explore → Detail). The operator decides to drill into a specific metric or area. This should be signaled by a visual transition — tab change, disclosure expand, or section reveal — not just scrolling to content below.

**Breathing zones:** Between Stages 1→2 (Breathing 48px), Stages 2→3 (Breathing 48px — primary metrics must have breathing room), Stages 3→4 (Structural 24px), Stages 4→5 (Structural 24px).

**Validation against DPR.ai pages:**
- `/reports`: Currently inverts the flow — report-type cards (Explore, Stage 3) appear before the Range+Export area (Stage 5). Fix: make Range+Export H1 (Stage 2), move report hub cards to H2 (Stage 3), move results DataTable to H2 (Stage 4).
- `/steel` (command center): GlassPanel step cards (Explore, Stage 3) compete with hub section cards (Metrics, Stage 2). Fix: hub section cards are H1 (Stage 2), step cards are H2 support (Stage 3).

---

## 3. Task 2: Page Header Contract (H0 Orientation Zone)

### 3.1 Purpose

The H0 orientation zone is the governed entry point to every DPR.ai page. It answers the operator's first question — *"Where am I and what is the current state?"* — without requiring them to read or interpret the page body.

### 3.2 Formal Contract

**Every page MUST begin with exactly one H0 zone.** The H0 zone is rendered by the `WorkstationShell` component's `ShellHeader` region and accepts the following governed interface:

#### Props / Data Model

```typescript
interface PageHeaderContract {
  /** REQUIRED — Communicates where the operator is. Must match the route title. */
  title: string;

  /** OPTIONAL — Clarifies the page purpose. Max 1 line, ~60 chars. */
  description?: string;

  /** OPTIONAL — Section/category label. E.g., "OCR", "Settings", "Steel". Always uppercase. */
  eyebrow?: string;

  /** OPTIONAL — Combined status indicator. Shows a StatusBadge with the given tone. */
  tone?: "default" | "success" | "warning" | "danger" | "info" | "neutral";

  /** OPTIONAL — Label for the tone badge. E.g., "Live", "Pending review", "23 items". */
  toneLabel?: string;

  /** OPTIONAL — Live indicator (pulsing dot + label). Mutually exclusive with tone/toneLabel. */
  liveIndicator?: boolean;
  liveLabel?: string;        // Default: "Live"

  /** REQUIRED CONDITIONALLY — The page's key operational metrics. Max 4 items. */
  metrics?: MetricStripItem[];  // interface defined below

  /** PROHIBITED in H0 — Single value is acceptable. Multiple dense values violate H0 rules. */
  filters?: never;  // Filters belong in H2 body sections only

  /** PROHIBITED in H0 — Actions belong in H1/H2 body sections or sub-header zones. */
  actions?: never;   // No primary buttons in the H0 zone
}
```

#### MetricStripItem Interface

```typescript
interface MetricStripItem {
  id: string;
  label: string;           // Short label, ~20 chars max
  value: React.ReactNode;  // The metric value (number, formatted string)
  detail?: React.ReactNode; // Context/comparison: "+12% vs last week", "Updated 4m ago"
  tone?: StatusBadgeTone;   // Highlight anomalous values
  badgeLabel?: string;      // Optional inline badge (max ~8 chars)
}
```

#### Visual Structure

```
┌─────────────────────────────────────────────────────────────┐
│  eyebrow (uppercase, muted)         status badge / live dot  │
│  Title (h1, bold, primary)                                   │
│  Description (p, secondary, 1 line max)                     │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Metric 1 │  │ Metric 2 │  │ Metric 3 │  │ Metric 4 │   │
│  │   VALUE  │  │   VALUE  │  │   VALUE  │  │   VALUE  │   │
│  │  detail  │  │  detail  │  │  detail  │  │  detail  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘

Surface: 0 (bare)
Density: Sparse (0-2 metrics) or Standard (3-4 metrics)
Max height: ~120px (with metrics row), ~72px (title + description only)
```

#### State Variants

**Normal State:**
- Default tone (`tone: "default"`)
- Metrics show routine values
- No live indicator
- Eyebrow present only if the page is part of a clear category

**Attention State:**
- `tone: "warning"` or `tone: "danger"` on the page status badge
- One or more metrics show anomalous values (via `tone` on the MetricStripItem)
- `liveIndicator: true` for real-time pages (dashboard, attendance live, OCR)

**Empty/Initial State:**
- Metrics show zero values or "--" placeholders
- Description guides: "No data yet. Start by scanning your first document."

### 3.3 Prohibited in H0

| Element | Why | Where It Belongs |
|---------|-----|-----------------|
| Filter controls | Adds complexity to the orientation zone | H2: Filter bar in page body |
| Primary action buttons | Operator should orient before acting | H1: Primary content area |
| Secondary actions | Clutters the entry point | H2: Supporting sections |
| Dense data tables | Overwhelms before orientation completes | H1: DataTable section |
| Tab navigation | Navigation is not orientation | H2: TabNav in page body |
| Breadcrumb trail | Only if page is 2+ levels deep — max 1 optional element | Within H0 title area, muted |
| Time range selector | Only on analytics/dashboard pages — max 1 optional element | Within H0, below metrics |
| Role context indicator | Only if page behavior differs by role | Within H0, inline with eyebrow |
| More than 4 metrics | Exceeds the Sparse/Standard density limit | Demote to H2 metric section |

### 3.4 Implementation Guidance

- The H0 zone is rendered by `WorkstationShell` — every page uses this component.
- The `RouteHeader` internal sections inside `WorkstationShell` handle title, eyebrow, tone, and description.
- `MetricStrip` handles the metrics row.
- No new component needed. The H0 contract is enforced by **component interface** (the props of `WorkstationShell` and `MetricStrip`) plus **governance rules** in this document.

### 3.5 Governance Enforcement

Before a PR is approved:
1. Verify the page uses `WorkstationShell` or `OperationalPageShell` (no custom H0).
2. Verify `metrics` array has ≤ 4 items.
3. Verify no filters, actions, or other prohibited elements exist in the `ShellHeader` region.
4. Verify the title matches the route name and is in the page's h1 element.
5. Verify the page transitions from H0 to H1 with `--rhythm-breathing` spacing.

---

## 4. Task 3: Workflow Progress Component Specification

### 4.1 Purpose

For multi-step workflow pages (Archetypes C, H, and certain D/E pages), the Workflow Progress Component communicates the operator's position within a multi-step process. It must respect the cognitive flow model: it communicates **Progress Context** (Stage 1 of Archetype C) without taking H1 weight.

### 4.2 Position in the Composition

```
H0: WorkflowProgress (the progress indicator)
    └─ Always after the page title/eyebrow, always before the H1 step content
    └─ Surface 0 (bare — no card, no border, no zone background)
    └─ Density: Sparse
         |
         ↓ Breathing rhythm (48px)
H1: Current step content (form, workspace, review panel)
```

**Positioning Contract:**
- The component lives in the H0 zone of Archetype C and H pages.
- It is rendered within the `WorkstationShell` children area (below header, above H1 content).
- At tablet width (≤768px), it collapses to a single-line minimal indicator showing only the current step label + remaining count.
- It must NEVER contain actions. It is orientation only.

### 4.3 Data Model

```typescript
interface WorkflowProgressProps {
  /** Ordered list of steps in the workflow */
  steps: WorkflowStep[];

  /** Compact mode: single-line indicator for tight spaces or tablet width */
  compact?: boolean;

  /** Optional label: "Workflow" by default, overridable */
  workflowLabel?: string;

  /** Optional className for positioning adjustments */
  className?: string;
}

type WorkflowStepStatus = "pending" | "current" | "complete" | "error" | "blocked";

interface WorkflowStep {
  id: string;
  label: string;          // Short step name: "Upload", "Verify", "Export"
  description?: string;   // Optional: "Capture your document image"
  status: WorkflowStepStatus;
  isOptional?: boolean;   // Optional steps shown with muted styling
}
```

### 4.4 State Variants

#### Step: pending
```
Appearance: Muted text, no icon or muted circle icon
Color: --text-tertiary
Interaction: None
```

#### Step: current (active)
```
Appearance: Filled or outlined circle with step number, bold label
Color: --accent-primary or --color-primary
Weight: Semi-bold
```

#### Step: complete
```
Appearance: Checkmark icon, completed label
Color: --status-success-fg
Style: Line through the step connector
```

#### Step: error
```
Appearance: Warning/exclamation icon on the step circle
Color: --status-danger-fg
Note: The error step is the current step — operator must fix before proceeding
```

#### Step: blocked
```
Appearance: Lock or pause icon on the step circle
Color: --status-warning-fg
Note: Blocked steps show a reason tooltip. The operator must resolve the blocking condition.
```

### 4.5 Desktop Layout (Full)

```
[Workflow: Verification]     ← workflowLabel (muted, uppercase)

   ✅ Upload ────→  2️⃣ Verify ────→ ⏳ Export     ← step labels
  (complete)      (current)        (pending)

   3 steps total · 2 remaining                          ← remaining count
```

- Horizontal layout: steps in a row with connectors between them.
- Connector lines: Solid for completed paths, dotted for pending paths.
- Current step visually highlighted (larger circle, bolder text, accent color).
- Remaining count always visible: "2 of 3 steps complete" or "2 remaining".

### 4.6 Tablet Layout (Compact)

```
[Step 2 of 3: Verify]           ← current step label + progress summary
```

- Single line: current step label + "X of Y" or "X remaining".
- No step sequence visualization — just orientation.
- The compact indicator is a tappable area that expands to the full step list if needed.

### 4.7 Error and Blocked States

**Error state:**
```
   ✅ Upload ────→  ⚠️ Verify ────→ ⏳ Export
                    └─ "Confidence too low. Review required."
```
- The error is on the current step (operator cannot proceed until fixed).
- Error message displayed below the step label as muted detail text.
- The proceeding steps remain pending (not blocked — the fix unblocks them).

**Blocked state:**
```
   ✅ Upload ────→  ✅ Enhance ────→ 🔒 Export
                                     └─ "Waiting for AI processing"
```
- Blocked steps show a lock icon. Blocked steps are NOT the current step.
- The current step is the last complete step before the blockage.
- Blocked reason shown as tooltip or muted text below.

### 4.8 Component Contract Summary

| Property | Value |
|----------|-------|
| **Component name** | `WorkflowProgress` |
| **Location** | Below `WorkstationShell` header, above H1 content |
| **Surface level** | Surface 0 (bare) — never in a Card or zone |
| **Visual weight** | H2 maximum — must not compete with H1 step content |
| **Density** | Sparse |
| **Max height (desktop)** | ~48px (single row of steps) |
| **Max height (compact)** | ~24px (single line of text) |
| **Actions** | NEVER — orientation only |
| **Responsive** | Full horizontal at >768px, compact single-line at ≤768px |
| **Accessibility** | `aria-label` on the nav element. `aria-current="step"` on the current step. Step label text never truncated unless in compact mode. |

### 4.9 Migration: Existing Components to Deprecate

The existing `WorkflowPanel` component in `components/ui/workflow-panel.tsx` currently embeds its own step rail (`WorkflowPanelStepRail`) inside a Card sidebar. After Sub-Phase C:

| Component | Action |
|-----------|--------|
| `WorkflowPanelStepRail` (internal) | Deprecate — replace with standalone `WorkflowProgress` |
| `WorkflowPanel` step sidebar | Convert to use `WorkflowProgress` in the H0 zone, remove from sidebar |
| Standalone `WorkflowProgress` (new) | New component — implement in Phase 3 code |

The `WorkflowPanel` component itself is not deprecated — it remains a valid container for H1 step content. Only its internal step rail is replaced by the new `WorkflowProgress` component at the H0 level.

---

## 5. Task 4: Updated Composition Templates with Flow Annotations

> **Note:** These templates are overlays on the Sub-Phase B templates (Section 8 of `COMPOSITION_GOVERNANCE_SPEC_v1.md`). The H-level, surface, density, and spacing rules remain unchanged from Sub-Phase B. What is added here are **flow sequence annotations** — the cognitive order in which sections must appear. Both documents must be satisfied simultaneously.

Each template from Sub-Phase B is updated below with:
- **Flow stages** annotated on each section
- **Flow sequence arrows** (→) between sections
- **Critical flow note** identifying the irrevocable decision moment
- **Breathing zone warnings** where spacing is critical

---

### Archetype A — Dashboard / Home (Updated)

**Pages:** `/dashboard`, `/premium/dashboard`, `/control-tower`

**Flow sequence:** [Orient] → [Anomaly] → [Drill-down] → [Action] → [Confirm]

```
PageShell (H0 — mandatory)
└─ ShellHeader with metrics [FLOW: Orient]
   └── Breathing (48px) ⚠️ CRITICAL — separates orientation from anomaly detection
├─ Primary content grid (H1 — mandatory, max 1) [FLOW: Anomaly + Drill-down]
│  ├─ Anomaly-flagged items (visually distinct — red/orange badges)
│  └─ KPI cards with drill-down links
│  └── Breathing (48px) ⚠️ CRITICAL — separates anomaly from secondary content
├─ Secondary panels (H2 — optional, max 3) [FLOW: Action]
│  ├─ Quick action shortcuts [FLOW: Action]
│  └─ Workflow reminders [FLOW: Action]
│  └── Structural (24px)
└─ Footer info (H3 — optional, max 1) [FLOW: Confirm]
   └─ Last updated timestamp, version
```

**Irrevocable Decision Moment:** Stage 4 (Action) — navigating to a detail workflow. The action section must have breathing space from the anomaly section.

**Key flow validation:** Is the FIRST thing the operator sees the overall status/health (Orient)? Is the SECOND thing the anomalies (not routine data)? If routine data appears before anomalies, the flow is wrong.

---

### Archetype B — Operational Data Table (Updated)

**Pages:** `/ocr/history`, `/work-queue`, `/tasks`, `/attendance`, `/attendance/live`, `/attendance/reports`, `/attendance/review`, `/steel/batches`, `/steel/invoices`, `/steel/inventory`, `/steel/dispatches`, `/steel/customers`

**Flow sequence:** [Orient] → [Scan] → [Filter] → [Act] → [Confirm]

```
PageShell (H0 — mandatory)
└─ ShellHeader with metrics [FLOW: Orient]
   └── Breathing (48px) ⚠️ CRITICAL — separates orientation from list scan
├─ Filter bar (H2 — mandatory, max 1) [FLOW: Filter]
│  └─ Sits structurally between H0 and H1, always accessible (sticky)
│  └── Structural (24px)
├─ DataTable (H1 — mandatory, max 1) [FLOW: Scan + Act]
│  ├─ Default sorted by urgency/priority [FLOW: Scan — items needing attention first]
│  ├─ Visual anomaly flags on rows [FLOW: Scan]
│  └─ Inline row actions [FLOW: Act]
│  └── Breathing (48px) ⚠️ CRITICAL — separates dense table from pagination/export
├─ Pagination + export (H2 — optional, max 1) [FLOW: Confirm]
│  └─ Status: "Showing 23 of 142 items", export status
│  └── Structural (24px)
└─ Detail rail (H2 — optional, max 1) [FLOW: Act — for detail navigation]
```

**⚠️ FLOW NOTE:** The filter bar (Stage 3) appears ABOVE the DataTable (Stage 2) in document order. This is the one case where document order does not exactly match cognitive order. The operator's eye goes to the table first (it's visually dominant, Dense), then up to the filter bar when they need to narrow.

**Accessibility clarification:** For assistive technology, the filter bar should carry `role="search"` with clear labeling so screen readers can navigate to it directly. The DataTable should use `aria-label` or `aria-describedby` to reference the active filter state, ensuring users who tab through content encounter the flow in cognitive order even though visual order is different.

**Concrete example — Before/After for `/work-queue`:**
- **Before (current):** Filter controls at the top (Stage 3 first), then a flat table sorted by date with no priority indicators. Operator must scan all entries to find urgent items.
- **After (flow-correct):** Default sort by priority/urgency (Stage 2 first). Anomaly-flagged rows visually distinct at the top. Filter bar available beneath the H0 metric bar (always accessible) but visually subordinate. Operator sees urgent items immediately, then filters to narrow.

**Irrevocable Decision Moment:** Stage 4 (Act) — inline row action or bulk action. The action must be visually isolated from filter controls.

---

### Archetype C — Workflow / Stepper (Updated)

**Pages:** `/entry`, `/ocr/scan`

**Flow sequence:** [Progress Context] → [Current Step] → [Input] → [Next Action] → [Feedback]

```
PageShell (H0 — mandatory)
└─ ShellHeader with title + description [FLOW: Current Step — "What does this step do?"]
   └── Tight (12px)
├─ WorkflowProgress component [FLOW: Progress Context — "Where am I?"]
│  └─ Steps: ✅ Upload → 2️⃣ Verify → ⏳ Export
│  └── Breathing (48px) ⚠️ CRITICAL — separates progress from actual work
├─ Form/workspace panel (H1 — mandatory, max 1) [FLOW: Input]
│  └─ The current step's content — takes full visual weight
│  └── Structural (24px)
├─ Sidebar summary panel (H2 — optional, max 1) [FLOW: Context for Input]
│  └── Structural (24px)
├─ Action controls (H2 — mandatory, at bottom of H1 panel) [FLOW: Next Action]
│  └─ Primary: "Next Step" or "Submit". Secondary: "Save Draft"
│  └── Structural (24px) or Breathing (48px) if action has high impact
└─ Supplementary hints (H3 — optional, max 2) [FLOW: Feedback]
   └─ May be behind disclosure
```

**Irrevocable Decision Moment:** Stage 4 (Next Action). The "Next Step" or "Submit" button must have Breathing zone above it if the consequences are significant (data persistence, approval routing).

**Key flow validation:** The WorkflowProgress component MUST be above the H1 form panel and visually recessed (Surface 0). If the progress indicator is in a sidebar or Card, move it to H0.

---

### Archetype D — Detail / Edit View (Updated)

**Pages:** `/entry/[id]`, `/steel/batches/[id]`, `/steel/invoices/[id]`, `/steel/dispatches/[id]`, `/steel/customers/[id]`

**Flow sequence:** [Identify] → [Review] → [Decide] → [Modify] → [Confirm]

```
PageShell (H0 — mandatory)
└─ ShellHeader with entity name + status [FLOW: Identify]
   └── Breathing (48px) ⚠️ CRITICAL — separates ID from review
├─ Read-only data sections (H1 — mandatory, max 1) [FLOW: Review]
│  └─ Structured data display — NOT editable by default
│  └── Breathing (48px) ⚠️ CRITICAL — separates reviewing from deciding
├─ Action controls (H2 — mandatory, max 1) [FLOW: Decide]
│  └─ "Edit", "Approve", "Delete" buttons — visible but not dominant
│  └── Structural (24px)
├─ Inline edit disclosures (H2 — optional, max 3) [FLOW: Modify]
│  └─ Edit forms revealed only after clicking action controls
│  └── Structural (24px)
└─ Audit trail (H3 — optional, max 1) [FLOW: Confirm]
   └─ Created by, last updated, change history — Surface 0, muted
```

**Irrevocable Decision Moment:** Stage 3→4 (Decide → Modify). The "Edit" or "Delete" action must be separated from the data card by Breathing spacing. The modification panel (inline edit) must have a clear visual transition from the read-only data.

---

### Archetype E — Management / Settings (Updated)

**Pages:** `/settings`, `/settings/attendance`, `/profile`, `/billing`, `/plans`

**Flow sequence:** [Current State] → [Locate] → [Change] → [Confirm] → [Impact]

```
PageShell (H0 — mandatory)
└─ ShellHeader with key metrics [FLOW: Current State]
   └── Breathing (48px) — separates current state from navigation
├─ TabNav (H2 — mandatory for multi-tab pages) [FLOW: Locate]
│  └── Structural (24px)
├─ Primary settings content (H1 — mandatory, max 1 per tab) [FLOW: Change]
│  └─ The most critical settings on this tab — Card, Surface 2
│  └── Breathing (48px) — separates changing from secondary info
├─ Secondary settings groups (H2 — optional, max 3) [FLOW: Confirm]
│  └─ Surface 1 zones grouping related settings
│  └── Structural (24px) between groups
└─ Reference content (H3 — optional, max 2) [FLOW: Impact]
   └─ Billing history, plan comparison, audit log — behind disclosure OK
```

**Irrevocable Decision Moment:** Stage 3 (Change) for destructive settings (delete user, cancel plan, downgrade). The destructive action must have an explicit confirmation flow (modal or inline confirmation) before executing. The confirmation must have breathing space from the form controls.

---

### Archetype F — Intelligence / Analytics (Updated)

**Pages:** `/ai`, `/analytics`, `/email-summary`

**Flow sequence:** [Summary] → [Insight] → [Trend] → [Detail] → [Export]

```
PageShell (H0 — mandatory)
└─ ShellHeader with plan/metric bar [FLOW: Summary]
   └── Breathing (48px) ⚠️ CRITICAL — separates summary from primary insight
├─ Primary insight card (H1 — mandatory, max 1) [FLOW: Insight]
│  └─ Dominant chart or insight — Card, Surface 2
│  └── Breathing (48px) ⚠️ CRITICAL — separates key insight from supporting data
├─ Secondary detail sections (H2 — optional, max 3) [FLOW: Trend + Detail]
│  ├─ Trend diagnostics (Surface 1)
│  ├─ Manager insights (Surface 1)
│  └─ Secondary charts (Surface 1)
│  └── Structural (24px) between sections
└─ Monthly/telemetry sidebar (H3 — optional, max 1) [FLOW: Export]
   └─ Export controls, data freshness note — Surface 0
```

**Irrevocable Decision Moment:** Stage 3→4 (Trend → Detail). The operator commits to investigating a specific metric or anomaly. This should be signaled by a visual state change (disclosure opens, tab changes).

---

### Archetype G — Approval / Review (Updated)

**Pages:** `/approvals`

**Flow sequence:** [Triage] → [Select] → [Review] → [Decide] → [Confirm]

```
PageShell (H0 — mandatory)
└─ ShellHeader with counts + status [FLOW: Triage]
   └── Breathing (48px)
├─ Filter bar (H2 — mandatory, max 1) [FLOW: Select]
│  └── Structural (24px)
├─ List panel + Detail panel (H1 — mandatory, max 1 split) [FLOW: Review]
│  ├─ List: Dense, sorted by priority — items needing attention at top
│  └─ Detail: Full item display — read-only
│  └── Structural (24px) ⚠️ CRITICAL — separates review from decision
└─ Action bar (H2 — mandatory, max 1) [FLOW: Decide + Confirm]
   └─ Pinned to bottom of viewport
   └─ Approve (positive) / Reject (destructive) — visually distinct
   └─ No competing controls at equal weight
```

**Irrevocable Decision Moment:** Stage 4 (Decide — Approve/Reject). This is the clearest irrevocable decision in the app. The action bar must be:
- Pinned (always visible)
- Visually isolated from the detail panel (Structural spacing minimum)
- Approve/Reject buttons must use distinctly different visual treatments

---

### Archetype H — OCR & Capture (Updated)

**Pages:** `/ocr`, `/ocr/scan`, `/ocr/jobs/[jobId]`

**Flow sequence:** [Prepare] → [Capture] → [Review] → [Correct] → [Export]

```
PageShell (H0 — mandatory)
└─ ShellHeader with OCR status metrics [FLOW: Prepare]
   └── Breathing (48px)
├─ WorkflowProgress component [FLOW: Progress Context — for multi-step scan flow]
│  └─ Steps: 📷 Capture → 🔍 Review → ✏️ Correct → 💾 Export
│  └── Breathing (48px) ⚠️ CRITICAL
├─ Job control workspace (H1 — mandatory, max 1) [FLOW: Capture + Review + Correct]
│  ├─ Upload/scan controls (Card, Surface 2) [FLOW: Capture]
│  ├─ Result preview + confidence indicators (Card, Surface 2) [FLOW: Review]
│  └─ Field editor (Surface 1, zone) [FLOW: Correct]
│  └── Structural (24px) between sections within H1
├─ Guide card (H2 — optional, max 1) [FLOW: Support — never behind disclosure]
│  └── Structural (24px)
├─ Template manager (H2 — optional, max 1) [FLOW: Support]
│  └── Structural (24px)
└─ Export controls + metadata (H3 — optional, max 1) [FLOW: Export]
   └── Surface 0, may be behind disclosure
```

**Irrevocable Decision Moment:** Stage 4→5 (Correct → Export). The "Save" or "Submit Verification" button confirms the data is correct and triggers downstream effects. Must be visually isolated from the edit controls and preceded by a final summary view.

**Key flow validation:** The guide card must be VISIBLE (not behind disclosure) because it supports the workflow — it's H2, not H3.

---

### Archetype I — Operations Summary (Updated)

**Pages:** `/reports`, `/steel`, `/steel/charts`, `/steel/reconciliations`, `/email-summary`

**Flow sequence:** [Overview] → [Metrics] → [Explore] → [Detail] → [Export]

```
PageShell (H0 — mandatory)
└─ ShellHeader with factory/summary metrics [FLOW: Overview]
   └── Breathing (48px) ⚠️ CRITICAL — separates overview from key metrics
├─ Primary metric cards (H1 — mandatory, max 1 group) [FLOW: Metrics]
│  ├─ 2-4 summary cards (Card, Surface 2)
│  └── Breathing (48px) ⚠️ CRITICAL — separates key metrics from exploration
├─ Secondary report/summary grid (H2 — optional, max 3) [FLOW: Explore]
│  ├─ Report-type sections (Surface 1 — zone)
│  └── Structural (24px) between sections
├─ Results DataTable (H2 — optional, max 1) [FLOW: Detail]
│  └─ Dense, Surface 1 (zone) or Surface 2 (Card) depending on importance
│  └── Breathing (48px) if Dense
└─ Reference tables / disclosures (H3 — optional, max 2) [FLOW: Export]
   └─ Surface 0, may be behind disclosure
```

**Irrevocable Decision Moment:** Stage 2→3 (Metrics → Explore). The operator decides to investigate a specific metric area (clicks a metric card, opens a tab). This should trigger a visual transition — not just scrolling to content below.

---

## 6. Appendix: Quick Reference

### Flow Sequence Decision Tree

For any page, determine its flow sequence by asking these questions in order:

```
Q1: Is this page the operator's first view when they log in?
     YES → Archetype A (Dashboard) — Status → Anomaly → Drill-down → Action → Confirm
     NO  → continue

Q2: Is the operator here to view and act on a list of records?
     YES → Archetype B (Data Table) — Orient → Scan → Filter → Act → Confirm
     NO  → continue

Q3: Is the operator here to complete a multi-step process?
     YES → Archetype C (Workflow) — Progress → Step → Input → Next → Feedback
     NO  → continue

Q4: Is the operator here to view or edit a single record's details?
     YES → Archetype D (Detail) — Identify → Review → Decide → Modify → Confirm
     NO  → continue

Q5: Is the operator here to configure settings or manage their account?
     YES → Archetype E (Settings) — State → Locate → Change → Confirm → Impact
     NO  → continue

Q6: Is the operator here to analyze data, trends, or intelligence?
     YES → Archetype F (Analytics) — Summary → Insight → Trend → Detail → Export
     NO  → continue

Q7: Is the operator here to approve or reject items?
     YES → Archetype G (Approval) — Triage → Select → Review → Decide → Confirm
     NO  → continue

Q8: Is the operator here to capture OCR data?
     YES → Archetype H (OCR) — Prepare → Capture → Review → Correct → Export
     NO  → continue

Q9: Is the operator here to see an operational summary?
     YES → Archetype I (Operations Summary) — Overview → Metrics → Explore → Detail → Export
```

### Flow Audit Checklist

Before approving any page implementation, verify:

- [ ] Page uses the correct cognitive flow model for its archetype
- [ ] The H0 orientation zone is the FIRST visible section (no content above it)
- [ ] Flow stages proceed in the specified order (no out-of-sequence sections)
- [ ] The irrevocable decision moment has Breathing space before and after
- [ ] No flow stage is missing (every stage in the model is represented)
- [ ] Each flow stage maps to the correct H-level and density
- [ ] Workflow-type pages use the `WorkflowProgress` component in H0
- [ ] Multi-step OCR and entry flows show the step indicator before the H1 content
- [ ] The page provides closure (Confirm stage) — it doesn't end on an action or data display without feedback

### Spacing-to-Flow Mapping Quick Reference

| Transition | Minimum Spacing | When |
|-----------|----------------|------|
| H0 → H1 (Orient → Primary Content) | Breathing (48px) | Always — every archetype |
| H1 → H2 (Primary → Supporting) | Breathing (48px) | Always — unless archetype specifies Structural |
| Before an irrevocable decision moment | Breathing (48px) | Always — the moment must have breathing room |
| Between H2 sections | Structural (24px) | Always |
| H2 → H3 (Supporting → Reference) | Structural (24px) | Always |
| After action/confirmation | Structural (24px) | Before the next H2/H3 section |

### Relationship to Sub-Phase D

This specification (Sub-Phase C) defines the **what order** and **what cognitive rationale**. Sub-Phase D (code implementation) will translate these flow models into:
1. The `WorkflowProgress` React component
2. Reordered section containers on each affected page
3. Updated spacing tokens to enforce Breathing/Structural/Tight at flow transitions
4. Governance tooling to validate flow sequence automatically
