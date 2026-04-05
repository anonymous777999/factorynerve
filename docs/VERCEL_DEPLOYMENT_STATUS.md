# Vercel Deployment Status

## What Was Verified

- Project type: Next.js app in `web/`
- Build command: `npm run build`
- Build status: passing locally
- Framework: `nextjs`
- Vercel CLI availability: available through `npm exec vercel`

## What Was Fixed

- Added Vercel-friendly backend rewrite support in:
  - [web/next.config.ts](d:/DPR%20APP/DPR.ai/web/next.config.ts)
- Added explicit Vercel project config in:
  - [web/vercel.json](d:/DPR%20APP/DPR.ai/web/vercel.json)

## Required Before Live Deploy

### 1. Vercel authentication

This shell is not logged in to Vercel yet.

`npm exec vercel -- whoami` timed out waiting for login.

### 2. Public backend URL

This app is not frontend-only.
The Next.js app proxies `/api/*` to a separate FastAPI backend.

That means Vercel needs:

- `API_PROXY_ORIGIN=https://your-public-backend-domain`

Example:

```env
API_PROXY_ORIGIN=https://api.factorynerve.online
NEXT_PUBLIC_API_BASE_URL=https://api.factorynerve.online
```

Browser users will still hit `/api`, and Vercel will rewrite those calls to the backend.

### 3. GitHub repo connection

Current workspace is not a Git repository, so GitHub connection cannot be completed from here yet.

## Exact Vercel Settings

- Framework preset: `Next.js`
- Root directory: `web`
- Install command: `npm install`
- Build command: `npm run build`

## Domain Goal

- production domain: `factorynerve.online`

## Next Execution Step

Once Vercel login exists and backend URL is ready:

```bash
cd web
npm exec vercel
npm exec vercel domains add factorynerve.online
```

Then add the DNS records Vercel gives you.
