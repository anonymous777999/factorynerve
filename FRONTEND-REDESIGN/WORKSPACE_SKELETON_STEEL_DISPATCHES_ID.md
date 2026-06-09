# Steel Dispatch Detail — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase D, Item 10
# Route: /steel/dispatches/[id]
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/steel/dispatches/[id]` |
| Workspace Name | Steel Dispatch Order Details |
| Operational Role | Renders the detail view of a single dispatch order (GET /dispatches/{dispatch_id}). Handles dispatch updates, gate clearance, status logs, and weighing verification. Gated to steel factories. |
| Business Impact | Direct order compliance checking. Prevents unauthorized delivery truck exits from the factory gate. |
| User Population | Logistics Supervisor, Weighbridge Operator, Gate Guard. |
| Peak Usage Context | Weighing truck at exit and gate clearance. |
| Predecessor Workspaces | `/steel/dispatches` |
| Successor Workspaces | `/steel/invoices` |

### 1.2 Operational Importance

A single dispatch event is a core transition point where factory inventory converts to active client delivery. Confirming truck gross weight matches target loading is essential to prevent compliance issues.

### 1.3 Current State Failures

- **Failure 1: Missing back navigation.** No path back to the dispatches list page.
- **Failure 2: Lack of weight variance indicators.** Inconsistent gross weights (exceeding loading margin) are not highlighted to weighbridge operators.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Entity Detail | TYPE 5 — single dispatch detail and gate release control area. |
| Workflow Category | Record | Trace delivery events. |
| Operational Behavior | Data-Dense | Renders load details and weight comparisons. |
| Data Density | MEDIUM | Focused details of one truck event. |
| Realtime Complexity | LOW | Page reload query. |
| AI Complexity | NONE | Raw database record. |
| Audit Complexity | MEDIUM | Writes gate transition timestamps. |
| Decision Pressure | HIGH | Weighbridge verification delays block gate throughput. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /steel/dispatches/{dispatch_id}` | GET | Load single dispatch profile | Detailed dispatch JSON |
| `POST /steel/dispatches/{dispatch_id}/status` | POST | Update active status (e.g. Weighing, Dispatched) | `status`, `dispatch_id` |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**FULL-WIDTH COMMAND (centered detail card)**
Focused detail card showing:
- Header (Vehicle ID, date, current status badge).
- 2-Column FactsGrid (Left: Client & Order details, Right: Weighing specs).
- Warning banner (shown if weight variance exceeds 2.0%).
- Action footer (e.g. "Weigh truck", "Approve Exit").

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Dispatch Details (HR-55-A-1234)  │ ← Back to dispatches     │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ CLIENT DETAILS                       │ WEIGHING METRICS                      │
│ Customer: Apex Steel Ltd             │ Tare Weight:  8,000 kg                │
│ Order Ref: Ord-102                   │ Target Loaded: 12,000 kg              │
│ Invoice Ref: Inv-982                 │ Gross Weight: 20,100 kg               │
│                                      │ Actual Net:   12,100 kg (Variance ok) │
├──────────────────────────────────────┴───────────────────────────────────────┤
│ [ Log weighing (secondary) ]                      [ Confirm Gate Release (succ)]│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: Active status badge.
- Level 2: Weight variance metric check.
- Level 3: "Confirm Release" exit button.

---

## 6. TABLE & DATA STRATEGY

FactsGrid 2-column key-value details layout.

---

## 7. FORM & INPUT STRATEGY

Dialog form to input gross weighbridge weights.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

Tracks gate-pass audit trail timestamps.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing rhythm.
- Warnings: `var(--status-danger-bg)`.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Stacks fields vertically on small screens.

---

## 11. COMPONENT MAPPING

- Layout: `WorkstationShell`
- Summary: `FactsGrid`
- Buttons: `Button` primitive

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Integrates automatic weight variance warnings if Net weight differs from target by > 2.0%.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Define core details layout.
2. Hook `GET /steel/dispatches/{dispatch_id}`.
3. Wire status update hooks.

### 13.2 Critical Constraints

- Block "Approve Exit" action if truck status is not "Weighed".

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
