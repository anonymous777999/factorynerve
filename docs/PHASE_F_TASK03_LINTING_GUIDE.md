# Sub-Phase F — Task 3: Orchestration Linting Guide

**Date:** June 9, 2026
**Purpose:** Binary pass/fail checklist for code review of every new or modified DPR.ai page. Embed in pull request template.

---

## How to Use

Before merging any PR that creates or significantly modifies a page:
1. Run each checklist item against the rendered page
2. Every item must answer **YES** — any **NO** is a blocking issue
3. Document exceptions with architecture board approval reference

---

## PR Template Section

Copy the following block into your PR description:

---

### Orchestration Linting Checklist

#### HIERARCHY
> The page has exactly one H0 orientation zone containing title, status, and primary action on a bare surface.

- [ ] Does the page have exactly **one H0 orientation zone**? (Must be YES)
- [ ] Does the H0 zone contain **only**: title, status, primary action (+ max one optional element)? (Must be YES)
- [ ] Is the H0 zone on a **bare surface** (Surface 0), not inside a Card? (Must be YES)
- [ ] Does the **H1 section begin after a Breathing rhythm zone** (48px+ / `--rhythm-breathing`)? (Must be YES)
- [ ] Are there **3 or fewer H2 sections** on this page? (Must be YES)
- [ ] Are there **2 or fewer H3 sections** on this page? (Must be YES)
- [ ] Are **all H3 sections positioned after H1** in the document order? (Must be YES)

**Rationale for each:** H0 must be unambiguous — one identity zone per page. Multiple H2 sections (4+) create information overload. H3 before H1 places reference content above primary workflow.

#### CARD GOVERNANCE
> Cards are the exception, not the default. Maximum 4 bordered Cards in the primary content area.

- [ ] Does **every bordered Card contain either interactive content or a navigable data record**? (Must be YES)
- [ ] Are there **4 or fewer bordered Card sections** visible simultaneously? (Must be YES)
- [ ] Is there **any Card nested inside another Card**? (Must be **NO**)
- [ ] Does **any H0 zone use a bordered Card** as its container? (Must be **NO**)

**Rationale:** Cards signal interactivity — using them for non-interactive content misleads the user. Nested Cards create double-border visual noise. H0 on a Card makes the page identity compete with page content.

#### SPACING RHYTHM
> Three distinct spacing modes (Breathing/Structural/Tight) communicate section transitions, not just margins.

- [ ] Is there a **Breathing zone** (`--rhythm-breathing`, 48px+) **before and after every H1 section**? (Must be YES)
- [ ] Are **Structural spacing values** (`--rhythm-structural`, 24px) used **between components**, not between H-level sections? (Must be YES)
- [ ] Is the spacing between the **H0 zone and H1 zone visually larger** than the spacing between H1 and H2? (Must be YES)

**Rationale:** Uniform spacing (`space-y-6` everywhere) is the most common layout failure. The eye uses spacing differences to infer section relationships. Without varied rhythm, all sections appear equally related.

#### DENSITY TRANSITIONS
> Every page begins Sparse. Two Dense sections may never be adjacent.

- [ ] Does the page **begin with a Sparse zone** (the H0 identity area)? (Must be YES)
- [ ] Are any two **Dense sections vertically adjacent with no Standard transition**? (Must be **NO**)
- [ ] Do **Dense sections use a scrollable container** at tablet and below (not reflow to single-column)? (Must be YES)

**Rationale:** Starting Dense disorients the user. Two adjacent Dense sections create an information wall with no visual rest. Reflowing tables at tablet destroys column context.

#### SURFACE LAYERING
> Maximum 3 surface levels active simultaneously. H3 is always Surface 0.

- [ ] Are there **2 or fewer surface elevation levels** active simultaneously in the primary content area? (Must be YES)
- [ ] Does **background information (H3)** use **Surface 0** (no Card, no border, no zone tint)? (Must be YES)

**Rationale:** More than 3 surface levels creates visual noise. H3 at Surface 0 ensures reference content cannot compete with primary workflow.

#### COGNITIVE FLOW
> Section sequence follows the archetype flow model. The most important action is architecturally isolated.

- [ ] Does the **section sequence match the flow model** for this page archetype? (See Composition Governance Spec Section 8) (Must be YES)
- [ ] Is the **most important action or anomaly architecturally isolated** (Breathing space before and after)? (Must be YES)

**Rationale:** Users read pages in document order. If H2 content appears before H1, the user processes supporting context before understanding the primary workflow.

#### RESPONSIVE ORCHESTRATION
> Sections collapse at breakpoints according to hierarchy level. Order is preserved.

- [ ] Do **H2 sections collapse at tablet** by default? (Must be YES)
- [ ] Do **H3 sections collapse at mobile** by default? (Must be YES)
- [ ] Does the page **preserve section order at all breakpoints**? (Must be YES)

**Rationale:** H2/H3 collapse at smaller viewports is the core responsive orchestration pattern. Reordering sections between breakpoints destroys cognitive flow.

#### DASHBOARD-SPECIFIC (only for dashboard pages)
> Dashboard pages have additional constraints from the Dashboard Composition System.

- [ ] Does the **first visible zone contain only**: health indicator, action count, refresh time? (Must be YES)
- [ ] Are there **12 or fewer metric cards** total? (Must be YES)
- [ ] Does the dashboard follow the **2-3-2 density rhythm** (or a documented justified exception)? (Must be YES)
- [ ] Does **every Tier 1 card in an anomalous state link to a detail page**? (Must be YES)

**Rationale:** Dashboards are the most density-sensitive archetype. More than 12 cards creates cognitive overload. Anomalous cards without detail links create dead ends.

---

## Example Usage in PR

```
## Orchestration Linting

- [x] HIERARCHY: Exactly one H0 zone ✅
- [x] HIERARCHY: 3 or fewer H2 sections ✅
- [x] CARD GOVERNANCE: 4 or fewer Cards ✅
- [x] CARD GOVERNANCE: No nested Cards ✅
- [x] SPACING: Breathing before H1 ✅
- [x] DENSITY: Page begins Sparse ✅
- [x] DENSITY: No adjacent Dense sections ✅
- [x] SURFACE: H3 on Surface 0 ✅
- [x] COGNITIVE: Flow matches archetype B ✅
- [x] RESPONSIVE: H2 collapses at tablet ✅

Result: **PASS** (all items YES)
```

---

## Embedding in PR Templates

### GitHub Template

Create `.github/PULL_REQUEST_TEMPLATE/page-change.md`:

```markdown
## Summary
[Describe the page change]

## Orchestration Linting
Copy the checklist from `docs/PHASE_F_TASK03_LINTING_GUIDE.md` into this section
and check each item. All items must pass before merging.

## Screenshots
[Before/after screenshots showing the page structure at desktop and mobile]
```

### Manual Process

For AI-assisted development, prepend the following to every code review prompt:

> **Critical:** Before approving this PR, run the Orchestration Linting Checklist from `docs/PHASE_F_TASK03_LINTING_GUIDE.md`. Every item must pass. If any item fails, explain the violation and suggest a fix.
