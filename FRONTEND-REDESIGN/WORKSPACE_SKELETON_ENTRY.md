# Daily DPR Entry — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Production Domain, Item 1
# Route: /entry
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/entry` |
| Workspace Name | Daily Production Entry (DPR) Workstation |
| Operational Role | Operational workspace for logging daily production metrics. Features two main paths: (1) Smart Input console using AI natural language parsing to extract table cells (`POST /entries/smart`), and (2) standard form entry (`POST /entries`). Also lists today's logged entries (`GET /entries/today`). |
| Business Impact | Core production ledger ingestion. If this workspace fails, shift operators cannot record manufacturing outputs, causing complete loss of operational tracking and reporting data. |
| User Population | Operator, Shift Supervisor. |
| Peak Usage Context | Shift closures — operators record final heat logs, outputs, and consumption. |
| Predecessor Workspaces | `/dashboard` |
| Successor Workspaces | `/entry/[id]` (to review and edit particular entries), `/approvals` (for supervisor verification) |

### 1.2 Operational Importance

DPR Entry is the daily operational data gateway. Under shift pressure, manual table input is slow and error-prone. The Smart Input natural language parser resolves this by extracting tables directly from simple chat-like descriptions (e.g. "Shift A processed 45T billets with 1.2T loss"). Today's logged entries list provides instant feedback to the operator that their records were recorded.

### 1.3 Current State Failures

- **Failure 1: Overlapping panels.** The Smart Input text field overlaps the list of today's records on standard 1080p workstation monitors.
- **Failure 2: Lack of focus indicator.** The smart input console textfield lacks keyboard focus highlights and success transitions.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Operational Form + List | TYPE 3/4 — Hybrid layout combining smart chat input with data tables. |
| Workflow Category | Record | Log physical factory outputs. |
| Operational Behavior | Form-Driven | Configuration selectors and text inputs drive database updates. |
| Data Density | HIGH | Lists today's detailed logs and validation results. |
| Realtime Complexity | LOW | Page reload queries. |
| AI Complexity | HIGH | Uses natural language smart parsing (`/entries/smart`). |
| Audit Complexity | MEDIUM | Core database entry logs are written. |
| Decision Pressure | MEDIUM | Spotting and correcting manual entry errors. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `POST /entries/smart` | POST | Parse natural language text into structured entry cells | `structured_data`, `success` |
| `POST /entries` | POST | Log a new production entry | `entry_id`, `status` |
| `GET /entries/today` | GET | List today's logged entries | `entries` |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**SPLIT WORKSPACE (Console Left, Ledger Right)**
Left pane: Smart Input text console and raw edit blocks. Right pane: Table listing today's logged entries.

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Daily Production Entry (DPR)                               │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ SMART INPUT CONSOLE                  │ TODAY'S ENTRIES LEDGER                │
│ Describe Shift:                      │ ┌──────────┬─────────────┬──────────┐ │
│ [ Shift A consumed 12T billet...   ] │ │ Shift    │ Output (T)  │ Status   │ │
│                                      │ ├──────────┼─────────────┼──────────┤ │
│ [ Parse Text (prim) ]                │ │ Shift A  │ 11.4 Tons   │ [Pending]│ │
│                                      │ │ Shift B  │ 10.8 Tons   │ [Approved│ │
│ [ Register Form Manually (sec) ]     │ └──────────┴─────────────┴──────────┘ │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: Smart input text field.
- Level 2: Today's list status badges.
- Level 3: Parse button.

---

## 6. TABLE & DATA STRATEGY

- Row height: Compact (36px).
- Click on entry row navigates to `/entry/[id]`.

---

## 7. FORM & INPUT STRATEGY

Smart text input enforces minimum length validation and highlights parsed categories.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

Visualizes AI confidence highlights on parsed smart values before final submission.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing rhythm.
- Console textfield utilizes `var(--surface-shell)` background.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Stacks panels vertically on mobile.

---

## 11. COMPONENT MAPPING

- Layout: `WorkstationShell`
- Tables: `DataTable`
- Input: Textarea and Input primitives

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Splitting the smart console and today's list prevents overlap bugs on smaller floor terminals.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Define splitscreen layout.
2. Hook `POST /entries/smart` parser endpoint.
3. Build today's logged entries grid.

### 13.2 Critical Constraints

- Prompt operators to review parsed entries before submitting.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
- [x] Natural language validations specified.
