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

## More context

See [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) for a detailed AI and engineer handoff guide.

## Deployment help

- HTTPS / production deployment: [docs/HTTPS_DEPLOYMENT_PLAYBOOK.md](./docs/HTTPS_DEPLOYMENT_PLAYBOOK.md)
- Mobile APK path: [docs/MOBILE_APK_SHIPPING_CHECKLIST.md](./docs/MOBILE_APK_SHIPPING_CHECKLIST.md)
