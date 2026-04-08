# FactoryNerve PWA Build README

## Purpose

This document is the working plan for turning FactoryNerve into a strong mobile-first PWA that feels reliable enough to use like an app on real factory floors.

We should use this file as the follow-up source of truth while we build, test, ship, and refine the PWA experience.

## Product Decision

FactoryNerve should use a PWA-first strategy before any native app rebuild.

Why this is the right move:

- one codebase keeps product speed high
- installability is enough for early mobile adoption
- camera, home-screen launch, fullscreen mode, and offline shell support are already within reach
- it is much cheaper and faster than switching to React Native or Flutter right now
- it matches the current app architecture better than a full native rewrite

## What PWA Means For FactoryNerve

Our goal is not only "installable website".

The PWA should feel like:

- easy to launch from the home screen
- usable on weak networks
- safe for factory users on mobile
- fast to open for attendance, entry, OCR, and review work
- visually app-like instead of browser-heavy

## Current Repo Status

The repo already has a real starting base:

- manifest exists in `web/public/manifest.json`
- service worker exists in `web/public/sw.js`
- service worker registration exists in `web/src/components/service-worker.tsx`
- app metadata and viewport are wired in `web/src/app/layout.tsx`
- offline route already exists at `/offline`
- key mobile flows are already being improved:
  - `/dashboard`
  - `/attendance`
  - `/entry`
  - `/ocr/scan`

Current strengths:

- standalone manifest is already present
- same-origin `/api` proxy keeps auth and frontend simpler
- service worker already caches shell routes and static assets
- installability basics are already in place
- app update prompt now exists for newer production builds
- all priority routes have received a first mobile-hardening pass
- reconnect sync feedback now exists in-app
- weak-network state is now surfaced in the shared shell
- in-app PWA readiness diagnostics now exist on the profile screen
- in-app PWA QA checklist now exists on the profile screen
- installed mode now gets tighter shell chrome and standalone-safe scroll behavior
- branded PWA icons, maskable icons, and Apple touch icon now exist
- in-app readiness now exposes build and service worker cache version details
- in-app route coverage now tracks which priority routes were opened and in which mode
- in-app readiness now exposes current installability state for the active device session
- in-app readiness now exposes persistent queue and sync diagnostics for installed-mode QA
- installed launches now target `/dashboard` instead of dropping back on the marketing page

Current weaknesses:

- offline behavior is clearer now, but still not workflow-complete for every module
- login depends on a Render backend that can cold start
- installed-mode QA still needs real device verification
- service worker behavior still needs real deploy/update QA on devices
- route acceptance still needs to be executed on real devices, not only checked in code

## PWA Scope

### In Scope

- installable mobile web app
- home-screen launch
- fullscreen / standalone feel
- safe-area aware mobile shell
- offline shell and offline fallback
- better login resilience
- stronger mobile usability for daily factory routes
- route-by-route PWA QA
- Android-first install testing

### Out Of Scope For This Phase

- full native Android app rewrite
- iOS App Store packaging
- push notifications
- full offline support for every module
- background sync beyond what the browser safely supports today

## Priority Routes

These routes matter most for the PWA:

1. `/login`
2. `/dashboard`
3. `/attendance`
4. `/entry`
5. `/ocr/scan`
6. `/approvals`
7. `/work-queue`
8. `/reports`

These routes should feel reliable before we spend time polishing lower-value areas.

## Architecture Principles

### 1. Same-Origin App Experience

Keep the frontend on the main domain and continue using the `/api` proxy pattern so:

- cookies keep working cleanly
- CSRF stays consistent
- install flow stays simpler
- service worker scope remains predictable

### 2. PWA Should Enhance The Existing Web App

Do not fork a separate mobile codebase.

The PWA should build on:

- current Next.js app
- current manifest
- current service worker
- current offline entry queue logic
- current OCR / attendance / entry workflows

### 3. Mobile Reliability Over Feature Count

A smaller reliable PWA is better than a bigger fragile one.

### 4. Factory-First UX

The PWA should optimize for:

- one-thumb use
- low training
- weak network tolerance
- readable dark theme
- fast next action

## Phase Plan

## Phase 0: Baseline And Audit

Goal:

- confirm what already works
- identify what blocks installability and daily mobile use

Tasks:

- verify manifest, icons, and service worker registration in production
- confirm standalone launch behavior on Android Chrome
- verify `/offline` fallback behavior
- verify auth cookies still work in standalone mode
- verify service worker updates correctly after deploys
- capture route-by-route mobile issues for the priority routes

Definition of done:

- we know the exact current PWA behavior on real mobile devices
- we have a written route checklist with status

## Phase 1: Installable App Feel

Goal:

- make FactoryNerve feel like a real installable app

Tasks:

- add a user-facing install prompt or install helper UI
- add "Open in app" / "Install app" guidance on supported devices
- refine app icons if needed
- make app naming consistent as `FactoryNerve`
- make installed launches land on the first real work route
- verify splash, theme color, and standalone appearance
- confirm safe-area spacing on launch screens and main shell

Definition of done:

- users can understand how to install the app
- installed app opens cleanly from the home screen

## Phase 2: Login And Session Reliability

Goal:

- remove trust-breaking failures during sign-in

Tasks:

- keep the login warm-up + retry flow
- pre-warm Google sign-in before redirecting into OAuth
- retry session and workspace hydration after cold starts
- reduce Render cold-start pain as much as possible in the app
- move backend hosting to an always-on plan when possible
- verify Google login inside standalone mode
- verify logout, refresh, and account switching in standalone mode

Definition of done:

- login works reliably in browser and installed PWA
- users do not get random cold-start failures during first sign-in

## Phase 3: Offline-Safe Core Workflows

Goal:

- make the most important routes useful even on unstable networks

Tasks:

- define exact offline behavior for:
  - attendance
  - entry
  - OCR capture
  - work queue viewing
- confirm what can be queued locally
- confirm what must remain online-only
- improve offline copy so users know what is saved, queued, blocked, or synced
- make queue/sync state visible in the shell and key forms

Definition of done:

- users can still complete the highest-priority partial workflows when the connection drops
- queued work is clearly recoverable and understandable

### Current Offline Behavior Matrix

- `/attendance`
  - requires a live connection for punch in and punch out
  - offline mode should clearly pause punch actions instead of letting the user fail after a timeout
- `/entry`
  - drafts save locally in the browser
  - submit can queue locally and auto-sync later
  - queue state should stay visible from the shell and the entry page
- `/ocr/scan`
  - capture, crop, and enhancement can continue offline
  - AI extraction, saving the review draft, and Excel export require a live connection
- `/work-queue`, `/approvals`, `/reports`
  - these are live-data routes
  - when offline, they should explain that local draft and queued-entry state remain available, but remote counts and review data are paused

## Phase 4: Mobile UX Hardening

Goal:

- make the installed PWA feel purpose-built for phone use

Tasks:

- continue route-by-route mobile refinement for:
  - `/dashboard`
  - `/attendance`
  - `/entry`
  - `/ocr/scan`
  - `/approvals`
  - `/work-queue`
- remove unnecessary top-heavy layouts
- reduce hidden critical controls
- ensure action bars are safe-area aware
- ensure side summaries become mobile summaries or drawers
- ensure tables have mobile-friendly alternatives where necessary

Definition of done:

- all priority routes feel clean and usable at `360px`, `390px`, and `430px`

## Phase 5: Service Worker And Cache Strategy

Goal:

- make the PWA fast and predictable without serving stale broken data

Tasks:

- review current shell cache strategy in `web/public/sw.js`
- separate shell caching from route/document caching more clearly
- version cache names intentionally
- define which routes should be:
  - network first
  - stale while revalidate
  - shell fallback only
- avoid caching sensitive or misleading API state in the service worker
- verify update behavior after deploys

Definition of done:

- the app launches fast
- updates roll forward cleanly
- offline fallback is predictable

## Phase 6: Device QA And Launch Readiness

Goal:

- verify the PWA works on real devices before treating it as production-ready mobile software

Tasks:

- test on Android Chrome in browser mode
- test on Android installed home-screen mode
- test on at least one smaller Android phone
- use the in-app readiness card to confirm install mode, service worker control, pending sync state, and update readiness before route QA
- compare active vs waiting cache versions during service worker update QA
- use route coverage in the readiness card to confirm each priority route was actually opened during QA
- test login, attendance, entry, OCR, approvals, and reports
- test offline / reconnect behavior
- test service worker update after a deploy
- test Google login in installed mode

Definition of done:

- app is stable enough for real user adoption on Android

## Phase 7: Optional Android Packaging Later

Goal:

- package the existing PWA into a TWA or Android shell only after the PWA itself is already strong

Tasks:

- revisit `docs/MOBILE_APK_SHIPPING_CHECKLIST.md`
- package with Bubblewrap only after PWA acceptance passes
- keep Android packaging as a later wrapper, not the first solution

Definition of done:

- APK packaging does not hide unresolved PWA quality issues

## Current Working Backlog

### High Priority

- QA standalone auth on Android installed mode
- QA service worker update flow after production deploys
- verify slow-network and reconnect behavior on real phones
- move backend off Render free hibernation
- keep queue / sync visibility consistent across installed mode

### Medium Priority

- keep refining app branding if device installs still need stronger recognition
- more standalone-specific UI polish if device QA still reveals browser-like feel
- lower-priority route QA after core PWA checks

### Low Priority

- advanced install analytics
- TWA packaging
- deeper offline support for lower-frequency modules

## Definition Of Done For FactoryNerve PWA V1

FactoryNerve PWA V1 is done only when all of the following are true:

- app installs from Android Chrome
- app launches in standalone mode
- login works reliably
- Google sign-in works
- attendance works on phone
- entry works on phone
- OCR scan works across all four steps on phone
- approvals is readable and actionable on phone
- offline page and queue behavior are understandable
- app survives refresh, relaunch, and service worker update
- no critical horizontal overflow on priority routes

## Tracking Checklist

Use this section as the running status board. Update it as work ships.

### Foundation

- [x] Manifest exists
- [x] Service worker exists
- [x] Standalone metadata exists
- [x] Branded app icons exist
- [x] Maskable Android icons exist
- [x] Apple touch icon exists
- [x] Install prompt UI exists
- [x] PWA install guidance exists in-app
- [x] Installed launch defaults to `/dashboard`
- [x] Versioned cache strategy exists
- [x] Update-ready prompt exists
- [x] Standalone shell polish exists

### Reliability

- [x] Login wake-up retry exists
- [x] Google sign-in pre-warm exists
- [x] Session and workspace wake retry exists
- [x] Logout / switch-account wake retry exists
- [ ] Backend moved off Render free hibernation
- [ ] Standalone auth fully QA-tested

### Core Mobile Routes

- [x] `/dashboard` first mobile pass
- [x] `/attendance` first mobile pass
- [x] `/entry` first mobile pass
- [x] `/ocr/scan` first mobile pass across all steps
- [x] `/approvals` mobile hardening
- [x] `/work-queue` mobile hardening
- [x] `/reports` mobile hardening

### Offline

- [x] offline route exists
- [x] attendance offline behavior defined
- [x] entry offline behavior fully documented
- [x] OCR offline-safe behavior defined
- [x] queue and sync states made clearer in-app
- [x] queue and sync diagnostics persist in-app
- [x] reconnect sync feedback exists
- [x] weak-network state is surfaced in-app

### QA

- [x] in-app PWA readiness diagnostics exist
- [x] in-app install-state visibility exists
- [x] in-app PWA QA checklist exists
- [x] in-app update version visibility exists
- [x] in-app priority route coverage exists
- [ ] Android Chrome browser QA
- [ ] Android installed PWA QA
- [ ] service worker update QA
- [ ] slow network QA
- [ ] offline / reconnect QA

## Working Rules For This File

- update this file after every meaningful PWA step
- mark checklist items only after code is shipped or fully verified
- keep route notes grounded in the actual app, not generic mobile advice
- if a decision changes, update this file first so future work stays aligned

## Immediate Next Steps

1. QA standalone auth on Android home-screen mode, including Google login, logout, and switch account.
2. Use `Profile -> App readiness` to confirm install mode, update state, and queue state before each device QA pass.
3. QA service worker update behavior after a fresh production deploy.
4. Run slow-network and offline/reconnect checks on Android Chrome and installed PWA mode.
5. Move the backend to an always-on hosting tier when possible.
