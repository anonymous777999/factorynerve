This is the primary DPR.ai web client built with [Next.js](https://nextjs.org).
Streamlit has been retired and this app is the default frontend.

## Getting Started

First, run the development server in the `web` folder:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with your DPR.ai credentials.

For local full-stack development:

1. Start backend from repo root: `python run.py` (FastAPI only by default)
2. Start web app here: `npm run dev`

## Notes

- API base is proxied through `/api` in browser mode.
- Plan/quota errors return structured backend details and are surfaced directly in UI messages.
