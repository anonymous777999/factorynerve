# Feedback Channel Security Plan
## Preventing Data Exfiltration via the User Feedback Feature

**Document:** Security companion to `MODULE_INTEGRATION_GUIDE.md`, Section 3.16
**Date:** June 16, 2026

---

## The Core Problem

An authenticated internal user has a direct, unrestricted text channel to an external endpoint (your inbox/system) that bypasses all org-level data controls.

Every other data-out path in your system is controlled — exports need `reporting.finance.export`, invoices need `invoice.record.view`, customer data needs `customer.record.view`. The feedback channel has none of that. It is an open pipe from inside any org's factory to outside, available to every authenticated user at all times.

---

## Attack Vectors

| Vector | Description | Severity |
|--------|-------------|:--------:|
| **V1 — Direct data paste** | User pastes customer ledger, supplier list, or pricing data into the message body | HIGH |
| **V2 — Slow drip exfiltration** | 3-4 messages per week with small data pieces — no single message looks alarming | MEDIUM |
| **V3 — Enumeration probe** | User describes data ("customer credit limit ₹45 lakhs — is this correct?") — still exfiltration | MEDIUM |
| **V4 — Read-back channel** | `GET /mine/updates` returns message body — cross-device clipboard bypassing DLP | HIGH |
| **V5 — Rate limit bypass** | 10 accounts can each submit at individual rate limits, multiplying bandwidth 10x | MEDIUM |
| **V6 — Future attachments** | If file upload is ever added to feedback, full file system becomes exfiltration source | HIGH (future) |

---

## Defence Layers

### Layer 1 — Content Controls (P1)

#### 1a — Hard character limit (1,000 chars)

```python
class FeedbackSubmitRequest(BaseModel):
    message: str
    category: str
    page_url: str | None = None

    @validator("message")
    def message_length(cls, v):
        if len(v.strip()) < 10:
            raise ValueError("Feedback message too short to be useful.")
        if len(v) > 1000:
            raise ValueError(
                "Feedback message cannot exceed 1000 characters. "
                "If you need to share detailed data with support, "
                "please contact your account manager directly."
            )
        return v.strip()
```

#### 1b — Strip and reject embedded data patterns

```python
import re

DATA_PATTERNS = [
    (r'(\+?[\d\s\-]{10,})', "multiple_phone_numbers", 2),
    (r'(₹[\d,]+|Rs\.?\s*[\d,]+|\d+\s*lakh)', "financial_amounts", 3),
    (r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', "email_addresses", 2),
    (r'\b\d{10,}\b', "long_numeric_sequences", 2),
    (r'([^,\n]+,){4,}', "csv_like_content", 1),
]

def _check_message_for_data_patterns(message: str) -> list[str]:
    triggered = []
    for pattern, name, threshold in DATA_PATTERNS:
        matches = re.findall(pattern, message)
        if len(matches) >= threshold:
            triggered.append(name)
    return triggered
```

On match: audit as `FEEDBACK_BLOCKED_DATA_PATTERN` (severity: high). Return generic 400 — **do not reveal which pattern triggered**.

#### 1c — Schema-level attachment block

```python
class FeedbackSubmitRequest(BaseModel):
    message: str
    category: str
    page_url: str | None = None
    # Attachments are explicitly NOT accepted.
    # See: Feedback Channel Security Plan, Layer 1c.
```

### Layer 2 — Three-Tier Rate Limiting (P1)

```python
def _check_feedback_rate_limits(db, current_user, org_id, factory_id):
    _check_rate_limit(
        key=f"feedback:user:{current_user.id}",
        limit=5, window_seconds=3600,
        error="You have submitted too many feedback reports this hour."
    )
    _check_rate_limit(
        key=f"feedback:factory:{factory_id}",
        limit=20, window_seconds=3600,
        error="Too many feedback reports from this factory this hour."
    )
    _check_rate_limit(
        key=f"feedback:org:{org_id}",
        limit=50, window_seconds=3600,
        error="Too many feedback reports from your organisation this hour."
    )
```

### Layer 3 — Scope Isolation on `/mine/updates` (P0 — fix now)

```python
@router.get("/mine/updates")
def get_my_feedback_updates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[FeedbackUpdateItem]:
    feedbacks = (
        db.query(Feedback)
        .filter(
            Feedback.submitted_by_user_id == current_user.id,  # scope isolation
            Feedback.org_id == resolve_org_id(current_user),   # belt-and-suspenders
        )
        .order_by(Feedback.created_at.desc())
        .limit(50)
        .all()
    )
    return [_serialize_feedback_update(f) for f in feedbacks]


class FeedbackUpdateItem(BaseModel):
    feedback_id: int
    category: str
    submitted_at: datetime
    status: str
    developer_response: str | None
    # message_body is intentionally omitted — prevents read-back exfiltration (Vector 4)
```

### Layer 4 — Full Audit Logging (P1 — reclassified from P2)

Every feedback submission must log:

```python
def _write_feedback_audit(db, action, user_id, org_id, factory_id,
                           feedback_id=None, detail="", severity="low"):
    db.add(AuditLog(
        event_id=str(uuid.uuid4()),
        event_time=datetime.now(timezone.utc),
        event_type=f"FEEDBACK_{action}",
        severity=severity,
        actor_user_id=user_id,
        org_id=org_id,
        factory_id=factory_id,
        resource_type="Feedback",
        resource_id=str(feedback_id) if feedback_id else None,
        detail=detail,
        # Message body is NOT logged. Audit logs store metadata, not content.
    ))
```

| Event | Action Constant | Severity |
|-------|----------------|----------|
| User submits feedback | `SUBMIT` | low |
| Submission blocked by data pattern | `BLOCKED_DATA_PATTERN` | high |
| Submission blocked by rate limit | `BLOCKED_RATE_LIMIT` | medium |
| Developer views feedback | `VIEWED` | low |
| Developer changes status | `STATUS_CHANGE` | low |
| Developer exports CSV | `EXPORTED` | medium |

### Layer 5 — Anomaly Detection Alerts (P2)

**Alert A — Volume spike:** More feedback in 24h than in prior 30 days combined.
**Alert B — Repeat blocks:** 2+ blocked submissions in 24h (intentional probing).
**Alert C — Block-then-success:** Blocked submission followed by a successful one within 10 minutes (pattern probing).

---

## What This Plan Does NOT Do

- **Does not disable the feedback feature** — it is genuinely useful for support.
- **Does not use AI semantic scanning** — pattern matching on structure is faster, cheaper, and more predictable.
- **Does not add an approval step** before submission — that defeats the purpose of bug reporting.
- **Does not block users based on role** — the controls are on content and volume, not on who can speak.

---

## Implementation Order

| Priority | What | Why |
|----------|------|-----|
| **P0** | Message length limit (1,000 chars) | Stops bulk paste — single line of code |
| **P0** | `/mine/updates` scope isolation + remove message body from response | Closes Vector 4, fixes existing data isolation bug |
| **P1** | Data pattern detection + block + audit | Closes Vectors 1, 2, 3 |
| **P1** | Three-tier rate limiting | Closes Vector 5 |
| **P1** | Full audit logging on all feedback events | Enables all anomaly detection |
| **P1** | Schema-level attachment block | Future-proofs against Vector 6 |
| **P2** | Anomaly detection alert jobs (A, B, C) | Catches what the content controls miss |

---

*End of Feedback Channel Security Plan*
