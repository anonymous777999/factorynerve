# ARCH-03: Background Scheduler Migration to rq

## Status
**Planned** — July 2026

## Context
The backend uses 6 daemon-thread scheduler services for background tasks:

| Service | File | Type |
|---------|------|------|
| Email Queue Processor | `email_queue_processor.py` | Polling daemon thread |
| Attendance Auto-Close | `attendance_auto_close_service.py` | Polling daemon thread |
| Attendance Absence Sweep | `attendance_absence_service.py` | Time-based daemon thread |
| Approval Expiry | `approval_expiry_service.py` | Polling daemon thread |
| Feedback Anomaly Detection | `feedback_anomaly_detection.py` | Polling daemon thread |
| WhatsApp Sender | `whatsapp_sender.py` | asyncio event loop in daemon thread |

These schedulers run inside the web process. A crash in any scheduler thread can destabilize the entire process, and there's no visibility into scheduler health or backlogs.

## Decision
Migrate all 6 scheduler services to **rq** (Redis Queue), which is already in `requirements.txt` (`rq==1.16.2`):

**Why rq over Celery:**
- rq is already installed — no new dependencies needed
- All 6 schedulers are simple polling loops — no need for Celery's advanced routing, celery beat, or task orchestration
- rq workers run as separate processes — scheduler crashes don't affect the web process
- Built-in retries, scheduling, and monitoring (via `rq-dashboard`)
- Simpler configuration — just a queue name and worker process

### Migration Pattern
Each scheduler gets:
1. An **rq job function** in `backend/workers/` that performs the actual work
2. An **enqueue function** that schedules the job with appropriate interval/retry
3. A **feature flag** (`RQ_WORKER_ENABLED_*`) so each worker can be toggled independently

### Workers
```
backend/workers/
├── __init__.py
├── email_queue_worker.py       # Enqueue on startup, processes email_queue table
├── attendance_auto_close.py    # Enqueued via cron or scheduler
├── attendance_absence.py       # Enqueued via cron at 23:59 local time
├── approval_expiry.py          # Enqueued via cron or scheduler
├── feedback_anomaly.py         # Enqueued via cron or scheduler
└── whatsapp_sender.py          # Wraps existing async sender for rq execution
```

### Deployment
Add to `render.yaml`:
```yaml
  - type: worker
    name: factorynerve-rq-worker
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: rq worker default --with-scheduler
```

## Consequences
- **Positive**: Scheduler crashes are isolated from the web process
- **Positive**: Built-in retry, monitoring, and visibility via `rq-dashboard`
- **Positive**: Each worker can be scaled independently
- **Negative**: Requires Redis to be running (already in production)
- **Negative**: Migrating 6 schedulers one-by-one takes time
- **Negative**: Existing in-process schedulers must be kept running during migration (dual-run phase)
