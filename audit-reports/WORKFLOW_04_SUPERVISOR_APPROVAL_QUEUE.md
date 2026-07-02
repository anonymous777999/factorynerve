# Workflow 4: Supervisor Approval Queue

## Operational Workflow Regression & Friction Audit

**Date:** June 17, 2026
**Auditor:** Buffy (Senior UX Auditor / Workflow Engineer)
**Workflow ID:** W-04
**Priority:** CRITICAL

---

## Phase 1 — Workflow Mapping

### Flow Diagram

```
/approvals
  │
  ├── Inbox Load (on mount + refresh signal)
  │     ├── listAttendanceReview()    → pending attendance regularizations
  │     ├── listEntries({status: pending}) → pending DPR entries
  │     ├── listOcrVerifications("pending") → pending OCR documents
  │     ├── listUnreadAlerts()         → unread factory signals
  │     ├── (steel only) listSteelReconciliations({status: pending})
  │     └── (steel only) getSteelOverview() → high-risk batches
  │
  ├── Task Normalization (priority-ranked)
  │     ├── Each source item → ReviewTaskItem with:
  │     │     ├── severity (critical/high/warning/info)
  │     │     ├── ageBand (fresh/aging/stale)
  │     │     ├── priorityScore = severity(4-1)*100 + age(0-3)*10 + flags
  │     │     └── canApprove/canReject (role-gated)
  │     └── Sorted by priorityScore desc
  │
  ├── Signal Normalization (priority-ranked)
  │     ├── Alerts → AlertSignalItem (mark-as-read action)
  │     └── Steel batches → BatchSignalItem (trace action)
  │
  ├── Queue Display
  │     ├── "Review next" (featured top item)
  │     ├── "Backlog" (remaining items, collapsed)
  │     ├── Presets: All / Today / 8h+ / 24h+ / Stock / OCR
  │     ├── Filters: type / severity / age / search
  │     └── Bulk selection with shared note
  │
  ├── Detail Panel (right side or mobile overlay)
  │     ├── Type/severity/age badges
  │     ├── Title, headline, description
  │     ├── Recommended action
  │     ├── "Why this item is here"
  │     ├── Facts grid (8-10 fields per item kind)
  │     ├── History / activity facts
  │     ├── Decision summary with checks
  │     ├── Review note textarea
  │     ├── Next step links
  │     ├── Approve / Reject buttons
  │     └── Signal action button (for alerts/batches)
  │
  └── Decision Execution
        ├── Single item: approve/reject with per-item note
        ├── Bulk items: shared note + approve/reject all
        ├── API calls per item kind (attendance/entry/ocr/reconciliation)
        └── Refresh inbox after action
```

### Starting Page
`/approvals` (accessible from sidebar navigation, dashboard cards, work queue)

### End Page
Depends on the action taken:
- **Approved/Rejected item** → Back to queue, item removed from inbox
- **Escalation needed** → Open source page (e.g., `/ocr/verify`) for manual approval
- **Signal acknowledged** → Alert marked read, queue refreshed

### Goal
Provide a single unified review queue where a supervisor, manager, admin, or owner can see all pending review items (attendance, DPR, OCR, stock reconciliation) in one place, triage by priority, and take approve/reject decisions without leaving the page.

### Required Permissions
| Role | Access | Approve | Reject |
|------|--------|---------|--------|
| Attendance User | ❌ | ❌ | ❌ |
| Operator | ❌ | ❌ | ❌ |
| Supervisor | ✅ | Attendance, Entry, OCR (can't approve) | Attendance, Entry |
| Manager | ✅ | Attendance, Entry, OCR ✅ | All |
| Admin | ✅ | All ✅ | All |
| Owner | ✅ | All ✅ | All |

### Required Data (per item kind)
- **Attendance:** attendance_id, employee details, shift, punch times, regularization request
- **DPR Entry:** entry id, date, shift, units target/produced, downtime, quality issues, manpower
- **OCR Verification:** verification_id, source filename, columns, confidence, warnings, rows
- **Reconciliation:** item id, system/physical qty, variance kg/%, confidence status, counted by
- **Alerts:** alert id, type, severity, created_at
- **Batches (steel):** batch id, batch code, variance kg, loss %, operator, dates

### Dependencies
- Backend API for each source type (attendance, entries, OCR, steel)
- User session + role authorization
- Active factory context (for steel-specific content)

### Success Conditions
- ✅ Queue loads all pending items across all sources
- ✅ Items are priority-sorted (severity first, then age)
- ✅ Item selected → detail panel shows context, facts, notes, decision buttons
- ✅ Approve/Reject action completes → success toast → queue refreshes
- ✅ Bulk approve/reject works across 2+ items with shared note
- ✅ Role restrictions properly enforced (canApprove/canReject flags)
- ✅ Escalation-needed items are visible but decision-blocked

---

## Phase 2 — Click Audit

### Path: Supervisor Daily Queue Review

| Step | Action | Clicks | Notes |
|------|--------|--------|-------|
| 1 | Navigate to /approvals | 1 | From sidebar or dashboard card |
| 2 | Wait for inbox to load (4-6 API calls) | 0 | Auto-load |
| 3 | Scan "Review next" featured item | 0 | Visual scan |
| 4 | Click item to open detail panel | 1 | SPA: right panel updates |
| 5 | Review facts grid | 0 | Scroll/visual |
| 6 | Review decision summary & checks | 0 | Scroll/visual |
| 7 | Type review note (if high-severity) | 0 | Keyboard |
| 8 | Click "Approve" | 1 | |
| 9 | Wait for action + refresh | 0 | Auto |
| 10 | Next item auto-selected | 0 | Auto |
| **Per item total** | | **2 + note typing** | |

**Current Click Count per item:** 2-3 clicks + note typing
**Ideal Click Count per item:** 1 click (approve directly from queue) or 0 (batch approve)
**Extra Clicks:** 1-2 per item

### Bulk Path

| Step | Action | Clicks |
|------|--------|--------|
| 1-4 | Same as above | 2 |
| 5 | Expand "Review tools" section | 1 |
| 6 | Click "Select visible" or check individual items | 1 |
| 7 | Type shared note | 0 |
| 8 | Click "Approve selected" | 1 |
| 9 | Review confirmation if restricted items | 0 |
| **Total** | | **5 + note** |

### Click Efficiency Score: **7/10**

Strengths:
- Single-page queue with inline detail panel — no page transitions per decision
- Presets (Today, 8h+, 24h+, Stock, OCR) reduce filter setup clicks
- "Review next" button automatically opens the top item
- Next item auto-selected after completing a decision
- Bulk select + approve/reject reduces per-item clicking significantly

Weaknesses:
- "Review tools" (presets, filters, bulk actions) is hidden behind a `<details>` expand — adds 1 extra click
- "Backlog" is also hidden behind a `<details>` expand — another 1 extra click
- No keyboard shortcut for approve/reject (e.g., `a` for approve, `r` for reject)
- No inline approve — must open detail panel first
- Per-item note required for high-severity items adds friction

---

## Phase 3 — Context Switching Audit

### Context Switches Measured

| Transition | Count | Severity |
|------------|-------|----------|
| Dashboard → /approvals | 1 | Low |
| Queue list ↔ detail panel | Constant | Low (same page, split layout) |
| Detail panel item switch | 1 per item | Low |
| Queue list → source page (e.g., /ocr/verify) | Per escalation | **HIGH** |
| Tools tray expand/collapse | 1-2 per session | Low |
| Bulk decide → type shared note | 1 per batch | Low |
| Source page → back to /approvals | 1 per escalation | **HIGH** |

### Context Switching Score: **3/10** (good — low switching)

The approvals page is **well-designed** for context retention:
- ✅ Queue + detail in same page (split layout)
- ✅ Next item auto-selects after decision
- ✅ Facts and decision summary inline — no need to open source page for standard decisions
- ✅ Bulk actions apply the same decision to multiple items
- ✅ Mobile detail overlay preserves queue position

**The one critical context switch:** When a user cannot approve an item (role-restricted), they must click through to the source page (e.g., `/ocr/verify`) to take action. This means:
1. Leave /approvals → navigate to source page
2. Find the specific item in that source page's queue
3. Take the decision
4. Navigate back to /approvals
5. Manually refresh the queue

---

## Phase 4 — Operational Pressure Test

### Scenario: End-of-shift, 5 supervisors leaving, 30 pending items, manager is calling

**Simulation assumptions:**
- 30 approval items across all sources (10 attendance, 8 DPR, 7 OCR, 5 stock)
- 5 are critical severity, 10 are high severity
- User has 3 minutes before needing to hand off to next shift
- User is distracted (phone ringing, people approaching)

**Can the task still be completed quickly?**

**Bulk operations:** ✅ Batch approve with shared note works well for groups of same-type items with same decision. This is the best path under pressure.

**The bottlenecks:**

1. **Role-restricted items block flow** (RISK: CRITICAL)
   - OCR items waiting for manager approval appear in the queue but can't be actioned by a supervisor
   - User sees "Escalation needed" but must manually navigate to /ocr/verify
   - No "Escalate to next approver" in-app button
   - IMPACT: Under pressure, supervisor ignores those items, they go stale. No auto-escalation trigger.

2. **No auto-approve for low-severity items** (RISK: MEDIUM)
   - An "info" severity entry (routine production, no issues) still requires the same 2-click approve flow as a critical item
   - No "Approve all info/warning items with no note" shortcut

3. **Refresh timing** (RISK: MEDIUM)
   - After each decision, the entire inbox reloads (4-6 API calls)
   - If the backend is slow or under load, the user waits 2-5 seconds between each item
   - BULK operations reduce this, but single-item workflow is noticeably slower

4. **Review note requirement for high-severity** (RISK: LOW-MEDIUM)
   - Under pressure, typing a meaningful note for 15 urgent items is fatiguing
   - Users will type "ok" or "." to bypass
   - The system does not enforce minimum note length

5. **Loading state obscures items** (RISK: LOW)
   - During refresh, the entire queue is replaced — if the user had visually memorized items, the list reshuffles

### Operational Pressure Score: **6/10**

---

## Phase 5 — Reliability Audit

### Race Conditions

| Issue | Severity | Description |
|-------|----------|-------------|
| Bulk action partial failure | MEDIUM | `Promise.allSettled` handles it — successful items are approved, failures reported. Good design. |
| Inbox refresh during action | MEDIUM | `runInboxAction` refetches after the action completes. No stale state race. |
| Double-click approve | LOW | `actionKey` state disables buttons during processing. Solid pattern. |
| Concurrent bulk + single action | LOW | `actionKey` is a single string namespace — "bulk:approve" blocks everything |

### Double Submission

| Guard | Present? | Assessment |
|-------|----------|------------|
| Disabled button during action | ✅ | `isBusy` + `actionKey` checks |
| Optimistic locking on backend | ⚠️ Partial | Backend `advance_approval` uses step-based state machine; race possible on concurrent API calls |
| Idempotency key | ❌ | No client-side idempotency key on approve/reject calls |

### Refresh Failures

| Failure Mode | Recovery | Assessment |
|--------------|----------|------------|
| Browser refresh | ✅ Full state restored via API load on mount | Good |
| Backend timeout on one source | ✅ `Promise.allSettled` gracefully handles failures | Excellent — partial failure with error message |
| Session expired mid-session | ⚠️ Partial | Page may show stale data; no session expiry check on actions |

### Lost Form State

| Scenario | Risk | Assessment |
|----------|------|------------|
| Per-item note typed but not submitted | HIGH | Notes stored per-key in `notesByKey` state (React state only, not persisted). On refresh (F5), all notes are lost. |
| Bulk note typed but not confirmed | HIGH | Same — `bulkNote` is React state only |
| Item auto-switches while note typed | LOW | Notes are keyed by item key, so switching items preserves the note. But switching back to a previous item may show stale note. |

### Reliability Score: **6/10**

Strengths: `Promise.allSettled` for partial failure handling, `actionKey` for busy-state, `notesByKey` preserves per-item notes during session
Weaknesses: No localStorage persistence for notes, no idempotency key, no optimistic updates

---

## Phase 6 — Consistency Audit

### Terminology

| Term used in page | Backend/service term | Issue |
|-------------------|---------------------|-------|
| "Attendance review" | `AttendanceReview` | ✅ Consistent |
| "DPR entry" | `Entry` / `Daily Production Record` | ✅ Consistent |
| "OCR review" | `OcrVerification` | Page uses "OCR review" consistently |
| "Stock review" | `SteelReconciliation` | Page uses "stock review" — consistent with reconciliation |
| "Factory signal" | `AlertItem` | Different term for the same thing |
| "Review next" / "Backlog" | N/A | New terms not from backend — page-specific labels |
| "Approve" (for alerts) | N/A | Alerts are "mark as read", not approved. Page correctly distinguishes. |

### UI/UX Consistency

| Element | Approvals page | Other pages | Assessment |
|---------|---------------|-------------|------------|
| Theme | Dark (navy/black with CSS vars) | Dark theme consistent with verify page | ✅ Consistent with OCR verify |
| Badge colors | Per-type (violet/sky/cyan/orange/fuchsia) | Different across source pages | ⚠️ Inconsistent with source page label styles |
| Severity mapping | critical/high/warning/info | Same | ✅ Consistent |
| Age display | fresh/aging/stale | New — only in approvals page | ⚠️ Not used elsewhere |
| "Approve" button | Primary style | Varies across source pages | ⚠️ Inconsistent button styling |
| Note requirement | Per-severity rules | Different rules across sources | ⚠️ Inconsistent (OCR requires note, DPR doesn't) |

### Styling Consistency Score: **6/10**

The approvals page has its own visual language (type-colored badges, CSS variable theming, expanded card layouts). It feels like a distinct product from the source pages (attendance page, entry page, OCR page). Users switching between `/approvals` and `/attendance/review` will see different button styles, badge systems, and layout densities.

---

## Phase 7 — Human Error Audit

| Scenario | Risk | Recovery |
|----------|------|----------|
| Approve wrong item | MEDIUM | ✅ No undo, but backend audit trail exists. Status can be manually reversed in source page. |
| Reject without reason | LOW | ✅ System requires note for rejection |
| Approve high-severity without checking facts | MEDIUM | ⚠️ Note required, but no validation user actually read the facts |
| Bulk approve items in wrong batch | MEDIUM | ✅ Confirmation dialog before bulk action executes |
| Close browser mid-session | LOW | ⚠️ Notes lost (React state), but decisions already taken are safe (API-driven) |
| Click "Back" from next steps | LOW | ✅ Next steps are links, not in-page actions |
| Accidentally select wrong items for bulk | MEDIUM | ✅ Checkbox selection, visible selection count, summary of approved/reject counts |
| Miss a critical item in "Backlog" | MEDIUM | ⚠️ Backlog is collapsed by default. Critical items may be hidden. |
| Click "Review next" and miss context | LOW | ✅ Opens detail panel — must see facts before action |

### Human Error Score: **7/10**

Strengths: Rejection requires note, bulk confirmation, clear selection visualization, priority-sorted queue
Weaknesses: No undo for approve/reject, backlog collapsed by default (may hide critical items), no read confirmation

---

## Phase 8 — Multi-Role Workflow Audit

### Supervisor Role

| Check | Result |
|-------|--------|
| Can view all queue items? | ✅ |
| Can approve attendance? | ✅ |
| Can approve DPR entries? | ✅ |
| Can approve OCR? | ❌ (must be manager+) |
| Can approve stock reconciliation? | ❌ (must be admin+) |
| Can reject all items? | ✅ |
| **Friction:** OCR and stock items visible but cannot be actioned. Must escalate to manager. | ⚠️ HIGH |

### Manager Role

| Check | Result |
|-------|--------|
| Can approve attendance? | ✅ |
| Can approve DPR entries? | ✅ |
| Can approve OCR? | ✅ |
| Can approve stock reconciliation? | ❌ (must be admin+) |
| **Friction:** Stock items visible but requires escalation to admin. | ⚠️ MEDIUM |

### Admin / Owner Role

| Check | Result |
|-------|--------|
| Can approve all items? | ✅ |
| **No friction** | Perfect |

### Role Transition Pain Points

1. **No in-app escalation** — Supervisor sees "Escalation needed" but cannot route the item to a manager. Must communicate outside the system.
2. **No notification** — When a supervisor submits an OCR document for approval, the manager has no notification unless they actively check /approvals.
3. **Item appears stale** — An OCR item may sit in "pending" for days if no manager checks /approvals. The supervisor sees it age from "fresh" to "aging" to "stale" with no ability to escalate.

### Multi-Role Score: **5/10**

---

## Phase 9 — Regression Risk Analysis

| Change | Risk | Reasoning |
|--------|------|-----------|
| New approval source added (e.g., attendance_override) | LOW | The architecture is modular — just add a new `normalizeXxx()` function and API call. Pattern is well-established. |
| API response format change | HIGH | 6 different API sources, each with its own data shape. A field rename in any source would require updating the normalizer function. |
| Permission model change | MEDIUM | Role gating is done client-side (`canApproveOcr`, `canApproveReconciliation`). If backend permissions change, frontend must update too. |
| Steel module toggle | LOW | Steel content is gated by `steelMode` flag on active factory — clean pattern. |
| CSS variable rename | MEDIUM | Dark theme uses CSS vars (`--border`, `--muted`, `--text`, `--accent`, `--card-strong`). A rename would break the entire page. |
| `beforeunload` added to source pages | LOW | No impact — approvals page doesn't use beforeunload. |
| New severity level added | MEDIUM | Both `severityClasses()` and `ageClasses()` would need new cases. |

### Overall Regression Risk: **MEDIUM**

The approvals page is well-architected with clear separation between data fetching, normalization, and display. The biggest risk is API response format changes across the 6 different backend sources.

---

## Phase 10 — Operational Efficiency Score

| Metric | Score (0-10) | Notes |
|--------|--------------|-------|
| Click Efficiency | 7 | 2 clicks per item + note. Bulk operations reduce significantly. Could be 1-click with keyboard shortcuts. |
| Navigation Efficiency | 8 | Single page, no page transitions for decisions. Source page navigation is the only speed bump. |
| Reliability | 6 | Promise.allSettled is excellent. No note persistence across refresh. No idempotency key. |
| Consistency | 6 | Visual language is distinct from source pages. Badge colors and severity mapping are different. |
| Error Resistance | 7 | Reject requires note, bulk has confirmation. No undo, but audit trail exists. |
| High Pressure Usability | 6 | Bulk operations help. Role-restricted items block flow. Collapsed backlog may hide critical items. |
| Learnability | 8 | Queue + detail panel is intuitive. Presets are self-explanatory. Bulk actions are discoverable. |
| Speed | 7 | Auto-refresh after each action adds 2-5s wait. Bulk reduces overhead. Target: 1 API call for all sources. |

### Total Score: **55/80 (68.75%)**

---

## Critical Findings

### CRITICAL: No in-app escalation or routing for role-restricted items
**Issue:** Supervisors can see OCR and stock items but cannot approve or reject them. The only option is "Escalation needed" text — no button to route to the next approver.
**Impact:** Items age indefinitely. The supervisor sees them in their queue day after day, cluttering the view. No notification reaches the manager.
**Recommendation:** Add an "Escalate to Manager" or "Notify Manager" button that:
1. Marks the item as escalated in the backend
2. Sends a notification to the next role tier
3. Removes the item from the supervisor's queue

### CRITICAL: Backlog collapse may hide critical items
**Issue:** The "Backlog" section (all items except the top "Review next" item) is hidden behind a `<details>` element. If a supervisor only sees the featured item and approves it, the next item becomes the featured one. But the backlog stays collapsed. Under time pressure, users may approve the featured item and move on, never seeing that a critical item was in the backlog.
**Impact:** Critical attendance disputes, OCR documents, or stock variances may go unnoticed for hours or days.
**Recommendation:** If any critical-severity item exists in the backlog, keep the backlog expanded by default with a prominent "CRITICAL ITEM IN BACKLOG" banner.

### HIGH: Notes are React state only — lost on refresh
**Issue:** Per-item notes (`notesByKey`) and bulk notes (`bulkNote`) are stored in React useState only. If the user accidentally refreshes the page, all unsent notes are lost.
**Impact:** Under pressure, users may type detailed review notes for 5-10 items, then accidentally hit F5 and lose everything.
**Recommendation:** Persist notes in `sessionStorage` (survives refresh, cleared on tab close) or `localStorage` with a cleanup mechanism.

### HIGH: No keyboard shortcuts for approve/reject
**Issue:** Each approve/reject requires: select item → scroll to bottom of detail panel → click button. No keyboard shortcuts exist.
**Impact:** The queue is designed for rapid triage, but the interaction pattern is click-heavy. Keyboard shortcuts would halve the time per decision.
**Recommendation:** Add keyboard shortcuts: `a` = approve selected, `r` = reject selected, `j`/`k` = navigate items, `n` = focus note textarea.

### MEDIUM: Inbox refresh is full reload — not incremental
**Issue:** After each action, the entire inbox reloads via 4-6 parallel API calls. For users on slower connections, each decision cycle takes 3-5 seconds of waiting.
**Impact:** A supervisor processing 20 items spends 60-100 seconds just waiting for refreshes.
**Recommendation:** Optimistic removal of the approved/rejected item from the local state, with background refresh for ordering changes. Only reload all sources on manual refresh or after bulk action.

### MEDIUM: Severity/age display inconsistency with source pages
**Issue:** The approvals page uses its own badge color system and age bands (fresh/aging/stale) that don't match the source pages (attendance review, OCR verify, etc.). Users switching between pages see different color coding for the same status.
**Impact:** Cognitive friction for users who make decisions in the approvals queue and then verify details in the source page.
**Recommendation:** Unify badge colors and status labels across /approvals and source pages. Use the same design tokens.

---

## Recommended Improvements (Priority Order)

1. **🔴 Add in-app escalation/routing for role-restricted items** — "Escalate to Manager" button with notification
2. **🔴 Auto-expand backlog if critical items exist** — Critical severity banner when critical items are in backlog
3. **🟡 Persist notes in sessionStorage** — Survive accidental refresh
4. **🟡 Keyboard shortcuts** — `a` approve, `r` reject, `j`/`k` navigate, `n` note
5. 🟡 Optimistic local state removal instead of full reload
6. 🟡 Unified badge/color system with source pages
7. 🟢 Auto-approve for "info" severity items (skip queue, no note required)
8. 🟢 "Approve all visible" without going through bulk tools tray
9. 🟢 Inline approve/reject buttons on queue items (skip detail panel for standard decisions)
10. 🟢 Note minimum length validation (prevent "ok" bypass)

---

## Before vs After Workflow (Critical Fix)

### Before (Current)
```
Queue loads → Click item → Read facts → Type note (if severe) → Click Approve → Wait 3-5s for refresh
→ Next item auto-loads → But backlog collapsed → May miss critical items → Repeat 30 times
```

### After (Suggested)
```
Queue loads → Press 'j'/'k' to navigate → Press 'a' to approve or 'r' to reject → Item removed instantly
→ Backlog auto-expanded if critical item exists → Escalate button for role-restricted items notifies manager
→ 30 items processed in 60 seconds instead of 15 minutes
```
