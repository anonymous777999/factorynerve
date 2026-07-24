# DPR.ai COMPOSITION CONSTRAINTS — INCLUDE IN EVERY PAGE GENERATION PROMPT

*Word count: ~590 words*

---

## ABOUT THIS APPLICATION

DPR.ai is an industrial ERP platform. Pages are operational workflows, not marketing surfaces. Reference: SAP Fiori, Linear — not Dribbble.

## PAGE STRUCTURE RULES

Every page has **exactly one H0 zone** (page identity): title, status badge, metrics, primary action. H0 is **always on a bare surface** (no Card, no border). Use `PageShell` / `WorkstationShell` as the outermost wrapper.

The **H1 section** is the operational heart — visually dominant, at Surface 2 (Card with `--border-default`). At most **1 H1** per page. H1 begins after Breathing spacing (48px / `--rhythm-breathing`) from H0.

Maximum **3 H2 sections** (supporting context). H2 uses Surface 1 (zone tint, no Card border). H2 sections are **visible by default** — never behind a disclosure panel.

Maximum **2 H3 sections** (background info). H3 uses Surface 0 (bare page background, muted text). H3 **may** be behind a disclosure panel.

Section order: **H0 → H1 → H2 → H3**. Never reorder. Never place H2 or H3 above H1.

## CARD GOVERNANCE RULES

Cards (Surface 2, bordered) are the **exception**, not the default. A Card is only used when: (a) content is interactive (forms, controls, CTAs), or (b) content is a navigable data record.

Maximum **4 bordered Cards** visible in the primary content area.

- **Never** nest a Card inside another Card.
- **Never** put the H0 zone inside a Card.
- **Never** use Card for non-interactive reference content (use Surface 1 zone tint or Surface 0 bare).
- H1 Cards use `--border-default`. H2 Cards (rare) use `--border-subtle`.

## SPACING RULES

Three spacing levels — **never** use uniform spacing:
- **Breathing** (48px, `--rhythm-breathing`): between H0↔H1, H1↔first H2, before and after Dense sections
- **Structural** (24px, `--rhythm-structural`): between H2 sections, within H1, filter↔table
- **Tight** (12px, `--rhythm-tight`): within components (label↔value, icon↔text)

The spacing between H0 and H1 must be **visually larger** than between H1 and H2.

## DENSITY RULES

Every page **must begin with a Sparse section** (the H0 zone). Two Dense sections (DataTable, dense card grid) may **never** be directly adjacent — a Standard or Sparse zone must exist between them. Dense sections must be preceded by Breathing spacing (48px). At tablet viewports, Dense sections **scroll horizontally** — they do not reflow.

## SURFACE LAYERING RULES

Maximum **2 surface levels** active simultaneously in the primary content area (+ page background). H3 reference content is always Surface 0 — no Card, no zone tint.

## CRITICAL DO-NOTS

- **DO NOT** start with a Card as the default container. Ask: "Is this interactive or navigable?" If no, use Surface 1 or 0.
- **DO NOT** use `space-y-6` / `space-y-4` as the sole spacing across the entire page. Vary spacing by section relationship.
- **DO NOT** hide H2 content behind a `<details>` / `DisclosurePanel`. Only H3 content goes behind disclosures.
- **DO NOT** render more than 4 bordered Cards on any page. If you have 5+ sections, demote some to Surface 1.

## QUICK REFERENCE — Before adding ANY section, answer:

1. What H-level? (H0/H1/H2/H3)
2. Does this data already appear in H0? (One-Source Rule)
3. How many Cards already on this page? (>4 → demote)
4. What surface level? (0/1/2)
5. What spacing before it? (Breathing/Structural/Tight)
6. Is the preceding section also Dense? (If yes, add transition zone)

*Validation: Reviewed against the 10 highest-severity audit pages (see PHASE_F_TASK01). Rules reflect actual failure patterns. Phase 3 entry task: test with a live AI generation prompt before first use.*
