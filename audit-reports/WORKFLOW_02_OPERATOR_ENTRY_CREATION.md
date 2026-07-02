# Operational Workflow Regression & Friction Audit
## Workflow 2: Operator Production Entry Creation

**Audit Date:** 2026-06-17
**Role:** Operator
**Workflow Type:** Core production data capture
**Severity:** CRITICAL

---

## 1. Workflow Overview

| Property | Value |
|---|---|
| **Starting Page** | `/dashboard` or `/entry` |
| **End Page** | `/entry` with entry submitted (or queued for offline) |
| **Goal** | Record production data (units, manpower, downtime, quality, traceability) for a specific date/shift |
| **Actor** | Factory Operator |
| **Required Role** | `operator` (also `supervisor`, `manager`, `admin`, `owner` can create) |
| **Required Permissions** | Entry creation |
| **Required Data** | Active session, active factory, valid date, shift, target units |
| **Dependencies** | Active factory context, attendance status (**not enforced**), workflow template config, offline IndexedDB |
| **Success Condition** | Entry submitted successfully (status: `pending` or auto-approved), with client_request_id for idempotency |
| **Failure States** | Duplicate shift conflict, server error queued offline, validation errors, session expiry |
| **Abandonment States** | Start form but never submit (draft auto-saved), leave after step 1, close tab, navigate away |

---

## 2. Workflow Diagram

```
[Start]
    │
    ▼
┌──────────────────────────────────────────────┐
│  Pick Entry Route                            │
│  ┌─────────────────────┐  ┌───────────────┐  │
│  │ /dashboard → /entry │  │ /entry direct │  │
│  └─────────────────────┘  └───────────────┘  │
│  (with optional query params: date, shift,   │
│   focus=draft|offline|today)                 │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  Load Initial Data                           │
│  • getMe() — user info, role                  │
│  • getActiveWorkflowTemplate() — factory      │
│    workflow template                          │
│  • loadDraft() — restore from IndexedDB       │
│  • countQueuedEntries() — offline count       │
│  • listEntries({date}) — existing shift map   │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  Step 1: Basic Info                          │
│  ┌──────────────────────────────────────┐    │
│  │  Date picker (default: today)        │    │
│  │  Department select (auto-filled)     │    │
│  │  Shift tiles: Morning / Evening /    │    │
│  │    Night (auto-detected from hour)   │    │
│  │  Factory info (read-only)            │    │
│  │  Submitted shifts (shown if any)     │    │
│  │  Conflict warning (if shift exists)  │    │
│  └──────────────────────────────────────┘    │
├──────────────────────────────────────────────┤
│  Step 2: Production (required)               │
│  ┌──────────────────────────────────────┐    │
│  │  Units Target (number, min: 1)       │    │
│  │  Units Produced (number, min: 0)     │    │
│  │  Manpower Present (number, min: 0)   │    │
│  │  Manpower Absent (number, min: 0)    │    │
│  │  Live performance % card             │    │
│  └──────────────────────────────────────┘    │
├──────────────────────────────────────────────┤
│  Step 3: Issues (optional)                   │
│  ┌──────────────────────────────────────┐    │
│  │  Downtime minutes / reason           │    │
│  │  Quality issues ON/OFF toggle        │    │
│  │  Quality notes (if ON)               │    │
│  └──────────────────────────────────────┘    │
├──────────────────────────────────────────────┤
│  Step 4: Advanced (optional)                 │
│  ┌──────────────────────────────────────┐    │
│  │  Traceability: heat no., lot no.,    │    │
│  │    scrap kg, certificate ref.        │    │
│  │  Notes (textarea)                    │    │
│  │  Workflow template sections          │    │
│  │  (dynamic, per factory)             │    │
│  └──────────────────────────────────────┘    │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  Submit                                       │
│                                              │
│  ┌─────────────┐      ┌─────────────┐       │
│  │  Online     │      │  Offline    │       │
│  │  POST       │      │  IndexedDB  │       │
│  │  /entries   │      │  enqueue    │       │
│  └──────┬──────┘      └──────┬──────┘       │
│         │                    │              │
│         ▼                    ▼              │
│  ┌─────────────┐      ┌─────────────┐       │
│  │  Success    │      │  Auto-sync  │       │
│  │  Clear draft│      │  on online  │       │
│  │  Show ID    │      │  event      │       │
│  └─────────────┘      └─────────────┘       │
└──────────────────────────────────────────────┘
```

---

## 3. Click Audit

### Current Clicks (full path — morning shift, new entry, complete all steps, submit)

| # | Action | Page | Element | Type | Notes |
|---|---|---|---|---|---|
| 1 | Navigate to entry | `/dashboard` → `/entry` | Link/Button | navigation | Direct URL or dashboard card |
| 2 | Verify/modify date | Step 1 | Date input | form input | Auto-filled to today |
| 3 | Select department | Step 1 | Select dropdown | form input | Auto-filled from role |
| 4 | Select shift tile | Step 1 | Shift button | form selection | Auto-detected from time |
| 5 | Click "Next" | Step 1 | Button | navigation | Step validation runs |
| 6 | Enter units target | Step 2 | Number input | form input | |
| 7 | Enter units produced | Step 2 | Number input | form input | |
| 8 | Enter manpower present | Step 2 | Number input | form input | |
| 9 | Enter manpower absent | Step 2 | Number input | form input | |
| 10 | Click "Next" | Step 2 | Button | navigation | |
| 11 | Enter downtime minutes | Step 3 | Number input | form input | |
| 12 | Enter downtime reason | Step 3 | Text input | form input | |
| 13 | Toggle quality issues | Step 3 | ON/OFF buttons | form selection | |
| 14 | Enter quality notes | Step 3 | Textarea | form input | if quality = ON |
| 15 | Click "Next" | Step 3 | Button | navigation | |
| 16 | Enter heat number | Step 4 | Input | form input | |
| 17 | Enter lot number | Step 4 | Input | form input | |
| 18 | Enter scrap kg | Step 4 | Number input | form input | |
| 19 | Enter certificate ref. | Step 4 | Input | form input | |
| 20 | Enter notes | Step 4 | Textarea | form input | |
| 21 | Fill template fields | Step 4 | Various | form input | Dynamic per factory |
| 22 | Click "Submit Entry" | Step 4 | Button | form submit | Final action |
| **Total** | **22+ clicks/actions** | | | | |

### Click Count Breakdown

| Metric | Count |
|---|---|
| **Ideal clicks** (minimum path): | **6** (Date → Shift → Target → Produced → Submit) |
| **Current clicks** (with all steps): | **22+** |
| **Extra clicks**: | **16+** |
| **Page transitions**: | 4 (Step 1 → 2 → 3 → 4) |
| **Form submissions**: | 1 |
| **Search actions**: | 0 |
| **Confirmation actions**: | 1 |
| **Backtracking actions**: | Variable (user may go back to fix fields) |

### Click Waste Analysis

| Waste Category | Count | Reason |
|---|---|---|
| **Primary clicks** (essential) | 6 | Date, shift, target, produced, manpower, submit |
| **Step navigation clicks** (Next/Back) | 3 | Could be eliminated by single-page or collapsible sections |
| **Optional field clicks** | 8+ | Step 3 issues + Step 4 traceability could be collapsed |
| **Form overhead** | 5 | Department select (auto-filled), absent count (often 0), downtime reason (often none) |
| **Module overhead** | 4 | Entry tools dropdown, sidebar details |

---

## 4. Context Switching Audit

| Switch | From | To | Impact | Frequency |
|---|---|---|---|---|
| Dashboard context | Status reading | Data entry | LOW | Once per session |
| Step context | Step 1 (dates/shifts) | Step 2 (numbers) | LOW | 3 times per entry |
| Step context | Step 2 (production) | Step 3 (issues) | LOW | Once per entry |
| Step context | Step 3 (issues) | Step 4 (traceability) | LOW | Once per entry |
| Mental model | "What happened" | "What should I enter" | LOW-MEDIUM | Natural |
| Mental model | Time tracking | Output recording | **HIGH** | Only if user didn't punch in yet |
| Online/offline mode | Normal flow | Offline queue awareness | MEDIUM | Unpredictable |
| Tab interruption | Entry form | Browser tab switch | **HIGH** | Real-world distraction |
| Template context | Standard fields | Workflow template fields | MEDIUM | If factory has custom templates |
| Tool/Detail toggles | Primary form | Sidebar alerts/details | MEDIUM | User may open/close sidebar sections |

### Context Switch Score: **MEDIUM** (score: 5/10)

**Observation:** The 4-step wizard design actually reduces cognitive load per step — each step has a clear focus. The context switches between steps are well-designed. However, the **attendance-to-entry split** (Workflow 1 finding) creates the only major mental model jump within this workflow.

---

## 5. Operational Pressure Test

### Scenario: 100 workers waiting, shift already started, supervisor needs data

**Test conditions:**
- ✅ Operator has 3 minutes between tasks
- ✅ Phone/distractions present
- ✅ Slow 3G network
- ✅ Needs to submit before moving to next task
- ✅ May have multiple shifts to enter

| Task | Time Estimate | Under Pressure? | Error Risk |
|---|---|---|---|
| Navigate to entry | 3-5s | LOW | — |
| Fill Step 1 (date/shift/dept) | 5-10s | LOW | Wrong date, wrong shift |
| Fill Step 2 (production numbers) | 15-30s | **HIGH** | Wrong target, wrong units, transposed numbers |
| Fill Step 3 (downtime/quality) | 10-20s | MEDIUM | Skip quality flag, forget downtime |
| Fill Step 4 (traceability/notes) | 10-30s | MEDIUM | Skip essential traceability fields |
| **Total time (focused)** | **43-95s** | | |
| **Total time (under pressure)** | **2-5 min** | | |

### Pressure Test Verdict: **MEDIUM-HIGH RISK**

**Key findings:**
1. **Step 3 (issues) and Step 4 (advanced) are marked as "optional"** — under pressure, operators will skip these entirely. This means **downtime, quality issues, and traceability data will be frequently missing**, creating downstream data quality problems that supervisors must chase.
2. The **4-step wizard protects against overwhelm** but extends the perceived effort of the task. An operator who needs to submit 3 shifts in a row (morning/evening/night) must click through 12 steps and 3 submissions.
3. **Validation blocking is correct but frustrating** under pressure — e.g., "Add at least one worker count" when the operator knows the count is 1 but can't find the right field.
4. **Duplicate shift detection** (`conflictId`) is a strong protection that prevents double-entry under pressure.

---

## 6. Reliability Audit

| Check | Status | Risk Level |
|---|---|---|
| **Duplicate shift protection** | ✅ Client-side (shiftMap) + Backend (409 conflict) | **LOW** |
| **Client_request_id idempotency** | ✅ Cryptographically random UUID | **LOW** |
| **Draft auto-save** | ✅ 400ms debounce to IndexedDB | **LOW** |
| **Auto-save on every keystroke** | ✅ useEffect with debounce timer | **LOW** |
| **Draft restoration on page load** | ✅ loadDraft() called on mount | **LOW** |
| **Draft cleared after submit** | ✅ clearDraft() called on success | **LOW** |
| **Offline queue** | ✅ enqueueEntry with dedup key | **LOW** |
| **Auto-sync on network return** | ✅ on 'online' event handler | **MEDIUM** |
| **Session expiry mid-form** | ❌ No proactive check — only caught at submit | **HIGH** |
| **Template fields lost on template change** | ❌ If admin changes workflow template while form is open, fields may shift | **MEDIUM** |
| **Back button after submit** | ✅ Draft cleared, form reset to blank | **LOW** |
| **Refresh mid-form** | ✅ Draft restored within 400ms of data entry | **LOW** |
| **Tab-close mid-form** | ✅ Draft persisted to IndexedDB | **LOW** |
| **Mobile bottom nav on submit** | ✅ Fixed bottom bar on mobile with Back + Submit | **LOW** |
| **Concurrent queue flushes** | ✅ `activeFlushes` Map-based locking per userId | **LOW** |

### Reliability Score: **8/10**

**Top reliability concern:** Session expiry mid-form is the only significant gap. The entry API call on submit will fail with 401, and the entry will be queued offline without the operator necessarily knowing why.

**Offline queue is excellent:** The system handles:
- Server 500 errors → queue offline
- Network errors → queue offline  
- Auto-retry on reconnect
- Dedup by date+shift
- Client_request_id for idempotency
- Background sync without blocking user

---

## 7. Consistency Audit

| Check | Finding | Severity |
|---|---|---|
| **Form vs other forms in app** | Entry uses 4-step wizard; most other forms (settings, profile) use single-page | MEDIUM |
| **Submit button label** | "Submit Entry" on last step — consistent with "Save entry" on edit | LOW |
| **Validation messages** | "Select the entry date first" — clear, specific | LOW |
| **Error display** | Red banners — consistent across app | LOW |
| **Success display** | Green banners — consistent | LOW |
| **Empty states** | N/A (form always has defaults) | LOW |
| **Loading states** | `EntryPageSkeleton` — consistent | LOW |
| **Stepper UI** | 4 clickable step indicators at top — shows current/active/unlocked/optional | **GOOD** |
| **"Optional" label** | Used on Step 3 and Step 4 — clear | LOW |
| **Shift selection** | Tiles with icons — different from dropdown elsewhere | MEDIUM |
| **Performance indicator** | Progress bar + percentage + label — good | LOW |

### Consistency Score: **8/10**

**Minor inconsistency:** The 4-step wizard pattern is unique to the entry form. Other forms in the app use single-page layouts. This isn't necessarily bad — the wizard is well-suited for guided data entry — but it's a notable pattern difference.

---

## 8. Human Error Audit

| Error Scenario | Likelihood | Detection | Recovery | Severity |
|---|---|---|---|---|
| **Wrong units_target** | MEDIUM | Live % updates instantly | Edit before submit; can edit within 24h after | MEDIUM |
| **Wrong shift selected** | MEDIUM | Visual tile highlight | Clear: user can tap different shift | MEDIUM |
| **Forgot quality issue flag** | **HIGH** | No detection (optional step) | Only discovered in review | **HIGH** |
| **Forgot downtime** | MEDIUM | No detection (optional step) | Only appears in reports | MEDIUM |
| **Swapped target/produced** | MEDIUM | Performance % would be 0% or 100%+ | Can fix before submit | MEDIUM |
| **Wrong department** | LOW | Auto-filled; user may not notice | Can edit | LOW |
| **Offline queue confusion** | LOW | Queue count shown | Auto-sync handles | LOW |
| **Multiple rapid clicks on submit** | LOW | busy flag disables button | Idempotent via client_request_id | LOW |
| **Entered today's data on wrong date** | MEDIUM | Date auto-filled to today | User must manually change | MEDIUM |
| **Skipped traceability under pressure** | **HIGH** | Optional step — no enforcement | Data loss for downstream | **HIGH** |
| **Started draft then forgot** | MEDIUM | Draft saved; shown on next visit | Resume from draft | LOW |
| **Accidental back navigation** | LOW | Step back allowed | State preserved via draft | LOW |

### Human Error Score: **5/10**

**Most dangerous errors:**

1. **Quality issue not flagged (optional step)** — Under pressure, the "issues" step is explicitly labeled as optional. An operator with quality problems may skip it entirely. The system has no signal to prompt: "You recorded 45 min of downtime — was there a quality issue?"

2. **Traceability fields skipped (optional step)** — Heat numbers, lot numbers, scrap kg, and certificate references are all in the "optional advanced" step. In steel/regulated manufacturing, these are essential. Making them optional at the form level creates a data gap.

3. **Absent manpower not recorded** — Defaults to 0. Under pressure, operators won't update this. Attendance records may show the person as present, but the entry says absent=0. Creates reconciliation work.

---

## 9. Multi-Role Workflow Audit

### Role Handoffs

| Handoff | From | To | What flows | Friction |
|---|---|---|---|---|
| Entry creation | Operator | — | Raw production data | N/A |
| Entry → Approval | Operator | Supervisor | Entry submitted for review | MEDIUM — requires separate page |
| Entry → Reports | Operator | Accountant/Manager | Aggregated production numbers | LOW — automatic |
| Entry → Anomaly Detection | Operator | Owner/Manager | AI anomaly signals | LOW — automatic |
| Entry → Export | Operator | Accountant | PDF/Excel download | MEDIUM — requires entry detail page |
| Entry → Edit | Operator (self) | Operator | Correction within 24h | LOW |
| Entry → Edit | Supervisor+ | Any | Override within 24h | LOW |

### Permission Matrix

| Action | Operator | Supervisor | Manager | Admin | Owner |
|---|---|---|---|---|---|
| Create entry | ✅ | ✅ | ✅ | ✅ | ✅ |
| View own entry | ✅ (today only) | ✅ | ✅ | ✅ | ✅ |
| View any entry | ❌ | ✅ | ✅ | ✅ | ✅ |
| Edit own entry | ✅ (24h window, today only for operator) | ✅ (24h) | ✅ (24h) | ✅ (24h) | ✅ (24h) |
| Edit any entry | ❌ | ✅ (24h) | ✅ (24h) | ✅ (24h) | ✅ (24h) |
| Delete entry | ❌ | ❌ | ✅ | ✅ | ✅ |
| Approve entry | ❌ | ✅ | ✅ | ✅ | ✅ |
| Reject entry | ❌ | ✅ | ✅ | ✅ | ✅ |

---

## 10. Regression Risk Analysis

| Dependency | Risk Level | Why |
|---|---|---|
| **Active workflow template** (`getActiveWorkflowTemplate`) | **HIGH** | If template API changes or fails, traceability sections disappear from form |
| **IndexedDB draft/queue** | **HIGH** | Cross-browser differences, storage quota issues, clearing browser data |
| **Attendance status** (not enforced but shown) | MEDIUM | If attendance module changes, entry form has no fallback |
| **Shift map loading** (`listEntries({date})`) | MEDIUM | API pagination changes could break conflict detection |
| **Client_request_id generation** | MEDIUM | If `crypto.randomUUID()` is unavailable, fallback may cause collisions |
| **Response envelope middleware** | MEDIUM | If envelope format changes, `apiFetch` parsing may break |
| **Role-based home destination** | MEDIUM | Changes to `getHomeDestination` could send operators to wrong landing |
| **Entry status flow** (pending → approved) | **HIGH** | If status transitions change, UI display (status badge) goes stale |
| **Wizard step structure** | MEDIUM | Hard-coded step definitions — changing steps requires frontend deployment |

---

## 11. Operational Efficiency Score

| Metric | Score | Rationale |
|---|---|---|
| **Click Efficiency** | **6/10** | 22 clicks vs ideal 6 — heavy but acceptable for guided data entry |
| **Navigation Efficiency** | **7/10** | 4-step wizard is clear but adds page-turn overhead |
| **Reliability** | **8/10** | Excellent offline/draft/duplicate protection — session expiry is only gap |
| **Consistency** | **8/10** | Good visual consistency; wizard pattern differs from rest of app but works well |
| **Error Resistance** | **5/10** | Quality flag and traceability being optional under pressure creates data loss |
| **High Pressure Usability** | **5/10** | Wizard protects from overwhelm but encourages skipping critical optional fields |
| **Learnability** | **8/10** | Step indicators, guidance hints, auto-fill defaults — excellent onboarding |
| **Speed** | **6/10** | 43-95s focused, 2-5 min under pressure — reasonable for comprehensive data capture |

### Total Score: **56/100** ⚠️ (Needs improvement)

---

## 12. Recommended Improvements

### Critical

| # | Improvement | Type | Impact |
|---|---|---|---|
| C1 | **Make Step 3 (issues) non-optional when downtime > 0 or quality_issues = true** | Quick Win | If downtime > 0, require quality issue toggle. If no downtime, collapse issues section. Prevents data loss. |
| C2 | **Add conditional quality flag reminder** | Quick Win | If downtime_minutes > 30 and quality_issues = false AND no quality_details, show inline warning: "30+ minutes of downtime recorded — was there a quality issue?" |
| C3 | **Add attendance-punch guard** | Quick Win | If operator hasn't punched in, show warning banner at top: "You haven't punched in yet for this shift." Issue was detailed in Workflow 1 — same fix needed here. |

### High

| # | Improvement | Type | Impact |
|---|---|---|---|
| H1 | **Merge Step 3 (issues) into Step 2 as collapsible section** | Structural | Reduces wizard from 4 steps to 3. Issues section becomes expandable on the production step. Saves 3 clicks (Next, Next, Back) and one page turn. |
| H2 | **Merge Step 4 (advanced/traceability) into Step 2 as collapsible section** | Structural | Same as H1. Advanced fields become expandable on production step. Reduces steps to 2. Total click savings: ~6 clicks. |
| H3 | **Add session-health check before submit** | Quick Win | On Step 4 mount, do lightweight `GET /auth/me`. If session stale, show "Session expired — please re-login" overlay that preserves draft. |
| H4 | **Add bulk-submit for multiple shifts** | Medium | Allow operator to submit morning, evening, and night entries in one session without navigating away. |

### Medium

| # | Improvement | Type | Impact |
|---|---|---|---|
| M1 | **Pre-populate units_target from shift template/expectations** | Medium | If the factory has a standard expected output per shift, auto-fill it. |
| M2 | **Pre-populate manpower_present from employee count** | Medium | If attendance shows N people punched in, use as baseline for present count. |
| M3 | **Add "Submit & Continue" button for multi-shift entry** | Medium | After submit, show "Submitted successfully. Submit next shift?" to chain entries. |
| M4 | **Make traceability fields configurable by factory profile** | Medium | Steel factories need heat/lot numbers required; general manufacturing may not. Make it a template setting. |
| M5 | **Add quick-copy from last shift** | Medium | "Copy units_target and manpower from last shift" button to speed up consecutive entries. |

### Low

| # | Improvement | Type | Impact |
|---|---|---|---|
| L1 | **Auto-suggest department from user role** | Quick Win | Already implemented — verified working |
| L2 | **Add "Last 3 entries" quick reference in sidebar** | Quick Win | Show operator their previous entries for reference numbers |
| L3 | **Keyboard shortcut for Next/Submit** | Quick Win | Ctrl+Enter to submit, Enter to go to next step |

---

## 13. Proposed Before vs After Workflow

### Before (Current — 4 steps)

```
/entry → Step 1 (Date/Shift/Dept) → Next → Step 2 (Target/Produced/Manpower) → Next
         → Step 3 (Downtime/Quality) → Next → Step 4 (Traceability/Notes) → Submit
```

**Total clicks: 22+**
**Page turns: 4**

### After (Recommended — 2 steps + collapsible sections)

```
/entry → Step 1 (Date/Shift/Dept) → Next → Step 2 (Production + folded issues + folded advanced)
                                              ├── Target / Produced / Manpower (always visible)
                                              ├── ⏷ Issues (downtime, quality) — expandable
                                              └── ⏷ Advanced (traceability, notes) — expandable
                                           → Submit
```

**Total clicks: ~12-14**
**Page turns: 2**
**Click savings: ~40%**

---

## 14. Summary of Findings

| Priority | Count | Key Areas |
|---|---|---|
| CRITICAL | 3 | Quality flag enforcement, downtime→quality reminder, attendance guard |
| HIGH | 4 | Merge steps 3+4 into Step 2, session health check, bulk submit, multi-shift chain |
| MEDIUM | 5 | Pre-fill target/manpower, factory-configurable traceability, quick-copy, submit chain |
| LOW | 3 | Auto-suggest dept, recent entries reference, keyboard shortcuts |

### Key Theme

The 4-step wizard is **well-designed for data quality** but **creates overwhelm under pressure** by making issues and traceability separate "optional" steps that operators will skip. The biggest opportunity is merging Steps 3 and 4 into collapsible sections within Step 2 (production), which cuts the perceived effort in half while keeping the same fields available when needed.

The **offline/draft/duplicate protection system is excellent** and should be used as a reference pattern for other workflows.

### Efficiency Rating: **56/100 — NEEDS IMPROVEMENT**
