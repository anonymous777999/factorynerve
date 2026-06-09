# Steel Production Record — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase D, Item 4
# Route: /steel/production/record
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/steel/production/record` |
| Workspace Name | Steel Production Record Worksheet |
| Operational Role | Operational sheet / form interface for recording daily production batches (POST /batches). Operators enter consumed raw weights, produced output items, and calculate efficiency, yield, and raw material loss. |
| Business Impact | Enables immediate capture of factory floor production runs. Prevents paper logging errors and provides production efficiency logs for management review. |
| User Population | Production Operator, Shift Supervisor. |
| Peak Usage Context | End of shift or batch run completion. |
| Predecessor Workspaces | `/steel` (hub) |
| Successor Workspaces | `/steel/batches`, `/steel/inventory` |

### 1.2 Operational Importance

Accurate reporting of heat runs, billet consumption, and finished rebar yields is critical for steel mills. This worksheet eliminates calculations by verifying inputs, checking stock quantities, and warning operators of excessive yield losses in real-time.

### 1.3 Current State Failures

- **Failure 1: Layout truncation in grid entries.** Multi-column fields (input items, output items) collapse on 1080p monitors.
- **Failure 2: Lack of raw stock checks.** Allows logging consumption values greater than physical stock-on-hand.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Immersive Form | TYPE 6 — focus on input fields, with active real-time math feedback. |
| Workflow Category | Execution | Multi-step form completion. |
| Operational Behavior | Data-Dense | Renders multiple input/output row builders. |
| Data Density | HIGH | Detailed inputs for raw and finished materials. |
| Realtime Complexity | LOW | Inter-field calculations completed on the client side. |
| AI Complexity | NONE | Rule-based calculations (e.g. yield loss %). |
| Audit Complexity | MEDIUM | Writes core production batches database records. |
| Decision Pressure | MEDIUM | Spotting raw stock inconsistencies before saving. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `POST /steel/batches` | POST | Log new production batch run | `batch_code`, `efficiency`, `loss_percent` |
| `GET /steel/inventory/stock` | GET | Validate stock limits | `stock_levels` |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**IMMERSIVE FORM (SectionPanel stack)**
Divided into three logical groups:
- Batch Header info (Shift, Furnace/Heat Code).
- Raw Material Consumption grid (Item selector, weight input).
- Production Yield Output grid (Item selector, weight produced).
- Yield Summary strip (calculated loss % and efficiency).

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Record Production Batch Run                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ BATCH HEADER: Shift: [ A ▾ ]  Furnace Code: [ H-402 ]                         │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ RAW INPUT CONSUMPTION                │ FINISHED YIELD OUTPUT                 │
│ Item             Weight (kg)         │ Item             Weight (kg)          │
│ [ Billet-Gr60 ▾] [ 12,000 ]          │ [ Rebar-12mm ▾ ]  [ 11,400 ]          │
│ [ Add input row ]                    │ [ Add output row ]                    │
├──────────────────────────────────────┴───────────────────────────────────────┤
│ YIELD CALCULATION STRIP:                                                     │
│ Consumed: 12,000 kg | Yield: 11,400 kg | Loss: 600 kg (5.0%) | Status: OK    │
├──────────────────────────────────────────────────────────────────────────────┤
│ [ Cancel (outline) ]                            [ Save Production Run (succ) ]│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: Yield loss percent anomalies (highlighted red if > 8.0%).
- Level 2: Raw consumption weight inputs.
- Level 3: Submit action button.

---

## 6. TABLE & DATA STRATEGY

Renders mini-tables (Row builders) for consumption and yield. Cell values are editable inputs.

---

## 7. FORM & INPUT STRATEGY

Form inputs enforce strict number validation rules:
- Consumed weight > 0 and <= stock-on-hand.
- Output weight > 0.
- Warning banner appears if loss % exceeds 8.0%.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

None.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing grid.
- Warning containers: `var(--status-warning-bg)`.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Stacks raw consumption and finished yields vertically on screens below 1024px.

---

## 11. COMPONENT MAPPING

- Inputs: `Input` and `Select` primitives
- Summary: `FactsGrid`
- Form: `SectionPanel`

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Prevents logging errors by performing real-time client-side checks on stock levels and calculating loss percentages before submission.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Scaffold multi-section layout form panels.
2. Wire real-time loss calculation listener.
3. Bind form submit to `POST /steel/batches`.

### 13.2 Critical Constraints

- Warn if yield loss is negative or excessive.
- Check active stock counts before permitting submission.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
- [x] Clear validation boundaries defined.
