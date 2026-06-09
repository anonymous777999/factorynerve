# Plans — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase E, Item 4
# Route: /plans
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/plans` |
| Workspace Name | Subscription Plans & Pricing |
| Operational Role | Renders available platform tiers (Starter, Growth, Enterprise) and features. Allows managers and owners to upgrade subscriptions. |
| Business Impact | Restricts access to premium tools (like Steel Command Center or Advanced OCR tools). |
| User Population | Owner (makes purchasing decisions). All other roles (view active plan details). |
| Peak Usage Context | Factory registration or when attempting to access a locked feature. |
| Predecessor Workspaces | `/billing` |
| Successor Workspaces | `/billing` (checkout processes) |

### 1.2 Operational Importance

Shows product values. Enables owners to unlock features (like Steel ERP tools, advanced charts) by purchasing higher subscription tiers.

### 1.3 Current State Failures

- **Failure 1: Upgrade availability.** Non-owner roles can click upgrade buttons, which fail on the backend with authorization errors.
- **Failure 2: Lack of clear indicators.** Active plans are not visually distinguished from locked plans.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Entity Detail | TYPE 5 — plan listing card details. |
| Workflow Category | Record | View and select available subscription plans. |
| Operational Behavior | Static | Fixed tiers and price points. |
| Data Density | MEDIUM | Three pricing tier comparison cards. |
| Realtime Complexity | LOW | Page load query. |
| AI Complexity | NONE | Database record. |
| Audit Complexity | LOW | Simple log on selection updates. |
| Decision Pressure | MEDIUM | Cost-benefit upgrade decisions. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /plans` | GET | Retrieve plan tiers and features | List of plan tier JSONs |
| `POST /billing/orders` | POST | Initialize purchase order | `order_id`, `amount` |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**WORKSTATION SHELL + SECTION PANEL STACK**
A 3-column pricing grid. Each card represents a tier (Starter, Growth, Enterprise) showing price, target features list, and purchase triggers.

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Subscription Plans                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ PLANS COMPILATION GRID                                                       │
│ ┌────────────────────────┐  ┌────────────────────────┐  ┌──────────────────┐ │
│ │ Starter Plan           │  │ Growth (Active)        │  │ Enterprise Plan  │ │
│ │ Price: $29/mo          │  │ Price: $99/mo          │  │ Price: $299/mo   │ │
│ ├────────────────────────┤  ├────────────────────────┤  ├──────────────────┤ │
│ │ - Up to 2 users        │  │ - Up to 10 users       │  │ - Unlimited users│ │
│ │ - Basic OCR            │  │ - Steel ERP            │  │ - Dedicated support│ │
│ ├────────────────────────┤  ├────────────────────────┤  ├──────────────────┤ │
│ │ [ Downgrade ]          │  │ [ Active Plan ]        │  │ [ Upgrade (prim)]│ │
│ └────────────────────────┘  └────────────────────────┘  └──────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: "Upgrade" triggers for non-active packages.
- Level 2: Pricing details.
- Level 3: Active plan highlighting.

---

## 6. TABLE & DATA STRATEGY

N/A.

---

## 7. FORM & INPUT STRATEGY

N/A.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

None.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing rhythm.
- Active plan card highlights: `var(--surface-elevated)` background.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Stacks comparison cards vertically on mobile viewports.

---

## 11. COMPONENT MAPPING

- Cards: Reusable plan container components
- Buttons: `Button` primitive

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Disables payment actions for non-owners, providing a clean descriptive explanation of roles instead.
- Adds highlight outlines for active subscriptions.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Define base layout wrappers.
2. Hook `GET /plans` query.
3. Wire payment gateways to the primary action buttons.

### 13.2 Critical Constraints

- Upgrade options must only be enabled for users with the owner role.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
