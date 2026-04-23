# WhatsApp Ops Alert Examples

```
🚨 CRITICAL — Server/API Failure
App: DPR.ai | Env: production
Time: 2026-04-23T22:42:00+05:30
────────────────────
Unhandled RuntimeError on POST /billing/webhook/razorpay. Check recent deploys and logs before the failure spreads.
────────────────────
Meta: path: /billing/webhook/razorpay | method: POST | error_class: RuntimeError | error: database connection dropped | duration_ms: 412.4
Ref ID: srv-1776964320-a3f
```

```
🚨 HIGH — Unauthorized Access Pattern
App: DPR.ai | Env: production
Time: 2026-04-23T22:44:00+05:30
────────────────────
8 unauthorized responses from the same IP in the last 10 minutes exceeded the threshold of 8.
────────────────────
Meta: attempts: 8 | window: 10m | threshold: 8 | ip: 203.0.113.8 | endpoint: /auth/login | status: 401
Ref ID: auth-1776964440-c19
```

```
🚨 HIGH — OCR Failure Spike
App: DPR.ai | Env: production
Time: 2026-04-23T22:46:00+05:30
────────────────────
12 OCR extraction failures in the last 5 minutes exceeded the threshold of 10.
────────────────────
Meta: failures: 12 | window: 5m | threshold: 10 | top_error: timeout | sample_job_id: job-9f32a
Ref ID: ocr-1776964560-b72
```
