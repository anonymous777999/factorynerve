# FACTORY NERVE — RENDER-BASED REMEDIATION PLAN

**Infrastructure:** Render Web Service (free, Docker) + Render PostgreSQL (free)
**Date:** June 23, 2026
**Target:** Ship to paying customers (₹20K/month)

---

## TABLE OF CONTENTS

1. [Render Infrastructure Constraints](#1-render-infrastructure-constraints)
2. [🔴 TIER 0 — BLOCKING (Must fix before shipping)](#2--tier-0--blocking-must-fix-before-shipping)
3. [🟠 TIER 1 — CRITICAL (Fix in first week)](#3--tier-1--critical-fix-in-first-week)
4. [🟡 TIER 2 — IMPORTANT (Fix in first month)](#4--tier-2--important-fix-in-first-month)
5. [🟢 TIER 3 — NICE TO HAVE (2+ months)](#5--tier-3--nice-to-have-2-months)
6. [🔧 Implementation Checklist (For You to Execute)](#6--implementation-checklist-for-you-to-execute)
7. [📊 Shipping Readiness Gantt](#7--shipping-readiness-gantt)

---

## 1. RENDER INFRASTRUCTURE CONSTRAINTS

Your deployment uses **Render Free Plan** which has specific constraints:

| Constraint | Impact | Mitigation Strategy |
|-----------|--------|-------------------|
| **Free PostgreSQL (1GB)** | Very limited storage for production data | Monitor usage; consider upgrading to Starter ($7/mo, 1GB same but better performance) or Blaze ($35/mo, 10GB) at launch |
| **No native backups** | Render doesn't auto-backup free DBs | Must implement pg_dump cron externally |
| **Ephemeral filesystem** | Backups written to disk are lost on restart | Backups must go to external storage (S3/R2) |
| **No cron jobs** | Can't schedule daily tasks natively | Use external free cron (cron-job.org, easily) or GitHub Actions |
| **Single web service** | No separate background workers | Background jobs run in same process (already designed this way) |
| **Docker deployment** | Must rebuild Docker image for env changes | Use Render env vars, update Dockerfile if needed |
| **No Redis (free)** | Background jobs fall back to in-memory | Already handled — graceful fallback exists |
| **Memory limit (512MB)** | OCR processing could OOM | Already handles this with streaming and timeouts |
| **Auto-deploy** | Merged PRs auto-deploy | Ensure migrations don't crash on deploy — you have `render_start.py` which handles this |

### What You Have Working Well on Render

✅ `render_start.py` — Handles Alembic + init_db fallback startup
✅ `render.yaml` — Service + DB configured
✅ Dockerfile path configured at `./deploy/render/backend.Dockerfile`
✅ Health check at `/observability/ready`
✅ Connection pooling configured for PostgreSQL (pool_size=3, overflow=3)
✅ SSL mode enforced for Render DB connections
✅ Graceful fallback when Redis not available (background jobs, rate limiting)

---

## 2. 🔴 TIER 0 — BLOCKING (Must fix before shipping)

### FIX 0.1: Database Backup & Disaster Recovery

**Severity:** 🔴 BLOCKING
**Business Impact:** If Render PostgreSQL crashes or you accidentally delete data, **all customer data is lost forever**. Render's free tier has no point-in-time recovery.
**Est. Time:** 4 hours
**Risk if not done:** Complete data loss — business-ending event

**Implementation:**

1. **Set up automated daily pg_dump to external storage**

   Create a GitHub Actions workflow (free) that:
   - Connects to your Render PostgreSQL using `DATABASE_URL`
   - Runs `pg_dump --format=custom --no-owner --compress=9`
   - Uploads to a free Backblaze B2 bucket (10GB free tier) or R2 (free tier)
   - Keeps 7 daily + 4 weekly backups

   **File to create:** `.github/workflows/db-backup.yml`

   ```yaml
   name: Database Backup
   on:
     schedule:
       - cron: '0 2 * * *'  # 2 AM UTC = 7:30 AM IST
     workflow_dispatch:  # Allow manual trigger

   jobs:
     backup:
       runs-on: ubuntu-latest
       steps:
         - name: Install pg_dump
           run: sudo apt-get update && sudo apt-get install -y postgresql-client
         
         - name: Run pg_dump
           run: |
             TIMESTAMP=$(date +%Y%m%d_%H%M%S)
             FILENAME="factorynerve_${TIMESTAMP}.dump"
             pg_dump \
               --format=custom \
               --no-owner \
               --compress=9 \
               --dbname="${{ secrets.DATABASE_URL }}" \
               --file="${FILENAME}"
             echo "filename=${FILENAME}" >> $GITHUB_ENV
         
         - name: Upload to Backblaze B2
           env:
             B2_APPLICATION_KEY_ID: ${{ secrets.B2_KEY_ID }}
             B2_APPLICATION_KEY: ${{ secrets.B2_APPLICATION_KEY }}
             B2_BUCKET_NAME: factorynerve-backups
           run: |
             # Install b2 CLI
             pip install b2
             b2 authorize-account "$B2_APPLICATION_KEY_ID" "$B2_APPLICATION_KEY"
             b2 upload-file "$B2_BUCKET_NAME" "${{ env.filename }}" "${{ env.filename }}"
             echo "Backup uploaded: ${filename}"
         
         - name: Clean up old backups (keep last 14 days)
           env:
             B2_APPLICATION_KEY_ID: ${{ secrets.B2_KEY_ID }}
             B2_APPLICATION_KEY: ${{ secrets.B2_APPLICATION_KEY }}
             B2_BUCKET_NAME: factorynerve-backups
           run: |
             pip install b2
             b2 authorize-account "$B2_APPLICATION_KEY_ID" "$B2_APPLICATION_KEY"
             b2 ls "$B2_BUCKET_NAME" | while read line; do
               filename=$(echo $line | awk '{print $NF}')
               if [[ "$filename" =~ factorynerve_([0-9]{8}) ]]; then
                 filedate="${BASH_REMATCH[1]}"
                 if [[ "$filedate" < "$(date -d '14 days ago' +%Y%m%d)" ]]; then
                   b2 delete-file-version "$B2_BUCKET_NAME" "$filename" ""
                 fi
               fi
             done
   ```

2. **Test restore procedure from a backup**

   Create a script to restore to your local machine:
   ```bash
   # On local machine
   pg_restore --clean --if-exists \
     --dbname=postgresql://localhost:5432/factorynerve_restore \
     factorynerve_20260623_020001.dump
   ```

3. **Document recovery steps** (add to README)

---

### FIX 0.2: Email Delivery Retry with Queue

**Severity:** 🔴 BLOCKING
**Business Impact:** Lost verification emails = lost signups = lost ₹20K/month. Currently no retry mechanism.
**Est. Time:** 6 hours
**Risk if not done:** Up to 30% of signups may not complete registration due to transient email failures

**Implementation:**

The `EmailQueue` model already exists in `backend/models/email_queue.py`. You need a background processor to retry failed sends.

1. **Create an email sending background worker**

   **File to create:** `backend/services/email_queue_processor.py`

   ```python
   """Background processor for email queue with retry logic."""
   
   import logging
   import os
   import time
   import threading
   from datetime import datetime, timezone, timedelta
   
   from sqlalchemy.orm import Session
   
   from backend.database import SessionLocal
   from backend.email_service import send_email
   from backend.models.email_queue import EmailQueue
   
   logger = logging.getLogger(__name__)
   
   MAX_RETRIES = int(os.getenv("EMAIL_MAX_RETRIES", "5"))
   RETRY_BACKOFF_MINUTES = [
       1,     # 1 minute after 1st failure
       5,     # 5 minutes after 2nd
       15,    # 15 minutes after 3rd
       60,    # 1 hour after 4th
       360,   # 6 hours after 5th
   ]
   POLL_INTERVAL_SECONDS = int(os.getenv("EMAIL_POLL_INTERVAL", "30"))
   
   class EmailQueueProcessor:
       def __init__(self):
           self._stop = threading.Event()
           self._thread = None
       
       def start(self):
           if self._thread is not None:
               return
           self._stop.clear()
           self._thread = threading.Thread(target=self._loop, daemon=True, name="email-queue")
           self._thread.start()
           logger.info("Email queue processor started")
       
       def stop(self):
           self._stop.set()
           if self._thread:
               self._thread.join(timeout=5)
               self._thread = None
       
       def _loop(self):
           while not self._stop.wait(POLL_INTERVAL_SECONDS):
               try:
                   self._process_batch()
               except Exception:
                   logger.exception("Email queue processor error")
       
       def _process_batch(self):
           db = SessionLocal()
           try:
               now = datetime.now(timezone.utc)
               # Get pending emails that are due for retry
               pending = (
                   db.query(EmailQueue)
                   .filter(
                       EmailQueue.status.in_(["pending", "failed"]),
                       (EmailQueue.next_retry_at.is_(None) | (EmailQueue.next_retry_at <= now)),
                       EmailQueue.attempts < MAX_RETRIES,
                   )
                   .order_by(EmailQueue.created_at.asc())
                   .limit(10)
                   .all()
               )
               for email in pending:
                   try:
                       send_email(
                           to_emails=[email.to_emails],
                           subject=email.subject,
                           body=email.body,
                       )
                       email.status = "sent"
                       email.last_error = None
                       logger.info("Sent queued email %s to %s", email.id, email.to_emails)
                   except Exception as e:
                       email.attempts = (email.attempts or 0) + 1
                       email.last_error = str(e)[:500]
                       email.last_attempt_at = now
                       
                       if email.attempts >= MAX_RETRIES:
                           email.status = "failed"
                           logger.error("Email %s permanently failed after %d attempts", email.id, MAX_RETRIES)
                       else:
                           email.status = "failed"
                           backoff = RETRY_BACKOFF_MINUTES[min(email.attempts - 1, len(RETRY_BACKOFF_MINUTES) - 1)]
                           email.next_retry_at = now + timedelta(minutes=backoff)
                           logger.warning(
                               "Email %s failed (attempt %d/%d), retrying in %d min",
                               email.id, email.attempts, MAX_RETRIES, backoff
                           )
                   email.updated_at = now
               db.commit()
           finally:
               db.close()
   
   # Global singleton
   _processor = None
   
   def start_email_processor():
       global _processor
       if _processor is None:
           _processor = EmailQueueProcessor()
           _processor.start()
   
   def stop_email_processor():
       global _processor
       if _processor:
           _processor.stop()
           _processor = None
   ```

2. **Integrate into main.py startup**

   In `backend/main.py`, add:
   ```python
   from backend.services.email_queue_processor import start_email_processor, stop_email_processor
   
   # Add to startup event
   @app.on_event("startup")
   async def startup():
       start_email_processor()
   
   # Add to shutdown event
   @app.on_event("shutdown")
   async def shutdown():
       stop_email_processor()
   ```

3. **Update all email-sending code to use the queue** instead of `send_email()` directly

   For critical emails (password reset, verification), **enqueue and also attempt immediate send**:
   ```python
   def queue_and_send_email(to_emails, subject, body, user_id, factory_name):
       # Always enqueue for retry persistence
       db = SessionLocal()
       try:
           entry = EmailQueue(
               user_id=user_id,
               factory_name=factory_name,
               subject=subject,
               body=body,
               to_emails=", ".join(to_emails),
               status="pending",
           )
           db.add(entry)
           db.commit()
           
           # Attempt immediate send
           try:
               send_email(to_emails=to_emails, subject=subject, body=body)
               entry.status = "sent"
               db.commit()
           except Exception:
               pass  # Queue processor will retry
       finally:
           db.close()
   ```

---

### FIX 0.3: Rate Limiting on Registration Endpoint

**Severity:** 🔴 BLOCKING
**Business Impact:** Anyone can spam `/auth/register` with 10,000 requests to fill your DB with pending registrations
**Est. Time:** 1 hour
**Risk if not done:** Low-cost DoS attack fills database

**Implementation:**

The rate limiting infrastructure already exists in `backend/middleware/rate_limit.py`. You just need to apply it to the registration endpoint.

**File to edit:** `backend/routers/auth.py`

Add the rate limit decorator to the registration endpoint:

```python
from backend.middleware.rate_limit import rate_limit
from backend.middleware.security import extract_client_ip

# Add a separate key function for registration (IP-based, not user-based)
def registration_ip_key(request: Request) -> str:
    """Use IP for registration rate limiting since user isn't authenticated yet."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"

# Apply to the register endpoint
@router.post("/register")
@rate_limit("3/minute", key_func=registration_ip_key)  # 3 registration attempts per IP per minute
async def register(...):
    # ... existing code
```

Also add a stricter limit for the **resend verification** endpoint:
```python
@router.post("/resend-verification")
@rate_limit("2/minute", key_func=registration_ip_key)  # 2 resend attempts per IP per minute
```

---

### FIX 0.4: Razorpay Webhook Race Condition

**Severity:** 🔴 BLOCKING
**Business Impact:** Concurrent webhook delivery could double-activate a subscription or silently drop a payment
**Est. Time:** 8 hours
**Risk if not done:** Double-charging customers or missed plan activations

**Implementation:**

The core issue is in `backend/routers/billing.py` — the `_activate_paid_order` happens inside a transaction that could race.

1. **Add database-level unique constraint on webhook events**

   In the `WebhookEvent` model, ensure there's a unique constraint on `(provider, event_id)`:

   ```python
   # In backend/models/webhook_event.py
   __table_args__ = (
       UniqueConstraint("provider", "event_id", name="uq_webhook_events_provider_event"),
   )
   ```

2. **Use SELECT FOR UPDATE for idempotency check**

   In the webhook handler, wrap the duplicate check in a `SELECT ... FOR UPDATE` to prevent concurrent webhook processing:

   ```python
   # In the razorpay_webhook function, inside the transaction:
   existing = db.query(WebhookEvent).filter(
       WebhookEvent.provider == "razorpay",
       WebhookEvent.event_id == event_id,
   ).with_for_update().first()  # Lock the row to prevent race
   ```

3. **Make payment activation idempotent with a status check**

   Before calling `_activate_paid_order`, check if the subscription is already active for the current period:

   ```python
   # In _activate_paid_order or before calling it:
   sub = get_mutable_subscription(db, org_id)
   if sub and sub.status == "active" and sub.current_period_end_at and sub.current_period_end_at > datetime.now(timezone.utc):
       # Already active — log and skip
       logger.info("Subscription already active for org_id=%s, skipping activation", org_id)
       return
   ```

4. **Add idempotency key to Razorpay order creation**

   Use the idempotency key in Razorpay API calls:
   ```python
   # In create_order function
   headers = {"X-Razorpay-Idempotency-Key": idempotency_key}
   order = client.order.create(payload, headers=headers)
   ```

---

### FIX 0.5: Session Timeout Enforcement

**Severity:** 🔴 BLOCKING
**Business Impact:** Stolen JWT tokens remain valid for up to 24 hours (JWT_EXPIRE_HOURS). No absolute session timeout.
**Est. Time:** 3 hours
**Risk if not done:** Compromised token = full access for 24 hours

**Implementation:**

1. **Add absolute session timeout (max session lifetime)**

   In `backend/auth_security/sessions.py`:

   ```python
   # Add
   ABSOLUTE_SESSION_TTL_HOURS = int(os.getenv("ABSOLUTE_SESSION_TTL_HOURS", "12"))
   
   # In get_current_session, add check:
   if session.created_at:
       if session.created_at.tzinfo is None:
           session_created = session.created_at.replace(tzinfo=timezone.utc)
       else:
           session_created = session.created_at
       if datetime.now(timezone.utc) - session_created > timedelta(hours=ABSOLUTE_SESSION_TTL_HOURS):
           raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired.")
   ```

2. **Add sliding session expiration (inactivity timeout)**

   ```python
   # In touch_session, also check last_used_at
   SLIDING_SESSION_TTL_MINUTES = int(os.getenv("SLIDING_SESSION_TTL_MINUTES", "60"))
   
   if session.last_used_at:
       last_used = session.last_used_at
       if last_used.tzinfo is None:
           last_used = last_used.replace(tzinfo=timezone.utc)
       if datetime.now(timezone.utc) - last_used > timedelta(minutes=SLIDING_SESSION_TTL_MINUTES):
           raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired due to inactivity.")
   ```

3. **Make JWT token expiry configurable per endpoint sensitivity**

   For sensitive operations (billing, admin), add a short-lived token check:
   ```python
   SHORT_LIVED_JWT_MINUTES = int(os.getenv("SHORT_LIVED_JWT_MINUTES", "5"))
   ```

4. **Add these env vars to `render.yaml`** so they're set in production

---

### FIX 0.6: Schema Drift Prevention

**Severity:** 🔴 BLOCKING
**Business Impact:** One missing column in a migration can crash the entire API on startup
**Est. Time:** 4 hours
**Risk if not done:** Every deploy risks a production outage

**Implementation:**

1. **Add a migration test that runs on every deploy**

   Create a CI check that validates Alembic can apply migrations:

   **File to create:** `scripts/test_migrations.py`

   ```python
   """Verify that Alembic migrations apply cleanly to a fresh database."""
   
   import os
   import subprocess
   import sys
   from pathlib import Path
   
   ROOT = Path(__file__).resolve().parents[1]
   
   def main():
       # Use the DATABASE_URL from env, or a test URL
       db_url = os.getenv("TEST_DATABASE_URL")
       if not db_url:
           print("SKIP: TEST_DATABASE_URL not set")
           return 0
       
       os.chdir(str(ROOT))
       result = subprocess.run(
           [sys.executable, "-m", "alembic", "upgrade", "head"],
           capture_output=True, text=True, env={**os.environ, "DATABASE_URL": db_url}
       )
       if result.returncode != 0:
           print("MIGRATION FAILED:", result.stderr)
           return 1
       print("Migrations applied successfully")
       return 0
   
   if __name__ == "__main__":
       sys.exit(main())
   ```

2. **GitHub Actions workflow for migration testing**

   **File to create:** `.github/workflows/test-migrations.yml`

   ```yaml
   name: Test Migrations
   on:
     pull_request:
       paths:
         - 'alembic/**'
         - 'backend/models/**'

   jobs:
     test-migrations:
       runs-on: ubuntu-latest
       services:
         postgres:
           image: postgres:15
           env:
             POSTGRES_USER: test
             POSTGRES_PASSWORD: test
             POSTGRES_DB: test
           ports:
             - 5432:5432

       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-python@v5
           with:
             python-version: '3.12'
         - name: Install dependencies
           run: pip install -r requirements.txt
         - name: Test migrations
           run: python scripts/test_migrations.py
           env:
             TEST_DATABASE_URL: postgresql+psycopg2://test:test@localhost:5432/test
   ```

3. **Add a Docker Compose test for local migration testing**

   **File to create:** `docker-compose.test.yml`

   ```yaml
   version: '3.8'
   services:
     db:
       image: postgres:15
       environment:
         POSTGRES_USER: test
         POSTGRES_PASSWORD: test
         POSTGRES_DB: test_migrations
       ports:
         - 5433:5432
   
   migration-test:
     build:
       dockerfile: ./deploy/render/backend.Dockerfile
       context: .
     depends_on:
       - db
     environment:
       DATABASE_URL: postgresql+psycopg2://test:test@db:5432/test_migrations
       RUN_ALEMBIC_ON_STARTUP: "true"
       ALLOW_INIT_DB_FALLBACK: "false"
   ```

---

## 3. 🟠 TIER 1 — CRITICAL (Fix in first week after launch)

### FIX 1.1: PDF Invoice Generation

**Severity:** 🟠 CRITICAL
**Business Impact:** Indian steel factories require GST-compliant invoices. Your current system has no PDF invoice generation at all.
**Est. Time:** 16 hours
**Revenue Risk:** HIGH — customers may not be able to use your system for billing without PDF invoices

**Implementation:**

You already use `reportlab` for the gate pass PDF (`backend/services/steel_dispatch_pdf.py`). Extend this pattern:

1. **Create `backend/services/steel_invoice_pdf.py`**

   Use the same `reportlab` pattern to generate GST-compliant invoices with:
   - Company logo (from settings)
   - GSTIN, PAN, HSN codes
   - Invoice number, date, due date
   - Buyer details (name, GSTIN, address, state code)
   - Line items with HSN, quantity, rate, taxable value
   - Tax breakup (CGST, SGST, IGST)
   - Total in words
   - QR code (for e-invoice compliance)
   - Digital signature placeholder

2. **Add endpoint to generate and download invoice PDF**

   ```python
   @router.get("/steel/invoices/{invoice_id}/pdf")
   def download_invoice_pdf(invoice_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
       # Generate PDF on-the-fly
       # Store in jobs directory for later retrieval
   ```

3. **Add "Email Invoice" button** that sends PDF as attachment

---

### FIX 1.2: Account Lockout After N Failed Logins

**Severity:** 🟠 CRITICAL
**Business Impact:** Brute force attacks on customer accounts currently have no lockout mechanism
**Est. Time:** 4 hours
**Risk if not done:** Customer accounts can be brute-forced

**Implementation:**

1. **Track failed login attempts in database**

   Add a `failed_login_attempts` and `locked_until` field to the `User` model:

   ```python
   # In backend/models/user.py
   failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
   locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
   ```

2. **Enforce lockout in login endpoint** (`backend/routers/auth.py`):

   ```python
   # Before checking password
   if user.locked_until and user.locked_until > datetime.now(timezone.utc):
       remaining = (user.locked_until - datetime.now(timezone.utc)).seconds // 60
       raise HTTPException(status_code=429, detail=f"Account locked. Try again in {remaining} minutes.")
   
   # After failed login
   user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
   if user.failed_login_attempts >= 5:
       user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
       # Alert the user via email
   
   # After successful login
   user.failed_login_attempts = 0
   user.locked_until = None
   ```

---

### FIX 1.3: AI Cost Visibility Dashboard

**Severity:** 🟠 CRITICAL
**Business Impact:** AI costs can explode without oversight. Customers can't see their AI usage. You can't track per-customer AI profit/loss.
**Est. Time:** 6 hours
**Risk if not done:** You could be losing money on AI costs without knowing

**Implementation:**

1. **Create an AI usage tracking endpoint**

   **File to edit:** `backend/routers/billing.py` (add to `/billing/status` response)

   The data already exists in:
   - `AiUsageLog` model (per-request logging)
   - `IntelligenceStageUsage` model (per-stage costs)
   - `OrgFeatureUsage` model (org-level aggregation)

2. **Add AI cost fields to billing status response**

   ```python
   # In get_billing_status()
   ai_usage = {
       "total_tokens_used": ...,
       "current_month_cost_usd": ...,
       "monthly_cost_cap_usd": ...,  # from org settings
       "cost_remaining": ...,
       "requests_this_month": ...,
       "average_cost_per_request": ...,
   }
   ```

3. **Create frontend component** showing AI usage as a simple card

---

### FIX 1.4: Email Fallback for Critical Alerts

**Severity:** 🟠 CRITICAL
**Business Impact:** Currently WhatsApp-only. If WhatsApp provider is down, ops alerts are silently lost.
**Est. Time:** 8 hours
**Risk if not done:** Factory owners may miss critical theft/security alerts

**Implementation:**

1. **Add email alert recipient type** in `backend/services/ops_alerts/dispatcher.py`

   The dispatcher already handles multiple provider types. Add email as a fallback:

   ```python
   # In the dispatch method
   def dispatch(self, candidate: AlertCandidate) -> bool:
       # Try WhatsApp first
       if self._whatsapp_available:
           success = self._send_via_whatsapp(candidate)
           if success:
               return True
       
       # Fallback to email
       if candidate.org_id:
           email_recipients = self._get_email_recipients(candidate.org_id)
           if email_recipients:
               self._send_via_email(candidate, email_recipients)
               return True
       
       return False
   ```

2. **Add recipient phone/email configuration in admin panel**

   Add email fields to `admin_alert_recipients` model (email_address column may already exist).

3. **Configure SendGrid or Resend for alert emails**

   Use the same SMTP/Resend configuration already in `email_service.py`.

---

### FIX 1.5: E2E Test for Core Entry Flow

**Severity:** 🟠 CRITICAL
**Business Impact:** No end-to-end test for your #1 customer workflow (create entry → approve → view report). One regression could break the entire product.
**Est. Time:** 12 hours
**Risk if not done:** Regression risk on every deploy for the most-used feature

**Implementation:**

Create a comprehensive E2E test file:

**File to create:** `tests/test_entry_e2e.py`

```python
"""End-to-end test for the core entry workflow."""

import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)

def test_operator_creates_entry_and_supervisor_approves():
    """Test the full entry workflow end-to-end."""
    # 1. Register a new org with operator + supervisor
    # 2. Login as operator
    # 3. Create a production entry
    # 4. Verify entry appears in list
    # 5. Login as supervisor
    # 6. Approve the entry
    # 7. Verify entry status changed to approved
    # 8. Verify audit log entry created
    # 9. Clean up test data
    pass
```

---

## 4. 🟡 TIER 2 — IMPORTANT (Fix in first month)

| # | Task | Est. Hours | Reason |
|---|------|-----------|--------|
| 2.1 | Stock reorder alerts (inventory below reorder point) | 8 | Prevents stockouts |
| 2.2 | Customer statement PDF generation | 8 | Required for collections |
| 2.3 | Login notification emails ("New login from unknown device") | 6 | Security best practice |
| 2.4 | Password expiry policy (90-day rotation) | 3 | Compliance |
| 2.5 | Automated vendor payment scheduling | 12 | Finance automation |
| 2.6 | Fraud case management (track investigation lifecycle) | 16 | Makes fraud detection actionable |
| 2.7 | Add pending_downgrade scheduler as cron job | 4 | Uses cron-job.org or GitHub Actions |
| 2.8 | Monthly production report PDF | 8 | Factory owners need monthly summaries |

---

## 5. 🟢 TIER 3 — NICE TO HAVE (2+ months)

| # | Task | Est. Hours | Notes |
|---|------|-----------|-------|
| 3.1 | GSTR-1 export for GST compliance | 20 | Required for >₹5Cr turnover customers |
| 3.2 | E-invoicing / IRN generation | 40 | Mandatory for B2B >₹5Cr |
| 3.3 | Full double-entry accounting (P&L, Balance Sheet) | 80 | Would complete the finance module |
| 3.4 | Real-time truck tracking GPS integration | 24 | Differentiator for logistics |
| 3.5 | DKIM/SPF/DMARC email authentication setup | 4 | Improves email deliverability |
| 3.6 | AI-powered production forecasting | 16 | Advanced AI feature |
| 3.7 | OCR usage analytics for customers (dashboard) | 8 | Transparency for OCR pack buyers |
| 3.8 | Client-side image compression before OCR upload | 6 | Reduces bandwidth for large images |

---

## 6. 🔧 IMPLEMENTATION CHECKLIST (For You to Execute)

### Week 1 — Blocking Fixes (Do these before accepting any paying customer)

- [ ] **Fix 0.1** — Set up GitHub Actions backup + test restore locally (4 hrs)
- [ ] **Fix 0.2** — Create email queue processor + integrate (6 hrs)
- [ ] **Fix 0.3** — Add rate limit to `/auth/register` endpoint (1 hr)
- [ ] **Fix 0.4** — Fix Razorpay webhook race condition (8 hrs)
- [ ] **Fix 0.5** — Add absolute session timeout + sliding expiry (3 hrs)
- [ ] **Fix 0.6** — Add migration test CI workflow (4 hrs)
- [ ] **Total:** ~26 hours

### Week 2 — Critical Fixes

- [ ] **Fix 1.1** — PDF invoice generation (16 hrs) ← **Do this first, invoices are a hard requirement**
- [ ] **Fix 1.2** — Account lockout after failed logins (4 hrs)
- [ ] **Fix 1.3** — AI cost visibility (6 hrs)
- [ ] **Fix 1.4** — Email fallback for alerts (8 hrs)
- [ ] **Fix 1.5** — E2E test for entry workflow (12 hrs)
- [ ] **Total:** ~46 hours

### Week 3-4 — Important Fixes

- [ ] **Fix 2.1-2.8** — ~65 hours
- [ ] Pick based on which customer needs what first

---

## 7. 📊 SHIPPING READINESS GANTT

```
Week 1                Week 2                Week 3-4              Month 2+
│                     │                     │                     │
🔴 Backup             🟠 PDF Invoices       🟡 Stock Alerts       🟢 GSTR-1
🔴 Email Retry        🟠 Account Lockout    🟡 Statements         🟢 E-Invoicing
🔴 Register RateLimit 🟠 AI Cost Dashboard  🟡 Login Notifs       🟢 Accounting
🔴 Webhook RaceCond   🟠 Alert Email        🟡 Password Expiry    🟢 GPS Tracking
🔴 Session Timeout    🟠 E2E Tests          🟡 Payment Scheduling 🟢 DKIM/SPF
🔴 Schema Drift                             🟡 Fraud Mgmt         🟢 AI Forecast
                                            🟡 Downgrade Cron
                     │                     │                     │
🚀 SHIP HERE         🔧 Patch              🔧 Polish             🔧 Expand
(after Week 1 fixes) (critical bugs)       (important features)  (long-term)
```

---

## APPENDIX: Render-Specific Configuration Reference

### Env Vars to Add to Render

```bash
# Email (already configured partially)
EMAIL_MAX_RETRIES=5
EMAIL_POLL_INTERVAL=30

# Rate limiting (add to existing)
REGISTER_RATE_LIMIT_PER_MINUTE=3

# Session security (NEW — add these)
ABSOLUTE_SESSION_TTL_HOURS=12
SLIDING_SESSION_TTL_MINUTES=60
SHORT_LIVED_JWT_MINUTES=5

# Account lockout (NEW)
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_MINUTES=15

# Backup (for cron-job.org or GitHub Actions)
BACKUP_B2_KEY_ID=
BACKUP_B2_APPLICATION_KEY=
BACKUP_B2_BUCKET_NAME=factorynerve-backups

# External cron service endpoint
CRON_SECRET_TOKEN=  # Secret to protect cron endpoints
DAILY_MAINTENANCE_ENABLED=true
```

### Cron Jobs Needed (Use cron-job.org — free)

| Job | Schedule | Endpoint | Description |
|-----|----------|----------|-------------|
| Daily maintenance | Daily 2:00 AM IST | `/api/cron/daily-maintenance` | Clean tokens, apply downgrades |
| Daily summary | Daily 6:00 PM IST | `/api/cron/daily-summary` | Send ops alert summaries |
| Email queue | Every 5 minutes | `/api/cron/process-email-queue` | Retry failed emails |

Create a simple cron router:

**File to create:** `backend/routers/cron.py`

```python
"""Cron job endpoints protected by a shared secret."""
import os
from fastapi import APIRouter, Header, HTTPException

router = APIRouter(tags=["Cron"])

CRON_SECRET = os.getenv("CRON_SECRET_TOKEN", "")

def verify_cron_secret(x_cron_secret: str = Header(...)):
    if not CRON_SECRET or x_cron_secret != CRON_SECRET:
        raise HTTPException(status_code=403, detail="Invalid cron secret")

@router.post("/cron/daily-maintenance", dependencies=[Depends(verify_cron_secret)])
def run_daily_maintenance():
    from scripts.daily_maintenance import run
    result = run()
    return result

@router.post("/cron/process-email-queue", dependencies=[Depends(verify_cron_secret)])
def process_email_queue():
    from backend.services.email_queue_processor import EmailQueueProcessor
    processor = EmailQueueProcessor()
    processor._process_batch()  # Process one batch
    return {"status": "ok"}

@router.post("/cron/daily-summary", dependencies=[Depends(verify_cron_secret)])
def run_daily_summary():
    from backend.services.ops_alerts.service import run_daily_summary_once
    count = run_daily_summary_once()
    return {"summaries_sent": count}
```

---

*End of Remediation Plan — Start with Week 1, don't skip any 🔴 items.*
