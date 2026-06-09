# Steel Dispatches — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase D, Item 9
# Route: /steel/dispatches
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/steel/dispatches` |
| Workspace Name | Steel Dispatches Ledger & Creator |
| Operational Role | Tracks outgoing dispatches (GET /dispatches) and records new dispatch orders (POST /dispatches). Gated to steel factories. |
| Business Impact | Direct link to customer delivery compliance. If this workspace fails, logistics supervisors cannot clear trucks for delivery, blocking supply chains. |
| User Population | Logistics Supervisor, Dispatch Operator, Sales Manager. |
| Peak Usage Context | Morning dispatch runs — clearance and tracking of delivery trucks. |
| Predecessor Workspaces | `/steel` (hub) |
| Successor Workspaces | `/steel/dispatches/[id]`, `/steel/inventory` |

### 1.2 Operational Importance

In physical steel operations, dispatch tracking is critical. This workspace coordinates vehicle codes, customer references, and loaded weights to prevent stock discrepancy issues.

### 1.3 Current State Failures

- **Failure 1: Overlapping panels.** The registration form and the list table overlap on smaller monitors.
- **Failure 2: Lack of weight verification checks.** Operators can record dispatches without checking if the customer has matching credit limits or if stock exists.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Operational Form + List | TYPE 3/4 — Hybrid layout combining list tracking and input form. |
| Workflow Category | Record | Verify and track physical movements of steel goods. |
| Operational Behavior | Data-Dense | Renders multiple truck details and delivery weights. |
| Data Density | HIGH | Detailed metrics on vehicle codes and delivery weights. |
| Realtime Complexity | LOW | Page load query. |
| AI Complexity | NONE | Raw database record. |
| Audit Complexity | MEDIUM | Writes core dispatch history files. |
| Decision Pressure | HIGH | Clearing transport trucks quickly. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /steel/dispatches` | GET | List historical dispatches | `dispatches` |
| `POST /steel/dispatches` | POST | Log new dispatch order | `dispatch_id`, `status` |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**SPLIT WORKSPACE (List Left, Form Right)**
Left pane: Table listing current dispatches. Right pane: Collapsible panel containing the dispatch entry form.

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Steel Dispatches Tracker                                   │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ DISPATCHES LIST TABLE                │ NEW DISPATCH FORM                     │
│ ┌────────┬─────────────┬───────────┐ │ Customer: [ Apex Steel ▾ ]            │
│ │ Veh ID │ Customer    │ Weight(kg)│ │ Invoice: [ Inv-982 ▾ ]                │
│ ├────────┼─────────────┼───────────┤ │ Truck No: [ HR-55-A-1234 ]            │
│ │ HR-55A │ Apex Steel  │ 12,000    │ │ Tare Wt (kg): [ 8,000 ]               │
│ │ DL-3CA │ Prime Infra │ 8,500     │ │ Gross Wt (kg): [ 20,000 ]             │
│ └────────┴─────────────┴───────────┘ │ Net Loaded: 12,000 kg                 │
│                                      │ [ Register Dispatch (primary) ]       │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: Truck overload warnings.
- Level 2: Target weight input fields.
- Level 3: Registration triggers.

---

## 6. TABLE & DATA STRATEGY

- Row height: Compact (36px).
- Click on truck row navigates to `/steel/dispatches/[id]`.

---

## 7. FORM & INPUT STRATEGY

Form inputs perform dynamic mathematical calculations:
- `Net weight = Gross weight - Tare weight`.
- Form checks if net weight is within stock limits.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

N/A.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing rhythm.
- Divider borders: `var(--border-default)`.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Stacks vertically on mobile. New dispatch shifts to an overlay modal drawer.

---

## 11. COMPONENT MAPPING

- Grid: `DataTable`
- Input: `Input` and `Select` primitives
- Button: `Button` primitive

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Splitting form and list into distinct panes prevents overlapping layouts on smaller floor displays.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Scaffold splitscreen panel.
2. Hook `GET /steel/dispatches` query.
3. Wire the dispatch entry form parameters.

### 13.2 Critical Constraints

- Gross weight must be larger than tare weight.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
