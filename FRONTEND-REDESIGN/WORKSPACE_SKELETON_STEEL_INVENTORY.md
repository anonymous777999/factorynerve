# Steel Inventory — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase D, Item 2
# Route: /steel/inventory
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/steel/inventory` |
| Workspace Name | Steel Inventory Management |
| Operational Role | Lists all raw, semi-finished, and finished steel inventory items alongside active stock levels. Enables searching, filtering, and checking stock status. Gated to steel factories. |
| Business Impact | Ensures operators can verify raw steel availability before beginning production batches. Prevents production halts due to material stockouts. |
| User Population | Factory Manager, Inventory Supervisor, Operator. |
| Peak Usage Context | Shift startup — verifying starting stock levels. |
| Predecessor Workspaces | `/steel` (hub) |
| Successor Workspaces | `/steel/inventory/transactions`, `/steel/production/record` |

### 1.2 Operational Importance

Managing stock balances is critical in steel operations. This workspace presents the real-time stock-on-hand, calculated by aggregating transactions. It provides a visual density-focused list to check material grades (e.g. billets, rebars, scrap) and locations.

### 1.3 Current State Failures

- **Failure 1: Brittle UI list height.** The inventory list container uses custom viewport height pixel calculations, truncating lists on lower-resolution monitors.
- **Failure 2: Lack of industry scoping.** Non-steel factories can access this route, displaying blank screens or backend database errors.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Entity List | TYPE 4 — list of inventory stock levels with search and filters. |
| Workflow Category | Record | View and audit active stock counts. |
| Operational Behavior | Data-Dense | Renders multiple grades, weights, and locations. |
| Data Density | HIGH | Detailed metrics on weights and locations. |
| Realtime Complexity | LOW | Fetching active state on page load. |
| AI Complexity | NONE | Raw stock measurement. No AI predictions needed. |
| Audit Complexity | LOW | Query-only list view. |
| Decision Pressure | MEDIUM | Spotting raw material shortages. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /steel/inventory/items` | GET | List configured inventory items | `items` |
| `GET /steel/inventory/stock` | GET | List active stock levels for each item | `stock_levels` |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**WORKSTATION SHELL + SECTION PANEL**
A standard table layout displaying stock categories, item codes, weights, grades, and locations, with global filters at the top.

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Steel Inventory Overview                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ FILTERS: [Search...]  [Grade ▾]  [Location ▾]                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ STOCK LEVELS TABLE                                                           │
│ ┌───────────┬──────────────┬───────────────┬───────────────────────────────┐ │
│ │ Item Code │ Grade        │ Stock (kg)    │ Location                      │ │
│ ├───────────┼──────────────┼───────────────┼───────────────────────────────┤ │
│ │ B-102     │ Billet-Gr60  │ 42,500        │ Bay 1 A                       │ │
│ │ S-401     │ Scrap-Light  │ 12,300        │ Scrap Yard B                  │ │
│ └───────────┴──────────────┴───────────────┴───────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: Stock items with low balance.
- Level 2: Filters to narrow grade or location.
- Level 3: Item details.

---

## 6. TABLE & DATA STRATEGY

- Row height: Compact (36px).
- Column alignment: Numeric quantities (Stock weight) aligned right; text labels aligned left.

---

## 7. FORM & INPUT STRATEGY

Only search filters are present.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

N/A.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing rhythm.
- Divider borders: `var(--border-default)`.
- Text styles: Sentence case.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- On mobile, table scrolls horizontally.
- Location column hides on screens below 768px.

---

## 11. COMPONENT MAPPING

- Table: `DataTable`
- Shell: `WorkstationShell`

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Scopes routes strictly via the factory profile industry checks to block access from non-steel factories.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Define the inventory container within the `WorkstationShell`.
2. Connect endpoints (`GET /inventory/items` and `GET /inventory/stock`).
3. Set columns mapping grades, stock weights, and locations.

### 13.2 Critical Constraints

- Restrict access to steel factories.
- Stock calculations must align with backend inventory sums.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
- [x] Column formats fully defined.
