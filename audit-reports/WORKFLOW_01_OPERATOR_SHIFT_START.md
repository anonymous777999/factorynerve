# Operational Workflow Regression & Friction Audit
## Workflow 1: Operator Shift Start + Attendance Punch

**Audit Date:** 2026-06-17
**Role:** Operator
**Workflow Type:** Real-time floor operation
**Severity:** CRITICAL

---

## 1. Workflow Overview

| Property | Value |
|---|---|
| **Starting Page** | `/login` (or `/access` for cookie-auth redirect) |
| **End Page** | `/entry` with shift data submitted |
| **Goal** | Start shift, record attendance punch-in, create production entry for the shift |
| **Actor** | Factory Operator |
| **Required Role** | `operator` |
| **Required Permissions** | Attendance punch, entry creation |
| **Required Data** | Active session, active factory, valid date/shift, attendance status |
| **Dependencies** | Active factory context, attendance state machine, shift template config, offline queue |
| **Success Condition** | Operator punched in AND has a submitted production entry for their shift |
| **Failure States** | Wrong shift selected, duplicate shift conflict, offline queue stall, missed punch needing supervisor review |
| **Abandonment States** | User drops off at dashboard, user opens attendance but doesn't punch, user starts draft but doesn't submit |

---

## 2. Workflow Diagram

```
[Login/Access]
    ↓
[Home Route (/)] ─── role-based redirect ───→ [/dashboard (operator)]
    ↓
[Dashboard]
    ├── Status card: "Ready for shift", "Shift in progress", etc.
    ├── Primary action: "Start Shift" (if can_punch_in) or "Continue Shift" (if draft exists)
    ├── Quick actions: Attendance, Scan Paper, My Tasks
    └── Shift status: Completed/Pending per shift (morning/evening/night)
    ↓
[Attendance Page (/attendance)]
    ├── Status badge: "Not Started" / "Shift in Progress" / "Late Arrival" / etc.
    ├── Shift label: Morning/Evening/Night
    ├── Worked time display (live timer if working)
    ├── MAIN ACTION: "Punch In" (big button) or "Punch Out" (if already punched in)
    ├── Punch tools (expandable): Shift override (elevated roles only), Refresh, View History
    └── Sidebar: Today Summary (worked time, last punch, shift, status)
    ↓
[Dashboard again or Entry Page]
    ├── [Dashboard] → Shows updated attendance status, "Continue Shift" or "Complete Entry"
    └── [Entry Page (/entry)] → Guided 4-step form:
        Step 1: Date, Shift selection, Department
        Step 2: Units target/produced, Manpower present/absent, Live performance %
        Step 3: Downtime minutes/reason, Quality issues ON/OFF
        Step 4: Traceability fields, Notes, Workflow template fields, Submit
    ↓
[Submit Entry]
    ├── Online: POST /entries → Success → Clear draft → Signal refresh
    └── Offline: Save to IndexedDB queue → Auto-sync when online
    ↓
[Complete]
```

---

## 3. Click Audit

### Current Clicks (full path — morning shift, first-time today)

| # | Action | Page | Element | Type | Notes |
|---|---|---|---|---|---|
| 1 | Open browser / navigate | Login | URL bar | navigation | |
| 2 | Enter email | Login | Input | form input | |
| 3 | Enter password | Login | Input | form input | |
| 4 | Click "Sign In" | Login | Button | form submit | |
| 5 | Wait for redirect | → | auto | navigation | Role-based redirect to dashboard |
| 6 | Read dashboard status | Dashboard | Card | read | Understand shift state |
| 7 | Click "Start Shift" | Dashboard | Primary action button | navigation | Takes user to `/attendance` |
| 8 | Verify shift is correct | Attendance | Shift label, select | read | |
| 9 | Click "Punch In" | Attendance | Main action button | form submit | |
| 10 | Read confirmation status | Attendance | Status banner | read | "Punch in recorded." |
| 11 | Navigate back to entry | → | nav | navigation | User must go to `/entry` |
| 12 | Select date | Entry Step 1 | Date picker | form input | Auto-filled but may need adjustment |
| 13 | Select department | Entry Step 1 | Select | form input | |
| 14 | Select shift | Entry Step 1 | Shift tiles | form selection | |
| 15 | Click "Next" | Entry | Button | navigation | Step 1 → Step 2 |
| 16 | Enter units target | Entry Step 2 | Number input | form input | |
| 17 | Enter units produced | Entry Step 2 | Number input | form input | |
| 18 | Enter manpower present | Entry Step 2 | Number input | form input | |
| 19 | Enter manpower absent | Entry Step 2 | Number input | form input | |
| 20 | Click "Next" | Entry | Button | navigation | Step 2 → Step 3 |
| 21 | Enter downtime minutes | Entry Step 3 | Number input | form input | |
| 22 | Enter downtime reason | Entry Step 3 | Text input | form input | |
| 23 | Toggle quality issues | Entry Step 3 | ON/OFF buttons | form selection | |
| 24 | Enter quality notes | Entry Step 3 | Textarea | form input | if quality = ON |
| 25 | Click "Next" | Entry | Button | navigation | Step 3 → Step 4 |
| 26 | Enter traceability fields | Entry Step 4 | Various inputs | form input | Heat no., lot no., scrap, cert |
| 27 | Enter notes | Entry Step 4 | Textarea | form input | |
| 28 | Click "Submit Entry" | Entry | Button | form submit | |
| **Total clicks/actions** | **28** | | | | |

### Click Count Breakdown

| Metric | Count |
|---|---|
| **Ideal clicks** (minimum path): | **5** (Sign in → Punch In → Date → Production → Submit) |
| **Current clicks** (full path with all steps): | **28** |
| **Extra clicks**: | **23** |
| **Page transitions**: | 5 (Login → Dashboard → Attendance → Dashboard → Entry → Submit) |
| **Modal openings**: | 0 (but expandable sections used) |
| **Form submissions**: | 2 (punch + entry submit) |
| **Search actions**: | 0 |
| **Confirmation actions**: | 2 (punch confirm + submit confirm) |
| **Backtracking actions**: | 2 (post-punch return to dashboard, then to entry page) |

### Click Waste Analysis

| Waste Category | Count | Reason |
|---|---|---|
| **Primary clicks** (essential) | 5 | Email, password, sign-in, punch-in, submit |
| **Corrective clicks** | 0 | — |
| **Exploratory clicks** | 3 | Reading dashboard status, verifying shift, checking alerts |
| **Backtracking clicks** | 2 | Attendance → Dashboard (implicit), Dashboard → Entry |
| **Navigation overhead** | 5 | Page transitions that could be merged |
| **Form overhead** | 13 | Fields and steps beyond minimum viable |

---

## 4. Context Switching Audit

| Switch | From | To | Impact | Frequency |
|---|---|---|---|---|
| Role context | Login screen | Operations board | LOW | Once per session |
| Task context | Dashboard status view | Attendance punch | MEDIUM | Once per shift |
| Mental model | "I am punching in" | "I am recording production" | **HIGH** | Every shift |
| Page context | Attendance | Dashboard (navigation) | MEDIUM | After punch |
| Page context | Dashboard | Entry creation | MEDIUM | After navigating |
| Mode context | Online | Offline (network loss) | MEDIUM | Unpredictable |
| Tab context | Browser tab | Other tabs/phone calls | HIGH | Real-world interruptions |
| Action type | Read status | Form fill | LOW | — |
| Step context | Step 1 (date/shift) | Step 2 (production) | LOW | 3 times per entry |
| Decision context | Quality issue toggle | Notes | LOW | Conditional |

### Context Switch Score: **HIGH** (score: 7/10)

**Primary concern:** The split between attendance (`/attendance`) and entry (`/entry`) forces a cognitive mode switch. The operator must:
1. Think about "punching in" as a time-tracking action
2. Then mentally shift to "recording production" as a quality/output action

These are connected in the real world (you start work → you record what you did), but **the UI treats them as two separate workflows on two separate pages**.

---

## 5. Operational Pressure Test

### Scenario: 100 workers waiting, shift starting in 2 minutes, supervisor calling

**Simulated conditions:**
- ✅ 100+ workers need to punch in simultaneously
- ✅ Supervisor is on the phone asking for status
- ✅ Slow 3G network
- ✅ Operator is distracted
- ✅ Operator must switch tasks mid-flow

**Test Results:**

| Task | Time Estimate | Under Pressure? | Error Risk |
|---|---|---|---|
| Login + navigate to dashboard | 30-45s | LOW | Forgot password / slow load |
| Read dashboard status | 5-10s | LOW | May skip reading and click wrong action |
| Navigate to attendance | 3-5s | LOW | — |
| Select correct shift | 3-5s | **MEDIUM** | **May select wrong shift under time pressure** |
| Click Punch In | 2s | LOW | Double-tap risk |
| Navigate to entry page | 5-10s | **HIGH** | **May forget to write entry after punching in** |
| Complete 4-step entry form | 2-5 min | **HIGH** | **Will skip fields or make entry errors** |
| Submit entry | 2-3s | LOW | — |
| **Total time (best case)** | **~3-5 minutes** | | |
| **Total time (under pressure, distracted)** | **~8-15 minutes** | | |

### Pressure Test Verdict: **HIGH RISK**

**Critical findings:**
1. The attendance-to-entry split is the biggest pressure failure point. Under real pressure, an operator may punch in and **forget to create the production entry entirely**, resulting in missing data that needs supervisor follow-up.
2. The 4-step entry form is well-designed for **quality data capture**, but under pressure an operator may rush through steps 2-4 and enter bad data (wrong target, wrong units, skipped quality flags).
3. Offline queue is a strong safety net, but the operator may not realize their entry was queued rather than submitted, leading to duplicate work later.

---

## 6. Reliability Audit

| Check | Status | Risk Level |
|---|---|---|
| **Punch double-submit protection** | ✅ Button disabled while `busy=true` | LOW |
| **Entry duplicate shift detection** | ✅ Client-side check via `shiftMap` + backend 409 conflict | LOW |
| **Draft auto-save** | ✅ 400ms debounce on every form change | LOW |
| **Offline queue automatic sync** | ✅ On `online` event, auto-flushes queue | MEDIUM |
| **Session expiry mid-flow** | ❌ No interrupt if session expires during form fill | **HIGH** |
| **Refresh during form fill** | ✅ Draft saved to IndexedDB | MEDIUM |
| **Back button after submit** | ✅ `clearDraft` resets form | LOW |
| **Stale attendance status** | ⚠️ 25-second auto-refresh | MEDIUM |
| **Live timer accuracy** | ✅ Client-side tick every 1s with `deriveWorkedMinutes` | LOW |
| **Confirmation visibility** | ⚠️ Status banner disappears after user action | MEDIUM |

### Reliability Score: **7/10**

**Top reliability concerns:**
1. **Session expiry mid-flow** — If the session expires while filling the entry form, the next action (submit) will fail, and the operator may lose context. Auto-save protects the draft, but the user won't know they need to re-login until they try to submit.
2. **Stale dashboard state** — The dashboard loads 10 API calls in parallel via `Promise.allSettled`. If the user returns to dashboard quickly, some data may still be loading, causing an incomplete picture.

---

## 7. Consistency Audit

| Check | Finding | Severity |
|---|---|---|
| **Button labels** | Punch button says "Punch In" / "Punch Out" — entry button says "Submit Entry" — consistent within domain | LOW |
| **Status terminology** | `not_punched` (API) → "Not Started" (UI) — `missed_punch` → "Missed Punch" — `working` → "Shift in Progress" — some drift between API enum and display label | MEDIUM |
| **Shift labels** | Morning / Evening / Night — consistent everywhere | LOW |
| **Primary action placement** | Dashboard has a CTA button; attendance has a CTA button; entry has Next/Submit — consistent pattern | LOW |
| **Form styling** | Entry uses 4-step wizard; other forms (settings, profile) use single-page layout — **inconsistency** | MEDIUM |
| **Error presentation** | Red banners with rounded corners — consistent | LOW |
| **Success presentation** | Green banners with emerald color — consistent | LOW |
| **Empty states** | Dashboard shows skeleton; attendance shows skeleton; entry shows skeleton — consistent | LOW |
| **Loading states** | All use `Loading` or `Skeleton` components — consistent | LOW |
| **Punch vs Entry split** | Attendance and production entry are separate mental models but connected in real operations | **HIGH** |

### Consistency Score: **7/10**

**Primary inconsistency:** The 4-step entry wizard vs. single-page forms elsewhere in the app. While the wizard is well-designed for guided data entry, it creates a different interaction pattern than other forms.

---

## 8. Human Error Audit

| Error Scenario | Likelihood | Detection | Recovery | Severity |
|---|---|---|---|---|
| **Wrong shift selected for punch** | MEDIUM | Shift label shown before punch | Clear: user can see and correct before clicking | MEDIUM |
| **Wrong shift selected for entry** | MEDIUM | Shift tiles show active state | Clear: user can tap different shift | MEDIUM |
| **Forgot to punch in before starting entry** | **HIGH** | No detection in entry page | User enters production data but no attendance record | **HIGH** |
| **Double-click punch-in** | LOW | Button disabled while busy | Server handles idempotency | LOW |
| **Wrong units_target value** | MEDIUM | Live performance % updates instantly | User can edit before submit | MEDIUM |
| **Quality issue not flagged when it should be** | **HIGH** | No reminder/check | Only discovered in review | **HIGH** |
| **Submitted wrong shift's data** | MEDIUM | Shift label shown in summary | Depends on review/editing | MEDIUM |
| **Hit back during 4-step form** | LOW | Back button is explicit | State preserved via auto-save draft | LOW |
| **Refresh mid-form under pressure** | LOW | Draft auto-save at 400ms | State restored | LOW |
| **Wrong department selected** | LOW | Pre-populated from role | Can change before submit | LOW |
| **Entered attendance after shift ended** | LOW | `can_punch_in` flag prevents | Shown "Needs Review" state | MEDIUM |
| **Offline submission then online duplicate** | LOW | Client-side request_id dedup | Handled automatically | LOW |

### Human Error Score: **5/10**

**Most dangerous error:** **Forgot to punch in before creating entry.** The entry page has no attendance guard. An operator can spend 5 minutes filling production data without their attendance being recorded. This creates a downstream mismatch that a supervisor must manually reconcile.

**Second most dangerous error:** **Quality issue not flagged.** Under pressure, an operator may skip the quality issues toggle (Step 3, optional). If quality issues existed, this creates a hidden data quality problem.

---

## 9. Multi-Role Workflow Audit

### Role Handoffs

| Handoff | From | To | What flows | Friction |
|---|---|---|---|---|
| Attendance → Review | Operator | Supervisor | Missed punches, late arrivals | MEDIUM — supervisor must open separate page |
| Entry → Approval | Operator | Supervisor | Production entry review/approve | MEDIUM — queue-based, works |
| Entry → Reports | Operator | Accountant/Manager | Production numbers for reporting | LOW — automatic |
| Entry → Anomaly Detection | Operator | Owner/Manager | AI anomaly signals | LOW — automatic |
| Punch → Attendance Reports | Operator | Accountant | Attendance data for payroll | LOW — automatic |

### Permission Gaps

| Action | Required Role | Checked? | Safe? |
|---|---|---|---|
| Punch in/out | operator | ✅ api | ✅ |
| View attendance review | supervisor+ | ✅ api + UI guard | ✅ |
| Create entry | operator+ | ✅ api | ✅ |
| Override shift | supervisor+ | ✅ UI conditional | ✅ |
| Approve entries | supervisor+ | ✅ api | ✅ |

---

## 10. Regression Risk Analysis

| Dependency | Risk Level | Why |
|---|---|---|
| **Attendance state machine** (can_punch_in, can_punch_out, status flags) | **HIGH** | Complex state logic — changes to backend state machine could break UI display |
| **Active factory context** | **HIGH** | Multiple pages depend on active factory — a bug here breaks attendance AND entry AND dashboard |
| **Offline queue + IndexedDB draft** | MEDIUM | Cross-browser IndexedDB behavior varies |
| **Role-based navigation** (`getHomeDestination`) | MEDIUM | Changes to role routing could send operators to wrong landing page |
| **Dashboard multi-data loading** (10 parallel API calls) | **CRITICAL** | If any one API breaks or changes shape, the dashboard could partially fail or show stale data |
| **Cookie auth session** | MEDIUM | Session expiry handling is graceful but could break if middleware changes |
| **Shift template configuration** | LOW | Controlled by admin, rarely changes |

---

## 11. Operational Efficiency Score

| Metric | Score | Rationale |
|---|---|---|
| **Click Efficiency** | **3/10** | 28 clicks vs ideal 5 — heavy overhead from page splits and multi-step form |
| **Navigation Efficiency** | **4/10** | 5 page transitions for one shift's start — attendance and entry should be unified |
| **Reliability** | **7/10** | Strong draft/offline/duplicate protection, but session expiry mid-flow is unprotected |
| **Consistency** | **7/10** | Good visual consistency; wizard vs single-page forms is notable inconsistency |
| **Error Resistance** | **5/10** | Forgot-to-punch-before-entry and skipped-quality-issues are dangerous gaps |
| **High Pressure Usability** | **4/10** | The attendance→entry split collapses under real pressure — operators will skip steps |
| **Learnability** | **7/10** | Dashboard guidance cards and step indicators help; first-time setup is clear |
| **Speed** | **5/10** | 3-5 min best case, 8-15 min under pressure — too slow for a shift start |

### Total Score: **42/100** ⚠️

---

## 12. Recommended Improvements

### Critical (blocking floor operations)

| # | Improvement | Type | Impact |
|---|---|---|---|
| C1 | **Unify attendance punch + entry into a single "Start Shift" lane** | Structural | Eliminates the biggest context switch and navigation overhead. A single workflow: pick shift → punch in → enter production data → submit. Removes ~8 clicks and 3 page transitions. |
| C2 | **Add attendance guard to entry page** | Quick Win | If user hasn't punched in, show a warning banner at the top of the entry form: "You haven't punched in yet. Punch in first." Preferably, allow inline punch from within the entry page. |
| C3 | **Enforce quality issue flag when downtime > threshold** | Quick Win | If downtime > 30 minutes and quality issues is OFF, show a warning: "You recorded {X} minutes of downtime without a quality flag. Was there a quality issue?" |

### High

| # | Improvement | Type | Impact |
|---|---|---|---|
| H1 | **Merge Step 1 & Step 2 of entry form** | Structural | Date/shift selection + production numbers can fit on one screen. Reduces 4 steps to 3, saves ~2 clicks. |
| H2 | **Add session expiry warning modal** | Quick Win | Before submission, check session validity with a lightweight `GET /auth/me`. If expired, show a re-login overlay that preserves the draft. |
| H3 | **Add inline shift status to entry page sidebar** | Quick Win | Show attendance status ("Punched in at 07:32") in the entry sidebar so the operator doesn't need to leave the form to verify. |

### Medium

| # | Improvement | Type | Impact |
|---|---|---|---|
| M1 | **Make Step 3 (issues) and Step 4 (advanced) collapsible by default** | Quick Win | Reduce perceived form length. "Issues" and "Advanced" should be expandable sections on a 2-step form rather than full steps. |
| M2 | **Add auto-detection of shift from current time** | Quick Win | Default shift selection to current time period (morning 6-14, evening 14-22, night 22-6) — already implemented, verified working. |
| M3 | **Pre-populate units_target from template/allowed shift capacity** | Medium | If the factory has a standard shift target, auto-fill it to save one more input. |
| M4 | **Pre-populate manpower_present from expected shift size** | Medium | If shift templates have expected headcount, use it as a baseline. |

### Low

| # | Improvement | Type | Impact |
|---|---|---|---|
| L1 | **Reword "Missed Punch" → "Needs Review" consistently** | Quick Fix | Minor terminology alignment |
| L2 | **Add "Go to Entry" button on attendance success banner** | Quick Win | After punch-in success, offer a direct link: "Start your shift entry →" to reduce navigation overhead |

---

## 13. Before vs After Workflow

### Before (Current)

```
Login → Dashboard → Attendance → (Punch In) → Dashboard → Entry → Step 1 → Step 2 → Step 3 → Step 4 → Submit
```

### After (Recommended — Unified Start Shift)

```
Login → Dashboard → [Start Shift]
                                ↓
                    ┌──────────────────────────────┐
                    │  Start Shift (single page):   │
                    │  • Confirm shift (auto)       │
                    │  • Punch In (toggle/button)   │
                    │  • Units target/produced      │
                    │  • Manpower present/absent    │
                    │  • [Issues — expandable]      │
                    │  • [Advanced — expandable]    │
                    │  • Submit                     │
                    └──────────────────────────────┘
                                ↓
                           [Complete]
```

### Improvement Summary

| Metric | Before | After | Change |
|---|---|---|---|
| Page transitions | 5 | 2 | **-60%** |
| Total clicks | 28 | ~10-14 | **-50%** |
| Time (best case) | 3-5 min | 1.5-2.5 min | **-40%** |
| Context switches | 2 major | 0 major | **-100%** |
| High-pressure completion | Risky | Safe | ✅ |

---

## 14. Summary of Findings

### By Priority

| Priority | Count | Key Areas |
|---|---|---|
| CRITICAL | 3 | Attendance-entry split, missing attendance guard, quality flag gap |
| HIGH | 3 | Form step count, session expiry, inline shift status |
| MEDIUM | 4 | Collapsible steps, auto-fill defaults, post-punch navigation |
| LOW | 2 | Terminology alignment, success flow navigation |

### Key Theme

The **attendance-to-entry split** is the single biggest friction point in this workflow. In a real factory, starting a shift means: (1) arrive, (2) punch in, (3) record output. The current UI splits (2) and (3) into separate pages with a forced navigation back through dashboard. Under pressure, operators will skip step (2) or get confused about what to do next.

### Efficiency Rating: **42/100 — URGENT IMPROVEMENT NEEDED**
