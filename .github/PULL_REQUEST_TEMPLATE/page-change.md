## Summary

[Describe the page change — what page, what archetype, what changed]

## Before / After

| | Desktop | Tablet | Mobile |
|---|---------|--------|--------|
| **Before** | [screenshot] | [screenshot] | [screenshot] |
| **After** | [screenshot] | [screenshot] | [screenshot] |

## Orchestration Linting Checklist

*Every item must be YES before merging. See `docs/PHASE_F_TASK03_LINTING_GUIDE.md` for rationale.*

### Hierarchy
- [ ] Exactly **one H0 orientation zone** (title + status + primary action on bare Surface 0)
- [ ] **3 or fewer H2 sections**; **2 or fewer H3 sections**
- [ ] All H3 sections positioned **after H1** in document order
- [ ] H1 begins after **Breathing spacing** (48px / `--rhythm-breathing`)

### Card Governance
- [ ] **4 or fewer bordered Cards** visible simultaneously
- [ ] **No Card nested inside another Card**
- [ ] **No H0 zone inside a Card**

### Spacing Rhythm
- [ ] **Breathing zone** before and after every H1 section
- [ ] **Structural spacing** (24px) between components, not between H-levels
- [ ] H0↔H1 spacing **visually larger** than H1↔H2

### Density Transitions
- [ ] Page **begins with a Sparse zone** (the H0 identity area)
- [ ] **No two Dense sections adjacent** without a Standard transition
- [ ] Dense sections **scroll horizontally** at tablet and below (not reflow)

### Surface Layering
- [ ] **2 or fewer surface levels** active simultaneously in primary content area
- [ ] H3 sections use **Surface 0** (no Card, no border)

### Cognitive Flow
- [ ] Section sequence matches the **page archetype flow model** (see Governance Spec §8)
- [ ] Most important action or anomaly is **architecturally isolated** (Breathing around it)

### Responsive Orchestration
- [ ] **H2 sections collapse at tablet** by default
- [ ] **H3 sections collapse at mobile** by default
- [ ] Section order **preserved at all breakpoints**

### Dashboard-Specific (if applicable)
- [ ] First visible zone contains only: health + action count + refresh time
- [ ] **12 or fewer metric cards** total
- [ ] Follows **2-3-2 density rhythm** (or documented exception)
- [ ] Every Tier 1 card in anomalous state **links to a detail page**

## Pass / Fail

**Result:** ❌ FAIL / ✅ PASS

*If FAIL, list each failing item and the fix applied.*
