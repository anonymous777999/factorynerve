# Remaining P0-HIGH Issues — Analysis & Remediation Plan

## Issue 1: IP-2 Conditional Bypass — Silent Approval

### Current Behaviour

When an IP-2 workflow's attributes fall within configured thresholds, `_check_ip2_bypass()` returns `True`, and the approval is bypassed entirely — the action proceeds without any approver review.

The current audit trail in `complete_approval()`:
1. Logs a `logger.warning("APPROVAL_BYPASS ...")` message
2. Writes an `AuditLog` row with `action="APPROVAL_BYPASS"`
3. Fires the registered approval callback

### The Gap

**There is no user-facing notification.** The bypass is silently recorded in the database audit log, but:
- No in-app alert/toast is shown
- No email or push notification is sent
- The factory admin/owner has no real-time awareness that an approval was bypassed
- No notification is sent to potential approvers who *would have* reviewed the action

### Impact

For low-variance reconciliations (e.g., 3% variance on ₹10L stock = ₹30,000 discrepancy auto-approved), the owner is never informed that stock adjustments happened without maker-checker review.

### Remediation Plan

#### Step 1: Create a notification abstraction (new file `backend/services/notification_service.py`)
- Define a `send_approval_notification()` function that routes to the appropriate channel:
  - **In-app notifications**: Create a new `Notification` model/table to persist user-facing alerts
  - **Email**: Reuse existing `email_service.py` for high-severity bypasses
- The function signature should accept: `user_id`, `notification_type`, `title`, `body`, `metadata`

#### Step 2: Register approval callback for bypass notifications
- In `approval_callbacks.py`, register a callback for `APPROVAL_BYPASS` (or make it a generic callback on the approval service)
- The callback fires inside `complete_approval()` after the audit log is written
- The callback should:
  1. Identify the org's admin/owner users
  2. Send an in-app notification: `"Approval bypassed: {workflow_key} for {resource_type} #{resource_id} — reason: IP-2 conditional thresholds met"`
  3. For high-value bypasses (variance > ₹1L or quantity > 10,000 kg), also send an email alert

#### Step 3: Add notification persistence
- Create a `Notification` model with fields: `id, user_id, org_id, notification_type, title, body, metadata, is_read, created_at`
- Add API endpoints: `GET /notifications` and `PATCH /notifications/{id}/read`
- Add a notification badge to the frontend navigation

#### Step 4: Wire the callback into `complete_approval()`
- In `approval_service.py`'s `complete_approval()`, after the `if was_bypass:` block writes the audit log, fire a new `_fire_bypass_notification()` method
- This method queues a notification via the notification service

### Complexity Estimate
- **Backend**: 2 new files (model + service), edits to 2 files (approval_service + callbacks) — ~200 lines
- **Database migration**: 1 new table
- **Frontend**: Notification badge + dropdown — ~100 lines
- **Effort**: Medium (~2-3 days)

---

## Issue 2: OCR Queue — Remaining Memory Protection Gaps

### Current Protections (already in place)
| Protection | Where | Effective? |
|-----------|-------|-----------|
| `MAX_QUEUE = 50` | `ocr_jobs.py` | ✅ Yes — backpressure on enqueue |
| `MAX_WORKERS = 4` | `ocr_jobs.py` | ✅ Yes — caps concurrent processing |
| `_MAX_TRACKED_JOBS = 500` | `ocr_jobs.py` | ✅ Yes — prevents OOM |
| `_evict_old_jobs()` | `ocr_jobs.py` | ✅ Yes — evicts terminal jobs |
| Circuit breaker (20 fails/5min) | `ocr_jobs.py` | ✅ Yes — rate-gates on failures |
| Disk persistence | `ocr_jobs.py` | ✅ Yes — survives restart |
| Input file cleanup | `ocr_jobs.py` | ✅ Yes — prevents disk-space leak |

### Remaining Gaps

#### Gap 2a: Circuit Breaker is Global, Not Granular

**Current:** `_OCR_FAILURE_COUNTER` is a single global dict. If provider A fails 20 times in 5 minutes, NO new jobs can be enqueued — even for provider B which is working fine.

**Fix:** Make the circuit breaker per-provider (per-AI provider). Track failures by `params.get("provider", "default")`. Each provider gets its own threshold and cooldown.

#### Gap 2b: No Per-Org Queue Fairness

**Current:** The queue is a single global FIFO. If org A floods the queue with 50 jobs, org B's jobs are delayed until all of org A's jobs finish.

**Fix:** Implement multi-queue with round-robin or weighted fair queuing. Each org gets a virtual queue; workers pull from the org with the fewest outstanding jobs.

#### Gap 2c: Disk Persistence Writes Full State on Every Update

**Current:** `_save_jobs_to_disk()` (called from `_update_job()` which is called for every status transition) writes the **entire** `_jobs` dict to a single JSON file. With 500 tracked jobs and each job going through 3-4 status transitions (queued → running → retrying → running → completed), this means ~2000 full-file writes per burst.

**Fix:** Use an append-only log approach:
- When a job is updated, append a single-line JSON delta to `_JOB_PERSIST_PATH`
- On startup, replay the log and compact it (write a fresh consolidated file, truncate the old log)
- This reduces I/O from O(n) to O(1) per update

#### Gap 2d: Thread Safety — Disk Write Under Lock

**Current:** The docstring says `_save_jobs_to_disk()` "Must be called while _jobs_lock is ALREADY held". But writing 500 jobs to disk can take 10-50ms, during which NO other thread can read or write `_jobs`.

**Fix:** 
- Release `_jobs_lock` before calling `_save_jobs_to_disk()` (take a snapshot under the lock, release, then write the snapshot to disk)
- OR use the append-only log approach (Gap 2c), which is much faster (single `write()` syscall)

#### Gap 2e: No Rate Limit on Enqueue Per User

**Current:** Any authenticated user can enqueue unlimited jobs, subject only to the global queue capacity of 50.

**Fix:** Add per-user rate limiting using the existing `rate_limit` middleware/decorator. E.g., `@rate_limit("5/minute")` on OCR enqueue endpoints to prevent a single user from flooding the queue.

#### Gap 2f: Circuit Breaker Lacks Half-Open State

**Current:** `_circuit_breaker_allow()` is a simple counter check. There's no half-open state to test if the downstream provider has recovered. Once the failure window passes, the circuit resets immediately, potentially causing a thundering-herd of retries.

**Fix:** Implement a proper 3-state circuit breaker:
1. **Closed** — normal operation
2. **Open** — reject all requests for `cooldown` seconds
3. **Half-Open** — after cooldown, allow one probe request. If it succeeds, close the circuit. If it fails, reopen.

### Remediation Plan

#### Step 1: Multi-provider circuit breaker (`backend/ocr_jobs.py`)
- Change `_OCR_FAILURE_COUNTER` to be a dict keyed by provider: `dict[str, dict[str, float]]`
- Update `_circuit_breaker_allow(provider: str | None = None)` to check per-provider
- Implement proper 3-state: closed → open → half-open → closed

#### Step 2: Append-only persistence (`backend/ocr_jobs.py`)
- Replace full-dict writes with append-only delta log
- On startup, replay the log and compact
- This also solves Gap 2d (thread safety under lock)

#### Step 3: Per-enqueue rate limiting (`backend/main.py` or `backend/routers/ocr_router.py`)
- Add `@rate_limit("5/minute", key_func=authenticated_user_key)` to OCR enqueue endpoints

#### Step 4: Per-org queue fairness (`backend/ocr_jobs.py`)
- Implement multi-queue with one `queue.Queue` per org
- Worker loop selects the org with the fewest outstanding jobs

### Complexity Estimate
- **Step 1 (circuit breaker)**: Edits to 2 functions in 1 file — ~50 lines — **Low effort**
- **Step 2 (persistence)**: New write path + replay logic in 1 file — ~100 lines — **Medium effort**
- **Step 3 (rate limit)**: Add decorator — ~1 line — **Trivial**
- **Step 4 (fair queuing)**: Multi-queue + worker scheduling — ~150 lines — **Medium effort**
- **Total**: ~3-4 days end-to-end with testing

---

## Prioritization & Ordering

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| P0-HIGH | IP-2 bypass notification | Medium | Owner unaware of auto-approved stock adjustments |
| P0-HIGH | OCR circuit breaker granularity | Low | Global failure blocks all providers |
| P0-HIGH | OCR append-only persistence | Medium | I/O pressure + lost jobs under race |
| P0-MEDIUM | OCR per-user rate limit | Trivial | User can flood queue |
| P0-MEDIUM | OCR fair queuing | Medium | One org can starve others |
| P0-MEDIUM | OCR half-open circuit breaker | Low | Thundering-herd on recovery |

**Recommended implementation order:**
1. OCR circuit breaker granularity (1 hour) — high impact, low effort
2. OCR per-user rate limit (15 min) — trivial
3. IP-2 bypass notification (2-3 days) — highest business impact
4. OCR append-only persistence (1 day) — reliability
5. OCR half-open circuit breaker (1 hour) — recovery safety
6. OCR fair queuing (1 day) — fairness
