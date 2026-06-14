 WHITEPAPER: WhatsApp Integration Module Audit -- DPR.ai

### 1. MODULE SCOPE

The WhatsApp Integration is **not a monolithic module**; it is a cross-cutting subsystem spanning **five backend services** with two distinct responsibilities:

| File | Role |
|---|---|
| `backend/routers/whatsapp_webhook.py` | **Inbound** -- Meta Cloud API webhook (delivery status reconciliation only) |
| `backend/services/whatsapp_sender.py` | **Outbound** -- Send templated WhatsApp messages via Meta Cloud API |
| `backend/services/sms_service.py` | OTP delivery abstraction layer that delegates to `whatsapp_sender` |
| `backend/services/ops_alerts/service.py` (lines 411-486) | `apply_whatsapp_delivery_update()` -- reconciles delivery status in `OpsAlertEvent` |
| `backend/services/ops_alerts/dispatcher.py` | Dispatches operational alerts via `whatsapp_sender.send_message_blocking()` |
| `backend/utils.py` (lines 233-274) | `parse_whatsapp_export()` -- **rule-based** text cleaner for manually uploaded chat exports |

**Critical finding: The webhook ONLY processes delivery status updates (sent/delivered/read/failed). It does NOT process, parse, or route any user-sent messages.** There is no two-way conversational WhatsApp flow. The "incoming WhatsApp" surface is strictly Meta's delivery receipt callbacks.

---

### 2. AUTHENTICATION ANALYSIS

#### 2.1 Webhook Verification (GET)

```python
# whatsapp_webhook.py, line 200
@router.get("/whatsapp")
async def verify_whatsapp_webhook(request: Request) -> Response:
```

- Compares `hub.verify_token` against `META_WA_WEBHOOK_VERIFY_TOKEN` using `hmac.compare_digest()` (timing-safe).
- If token is missing from env → returns **403**.
- If token mismatches → returns **403**.
- **Verdict: CORRECTLY AUTHENTICATED.**

#### 2.2 Webhook Payload Verification (POST)

```python
# whatsapp_webhook.py, line 218
@router.post("/whatsapp")
async def receive_whatsapp_webhook(request: Request) -> dict[str, Any]:
```

- Extracts `X-Hub-Signature-256` header.
- Verifies HMAC-SHA256 signature against raw request body using `META_WA_APP_SECRET`.
- Uses `hmac.compare_digest()` (timing-safe comparison).
- **Returns 503** if `META_WA_APP_SECRET` is not configured.
- **Returns 401** if signature header is missing or invalid.
- **Verdict: CORRECTLY AUTHENTICATED.**

#### 2.3 "Can anyone POST fake WhatsApp messages?"

**No.** Only someone holding `META_WA_APP_SECRET` can forge valid signatures. Since this secret is never exposed to clients, the attack surface is limited to:
- Insider threat (someone with access to server env vars).
- Server-side secret leak (e.g., logs, error messages -- though payload excerpts are logged without secrets).

---

### 3. MESSAGE PROCESSING PIPELINE

When a POST arrives at `/webhooks/whatsapp`:

```
1. Validate HMAC signature
2. Parse JSON body
3. Iterate payload["entry"][]["changes"][]["value"]["statuses"]
   ↓
4. For each status item:
   a. Extract: provider_message_id, status, timestamp, recipient_id, errors
   b. Check in-memory dedup cache (24h window)
   c. Map status: sent→dispatched, delivered→delivered, read→read, failed→failed
   d. Call apply_whatsapp_delivery_update()
      ↓
      - Query OpsAlertEvent WHERE provider="meta" AND provider_message_id=...
      - Update row delivery_status, status_timestamp, error fields
      - Append to meta.status_history JSON array
      - Refresh root alert delivery state
      - Commit transaction
   e. Log structured event
```

**The `messages` field in the webhook payload is completely ignored.** If a user replies to a WhatsApp notification, that reply is silently dropped. There is no handler, no queue, no log entry for incoming user messages.

---

### 4. AI INTERPRETATION -- None on Inbound Webhook

| Concern | Verdict |
|---|---|
| Does the webhook interpret user WhatsApp messages? | **No.** The webhook only processes `statuses`, not `messages`. |
| Is the WhatsApp export parser AI-driven? | **No.** `parse_whatsapp_export()` is a regex-based heuristic filter (lines 233-274 of `utils.py`). It strips timestamps, removes system messages, and keeps lines matching production keywords. |
| Does the `/entries` endpoint use AI on WhatsApp exports? | **Yes, but it is USER-INITIATED** via an explicit file upload + POST to `/entries`. The AI parsing (`parse_unstructured_input_with_confidence`) is called only after a user authenticates and sends data. It is NOT triggered by any webhook. |

**Risk: None.** An attacker cannot force AI processing via the WhatsApp webhook.

---

### 5. FINANCIAL / INVENTORY TRIGGER RISK

| Action | Triggerable via WhatsApp webhook? |
|---|---|
| Update delivery status in OpsAlertEvent | **Yes** (this is the only action) |
| Create/modify inventory records | **No** |
| Create/modify financial transactions | **No** |
| Trigger billing/payments | **No** |
| Create/modify production entries | **No** |
| Modify user accounts/roles | **No** |
| Initiate outbound WhatsApp messages | **No** |
| Modify organization settings | **No** |

**Verdict: SAFE.** The webhook's blast radius is limited to the `OpsAlertEvent` table.

---

### 6. MESSAGE HISTORY AND AUDIT

#### 6.1 Persistent Storage

Outbound sends and inbound delivery updates are both stored in the `OpsAlertEvent` table with:

| Field | Source |
|---|---|
| `provider_message_id` | Meta's wamid |
| `delivery_status` | queued/dispatching/dispatched/delivered/read/failed/suppressed/pending |
| `status_timestamp`, `delivered_at`, `read_at` | From webhook payload |
| `provider_error_code`, `provider_error_title` | From Meta error object |
| `last_error` | Human-readable failure reason |
| `meta.status_history` | JSON array of all status transitions |
| `meta.webhook` | Latest webhook payload excerpt |

#### 6.2 Structured Logging

Every event is logged with structured keys:
- `whatsapp_webhook_event` -- individual status reconciliation
- `whatsapp_webhook_unmatched_message` -- delivery status with no matching outbound record
- `whatsapp_webhook_reconciled` -- summary of batch processing
- `whatsapp_send_completed` -- outbound send result

#### 6.3 Dedup Cache

The `_WEBHOOK_EVENT_CACHE` is **process-local, in-memory only**. It is not shared across workers, not persisted, and lost on restart.

---

### 7. ERROR HANDLING

| Failure Scenario | Behavior |
|---|---|
| `META_WA_APP_SECRET` not set | Returns HTTP 503 |
| Signature header missing | Returns HTTP 401 |
| Signature invalid | Returns HTTP 401 |
| Malformed JSON body | Returns HTTP 400 |
| Non-dict payload body | Returns `{"status": "ignored"}` (200) |
| Webhook processing exception (broad catch) | Returns `{"status": "ignored"}` (200) |
| WhatsApp API unreachable (outbound) | Timeout exception caught, returns `MessageResult(status="failed")`, single retry for 5xx |
| Duplicate event (same wamid+status+timestamp within 24h) | Silently suppressed, counted in `duplicates` counter |
| Status for unknown `provider_message_id` | Logged as `unmatched_message`, marked ignored |
| Stale status transition (e.g., "delivered" after "read") | Rejected, counted as `stale` |
| Sender background thread fails to start | `initialize_whatsapp_sender()` times out after 5s, but does not block app startup |

**All code paths return safe, non-exploitable responses.** No stack traces are exposed to the caller.

---

### 8. RATE LIMITING

| Layer | Mechanism | Effective? |
|---|---|---|
| Global middleware rate limiter | In-memory sliding window, 120 req / 60s, keyed by JWT user/org or client IP | **Partially.** Applies to all endpoints including the webhook. Keys by Meta's source IP (since webhooks carry no auth token). A single shared bucket for all Meta traffic. |
| Per-endpoint rate limiter | `/auth/login`, `/settings/users/invite`, `/ocr/` have specific limits | **No.** The webhook has no per-endpoint limit. |
| `@rate_limit` decorator | Used on billing webhooks (`300/minute`) | **Not applied** to `/webhooks/whatsapp`. |
| Webhook dedup cache | 24-hour window for duplicate (wamid+status+ts) | **Deduplication only, not rate limiting.** |
| Outbound daily cap | 500 sends/day per org | Global rate limit on outbound, not inbound. |

#### BUG-WHATSAPP-001: Missing Dedicated Rate Limiting on Webhook Endpoint

The `POST /webhooks/whatsapp` endpoint has **no dedicated rate limiting**. While the global middleware applies a 120-req/60s limit keyed by client IP, this is coarse and not designed for webhook traffic patterns. A burst of legitimate delivery receipts from Meta could be unfairly throttled, or conversely, a sustained attack (if the app secret were compromised) would only be limited to 120 requests per 60 seconds -- insufficient for abuse mitigation.

**Severity: MEDIUM**
**Recommendation:** Add a dedicated rate limiter for the webhook path (e.g., `@rate_limit("300/minute", key_func=webhook_ip_key)`) matching the pattern already used in `billing.py` line 968.

---

### 9. BUG FINDINGS

#### BUG-WHATSAPP-002: In-Memory Dedup Cache Is Not Worker-Safe

`_WEBHOOK_EVENT_CACHE` (line 27 of `whatsapp_webhook.py`) is a module-level `dict` protected by a `threading.Lock`. In a multi-worker deployment (gunicorn/uvicorn with multiple processes), each worker has its own copy. This means:

- **Duplicate webhook events are NOT deduplicated across workers.** Meta may retry a delivery status callback; if workers 1 and 2 receive the same event, both will process it, leading to duplicate database updates and redundant `OpsAlertEvent` mutations.
- **The `_prune_event_cache` window (24h) is also per-worker.** A worker that starts fresh after a restart or has been idle will accept events that another worker already processed.

**Severity: LOW** (the database-level operations are idempotent -- `_should_reject_delivery_update` prevents backward status transitions, and `_set_delivery_state` overwrites with the same values. The practical impact is wasted DB writes and unnecessary log noise.)

**Recommendation:** Either (a) use a shared cache (Redis) for dedup, or (b) accept the race condition as low-impact given the idempotency of downstream operations.

#### BUG-WHATSAPP-003: Incoming User Messages Are Silently Dropped

The webhook handler iterates only `value["statuses"]` (line 136). Meta webhook payloads also contain a `messages[]` array for user-initiated messages (replies to business messages, inbound first messages). These are **never read, logged, or stored**. If a user replies to a WhatsApp alert notification, that reply vanishes without any trace.

While this is currently by design, there is:
1. No logging of ignored messages (could hide legitimate debugging signals).
2. No warning if the payload contains unprocessed `messages` entries.
3. No webhook-level differentiation between "status-only" and "has messages" payloads.

**Severity: LOW** (informational -- may confuse operators who expect to see user replies)
**Recommendation:** At minimum, log the count of unprocessed `messages` entries per webhook payload. Consider adding a metric.

#### BUG-WHATSAPP-004: No Startup Validation for WhatsApp Configuration

The webhook routes are registered and the sender thread starts regardless of whether `META_WA_*` environment variables are configured. Misconfiguration is only detected at runtime:

- Webhook GET without `META_WA_WEBHOOK_VERIFY_TOKEN` → returns 403.
- Webhook POST without `META_WA_APP_SECRET` → returns 503.
- Outbound send without `META_WA_PHONE_NUMBER_ID` / `META_WA_ACCESS_TOKEN` → fails with `MessageResult(status="failed")`.

There is no startup check that warns admins if the WhatsApp integration is partially configured.

**Severity: LOW**
**Recommendation:** Add a startup validation in the `lifespan` handler that logs a warning if `WHATSAPP_PROVIDER_MODE=meta` but any required variables are missing.

#### BUG-WHATSAPP-005: Webhook Event Cache Has No Size Bound

`_WEBHOOK_EVENT_CACHE` (line 27) is a `dict` with unbounded growth potential. While `_prune_event_cache` removes entries older than 24 hours, an attacker sending many unique event keys (different `wamid:status:timestamp` combinations) could cause memory exhaustion. Each entry is a modest `str → float` mapping, but at scale (e.g., millions of entries before the 24h prune cycle) this could cause OOM.

**Severity: LOW** (requires valid HMAC signatures, meaning the attacker needs `META_WA_APP_SECRET`)
**Recommendation:** Add a `maxlen` bound (e.g., `OrderedDict` with `maxlen=100000` or similar) to prevent unbounded growth.

---

### 10. SUMMARY OF FINDINGS

| ID | Finding | Severity | Status |
|---|---|---|---|
| BUG-WHATSAPP-001 | Missing dedicated rate limiting on webhook endpoint | MEDIUM | Open |
| BUG-WHATSAPP-002 | In-memory dedup cache not shared across workers | LOW | Open |
| BUG-WHATSAPP-003 | Incoming user messages silently ignored | LOW | By design, but undocumented |
| BUG-WHATSAPP-004 | No startup validation for WhatsApp config | LOW | Open |
| BUG-WHATSAPP-005 | Webhook event cache has no size bound | LOW | Open |

### 11. OVERALL ASSESSMENT

| Category | Rating | Notes |
|---|---|---|
| Authentication | **STRONG** | HMAC-SHA256 with timing-safe comparison. Both GET verification and POST validation present. |
| Authorization | **N/A** | No user-level authorization needed (webhook is a server-to-server callback) |
| Input Validation | **ADEQUATE** | JSON parsing wrapped in try/except, non-dict payloads handled gracefully |
| Rate Limiting | **WEAK** | Only the global middleware limiter applies; no dedicated webhook rate limiter |
| Audit Trail | **GOOD** | Persistent storage in OpsAlertEvent + structured logging; dedup cache is ephemeral |
| Error Handling | **STRONG** | All paths return safe responses; no stack leak; broad catch prevents crashes |
| Financial Risk | **NONE** | Webhook cannot trigger billing, inventory, or production operations |
| Blast Radius | **NARROW** | Confined to OpsAlertEvent delivery status updates |

The WhatsApp module is **well-architected for its current scope** (delivery status reconciliation for outbound notifications + OTP). It is **not a conversational WhatsApp bot**. The security posture is strong due to HMAC authentication, limited blast radius, and comprehensive error handling. The primary gaps are operational: missing rate limiting, worker-unsafe dedup, and silent dropping of user replies.