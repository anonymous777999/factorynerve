# DPR.ai

DPR.ai is a factory-first operating system built for real daily plant work. It helps workers, supervisors, managers, and owners move from paper records, WhatsApp images, scattered Excel sheets, and manual follow-up into one simple, reliable workflow.

## Vision

Build the most practical daily operating system for factories, especially for teams working with paper-heavy processes, mixed digital skills, mobile devices, slow networks, and messy real-world inputs.

## Mission

Replace disconnected factory tools with one product that makes daily operations faster, clearer, and easier to trust across attendance, work queues, shift entry, OCR, approvals, reports, and steel operations.

## What DPR.ai is trying to solve

- Workers should be able to complete tasks with little or no training.
- Supervisors should be able to review work without chasing people.
- Managers should be able to see what is happening on the floor in near real time.
- Owners should be able to track production, attendance, stock, dispatch, and risk from one system.
- The product should still feel usable on mobile, in local languages, and on unreliable networks.

## Product principles

- Factory-first, not generic SaaS-first.
- Mobile-first, because many critical actions happen away from desks.
- Local-language friendly, because adoption depends on comfort.
- Structured outputs over raw dumps, because people need decisions.
- Human-guided automation, because OCR and AI need correction flows.
- Speed and clarity over feature overload.

## Current stack

- Frontend: Next.js 16 + React 19 in `web/`
- Backend: FastAPI + SQLAlchemy in `backend/`
- Database: SQLite by default, with future migration path to Postgres

## Local development

Backend:

```bash
python run.py
```

Frontend:

```bash
cd web
npm run dev
```

Open `http://127.0.0.1:3000`

## WhatsApp Alert Backend

The backend now includes a plug-and-play WhatsApp alert module with generic provider adapters for Meta Cloud API, Twilio, and Gupshup.

### Install

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python run.py
```

### Configure API key

Set these environment variables in `.env`:

```env
WHATSAPP_PROVIDER=meta
WHATSAPP_API_KEY=your_provider_api_key
WHATSAPP_API_URL=
WHATSAPP_SENDER_ID=your_sender_phone_or_provider_id
WHATSAPP_TIMEOUT_SECONDS=10
WHATSAPP_RETRY_ATTEMPTS=3
WHATSAPP_RETRY_BACKOFF_SECONDS=1.5
```

Provider notes:

- `meta`: `WHATSAPP_SENDER_ID` is the Meta phone number ID. `WHATSAPP_API_URL` can usually stay blank.
- `gupshup`: `WHATSAPP_SENDER_ID` can be the source number, or `source|app_name` if your setup also needs `src.name`.
- `twilio`: set `WHATSAPP_API_KEY` as `account_sid:auth_token` and `WHATSAPP_SENDER_ID` as the WhatsApp-enabled sender number, for example `whatsapp:+14155238886`.

### Add sender number

No code changes are required after setup. The sender/channel identity comes from `WHATSAPP_SENDER_ID`.

### Add recipients

Create recipients with the backend API:

```bash
curl -X POST http://127.0.0.1:8765/recipients ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Plant Manager\",\"phone_e164\":\"+919876543210\",\"is_active\":true}"
```

`name` is optional. If you only send `phone_e164`, the backend uses the phone number as the display label.

Optional per-recipient preferences can be sent as:

```json
{
  "name": "Night Shift Lead",
  "phone_e164": "+919876543211",
  "is_active": true,
  "alert_types": ["critical", "security"]
}
```

If `alert_types` is omitted, the backend stores a wildcard preference and the recipient receives all alert types.

### Test sending an alert

```bash
curl -X POST http://127.0.0.1:8765/alerts/send ^
  -H "Content-Type: application/json" ^
  -d "{\"alert_type\":\"critical\",\"message\":\"Critical machine stop on Line 2.\"}"
```

The API returns immediately with `202 Accepted`, creates pending `alert_logs`, and sends WhatsApp alerts in the background with retry handling for temporary provider failures.

### Available endpoints

- `POST /recipients`
- `GET /recipients`
- `PATCH /recipients/{id}`
- `POST /alerts/send`

## In-App Feedback System

The product also includes an in-app feedback system for operators, supervisors, managers, and admins, plus an internal review queue inside Settings.

### What it does

- Keeps a floating Help button available across the app, with adaptive placement on immersive scanner routes.
- Lets users send short issue reports, bugs, suggestions, and wrong-alert reports in under 10 seconds.
- Supports text input and browser voice capture.
- Detects Hindi or English automatically and stores original text plus translated text when a translation provider is configured.
- Attaches route and app context automatically so the team can reproduce problems faster.
- Deduplicates repeated submissions for a short window.
- Queues feedback offline in the browser and syncs it automatically when the connection returns.
- Shows lightweight micro feedback after key actions with an optional one-line comment.
- Prompts users to report frontend errors with one click when an error occurs.
- Notifies reporters later when one of their submitted issues is marked resolved.
- Gives `admin` and `owner` users a review tab in Settings to triage and resolve feedback.
- Lets admins sort by recency or recurrence frequency and export feedback to CSV.

### Backend endpoints

- `POST /feedback`
- `GET /feedback`
- `GET /feedback/mine/updates`
- `GET /feedback/{feedback_id}`
- `PATCH /feedback/{feedback_id}`
- `GET /feedback/export.csv`

### Optional translation setup

If you want automatic Hindi-English translation stored in `message_translated`, configure a translation provider:

```env
FEEDBACK_TRANSLATION_PROVIDER=libretranslate
FEEDBACK_TRANSLATION_API_URL=https://your-translation-service/translate
FEEDBACK_TRANSLATION_API_KEY=
FEEDBACK_TRANSLATION_TIMEOUT_SECONDS=4
```

### Notes

- `POST /feedback` requires an authenticated user.
- `GET` and `PATCH` feedback endpoints are restricted to `admin` and `owner`.
- Run `alembic upgrade head` so the feedback tables are created before using the review queue.

## More context

See [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) for a detailed AI and engineer handoff guide.

## Deployment help

- HTTPS / production deployment: [docs/HTTPS_DEPLOYMENT_PLAYBOOK.md](./docs/HTTPS_DEPLOYMENT_PLAYBOOK.md)
- Render backend deployment: [docs/RENDER_SETUP.md](./docs/RENDER_SETUP.md)
- Mobile APK path: [docs/MOBILE_APK_SHIPPING_CHECKLIST.md](./docs/MOBILE_APK_SHIPPING_CHECKLIST.md)
