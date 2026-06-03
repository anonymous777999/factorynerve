# Premium Dashboard — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase E, Item 6
# Route: /premium/dashboard
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/premium/dashboard` |
| Workspace Name | Owner Intelligence Board |
| Operational Role | Analytics dashboard for factory owners. Features synchronized filter bars, multi-chart analytics grids, risk anomaly cards, and detailed audit trails (GET /premium/dashboard, GET /premium/audit-trail). |
| Business Impact | Supports business oversight. Connects audit details with commercial performance outputs. |
| User Population | Owner (primary), Admin. Restricted gate: requires Active Premium subscription plan. |
| Peak Usage Context | Weekly executive meetings. |
| Predecessor Workspaces | `/analytics` |
| Successor Workspaces | `/control-tower` |

### 1.2 Operational Importance

Offers high-level executive oversight. Integrates financial statistics, threat risks, and operator compliance logs into a single analytical page.

### 1.3 Current State Failures

- **Failure 1: Missing plan gate checks.** Renders blank screens for users on free tiers instead of showing a payment upgrade gate page.
- **Failure 2: Loose filter synchronization.** Modifying the top shift filter fails to update chart components below.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Command Center | TYPE 8 — multi-chart dashboard. |
| Workflow Category | Oversight | Renders aggregated audit and commercial metrics. |
| Operational Behavior | Data-Dense | Multiple chart and ledger tables rendered together. |
| Data Density | VERY HIGH | Dozens of metrics, indicators, and list items. |
| Realtime Complexity | LOW | Page reload queries. |
| AI Complexity | MEDIUM | Displays threat risk metrics. |
| Audit Complexity | HIGH | Core audit trail logs. |
| Decision Pressure | LOW | Information auditing. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /premium/dashboard` | GET | Retrieve overall business metrics | `financials`, `risk_analysis`, `charts` |
| `GET /premium/audit-trail` | GET | Retrieve user actions log | `audit_logs` |
| `GET /premium/executive-pdf` | GET | Download summary report PDF | Binary report stream |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**WORKSTATION SHELL + LINKED FILTER BAR + COMPILATION GRID**
Synchronized filters at the top (Factory, Shift range). Main area lists charting panels, risk assessment cards, and a high-density Audit Trail table at the bottom.

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Owner Intelligence Board      │ [ Download PDF (sec) ]      │
├──────────────────────────────────────────────────────────────────────────────┤
│ FILTERS: Factory: [ Factory 1 ▾ ]  Shift: [ All Shifts ▾ ]  Range: [ 30 Days]│
├──────────────────────────────────────┬───────────────────────────────────────┤
│ RISK ASSESSMENTS                     │ BUSINESS CHARTS                       │
│ - Money at risk: $1,200 (low)        │ ┌───────────────────────────────────┐ │
│ - Stock trust:   98.2%               │ │ Revenue & Performance Charts      │ │
│ - Dispatch risk: Normal              │ │ [Multi-Line Chart]                │ │
│                                      │ └───────────────────────────────────┘ │
├──────────────────────────────────────┴───────────────────────────────────────┤
│ AUDIT TRAIL LOGS TABLE                                                       │
│ ┌──────────────┬─────────────┬─────────────┬───────────────────────────────┐ │
│ │ Action       │ User        │ Timestamp   │ Details                       │ │
│ ├──────────────┼─────────────┼─────────────┼───────────────────────────────┤ │
│ │ Auth Release │ Owner (Sam) │ 04 Jun 9:30 │ Released credit Apex Steel    │ │
│ └──────────────┴─────────────┴─────────────┴───────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: Risk card warnings.
- Level 2: Linked filter dropdowns.
- Level 3: Audit log listings.

---

## 6. TABLE & DATA STRATEGY

High-density audit log table at the bottom. Row height: Compact (36px).

---

## 7. FORM & INPUT STRATEGY

Synchronized filters update queries reactively.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

Surfaces threat metrics and user interaction audits.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing rhythm.
- Divider borders: `var(--border-default)`.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Charts scale dynamically. Audit logs scroll horizontally on mobile.

---

## 11. COMPONENT MAPPING

- Layout: `WorkstationShell`
- Tables: `DataTable`
- Filters: `Select` primitives

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Gated dashboard access via plan features. Redirects non-premium users to `/plans` upgrade checkout page.
- Connects shift filters to all queries.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Define base layouts.
2. Hook `GET /premium/dashboard` and `GET /premium/audit-trail` endpoints.
3. Build the synchronized top filter panel.

### 13.2 Critical Constraints

- Restrict access to premium subscription accounts.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
