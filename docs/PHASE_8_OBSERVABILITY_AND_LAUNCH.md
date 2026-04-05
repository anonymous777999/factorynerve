# Phase 8: Observability and Launch

This phase is the production hardening pass for DPR.ai. The codebase now has the hooks we need for monitoring, controlled beta rollout, load testing, and Streamlit retirement.

## Monitoring

### Backend health and readiness

- `GET /health`
  - basic liveness probe
- `GET /observability/ready`
  - readiness probe with database check
- `GET /metrics`
  - protected metrics snapshot
  - requires header: `X-Metrics-Token: <METRICS_TOKEN>`

### Frontend error intake

- Browser errors and unhandled promise rejections are reported to:
  - `POST /observability/frontend-error`
- Route-level Next.js crashes are also reported through `app/error.tsx`
- If `SENTRY_DSN` is configured, frontend errors are forwarded into Sentry through the backend

### Logging

- `LOG_FORMAT=text`
  - human-readable local logs
- `LOG_FORMAT=json`
  - production JSON logs for Logtail, Datadog, Better Stack, CloudWatch, or ELK

## Suggested Uptime Monitors

Create these monitors in Better Stack, Checkly, UptimeRobot, or your preferred tool:

1. Backend liveness
   - URL: `https://your-domain/health`
   - interval: 30s
   - expected status: `200`

2. Backend readiness
   - URL: `https://your-domain/observability/ready`
   - interval: 60s
   - expected status: `200`

3. Web frontend
   - URL: `https://your-domain/login`
   - interval: 60s
   - expected status: `200`

4. Auth flow synthetic check
   - log in with a test beta account
   - verify `/dashboard` loads

## Load Testing

Run the async load script against the backend:

```bash
python scripts/load_test_core_flows.py --base-url http://127.0.0.1:8765 --users 25 --concurrency 5
```

The report is saved to:

- `reports/load_test_core_flows.json`

The script currently tests:

- register
- login
- health
- create DPR entry
- list entries
- Excel export

## Beta Rollout Controls

Optional frontend banner environment variables:

- `NEXT_PUBLIC_BETA_STAGE`
- `NEXT_PUBLIC_BETA_BANNER_TEXT`
- `NEXT_PUBLIC_BETA_FEEDBACK_URL`
- `NEXT_PUBLIC_RELEASE_VERSION`

Recommended rollout:

1. Internal team only
2. 3-5 trusted factory users
3. One full factory site
4. All premium accounts
5. General availability

## Streamlit Removal

Streamlit has been removed from the repository. DPR.ai runs with FastAPI + the Next.js web client only.

Local backend launcher:

```bash
python run.py
```

## Recommended Exit Criteria

Do not fully retire Streamlit until all of these are true:

- `/health` and `/observability/ready` stay green for 14 days
- frontend error intake stays low and actionable
- beta users complete DPR entry and export flows without blockers
- load test results stay within acceptable latency for your hosting plan
- rollback plan is documented and tested
