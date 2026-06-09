# Forgot Password — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification
# Route: /forgot-password
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/forgot-password` |
| Workspace Name | Password Recovery — Reset Link Request |
| Operational Role | Accepts a registered email address and dispatches a time-limited reset link, enabling a locked-out user to regain factory access without exposing account existence state. |
| Business Impact | If this workspace fails, any user who has lost their password is permanently locked out of their factory operational context with no self-service recovery path. Supervisor, manager, and owner lockouts block entire factory workflows. |
| User Population | Any registered user of any role who cannot remember their password. Accessed on-demand, infrequently, always under frustration pressure. |
| Peak Usage Context | On-demand — no shift pattern. Typically follows a failed login attempt, meaning the user arrives already frustrated and with time pressure. |
| Predecessor Workspaces | `/login` (user failed to sign in) or `/access` (hub redirect after failed auth) |
| Successor Workspaces | `/reset-password?token=...` (after clicking reset link in email) |

### 1.2 Operational Importance

The forgot-password workspace is the only self-service recovery path for locked-out users. Unlike registration (a once-per-lifetime event), password recovery can occur repeatedly — particularly for shared-device factory contexts where users may be logged out between shifts. A factory supervisor locked out at shift-start cannot approve entries, review attendance, or make dispatch decisions until access is restored. The workspace must complete the recovery intent in the fewest possible interactions, while communicating the privacy-safe response pattern clearly so users do not mistake the backend's deliberate ambiguity ("if an account exists...") for a failure.

### 1.3 Current State Failures

- `<label>` element uses `text-label-dense font-medium uppercase tracking-wide text-text-secondary` — `tracking-wide` is Tailwind's `tracking: 0.025em` which exceeds the 0.06em governance limit for non-uppercase and the uppercase limit combined with `uppercase`; label must use sentence case at `--type-label` (12px/500 weight) with no tracking modifier
- `<AuthShell>` is used as the workspace container instead of `<AuthWorkstationShell>` — `AuthShell` is a different, lighter wrapper that does not produce the full split-layout established by login and register skeletons; this breaks the spatial consistency law that all auth-shell pages share the same structural split
- The `<details>/<summary>` HTML disclosure primitive is used for the "Need help" collapsible section — this is an explicitly forbidden pattern per `FRONTEND_MODERNIZATION_EXECUTION_BLUEPRINT.md` Root Cause 4; no controlled state, no animation, browser-default rendering, and semantic confusion
- The `<summary>` inside the forbidden `<details>` uses `uppercase tracking-[0.22em]` — tracking at 3.7× the allowed maximum; must be eliminated along with the `<details>` element
- The success state uses `text-green-300` for the confirmation heading — raw Tailwind color class is forbidden; must use `--status-success-fg` semantic token
- The success state uses `text-[var(--text)]/90` — raw CSS variable with opacity modifier is forbidden; must use `text-text-secondary` token class
- `<Link>` elements use `text-[var(--accent)]` raw token reference instead of `text-action-primary` token class — appears in two locations (back-to-sign-in and "Remembered it?" footer link)
- The "Remembered it?" footer text uses `text-[var(--muted)]` — forbidden raw alias; must use `text-text-secondary`
- The preview-mode link ("Open Reset Form") uses `rounded-control border-[0.5px] border-border-focus bg-surface-selected` with no token class mapping — the border shorthand `border-[0.5px]` is arbitrary, but more critically the link is styled as a Button-like element without using the Button primitive; must use a proper Button or Link component
- `copyStatus` feedback text uses `text-[var(--muted)]` — forbidden alias
- `response.reset_link` URL text uses `text-[var(--muted)]` — forbidden alias
- The success state panel mixes success-tone and default-surface containers within the same visual block without clear structural hierarchy — the "Next: check the inbox..." instruction box and the help `<details>` element are both `bg-surface-shell` but serve different semantic purposes with no clear visual differentiation
- The "Resend verify" button in the success state creates confusion — this button resends the EMAIL VERIFICATION for the original signup, not the password reset link; its label does not make this distinction clear; a user who already completed email verification and is trying to reset a password has no use for this button and no explanation of why it is here
- No `autoFocus` on the email input — the user must click to begin typing on page load
- The `AuthShell` left panel does not show a 3-step recovery workflow that matches the operation; it shows generic content via `steps` prop that uses i18n keys — the content exists but the structural mismatch between `AuthShell` and `AuthWorkstationShell` means the left panel layout is inconsistent with login and register
- The form has no `isBusy` loading state label — the Button uses `isBusy={loading}` but the `busyLabel` prop is set to a string that may or may not be translated correctly; this is inconsistent with the register skeleton's pattern

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Auth / Onboarding | Outside the app shell; no sidebar, no topbar; pre-operational entry gate |
| Workflow Category | Entry | Single sequential action: enter email → submit → receive confirmation → exit to email client |
| Operational Behavior | Form-Driven | One-field form; two exclusive phases (request phase vs. confirmation phase) |
| Data Density | LOW | One input field, one submit button, and a confirmation state; the simplest workspace in Phase A |
| Realtime Complexity | NONE | No polling, no subscriptions; single async POST; resend verification is secondary async |
| AI Complexity | NONE | No AI systems |
| Audit Complexity | LOW | Backend writes `PASSWORD_RESET_REQUESTED` to AuditLog — not surfaced in frontend UI |
| Decision Pressure | LOW | One field, one action; but the emotional pressure is HIGH — user is locked out and frustrated |

**Classification Implication:**
A LOW-density, NONE-realtime, Form-Driven Auth workspace with a single input field means the form structure is trivially simple but the communication design is what matters. The backend is deliberately privacy-safe: it always returns the same message regardless of whether the email exists. This creates a frontend challenge: the operator must understand the confirmation is not a guarantee of delivery. The two-phase behavior (request → confirmation) is structurally identical to the registration workspace's form-to-success transition and must use the same exclusive-state pattern. The workspace must match the `AuthWorkstationShell` split-layout established by login and register — spatial consistency is law. The current use of `AuthShell` instead of `AuthWorkstationShell` is the primary structural violation that must be corrected.

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Permission | Key Response Fields | Error States |
|---|---|---|---|---|---|
| `POST /auth/password/forgot` | POST | Accepts email; if user exists and is active, creates a `PasswordResetToken` record and attempts to send a reset email; always returns the same privacy-safe message regardless of whether the email exists | Public | `message`, `reset_link` (preview mode only), `delivery_mode: "email" \| "preview"` | None surfaced to caller — endpoint always returns HTTP 200 with the same message; no 4xx errors exposed |
| `GET /auth/password/reset/validate?token=` | GET | Validates a reset token exists and has not expired — used by the `/reset-password` page, not by forgot-password | Public | `valid: bool`, `message` | Not used on this page |
| `GET /observability/ready` | GET | Backend warm-up check on page mount | Public | HTTP 200 or 503 | Not surfaced in UI |

**Critical backend behavior the UI must model correctly:**

1. **Privacy-safe response**: `POST /auth/password/forgot` always returns HTTP 200 with `message: "If an account exists for this email, you will receive a reset link."` — regardless of whether the email is registered, verified, or active. This is intentional security design. The UI must NOT try to infer success from the message text.

2. **Token TTL**: `PASSWORD_RESET_TTL_MINUTES` defaults to 30 minutes. The success state must communicate the time-limited nature of the link clearly.

3. **Active-only users**: `db.query(User).filter(User.email == email, User.is_active.is_(True))` — only active users receive a reset link. Inactive users receive the same privacy-safe response but no email is sent. The UI cannot know which case occurred.

4. **Unverified users**: A user with a pending `PendingRegistration` who has not completed email verification does NOT have a real `User` record yet — `POST /auth/password/forgot` will not find them and will silently return the privacy-safe message. The success state must communicate this case: "If you recently signed up but haven't verified your email yet, your account is not yet active — complete email verification first."

5. **delivery_mode**: `"email"` in production (link sent to inbox), `"preview"` in local dev environments (link returned in response body). The success state must handle both.

6. **No rate-limiting errors exposed**: The endpoint does not return 429 rate-limit errors to the caller (silently handled server-side). The UI does not need to handle rate-limit states.

### 3.2 Entity Relationship Map

```
PasswordResetToken (token_hash, user_id, expires_at, used_at)
    │
    └── User (id, email, is_active=True)
          └── UserFactoryRole (factory_id, role)
                └── Factory (factory_id)
```

**Primary entity on this workspace:** `PasswordResetToken` (created by this endpoint)
**Relationship implication for UI:** The UI only needs to capture an email address. The entity graph is entirely managed by the backend. The frontend's job is: collect email, submit, confirm receipt, guide to inbox.

### 3.3 Workflow State Machine

```
[REQUEST PHASE]
    → user enters email address
    → [SUBMITTING] (button loading state, form disabled)
        → HTTP 200 (always — delivery_mode: "email")
              → [CONFIRMATION PHASE — EMAIL SENT]
        → HTTP 200 (always — delivery_mode: "preview")
              → [CONFIRMATION PHASE — PREVIEW LINK]
        → Network error / timeout
              → [ERROR STATE] inline error message, form re-enabled

[CONFIRMATION PHASE]
    → user reads confirmation instructions
    → user may click "Back to sign in" link (→ /access)
    → [optional] user clicks "Resend verify" → fires POST /auth/email/verification/resend
          → [RESEND LOADING]
          → [RESEND STATUS] message appears below resend button
    → user navigates to email client externally (no frontend action)
    → [out of scope] user clicks reset link in email → /reset-password?token=...
```

**Frontend implication:**
- Request phase and confirmation phase are mutually exclusive within the same page mount — form is hidden when confirmation is shown
- The confirmation phase has NO back-to-request-form action — the user must reload the page if they want to try a different email
- The "Resend verify" button on the confirmation phase is contextually confusing and must be restructured: it sends an EMAIL VERIFICATION resend (for accounts that haven't completed signup), not a password reset resend. This distinction must be clearly labeled or the button must be removed from primary visibility (relegated to an "if your email hasn't verified yet" contextual notice only)

### 3.4 Realtime Contracts

None. No polling, no subscriptions. Backend warm-up check is fire-and-forget on mount.

### 3.5 AI System Contracts

Not applicable. No AI systems involved in the password recovery workflow.

### 3.6 Permission Matrix

| Role | View | Submit | Secondary actions |
|---|---|---|---|
| Anonymous (unauthenticated) | ✓ | ✓ | Resend verification (secondary) |
| Any authenticated role | N/A — redirected away by AppShell guard | — | — |

**Permission implication:** This workspace is entirely public. No role-based zone visibility changes are needed. Any authenticated user who lands here is redirected by the app guard to their home destination.

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

```
SPLIT AUTH LAYOUT: Left context panel (desktop only) + Right form panel (always visible)
```

**Identical structural pattern to `/login` and `/register`.** Left panel: 45% width on desktop (≥1024px), hidden on mobile. Right panel: 55% width on desktop, 100% on mobile.

**Pattern selection justification:** Constitutional law — all auth-shell pages share the `AuthWorkstationShell` split layout for zero spatial reorientation between auth pages. A user who failed to log in, landed on `/access`, and was redirected to `/forgot-password` must experience zero layout surprise. The current use of `AuthShell` (a lighter, non-split wrapper) is a structural violation that must be corrected. The left panel carries recovery workflow context (3 steps) and a security posture signal — these reduce anxiety for a user who is locked out and under pressure.

**Structural reduction note:** A single-column centered form was considered and rejected. Although the workspace has only one input field, the left panel provides operational value disproportionate to its area: it explains that the privacy-safe response is intentional (preventing "is my email wrong?" confusion), sets the expectation of a 30-minute TTL, and provides the sign-in escape hatch prominently. On mobile the panel is hidden and reduction is applied automatically.

---

### 4.2 Zone Definitions

---

#### ZONE: Auth Topbar

| Property | Value |
|---|---|
| Operational Role | Brand anchor and cross-navigation; provides platform identity and the sign-in escape hatch |
| Attention Priority | 5 (lowest — background orientation only) |
| Position | top, spans full width |
| Width | fluid: 100% |
| Height | fixed: 56px |
| Sticky Behavior | not sticky — no scrolling on this page |
| Collapse Behavior | never collapses |
| Scroll Behavior | no scroll |
| Density Mode | default (no density switching on auth pages) |
| Existence Justification | Established pattern from login and register skeletons; brand anchor and navigation continuity |

**Contents:**
- Logo/brand link (`Building2` icon + "DPR.ai" label): links to `/`
- Industry label (right side): `text-text-secondary`, sentence case, `--type-label` (12px/500)
- Platform label (right side): `text-action-primary` token class — "Factory OS", `--type-label`

**Acceptance Criteria:**
- [ ] Topbar renders at exactly 56px height, consistent with login and register skeletons
- [ ] Logo link navigates to `/`
- [ ] Industry and platform labels use `--type-label` (12px, 500 weight), sentence case — NOT `uppercase tracking-[0.24em]` as currently in AuthWorkstationShell (this is itself a violation that must be fixed on AuthWorkstationShell)
- [ ] Platform label uses `text-action-primary` class
- [ ] No gradient, border-bottom, or shadow on topbar

---

#### ZONE: Left Context Panel

| Property | Value |
|---|---|
| Operational Role | Provides password recovery workflow context, privacy-safe design explanation, and security posture signal; reduces anxiety and prevents user confusion about the deliberate ambiguity of the backend response |
| Attention Priority | 4 |
| Position | left |
| Width | fixed: 45% on desktop (≥1024px); hidden: 0% on mobile/tablet (<1024px) |
| Height | fill-remaining (100vh minus topbar 56px) |
| Sticky Behavior | not sticky |
| Collapse Behavior | hidden entirely at <1024px |
| Scroll Behavior | independent scroll if content overflows on short viewports; otherwise no scroll |
| Density Mode | default |
| Existence Justification | AuthWorkstationShell left panel — established pattern from login/register; recovery workflow steps + privacy context reduce user confusion about the privacy-safe backend response |

**Contents:**
- Eyebrow label: "Account recovery" — `--type-label` (12px, 500 weight), sentence case, `text-text-tertiary`; NOT uppercase tracking
- Page title: "Recover factory access" — `--type-page-title` (18px, 600 weight), sentence case; NOT marketing scale `clamp()` sizing (AuthWorkstationShell's current `text-[clamp(3rem,3.9vw,4.5rem)]` is a violation to fix on the shell component)
- Description: `--type-body` (14px, 400 weight), `text-text-secondary` — one sentence explaining the recovery intent
- Recovery workflow steps card: 3 numbered steps (01, 02, 03). Step 1: "Submit your account email". Step 2: "Open the newest reset link (valid 30 minutes)". Step 3: "Set a new password and sign in". Uses `--type-body` (14px, 400 weight). Step labels in sentence case.
- Privacy posture card: `ShieldCheck` icon + "Privacy-safe by design" title + explanation: "This page never confirms whether an email is registered. The same response is always shown." Uses `--type-body` (14px). `surface-panel` background.

**Acceptance Criteria:**
- [ ] Left panel is invisible (display: none or width: 0) at viewport width below 1024px
- [ ] Page title renders at 18px (`--type-page-title`) — NOT `clamp(3rem,3.9vw,4.5rem)`
- [ ] All labels use sentence case — NO uppercase tracking anywhere in this zone
- [ ] Eyebrow uses `--type-label` (12px, 500 weight), `text-text-tertiary`
- [ ] Recovery steps are numbered 01–03, sentence case, `--type-body` (14px, 400 weight)
- [ ] Step 2 explicitly states "valid 30 minutes" (from `PASSWORD_RESET_TTL_MINUTES`)
- [ ] Privacy posture card is present and explains the privacy-safe design in plain language
- [ ] No gradient on any element in this zone
- [ ] No interactive elements in this zone

---

#### ZONE: Right Form Panel

| Property | Value |
|---|---|
| Operational Role | Primary operational surface. Phase 1: contains the email input form. Phase 2: contains the confirmation state. Mutually exclusive — only one is visible at a time. |
| Attention Priority | 1 (highest) |
| Position | right (center on mobile) |
| Width | fluid: 55% desktop; 100% mobile; inner panel has `max-width: 480px` centered within column (narrower than register at 520px — single field needs less horizontal space) |
| Height | fill-remaining; inner panel vertically centered; content fits without scroll on standard viewports |
| Sticky Behavior | not sticky |
| Collapse Behavior | never collapses |
| Scroll Behavior | scroll when viewport height <600px; otherwise no scroll |
| Density Mode | default |
| Existence Justification | Primary interaction surface — the form and confirmation state are the reason this workspace exists |

**Contents — Phase 1 (request phase):**
- Panel header:
  - Badge chip: "Password recovery" — `--type-label` (12px, 500 weight), sentence case, `surface-shell` background; NOT `uppercase tracking-[0.24em]` (current AuthWorkstationShell badge is a violation)
  - Panel title: "Forgot password" — `--type-panel-title` (16px, 600 weight), sentence case; NOT `text-[2rem]` (current AuthWorkstationShell renders `h2` at `text-[2rem]` — violation)
  - Panel description: `--type-body` (14px, 400 weight), `text-text-secondary`, sentence case
- Email form:
  - `Field` component wrapping `Label` + `Input`:
    - `Label`: "Work email" — `--type-label` (12px, 500 weight), sentence case; NOT `uppercase tracking-wide`
    - `Input`: `type="email"`, `autoComplete="email"`, `inputMode="email"`, `autoFocus`, `required`, `min-height: 40px`
    - No helper text needed (single field, obvious purpose)
  - Error zone: `surface-danger-bg` + `border-danger` + `text-status-danger-fg` — renders when network error occurs; hidden when no error; uses `--type-body` (13px/400)
  - Submit button: full width, `h-[42px]`, "Send reset link" label; `isBusy` state shows "Sending..." — `busyLabel` prop; variant: primary
- Footer:
  - "Remembered it?" + "Sign in →" link — `--type-body` (14px, 400 weight), `text-text-secondary`; link uses `text-action-primary` token class; sentence case; NOT `text-[var(--accent)]`

**Contents — Phase 2 (confirmation phase):**
- Panel header:
  - Badge chip: "Check your inbox" (email mode) / "Reset link ready" (preview mode) — `--type-label` (12px, 500 weight), sentence case
  - Panel title: same text as badge — `--type-panel-title` (16px, 600 weight), sentence case
  - Panel description: "We've prepared a recovery path for this email address." — `--type-body` (14px, 400 weight)
- Confirmation status panel: `surface-success-bg` + `border-success` + `text-status-success-fg` semantic tokens:
  - Status message text: the `response.message` value ("If an account exists for this email, you will receive a reset link.") — `--type-body` (14px, 400 weight); NOT colored with `text-green-300` raw class
  - Email address chip: shows the submitted email address — `--type-body` (14px, 600 weight), `text-text-primary`; NOT `text-[var(--text)]/90`
- TTL notice panel: `surface-shell` background + `border-default`:
  - "Check inbox, spam, and promotions for the reset email. Links are valid for 30 minutes — use the newest one if you requested multiple."
  - `--type-body` (13px, 400 weight), `text-text-secondary`
- Unverified-account notice: `surface-warning-bg` + `border-warning`:
  - "If you recently registered but haven't verified your email yet, your account is not active — no reset link will arrive. Complete email verification first."
  - `--type-body` (13px, 400 weight), `text-status-warning-fg`
  - This replaces the hidden `<details>/<summary>` help pattern — it is ALWAYS visible in confirmation phase (not collapsible) because this is the most common source of confusion
- Preview link panel (conditional — only when `response.reset_link` is non-null):
  - Eyebrow: "Preview mode — reset link" — `--type-label` (12px, 500 weight), sentence case, `text-text-tertiary`; NOT uppercase
  - Link button: `Button variant="outline"` or `<Link>` as button — "Open reset form →"; navigates to `response.reset_link`
  - Copy link button: `Button variant="ghost"` — "Copy link"; `copyStatus` message below
  - URL display: `text-text-tertiary`, `--type-label` (12px), `break-all`
  - Container: `surface-selected` + `border-focus`
- Action row:
  - "Back to sign in" link: `text-action-primary` token class — routes to `/access`; NOT `text-[var(--accent)] underline`
- Resend verification section (contextual — collapsed by default, expandable):
  - Trigger link: "Didn't get a verification email from your original signup?" — `--type-body` (13px/400/`text-text-tertiary`)
  - When expanded: shows "Resend verification email" button (`Button variant="outline"`) + `resendingVerification` loading state + `verificationStatus` feedback message
  - Container uses `surface-shell` background after expansion
  - Rationale: This action is for a different flow (email verification, not password reset) and must be clearly labeled and non-prominent; it should not appear as a primary action in the confirmation panel

**Acceptance Criteria — Phase 1:**
- [ ] Panel badge chip renders at 12px, 500 weight, sentence case — NOT `uppercase tracking-[0.24em]`
- [ ] Panel title renders at 16px (`--type-panel-title`) — NOT `text-[2rem]` arbitrary sizing
- [ ] Field label uses sentence case, `--type-label` (12px, 500 weight) — NOT `uppercase tracking-wide`
- [ ] Email input has `autoFocus` on page mount
- [ ] Email input has `type="email"`, `autoComplete="email"`, `inputMode="email"`
- [ ] Submit button has `isBusy` loading state with `busyLabel="Sending..."` and spinner; disabled during loading
- [ ] Error zone uses `--status-danger-bg/fg/border` semantic token classes — NOT raw hex or rgba
- [ ] Footer sign-in link uses `text-action-primary` class — NOT `text-[var(--accent)]`
- [ ] Footer text and link use sentence case — NOT `text-[var(--muted)]`
- [ ] Phase 1 and Phase 2 are mutually exclusive — form NOT shown when confirmation is shown

**Acceptance Criteria — Phase 2:**
- [ ] Confirmation status uses `--status-success-bg/border/fg` semantic tokens — NOT `text-green-300`
- [ ] Email address in confirmation uses `text-text-primary` — NOT `text-[var(--text)]/90`
- [ ] All panel text uses sentence case — NO uppercase anywhere
- [ ] `<details>/<summary>` pattern does NOT exist in this workspace — replaced by always-visible unverified-account notice
- [ ] Unverified-account notice uses `--status-warning-bg/border/fg` semantic tokens
- [ ] Preview link panel appears ONLY when `response.reset_link` is non-null
- [ ] Preview link eyebrow uses sentence case `--type-label` — NOT uppercase tracking
- [ ] Copy link button provides immediate `isBusy` feedback on click
- [ ] "Back to sign in" link uses `text-action-primary` — NOT `text-[var(--accent)] underline`
- [ ] Resend verification section is labeled clearly as "original signup email verification" — NOT as a password reset resend

### 4.3 Zone Interaction Rules

```yaml
zone_interactions:
  - trigger: response !== null (form submitted successfully — HTTP 200)
    effect: Right Form Panel → switches from request phase to confirmation phase;
      Left Context Panel → content unchanged (no phase-state update needed — recovery steps
      remain relevant throughout)
    reason: two-phase state machine — request and confirmation are mutually exclusive; unlike
      register, the left panel does not need to update because recovery steps do not change
      meaning after submission

  - trigger: delivery_mode === "email" (standard production mode)
    effect: Right Form Panel confirmation → shows status panel + TTL notice + unverified-account
      notice + back-to-sign-in link; preview link panel is hidden
    reason: user must go to their email client; the interface's job is to confirm dispatch
      and set correct expectations about TTL and inbox search

  - trigger: delivery_mode === "preview" (local/staging dev mode)
    effect: Right Form Panel confirmation → shows preview link panel with clickable reset link
      and copy button in addition to standard confirmation elements
    reason: developer preview environment needs direct link access without email

  - trigger: response.reset_link is non-null
    effect: Right Form Panel confirmation → preview link panel becomes visible
    reason: reset_link is only returned when delivery_mode === "preview"

  - trigger: network error (timeout / fetch failure)
    effect: Right Form Panel → error zone appears above submit button with error message text;
      form re-enabled; submit button isBusy state cleared
    reason: backend is occasionally waking from sleep state; user must be able to retry

  - trigger: "Didn't get a verification email?" link clicked (confirmation phase)
    effect: Right Form Panel → resend verification section expands inline; shows resend button
    reason: the resend-verification flow (for original signup) is secondary and must not
      occupy space until explicitly requested

  - trigger: "Resend verification email" button clicked (expanded section)
    effect: Button enters isBusy state; POST /auth/email/verification/resend fires;
      verificationStatus message appears below button on completion
    reason: provides feedback for a secondary async action without page navigation

  - trigger: viewport width < 1024px
    effect: Left Context Panel → hidden entirely; Right Form Panel → 100% width, centered
    reason: mobile users need the form only; context panel is desktop-exclusive
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

### 5.1 Scan Flow

```
SCAN LEVEL 1 (0–200ms): Email input field (autoFocus)
─────────────────────────────────────────────────────
  WHY FIRST: The cursor is already here on page load. The operator arrived from
  a failed login — their email is mentally loaded. autoFocus means the first
  keystroke goes directly into the field without a click.

  The field label "Work email" at 12px/500 weight is immediately above the input.
  The panel title "Forgot password" and badge "Password recovery" are read
  peripherally — the operator already knows why they're here.

SCAN LEVEL 2 (200ms–800ms): Submit button
───────────────────────────────────────────
  WHY SECOND: One-field form. After typing the email, the eye drops directly to
  the submit button at the bottom of the form. No other form elements compete.
  The button is full-width — impossible to miss.

SCAN LEVEL 3 (800ms–2s): Error zone (if present) / Footer sign-in link
────────────────────────────────────────────────────────────────────────
  WHY THIRD: Error zone appears above the submit button if a prior submit failed.
  The operator's eye intercepts the error before attempting to submit again.
  The footer "Remembered it? Sign in →" is the escape hatch for users who
  recalled their password mid-flow.

SCAN LEVEL 4 (2s+): Left panel (recovery steps, privacy notice)
────────────────────────────────────────────────────────────────
  WHY LAST: Left panel content is contextual scaffolding. An operator who is
  already typing their email does not need to read the steps. The steps become
  relevant only for operators who pause and ask "what happens next?" or
  "why does this page always show the same message?"
```

### 5.2 Persistent Visibility Requirements

| Element | Reason It Must Persist |
|---|---|
| Submit button (Phase 1) | Final action — must be reachable without scroll; one-field form should never require scroll to reach submit |
| Error zone (Phase 1, when non-null) | Must intercept the eye before the operator retries a failed submission |
| Back to sign in link (Phase 2) | Primary exit action — operator who has submitted and needs to get back to login must find this immediately |

### 5.3 Contextual Visibility Rules

```yaml
contextual_rules:
  - condition: response === null (request phase)
    shows: Email form (field + button + footer)
    hides: Confirmation phase (all confirmation elements)
    reason: form and confirmation are mutually exclusive

  - condition: response !== null (confirmation phase)
    shows: Confirmation status panel + TTL notice + unverified-account notice + back link
    hides: Email form entirely
    reason: form is no longer actionable after submission

  - condition: delivery_mode === "preview" AND response.reset_link !== null
    shows: Preview link panel with clickable link + copy button
    hides: nothing (additive)
    reason: preview mode only — link is not available in production

  - condition: error !== null AND response === null
    shows: Error zone above submit button
    hides: nothing (additive)
    reason: inline error requires no navigation

  - condition: resend verification section — user clicks disclosure trigger
    shows: Resend button + verificationStatus feedback
    hides: nothing (additive — section expands)
    reason: secondary action; kept out of primary scan path until requested

  - condition: viewport width < 1024px
    shows: Right Form Panel at 100% width
    hides: Left Context Panel entirely
    reason: mobile form-completion priority
```

---

## 6. TABLE & DATA STRATEGY

No tables — workspace is form-driven (single-field request form).

---

## 7. FORM & INPUT STRATEGY

### 7.1 Form Role

| Field | Value |
|---|---|
| Form Purpose | Captures the registered email address of the locked-out user and submits it to `POST /auth/password/forgot` to trigger the reset link generation and dispatch |
| Completion Frequency | On-demand, low frequency per user lifetime |
| Keyboard Efficiency Priority | HIGH — user arrives frustrated, often in a hurry; the entire form should be completable with a single Tab + Enter sequence |
| AI Assistance Available | No |
| Estimated Completion Time | 5–10 seconds (type email → Enter) |

### 7.2 Field Group Architecture

```yaml
field_groups:
  - group: Recovery
    operational_purpose: Identify the registered account to initiate password reset
    fields:
      - name: email
        label: "Work email"
        type: email
        required: yes
        validation: valid email format (browser native type=email + required)
        ai_assisted: no
        tab_order: 1
        default_value: none
        help_text: none (single obvious field needs no help text)
        error_message: "Enter a valid email address."
        attributes:
          autoFocus: yes
          autoComplete: email
          inputMode: email
          placeholder: "ops.admin@factory.com"
          minHeight: 40px
```

### 7.3 Validation Strategy

```yaml
validation:
  realtime: []
  on_blur: []
  on_submit:
    - email: required; valid email format (browser native `type="email"` + `required` attribute)
  server_side:
    - HTTP 200 always: no server-side validation errors are exposed by design
      (privacy-safe: endpoint never reveals whether email exists)
    - Network errors (timeout / fetch failure): surfaced in error zone with generic message
  ai_flagged: []
```

### 7.4 Keyboard Flow

```
Tab Order: [email input] → [Submit button] → [Footer sign-in link]

Shortcuts:
  - Enter in email field: submits form (single-field form; Enter is equivalent to submit)
  - Enter in submit button: submits form
  - Tab from submit button: moves to footer sign-in link
  - Escape: no action defined (auth pages have no navigation state to escape)

autoFocus: email input receives focus on page mount — no click required
```

---

## 8. AI & AUDIT VISIBILITY STRATEGY

### 8.1 AI Placement Map

Not applicable — no AI systems involved in the password recovery workflow.

### 8.2 Audit Visibility Map

```yaml
audit:
  timeline_placement: not displayed in frontend UI
  events_logged_backend:
    - PASSWORD_RESET_REQUESTED: written when user exists and token is created + email attempted
  who_can_see: admin/owner via premium audit trail only (separate page, not this workspace)
  realtime_updates: n/a
  notes: >
    The audit event is written only when a real User record is found. For non-existent
    emails, no audit event is written. This asymmetry is backend-only and must NOT
    be surfaced in the frontend (would break privacy-safe design).
```

### 8.3 Anomaly Visibility

Not applicable — no anomaly system on this workspace.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

### 9.1 Density Mode

```yaml
default_density: default
density_justification: Auth pages are deliberate, single-interaction surfaces. Default density
  (40px input height, 16px field gap) provides comfortable, error-resistant targets.
  A single-field form does not benefit from compact density — reduction beyond default
  would make the form feel dismissive for a high-stakes locked-out interaction.
density_switchable: no — auth pages do not expose the density toggle
density_specs:
  input_height: 40px minimum (44px on mobile for touch target compliance)
  button_height: 42px (consistent with login and register)
  form_field_gap: 16px (--space-md) between field and button
```

### 9.2 Spacing Rhythm

```yaml
spacing:
  panel_outer_padding: 32px (--space-8) horizontal, 32px vertical
    (slightly more vertical than register because fewer fields means more breathing room
    is appropriate — panel feels purposeful, not cramped)
  panel_inner_gap: 20px (--space-5) between panel header and form body
  field_to_button_gap: 16px (--space-md)
  error_zone_margin: 0px top / 16px bottom (sits between field and button)
  footer_margin_top: 16px (--space-md) above footer divider
  confirmation_section_gap: 16px (--space-md) between confirmation elements
  confirmation_notice_padding: 12px (--space-3) inner padding on notice panels
  topbar_height: 56px — identical to login and register skeletons
  left_panel_padding: 40px horizontal, 40px vertical on desktop
  preview_link_panel_padding: 16px (--space-md)
```

### 9.3 Typography Specification

```yaml
typography:
  topbar_brand_label: 16px / 600 weight / sentence case / tracking: -0.01em
  topbar_meta_labels: 12px / 500 weight / sentence case / tracking: 0em
  left_eyebrow: 12px / 500 weight / sentence case / text-text-tertiary / tracking: 0em
  left_title: 18px / 600 weight / sentence case / tracking: -0.01em
  left_description: 14px / 400 weight / text-text-secondary
  left_step_labels: 14px / 500 weight / sentence case
  left_step_descriptions: 13px / 400 weight / text-text-secondary
  left_privacy_notice: 13px / 400 weight / text-text-secondary
  panel_badge: 12px / 500 weight / sentence case / tracking: 0em
  panel_title: 16px / 600 weight / sentence case
  panel_description: 14px / 400 weight / text-text-secondary
  field_label: 12px / 500 weight / sentence case — (--type-label) — NOT uppercase tracking
  input_text: 14px / 400 weight
  submit_button: 14px / 500 weight / sentence case
  error_message: 13px / 400 weight / text-status-danger-fg
  confirmation_status_title: 16px / 600 weight / sentence case
  confirmation_status_body: 14px / 400 weight / text-text-secondary
  email_address_chip: 14px / 600 weight / text-text-primary
  ttl_notice: 13px / 400 weight / text-text-secondary
  unverified_notice: 13px / 400 weight / text-status-warning-fg
  preview_eyebrow: 12px / 500 weight / sentence case / text-text-tertiary
  preview_link_url: 12px / 400 weight / text-text-tertiary / break-all
  copy_status: 12px / 400 weight / text-text-secondary
  resend_disclosure: 13px / 400 weight / text-text-tertiary
  footer_label: 14px / 400 weight / text-text-secondary / sentence case
  footer_link: 14px / 400 weight / text-action-primary / sentence case
```

### 9.4 Surface Token Hierarchy

```yaml
surfaces:
  workspace_background: var(--surface-app)
  auth_shell: var(--surface-shell)
  left_panel: var(--surface-panel)
  right_panel_bg: var(--surface-app)
  form_panel_inner: var(--surface-card)
  input_surface: var(--surface-elevated)
  error_zone: var(--status-danger-bg) with var(--status-danger-border) border
  confirmation_panel: var(--status-success-bg) with var(--status-success-border) border
  ttl_notice: var(--surface-shell) with var(--border-default) border
  unverified_notice: var(--status-warning-bg) with var(--status-warning-border) border
  preview_link_panel: var(--surface-selected) with var(--border-focus) border
  resend_section: var(--surface-shell) with var(--border-default) border
```

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

### 10.1 Desktop Workstation (Primary Target)

```yaml
desktop_workstation:
  min_width: 1280px
  optimal_width: 1440px
  all_zones_visible: yes (left panel + right form panel)
  density_mode: default
  form_inner_max_width: 480px (centered in 55% right column)
  notes: >
    Single-field form; 480px max-width is sufficient. Register uses 520px for 8 fields.
    Reduction to 480px prevents the form from feeling under-designed.
```

### 10.2 Compact Desktop (Secondary)

```yaml
compact_desktop:
  width_range: 1024px–1279px
  density_mode: default
  adaptations:
    - left_panel: inner padding reduces to 24px horizontal; stays visible
    - right_panel: inner max-width stays at 480px
    - form field gap and confirmation section gap unchanged
  degraded_functionality: no — all actions remain available
```

### 10.3 Mobile / Tablet (Degraded Mode)

```yaml
mobile:
  width_range: <768px
  strategy: stacked — left panel hidden, right form panel fills full width
  operational_continuity: full — email form and confirmation state both work on mobile
  zones_hidden: [Left Context Panel]
  touch_targets: 44px minimum for all interactive elements
  touch_adjustments:
    - input_height: 44px minimum (up from 40px desktop) for safe touch target
    - submit_button_height: 48px (full-width, comfortable tap target)
    - footer_link_min_height: 44px touch target area
```

### 10.4 Rail Collapse Behavior

```yaml
rail_collapse:
  left_rail:
    collapse_trigger: viewport width < 1024px
    collapsed_state: hidden (display: none, width: 0)
    reinvoke_method: not applicable — panel is context-only, not interactive
  right_rail:
    not_applicable: forgot-password workspace has no right rail
```

---

## 11. COMPONENT MAPPING

```yaml
component_mapping:
  workspace_container:
    component: AuthWorkstationShell
    reason: All auth-shell pages use this container. Established in login and register skeletons.
      Current use of AuthShell (different, lighter wrapper) is a structural violation.
    props_needed:
      - badge: "Password recovery"
      - title: "Forgot password"  (drives right panel h2)
      - description: "Enter your account email and we'll prepare a reset path."
      - leftEyebrow: "Account recovery"
      - leftTitle: "Recover factory access"
      - leftDescription: "Submit your account email to receive a time-limited reset link."
      - steps: [
          { title: "Submit your account email", description: "..." },
          { title: "Open the newest reset link", description: "Valid for 30 minutes." },
          { title: "Set a new password and sign in", description: "..." }
        ]
      - supportTitle: "Privacy-safe by design"
      - supportDescription: "This page never confirms whether an email is registered."
      - supportItems: [privacy posture bullets]

  forms:
    - form: Password recovery form (phase 1)
      component: HTML <form> element with system Field/Label/Input primitives
      field_components:
        - Field: wraps email input with validation state propagation
        - Label: system Label primitive, htmlFor linked to input id, sentence case
        - Input: system Input primitive, type=email, autoFocus, autoComplete=email
        - Button (variant="primary"): submit button, full width, h-[42px], isBusy support

  status_elements:
    - element: Error zone
      component: StatusMessage or inline div using semantic token classes
      variant: error (--status-danger-bg/fg/border)
    - element: Confirmation status panel
      component: StatusMessage or inline div
      variant: success (--status-success-bg/fg/border)
    - element: TTL notice panel
      component: inline div with surface-shell + border-default
      variant: informational
    - element: Unverified-account notice
      component: StatusMessage or inline div
      variant: warning (--status-warning-bg/fg/border)
    - element: Preview link panel
      component: inline div with surface-selected + border-focus
      variant: info/preview

  navigation_elements:
    - element: Footer sign-in link
      component: Link (Next.js)
      styling: text-action-primary token class
    - element: Back to sign in link (confirmation phase)
      component: Link (Next.js)
      styling: text-action-primary token class
    - element: Preview reset form link
      component: Button (variant="default") or Link styled as button
      icon: ArrowRight (lucide)

  action_elements:
    - element: Submit button
      component: Button (variant="primary")
      props: isBusy, busyLabel="Sending...", type="submit", full width
    - element: Resend verification button
      component: Button (variant="outline")
      props: isBusy (resendingVerification), disabled when resending
    - element: Copy link button
      component: Button (variant="ghost")
      props: onClick copyResetLink, immediate isBusy feedback via copyStatus state

  ai_elements: []
```

**Missing Components — new primitive candidates:**
- `AuthWorkstationShell` typography fixes: The shell currently uses `text-[clamp(3rem,3.9vw,4.5rem)]` for leftTitle (violation), `text-[2rem]` for panel h2 (violation), and `uppercase tracking-[0.24em]` for badge, metadata labels, and topbar meta labels (violation). These violations exist in the shell component itself and must be corrected as part of this workspace's implementation — they affect all three auth-shell workspaces (login, register, forgot-password). Flag for priority fix before implementation begins.

---

## 12. OPERATIONAL PROBLEMS SOLVED

```yaml
problem_resolutions:
  - problem: AuthShell used instead of AuthWorkstationShell — breaks spatial consistency with login/register
    root_cause: ForgotPasswordPage was built using the lighter AuthShell wrapper rather than
      AuthWorkstationShell, likely because it was built before AuthWorkstationShell was
      available or because its single-field form seemed too simple to justify the split layout
    structural_solution: Section 4.1 mandates AuthWorkstationShell as the workspace container;
      Section 11 component mapping specifies AuthWorkstationShell with full props; the split
      layout (45/55) matches login and register exactly
    section_reference: Section 4.1, Section 11
    measurable_outcome: A user navigating between /login, /register, and /forgot-password
      experiences zero spatial reorientation — the left/right panel structure is identical

  - problem: Field label uses uppercase tracking-wide — violates typography governance
    root_cause: Local <label> element with hardcoded className copied from a legacy auth pattern
      that predates the typography governance system
    structural_solution: Section 7.2 specifies Field → Label → Input pattern with label at
      12px/500 weight/sentence case; Section 9.3 typography hierarchy specifies field_label
      at --type-label with tracking 0em; Section 4.2 acceptance criteria require no uppercase tracking
    section_reference: Section 7.2, Section 9.3, Section 4.2
    measurable_outcome: Field label renders "Work email" in sentence case at 12px/500; zero
      uppercase tracking on any form label

  - problem: <details>/<summary> forbidden pattern used for "Need help" help section
    root_cause: Developer used HTML disclosure primitive as fastest available collapsible
      without checking governance rules; pattern is explicitly forbidden per Blueprint Root Cause 4
    structural_solution: Section 4.2 confirmation phase replaces the hidden help section with
      an always-visible unverified-account warning panel (--status-warning) that surfaces the
      most critical help content (pending email verification) without requiring user interaction;
      the collapse pattern is eliminated entirely; Section 1.3 flags the violation explicitly
    section_reference: Section 4.2 (Phase 2 contents), Section 1.3
    measurable_outcome: Zero <details>/<summary> elements in the workspace; the most critical
      help content (unverified account case) is always visible without requiring interaction

  - problem: <summary> uses uppercase tracking-[0.22em] — 3.7× allowed maximum
    root_cause: Copy-pasted from a marketing-style eyebrow pattern without governance check
    structural_solution: Violation is eliminated by removing <details>/<summary> entirely (see above)
    section_reference: Section 4.2, Section 1.3
    measurable_outcome: No uppercase tracking above 0.06em anywhere in the workspace

  - problem: success state uses text-green-300 raw Tailwind color class
    root_cause: Developer used a Tailwind semantic color class directly rather than the
      operational token system
    structural_solution: Section 9.4 specifies confirmation_panel uses var(--status-success-bg)
      with var(--status-success-border); Section 9.3 specifies confirmation_status_title as
      sentence case at 16px/600 using text-text-primary; no raw color classes permitted
    section_reference: Section 9.4, Section 9.3
    measurable_outcome: Zero raw Tailwind color classes (text-green-300, etc.) in confirmation state

  - problem: Multiple elements use text-[var(--muted)] and text-[var(--accent)] raw alias references
    root_cause: Developers learned the codebase from pages that were built before the alias
      migration was complete; the aliases work but are non-compliant
    structural_solution: Section 9.3 specifies all text tokens using canonical names
      (text-text-secondary, text-text-tertiary, text-action-primary); Section 4.2 acceptance
      criteria explicitly require text-action-primary instead of text-[var(--accent)] for all links
    section_reference: Section 9.3, Section 4.2
    measurable_outcome: Zero raw var() alias references in the workspace; all text uses
      semantic token classes

  - problem: "Resend verify" button in confirmation state creates intent confusion
    root_cause: The button resends email VERIFICATION (original signup flow) not the password
      reset email; its label does not communicate this distinction; a user trying to reset
      their password has no context for why a "resend verify" button is present
    structural_solution: Section 4.2 (confirmation phase) relegates this action to a collapsible
      disclosure section labeled "Didn't get a verification email from your original signup?";
      the button is renamed "Resend verification email"; the distinction between password reset
      and email verification flows is explicit in the label
    section_reference: Section 4.2 (Phase 2 — resend verification section)
    measurable_outcome: Users attempting password reset cannot confuse the resend-verify button
      with a password-reset-resend action; the button is non-prominent until explicitly requested

  - problem: No autoFocus on email input — user must click to begin typing
    root_cause: autoFocus attribute not added to the Input component
    structural_solution: Section 7.2 field group specifies autoFocus: yes for the email field;
      Section 7.4 keyboard flow specifies autoFocus on page mount; Section 4.2 acceptance
      criteria require email input to have autoFocus
    section_reference: Section 7.2, Section 7.4, Section 4.2
    measurable_outcome: Page load places cursor in email field automatically; user can begin
      typing without a click

  - problem: Preview link "Open Reset Form" uses arbitrary border-[0.5px] and inline styling
      instead of Button or Link primitives
    root_cause: Link styled as button using arbitrary Tailwind classes without using the
      Button component or a system Link-as-button primitive
    structural_solution: Section 4.2 specifies Button (variant="default") or system Link
      component for the preview reset form link; Section 11 maps it to Button with ArrowRight icon
    section_reference: Section 4.2 (Phase 2 — preview link panel), Section 11
    measurable_outcome: Preview link uses a system component with consistent interaction states
      and no arbitrary border shorthand values
```

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

```yaml
implementation_sequence:
  step_1: Migrate workspace container from AuthShell to AuthWorkstationShell with correct props
    (leftEyebrow, leftTitle, leftDescription, steps, supportTitle, supportDescription, supportItems)
  step_2: Fix AuthWorkstationShell shell-level typography violations (badge tracking, h2 sizing,
    metadata label uppercase) — these affect all auth pages; coordinate with login/register
  step_3: Replace local <label> element with system Field → Label → Input pattern; add autoFocus
    to email input; correct autoComplete and inputMode attributes
  step_4: Migrate all raw token references (text-[var(--accent)], text-[var(--muted)],
    text-[var(--text)]/90) to semantic token classes (text-action-primary, text-text-secondary,
    text-text-primary)
  step_5: Replace <details>/<summary> help section with always-visible unverified-account notice
    panel using --status-warning semantic tokens
  step_6: Fix confirmation state colors — replace text-green-300 with --status-success-fg;
    restructure confirmation panel to use semantic token classes throughout
  step_7: Restructure "Resend verify" button as a contextual disclosure section with correct label
  step_8: Fix preview link — replace arbitrary-class link with Button or Link component
  step_9: Responsive collapse — ensure left panel hides at <1024px and touch targets ≥44px on mobile
```

### 13.2 Critical Constraints

```yaml
critical_constraints:
  - "Migrate from AuthShell to AuthWorkstationShell — the current container is wrong; do not
     extend AuthShell further for this workspace"
  - "Do not expose whether an email exists — the backend is privacy-safe by design; the UI
     must not add any language that suggests whether the email was found"
  - "response.reset_link must ONLY be shown when delivery_mode === 'preview' — never in production"
  - "All surfaces must reference CSS token variables, not hex or rgba values"
  - "No <details>/<summary> elements anywhere — use controlled state or always-visible panels"
  - "Do not modify AppShell scroll architecture"
  - "All spacing values must follow the 4px base scale"
  - "All text labels must use sentence case — no uppercase tracking above 0.06em"
  - "The resend verification action is for original signup email verification, not password
     reset resend — the label must reflect this distinction"
```

### 13.3 Open Questions

```yaml
open_questions:
  - question: >
      The AuthWorkstationShell component has several internal typography violations
      (text-[clamp(3rem,3.9vw,4.5rem)] for leftTitle, text-[2rem] for h2, uppercase tracking-[0.24em]
      for badge and metadata labels). Should these be corrected on the shell component directly
      (affecting all three auth-shell pages simultaneously) or should each page override
      via props/classNames while the shell fix is deferred?
    blocking: yes — the typography governance requires sentence case; implementing forgot-password
      on the current shell produces violations on every render
    owner: frontend team
    decision_needed_by: before step_2 in implementation sequence

  - question: >
      Should the forgot-password confirmation phase show a "Resend reset link" button
      (re-submitting the form), or is the current approach (user reloads or revisits if
      they need a new link) the intended product behavior?
    blocking: no — the current "no resend reset link" approach is functional; this is a UX
      enhancement question
    owner: product owner
    decision_needed_by: before step_6 (can be added after confirmation panel is built)

  - question: >
      The PASSWORD_RESET_TTL_MINUTES is configured via env var (defaults to 30). Should
      the frontend hardcode "30 minutes" in the step description and TTL notice, or should
      this value be exposed via a public config endpoint so it's always accurate?
    blocking: no — hardcoded "30 minutes" is safe for now given it's the default; an
      environment config endpoint would be a future enhancement
    owner: backend team / product owner
    decision_needed_by: before step_6
```

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections fully populated — no empty fields, no placeholders
- [x] Every layout zone has a documented existence justification tied to a backend entity or operator need
- [x] Every layout zone has explicit, testable acceptance criteria
- [x] Every component is mapped to an existing primitive OR flagged as new primitive candidate
- [x] Every operational failure from Section 1.3 has a resolution in Section 12
- [x] Reduction audit completed — removed elements documented (details/summary, disconnected help card, standalone "Resend verify" button prominence)
- [x] No anti-patterns present (no gradients, no glow, no pulse on static elements, no UPPERCASE labels)
- [x] All spacing values follow the 4px scale
- [x] All surfaces reference token variables only — no hex values
- [x] Typography follows approved system exactly
- [x] Backend API endpoints verified to exist (POST /auth/password/forgot confirmed in auth.py lines 1300–1341)
- [x] Permission matrix drives zone visibility rules in Section 4.3
- [x] Open questions section populated (3 questions, 1 blocking)
- [x] AI elements: not applicable — marked in Section 8
- [x] Implementation handoff sequence is complete and ordered

---

## POST-GENERATION SELF-VALIDATION

```yaml
self_validation:
  operational_integrity:
    - [x] Every layout zone traces back to a backend entity or API endpoint
          (AuthWorkstationShell → POST /auth/password/forgot; confirmation → PasswordForgotResponse fields)
    - [x] Every zone justified by specific operator need
          (form zone = recovery action; left panel = anxiety reduction + privacy explanation;
          confirmation = next-step guidance after submit)
    - [x] No zones exist for visual composition only — reduction audit complete
    - [x] Removed elements documented in Section 12
          (<details>/<summary>, disconnected help section, prominent resend-verify button)

  law_compliance:
    - [x] Every spacing value follows 4px scale (16px, 20px, 24px, 32px, 40px)
    - [x] Every surface references CSS token variable (surface-app, surface-shell, surface-panel,
          surface-card, surface-elevated, surface-selected, status-success-bg, status-warning-bg,
          status-danger-bg, border-focus, border-default)
    - [x] Every text label is in sentence case — no uppercase anywhere in spec
    - [x] Every font specification from approved type system (--type-label 12px/500,
          --type-body 14px/400, --type-panel-title 16px/600, --type-page-title 18px/600)
    - [x] All AI elements: N/A — no AI systems on this workspace

  kiro_readiness:
    - [x] Implementation sequence is clear (9-step sequence in Section 13.1)
    - [x] All acceptance criteria are testable (checkboxes with specific, measurable outcomes)
    - [x] Blocking open question flagged (AuthWorkstationShell typography violations)

  anti_pattern_check:
    - [x] No gradients specified anywhere
    - [x] No glow effects specified anywhere
    - [x] No pulsing on non-loading elements
    - [x] No UPPERCASE labels (every label explicitly specified as sentence case)
    - [x] No marketing typography (no clamp(), no hero sizing)
    - [x] No invented workflows — all behaviors traced to actual auth.py backend code
    - [x] No fake data or placeholder APIs — all endpoints verified in auth.py
    - [x] No <details>/<summary> elements — explicitly replaced in Section 4.2

  structural_integrity:
    - [x] Zone interaction rules cover all state transitions that affect UI
    - [x] Permission matrix complete (public workspace — no role-based visibility)
    - [x] Responsive collapse behavior defined (left panel hides <1024px)
    - [x] All problem resolutions in Section 12 reference specific sections
```

---

## 14. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

> Operational wireframe architecture for the `/forgot-password` workspace.
> This section communicates structural anatomy, component hierarchy, attention flow,
> spacing rhythm, and responsive behavior. This is NOT visual design. It IS structural law.

---

### 14A. Desktop Structural Blueprint

#### Phase 1 — Request Phase (desktop ≥1024px)

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│  TOPBAR                                                          height: 56px      │
│  [Building2] DPR.ai                             Steel industry · Factory OS        │
│  └─ links to /                   └─ 12px/500/sentence case / text-action-primary  │
├──────────────────────────────┬─────────────────────────────────────────────────────┤
│  LEFT CONTEXT PANEL [P:4]    │  RIGHT FORM PANEL [P:1]                             │
│  width: 45%                  │  width: 55%  (inner max-width: 480px, centered)     │
│  surface-panel               │  surface-app                                        │
│  padding: 40px               │  padding: 32px horizontal / 32px vertical           │
│  · · · · · · · · · · · · ·   │  · · · · · · · · · · · · · · · · · · · · · · · · · │
│                              │                                                     │
│  [eyebrow]                   │  ┌──────────────────────────────────────────────┐  │
│  Account recovery            │  │  FORM PANEL INNER          surface-card      │  │
│  12px/500/tertiary           │  │  padding: 32px                               │  │
│                              │  │  ┌────────────────────────────────────────┐  │  │
│  [page title]                │  │  │ PANEL HEADER                           │  │  │
│  Recover factory             │  │  │ [chip] Password recovery               │  │  │
│  access                      │  │  │        12px/500/sentence case          │  │  │
│  18px/600/sentence case      │  │  │                                        │  │  │
│                              │  │  │ [h2] Forgot password                   │  │  │
│  [description]               │  │  │      16px/600 — --type-panel-title     │  │  │
│  Submit your email to        │  │  │                                        │  │  │
│  receive a time-limited      │  │  │ [desc] Enter your account email and    │  │  │
│  reset link.                 │  │  │ we'll prepare a reset path.            │  │  │
│  14px/400/secondary          │  │  │ 14px/400/text-secondary                │  │  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │  │  └────────────────────────────────────────┘  │  │
│                              │  │  ↕ 20px (--space-5)                          │  │
│  RECOVERY STEPS CARD         │  │  ┌────────────────────────────────────────┐  │  │
│  surface-shell               │  │  │ EMAIL FIELD                            │  │  │
│  ┌──────────────────────┐   │  │  │ ┌──────────────────────────────────┐  │  │  │
│  │ 01  Submit your      │   │  │  │ │ Label: Work email                │  │  │  │
│  │     account email    │   │  │  │ │        12px/500/sentence case    │  │  │  │
│  │     14px/500         │   │  │  │ │ [Mail] [input 40px h] ← autoFocus│  │  │  │
│  │     13px/400/sec     │   │  │  │ │        type=email, autoComplete  │  │  │  │
│  │                      │   │  │  │ └──────────────────────────────────┘  │  │  │
│  │ 02  Open the newest  │   │  │  └────────────────────────────────────────┘  │  │
│  │     reset link       │   │  │  ↕ 16px (--space-md)                        │  │
│  │     Valid 30 minutes │   │  │  ┌────────────────────────────────────────┐  │  │
│  │                      │   │  │  │ ERROR ZONE (conditional)              │  │  │
│  │ 03  Set a new        │   │  │  │ surface-danger-bg / border-danger     │  │  │
│  │     password and     │   │  │  │ 13px/400/status-danger-fg             │  │  │
│  │     sign in          │   │  │  │ hidden when no error                  │  │  │
│  └──────────────────────┘   │  │  └────────────────────────────────────────┘  │  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │  │  ↕ 16px (--space-md)                        │  │
│                              │  │  ┌────────────────────────────────────────┐  │  │
│  PRIVACY POSTURE CARD        │  │  │ SUBMIT BUTTON                         │  │  │
│  surface-panel               │  │  │ [Send reset link]  full-width  h:42px │  │  │
│  ┌──────────────────────┐   │  │  │ variant: primary                      │  │  │
│  │ [ShieldCheck]        │   │  │  │ isBusy: "Sending..."                  │  │  │
│  │ Privacy-safe by      │   │  │  └────────────────────────────────────────┘  │  │
│  │ design               │   │  │  ↕ 16px (--space-md)                        │  │
│  │ 14px/500/primary     │   │  │  ┌────────────────────────────────────────┐  │  │
│  │                      │   │  │  │ FOOTER              border-top/subtle  │  │  │
│  │ "This page never     │   │  │  │ "Remembered it?"  "Sign in →"          │  │  │
│  │ confirms whether an  │   │  │  │  14px/400/secondary  text-action-primary│  │  │
│  │ email is registered" │   │  │  └────────────────────────────────────────┘  │  │
│  │ 13px/400/secondary   │   │  └──────────────────────────────────────────────┘  │
│  └──────────────────────┘   │                                                     │
└──────────────────────────────┴─────────────────────────────────────────────────────┘
```

#### Phase 2 — Confirmation Phase (desktop ≥1024px, delivery_mode="email")

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│  TOPBAR (unchanged)                                              height: 56px      │
├──────────────────────────────┬─────────────────────────────────────────────────────┤
│  LEFT CONTEXT PANEL [P:4]    │  RIGHT FORM PANEL [P:1]  [FORM HIDDEN]              │
│  [UNCHANGED — steps remain   │  · · · · · · · · · · · · · · · · · · · · · · · · · │
│   relevant throughout]       │                                                     │
│                              │  ┌──────────────────────────────────────────────┐  │
│  [eyebrow, title, desc]      │  │  FORM PANEL INNER          surface-card      │  │
│  (unchanged)                 │  │  ┌────────────────────────────────────────┐  │  │
│                              │  │  │ PANEL HEADER                           │  │  │
│  RECOVERY STEPS CARD         │  │  │ [chip] Check your inbox               │  │  │
│  (unchanged — 3 steps        │  │  │ [h2]   Check your inbox               │  │  │
│   shown with same content)   │  │  │ [desc] We've prepared a recovery path  │  │  │
│                              │  │  └────────────────────────────────────────┘  │  │
│  PRIVACY POSTURE CARD        │  │  ↕ 20px                                       │  │
│  (unchanged)                 │  │  ┌────────────────────────────────────────┐  │  │
│                              │  │  │ CONFIRMATION STATUS PANEL             │  │  │
│                              │  │  │ surface-success-bg / border-success   │  │  │
│                              │  │  │ ┌──────────────────────────────────┐  │  │  │
│                              │  │  │ │ "If an account exists for this   │  │  │  │
│                              │  │  │ │ email, you will receive a reset  │  │  │  │
│                              │  │  │ │ link."                           │  │  │  │
│                              │  │  │ │ 14px/400/text-status-success-fg  │  │  │  │
│                              │  │  │ │ ↕ 8px                            │  │  │  │
│                              │  │  │ │ [ops.admin@factory.com]          │  │  │  │
│                              │  │  │ │ 14px/600/text-primary            │  │  │  │
│                              │  │  │ └──────────────────────────────────┘  │  │  │
│                              │  │  └────────────────────────────────────────┘  │  │
│                              │  │  ↕ 16px                                       │  │
│                              │  │  ┌────────────────────────────────────────┐  │  │
│                              │  │  │ TTL NOTICE           surface-shell     │  │  │
│                              │  │  │ border-default                        │  │  │
│                              │  │  │ "Check inbox, spam, and promotions.   │  │  │
│                              │  │  │ Links valid 30 minutes — use newest." │  │  │
│                              │  │  │ 13px/400/text-secondary               │  │  │
│                              │  │  └────────────────────────────────────────┘  │  │
│                              │  │  ↕ 16px                                       │  │
│                              │  │  ┌────────────────────────────────────────┐  │  │
│                              │  │  │ UNVERIFIED-ACCOUNT NOTICE             │  │  │
│                              │  │  │ surface-warning-bg / border-warning   │  │  │
│                              │  │  │ "If you recently signed up but        │  │  │
│                              │  │  │ haven't verified your email, your     │  │  │
│                              │  │  │ account isn't active — no reset link  │  │  │
│                              │  │  │ will arrive. Verify email first."     │  │  │
│                              │  │  │ 13px/400/text-status-warning-fg       │  │  │
│                              │  │  └────────────────────────────────────────┘  │  │
│                              │  │  ↕ 16px                                       │  │
│                              │  │  ┌────────────────────────────────────────┐  │  │
│                              │  │  │ ACTION ROW                            │  │  │
│                              │  │  │ [Back to sign in →]                   │  │  │
│                              │  │  │  text-action-primary / 14px/400       │  │  │
│                              │  │  └────────────────────────────────────────┘  │  │
│                              │  │  ↕ 16px                                       │  │
│                              │  │  ┌────────────────────────────────────────┐  │  │
│                              │  │  │ RESEND VERIFICATION (collapsed)       │  │  │
│                              │  │  │ "Didn't receive a signup verification  │  │  │
│                              │  │  │  email?" 13px/400/tertiary             │  │  │
│                              │  │  │ [expands on click → shows button +    │  │  │
│                              │  │  │  verificationStatus feedback]         │  │  │
│                              │  │  └────────────────────────────────────────┘  │  │
│                              │  └──────────────────────────────────────────────┘  │
└──────────────────────────────┴─────────────────────────────────────────────────────┘
```

**Note — Phase 2 preview mode (delivery_mode="preview"):** Identical to above, but a preview link panel is inserted between CONFIRMATION STATUS PANEL and TTL NOTICE:

```
  ┌────────────────────────────────────────────────────────────┐
  │ PREVIEW LINK PANEL    surface-selected / border-focus     │
  │ eyebrow: "Preview mode — reset link"                      │
  │          12px/500/tertiary/sentence case                  │
  │ [Open reset form →]  Button or Link-as-button             │
  │ [Copy link]          Button variant=ghost                 │
  │ [copy status message]  12px/400/secondary                 │
  │ [url text] 12px/tertiary break-all                        │
  └────────────────────────────────────────────────────────────┘
```

---

### 14B. Visual Attention Flow Map

#### Phase 1 — Request Phase

```
SCAN LEVEL 1 (0–200ms): Email input (autoFocus)
────────────────────────────────────────────────
  WHY FIRST: Cursor is placed here by autoFocus on page load. User
  arrived from failed login — email address is mentally loaded. Zero
  friction between page load and first keystroke.

  The panel header (chip + h2 + desc) is seen peripherally. The user
  already knows why they're here. The form IS the workspace.

SCAN LEVEL 2 (200ms–500ms): Submit button
──────────────────────────────────────────
  WHY SECOND: One-field form. After typing, the eye drops to the
  full-width submit button. Keyboard: Enter submits directly.
  No intermediate actions between email and submit.

SCAN LEVEL 3 (500ms–1.5s): Error zone (if prior submit failed)
────────────────────────────────────────────────────────────────
  WHY THIRD: Error zone sits between field and submit button.
  Intercepts the scan before the user retries.

SCAN LEVEL 4 (1.5s+): Footer sign-in link / left panel
────────────────────────────────────────────────────────
  WHY LAST: Footer escape hatch for users who recalled their
  password. Left panel recovery steps for users who pause.
  Neither requires urgency.
```

#### Phase 2 — Confirmation Phase

```
SCAN LEVEL 1 (0–200ms): Confirmation status panel (success-tone surface)
─────────────────────────────────────────────────────────────────────────
  WHY FIRST: The form has disappeared. The first visible colored surface
  is the confirmation panel. Green semantic tone signals "submitted
  successfully" without needing to read text.

SCAN LEVEL 2 (200ms–800ms): Email address + status message text
────────────────────────────────────────────────────────────────
  WHY SECOND: 14px/600/text-primary email address is the heaviest
  element. User verifies their email was captured correctly.
  Then reads the privacy-safe message.

SCAN LEVEL 3 (800ms–2s): TTL notice + Back to sign in
───────────────────────────────────────────────────────
  WHY THIRD: TTL notice tells the user they have 30 minutes.
  Back-to-sign-in link is the next action after checking email.

SCAN LEVEL 4 (2s+): Unverified-account notice + resend disclosure
──────────────────────────────────────────────────────────────────
  WHY LAST: Unverified-account notice is relevant only for new
  users who haven't completed signup email verification. Most
  users skip this. Resend disclosure is for edge cases only.
```

#### Destructive / Irreversible Action Placement

```
There are no destructive actions on this workspace.
The submit action creates a PasswordResetToken record — additive.
The resend verification sends an email — additive.
Neither has operational consequences that require confirmation patterns.
```

#### Persistent Visibility Requirements

```
ALWAYS IN VIEW:
  ├── Submit button (Phase 1) — never requires scroll (single-field form)
  └── Back to sign in link (Phase 2) — primary exit; always in view

CONTEXTUAL:
  ├── Error zone — only when network error occurs
  ├── Preview link panel — only when delivery_mode === "preview"
  └── Resend verification section — only after disclosure trigger click

PROGRESSIVE:
  └── verificationStatus message — after resend verification attempt
```

---

### 14C. Spacing & Rhythm Visualization

```
DENSE REGIONS (tighter spacing):
  - Email field area: field label → input → submit is 16px gaps
    (--space-md throughout) — tight enough to read as one unit,
    loose enough for comfortable interaction

BREATHABLE REGIONS:
  - Panel outer padding: 32px horizontal and vertical — single-field
    form has more inherent whitespace than register's 8-field form;
    the breathing room communicates "this is simple, not a mistake"
  - Section gaps in confirmation: 16px between each notice panel —
    enough separation to distinguish sections without visual chaos

VISUAL SILENCE ZONES:
  - The area between the panel header and the email field (20px gap)
    serves as a pause before the action — the user has read the header
    context and is now about to act
  - The area below submit (16px) before the footer creates a clear
    separation between the action zone and the navigation zone
```

---

### 14D. Component Nesting Hierarchy

```
AuthWorkstationShell
  ├── StickyTopbar (56px)
  │     ├── BrandLink (Building2 + "DPR.ai")
  │     └── MetaLabels (industry · platform)
  ├── LeftContextPanel (45% desktop, hidden mobile)
  │     ├── EyebrowLabel ("Account recovery")
  │     ├── PageTitle ("Recover factory access" — 18px/600)
  │     ├── Description (14px/400)
  │     ├── RecoveryStepsCard (surface-shell)
  │     │     └── Step × 3 (numbered 01–03, sentence case)
  │     └── PrivacyPostureCard (surface-panel)
  │           ├── ShieldCheck icon
  │           └── PrivacyDescription (13px/400)
  └── RightFormPanel (55% desktop, 100% mobile)
        └── FormPanelInner (surface-card, max-w-480px)
              ├── PanelHeader
              │     ├── BadgeChip ("Password recovery" / "Check your inbox")
              │     ├── PanelTitle (16px/600)
              │     └── PanelDescription (14px/400)
              │
              ├── [Phase 1 — Request]
              │     ├── Field
              │     │     ├── Label ("Work email" — 12px/500)
              │     │     └── Input (type=email, autoFocus)
              │     ├── ErrorZone (conditional — status-danger)
              │     ├── Button variant="primary" (submit, isBusy)
              │     └── Footer (divider + sign-in link)
              │
              └── [Phase 2 — Confirmation]
                    ├── ConfirmationStatusPanel (status-success)
                    │     ├── StatusMessage (14px/400)
                    │     └── EmailChip (14px/600/text-primary)
                    ├── PreviewLinkPanel (conditional — surface-selected)
                    │     ├── PreviewEyebrow (12px/500/tertiary)
                    │     ├── Button/Link "Open reset form →"
                    │     ├── Button variant="ghost" "Copy link"
                    │     └── URLDisplay (12px/tertiary/break-all)
                    ├── TTLNotice (surface-shell)
                    ├── UnverifiedAccountNotice (status-warning)
                    ├── ActionRow
                    │     └── Link "Back to sign in →" (text-action-primary)
                    └── ResendVerificationSection (collapsed by default)
                          ├── DisclosureTrigger (13px/400/tertiary)
                          └── [on expand]
                                ├── Button variant="outline" "Resend verification email"
                                └── VerificationStatusMessage (conditional)
```

---

### 14E. Responsive Collapse Blueprint

```
1440px+ (Full workstation):
┌─────────────────────────────────────────────────────────────────────┐
│  TOPBAR                                              height: 56px   │
├──────────────────────────────┬──────────────────────────────────────┤
│  LEFT CONTEXT PANEL          │  RIGHT FORM PANEL                   │
│  width: 45%                  │  width: 55%                         │
│  surface-panel               │  surface-app                        │
│  padding: 40px               │  inner panel: max-w-480px centered  │
│  · Steps + Privacy card ·    │  · Email form or confirmation ·     │
└──────────────────────────────┴──────────────────────────────────────┘

1024px–1279px (Compact desktop):
┌─────────────────────────────────────────────────────────────────────┐
│  TOPBAR                                              height: 56px   │
├──────────────────────────────┬──────────────────────────────────────┤
│  LEFT PANEL                  │  RIGHT FORM PANEL                   │
│  width: 45% (stays visible)  │  width: 55%                         │
│  padding: 24px (reduced)     │  inner max-w: 480px (unchanged)     │
│  · Steps + Privacy card ·    │  · Email form or confirmation ·     │
└──────────────────────────────┴──────────────────────────────────────┘
Left panel stays visible; only padding reduces. No functionality lost.

<768px (Mobile degraded):
┌─────────────────────────────────────────────────────────────────────┐
│  TOPBAR                                              height: 56px   │
├─────────────────────────────────────────────────────────────────────┤
│  RIGHT FORM PANEL (full width, centered)                           │
│  LEFT PANEL: HIDDEN (display: none)                                │
│  · Email form or confirmation at full width ·                      │
│  · Input height: 44px (touch) ·                                    │
│  · Submit button height: 48px (touch) ·                            │
│  · All tap targets: ≥44px ·                                        │
└─────────────────────────────────────────────────────────────────────┘
Left panel is hidden. Form and confirmation remain fully functional.
All critical actions (submit, back to sign in, copy link) are touch-safe.
```

---

### 14F. Structural Consistency Validation

```yaml
structural_validation:
  - [x] All zones justified by operational necessity — no aesthetic zones present
        (Form zone = the recovery action; Left panel = anxiety reduction + privacy education;
        Confirmation elements = next-step guidance after submission)
  - [x] Visual dominance matches attention priority numbering
        (Right form panel [P:1] is visually dominant; left panel [P:4] is secondary)
  - [x] Spacing rhythm follows density specifications from Section 9
        (16px field gaps, 20px header-to-form gap, 32px panel padding — all 4px multiples)
  - [x] Responsive adaptations preserve all critical operator actions
        (Submit, sign-in link, back-to-sign-in, copy link all accessible on mobile)
  - [x] Component nesting hierarchy matches Section 11 component mapping
  - [x] No over-zoning — zone count is minimum required:
        (Topbar + Left panel + Right panel = 3 zones; this is the same as login and register)
  - [x] No redundant information surfaces
        (Privacy context is in left panel only; TTL notice and unverified notice are distinct
        purposes — not duplicates)
  - [x] Blueprint matches layout pattern declared in Section 4.1 (SPLIT AUTH LAYOUT)
```

---

## KIRO TASK CHAINING

After this spec is APPROVED, the following implementation tasks are unblocked:

```yaml
downstream_kiro_tasks:
  task_1:
    name: "Forgot Password — Container Migration (AuthShell → AuthWorkstationShell)"
    input: This spec → Section 4.1, Section 11, Section 14D
    output: Workspace uses AuthWorkstationShell with correct props; left panel shows recovery
      steps and privacy posture card

  task_2:
    name: "Forgot Password — Field System & autoFocus Fix"
    input: This spec → Section 7.2, Section 7.4, Section 4.2 (Phase 1 acceptance criteria)
    output: Email field uses Field → Label → Input pattern; autoFocus active; correct
      autoComplete and inputMode attributes; label at sentence case

  task_3:
    name: "Forgot Password — Token Reference Migration"
    input: This spec → Section 9.3, Section 9.4, Section 4.2 acceptance criteria
    output: All text-[var(--accent)], text-[var(--muted)], text-[var(--text)]/90 replaced
      with canonical semantic token classes

  task_4:
    name: "Forgot Password — Confirmation Phase Rebuild"
    input: This spec → Section 4.2 (Phase 2 contents), Section 9.3, Section 9.4
    output: Confirmation phase uses semantic token surfaces; text-green-300 replaced;
      <details>/<summary> removed; unverified-account notice always visible;
      resend verification section restructured as collapsible disclosure

  task_5:
    name: "Forgot Password — Preview Link Component Fix"
    input: This spec → Section 4.2 (Phase 2 preview link panel), Section 11
    output: Preview link uses Button/Link system primitive; copy button provides
      isBusy feedback; arbitrary border-[0.5px] classes eliminated

  task_6:
    name: "Forgot Password — AuthWorkstationShell Typography Governance Fix"
    input: This spec → Section 1.3 (shell-level violations), Section 4.2 (topbar criteria)
    output: AuthWorkstationShell badge, h2, metadata labels, and topbar labels corrected
      to sentence case with compliant tracking values (affects all three auth-shell pages)

  task_7:
    name: "Forgot Password — Responsive Behavior"
    input: This spec → Section 10, Section 14E
    output: Left panel hidden at <1024px; touch targets at 44px minimum; submit button
      48px on mobile
```

Each downstream task references THIS spec as its source of truth.
Kiro must not deviate from this spec without creating a spec amendment, versioning the file,
and noting the deviation reason.

---

*End of WORKSPACE_SKELETON_FORGOT_PASSWORD.md (Sections 1–14)*
*This file is system-generated architecture. Treat as engineering law until formally amended.*
*Architectural precedent established: AuthShell → AuthWorkstationShell migration pattern,
always-visible unverified-account notice replaces <details>/<summary> help collapse,
single-field auth form layout at 480px max-width, resend-verification as collapsible disclosure*

``
#### CODE
RESET PASSWORD LINK PAGE
<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>FactoryNerve OS | Password Recovery</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        ::-webkit-scrollbar {
            width: 4px;
        }
        ::-webkit-scrollbar-track {
            background: #0b1326;
        }
        ::-webkit-scrollbar-thumb {
            background: #3c494e;
        }
    </style>
<!-- Injected Tailwind Config -->
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                      "on-error": "#690005",
                      "on-surface-variant": "#bbc9cf",
                      "secondary": "#b7c8e1",
                      "inverse-surface": "#dae2fd",
                      "on-tertiary-fixed": "#291800",
                      "outline": "#859399",
                      "primary-fixed": "#b7eaff",
                      "secondary-container": "#3a4a5f",
                      "inverse-primary": "#00677f",
                      "inverse-on-surface": "#283044",
                      "surface": "#0b1326",
                      "on-primary-container": "#00566a",
                      "secondary-fixed-dim": "#b7c8e1",
                      "surface-tint": "#4cd6ff",
                      "surface-variant": "#2d3449",
                      "primary-container": "#00d1ff",
                      "surface-dim": "#0b1326",
                      "on-tertiary-fixed-variant": "#624000",
                      "on-secondary": "#213145",
                      "error-container": "#93000a",
                      "tertiary-container": "#feb127",
                      "outline-variant": "#3c494e",
                      "on-secondary-container": "#a9bad3",
                      "tertiary-fixed-dim": "#ffba49",
                      "on-error-container": "#ffdad6",
                      "error": "#ffb4ab",
                      "on-secondary-fixed": "#0b1c30",
                      "background": "#0b1326",
                      "on-tertiary": "#442b00",
                      "on-background": "#dae2fd",
                      "surface-container-low": "#131b2e",
                      "surface-container": "#171f33",
                      "on-primary-fixed": "#001f28",
                      "on-primary": "#003543",
                      "tertiary": "#ffd59c",
                      "surface-container-high": "#222a3d",
                      "on-secondary-fixed-variant": "#38485d",
                      "surface-bright": "#31394d",
                      "primary-fixed-dim": "#4cd6ff",
                      "primary": "#a4e6ff",
                      "tertiary-fixed": "#ffddb1",
                      "secondary-fixed": "#d3e4fe",
                      "surface-container-lowest": "#060e20",
                      "on-tertiary-container": "#6b4700",
                      "on-surface": "#dae2fd",
                      "on-primary-fixed-variant": "#004e60",
                      "surface-container-highest": "#2d3449"
              },
              "borderRadius": {
                      "DEFAULT": "0.125rem",
                      "lg": "0.25rem",
                      "xl": "0.5rem",
                      "full": "0.75rem"
              },
              "spacing": {
                      "xs": "4px",
                      "base": "4px",
                      "margin": "24px",
                      "xl": "32px",
                      "md": "16px",
                      "sm": "8px",
                      "gutter": "16px",
                      "lg": "24px"
              },
              "fontFamily": {
                      "metadata": ["JetBrains Mono"],
                      "body": ["Hanken Grotesk"],
                      "panel-title": ["Hanken Grotesk"],
                      "page-title": ["Hanken Grotesk"],
                      "label": ["JetBrains Mono"],
                      "button": ["Hanken Grotesk"]
              },
              "fontSize": {
                      "metadata": ["11px", {"lineHeight": "14px", "letterSpacing": "0.04em", "fontWeight": "400"}],
                      "body": ["14px", {"lineHeight": "20px", "letterSpacing": "0em", "fontWeight": "400"}],
                      "panel-title": ["16px", {"lineHeight": "20px", "letterSpacing": "0em", "fontWeight": "600"}],
                      "page-title": ["18px", {"lineHeight": "24px", "letterSpacing": "0em", "fontWeight": "600"}],
                      "label": ["12px", {"lineHeight": "16px", "letterSpacing": "0.02em", "fontWeight": "500"}],
                      "button": ["14px", {"lineHeight": "14px", "letterSpacing": "0.02em", "fontWeight": "500"}]
              }
            },
          },
        }
    </script>
</head>
<body class="bg-background text-on-background font-body min-h-screen overflow-hidden">
<!-- AuthWorkstationShell (Split Layout) -->
<main class="flex min-h-screen w-full">
<!-- Left Context (Visual/Branding) -->
<section class="hidden lg:flex lg:w-1/2 relative bg-surface-container-lowest flex-col justify-between p-xl overflow-hidden border-r border-outline-variant">
<!-- Background Image with Overlay -->
<div class="absolute inset-0 z-0">
<img alt="High-fidelity, cinematic photography of a massive, dark industrial server room with glowing cyan server racks and complex cable management. The lighting is dramatic and technical, with a deep midnight navy and vibrant cyan color palette. The atmosphere is professional, secure, and futuristic." class="w-full h-full object-cover opacity-30 grayscale contrast-125" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAwjD2ich4V6oEde_U0LY4gEPQziJpL-7EznJfiJeQxYeFIMZ_lTpkuE-wTrb4zZRgDiqulNYdRgM334yJUpopIkMV_kdm43gIEnfGz3OrBuoUlqWLNJC2S5Gj8rzY6pxC8jarmQJHDyW4SsOs07xHO2XHB6Ov0ovhqeFNuvWIf2BDpV4jZChL1S9g0ar8bTpKrqtEcA75cTyfOk-BnFNpF54v_JnR8V0SE5P-BNXlRR1DPCfAVczytzwddAsrtWxzR8Z1D2hZNvWQ"/>
<div class="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"></div>
</div>
<!-- Header Identity -->
<header class="relative z-10 flex items-center gap-sm">
<div class="w-8 h-8 bg-primary-container flex items-center justify-center rounded-sm">
<span class="material-symbols-outlined text-on-primary-container text-[20px]" style="font-variation-settings: 'FILL' 1;">factory</span>
</div>
<h1 class="text-page-title font-page-title font-bold text-on-surface">FactoryNerve OS</h1>
</header>
<!-- Institutional Footnote -->
<footer class="relative z-10">
<div class="max-w-md">
<p class="text-label font-label text-primary mb-xs uppercase tracking-widest">Security Subsystem</p>
<p class="text-body font-body text-on-surface-variant leading-relaxed">
                        Precision engineering for industrial continuity. Our recovery protocols ensure authorized access remains uncompromised during critical operational windows.
                    </p>
</div>
</footer>
</section>
<!-- Right Form Panel (Phase 2) -->
<section class="w-full lg:w-1/2 flex flex-col items-center justify-center p-margin md:p-xl bg-surface">
<div class="w-full max-w-md space-y-lg">
<!-- Top Nav Bar (Internal Header) -->
<nav class="flex justify-between items-center w-full mb-xl">
<span class="text-label font-label text-on-surface-variant">v2.4.1</span>
<div class="flex gap-md">
<span class="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors">sensors</span>
<span class="material-symbols-outlined text-on-surface-variant cursor-pointer hover:text-primary transition-colors">shield</span>
</div>
</nav>
<!-- Header Content -->
<header class="space-y-sm">
<span class="inline-flex items-center px-sm py-[2px] bg-primary-container/10 border border-primary-container/20 text-primary text-label font-label rounded-full">
<span class="material-symbols-outlined text-[14px] mr-xs" style="font-variation-settings: 'FILL' 1;">mail</span>
                        Check your inbox
                    </span>
<h2 class="text-[32px] leading-none font-bold tracking-tight text-on-surface">Check your inbox</h2>
<p class="text-body font-body text-on-surface-variant">We've prepared a recovery path for this email address.</p>
</header>
<!-- Status Panel (High-fidelity Success) -->
<div class="p-md bg-primary-container/5 border-l-4 border-primary-container rounded-sm space-y-md">
<div class="flex items-start gap-sm">
<span class="material-symbols-outlined text-primary text-[24px]">mark_email_read</span>
<div class="space-y-sm">
<p class="text-body font-body text-on-surface">If an account exists for this email, you will receive a reset link.</p>
<div class="inline-flex items-center gap-xs px-md py-xs bg-surface-container-highest border border-outline-variant rounded-sm">
<span class="material-symbols-outlined text-[14px] text-primary">alternate_email</span>
<span class="text-[14px] font-semibold text-primary font-label">ops.admin@factory.com</span>
</div>
</div>
</div>
</div>
<!-- Notices Stack -->
<div class="space-y-sm">
<!-- TTL Notice (Surface Shell Container) -->
<div class="p-md bg-surface-container-low border border-outline-variant rounded-sm flex gap-sm">
<span class="material-symbols-outlined text-on-surface-variant text-[20px]">timer</span>
<p class="text-label font-label text-on-surface-variant leading-tight">
                            The recovery link is <span class="text-on-surface">valid for 30 minutes</span>. After expiry, you must re-initiate the recovery terminal request.
                        </p>
</div>
<!-- Unverified-account notice (Persistent Warning Panel) -->
<div class="p-md bg-tertiary-container/10 border-l-4 border-tertiary-container rounded-sm flex gap-sm">
<span class="material-symbols-outlined text-tertiary text-[20px]">warning</span>
<div class="space-y-xs">
<p class="text-label font-label font-bold text-tertiary uppercase">Security Alert</p>
<p class="text-label font-label text-on-surface-variant leading-tight">
                                If the account was never verified after signup, the recovery system will bypass this request for safety. Contact Regional Operations for manual credential verification.
                            </p>
</div>
</div>
</div>
<!-- Preview Link (Conditional/Demo Mode) -->
<div class="p-md bg-surface-container-high rounded-sm border border-outline-variant space-y-md">
<div class="flex flex-col">
<span class="text-label font-label text-primary uppercase tracking-tighter opacity-70 mb-xs">Preview mode — reset link</span>
<div class="bg-surface-container-lowest p-sm rounded-sm border border-outline-variant mb-md">
<code class="text-metadata font-metadata text-secondary break-all">https://factorynerve.os/auth/reset-password?token=fn_550e8400-e29b-41d4-a716-446655440000</code>
</div>
</div>
<div class="flex gap-sm">
<button class="flex-1 h-[42px] bg-primary text-on-primary-fixed font-button text-button rounded-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-sm">
                            Open reset form
                            <span class="material-symbols-outlined text-[18px]">open_in_new</span>
</button>
<button class="px-md h-[42px] border border-primary text-primary font-button text-button rounded-sm hover:bg-primary/5 transition-colors flex items-center justify-center">
<span class="material-symbols-outlined text-[18px]">content_copy</span>
</button>
</div>
</div>
<!-- Action Row -->
<div class="pt-md flex flex-col items-center gap-lg">
<a class="text-button font-button text-primary font-bold hover:text-primary-fixed-dim transition-colors flex items-center gap-xs group" href="#">
<span class="material-symbols-outlined text-[18px] transition-transform group-hover:-translate-x-1">arrow_back</span>
                        Back to sign in
                    </a>
</div>
</div>
<!-- Footer -->
<footer class="mt-auto pt-xl w-full flex justify-between items-center border-t border-outline-variant/30">
<span class="text-metadata font-metadata text-on-surface-variant">© 2026 FactoryNerve Systems</span>
<div class="flex gap-md">
<a class="text-metadata font-metadata text-on-surface-variant hover:text-primary transition-colors" href="#">Privacy</a>
<a class="text-metadata font-metadata text-on-surface-variant hover:text-primary transition-colors" href="#">Terms</a>
<a class="text-metadata font-metadata text-on-surface-variant hover:text-primary transition-colors" href="#">Support</a>
</div>
</footer>
</section>
</main>
<!-- Micro-interactions Script -->
<script>
        // Subtle hover effects for cards
        document.querySelectorAll('.p-md').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-1px)';
                card.classList.add('shadow-sm');
            });
            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0)';
                card.classList.remove('shadow-sm');
            });
            card.style.transition = 'transform 0.2s ease-out, box-shadow 0.2s ease-out';
        });
    </script>
</body></html>

### PASSWORD FORGATE PAGE
<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>FactoryNerve OS - Password Recovery Terminal</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&amp;family=Hanken+Grotesk:wght@400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        body {
            background-color: #0b1326;
            color: #dae2fd;
            -webkit-font-smoothing: antialiased;
        }
        .technical-grid {
            background-image: radial-gradient(rgba(0, 209, 255, 0.1) 1px, transparent 1px);
            background-size: 24px 24px;
        }
    </style>
<!-- Tailwind Configuration -->
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                "surface": "#0b1326",
                "error": "#ffb4ab",
                "inverse-surface": "#dae2fd",
                "inverse-on-surface": "#283044",
                "tertiary-fixed": "#ffddb1",
                "outline": "#859399",
                "on-primary-fixed": "#001f28",
                "surface-container-high": "#222a3d",
                "secondary-fixed-dim": "#b7c8e1",
                "on-secondary": "#213145",
                "error-container": "#93000a",
                "secondary": "#b7c8e1",
                "tertiary-container": "#feb127",
                "on-primary-container": "#00566a",
                "inverse-primary": "#00677f",
                "tertiary": "#ffd59c",
                "surface-tint": "#4cd6ff",
                "surface-dim": "#0b1326",
                "on-primary": "#003543",
                "surface-container": "#171f33",
                "on-tertiary-container": "#6b4700",
                "background": "#0b1326",
                "on-primary-fixed-variant": "#004e60",
                "on-tertiary-fixed-variant": "#624000",
                "on-secondary-fixed-variant": "#38485d",
                "primary-fixed-dim": "#4cd6ff",
                "on-tertiary-fixed": "#291800",
                "primary-container": "#00d1ff",
                "outline-variant": "#3c494e",
                "on-tertiary": "#442b00",
                "on-secondary-container": "#a9bad3",
                "surface-container-low": "#131b2e",
                "on-surface": "#dae2fd",
                "surface-container-highest": "#2d3449",
                "surface-container-lowest": "#060e20",
                "on-secondary-fixed": "#0b1c30",
                "on-error-container": "#ffdad6",
                "on-background": "#dae2fd",
                "surface-variant": "#2d3449",
                "primary-fixed": "#b7eaff",
                "primary": "#a4e6ff",
                "on-surface-variant": "#bbc9cf",
                "secondary-fixed": "#d3e4fe",
                "on-error": "#690005",
                "tertiary-fixed-dim": "#ffba49",
                "secondary-container": "#3a4a5f",
                "surface-bright": "#31394d"
              },
              "borderRadius": {
                "DEFAULT": "0.125rem",
                "lg": "0.25rem",
                "xl": "0.5rem",
                "full": "0.75rem"
              },
              "spacing": {
                "xs": "4px",
                "base": "4px",
                "margin": "24px",
                "xl": "32px",
                "md": "16px",
                "sm": "8px",
                "gutter": "16px",
                "lg": "24px"
              },
              "fontFamily": {
                "metadata": ["JetBrains Mono"],
                "body": ["Hanken Grotesk"],
                "panel-title": ["Hanken Grotesk"],
                "page-title": ["Hanken Grotesk"],
                "label": ["JetBrains Mono"],
                "button": ["Hanken Grotesk"]
              },
              "fontSize": {
                "metadata": ["11px", {"lineHeight": "14px", "letterSpacing": "0.04em", "fontWeight": "400"}],
                "body": ["14px", {"lineHeight": "20px", "letterSpacing": "0em", "fontWeight": "400"}],
                "panel-title": ["16px", {"lineHeight": "20px", "letterSpacing": "0em", "fontWeight": "600"}],
                "page-title": ["18px", {"lineHeight": "24px", "letterSpacing": "0em", "fontWeight": "600"}],
                "label": ["12px", {"lineHeight": "16px", "letterSpacing": "0.02em", "fontWeight": "500"}],
                "button": ["14px", {"lineHeight": "14px", "letterSpacing": "0.02em", "fontWeight": "500"}]
              }
            },
          },
        }
      </script>
</head>
<body class="bg-surface text-on-surface font-body overflow-hidden">
<!-- Top Navigation Bar -->
<header class="h-[56px] w-full flex justify-between items-center px-margin border-b border-outline-variant bg-surface sticky top-0 z-50">
<div class="flex items-center gap-sm">
<span class="material-symbols-outlined text-primary-container" data-icon="corporate_fare">corporate_fare</span>
<div class="flex items-baseline gap-xs">
<span class="font-page-title text-page-title font-bold text-on-surface">FactoryNerve OS</span>
<span class="font-label text-label text-on-surface-variant">DPR.ai</span>
</div>
</div>
<div class="hidden md:flex items-center gap-lg">
<div class="flex flex-col items-end">
<span class="font-label text-label text-on-surface-variant">Steel industry</span>
<span class="font-label text-label text-on-surface-variant uppercase tracking-widest text-[10px]">Factory OS</span>
</div>
<div class="flex items-center gap-sm text-primary-container">
<span class="material-symbols-outlined text-[20px]" data-icon="sensors">sensors</span>
<span class="material-symbols-outlined text-[20px]" data-icon="shield">shield</span>
</div>
</div>
</header>
<!-- Main Workspace -->
<main class="h-[calc(100vh-56px)] w-full flex overflow-hidden">
<!-- Left Context Panel (45%) -->
<section class="hidden lg:flex w-[45%] flex-col bg-surface-container-low relative border-r border-outline-variant overflow-hidden">
<!-- Cinematic Background -->
<div class="absolute inset-0 z-0">
<img alt="Industrial server room" class="w-full h-full object-cover opacity-20 mix-blend-luminosity" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAwjD2ich4V6oEde_U0LY4gEPQziJpL-7EznJfiJeQxYeFIMZ_lTpkuE-wTrb4zZRgDiqulNYdRgM334yJUpopIkMV_kdm43gIEnfGz3OrBuoUlqWLNJC2S5Gj8rzY6pxC8jarmQJHDyW4SsOs07xHO2XHB6Ov0ovhqeFNuvWIf2BDpV4jZChL1S9g0ar8bTpKrqtEcA75cTyfOk-BnFNpF54v_JnR8V0SE5P-BNXlRR1DPCfAVczytzwddAsrtWxzR8Z1D2hZNvWQ"/>
<div class="absolute inset-0 bg-gradient-to-r from-surface via-transparent to-surface/80"></div>
</div>
<div class="relative z-10 p-xl flex flex-col h-full">
<div class="max-w-[440px] w-full flex flex-col gap-xl">
<div class="flex flex-col gap-sm">
<span class="font-label text-label text-primary-container flex items-center gap-xs">
<span class="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
                            Account recovery
                        </span>
<h1 class="font-page-title text-page-title text-on-surface">Recover factory access</h1>
<p class="font-body text-body text-on-surface-variant">Submit your account email to receive a time-limited reset link.</p>
</div>
<!-- Recovery Steps Workflow -->
<div class="flex flex-col gap-md">
<div class="bg-surface-container/60 backdrop-blur-sm p-md border border-primary-container/30 flex gap-md items-start group">
<div class="w-8 h-8 flex items-center justify-center bg-primary-container/10 border border-primary-container/20 text-primary-container font-label text-label">01</div>
<div class="flex flex-col">
<span class="font-panel-title text-panel-title text-on-surface group-hover:text-primary-container transition-colors">Submit email</span>
<span class="font-body text-body text-on-surface-variant">Provide your registered work email.</span>
</div>
</div>
<div class="bg-surface-container-low/40 p-md border border-outline-variant/20 flex gap-md items-start opacity-60">
<div class="w-8 h-8 flex items-center justify-center bg-surface-variant text-on-surface-variant font-label text-label">02</div>
<div class="flex flex-col">
<span class="font-panel-title text-panel-title text-on-surface">Open link</span>
<span class="font-body text-body text-on-surface-variant">Link valid for 30 minutes.</span>
</div>
</div>
<div class="bg-surface-container-low/40 p-md border border-outline-variant/20 flex gap-md items-start opacity-60">
<div class="w-8 h-8 flex items-center justify-center bg-surface-variant text-on-surface-variant font-label text-label">03</div>
<div class="flex flex-col">
<span class="font-panel-title text-panel-title text-on-surface">Set password</span>
<span class="font-body text-body text-on-surface-variant">Configure new security credentials.</span>
</div>
</div>
</div>
<!-- Privacy Posture -->
<div class="mt-auto pt-xl">
<div class="p-md bg-surface-bright/30 border border-outline-variant flex gap-md items-start relative overflow-hidden">
<div class="absolute top-0 right-0 p-2 opacity-10">
<img alt="Security icon" class="w-16 h-16 grayscale" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDfU04FjfYDVH5JPS73ViYCcqA_6JI5PriD_3E_kFoQzWn3oFoa5PgT2zyiWWdsVEYEP7-Gha2fWt4l4ardgMdrYAiwI5Rwp26YtlZ4bZo-iZ_rdnUkDr0jPSwLQDLGO_0wwBcsR_vV-oImLoA7WfqiAlNyW5i-GLzOID7argkOF3EWzhDzytIkqyLZKBJysQ8F4z88bgB4n4WfY0oMmSTUS7VcmiQNJgyVfZ7ozVYXEUIOnt1iA4vhkmH6DUU1td3YyAsVbT8jkUk"/>
</div>
<img alt="Security icon" class="w-10 h-10 object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDfU04FjfYDVH5JPS73ViYCcqA_6JI5PriD_3E_kFoQzWn3oFoa5PgT2zyiWWdsVEYEP7-Gha2fWt4l4ardgMdrYAiwI5Rwp26YtlZ4bZo-iZ_rdnUkDr0jPSwLQDLGO_0wwBcsR_vV-oImLoA7WfqiAlNyW5i-GLzOID7argkOF3EWzhDzytIkqyLZKBJysQ8F4z88bgB4n4WfY0oMmSTUS7VcmiQNJgyVfZ7ozVYXEUIOnt1iA4vhkmH6DUU1td3YyAsVbT8jkUk"/>
<div class="flex flex-col gap-xs">
<span class="font-label text-label text-primary-container">Privacy-safe by design</span>
<p class="font-metadata text-metadata text-on-surface-variant leading-relaxed">All recovery requests are encrypted and audited. Our institutional protocols ensure that your access remains secure within the factory ecosystem.</p>
</div>
</div>
</div>
</div>
</div>
</section>
<!-- Right Form Panel (55%) -->
<section class="flex-1 bg-surface flex items-center justify-center p-margin relative overflow-hidden technical-grid">
<!-- Decorative Accents -->
<div class="absolute top-0 right-0 w-64 h-64 bg-primary-container/5 rounded-full blur-[100px]"></div>
<div class="absolute bottom-0 left-0 w-64 h-64 bg-primary-container/5 rounded-full blur-[100px]"></div>
<div class="w-full max-w-[480px] z-10">
<div class="bg-surface-container border border-surface-bright p-xl shadow-2xl">
<div class="flex flex-col gap-lg">
<!-- Form Header -->
<div class="flex flex-col gap-sm">
<div class="flex items-center gap-sm">
<span class="bg-primary-container/10 text-primary-container px-sm py-[2px] font-label text-[10px] border border-primary-container/30 uppercase tracking-widest">Access terminal</span>
</div>
<h2 class="font-page-title text-page-title text-on-surface">Forgot password</h2>
<p class="font-body text-body text-on-surface-variant">Enter your work email address. If an account exists, you will receive instructions to reset your password.</p>
</div>
<!-- Reset Form -->
<form class="flex flex-col gap-md" id="recoveryForm" onsubmit="handleRecovery(event)">
<div class="flex flex-col gap-xs">
<label class="font-label text-label text-on-surface-variant" for="email">Work email</label>
<div class="relative group">
<input autofocus="" class="w-full h-[48px] bg-surface-container-highest border border-outline-variant text-on-surface px-md font-body focus:border-primary-container focus:ring-1 focus:ring-primary-container/50 outline-none transition-all placeholder:text-on-surface-variant/30" id="email" placeholder="name@factory.ai" required="" type="email"/>
<div class="absolute inset-y-0 right-0 flex items-center pr-md pointer-events-none text-on-surface-variant/40">
<span class="material-symbols-outlined text-[20px]" data-icon="alternate_email">alternate_email</span>
</div>
</div>
</div>
<button class="h-[48px] bg-primary-container text-surface font-button px-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-sm mt-sm shadow-lg shadow-primary-container/20 group" id="submitBtn" type="submit">
<span id="btnText">Send reset link</span>
<span class="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform" data-icon="arrow_forward" id="btnIcon">arrow_forward</span>
</button>
</form>
<!-- Form Footer -->
<div class="pt-lg border-t border-outline-variant/20 flex justify-center">
<a class="font-label text-label text-primary-container hover:text-primary-container/80 flex items-center gap-xs transition-colors" href="/">
<span class="material-symbols-outlined text-[16px]" data-icon="keyboard_backspace">keyboard_backspace</span>
                                Remembered it? Sign in
                            </a>
</div>
</div>
</div>
</div>
</section>
</main>
<!-- Global Footer -->
<footer class="h-[48px] w-full bg-surface-container-lowest border-t border-outline-variant/10 fixed bottom-0 left-0 flex justify-between items-center px-margin z-50">
<span class="font-metadata text-metadata text-on-surface-variant opacity-60">© 2026 FactoryNerve Systems | Secure Access Terminal</span>
<div class="flex gap-lg">
<a class="font-metadata text-metadata text-on-surface-variant hover:text-primary-container transition-colors" href="#">System Status</a>
<a class="font-metadata text-metadata text-on-surface-variant hover:text-primary-container transition-colors" href="#">Privacy Policy</a>
<a class="font-metadata text-metadata text-on-surface-variant hover:text-primary-container transition-colors" href="#">Help Desk</a>
</div>
</footer>
<script>
        function handleRecovery(event) {
            event.preventDefault();
            const btn = document.getElementById('submitBtn');
            const btnText = document.getElementById('btnText');
            const btnIcon = document.getElementById('btnIcon');
            const emailInput = document.getElementById('email');

            // Disable UI
            btn.disabled = true;
            emailInput.disabled = true;
            btn.classList.add('opacity-70', 'cursor-not-allowed');
            
            // Set Busy State
            btnText.textContent = 'Authenticating Request...';
            btnIcon.textContent = 'sync';
            btnIcon.classList.add('animate-spin');

            // Simulate Network delay
            setTimeout(() => {
                // Success State Simulation
                const formContainer = document.getElementById('recoveryForm').parentElement;
                formContainer.innerHTML = `
                    <div class="flex flex-col items-center text-center gap-lg py-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div class="w-16 h-16 rounded-full bg-primary-container/10 border border-primary-container/30 flex items-center justify-center shadow-inner">
                            <span class="material-symbols-outlined text-primary-container text-[32px]" data-icon="mark_email_read">mark_email_read</span>
                        </div>
                        <div class="flex flex-col gap-sm">
                            <h2 class="font-panel-title text-panel-title text-on-surface">Instructional link transmitted</h2>
                            <p class="font-body text-body text-on-surface-variant max-w-[320px] mx-auto">
                                Instructions have been sent to <span class="text-primary-container font-medium">${emailInput.value}</span>. Verification valid for 30 minutes.
                            </p>
                        </div>
                        <button onclick="window.location.reload()" class="h-[42px] border border-primary-container/40 text-primary-container font-button px-lg hover:bg-primary-container/10 transition-all mt-md flex items-center gap-sm">
                            <span class="material-symbols-outlined text-[18px]">refresh</span>
                            Return to terminal
                        </button>
                    </div>
                `;
            }, 2200);
        }
    </script>
</body></html>
``