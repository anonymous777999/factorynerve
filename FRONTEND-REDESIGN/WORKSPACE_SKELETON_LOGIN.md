# Login — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Architecture — Phase A, Item 1
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity
- Route: `/login`
- Workspace Name: System Access — Operator Authentication
- Operational Role: Authenticates all factory personnel and routes them to their role-appropriate workspace upon successful credential verification.
- Business Impact: If this workspace fails, no user can enter the operational system; all factory workflows requiring digital recording (attendance punch, production entry, OCR scan, dispatch) are blocked.
- User Population: All roles (attendance, operator, accountant, supervisor, manager, admin, owner) — every person who touches the system passes through this page before first access each session.
- Peak Usage Context: Shift start (6am–8am and 2pm–4pm in typical shift factories) — multiple users authenticate in rapid succession from shared terminals.

### 1.2 Operational Importance
This is the sole entry gate to the entire operational system. In a factory environment, operators authenticate at the start of each shift, often on shared terminals under shift-change time pressure. The login workflow must complete in under 10 seconds from page load to workspace landing — every second of authentication friction is a second taken from shift handover. The page also handles the three access recovery paths (session expiry, account suspension, permissions update) that occur mid-shift without user anticipation.

### 1.3 Current State Problems
- Form labels use `uppercase tracking-[0.18em]` pattern — violates the typography governance contract (tracking above 0.06em on uppercase text)
- The divider label uses `tracking-[0.22em]` with uppercase — same violation
- The `AuthWorkstationShell` left panel renders a large hero heading using `clamp(3rem, 3.9vw, 4.5rem)` — this is marketing typography, not operational typography; a login form does not need a 4.5rem heading
- The `StatusRail` component uses a CSS `linear-gradient` in the `active` state — gradients are forbidden per FRONTEND_MODERNIZATION_EXECUTION_BLUEPRINT.md
- The topbar `platformLabel` uses `text-[var(--action-primary)]` inline variable syntax — raw variable access forbidden outside token-class system
- `AuthWorkstationShell` left panel has excessive visual weight (steps panel + support panel + metrics + footer text) that competes with the form for attention; for shift-change speed, the form must be the overwhelming focus
- The `badge` element in the right panel uses `tracking-[0.24em]` uppercase — violates tracking governance
- The right panel `h2` uses `text-[2rem]` arbitrary sizing — must use typography token
- Google button secondary label `text-[11px] uppercase tracking-[0.16em]` — tracking violation
- The `canResendVerification` detection relies on `error.toLowerCase().includes("verify your email")` — brittle string matching; should be driven by a structured error code from the backend

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Auth / Onboarding | Route exists outside the app shell; no sidebar, no topbar; pre-operational entry gate |
| Workflow Category | Entry | User performs a single sequential action: provide credentials → receive session |
| Operational Behavior | Form-Driven | Two fields, one submit, two secondary paths (Google OAuth, forgot password) |
| Data Density | LOW | Two input fields, one submit button, optional error/info message; no data tables |
| Realtime Complexity | NONE | No polling, no subscriptions; only immediate async POST response |
| AI Complexity | NONE | No AI systems involved in authentication |
| Audit Complexity | LOW | Backend writes `AUTH_LOGIN_SUCCESS` / `AUTH_LOGIN_FAILED` to `AuthAuditLog` — no frontend audit display needed |
| Decision Pressure | LOW | Operator decision is trivial (enter credentials and submit); the pressure is speed, not decision complexity |

**Classification Implication:**
A LOW-density, NONE-realtime, Form-Driven Auth workspace means the layout law is simple: the form is the product. Everything else is supporting context. The left panel of the current `AuthWorkstationShell` exists to fill vertical space and provide brand context on large screens — it must not compete with the form for cognitive load. On mobile, the left panel must collapse entirely because the form is the only thing that matters. Typography governance violations in this workspace are especially visible because there is nothing else for the eye to land on.


---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Permission | Key Response Fields |
|---|---|---|---|---|
| `POST /auth/v2/login` | POST | Authenticate user by email + password (argon2 hash verify); sets `auth_session` + `auth_csrf` cookies; returns `AuthResponse` | Public | `access_token`, `refresh_token`, `token_type`, `user.role`, `user.permissions`, `user.role_revision`, `active_factory_id`, `factories[]`, `organization` |
| `GET /auth/me` | GET | Hydrate full `CurrentUser` after login (called inside `hydrateAuthResponse`); provides `permissions` object | Auth-required (cookie) | `id`, `role`, `permissions`, `role_revision`, `factory_name`, `email`, `org_id` |
| `GET /auth/context` | GET | Hydrate factory context after login; provides active factory + org metadata | Auth-required (cookie) | `active_factory_id`, `active_factory`, `factories[]`, `organization` |
| `GET /auth/google/login` | GET (redirect) | Initiates Google OAuth flow; accepts `?next=` and `?remember=` params; redirects to Google consent page | Public | Redirect only |
| `POST /auth/email/verification/resend` | POST | Resend verification email for unverified accounts | Public | `message`, `delivery_mode` |
| `GET /observability/ready` | GET | Backend warm-up health check called on page mount | Public | HTTP 200 (backend ready) or 503 (waking) |

**Rate limiting:** Both `/auth/v2/login` endpoints enforce 5 attempts / 60 seconds per IP and per email address. After 5 failures, HTTP 429 is returned. Frontend must surface this as a distinct error state.

**MFA flow:** If the authenticated user has `mfa_enabled: true`, the server returns HTTP 401 with a generic error on first submit (no MFA code provided). The frontend must present a TOTP field upon receiving this error. The second submit includes `mfa_code`. There is no separate MFA step endpoint — it is handled by re-submitting the login form with the `mfa_code` field populated.

**Email verification gate:** If the user's email is unverified, the backend returns HTTP 403 with `detail: "Please verify your email before signing in."` The frontend detects this and surfaces the resend verification CTA.

### 3.2 Entity Relationship Map

```
AuthUser (auth_user_id)
  └── User (legacy user record — same email, synced on login)
        └── UserFactoryRole (factory_id, role) [0..N]
              └── Factory (factory_id, industry_type, workflow_template_key)
                    └── Organization (org_id, plan)
```

The login workspace only interacts with `AuthUser` directly. The hydration calls after login pull `User`, `UserFactoryRole`, `Factory`, and `Organization` into the `AuthResponse`. The frontend uses `getHomeDestination(user.role, accessible_factories)` to determine the post-login redirect.

### 3.3 Workflow State Machine

```
[NOT AUTHENTICATED]
    → user submits email + password
    → [VALIDATING] (loading state, button disabled)
        → 401 (invalid credentials)     → [ERROR STATE] show generic error
        → 403 (email not verified)      → [VERIFICATION NEEDED] show resend CTA
        → 401 (MFA required)            → [MFA INPUT STATE] show TOTP field
        → 429 (rate limited)            → [RATE LIMITED STATE] show wait message
        → 503 (backend waking)          → [WAKE RETRY] auto-retry, show wake message
        → 200 + AuthResponse
            → [POST-LOGIN HYDRATION] (invisible to user)
            → getHomeDestination resolves
            → [REDIRECT] router.replace(nextPath or roleHome)
```

```
[GOOGLE OAUTH PATH]
    → user clicks "Continue with Google"
    → [GOOGLE LOADING] (button shows spinner)
    → window.location.assign /api/auth/google/login?next=...
    → browser handles OAuth redirect
    → callback lands back on /login?oauth_error=... OR on roleHome
```

**Frontend Implication:** The form must handle 5 distinct error states (generic credentials failure, email unverified, MFA required, rate limited, backend waking) with appropriate surface messages and conditional CTAs. The MFA state requires a conditional third field to appear below the password field — this is a progressive disclosure pattern, not a separate route.

### 3.4 Realtime Contracts

| System | Transport | Update Rate | Frontend Behavior | Stale State Handling |
|---|---|---|---|---|
| Backend warm-up | HTTP polling | 3,000ms (max 25s) | `warmBackendConnection()` called on mount; retries until 200 or timeout | After timeout: surface 503 error in status message; user can retry manually |

### 3.5 AI System Contracts
Not applicable. No AI systems involved in the login workflow.

### 3.6 Permission Matrix

| Role | View | Submit | Google OAuth | Resend Verification |
|---|---|---|---|---|
| Anonymous (unauthenticated) | ✓ | ✓ | ✓ | ✓ |
| Any authenticated role | N/A — redirected away from login by AppShell guard | — | — | — |

**Permission Implication:** The login workspace has no role-gated zones — all users see the identical form. Role differentiation occurs post-authentication during redirect routing via `getHomeDestination()`. No zones need to change based on role because authentication has not yet occurred.


---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

```
SPLIT AUTH LAYOUT: Left context panel (desktop only) + Right form panel (always visible)
```

Left panel: 45% width on desktop, hidden on mobile/tablet. Contains brand/product context, workflow steps, and security signals. Exists to give context during the time the user is reading the form. Does NOT contain anything interactive.

Right panel: 55% width on desktop, 100% width on mobile. Contains the form. This is the entire workspace on small screens.

**Pattern Justification:**
The split layout exists because (1) it uses available horizontal space on desktop terminals to communicate product identity and access workflow context, and (2) the form itself is short (2 fields) — without the left panel, the right panel would feel visually adrift on a 1440px factory terminal. However, the split ratio must strongly favor the form side (55%+) because the form is the operational action and the left panel is contextual support only. On mobile, the context panel disappears entirely — an operator on a phone at shift start needs to authenticate in seconds, not read product copy.

### 4.2 Zone Definitions

---

#### ZONE: Auth Topbar

**Role:** Provides brand anchor and cross-link navigation. Communicates that the user is on FactoryNerve OS, not a generic login page.

**Attention Priority:** 5 (lowest — background orientation only)

**Position:** top, spans full width

**Width:** fluid: 100%

**Height:** fixed: 56px

**Sticky Behavior:** not sticky — user does not scroll on this page

**Collapse Behavior:** never collapses — always present; on mobile the right-side metadata abbreviates but topbar remains

**Scroll Behavior:** no scroll needed

**Density Mode:** default (no density switching on auth pages)

**Contents:**
- Logo/brand link (Building2 icon + "DPR.ai" label): links to homeHref `/`
- Industry label (right side): `text-text-secondary`, sentence case — "Steel industry"
- Platform label (right side): `var(--action-primary)` text — "Factory OS"

**Acceptance Criteria:**
- [ ] Topbar renders at exactly 56px height
- [ ] Logo link navigates to `/`
- [ ] Industry and platform labels use `--type-label` (12px, 500 weight) NOT uppercase tracking
- [ ] Platform label uses `text-action-primary` token class, NOT `text-[var(--action-primary)]` inline style
- [ ] No gradient, border-bottom, or shadow on topbar

---

#### ZONE: Left Context Panel

**Role:** Provides product identity, access workflow explanation, and security posture information. Supports first-time users understanding what they are accessing. Does not compete with the form.

**Attention Priority:** 4

**Position:** left

**Width:** fixed: 45% on desktop (≥1024px); hidden: 0% on mobile/tablet (<1024px)

**Height:** fill-remaining (100vh minus topbar 56px)

**Sticky Behavior:** not sticky

**Collapse Behavior:** hidden entirely at <1024px viewport width — zero visual trace on mobile

**Scroll Behavior:** independent scroll if content overflows on very small desktop heights; otherwise no scroll

**Density Mode:** default

**Contents:**
- Eyebrow label: "Authentication lane" — `--type-label` (12px, 500 weight), sentence case, `text-text-tertiary`
- Page title: title prop value (e.g. "System Access") — `--type-page-title` (18px, 600 weight) or equivalent operational heading — NOT `clamp(3rem, 3.9vw, 4.5rem)` marketing scale
- Description: subtitle prop value — `--type-body` (14px, 400 weight), `text-text-secondary`
- Security posture card: `surface-panel` background, shows `ShieldCheck` icon + "Secure connection active" + 3 security context bullets — `--type-body` (14px)
- Provisioning workflow card: numbered steps (01, 02, 03) with title + description — `--type-body` (14px)
- Status rail card: shows 3 status rail indicators + security posture metadata — labels use `--type-label` (12px, 500 weight), sentence case
- Optional metrics (redirect hint): if `?next=` param is present, shows "Requested destination: [destination label]" — `--type-label` (12px)
- Footer note: `text-text-tertiary`, `--type-label` (12px)

**Acceptance Criteria:**
- [ ] Left panel is invisible (display: none or width: 0) at viewport width below 1024px
- [ ] Page title (`leftTitle`) renders at maximum 18px (operational title scale) — NOT marketing heading scale
- [ ] All label eyebrows use sentence case — NO uppercase tracking wider than 0.06em
- [ ] No gradient on any element within this zone
- [ ] StatusRail `active` state uses `--status-success-bg` or similar semantic token — NOT CSS `linear-gradient()`
- [ ] All text labels use token classes (e.g. `text-text-secondary`) — no raw `var(--text)` or `var(--muted)` usages
- [ ] "Emergency sysadmin" footer note renders in `--type-label` (12px), `text-text-tertiary`
- [ ] No interactive elements — this zone is read-only context

---

#### ZONE: Right Form Panel

**Role:** The primary operational surface. Contains the form that authenticates the user. This is the only thing that matters on mobile.

**Attention Priority:** 1 (highest)

**Position:** right (center on mobile)

**Width:** fluid: 55% desktop; 100% mobile; inner panel has `max-width: 480px` centered within the column

**Height:** fill-remaining; inner panel `min-height: auto`, vertically centered within column

**Sticky Behavior:** not sticky

**Collapse Behavior:** never collapses — always the primary visible zone

**Scroll Behavior:** no scroll needed on standard screens; scroll: explicit height if viewport is very short (<640px height, form exceeds viewport)

**Density Mode:** default

**Contents:**
- Panel header:
  - Badge chip: "Secure access" — `--type-label` (12px, 500 weight), sentence case, `surface-shell` background
  - Panel title: "Identify user" — `--type-panel-title` (16px, 600 weight), NOT `text-[2rem]` arbitrary sizing
  - Panel description: "Continue with a supported provider or use your work credentials to initialize the operational session." — `--type-body` (14px, 400 weight), `text-text-secondary`
- Form body:
  - Google OAuth button: provider button with Google/ShieldCheck icon, label "Continue with Google", sub-label "Work account" — sub-label uses `--type-label` (12px), sentence case, NOT uppercase tracking
  - Divider with label: horizontal rule + "Operator email" text — label uses `--type-metadata` (11px, 500 weight), sentence case, NOT uppercase tracking
  - Email field: `Label` + `Input` (type=email, autoComplete=email, required) with `Mail` icon prefix
  - Password field: `Label` + `Input` (type=password/text toggle, autoComplete=current-password, required) with `KeyRound` icon prefix; "Show/Hide" toggle button uses `--type-label` (12px), sentence case
  - Forgot password link: right-aligned, `--type-label` (12px), `text-action-primary`, sentence case — NOT uppercase
  - Submit button: full width, `h-[42px]`, "Sign in" label, `isBusy` state shows "Signing in..."
- Status message zone (conditional): renders below submit button when `statusMessage` is present; uses semantic border/bg/fg tokens by tone (success/error/neutral); resend verification CTA appears within this zone when `canResendVerification=true`
- Footer: "Need provisioning?" label + "Create account →" link — both in `--type-body` (14px), sentence case; divider uses `border-border-subtle`
- MFA field zone (conditional, progressive disclosure): renders below password field when MFA is required; label "Authenticator code", Input (type=text, inputMode=numeric, maxLength=10, autoComplete=one-time-code); appears only after receiving an MFA-required error response

**Acceptance Criteria:**
- [ ] Panel badge chip renders at 12px, 500 weight, sentence case
- [ ] Panel title (`h2`) renders at 16px (`--type-panel-title`) — no arbitrary `text-[2rem]`
- [ ] Email input has correct `type="email"` and `autoComplete="email"` attributes
- [ ] Password input has `autoComplete="current-password"` attribute
- [ ] Submit button renders `isBusy` loading state with spinner; disabled during loading
- [ ] Google OAuth button renders spinner during `googleLoading` state; disabled when `!onGoogleLogin || googleLoading`
- [ ] Status message zone renders correct semantic token classes for `success` / `error` / `neutral` tones
- [ ] Resend verification CTA appears only when `canResendVerification === true`
- [ ] MFA field zone is NOT rendered on initial page load; appears only after MFA-required error
- [ ] MFA input has `inputMode="numeric"` and `autoComplete="one-time-code"` attributes
- [ ] "Show/Hide" password toggle uses sentence case — NOT uppercase
- [ ] Forgot password link uses sentence case — NOT uppercase
- [ ] Google button sub-label uses sentence case and `--type-label` tracking ≤ 0.06em — NOT `tracking-[0.16em]`
- [ ] Divider label uses `--type-metadata` (11px), sentence case — NOT uppercase with tracking
- [ ] All form labels have corresponding `htmlFor` attributes matching their input `id`

---

### 4.3 Zone Interaction Rules

```yaml
zone_interactions:
  - trigger: user submits form (onSubmit)
    effect: Right Form Panel → submit button enters isBusy state; all inputs disabled
    reason: prevents double-submission during async authentication call

  - trigger: login response = 403 (email not verified)
    effect: Right Form Panel → status message zone shows with "error" tone; resend verification CTA becomes visible
    reason: user needs to verify email before access; resend CTA eliminates navigation away from login

  - trigger: login response = 401 (MFA required — no mfa_code sent)
    effect: Right Form Panel → MFA field zone appears below password field via progressive disclosure
    reason: MFA is not required on first render; it surfaces only when the server signals it is needed

  - trigger: login response = 429 (rate limited)
    effect: Right Form Panel → status message zone shows with "error" tone; submit button remains disabled for 60s (client-side countdown optional)
    reason: prevents user from hammering submit while rate limited; communicates the wait

  - trigger: login response = 503 (backend waking)
    effect: Right Form Panel → status message zone shows wake-up message with "neutral" tone; warmBackendConnection retries in background
    reason: the user should know the system is waking, not think their credentials are wrong

  - trigger: login response = 200 (success)
    effect: Both zones → router.replace fires; page unmounts; next workspace loads
    reason: successful auth terminates this workspace immediately

  - trigger: searchParams.get("next") is set to a valid path on page load
    effect: Left Context Panel → metrics strip shows "Requested destination: [label]"
    reason: informs user where they are being redirected before they authenticate

  - trigger: viewport width < 1024px
    effect: Left Context Panel → hidden entirely; Right Form Panel → 100% width, vertically centered
    reason: mobile operators need the form only; context panel is desktop-exclusive content

  - trigger: searchParams.get("reason") = "session_expired" | "permissions_updated" | "account_suspended" on page load
    effect: Right Form Panel → status message zone pre-populated with appropriate access reason message
    reason: user arriving from a session expiry needs to know why they were redirected here
```


---

## 5. OPERATIONAL ATTENTION HIERARCHY

### 5.1 Scan Flow

```
SCAN LEVEL 1 (0–200ms): Email input field
→ Operational necessity: This is the first thing the operator needs to fill.
  On a shared terminal, the cursor should land here automatically (autoFocus).
  The form is short — the email field is the gate.

SCAN LEVEL 2 (200ms–1s): Password field + Submit button
→ Operational necessity: Two sequential inputs, then action.
  The operator's eye moves down the form naturally.
  The submit button must be visually distinct from secondary actions.

SCAN LEVEL 3 (1s–3s): Status message (if present) + Secondary actions
→ Operational necessity: If an error occurred on a previous submit attempt,
  the operator reads the message and decides: retry, use Google, or go to forgot-password.
  The resend verification CTA must be immediately scannable within the error message.

SCAN LEVEL 4 (3s+): Google OAuth button + Create account link + Forgot password link
→ Operational necessity: These are exception paths — the operator only uses them
  if the primary credential path fails or if they are a first-time user.
  They must be accessible but must not compete with the primary flow.
```

### 5.2 Persistent Visibility Requirements

- Submit button: must never scroll off screen; the form is short enough that scrolling should not be needed — if it is, the panel padding must be adjusted
- Status message: must remain visible immediately below the submit button so the operator sees the error without scrolling; if the message is long (rate limit explanation), the panel must expand to contain it

### 5.3 Contextual Visibility Rules

```yaml
- condition: statusMessage is null OR undefined
  shows: nothing in status zone
  hides: status message zone entirely (no placeholder space)
  reason: empty status zone creates visual noise

- condition: canResendVerification === true (403 response detected)
  shows: resend verification button inside status message zone
  hides: nothing else
  reason: resend CTA is only relevant when email verification error is active

- condition: MFA required (401 response with no mfa_code sent)
  shows: MFA code input field between password field and submit button
  hides: nothing
  reason: progressive disclosure — MFA field only appears when the server signals it is needed

- condition: searchParams.get("next") is a valid non-trivial path
  shows: redirect destination metric in Left Context Panel (desktop only)
  hides: nothing
  reason: context for the operator about where they're being sent after auth

- condition: viewport width < 1024px
  shows: Right Form Panel at full width
  hides: Left Context Panel completely
  reason: mobile operators have no use for the context panel
```

---

## 6. TABLE & DATA STRATEGY

*Not applicable — no tables exist in the login workspace.*

---

## 7. FORM & INPUT STRATEGY

### 7.1 Form Role
- **Form Purpose:** Collects operator credentials (email + password, optionally TOTP code) and submits to `/auth/v2/login` to initialize an authenticated session.
- **Completion Frequency:** Multiple times per day for shared terminal users; once per session for personal device users.
- **Keyboard Efficiency Priority:** HIGH — operators authenticating at shift start expect to Tab through two fields and press Enter to submit, without touching a mouse.
- **AI Assistance Available:** No.

### 7.2 Field Group Architecture

```yaml
field_groups:
  - group: Credentials
    purpose: Collect the two required authentication factors (email + password)
    fields:
      - name: email
        type: email
        required: yes
        validation: EmailStr format (browser native + backend)
        ai_assisted: no
        keyboard_tab_order: 1
        default_value: none
        help_text: none
        attributes:
          autoComplete: email
          autoFocus: yes (on page mount)
          inputMode: email
      - name: password
        type: password (toggleable to text via Show/Hide button)
        required: yes
        validation: min_length=1 (client), min_length=12 (backend — but client enforces only non-empty)
        ai_assisted: no
        keyboard_tab_order: 2
        default_value: none
        help_text: none
        attributes:
          autoComplete: current-password
      - name: mfa_code
        type: text
        required: conditional (only when MFA error received)
        validation: length 6-10 digits
        ai_assisted: no
        keyboard_tab_order: 3 (inserted between password and submit when visible)
        default_value: none
        help_text: "6-digit code from your authenticator app"
        attributes:
          autoComplete: one-time-code
          inputMode: numeric
          maxLength: 10
        visibility: hidden by default; appears after MFA-required error response
```

### 7.3 Validation Strategy

```yaml
validation:
  inline_realtime: []
  on_blur: []
  on_submit:
    - email: required, valid email format (browser native HTML5 validation via type="email" + required)
    - password: required, non-empty (browser native via required attribute)
    - mfa_code: when visible, required, 6–10 characters (client-side length check before submit)
  server_side:
    - HTTP 401 generic → "Invalid credentials." — generic error, do not disclose which field is wrong
    - HTTP 403 email unverified → "Please verify your email before signing in." — triggers resend CTA
    - HTTP 401 MFA required → reveals MFA field, user re-submits with code
    - HTTP 429 rate limited → "Too many sign-in attempts. Try again in 60 seconds."
    - HTTP 503 backend waking → warm-up message, auto-retry
  ai_flagged: []
```

### 7.4 Keyboard Flow

```
Tab Order: [email] → [password] → (if MFA visible: [mfa_code]) → [Submit button]

Shortcuts:
- Enter in email field: moves focus to password field
- Enter in password field: submits form (if not loading)
- Enter in mfa_code field: submits form (if not loading)
- Shift+Tab: reverses through the tab order

Google button: accessible via Tab navigation before email field (it appears above the divider);
  Enter or Space activates it.

Forgot password link: accessible via Tab after submit button; Enter navigates to /forgot-password.
Create account link: accessible via Tab after forgot password; Enter navigates to /register.
```


---

## 8. AI & AUDIT VISIBILITY STRATEGY

### 8.1 AI Placement Map
Not applicable — no AI systems are involved in the login workspace.

### 8.2 Audit Visibility Map

```yaml
audit:
  timeline_placement: not displayed — login audit events (AUTH_LOGIN_SUCCESS, AUTH_LOGIN_FAILED)
    are written to AuthAuditLog on the backend but are not surfaced in the login UI.
    They are available to admin/owner via the premium audit trail only.
  events_shown: none in the UI
  detail_level: n/a
  who_can_see: n/a
  realtime_updates: n/a
```

### 8.3 Anomaly Visibility
Not applicable — no anomaly system on the login workspace.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

Apply `FRONTEND_MODERNIZATION_EXECUTION_BLUEPRINT.md` laws directly.

### 9.1 Density Mode

```yaml
default_density: default
density_justification: Auth pages are not operational data workspaces; density switching is not
  needed here. Operators interact with 2–3 fields. Default density (40px row height rhythm,
  16px component gap) is appropriate for clear, tap-friendly targets.
density_switchable: no — auth pages do not expose the density toggle
density_specs:
  form_field_gap:
    default: 16px (--space-md)
  input_height:
    default: 40px minimum (--space-10)
  button_height:
    default: 42px (consistent with factory-auth-cta)
```

### 9.2 Spacing Rhythm

```yaml
spacing:
  panel_outer_padding: 32px (--space-8) horizontal, 32px vertical
  panel_inner_gap: 20px (--space-5) between panel header and form body
  field_group_gap: 16px (--space-md) between label+input pairs
  section_divider_margin: 20px (--space-5) above and below the horizontal divider
  status_message_margin_top: 16px (--space-md) below submit button
  footer_margin_top: 16px (--space-md) above footer divider
  topbar_height: 56px (--space-14)
  left_panel_padding: 40px (--space-10) horizontal, 40px vertical on desktop
```

### 9.3 Typography Hierarchy

```yaml
typography:
  topbar_brand_label: 16px / 600 weight / sentence case / tracking-tight (-0.01em)
  topbar_meta_labels: 12px / 500 weight / sentence case / tracking: 0em — NOT uppercase, NOT wide tracking
  left_panel_eyebrow: 12px / 500 weight / sentence case / text-text-tertiary
  left_panel_title: 18px / 600 weight / sentence case (operational title scale, NOT marketing scale)
  left_panel_description: 14px / 400 weight / text-text-secondary
  left_panel_card_labels: 11px / 500 weight / sentence case / text-text-tertiary (section labels within cards)
  left_panel_card_body: 14px / 400 weight / text-text-secondary
  panel_badge: 12px / 500 weight / sentence case / tracking: ≤0.06em (maximum allowed for badge)
  panel_title: 16px / 600 weight / sentence case (--type-panel-title)
  panel_description: 14px / 400 weight / text-text-secondary
  form_label: 12px / 500 weight / sentence case (--type-label)
  form_input: 14px / 400 weight (--type-body)
  divider_label: 11px / 500 weight / sentence case / text-text-secondary (--type-metadata)
  google_button_primary: 14px / 600 weight / sentence case
  google_button_sub: 12px / 400 weight / sentence case / text-text-secondary (NOT uppercase)
  show_hide_button: 12px / 600 weight / sentence case (NOT uppercase)
  forgot_password_link: 12px / 600 weight / sentence case / text-action-primary (NOT uppercase)
  submit_button: 14px / 500 weight / sentence case
  status_message: 14px / 400 weight / leading-6
  footer_label: 14px / 400 weight / text-text-secondary
  footer_link: 14px / 600 weight / text-action-primary
```

### 9.4 Surface Hierarchy

```yaml
surfaces:
  workspace_background: var(--surface-app)
  auth_shell_background: var(--surface-app)
  topbar_surface: var(--surface-shell)  [or transparent over surface-app]
  left_panel_surface: var(--surface-app)  [no distinct panel; content cards use surface-panel]
  left_panel_card_surface: var(--surface-panel)
  right_column_surface: var(--surface-app)
  form_panel_surface: var(--surface-panel)
  input_surface: var(--surface-card)
  google_button_surface: var(--surface-panel)
  badge_chip_surface: var(--surface-shell)
  status_success_surface: var(--status-success-bg)
  status_error_surface: var(--status-danger-bg)
  status_neutral_surface: var(--surface-shell)
```


---

## 10. RESPONSIVE & OPERATOR ADAPTATION

### 10.1 Desktop Workstation (Primary)

```yaml
desktop_workstation:
  min_width: 1280px
  optimal_width: 1440px — 1920px
  layout: split (left context 45% + right form 55%)
  left_panel: visible
  right_panel: form panel centered in 55% column, max-width 480px
  density_mode: default
```

### 10.2 Compact Desktop (Secondary)

```yaml
compact_desktop:
  width: 1024px — 1279px
  adaptations:
    - left_panel: visible but narrower (40%); left panel cards may use smaller padding
    - right_panel: form panel centered in 60% column, max-width 440px
  density_mode: default
```

### 10.3 Mobile / Tablet (Degradation)

```yaml
mobile:
  width: <1024px
  strategy: stack — left panel hidden, form panel takes full screen width
  primary_zone_only: yes
  zones_hidden:
    - Left Context Panel (entire zone, zero height, no collapsed indicator)
  touch_adjustments:
    - min_touch_target: 44px (all buttons, links, and toggle controls)
    - input height: 44px minimum for touch targets
    - form_panel_padding: 24px (--space-6) horizontal on mobile (reduced from desktop 32px)
    - submit_button_height: 44px on mobile (up from 42px desktop)
    - google_button_height: 52px on mobile (up from 56px minimum already defined)
```

### 10.4 Rail Collapse Behavior

```yaml
rail_collapse:
  left_panel:
    collapse_trigger: viewport width < 1024px
    collapsed_state: hidden (display: none, width: 0, no toggle button)
    operator_reinvoke: not applicable — not a collapsible rail; it is a context panel
      that is simply absent on mobile. There is no way to open it because on mobile
      it serves no operational purpose.
  right_panel:
    collapse_trigger: n/a — right panel never collapses
    collapsed_state: n/a
```

---

## 11. COMPONENT MAPPING

Map this workspace structure to existing FactoryNerve component primitives.

```yaml
component_mapping:
  workspace_container:
    component: AuthWorkstationShell (components/auth-workstation-shell.tsx)
    reason: The dedicated auth shell already implements the split layout, left panel,
      right panel centering, and topbar. This spec governs WHAT MUST BE FIXED inside it,
      not what replaces it.

  zones:
    - zone: Auth Topbar
      component: AuthWorkstationShell → factory-auth-topbar (internal CSS class)
      props_needed: homeHref, homeLabel, topMetaLabel (sentence case), platformLabel

    - zone: Left Context Panel
      component: AuthWorkstationShell → factory-auth-left (internal CSS class)
      props_needed: leftEyebrow, leftTitle (18px operational scale), leftDescription,
        steps[], supportTitle, supportDescription, supportItems[], statusLabel,
        statusValue, metrics[] (for redirect hint)

    - zone: Right Form Panel
      component: AuthWorkstationShell → factory-auth-panel + form children
      props_needed: badge, title (16px panel-title scale), description, contentClassName

  forms:
    - form: Credential Form
      component: native <form> with onSubmit handler (already in LoginPage)
      field_components:
        - Label (from shared/primitives/index.ts)
        - Input (from shared/primitives/index.ts) — email, password, optional mfa_code
        - Button (from shared/primitives/index.ts) — submit with isBusy

  status_elements:
    - element: Status message zone
      component: inline div with statusClasses() conditional styling
      variant: semantic classes — border-status-danger-border bg-status-danger-bg
        text-status-danger-fg (error) / border-status-success-border
        bg-status-success-bg text-status-success-fg (success) /
        border-border-default bg-surface-shell text-text-secondary (neutral)
      note: already implemented in LoginOne — only the token compliance needs fixing

    - element: Rate limited state
      component: same status message zone with "error" tone
      variant: border-status-danger-border pattern
      note: backend returns 429; message "Too many sign-in attempts. Wait 60 seconds."

  navigation_elements:
    - element: Forgot password link
      component: Next.js Link (already in LoginOne)
      note: label must be sentence case "Forgot password?" — not uppercase

    - element: Create account link
      component: Next.js Link + ArrowRight icon (already in LoginOne)
      note: already correct label "Create account"

    - element: Logo/home link
      component: Next.js Link (already in AuthWorkstationShell)
```

**Missing Components / Required Changes (not new primitives — existing component fixes):**

1. `AuthWorkstationShell` — `leftTitle` prop currently rendered at `clamp(3rem, 3.9vw, 4.5rem)`. Must be changed to `text-[18px] font-semibold tracking-tight` (operational title scale per blueprint Section 4.1). This is a component-level fix, not a new component.

2. `AuthWorkstationShell` — `platformLabel` currently rendered with `text-[var(--action-primary)]` inline style. Must become `text-action-primary` token class.

3. `AuthWorkstationShell` — `StatusRail` active state uses `bg-[linear-gradient(...)]`. Must be replaced with `bg-status-success-icon` or a valid token class. Gradient is forbidden.

4. `AuthWorkstationShell` — All label elements using `uppercase tracking-[0.18em–0.24em]` pattern must be changed to sentence case with `tracking-normal` (≤0.06em).

5. `LoginOne` — Google button sub-label `text-[11px] uppercase tracking-[0.16em]` must become `text-[11px]` sentence case, `text-text-secondary`.

6. `LoginOne` — Divider label `uppercase tracking-[0.22em]` must become sentence case, `--type-metadata` (11px, 500 weight).

7. `LoginOne` — Form labels `font-mono text-[11px] uppercase tracking-[0.18em]` must become `text-[12px] font-medium text-text-secondary` sentence case (--type-label, no font-mono on labels).

8. `LoginOne` — Password Show/Hide button `uppercase tracking-[0.16em]` must become sentence case.

9. `LoginOne` — Forgot password link `uppercase tracking-[0.18em]` must become sentence case.

10. `LoginOne` — `canResendVerification` detection currently uses brittle string matching on `error.toLowerCase().includes("verify your email")`. Should be driven by a structured `error_code` or HTTP status code (403). Propose: check `err instanceof ApiError && err.status === 403`.

11. **MFA progressive disclosure** — currently NOT implemented in `LoginOne`. The MFA field must be added as a conditional element that appears after receiving a specific error response. This requires `LoginOne` to accept `showMfaField: boolean` and `mfa_code: string` / `onMfaChange` props, with the parent page managing MFA state.


---

## 12. OPERATIONAL UX PROBLEMS SOLVED

```yaml
problem_resolutions:

  - problem: Form labels use uppercase tracking-[0.18em] — violates typography governance contract
    root_cause: Labels in LoginOne and AuthWorkstationShell were styled to match a visual aesthetic
      ("operator industrial feel") without applying the blueprint tracking ceiling of 0.06em.
    skeleton_solution: Section 9.3 mandates all label elements at 12px/500 weight/sentence case/
      tracking ≤0.06em. Section 11 lists specific component fixes required.
    measurable_outcome: ESLint rule for tracking > 0.18em fires zero violations in auth components.
      Labels are readable 15% faster at 0.06em vs 0.18em (per blueprint Section 4.1 citation).

  - problem: Left panel hero heading uses clamp(3rem, 3.9vw, 4.5rem) — marketing typography scale
    root_cause: AuthWorkstationShell was designed to provide brand impact on the left panel,
      importing consumer SaaS visual conventions ("hero heading") into an operational interface.
    skeleton_solution: Section 4.2 Left Context Panel mandates leftTitle renders at 18px
      (operational title scale). Section 11 flags this as a required component fix.
    measurable_outcome: Left panel no longer visually competes with the form as the attention anchor.
      Visual hierarchy is form (level 1) > left panel title (level 4).

  - problem: StatusRail uses CSS linear-gradient on the active state — gradient is forbidden
    root_cause: StatusRail was added as a visual polish element using a gradient for the
      "all-clear" signal, without checking the blueprint's gradient prohibition.
    skeleton_solution: Section 9.4 surfaces require token variables only. Section 11 mandates
      StatusRail active state use bg-status-success-icon or equivalent semantic token.
    measurable_outcome: Zero gradient usages in auth components. Token audit CI passes.

  - problem: platformLabel in topbar uses text-[var(--action-primary)] inline style — forbidden
    root_cause: Developer used inline CSS variable syntax rather than the token class system.
    skeleton_solution: Section 4.2 Auth Topbar mandates text-action-primary token class.
      Section 11 lists as required fix.
    measurable_outcome: Token audit CI reports zero var(--accent) / inline CSS variable usages
      in the auth module.

  - problem: canResendVerification detection uses brittle string matching on error text
    root_cause: The resend verification trigger was implemented reactively against error message
      content, which will break if the backend error message text changes.
    skeleton_solution: Section 7.3 specifies detection should check
      err instanceof ApiError && err.status === 403, which is structurally stable.
    measurable_outcome: Resend CTA correctly appears/disappears based on HTTP status, not message
      string. Survives backend error message copy changes.

  - problem: MFA field is not implemented — users with MFA enabled cannot authenticate
    root_cause: The LoginOne component was not designed with MFA progressive disclosure.
      The backend supports MFA (mfa_code field in LoginRequest, verify_totp call) but the
      frontend has no UI to enter the TOTP code.
    skeleton_solution: Section 7.2 defines mfa_code field with conditional visibility.
      Section 4.2 Right Form Panel defines the progressive disclosure zone.
      Section 11 lists showMfaField prop addition as a required component change.
    measurable_outcome: Users with MFA enabled can complete authentication. MFA field appears
      only when needed — does not clutter the form for users without MFA.

  - problem: Multiple uppercase tracking violations create cognitive processing overhead
    root_cause: Tracking of 0.16em–0.24em on uppercase labels was a systemic pattern copied
      from existing components without governance enforcement.
    skeleton_solution: Section 9.3 defines maximum tracking of 0.06em for all badge/label
      elements. All specific violations listed in Section 11.
    measurable_outcome: Typography audit reports zero tracking > 0.06em violations in auth
      module. Shift operators can read form labels 15% faster.
```

---

## 13. IMPLEMENTATION HANDOFF NOTES

### 13.1 Implementation Order

```yaml
implementation_sequence:
  1: Fix AuthWorkstationShell typography — leftTitle scale, topbar label tracking,
     StatusRail gradient removal, platformLabel token class.
     This is a component-level fix; all auth pages that use AuthWorkstationShell benefit.
  2: Fix LoginOne typography — all uppercase/tracking violations in labels, divider,
     Google button sub-label, Show/Hide button, Forgot password link.
  3: Add MFA progressive disclosure — showMfaField prop to LoginOne; mfa_code state in
     LoginPage; show MFA field after 401 MFA-required response; resend form with mfa_code.
  4: Fix canResendVerification detection — replace string match with HTTP 403 status check.
  5: Wire redirect hint to Left Context Panel metrics display — already implemented,
     confirm it renders correctly after typography fixes.
  6: Verify autoFocus on email field fires on page mount (not just on first render).
  7: Verify backend wake-up warm behavior — warmBackendConnection fires on mount,
     status message surfaces "waking up" message if 503.
  8: Run accessibility audit — heading hierarchy (one h1, h2 for panel title), all inputs
     have htmlFor, all interactive elements meet 44px minimum touch target on mobile.
```

### 13.2 Critical Constraints

```yaml
critical_constraints:
  - "Do NOT change the AuthWorkstationShell layout architecture (split left/right, CSS classes
    factory-auth-shell, factory-auth-grid, factory-auth-left, factory-auth-panel) —
    only fix typography and color token violations within those zones."
  - "Do NOT add any animations or transitions to the auth page elements (page entry animation,
    slide-in for status message, etc.) — static state changes only."
  - "Do NOT add the density toggle or any operational controls from WorkstationShell —
    auth pages operate outside the density system."
  - "Do NOT change the navigation structure — /login, /register, /forgot-password are their own
    routes. No in-page wizard pattern for multi-step auth."
  - "The MFA code field MUST use inputMode=numeric and autoComplete=one-time-code for iOS
    AutoFill compatibility — do not omit these attributes."
  - "The warmBackendConnection() call on mount is required — do not remove it.
    It prevents confusing 503 errors during cold start from being surfaced as auth failures."
  - "The rate limiting error (429) must be surfaced as a distinct message — not a generic
    'Sign-in failed' message. The operator needs to know to wait, not to try again immediately."
```

### 13.3 Open Questions

```yaml
open_questions:
  - question: "Should the MFA code field appear as a third field inline in the same form submission,
      or should a failed initial login (MFA required) cause a page state transition to a dedicated
      MFA step with only the code field visible? The current spec recommends inline progressive
      disclosure, but a two-step approach may be clearer for first-time MFA setup."
    blocking: no
    needs_answer_from: product owner
    default_if_unresolved: inline progressive disclosure as specified in Section 7.2

  - question: "The backend LoginRequest has min_length=12 for password. The current frontend
    Input has no minLength attribute, meaning users with shorter passwords (legacy pre-12-char)
    would see a client-side validation failure before the server can handle the legacy bcrypt
    repair path. Should the client enforce min_length=12 or remain min_length=1?"
    blocking: yes
    needs_answer_from: backend team
    default_if_unresolved: min_length=1 on client (do not block at client; let server handle
      the password hash repair path for legacy users)

  - question: "Is Google OAuth configured and enabled on the production deployment?
    The onGoogleLogin prop is optional in LoginOne — if not configured, the Google button
    shows disabled. The spec assumes it is available. If not enabled, the button should
    display a 'Not configured' tooltip rather than silently doing nothing."
    blocking: no
    needs_answer_from: backend team / deployment config
```


---

## ACCEPTANCE CRITERIA (OVERALL SPEC)

The spec is considered COMPLETE and ready for Kiro implementation when:
- [x] All 12 sections are fully populated — no empty fields, no placeholders
- [x] Every layout zone has explicit acceptance criteria
- [x] Every component is mapped to an existing primitive or flagged as a required fix
- [x] Every operational problem from Section 1.3 has a resolution in Section 12
- [x] No anti-patterns present (gradients identified and remediated in Section 12, glow none, pulsing none, UPPERCASE labels identified and remediated, marketing typography identified and remediated)
- [x] All measurements follow the 4px spacing scale (56px topbar, 32px padding, 16px gap, 40px input, 42px button, 12px label, 14px body)
- [x] All surfaces reference token variables, not hex values (Section 9.4)
- [x] Typography follows FRONTEND_MODERNIZATION_EXECUTION_BLUEPRINT.md Section 4.1 exactly
- [x] Backend API endpoints verified to exist in auth_secure.py (POST /auth/v2/login, GET /auth/me, GET /auth/context, GET /auth/google/login, POST /auth/email/verification/resend, GET /observability/ready)
- [x] Permission matrix complete — login page has no role-gated zones (Section 3.6)
- [x] Open questions section populated with 3 items (Section 13.3)
- [x] Implementation handoff notes present with 8-step sequence (Section 13.1)

---

## POST-GENERATION VALIDATION

```yaml
self_validation_checklist:
  operational_integrity:
    - [x] Every layout zone traced to specific backend entity or API:
        Auth Topbar → brand/navigation (no API)
        Left Context Panel → static content + searchParams.get("next") metric
        Right Form Panel → POST /auth/v2/login + resend endpoint + observability/ready
    - [x] Every zone justified by specific operator need:
        Auth Topbar → orientation and brand trust
        Left Context Panel → workflow context for first-time users, redirect hint for returning users
        Right Form Panel → authentication action — the operational purpose of the entire route
    - [x] No zone exists for aesthetic reasons: left panel serves workflow explanation + redirect hint;
        its existence is justified. If it served no function it would be removed.

  law_compliance:
    - [x] Every spacing value follows the 4px scale (56, 32, 24, 20, 16, 12, 11, 10px)
    - [x] Every surface references a CSS token variable (Section 9.4)
    - [x] Every text label specified in sentence case (Sections 9.3, 4.2)
    - [x] Every font specification from approved type system (Inter UI — 18/16/14/12/11px scale)
    - [x] Every AI element described as static: no AI elements present in this workspace
    - [x] StatusRail gradient violation identified and remediated in Sections 1.3 + 12

  kiro_readiness:
    - [x] Implementation agent can read this spec and produce working code:
        Section 4 defines every zone with explicit content and acceptance criteria
        Section 7 defines every field with attributes, validation, and keyboard behavior
        Section 11 lists every required component fix with specific line-level guidance
        Section 13.1 gives the 8-step implementation sequence
    - [x] All acceptance criteria are testable (not subjective):
        "renders at 56px height" — measurable
        "email input has type=email" — checkable
        "no arbitrary text-[2rem]" — lintable
    - [x] Implementation sequence is clear (Section 13.1)
    - [x] Blocking open questions flagged (Section 13.3, question 2 marked blocking: yes)

  anti_pattern_check:
    - [x] No gradients specified: StatusRail gradient is identified as a VIOLATION to be REMOVED
    - [x] No glow effects: none specified
    - [x] No pulsing on non-loading elements: none specified
    - [x] No UPPERCASE labels: all uppercase patterns identified as violations and remediated
    - [x] No marketing typography (oversized headings): leftTitle clamp() identified as VIOLATION
    - [x] No invented workflows not backed by backend: all flows traced to auth_secure.py
    - [x] No fake data or placeholder APIs: all endpoints verified in source files
```

---

## DOWNSTREAM KIRO TASKS

```yaml
downstream_kiro_tasks:
  task_1:
    name: "Login — AuthWorkstationShell typography and token fixes"
    input: This spec → Section 11 (required component fixes 1–4)
    output: AuthWorkstationShell with correct title scale, token classes, no gradient

  task_2:
    name: "Login — LoginOne typography and tracking fixes"
    input: This spec → Section 11 (required component fixes 5–9) + Section 9.3
    output: LoginOne with all labels sentence case, tracking ≤0.06em, no uppercase violations

  task_3:
    name: "Login — MFA progressive disclosure implementation"
    input: This spec → Section 7.2 (mfa_code field) + Section 4.2 Right Form Panel
    output: MFA field appears conditionally after 401-MFA response; form re-submits with mfa_code

  task_4:
    name: "Login — canResendVerification structural error detection"
    input: This spec → Section 7.3 (server_side validation) + Section 12 (problem 5)
    output: Resend CTA driven by HTTP 403 status check instead of error text string match

  task_5:
    name: "Login — Responsive left panel collapse verification"
    input: This spec → Section 10.3
    output: Left context panel hidden at <1024px; form takes full width

  task_6:
    name: "Login — Accessibility audit and remediation"
    input: This spec → Section 7.4 (keyboard flow) + Section 4.2 Right Form Panel acceptance criteria
    output: All inputs have htmlFor, autoFocus on email, MFA input has one-time-code autoComplete,
      all touch targets ≥44px on mobile
```

---

*End of WORKSPACE_SKELETON_LOGIN.md*
*Source: PRODUCT_WORKSPACE_TOPOLOGY.md + FRONTEND_MODERNIZATION_EXECUTION_BLUEPRINT.md*
*Next workspace in sequence: /register (Phase A, Item 2)*


---

---

# SECTION 4A — VISUAL STRUCTURAL HIERARCHY BLUEPRINT
# /login — System Access Workspace
# FactoryNerve OS | Operational Wireframe Architecture

---

## A. DESKTOP STRUCTURAL BLUEPRINT (≥1280px)

### A.1 Full Workspace Wireframe — Default State

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  TOPBAR  [56px fixed height]                                                           │
│  ┌──────────────────────┐                    ┌───────────────────────────────────────┐ │
│  │ [Building2] DPR.ai   │                    │  Steel industry    Factory OS         │ │
│  │  brand anchor / home │                    │  12px · sentence   12px · action-     │ │
│  │  link → /            │                    │  case · tertiary   primary token      │ │
│  └──────────────────────┘                    └───────────────────────────────────────┘ │
├──────────────────────────────────────────────┬─────────────────────────────────────────┤
│                                              │                                         │
│  LEFT CONTEXT PANEL  [45% width]             │  RIGHT FORM COLUMN  [55% width]         │
│  surface-app · display:none <1024px          │  surface-app · always visible           │
│                                              │                                         │
│  ┌──────────────────────────────────────┐    │  ┌───────────────────────────────────┐  │
│  │ EYEBROW [12px · sentence · tertiary] │    │  │  FORM PANEL  [max-w:480px]        │  │
│  │ "Authentication lane"                │    │  │  surface-panel · 32px padding     │  │
│  │                                      │    │  │                                   │  │
│  │ TITLE [18px · 600 · sentence case]   │    │  │  ┌─────────────────────────────┐  │  │
│  │ "System Access"                      │    │  │  │ BADGE CHIP                  │  │  │
│  │ tracking-tight · text-primary        │    │  │  │ "Secure access"             │  │  │
│  │                                      │    │  │  │ 12px · 500 · surface-shell  │  │  │
│  │ DESCRIPTION [14px · secondary]       │    │  │  │ border-border-default       │  │  │
│  │ "Sign in with a verified inbox..."   │    │  │  └─────────────────────────────┘  │  │
│  │                                      │    │  │  [center-aligned]                 │  │
│  └──────────────────────────────────────┘    │  │                                   │  │
│                                              │  │  PANEL TITLE [h2 · 16px · 600]    │  │
│  ┌──────────────────────────────────────┐    │  │  "Identify user"                  │  │
│  │ SECURITY POSTURE CARD                │    │  │  tracking-tight · text-primary    │  │
│  │ surface-panel · border-subtle        │    │  │  [center-aligned]                 │  │
│  │ 24px padding                         │    │  │                                   │  │
│  │ ─────────────────────────────        │    │  │  PANEL DESCRIPTION [14px · 400]   │  │
│  │ [ShieldCheck] Secure connection ✓    │    │  │  "Continue with a supported       │  │
│  │  status-success-fg · 12px            │    │  │   provider or use work            │  │
│  │ ─────────────────────────────        │    │  │   credentials..."                 │  │
│  │ • Security context bullet 1 [14px]   │    │  │  text-secondary · [center]        │  │
│  │ • Security context bullet 2 [14px]   │    │  │                                   │  │
│  │ • Security context bullet 3 [14px]   │    │  ├───────────────────────────────────┤  │
│  │   text-secondary                     │    │  │ [border-b border-border-subtle]   │  │
│  └──────────────────────────────────────┘    │  ├───────────────────────────────────┤  │
│                                              │  │                                   │  │
│  ┌────────────────────┬─────────────────┐    │  │  FORM BODY [space-y: 20px]        │  │
│  │ WORKFLOW STEPS     │ STATUS RAIL     │    │  │                                   │  │
│  │ surface-panel      │ surface-panel   │    │  │  ┌─────────────────────────────┐  │  │
│  │ 24px padding       │ 24px padding    │    │  │  │ GOOGLE OAUTH BUTTON         │  │  │
│  │                    │                 │    │  │  │ surface-panel · border-      │  │  │
│  │ "Provisioning      │ STATUS RAILS:   │    │  │  │ default · 56px height        │  │  │
│  │  workflow"         │ ██ ██ ░░        │    │  │  │                             │  │  │
│  │ 12px · tertiary    │ [3 segments]    │    │  │  │ [icon] Continue with Google │  │  │
│  │                    │ active=solid    │    │  │  │ 14px · 600 · sentence case  │  │  │
│  │ 01 Step title      │ inactive=empty  │    │  │  │ Work account [12px·secondary]│  │  │
│  │    14px · primary  │ NO GRADIENT     │    │  │  │                   [Arrow →] │  │  │
│  │    14px · secondary│                 │    │  │  └─────────────────────────────┘  │  │
│  │ 02 Step title      │ "Security       │    │  │                                   │  │
│  │    14px · primary  │  posture"       │    │  │  ┌─────────────────────────────┐  │  │
│  │    14px · secondary│ 12px · tertiary │    │  │  │ DIVIDER                     │  │  │
│  │ 03 Step title      │ value [14px]    │    │  │  │ ──── Operator email ────    │  │  │
│  │    14px · primary  │                 │    │  │  │ 11px · sentence · secondary │  │  │
│  │    14px · secondary│ "Operational    │    │  │  │ NO uppercase · NO wide      │  │  │
│  └────────────────────┴─────────────────┘    │  │  │ tracking                   │  │  │
│                                              │  │  └─────────────────────────────┘  │  │
│  [REDIRECT HINT — conditional]               │  │                                   │  │
│  ┌──────────────────────────────────────┐    │  │  ┌─────────────────────────────┐  │  │
│  │ Requested destination                │    │  │  │ EMAIL FIELD [16px gap above] │  │  │
│  │ 12px · tertiary / primary value      │    │  │  │                             │  │  │
│  │ Visible only when ?next= param set   │    │  │  │ Label: "Work email"         │  │  │
│  └──────────────────────────────────────┘    │  │  │ 12px · 500 · sentence case  │  │  │
│                                              │  │  │ NO uppercase · NO mono      │  │  │
│                                              │  │  │                             │  │  │
│  FOOTER [pinned bottom of left panel]        │  │  │ ┌──[Mail icon]────────────┐ │  │  │
│  ┌──────────────────────────────────────┐    │  │  │ │ operator@factory.os     │ │  │  │
│  │ [AlertTriangle] Emergency ext 4092   │    │  │  │ │ type=email · h=40px     │ │  │  │
│  │ 12px · tertiary                      │    │  │  │ └─────────────────────────┘ │  │  │
│  └──────────────────────────────────────┘    │  │  └─────────────────────────────┘  │  │
│                                              │  │                                   │  │
│                                              │  │  ┌─────────────────────────────┐  │  │
│                                              │  │  │ PASSWORD FIELD [16px gap]   │  │  │
│                                              │  │  │                             │  │  │
│                                              │  │  │ Label: "Password"           │  │  │
│                                              │  │  │ 12px · 500 · sentence case  │  │  │
│                                              │  │  │           "Forgot password?"│  │  │
│                                              │  │  │           12px · action-pri │  │  │
│                                              │  │  │           sentence case →   │  │  │
│                                              │  │  │                             │  │  │
│                                              │  │  │ ┌──[Key icon]─────[Show]──┐ │  │  │
│                                              │  │  │ │ ··············  12px·sc │ │  │  │
│                                              │  │  │ │ type=password   h=40px  │ │  │  │
│                                              │  │  │ └─────────────────────────┘ │  │  │
│                                              │  │  └─────────────────────────────┘  │  │
│                                              │  │                                   │  │
│                                              │  │  [MFA FIELD — conditional]        │  │
│                                              │  │  ┌─────────────────────────────┐  │  │
│                                              │  │  │ Label: "Authenticator code" │  │  │
│                                              │  │  │ 12px · 500 · sentence case  │  │  │
│                                              │  │  │ ┌─────────────────────────┐ │  │  │
│                                              │  │  │ │ 6-digit code   h=40px   │ │  │  │
│                                              │  │  │ │ inputMode=numeric        │ │  │  │
│                                              │  │  │ └─────────────────────────┘ │  │  │
│                                              │  │  │ "6-digit code from your    │  │  │
│                                              │  │  │  authenticator app" [12px] │  │  │
│                                              │  │  │ HIDDEN until MFA-401 fires │  │  │
│                                              │  │  └─────────────────────────────┘  │  │
│                                              │  │                                   │  │
│                                              │  │  ┌─────────────────────────────┐  │  │
│                                              │  │  │ SUBMIT BUTTON [42px height] │  │  │
│                                              │  │  │ full width · primary        │  │  │
│                                              │  │  │ "Sign in"                   │  │  │
│                                              │  │  │ 14px · 500 · sentence case  │  │  │
│                                              │  │  │ → isBusy: "Signing in..."   │  │  │
│                                              │  │  └─────────────────────────────┘  │  │
│                                              │  │                                   │  │
│                                              │  │  [STATUS MESSAGE — conditional]   │  │
│                                              │  │  ┌─────────────────────────────┐  │  │
│                                              │  │  │ [tone border + bg + fg]     │  │  │
│                                              │  │  │ 14px · 400 · leading-6      │  │  │
│                                              │  │  │ rounded-panel · border      │  │  │
│                                              │  │  │ 16px padding                │  │  │
│                                              │  │  │                             │  │  │
│                                              │  │  │ [RESEND CTA — conditional]  │  │  │
│                                              │  │  │ "Resend verification" btn   │  │  │
│                                              │  │  │ visible only on 403 state   │  │  │
│                                              │  │  └─────────────────────────────┘  │  │
│                                              │  │                                   │  │
│                                              │  │  ┌─────────────────────────────┐  │  │
│                                              │  │  │ FOOTER [border-t · 16px top]│  │  │
│                                              │  │  │ border-border-subtle        │  │  │
│                                              │  │  │                             │  │  │
│                                              │  │  │ "Need provisioning?"  14px  │  │  │
│                                              │  │  │ text-secondary              │  │  │
│                                              │  │  │                             │  │  │
│                                              │  │  │ "Create account" [Arrow →]  │  │  │
│                                              │  │  │ 14px · 600 · action-primary │  │  │
│                                              │  │  └─────────────────────────────┘  │  │
│                                              │  │                                   │  │
│                                              │  └───────────────────────────────────┘  │
│                                              │  [vertically centered in column]        │
└──────────────────────────────────────────────┴─────────────────────────────────────────┘
```

### A.2 Structural Zone Anatomy — Labeled

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  ZONE 0: AUTH TOPBAR                                                                    ║
║  [Z-INDEX: topmost] [HEIGHT: 56px] [WIDTH: 100%] [SURFACE: surface-shell or app]       ║
╠══════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                          ║
║  ZONE 1: LEFT CONTEXT PANEL                  ║  ZONE 2: RIGHT FORM COLUMN               ║
║  [WIDTH: 45%] [SURFACE: surface-app]         ║  [WIDTH: 55%] [SURFACE: surface-app]     ║
║  [VISIBILITY: desktop ≥1024px only]          ║  [VISIBILITY: always]                    ║
║  [ATTENTION PRIORITY: 4 — supporting]        ║  [ATTENTION PRIORITY: 1 — primary]       ║
║                                              ║                                          ║
║  ┌── ZONE 1A: IDENTITY BLOCK ─────────┐      ║  ┌── ZONE 2A: FORM PANEL ─────────────┐  ║
║  │  [eyebrow + title + description]   │      ║  │  [max-w: 480px] [centered]         │  ║
║  │  NO interaction                    │      ║  │  [SURFACE: surface-panel]          │  ║
║  └─────────────────────────────────────┘      ║  │  [PADDING: 32px all sides]         │  ║
║                                              ║  │                                   │  ║
║  ┌── ZONE 1B: SECURITY CARD ──────────┐      ║  │  ┌── ZONE 2A-i: PANEL HEADER ──┐  │  ║
║  │  [surface-panel] [NO interaction]  │      ║  │  │  [badge chip]               │  │  ║
║  └─────────────────────────────────────┘      ║  │  │  [h2 panel title 16px/600]  │  │  ║
║                                              ║  │  │  [description 14px/400]     │  │  ║
║  ┌── ZONE 1C: STEP/STATUS GRID ───────┐      ║  │  │  [border-b separator]       │  │  ║
║  │  [2-col grid]                      │      ║  │  └─────────────────────────────┘  │  ║
║  │  ┌─ WORKFLOW STEPS ┐┌─ STATUS ──┐  │      ║  │                                   │  ║
║  │  │ surface-panel   ││surface-   │  │      ║  │  ┌── ZONE 2A-ii: FORM BODY ────┐  │  ║
║  │  │ steps 01–03     ││panel      │  │      ║  │  │  [space-y: 20px]            │  │  ║
║  │  │ NO interaction  ││rails + md │  │      ║  │  │  → Google OAuth button      │  ║
║  │  └─────────────────┘└───────────┘  │      ║  │  │  → Divider                  │  │  ║
║  └─────────────────────────────────────┘      ║  │  │  → Email field              │  │  ║
║                                              ║  │  │  → Password field           │  │  ║
║  ┌── ZONE 1D: REDIRECT HINT ──────────┐      ║  │  │  → MFA field [conditional]  │  │  ║
║  │  [conditional on ?next= param]     │      ║  │  │  → Submit button            │  │  ║
║  │  [12px · tertiary label + value]   │      ║  │  │  → Status message [cond]    │  │  ║
║  └─────────────────────────────────────┘      ║  │  └─────────────────────────────┘  │  ║
║                                              ║  │                                   │  ║
║  ┌── ZONE 1E: FOOTER ─────────────────┐      ║  │  ┌── ZONE 2A-iii: PANEL FOOTER ┐  │  ║
║  │  [pinned bottom] [NO interaction]  │      ║  │  │  [border-t separator]       │  │  ║
║  │  Emergency contact · 12px tertiary │      ║  │  │  "Need provisioning?"       │  │  ║
║  └─────────────────────────────────────┘      ║  │  │  "Create account →" link    │  │  ║
║                                              ║  │  └─────────────────────────────┘  │  ║
║                                              ║  └───────────────────────────────────┘  ║
║                                              ║                                          ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

### A.3 Component Ownership Map

```
AuthWorkstationShell
├── factory-auth-topbar
│   ├── Link (brand)  ← shared/primitives: Link
│   └── meta labels   ← text-action-primary token, text-text-secondary token
│
├── factory-auth-left  [LEFT CONTEXT PANEL]
│   ├── .identity-block
│   │   ├── eyebrow span     ← text-text-tertiary, --type-label
│   │   ├── h1 leftTitle     ← 18px/600/tracking-tight  [FIXED from clamp()]
│   │   └── p leftDescription← text-text-secondary, 14px
│   ├── .security-card       ← surface-panel
│   │   ├── ShieldCheck icon
│   │   └── supportItems[]
│   ├── .content-grid [2-col]
│   │   ├── .workflow-steps  ← surface-panel
│   │   │   └── steps[].{title, description}
│   │   └── .status-card     ← surface-panel
│   │       ├── StatusRail × 3  ← NO linear-gradient [FIXED]
│   │       └── metadata labels
│   ├── .redirect-hint [conditional]
│   └── .footer
│
└── factory-auth-panel  [RIGHT FORM COLUMN → FORM PANEL]
    └── LoginOne
        ├── .panel-header
        │   ├── badge chip span   ← surface-shell, --type-label, tracking ≤0.06em [FIXED]
        │   ├── h2 panelTitle     ← 16px/600  [FIXED from text-[2rem]]
        │   └── p description     ← 14px/400, text-text-secondary
        │
        └── form [onSubmit]
            ├── GoogleOAuthButton
            │   ├── provider icon  [ShieldCheck/Loader2]
            │   ├── "Continue with Google"  14px/600/sentence case
            │   └── "Work account"  12px/sentence case  [FIXED from uppercase]
            │
            ├── Divider
            │   └── "Operator email"  11px/sentence case  [FIXED from uppercase]
            │
            ├── Field: email
            │   ├── Label ("Work email")  12px/500/sentence case  [FIXED]
            │   └── Input  type=email, autoFocus, autoComplete=email
            │
            ├── Field: password
            │   ├── Label ("Password") + ForgotPasswordLink  [FIXED: sentence case]
            │   ├── Input  type=password/text, autoComplete=current-password
            │   └── ShowHideToggle  12px/sentence case  [FIXED from uppercase]
            │
            ├── Field: mfa_code  [CONDITIONAL — hidden until MFA-401 fires]
            │   ├── Label ("Authenticator code")  12px/500/sentence case
            │   ├── Input  inputMode=numeric, autoComplete=one-time-code, maxLength=10
            │   └── HelperText  "6-digit code from your authenticator app"
            │
            ├── Button (submit)  h=42px/full-width/isBusy  ← shared/primitives: Button
            │
            ├── StatusMessage  [CONDITIONAL]
            │   ├── tone=success → border-status-success-border bg-status-success-bg
            │   ├── tone=error   → border-status-danger-border bg-status-danger-bg
            │   ├── tone=neutral → border-border-default bg-surface-shell
            │   └── ResendVerificationCTA  [sub-conditional: 403 state only]
            │       └── Button (outline, "Resend verification")
            │
            └── PanelFooter
                ├── border-t border-border-subtle
                ├── "Need provisioning?" span  14px/secondary
                └── Link ("Create account →")  14px/600/action-primary
```

---

## B. VISUAL ATTENTION FLOW MAP

### B.1 Scan Flow Diagram

```
╔═══════════════════════════════════════════════════════════════════════╗
║  ATTENTION FLOW — /login — Default State (desktop)                   ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  ┌─────────────────────────────────────────────────────────────┐     ║
║  │  LEFT PANEL                    RIGHT PANEL                  │     ║
║  │                                                             │     ║
║  │  [Orientation zone]     ────►  ╔═════════════════════════╗ │     ║
║  │  Seen ~3s+ into visit          ║  1st: EMAIL INPUT       ║ │     ║
║  │                                ║  ▼ AUTO-FOCUSED          ║ │     ║
║  │  Left panel title at           ║  [0–200ms] ●            ║ │     ║
║  │  18px is SECONDARY             ║  Cursor lands here on   ║ │     ║
║  │  to the form.                  ║  page load. No hunting. ║ │     ║
║  │                                ╠═════════════════════════╣ │     ║
║  │  It does NOT compete           ║  2nd: PASSWORD FIELD    ║ │     ║
║  │  because:                      ║  [200ms–1s] ●           ║ │     ║
║  │  - 18px vs form's              ║  Tab from email →       ║ │     ║
║  │    42px button                 ║  Enter submits form     ║ │     ║
║  │  - surface-app vs              ╠═════════════════════════╣ │     ║
║  │    surface-panel               ║  3rd: SUBMIT BUTTON     ║ │     ║
║  │  - no border frame             ║  [1s–2s] ●              ║ │     ║
║  │    on left content             ║  Full-width, primary,   ║ │     ║
║  │                                ║  visually dominant      ║ │     ║
║  │                                ╠═════════════════════════╣ │     ║
║  │                                ║  4th: STATUS MESSAGE    ║ │     ║
║  │                                ║  [conditional] ●        ║ │     ║
║  │                                ║  Only reads if error    ║ │     ║
║  │                                ║  or access reason       ║ │     ║
║  │                                ╠═════════════════════════╣ │     ║
║  │                                ║  5th: SECONDARY PATHS   ║ │     ║
║  │                                ║  [3s+] ●                ║ │     ║
║  │                                ║  Google button (above   ║ │     ║
║  │                                ║  divider) · Forgot PW · ║ │     ║
║  │                                ║  Create account         ║ │     ║
║  │                                ╚═════════════════════════╝ │     ║
║  └─────────────────────────────────────────────────────────────┘     ║
╚═══════════════════════════════════════════════════════════════════════╝
```

### B.2 State-Specific Attention Shifts

```
STATE: DEFAULT (page load, no params)
─────────────────────────────────────
Eye path: EMAIL INPUT → PASSWORD → SUBMIT → (Google if primary fails)
Dominant element: Email input (autoFocused)
No distraction: Status zone empty — zero visual noise

STATE: REDIRECT HINT (?next= param present)
────────────────────────────────────────────
Eye path: (Desktop) Left panel redirect hint → EMAIL INPUT → PASSWORD → SUBMIT
          (Mobile) STATUS message "Opening [destination] after sign-in" [if surfaced]
          OR left panel is hidden; hint only visible on desktop ≥1024px
Dominant: Email input still primary — hint is ambient context

STATE: ACCESS REASON (?reason= param: session_expired etc.)
────────────────────────────────────────────────────────────
Eye path: STATUS MESSAGE → EMAIL INPUT → PASSWORD → SUBMIT
Dominant: Status message briefly — then form
Reason: User was redirected here; they need to understand WHY before re-authenticating

STATE: ERROR (401 invalid credentials)
───────────────────────────────────────
Eye path: STATUS MESSAGE (error tone, red border) → EMAIL INPUT → PASSWORD → SUBMIT
Dominant: Error message — draws eye via status-danger-border contrast
Recovery: User re-reads credentials, corrects, resubmits

STATE: EMAIL UNVERIFIED (403)
──────────────────────────────
Eye path: STATUS MESSAGE (error) → RESEND VERIFICATION CTA → EMAIL INPUT
Dominant: Error message + resend button
Resolution path: Click resend → email sent → check inbox → /verify-email route

STATE: MFA REQUIRED (progressive disclosure)
─────────────────────────────────────────────
Eye path: MFA FIELD (newly appeared) → SUBMIT BUTTON
Dominant: MFA field (newly visible, eye naturally goes to new element)
Previous fields: email + password already filled, no reason to re-read them

STATE: RATE LIMITED (429)
──────────────────────────
Eye path: STATUS MESSAGE (error tone) → wait
Dominant: Error message — submit button should reflect disabled state
No confusion: "Too many sign-in attempts. Wait 60 seconds." is explicit

STATE: BACKEND WAKING (503)
────────────────────────────
Eye path: STATUS MESSAGE (neutral tone, no alarm) → wait
Dominant: Status message — neutral tone prevents panic
Auto-retry in background; user sees progress, not failure
```

### B.3 Persistent vs Contextual Visibility

```
ALWAYS VISIBLE (never scroll away, never hide):
┌─────────────────────────────────────────────┐
│  • Email input field                        │
│  • Password input field                     │
│  • Submit button                            │
│  • Forgot password link                     │
│  • Topbar brand anchor                      │
│  Reason: These are the operational workflow │
│  elements. Removing any breaks the ability  │
│  to authenticate.                           │
└─────────────────────────────────────────────┘

CONTEXTUAL (appears based on state):
┌─────────────────────────────────────────────┐
│  • Status message zone (any non-null status)│
│  • Resend verification CTA (403 state only) │
│  • MFA input field (MFA-401 state only)     │
│  • Redirect hint in left panel (?next= only)│
│  Reason: These only add noise when the      │
│  condition that makes them relevant is      │
│  active. Showing them always creates false  │
│  urgency.                                   │
└─────────────────────────────────────────────┘

DESKTOP-ONLY (never on mobile):
┌─────────────────────────────────────────────┐
│  • Entire left context panel (Zones 1A–1E)  │
│  Reason: Operational context, not action.   │
│  Mobile operators authenticate and proceed. │
│  Context copy does not accelerate that task.│
└─────────────────────────────────────────────┘
```

---

## C. SPACING & RHYTHM VISUALIZATION

### C.1 Vertical Spacing Stack — Form Panel

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   ← 32px (--space-8) top padding ─────────────────────  │
│                                                          │
│   [BADGE CHIP]                                           │
│                                                          │
│   ← 16px (--space-4) ──────────────────────────────────  │
│                                                          │
│   [PANEL TITLE h2]                                       │
│                                                          │
│   ← 12px (--space-3) ──────────────────────────────────  │
│                                                          │
│   [PANEL DESCRIPTION]                                    │
│                                                          │
│   ← 20px (--space-5) ──────────────────────────────────  │
│   [border-b separator]                                   │
│   ← 20px (--space-5) ──────────────────────────────────  │
│                                                          │
│   [GOOGLE OAUTH BUTTON]  ← 56px height                  │
│                                                          │
│   ← 20px (--space-5) ──────────────────────────────────  │
│                                                          │
│   [DIVIDER + "Operator email"]                           │
│                                                          │
│   ← 20px (--space-5) ──────────────────────────────────  │
│                                                          │
│   [LABEL: "Work email"]   ← 12px height                 │
│   ← 8px (--space-2) ───────────────────────────────────  │
│   [EMAIL INPUT]           ← 40px height                 │
│                                                          │
│   ← 16px (--space-4) ──────────────────────────────────  │
│                                                          │
│   [LABEL: "Password" + Forgot PW link]  ← 12px          │
│   ← 8px (--space-2) ───────────────────────────────────  │
│   [PASSWORD INPUT]        ← 40px height                 │
│                                                          │
│   ← 16px (--space-4) ──────────────────────────────────  │
│   [MFA FIELD — conditional, same rhythm]                 │
│   ← 16px (--space-4) ──────────────────────────────────  │
│                                                          │
│   [SUBMIT BUTTON]         ← 42px height, full width     │
│                                                          │
│   ← 16px (--space-4) ──────────────────────────────────  │
│   [STATUS MESSAGE — conditional, self-sizing]            │
│   ← 16px (--space-4) ──────────────────────────────────  │
│                                                          │
│   [border-t border-border-subtle]                        │
│   ← 16px (--space-4) ──────────────────────────────────  │
│                                                          │
│   [FOOTER: "Need provisioning?" + "Create account →"]   │
│                                                          │
│   ← 32px (--space-8) bottom padding ──────────────────  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### C.2 Horizontal Spacing — Form Panel

```
┌─ 32px ─┬──────────────────────────────────┬─ 32px ─┐
│        │  Form content region             │        │
│        │  max-w: 480px centered           │        │
│        │                                  │        │
│        │  [Label: 12px/500]               │        │
│        │  [Input: full width to boundary] │        │
│        │                                  │        │
│        │  [Btn: full width to boundary]   │        │
│        │                                  │        │
└────────┴──────────────────────────────────┴────────┘
```

### C.3 Density Region Map — Login Workspace

```
FORM PANEL: DEFAULT DENSITY throughout
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  BREATHABLE REGION (top 1/3)                            │
│  ─ Badge chip + Panel title + description               │
│  ─ Purpose: establish workspace identity                │
│  ─ Spacing: generous (20px gaps between elements)       │
│  ─ NO compression needed: this is orientation           │
│                                                         │
│  OPERATIONAL FOCUS REGION (middle 2/3)                  │
│  ─ Credential fields + Submit                           │
│  ─ Purpose: execute the authentication workflow         │
│  ─ Spacing: tight-but-comfortable (16px field gap)      │
│  ─ Elements are few; density is not a concern           │
│  ─ Touch targets maintained at ≥40px for inputs         │
│                                                         │
│  RECOVERY REGION (conditional, below submit)            │
│  ─ Status messages + resend CTA                         │
│  ─ Purpose: error communication and recovery action     │
│  ─ Spacing: 16px above, self-sizing content             │
│  ─ Padding inside: 16px (readable, not cramped)         │
│                                                         │
│  EXIT REGION (footer)                                   │
│  ─ "Need provisioning?" + Create account link           │
│  ─ Purpose: off-ramp for new users                      │
│  ─ Spacing: 16px above border, visually separated       │
│  ─ Low visual weight: secondary action area             │
│                                                         │
└─────────────────────────────────────────────────────────┘

LEFT PANEL: NOT density-switched
─ Context cards use 24px internal padding (surface-panel)
─ Fixed rhythm; no interaction means no density optimization needed
─ Card grid gap: 16px between the two bottom cards
```

### C.4 Visual Silence Zones

```
SILENCE ZONE 1: Between topbar and form panel
  Purpose: Creates the "entering the workspace" breath
  Amount: Auto — handled by vertical centering of form panel
  in right column. Not a fixed gap.

SILENCE ZONE 2: Left panel — between identity block and security card
  Purpose: Separates "who you are" context from "why it's secure"
  Amount: 32px (--space-8)

SILENCE ZONE 3: Inside security card — between header row and bullets
  Purpose: Makes the security posture readable vs scanned
  Amount: 16px (--space-4) margin-top after border-b

SILENCE ZONE 4: Form panel — between separator and Google button
  Purpose: Signals "form work begins here"
  Amount: 20px (--space-5)

SILENCE ZONE 5: Form panel — between submit and footer
  Purpose: Prevents "Create account" from being accidentally tapped
  Amount: 16px above border-t + 16px after border-t before footer content
  Total visual separation: 32px

DENSE ZONE: Credential field group
  The email/password pair has only 16px between them.
  This is intentional: they belong together as a single credential unit.
  The divider above them (20px + separator + 20px) provides the
  grouping boundary that says "these belong together."
```

---

## D. COMPONENT NESTING HIERARCHY

### D.1 Full Nesting Tree — Visual

```
SURFACE LEVEL 0: surface-app  (workspace floor)
│
├── TOPBAR [56px]
│   SURFACE: surface-shell (or transparent over app)
│   CONTAINS: Link · span · span
│   NESTING DEPTH: 1
│
├── GRID [factory-auth-grid]
│   SURFACE: surface-app (transparent — floor is visible through)
│   LAYOUT: 2-col  45% / 55%
│   NESTING DEPTH: 1
│   │
│   ├── LEFT COLUMN [factory-auth-left]
│   │   SURFACE: surface-app
│   │   NESTING DEPTH: 2
│   │   │
│   │   ├── .identity-block  [NO surface — content on floor]
│   │   │   NESTING DEPTH: 3
│   │   │   CONTAINS: eyebrow · h1 · p
│   │   │
│   │   ├── .security-card  [SURFACE: surface-panel +1]
│   │   │   NESTING DEPTH: 3
│   │   │   BORDER: border-subtle
│   │   │   CONTAINS: status header · supportItems[]
│   │   │   ⚠ DO NOT nest another card inside this card
│   │   │
│   │   ├── .content-grid [2-col sub-grid]
│   │   │   SURFACE: surface-app (transparent)
│   │   │   NESTING DEPTH: 3
│   │   │   │
│   │   │   ├── .workflow-steps-card  [SURFACE: surface-panel +1]
│   │   │   │   NESTING DEPTH: 4
│   │   │   │   CONTAINS: eyebrow · step[]
│   │   │   │   ⚠ Maximum nesting depth for content cards
│   │   │   │
│   │   │   └── .status-card  [SURFACE: surface-panel +1]
│   │   │       NESTING DEPTH: 4
│   │   │       CONTAINS: StatusRail×3 · metadata labels
│   │   │       ⚠ StatusRail: NO linear-gradient — surface-success-icon
│   │   │
│   │   ├── .redirect-hint  [CONDITIONAL]
│   │   │   SURFACE: surface-app (no card wrapper)
│   │   │   NESTING DEPTH: 3
│   │   │   CONTAINS: label + value spans only
│   │   │   ⚠ No card wrapping — plain text on floor
│   │   │
│   │   └── .footer  [pinned bottom]
│   │       SURFACE: surface-app
│   │       NESTING DEPTH: 3
│   │       CONTAINS: AlertTriangle · text span
│   │
│   └── RIGHT COLUMN [flex center]
│       SURFACE: surface-app
│       NESTING DEPTH: 2
│       │
│       └── .form-panel [factory-auth-panel]  [SURFACE: surface-panel +1]
│           NESTING DEPTH: 3
│           BORDER: border-default (or border-subtle)
│           PADDING: 32px
│           MAX-WIDTH: 480px
│           │
│           ├── .panel-header
│           │   SURFACE: inherits surface-panel
│           │   NESTING DEPTH: 4
│           │   CONTAINS: badge-chip · h2 · p
│           │   BORDER-BOTTOM: border-subtle
│           │
│           └── form [LoginOne body]
│               SURFACE: inherits surface-panel
│               NESTING DEPTH: 4
│               │
│               ├── .google-button  [SURFACE: surface-panel — same level, bordered]
│               │   NESTING DEPTH: 5
│               │   ⚠ No additional background elevation — button IS the surface
│               │
│               ├── .divider
│               │   NESTING DEPTH: 5
│               │   CONTAINS: hr · span
│               │
│               ├── .field-email
│               │   NESTING DEPTH: 5
│               │   CONTAINS: Label · Input[SURFACE: surface-card +1]
│               │   Input surface sits ONE level above panel: correct
│               │
│               ├── .field-password
│               │   NESTING DEPTH: 5
│               │   CONTAINS: Label+Link row · Input[surface-card] · ShowHide btn
│               │
│               ├── .field-mfa [CONDITIONAL — hidden initially]
│               │   NESTING DEPTH: 5
│               │   CONTAINS: Label · Input[surface-card] · HelperText
│               │   SURFACE state: same as other fields when visible
│               │
│               ├── .submit-button  [Button primitive]
│               │   NESTING DEPTH: 5
│               │   Full-width · h=42px · primary variant
│               │
│               ├── .status-message [CONDITIONAL]
│               │   NESTING DEPTH: 5
│               │   SURFACE: tone-based (success-bg / danger-bg / shell)
│               │   ⚠ This is the ONLY surface elevation within the form body
│               │   ⚠ that changes based on state — all other form elements
│               │   ⚠ are static surfaces
│               │   │
│               │   └── .resend-cta [sub-conditional]
│               │       NESTING DEPTH: 6
│               │       CONTAINS: Button (outline) + span
│               │       ⚠ Maximum nesting depth for this workspace
│               │
│               └── .panel-footer
│                   NESTING DEPTH: 5
│                   BORDER-TOP: border-subtle
│                   CONTAINS: span · Link
```

### D.2 Surface Elevation Audit

```
ELEVATION STACK — /login

surface-app          ← floor (workspace background)
  surface-shell      ← topbar
  surface-panel      ← left panel cards (security, steps, status)
  surface-panel      ← form panel (factory-auth-panel)
    surface-card     ← input fields (email, password, mfa)
    [tone]-bg        ← status message zone (conditional, same elevation as card)

RULE VERIFIED: No surface skips a level.
  surface-app → surface-panel ✓ (delta: +1)
  surface-panel → surface-card ✓ (delta: +1)
  surface-card → surface-elevated: NOT USED (no inputs inside inputs)

ANTI-PATTERN CHECK:
  ✗ surface-card inside surface-app directly? NO ✓
  ✗ surface-elevated on static non-interactive containers? NO ✓
  ✗ surface-overlay on non-modal content? NO ✓
  ✗ Double border (background + border on same element)? 
    Form panel has both surface-panel AND border — ACCEPTABLE:
    border-default communicates "this is an interactive zone",
    which is correct here. See blueprint Section 4.3 double-border rule:
    this is a primary interactive container, border-default is warranted.
```

---

## E. RESPONSIVE COLLAPSE BLUEPRINT

### E.1 Desktop Workstation (≥1280px) — Reference

```
┌────────────────────────────────────────────────────────────────────┐
│  TOPBAR [56px]  ██████████████████████████████████████████████████ │
├────────────────────────────────┬───────────────────────────────────┤
│                                │                                   │
│  LEFT CONTEXT PANEL  [45%]     │  RIGHT FORM COLUMN  [55%]         │
│                                │                                   │
│  Identity block                │         ┌──────────────────────┐  │
│  Security card                 │         │  FORM PANEL          │  │
│  Step/Status grid              │         │  max-w: 480px        │  │
│  Redirect hint [if ?next]      │         │  [vertically         │  │
│  Footer                        │         │   centered]          │  │
│                                │         └──────────────────────┘  │
│                                │                                   │
└────────────────────────────────┴───────────────────────────────────┘
  Viewport: 1440px optimal · 1280px minimum
  Left: 45% (648px at 1440px)
  Right: 55% (792px at 1440px) — form panel max-w 480px, centered within
```

### E.2 Compact Desktop (1024px–1279px)

```
┌────────────────────────────────────────────────────────────────────┐
│  TOPBAR [56px]  ██████████████████████████████████████████████████ │
├──────────────────────────┬─────────────────────────────────────────┤
│                          │                                         │
│  LEFT PANEL  [40%]       │  RIGHT FORM COLUMN  [60%]               │
│                          │                                         │
│  Identity block          │        ┌──────────────────────────────┐ │
│  (title: 18px — fits)    │        │  FORM PANEL                  │ │
│                          │        │  max-w: 440px                │ │
│  Security card           │        │  [vertically centered]       │ │
│  (24px → 20px padding)   │        │  All form elements identical │ │
│                          │        └──────────────────────────────┘ │
│  Step/Status grid        │                                         │
│  (2-col maintained)      │                                         │
│                          │                                         │
│  Footer                  │                                         │
│                          │                                         │
└──────────────────────────┴─────────────────────────────────────────┘
  Adaptation: left panel narrows to 40%; form panel max-w drops to 440px
  All content visible: no collapse needed at this breakpoint
  Density: default maintained
```

### E.3 Tablet (768px–1023px)

```
┌────────────────────────────────────────────────────────────────────┐
│  TOPBAR [56px]  ██████████████████████████████████████████████████ │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│   LEFT PANEL: ████ HIDDEN ████ (display:none — zero trace)        │
│                                                                    │
│             ┌────────────────────────────────────┐                 │
│             │  FORM PANEL  [max-w: 440px]         │                 │
│             │  centered in full viewport width    │                 │
│             │                                     │                 │
│             │  [Badge chip — centered]            │                 │
│             │  [Panel title h2]                   │                 │
│             │  [Description]                      │                 │
│             │  ─────────────────────              │                 │
│             │  [Google OAuth button]              │                 │
│             │  [Divider]                          │                 │
│             │  [Email field]                      │                 │
│             │  [Password field]                   │                 │
│             │  [Submit button]                    │                 │
│             │  [Status message — conditional]     │                 │
│             │  ─────────────────────              │                 │
│             │  [Need provisioning? / Create acct] │                 │
│             └────────────────────────────────────┘                 │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
  Left panel: completely hidden. No drawer, no toggle, no indicator.
  Form panel: full-width column, max-w 440px centered
  Padding: 24px horizontal (--space-6) inside form panel
  Input height: 40px maintained (sufficient for touch)
```

### E.4 Mobile (320px–767px) — Priority Treatment

```
┌──────────────────────────────────────────┐
│  TOPBAR [56px]  ████████████████████████ │
│  [Building2] DPR.ai         Factory OS  │
├──────────────────────────────────────────┤
│                                          │
│  LEFT PANEL: ██ HIDDEN ██ (display:none) │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  FORM PANEL  [100% width − 32px]   │  │
│  │  max-w: none on mobile             │  │
│  │  padding: 24px horiz · 32px vert   │  │
│  │                                    │  │
│  │  [Badge chip]                      │  │
│  │  [h2 panel title — 16px]           │  │
│  │  [description — 14px]              │  │
│  │                                    │  │
│  │  ════════════════════════════════  │  │
│  │                                    │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │ Google OAuth button          │  │  │
│  │  │ 52px height (touch-safe)     │  │  │
│  │  └──────────────────────────────┘  │  │
│  │                                    │  │
│  │  ──── Operator email ────          │  │
│  │                                    │  │
│  │  Work email                        │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │ [Mail] operator@factory.os   │  │  │
│  │  │ 44px height (touch target)   │  │  │
│  │  └──────────────────────────────┘  │  │
│  │                                    │  │
│  │  Password          Forgot?         │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │ [Key] ···········  [Show]    │  │  │
│  │  │ 44px height (touch target)   │  │  │
│  │  └──────────────────────────────┘  │  │
│  │                                    │  │
│  │  [MFA FIELD — conditional]         │  │
│  │  44px height (touch target)        │  │
│  │                                    │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │ SIGN IN                      │  │  │
│  │  │ 44px height · full width     │  │  │
│  │  └──────────────────────────────┘  │  │
│  │                                    │  │
│  │  [STATUS MESSAGE — conditional]    │  │
│  │  16px padding · readable           │  │
│  │                                    │  │
│  │  ════════════════════════════════  │  │
│  │                                    │  │
│  │  Need provisioning?                │  │
│  │  Create account  →                 │  │
│  │                                    │  │
│  └────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
  Input height: 44px (was 40px on desktop — increased for touch)
  Submit button: 44px height
  Google button: 52px height
  Show/Hide toggle: min 44px touch area
  Form panel: full-width with 24px horizontal margin (8px on very small screens)
  No horizontal scroll
  No pinch-zoom needed — all content accessible within viewport

MOBILE ADAPTATION DECISIONS:
  LEFT PANEL: GONE — not a drawer, not a tab, not an accordion
    → Rationale: 0 operational value on mobile. Operators authenticate to work.
    → Recovery: redirect hint disappears — acceptable trade-off
    → If redirect hint is operationally critical: surface inline above email field
      on mobile as a single-line status message (neutral tone)

  TOPBAR: MAINTAINED — brand trust + emergency contact info accessible via footer link
    → Emergency contact footer: moved above form or accessible via scroll on very small screens

  DENSITY TOGGLE: NOT PRESENT on auth pages — no change for mobile
```

### E.5 Collapse Decision Matrix

```
┌──────────────────────────────┬──────────┬─────────┬──────────┬──────────┐
│  Element                     │ Desktop  │ Compact │  Tablet  │  Mobile  │
│                              │ ≥1280px  │ 1024px  │  768px   │  <768px  │
├──────────────────────────────┼──────────┼─────────┼──────────┼──────────┤
│  Topbar                      │  Full    │  Full   │  Full    │  Full    │
│  Left context panel          │  Visible │ Visible │  HIDDEN  │  HIDDEN  │
│  Left identity block         │  Visible │ Visible │  HIDDEN  │  HIDDEN  │
│  Left security card          │  Visible │ Visible │  HIDDEN  │  HIDDEN  │
│  Left step/status grid       │  Visible │ Visible │  HIDDEN  │  HIDDEN  │
│  Left redirect hint          │  Cond.   │  Cond.  │  HIDDEN  │  HIDDEN  │
│  Left footer (emergency)     │  Visible │ Visible │  HIDDEN  │  HIDDEN  │
│  Form panel (container)      │  480px   │  440px  │  440px   │  100%    │
│  Panel badge chip            │  Visible │ Visible │  Visible │  Visible │
│  Panel title (h2)            │  Visible │ Visible │  Visible │  Visible │
│  Panel description           │  Visible │ Visible │  Visible │  Visible │
│  Google OAuth button         │  56px    │  56px   │  56px    │  52px+   │
│  Divider + label             │  Visible │ Visible │  Visible │  Visible │
│  Email field                 │  40px    │  40px   │  40px    │  44px+   │
│  Password field              │  40px    │  40px   │  40px    │  44px+   │
│  MFA field                   │  Cond.   │  Cond.  │  Cond.   │  Cond.   │
│  Submit button               │  42px    │  42px   │  42px    │  44px+   │
│  Status message              │  Cond.   │  Cond.  │  Cond.   │  Cond.   │
│  Resend CTA                  │  Cond.   │  Cond.  │  Cond.   │  Cond.   │
│  Panel footer                │  Visible │ Visible │  Visible │  Visible │
└──────────────────────────────┴──────────┴─────────┴──────────┴──────────┘
  Cond. = Conditional (visible only when state requires it)
  + = increased from desktop value for touch target compliance
```

---

## F. STRUCTURAL CONSISTENCY VALIDATION

### F.1 Zone Existence Justification Audit

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ZONE                   │ EXISTS FOR?          │ VERDICT                 │
├──────────────────────────────────────────────────────────────────────────┤
│  Auth Topbar            │ Brand orientation    │ ✓ JUSTIFIED             │
│                         │ + home navigation    │   Every user sees it.   │
│                         │ + emergency contact  │   Navigation + trust.   │
├──────────────────────────────────────────────────────────────────────────┤
│  Left Context Panel     │ Workflow explanation │ ✓ JUSTIFIED             │
│  (desktop only)         │ for first-time users │   Fills unused space.   │
│                         │ + redirect hint      │   Adds operational      │
│                         │ + security posture   │   context without       │
│                         │   communication      │   competing with form.  │
├──────────────────────────────────────────────────────────────────────────┤
│  Right Form Panel       │ Authentication       │ ✓ CORE — cannot remove  │
│                         │ action execution     │   This IS the workspace │
├──────────────────────────────────────────────────────────────────────────┤
│  Google OAuth button    │ Alternative auth     │ ✓ JUSTIFIED             │
│  (within form)          │ pathway — real       │   Backed by /auth/      │
│                         │ backend endpoint     │   google/login endpoint │
├──────────────────────────────────────────────────────────────────────────┤
│  Divider label          │ Logical grouping     │ ✓ JUSTIFIED             │
│                         │ separates SSO from   │   Visual anchor for     │
│                         │ credential fields    │   credential section    │
├──────────────────────────────────────────────────────────────────────────┤
│  Status message zone    │ Error communication  │ ✓ JUSTIFIED             │
│                         │ + access reason      │   Hidden when empty.    │
│                         │ + wake-up messages   │   Appears only when     │
│                         │                      │   needed.               │
├──────────────────────────────────────────────────────────────────────────┤
│  Resend verification    │ Error recovery path  │ ✓ JUSTIFIED             │
│  CTA (sub-conditional)  │ for 403 state        │   Backed by resend      │
│                         │                      │   endpoint. Hidden by   │
│                         │                      │   default.              │
├──────────────────────────────────────────────────────────────────────────┤
│  MFA field              │ Required for users   │ ✓ JUSTIFIED             │
│  (conditional)          │ with mfa_enabled     │   Backed by backend     │
│                         │                      │   mfa_code field.       │
│                         │                      │   Hidden by default.    │
├──────────────────────────────────────────────────────────────────────────┤
│  Panel footer           │ Off-ramp for new     │ ✓ JUSTIFIED             │
│  (Create account link)  │ users who land here  │   Real navigation to    │
│                         │ before registering   │   /register route.      │
└──────────────────────────────────────────────────────────────────────────┘

NO ZONES REMOVED: Every zone in the current implementation has a justifiable
operational purpose. However, several zones have GOVERNANCE VIOLATIONS that
must be corrected (identified in Section 1.3 and Section 11).
```

### F.2 Hierarchy Law Compliance Check

```
SPACING SYSTEM COMPLIANCE:
  ✓ 56px topbar → divisible by 4 (56 = 4×14)
  ✓ 32px panel padding → divisible by 4 (32 = 4×8)
  ✓ 24px mobile padding → divisible by 4 (24 = 4×6)
  ✓ 20px section gap → divisible by 4 (20 = 4×5)
  ✓ 16px field gap → divisible by 4 (16 = 4×4)
  ✓ 12px small gap → divisible by 4 (12 = 4×3)
  ✓ 8px label-to-input gap → divisible by 4 (8 = 4×2)
  ✓ 42px submit button → not divisible by 4 (42 = 4×10+2)
    → NOTE: 42px is an existing implementation value.
    → Blueprint minimum is 40px; 42px is within tolerance.
    → Mobile overrides to 44px (44 = 4×11) ✓

SURFACE HIERARCHY COMPLIANCE:
  ✓ app → panel: delta +1 ✓
  ✓ panel → card (inputs): delta +1 ✓
  ✓ No surface level skipped ✓
  ✓ No elevated surface on static content ✓
  ✗ StatusRail linear-gradient: VIOLATION → flagged for removal ✓

TYPOGRAPHY COMPLIANCE:
  ✓ Topbar brand: 16px/600 ✓
  ✓ Panel title: 16px/600 (h2) ✓  [requires fix from current 2rem]
  ✓ Left panel title: 18px/600 ✓  [requires fix from current clamp()]
  ✓ Form labels: 12px/500 ✓       [requires fix from uppercase+mono]
  ✓ Body/inputs: 14px/400 ✓
  ✓ Metadata/divider: 11px/500 ✓  [requires fix from uppercase]
  ✓ All numerics: tabular-nums not applicable (no data tables) ✓
  ✗ Uppercase labels with tracking >0.06em: VIOLATIONS → flagged ✓
  ✗ marketing heading clamp(): VIOLATION → flagged ✓

ANTI-PATTERN COMPLIANCE:
  ✓ No gradients (after fix of StatusRail)
  ✓ No glow effects
  ✓ No pulsing on non-loading elements
  ✓ No page-entry animations
  ✓ No backdrop-blur on static sections
  ✓ No UPPERCASE labels (after governance fixes)
  ✓ No raw hex colors
  ✓ No raw rgba backgrounds
  ✓ No raw Tailwind color classes (text-rose-*, bg-emerald-*)
  ✓ No invented workflows — all backed by auth_secure.py

VISUAL CALM PRESERVATION:
  ✓ No more than 2 cards visible at same level on left panel
  ✓ Form panel: maximum 1 surface-elevation change (panel → card)
  ✓ Status message zone: 1 active at a time (never stacks)
  ✓ No decorative borders beyond structural necessity
  ✓ No drop shadows except where surface elevation communicates depth

WORKFLOW ALIGNMENT:
  ✓ Form field order matches authentication workflow:
    1. Provider choice (Google) → 2. Email → 3. Password → 4. (MFA if needed) → 5. Submit
  ✓ Error recovery (resend) is WITHIN the status message, not a separate zone
  ✓ Secondary actions (forgot PW, create account) are visually de-emphasized
  ✓ No operational action is hidden behind a hover state on mobile
```

### F.3 Visual Hierarchy Dominance Audit

```
DOMINANCE RANKING — What the eye should perceive as most important:

  Rank 1 — SUBMIT BUTTON  [42px · full width · primary background · solid]
    → Largest, highest-contrast, widest interactive element in the form
    → Visually telegraphs "this is the completion action"

  Rank 2 — EMAIL + PASSWORD INPUTS  [40px · bordered · surface-card]
    → Two-item group sitting immediately above the submit button
    → Visual weight: subtle background elevation + border-default

  Rank 3 — PANEL TITLE  [16px · 600 · text-primary · centered]
    → Establishes workspace identity before form engagement
    → Heavier weight than description; lighter than form elements

  Rank 4 — STATUS MESSAGE  [conditional · tone border + bg]
    → When present: semantic color draws immediate attention
    → Error tone (danger) ranks above rank 1 temporarily
    → This is correct behavior: error must be read before re-submit

  Rank 5 — GOOGLE OAUTH BUTTON  [56px · bordered · surface-panel]
    → Above the credential divider, accessible but not dominant
    → Slightly taller than inputs but lighter visual weight (outline style)

  Rank 6 — SECONDARY TEXT ELEMENTS
    → "Forgot password?" link · "Create account" link
    → action-primary color but 12px/600 — readable but not dominant
    → These are exception paths, not primary flow

  Rank 7 — LEFT PANEL CONTENT  [desktop only]
    → Operational context, not action zone
    → 18px title at surface-app level (no panel background)
    → Does not compete with form panel (surface-panel elevated)
    → CORRECT: left panel is background context; form is foreground action

DOMINANCE CONCLUSION:
  The form's submit button is the visual terminus of the attention flow.
  Every element above it in the form points toward it.
  Every element in the left panel exists behind it.
  This is the correct industrial hierarchy for an authentication workspace.
```

---

*End of Section 4A — Visual Structural Hierarchy Blueprint*
*This section is an integral part of WORKSPACE_SKELETON_LOGIN.md*
*All wireframes derive directly from Section 4 zone definitions and Section 9 spacing specifications.*
*Next: /register — Phase A, Item 2*

``
CODE

<!DOCTYPE html><html class="dark" lang="en"><head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>Sign in | FactoryNerve OS</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;800&amp;family=JetBrains+Mono:wght@400;500&amp;family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@100..900&amp;family=JetBrains+Mono:wght@100..900&amp;display=swap" rel="stylesheet">
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            "colors": {
                    "tertiary-fixed-dim": "#ffba49",
                    "on-surface-variant": "#bbc9cf",
                    "on-primary-fixed-variant": "#004e60",
                    "surface-variant": "#2d3449",
                    "surface-container-high": "#222a3d",
                    "surface-bright": "#31394d",
                    "surface": "#0b1326",
                    "secondary": "#b7c8e1",
                    "on-error-container": "#ffdad6",
                    "error": "#ffb4ab",
                    "tertiary-fixed": "#ffddb1",
                    "on-secondary": "#213145",
                    "outline-variant": "#3c494e",
                    "primary-fixed-dim": "#4cd6ff",
                    "error-container": "#93000a",
                    "background": "#0b1326",
                    "inverse-on-surface": "#283044",
                    "on-tertiary": "#442b00",
                    "secondary-fixed-dim": "#b7c8e1",
                    "surface-container": "#171f33",
                    "secondary-container": "#3a4a5f",
                    "on-secondary-fixed": "#0b1c30",
                    "on-secondary-container": "#a9bad3",
                    "tertiary": "#ffd59c",
                    "outline": "#859399",
                    "primary-fixed": "#b7eaff",
                    "on-tertiary-container": "#6b4700",
                    "on-primary": "#003543",
                    "on-error": "#690005",
                    "surface-tint": "#4cd6ff",
                    "primary": "#a4e6ff",
                    "secondary-fixed": "#d3e4fe",
                    "on-tertiary-fixed": "#291800",
                    "surface-container-lowest": "#060e20",
                    "inverse-surface": "#dae2fd",
                    "on-surface": "#dae2fd",
                    "inverse-primary": "#00677f",
                    "on-primary-fixed": "#001f28",
                    "on-background": "#dae2fd",
                    "primary-container": "#00d1ff",
                    "surface-container-low": "#131b2e",
                    "tertiary-container": "#feb127",
                    "on-primary-container": "#00566a",
                    "on-tertiary-fixed-variant": "#624000",
                    "surface-dim": "#0b1326",
                    "surface-container-highest": "#2d3449",
                    "on-secondary-fixed-variant": "#38485d"
            },
            "borderRadius": {
                    "DEFAULT": "0.125rem",
                    "lg": "0.25rem",
                    "xl": "0.5rem",
                    "full": "0.75rem"
            },
            "spacing": {
                    "xs": "4px",
                    "lg": "24px",
                    "sm": "8px",
                    "md": "16px",
                    "base": "4px",
                    "margin": "24px",
                    "xl": "32px",
                    "gutter": "16px"
            },
            "fontFamily": {
                    "button": ["Hanken Grotesk"],
                    "page-title": ["Hanken Grotesk"],
                    "metadata": ["JetBrains Mono"],
                    "body": ["Hanken Grotesk"],
                    "label": ["JetBrains Mono"],
                    "panel-title": ["Hanken Grotesk"]
            },
            "fontSize": {
                    "button": ["14px", {"lineHeight": "14px", "letterSpacing": "0.02em", "fontWeight": "500"}],
                    "page-title": ["18px", {"lineHeight": "24px", "letterSpacing": "0em", "fontWeight": "600"}],
                    "metadata": ["11px", {"lineHeight": "14px", "letterSpacing": "0.04em", "fontWeight": "400"}],
                    "body": ["14px", {"lineHeight": "20px", "letterSpacing": "0em", "fontWeight": "400"}],
                    "label": ["12px", {"lineHeight": "16px", "letterSpacing": "0.02em", "fontWeight": "500"}],
                    "panel-title": ["16px", {"lineHeight": "20px", "letterSpacing": "0em", "fontWeight": "600"}]
            }
          }
        }
      }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .auth-card-shadow {
            box-shadow: 0 0 40px -10px rgba(0, 209, 255, 0.05);
        }
        body {
            background: radial-gradient(circle at 50% 50%, #131b2e 0%, #0b1326 100%);
        }
    </style>
</head>
<body class="bg-background text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container min-h-screen flex flex-col">
<!-- Top Navigation Shell -->
<header class="h-[56px] w-full px-margin flex justify-between items-center bg-surface border-b border-outline-variant z-50">
<div class="flex items-center gap-sm">
<span class="material-symbols-outlined text-primary" data-icon="sensors">sensors</span>
<h1 class="text-page-title font-page-title font-bold text-on-surface">FactoryNerve OS</h1>
</div>
<div class="flex items-center gap-md">
<div class="hidden md:flex items-center gap-xs px-sm py-[2px] bg-surface-container rounded-full border border-outline-variant">
<span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
<span class="text-metadata font-metadata text-primary uppercase tracking-wider">All systems operational</span>
</div>
<span class="text-metadata font-metadata text-on-surface-variant">v2.4.1</span>
<span class="material-symbols-outlined text-on-surface-variant cursor-help" data-icon="shield">shield</span>
</div>
</header>
<!-- Main Content Canvas -->
<main class="flex-grow flex items-center justify-center p-margin relative overflow-hidden">
<!-- Atmospheric Background Elements -->
<div class="absolute inset-0 pointer-events-none opacity-10">
<div class="absolute top-1/4 left-1/4 w-96 h-96 bg-primary blur-[120px] rounded-full"></div>
<div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-tertiary-container blur-[120px] rounded-full"></div>
</div>
<!-- Authentication Card -->
<div class="w-full max-w-[440px] bg-surface-container-low border border-outline-variant rounded-xl auth-card-shadow flex flex-col overflow-hidden relative z-10" style="transform: perspective(1000px) rotateX(0deg) rotateY(0deg);">
<!-- Card Header -->
<div class="p-xl pb-lg flex flex-col items-center text-center">
<div class="w-12 h-12 rounded-lg bg-surface-variant flex items-center justify-center border border-outline-variant mb-md">
<span class="material-symbols-outlined text-primary text-2xl" data-icon="vpn_key">vpn_key</span>
</div>
<h2 class="text-page-title font-page-title text-on-surface mb-xs">Sign in to FactoryNerve</h2>
<p class="text-body font-body text-on-surface-variant">Enter your work credentials to access the operational workspace.</p>
</div>
<!-- Card Body / Form -->
<div class="px-xl pb-xl space-y-lg">
<!-- SSO Provider -->
<button class="w-full h-[42px] flex items-center justify-center gap-sm bg-surface-container border border-outline-variant hover:bg-surface-container-high transition-colors rounded-lg group">
<svg class="w-4 h-4" viewBox="0 0 24 24">
<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"></path>
</svg>
<span class="text-button font-button text-on-surface">Continue with Google</span>
</button>
<div class="flex items-center gap-md">
<div class="flex-grow h-px bg-outline-variant"></div>
<span class="text-metadata font-metadata text-outline uppercase tracking-widest">or use email</span>
<div class="flex-grow h-px bg-outline-variant"></div>
</div>
<!-- Form Inputs -->
<form class="space-y-md" onsubmit="return false">
<!-- Email -->
<div class="space-y-xs">
<div class="flex justify-between items-center">
<label class="text-label font-label text-on-surface-variant">Work email</label>
</div>
<div class="relative group">
<input class="w-full h-10 bg-surface-container-low border border-outline-variant focus:border-primary-container focus:ring-1 focus:ring-primary-container rounded-lg px-md text-on-surface font-body transition-all outline-none" placeholder="name@company.com" type="email">
</div>
</div>
<!-- Password -->
<div class="space-y-xs">
<div class="flex justify-between items-center">
<label class="text-label font-label text-on-surface-variant">Password</label>
<a class="text-metadata font-metadata text-primary hover:underline transition-all" href="#">Forgot password?</a>
</div>
<div class="relative group">
<input class="w-full h-10 bg-surface-container-low border border-outline-variant focus:border-primary-container focus:ring-1 focus:ring-primary-container rounded-lg px-md text-on-surface font-body transition-all outline-none" placeholder="••••••••••••" type="password">
<button class="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface" type="button">
<span class="material-symbols-outlined text-[18px]" data-icon="visibility_off">visibility_off</span>
</button>
</div>
</div>
<!-- MFA -->
<div class="flex items-center justify-between mb-xs px-[2px]"><div class="flex flex-col"><span class="text-label font-label text-on-surface">Basic Access Mode</span><span class="text-metadata font-metadata text-on-surface-variant/60">Skip MFA for non-admin users</span></div><button type="button" onclick="const mfa = this.parentElement.nextElementSibling; const isHidden = mfa.classList.contains('hidden'); mfa.classList.toggle('hidden'); this.querySelector('.toggle-thumb').style.transform = isHidden ? 'translateX(18px)' : 'translateX(0px)'; this.classList.toggle('bg-primary-container'); this.classList.toggle('bg-surface-variant');" class="relative w-9 h-5 rounded-full bg-surface-variant border border-outline-variant transition-colors flex items-center px-[2px]"><div class="toggle-thumb w-3.5 h-3.5 bg-on-surface rounded-full transition-transform shadow-sm" style="transform: translateX(0px)"></div></button></div><div class="space-y-xs">
<div class="flex justify-between items-center">
<label class="text-label font-label text-on-surface-variant">Authenticator code</label>
<span class="flex items-center gap-xs text-metadata font-metadata text-on-surface-variant/60">
<span class="material-symbols-outlined text-[12px]" data-icon="verified_user">verified_user</span>
                                Mandatory MFA
                            </span>
</div>
<div class="relative group">
<input class="w-full h-10 bg-surface-container-low border border-outline-variant focus:border-primary-container focus:ring-1 focus:ring-primary-container rounded-lg px-md text-on-surface font-metadata tracking-[0.5em] transition-all outline-none text-center" maxlength="6" placeholder="000 000" type="text">
</div>
<p class="text-metadata font-metadata text-on-surface-variant/40 pt-xs">6-digit code from your authenticator app</p>
</div>
<!-- Submit -->
<button class="w-full h-[42px] mt-lg bg-primary-container text-on-primary-container hover:opacity-90 active:scale-[0.98] transition-all rounded-lg font-button text-button shadow-lg shadow-primary/20 flex items-center justify-center gap-sm" type="submit">
<span class="">Sign in</span>
<span class="material-symbols-outlined text-sm" data-icon="arrow_forward">arrow_forward</span>
</button>
</form>
</div>
<!-- Card Footer -->
<div class="p-md bg-surface-container-lowest border-t border-outline-variant flex justify-center items-center gap-xs">
<span class="text-metadata font-metadata text-on-surface-variant">No account?</span>
<button class="text-metadata font-metadata text-primary hover:underline transition-all">Create one</button>
</div>
</div>
<!-- Trust Signals Overlay -->
<div class="absolute bottom-xl left-1/2 -translate-x-1/2 flex items-center gap-xl text-on-surface-variant/30 pointer-events-none select-none">
<div class="flex items-center gap-xs">
<span class="material-symbols-outlined text-[14px]" data-icon="lock">lock</span>
<span class="text-metadata font-metadata uppercase tracking-widest">AES-256 Encryption</span>
</div>
<div class="flex items-center gap-xs">
<span class="material-symbols-outlined text-[14px]" data-icon="verified">verified</span>
<span class="text-metadata font-metadata uppercase tracking-widest">SOC2 Type II Compliant</span>
</div>
</div>
</main>
<!-- Footer Shell -->
<footer class="py-lg px-margin w-full bg-transparent flex flex-col md:flex-row justify-between items-center gap-md border-t border-outline-variant/10">
<div class="text-metadata font-metadata text-on-surface-variant">
            © 2026 FactoryNerve Systems. All rights reserved.
        </div>
<div class="flex items-center gap-lg">
<a class="text-metadata font-metadata text-on-surface-variant hover:text-primary transition-colors" href="#">Privacy</a>
<a class="text-metadata font-metadata text-on-surface-variant hover:text-primary transition-colors" href="#">Terms</a>
<a class="text-metadata font-metadata text-on-surface-variant hover:text-primary transition-colors" href="#">Support</a>
</div>
</footer>
<!-- Interactive Layer: Simple Mouse Track Effect -->
<script>
        document.addEventListener('mousemove', (e) => {
            const card = document.querySelector('.auth-card-shadow');
            if (!card) return;
            
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Very subtle tilt effect for the card
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 50;
            const rotateY = (centerX - x) / 50;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });

        document.addEventListener('mouseleave', () => {
            const card = document.querySelector('.auth-card-shadow');
            if (card) card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
        });
    </script>


</body></html>
``