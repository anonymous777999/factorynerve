# Reports — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase E, Item 1
# Route: /reports
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/reports` |
| Workspace Name | Reports Hub |
| Operational Role | Centralized dashboard for creating and exporting operational reports. Enables supervisors and managers to generate weekly, monthly, or custom range PDF and Excel reports. |
| Business Impact | Forms the core record output layer for audits, client billing verification, and shift performance records. |
| User Population | Factory Manager, Shift Supervisor, Accountant, Owner. |
| Peak Usage Context | End of week/month closures. |
| Predecessor Workspaces | `/dashboard` |
| Successor Workspaces | `/analytics` |

### 1.2 Operational Importance

Provides clean, structured reports for external consumption. Summarizes shift entries, production metrics, and attendance into formal PDF and Excel files.

### 1.3 Current State Failures

- **Failure 1: Brittle UI exports.** Export status updates do not poll, causing operators to wait indefinitely without completion feedback.
- **Failure 2: Lack of range checks.** Permits generating exports for huge date ranges (> 1 year), causing backend timeout errors.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Entity List | TYPE 4 — list of generated reports and configuration forms. |
| Workflow Category | Record | Archive and generate reports. |
| Operational Behavior | Form-Driven | Configuration selectors drive report parameters. |
| Data Density | MEDIUM | Selectors, progress cards, and table of recent reports. |
| Realtime Complexity | MEDIUM | Polling job progress status. |
| AI Complexity | NONE | Structured query mapping. |
| Audit Complexity | MEDIUM | Logs all generated exports. |
| Decision Pressure | LOW | Information retrieval and export. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /reports/weekly` | GET | Retrieve weekly summary data | Report data JSON |
| `GET /reports/monthly` | GET | Retrieve monthly summary data | Report data JSON |
| `POST /reports/excel-range/jobs` | POST | Trigger background Excel export job | `job_id`, `status` |
| `GET /reports/export-jobs/{job_id}` | GET | Check status of background export job | `status`, `progress` |
| `GET /reports/export-jobs/{job_id}/download` | GET | Download finalized report file | Binary file stream |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**WORKSTATION SHELL + DETAIL PANEL**
Left Pane holds report configurations (Type, Date range, formats). Right Pane displays generated reports history list and active progress bars.

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Reports Hub                                                │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ REPORT CONFIGURATION                 │ GENERATED REPORTS ARCHIVE             │
│ Report Type: [ Weekly Summary ▾ ]    │ ┌──────────────┬─────────────┬──────┐ │
│ Start Date:  [ 01 May 2026 ]         │ │ Report Name  │ Date        │ Act  │ │
│ End Date:    [ 07 May 2026 ]         │ ├──────────────┼─────────────┼──────┤ │
│ Format:      [ Excel ▾ ]             │ │ Weekly_May01 │ 08 May 2026 │ [DL] │ │
│                                      │ │ Weekly_May08 │ 15 May 2026 │ [DL] │ │
│ [ Generate Report (primary) ]        │ └──────────────┴─────────────┴──────┘ │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: Export job progress bars (shown during active creation runs).
- Level 2: "Download" links.
- Level 3: Date range inputs.

---

## 6. TABLE & DATA STRATEGY

Renders table of generated reports. Compact rows.

---

## 7. FORM & INPUT STRATEGY

Date validation checks limit selections to a maximum range of 90 days.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

None.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing rhythm.
- Divider borders: `var(--border-default)`.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Stack layout vertically on mobile.

---

## 11. COMPONENT MAPPING

- Layout: `WorkstationShell`
- Form: `SectionPanel`

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Integrates 3-second polling checks for background jobs (`/export-jobs/{job_id}`) to show actual progress.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Define splitscreen layout framework.
2. Hook date filters and submit requests.
3. Build polling checks for background generation jobs.

### 13.2 Critical Constraints

- Range cannot exceed 90 days.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
