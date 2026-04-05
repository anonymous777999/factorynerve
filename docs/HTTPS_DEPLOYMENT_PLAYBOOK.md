# HTTPS Deployment Playbook

## Recommended Architecture

Use one public HTTPS domain for the web app and keep the backend private on the same server.

Flow:

- public user -> `https://app.example.com`
- Caddy -> Next.js on `127.0.0.1:3000`
- Next.js rewrite -> FastAPI on `127.0.0.1:8765`

This is the cleanest setup for DPR.ai because:

- browser auth stays same-origin
- cookie auth stays simple
- CSRF stays predictable
- mobile PWA / TWA behaves better

## Files Added For Deployment

- production env template: [`.env.production.example`](d:/DPR%20APP/DPR.ai/.env.production.example)
- Caddy example: [`deploy/Caddyfile.example`](d:/DPR%20APP/DPR.ai/deploy/Caddyfile.example)
- backend service: [`deploy/systemd/dpr-backend.service.example`](d:/DPR%20APP/DPR.ai/deploy/systemd/dpr-backend.service.example)
- web service: [`deploy/systemd/dpr-web.service.example`](d:/DPR%20APP/DPR.ai/deploy/systemd/dpr-web.service.example)

## Important Production Truths

### 1. PostgreSQL is required

Production mode does not allow SQLite.

Code reference:

- [database.py](d:/DPR%20APP/DPR.ai/backend/database.py:24)

### 2. Backend auth should stay same-origin

The frontend browser side intentionally uses `/api` so cookies and CSRF stay same-origin.

Code references:

- [api.ts](d:/DPR%20APP/DPR.ai/web/src/lib/api.ts:3)
- [next.config.ts](d:/DPR%20APP/DPR.ai/web/next.config.ts:38)

### 3. Server-side frontend calls must know backend host/port

That is why production env should define:

- `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8765`
- `NEXT_PUBLIC_API_HOST=127.0.0.1`
- `NEXT_PUBLIC_API_PORT=8765`

## Server Setup Steps

### 1. Copy the repo

Example target:

```bash
sudo mkdir -p /opt/dpr-ai
sudo chown -R $USER:$USER /opt/dpr-ai
```

### 2. Install dependencies

Backend:

```bash
cd /opt/dpr-ai
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Frontend:

```bash
cd /opt/dpr-ai/web
npm install
npm run build
```

### 3. Create production env

```bash
cp /opt/dpr-ai/.env.production.example /opt/dpr-ai/.env
```

Then fill:

- domain
- PostgreSQL URL
- JWT secret
- encryption key
- SMTP values
- AI keys

### 4. Run database migrations / startup init

If you are using Alembic in your rollout:

```bash
cd /opt/dpr-ai
alembic upgrade head
```

If not, backend startup will still run DB initialization, but production should be treated carefully and verified first.

### 5. Install systemd services

Copy the example files and adjust:

- working directory
- Python path
- npm path
- user

Then:

```bash
sudo cp deploy/systemd/dpr-backend.service.example /etc/systemd/system/dpr-backend.service
sudo cp deploy/systemd/dpr-web.service.example /etc/systemd/system/dpr-web.service
sudo systemctl daemon-reload
sudo systemctl enable dpr-backend
sudo systemctl enable dpr-web
sudo systemctl start dpr-backend
sudo systemctl start dpr-web
```

### 6. Install Caddy

Use the example in:

- [`deploy/Caddyfile.example`](d:/DPR%20APP/DPR.ai/deploy/Caddyfile.example)

Then:

```bash
sudo cp deploy/Caddyfile.example /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

## Minimum Production Env Checklist

- `APP_ENV=production`
- `DATABASE_URL=postgresql+psycopg2://...`
- `JWT_COOKIE_SECURE=1`
- `FORCE_HTTPS=true`
- `TRUST_PROXY=true`
- `CORS_ALLOWED_ORIGINS=https://app.example.com`
- `WEB_APP_URL=https://app.example.com`
- `EMAIL_VERIFICATION_BASE_URL=https://app.example.com/verify-email?token=`
- `PASSWORD_RESET_BASE_URL=https://app.example.com/reset-password?token=`

## Smoke Test After Deployment

### Browser

- open `/login`
- register
- verify email
- login
- open `/dashboard`
- open `/ocr/scan`
- confirm camera prompt appears
- export one file

### Backend

- `GET /health`
- confirm logs contain no cookie / CSRF / HTTPS redirect loops

### Mobile

- open app in Android Chrome
- install PWA
- test login
- test OCR scan
- test export/share

## Best Next Step After HTTPS

After this deployment works, the next clean move is:

1. package Android with TWA / Bubblewrap
2. test on a real phone
3. then prepare store-quality assets
