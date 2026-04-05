# Mobile APK Shipping Checklist

## What Is Fixed In Code

- Camera permission policy now allows first-party camera access:
  - `backend/middleware/security.py`
- PWA manifest is upgraded with:
  - `id`
  - `scope`
  - `orientation`
  - `display_override`
  - `description`
  - `categories`
  - `shortcuts`
  - `web/public/manifest.json`
- Mobile-safe viewport and app metadata are improved:
  - `web/src/app/layout.tsx`
- File exports now use mobile-friendly share-or-download behavior instead of download-only browser logic:
  - `web/src/lib/blob-transfer.ts`
  - `web/src/lib/reports.ts`
  - `web/src/components/ocr-scan-page.tsx`
  - `web/src/components/jobs-drawer.tsx`
  - `web/src/components/entry-detail-page.tsx`
- Mobile browser QA now has a real Android-style project:
  - `web/playwright.config.ts`

## What Still Needs Real Deployment Work

These items cannot be fully solved by local code edits alone.

### 1. HTTPS Deployment

Required for:

- camera trust
- installability
- service worker in production
- secure auth cookies
- TWA packaging

Recommended:

- frontend on `https://app.yourdomain.com`
- backend on `https://api.yourdomain.com`
- or same-origin proxy setup behind one main HTTPS domain

### 2. Real Domain

Required for:

- Android TWA
- verified origin
- stable production auth cookies
- store-grade install flow

### 3. TWA Packaging

Recommended command path:

```bash
npm install -g @bubblewrap/cli
bubblewrap doctor
bubblewrap init --manifest https://your-domain.com/manifest.json
bubblewrap build
```

### 4. Android Signing

Needed for release APK/AAB:

- keystore
- package id
- signing config
- Play Store assets if publishing

### 5. Real Device QA

Minimum device pass:

- Android Chrome
- Android installed PWA
- Android TWA build

Critical routes:

- `/login`
- `/dashboard`
- `/attendance`
- `/work-queue`
- `/entry`
- `/ocr/scan`
- `/approvals`
- `/reports`
- `/steel/dispatches`

## Solo Developer Order

### Phase 1: Finish Mobile Web Hardening

- Run lint/build
- run Playwright smoke on desktop + android project
- manually test OCR camera
- manually test export/share on Android Chrome

### Phase 2: Deploy HTTPS

- deploy backend
- deploy frontend
- verify cookies and CSRF
- verify service worker registration

### Phase 3: Package Android

- generate TWA shell
- build signed APK
- smoke test on 1-2 real Android phones

## What To Skip For V1

- React Native rebuild
- iOS packaging
- push notifications
- full offline support for every module
- native chart rewrite

## Definition Of Done For First APK

- user can log in
- attendance works
- entry works
- OCR scan works with camera
- approvals load
- reports export/share works
- dispatch opens and is readable
- app installs on Android
- app survives refresh and relaunch
