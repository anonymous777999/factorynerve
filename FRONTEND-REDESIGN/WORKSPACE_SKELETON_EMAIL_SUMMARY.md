# Email Summary — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification | Phase E, Item 3
# Route: /email-summary
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/email-summary` |
| Workspace Name | Email Summaries & Alerts |
| Operational Role | Configuration panel for defining automated email summaries (weekly reports, executive summaries) and alerts. Handles email delivery and tests (GET /summary, POST /summary/generate, POST /summary/send). |
| Business Impact | Ensures owners and managers receive automated operation summaries directly in their inbox. |
| User Population | Owner, Factory Manager, Accountant. |
| Peak Usage Context | Setting up daily notification cycles or testing alert configurations. |
| Predecessor Workspaces | `/reports` |
| Successor Workspaces | `/settings` |

### 1.2 Operational Importance

Maintains automated communication channels. Exposes active recipients, delivery triggers (daily, weekly), and message layouts.

### 1.3 Current State Failures

- **Failure 1: Raw email textareas.** Test message text inputs are raw HTML elements lacking proper system focus styles.
- **Failure 2: Lack of preview layouts.** Operators cannot preview generated email layouts before sending them.

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Form-Driven | TYPE 1 — configuration forms and summary generation controls. |
| Workflow Category | Record | Set communication and notification patterns. |
| Operational Behavior | Form-Driven | Form inputs drive alert setups. |
| Data Density | MEDIUM | Input textfields, recipient list, and email previewer. |
| Realtime Complexity | LOW | Page load query. |
| AI Complexity | NONE | Database record mapping. |
| Audit Complexity | MEDIUM | Core logs on test sends. |
| Decision Pressure | LOW | Alert setups. |

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Key Response Fields |
|---|---|---|---|
| `GET /emails/summary` | GET | Load active summary setups | `email_summary_config` |
| `POST /emails/summary/generate` | POST | Preview generated email summary contents | `subject`, `html_body` |
| `POST /emails/summary/send` | POST | Trigger test send to recipients list | `status` |

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

**SPLIT VIEW (Config Left, Preview Right)**
Left pane holds the configuration form (recipients, scheduling, scope). Right pane renders the live HTML preview of the generated email message.

---

## 4A. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

### A. Desktop Structural Blueprint (1440px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ APPSHELL TOPBAR                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ WORKSPACE HEADER: Email Summaries & Alerts                                   │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ CONFIGURATION FORM                   │ LIVE HTML PREVIEW                     │
│ Target Shift: [ All Shifts ▾ ]       │ Subject: Weekly Summary - F1          │
│ Frequency:    [ Weekly - Mon 8am ▾ ] │ ┌───────────────────────────────────┐ │
│ Recipients:   [ owner@factory.com ]  │ │ FACTORYNERVE OS REPORT            │ │
│                                      │ │ Yield:  98.4 Tons (ok)            │ │
│ [ Generate Preview ] [ Send Test ]   │ │ Losses: 2.1 Tons (normal)         │ │
│                                      │ └───────────────────────────────────┘ │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

- Level 1: Preview action trigger.
- Level 2: "Send Test" button.
- Level 3: Recipient email address inputs.

---

## 6. TABLE & DATA STRATEGY

N/A.

---

## 7. FORM & INPUT STRATEGY

Form inputs collect:
- Recipients (validated list of email formats).
- Frequency selectors (daily, weekly, custom).
- Scope filters (production metrics, steel summaries, attendance exceptions).

---

## 8. AI & AUDIT VISIBILITY STRATEGY

None.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

- 4px spacing rhythm.
- Preview area utilizes a shadow card structure: `var(--surface-elevated)`.

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

- Stacks configuration and preview views vertically on mobile.

---

## 11. COMPONENT MAPPING

- Inputs: `Input` and `Select` primitives
- Layout: `WorkstationShell`
- Preview: Reusable `IFrame` or `HtmlViewer` card

---

## 12. OPERATIONAL PROBLEMS SOLVED

- Replaces raw HTML elements with standard system input primitives for all email setup forms.
- Adds comparative live HTML message previews.

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

1. Scaffold configuration panels.
2. Hook email status queries.
3. Wire the HTML previewer component.

### 13.2 Critical Constraints

- Validate email syntax checks.

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections populated.
