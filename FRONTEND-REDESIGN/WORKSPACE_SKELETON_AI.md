# AI Operations — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase E, Item 7
# Route: /ai
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/ai` |
| Workspace Name | AI Intelligence Center |
| Operational Role | Interactive interface for natural language database queries, suggestion auditing, anomaly logs checking, and executive reports generation (POST /ai/query, GET /ai/suggestions, GET /ai/anomalies). |
| Business Impact | Integrates business analytics with natural language search. |
| User Population | Owner, Factory Manager, Accountant. |
| Peak Usage Context | Strategic decision reviews or anomaly debugging checks. |
| Predecessor Workspaces | `/premium/dashboard` |
| Successor Workspaces | `/control-tower` |

### 1.2 Operational Importance

Consolidates intelligent operations tools. Exposes natural language search inputs alongside automated anomalies logs.

### 1.3 Current State Failures

- **Failure 1: Static summaries.** Executive summaries do not poll progress updates, leaving users with blank displays during generation runs.
- **Failure 2: Lack of inputs.** Search input lacks focus and execution indicators.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Command Center | TYPE 8 — multi-tool AI operations panel. |
| Workflow Category | Oversight | Renders intelligent suggestions and queries. |
| Operational Behavior | Form-Driven | Search and generation queries. |
| Data Density | HIGH | Suggestions grids and anomaly listings. |
| Realtime Complexity | MEDIUM | Polling summary generation tasks. |
| AI Complexity | HIGH | Natural language query execution. |
| Audit Complexity | MEDIUM | Logs query requests. |
| Decision Pressure | MEDIUM | Spotting and investigating anomalies. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `POST /ai/query` | POST | Execute natural language DB search | `sql_query`, `result_data` |
| `GET /ai/suggestions` | GET | List automated suggestions | `suggestions` |
| `GET /ai/anomalies` | GET | List recorded anomalies | `anomalies` |
| `POST /ai/executive-summary/jobs` | POST | Trigger background summary job | `job_id`, `status` |
| `GET /ai/jobs/{job_id}` | GET | Check summary generation status | `status`, `progress`, `result` |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**SPLIT VIEW (Console Left, Insights Right)**
Left pane: Natural Language Query Console (input area, SQL block, and result grid). Right pane: Tabbed panels showing active Suggestions and Anomalies.

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: AI Intelligence Center                                     │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ NATURAL LANGUAGE CONSOLE             │ SUGGESTIONS & ANOMALIES               │
│ Ask: [ How many billets used shift A ]│ TABS: [Suggestions ●] [Anomalies]      │
│ [ Execute Query (primary) ]          │ ┌───────────────────────────────────┐ │
│ Result Data Grid:                    │ │ Suggested Action:                 │ │
│ - Shift A bil consumption: 12,000 kg │ │ Adjust furnace temperature H-402  │ │
│ - Efficiency: 95.0%                  │ │ [ Apply (prim) ]  [ Dismiss ]     │ │
│                                      │ └───────────────────────────────────┘ │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: Anomaly warning alerts.
- Level 2: Query console inputs.
- Level 3: AI recommendations.

---

## 6. TABLE & DATA STRATEGY

Renders search result grids and anomaly lists. Compact row density.

---

## 7. FORM & INPUT STRATEGY

Console search text inputs.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

Visualizes AI usage metrics.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing rhythm.
- Console background: `var(--surface-shell)`.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Stacks vertically on mobile.

---

## 11. COMPONENT MAPPING

- Layout: `WorkstationShell`
- Inputs: `Input` primitive
- Cards: Reusable recommendation cards

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Integrates 3-second polling checking for background report summaries.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Scaffold splitscreen layout.
2. Hook query endpoints.
3. Wire the background summary checker.

### 13.2 Critical Constraints

- SQL block must be read-only.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
