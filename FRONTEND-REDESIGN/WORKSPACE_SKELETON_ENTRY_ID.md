# DPR Entry Detail & Verification — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Production Domain, Item 2
# Route: /entry/[id]
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/entry/[id]` |
| Workspace Name | DPR Entry Details & Verification |
| Operational Role | Detailed layout of a single DPR entry (GET /entries/{entry_id}). Allows operators to edit their own entry draft, and allows supervisors to Approve (POST /entries/{entry_id}/approve) or Reject (POST /entries/{entry_id}/reject) entries. |
| Business Impact | Direct data verification before ledger commits. Blocks self-approval. |
| User Population | Operator (editing own entries), Shift Supervisor (approver), Manager. |
| Peak Usage Context | Shift closures — auditing and approving logged production runs. |
| Predecessor Workspaces | `/entry` |
| Successor Workspaces | `/approvals` |

### 1.2 Operational Importance

A single entry records tons of raw materials and efficiency metrics. Reviewing inputs, shift notes, and approval history ensures data integrity before it enters reporting systems.

### 1.3 Current State Failures

- **Failure 1: No back link.** Reopening the detail screen lacks back navigation hooks.
- **Failure 2: Self-approval leak.** Enables operators to trigger the approve request for their own logged entries, which then crashes at the backend validation gate.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Entity Detail | TYPE 5 — single entry detail and approval interface. |
| Workflow Category | Record | Verify production outputs. |
| Operational Behavior | Form-Driven | Allows editing cells and signing approvals. |
| Data Density | MEDIUM | Core metrics details. |
| Realtime Complexity | LOW | Page load query. |
| AI Complexity | NONE | Database record. |
| Audit Complexity | MEDIUM | Writes approval transitions to log files. |
| Decision Pressure | MEDIUM | Spotting and correcting operational logging errors. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /entries/{entry_id}` | GET | Load single entry details | Detailed entry JSON |
| `PUT /entries/{entry_id}` | PUT | Edit entry details | Updated entry JSON |
| `POST /entries/{entry_id}/approve` | POST | Approve entry log | `status` |
| `POST /entries/{entry_id}/reject` | POST | Reject entry log | `status` |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**FULL-WIDTH COMMAND (centered detail card)**
A details layout presenting:
- Header (Entry Shift details, Date, current status badge).
- 2-Column FactsGrid (Left: Production parameters, Right: Consumption parameters).
- Remarks text field.
- Action Footer (Approve, Reject, Edit, Delete).

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Entry Details (Shift A) │ ← Back to production logs        │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ PRODUCTION OUTPUT                    │ RAW CONSUMPTION                       │
│ Item: Rebar-12mm                     │ Item: Billet-Gr60                     │
│ Qty:  11.4 Tons                      │ Qty:  12.0 Tons                       │
│ Code: Furnace Heat-402               │ Loss: 0.6 Tons                        │
├──────────────────────────────────────┴───────────────────────────────────────┤
│ [ Reject Entry (danger) ]                          [ Approve Log (success) ] │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: Current status badge.
- Level 2: Output vs Consumption values comparison.
- Level 3: Approval decision footer.

---

## 6. TABLE & DATA STRATEGY

FactsGrid 2-column key-value details layout.

---

## 7. FORM & INPUT STRATEGY

Editing form collects:
- Output Quantity.
- Raw Consumption Weight.
- Shift code select.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

Surfaces creation metadata (Operator name, logs timestamp).

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing rhythm.
- Warnings: `var(--status-danger-bg)`.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Stacks vertically on mobile.

---

## 11. COMPONENT MAPPING

- Layout: `WorkstationShell`
- Summary: `FactsGrid`
- Buttons: `Button` primitive

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Disables the Approve action button for operators who created the entry (self-approval checks).

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Define base layout wrappers.
2. Hook `GET /entries/{entry_id}`.
3. Wire edit and approval action buttons.

### 13.2 Critical Constraints

- Non-supervisors cannot approve logs.
- Block self-approval actions on the client.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
