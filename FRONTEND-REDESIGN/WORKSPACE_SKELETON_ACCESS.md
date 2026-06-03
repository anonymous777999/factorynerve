# Access — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification
# Route: /access  (alias: /login)
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/access` (canonical) — `/login` re-exports the same component via `export { default } from "../login/page"` |
| Workspace Name | System Access — Factory Sign-In Hub |
| Operational Role | Authenticates factory operators via email+password or Google OAuth; resolves post-login role routing to the correct operational workspace; surfaces contextual status messages from upstream redirects (session expired, permissions updated, password reset success, email verified). |
| Business Impact | If this workspace fails, every user in every factory is locked out of all operational workflows simultaneously. This is the single entry gate for the entire platform. |
| User Population | Every role — attendance, operator, supervisor, accountant, manager, admin, owner. Used at the start of every shift by shift workers; used on-demand by admin/manager/owner roles throughout the day. |
| Peak Usage Context | Shift start (5:30am–8:30am, 12:00pm, 6:00pm) for attendance and operator roles; continuous for supervisors and managers. High-frequency, daily, operationally critical. |
| Predecessor Workspaces | Direct URL entry, `/register` (new account flow), `/forgot-password` → `/reset-password` (recovery flow), `/verify-email` (activation flow), redirect from any protected route on session expiry |
| Successor Workspaces | Role-determined: attendance→`/attendance`, operator→`/dashboard`, supervisor→`/approvals`, accountant→`/reports`, manager→`/dashboard`, admin→`/settings`, owner→`/control-tower` or `/premium/dashboard`; or the `?next=` redirect target |

### 1.2 Operational Importance

The access workspace is the highest-criticality page in FactoryNerve OS. An operator who cannot sign in cannot record their shift start, cannot submit production entries, and cannot perform any factory workflow. For shift workers, a sign-in failure at 6am is not a minor inconvenience — it can block an entire shift's worth of work data until the issue is resolved. The workspace is used daily by every role, often under time pressure (shift start), and must complete the authentication action in the fewest keystrokes possible. At the same time, it is the primary recovery surface for users returning after a session expiry, password reset, or permissions change — and must communicate those upstream events clearly.

### 1.3 Current State Failures

- `Label` component uses `font-mono text-[11px] uppercase tracking-[0.18em]` — multiple violations: `font-mono` is forbidden for form labels (monospace is for timestamps/codes only per `--type-timestamp`); `uppercase` with `tracking-[0.18em]` is 3× the permitted maximum for any label; both "Work email" and "Password" labels carry these violations
- The password show/hide toggle uses `uppercase tracking-[0.16em]` — same tracking violation as the button toggle pattern flagged in the register skeleton; must use sentence case at `--type-label` scale
- The divider between Google provider and the credential form uses `font-mono text-[11px] font-semibold uppercase tracking-[0.22em]` for "Operator email" text — `tracking-[0.22em]` is 3.7× the permitted maximum; the monospace + uppercase combination is doubly forbidden; this element is decorative and must be redesigned as a simple separator
- The "Forgot password?" link uses `text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--action-primary)]` — forbidden tracking, forbidden uppercase, forbidden raw token alias; must use sentence case `--type-label` (12px) with `text-action-primary` token class
- The "Need provisioning?" label in the footer uses `font-mono text-[11px] uppercase tracking-[0.2em]` — triple violation: monospace, uppercase, excessive tracking; must use `--type-label` (12px/500/sentence case/Inter UI)
- The Google provider button sub-label uses `text-[11px] uppercase tracking-[0.16em]` for "Work account" — same violation pattern; must use sentence case at `--type-label`
- The resend-verification span inside the status message uses `font-mono text-[11px] uppercase tracking-[0.16em]` — the "Use the same signup inbox." contextual hint is styled with forbidden mono+uppercase+tracking
- The "Forgot password?" link uses `text-[var(--action-primary)]` raw CSS variable alias instead of `text-action-primary` token class
- The "Create account" footer link uses `text-[var(--action-primary)]` raw alias instead of `text-action-primary` token class
- The Google provider button uses `focus-visible:ring-accent` — `ring-accent` is a raw token alias; should use `ring-action-primary` or the system focus-visible ring class
- The AuthWorkstationShell left panel title uses `text-[clamp(3rem,3.9vw,4.5rem)]` — this affects all pages using AuthWorkstationShell; on this workspace the left title renders at up to 72px which is excessive and violates the 18px `--type-page-title` ceiling; the clamp() sizing is a marketing-scale heading pattern that is explicitly forbidden in operational interfaces
- The AuthWorkstationShell badge and metadata labels use `uppercase tracking-[0.24em]` — the shell-level violation flagged in the forgot-password and verify-email specs; affects the "Secure access" badge chip and "Authentication lane" / metric labels
- The AuthWorkstationShell status rail uses `bg-[linear-gradient(...)]` on active rails — gradient is explicitly forbidden per anti-pattern rules; must use a solid semantic token fill
- No `autoFocus` on the email field — the operator must click to begin typing on shift-start

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Auth / Onboarding | Outside the app shell; no sidebar; entry gate for all operational workflows |
| Workflow Category | Execution | User performs a sequential action with immediate operational consequence: sign in → role-routed workspace |
| Operational Behavior | Form-Driven | Two-field credential form + one OAuth provider button; most interactions complete in <15 seconds |
| Data Density | LOW | Two inputs, one provider button, one submit, one status panel, one footer; no tables |
| Realtime Complexity | LOW | Backend warm-up check on mount (`warmBackendConnection`); no subscriptions; 503/wake-retry path |
| AI Complexity | NONE | No AI systems involved |
| Audit Complexity | LOW | Backend writes `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILED`, `AUTH_LOGIN_MFA_REQUIRED` — not surfaced in UI |
| Decision Pressure | HIGH | Operators arrive at shift start under time pressure; sign-in must be fast and keyboard-complete; errors must be immediately actionable |

**Classification Implication:**
This is the highest-traffic, highest-pressure workspace in Phase A despite being LOW density. The form has only two fields, but it is used daily by every role, often at shift start when cognitive load is high and time is tight. The workspace must optimize for: (1) fastest possible keyboard path (email → Tab → password → Enter), (2) immediate error clarity (wrong password vs. unverified email vs. rate limited), and (3) zero visual distraction. The left panel's operational value here is lower than on register/verify-email because experienced operators do not need workflow context — they know why they're here. The left panel shows the role-based destination hint (via `redirectHint`/`metrics` prop) which provides operational value when a `?next=` redirect is in play.

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Permission | Key Response Fields | Error States |
|---|---|---|---|---|---|
| `POST /auth/v2/login` | POST | Authenticates via email+password; checks `AuthUser` (argon2), falls back to legacy `User` (bcrypt) and repairs hash; enforces rate limiting; enforces email verification gate; enforces MFA if enabled | Public | Full `AuthResponse` (access_token, refresh_token, user, active_factory, factories, organization) | HTTP 401 "Invalid credentials." (wrong password / user not found) · HTTP 403 "Please verify your email before signing in." · HTTP 429 (rate limited, max 5 attempts per 60s window per IP) · HTTP 503 (backend waking from Render sleep) |
| `GET /api/auth/google/login?next=` | GET | Initiates Google OAuth flow; redirects to Google; returns to `/access?oauth_error=` on failure | Public | Redirect (302) | `?oauth_error=` query param on callback failure |
| `POST /auth/email/verification/resend` | POST | Resends signup verification email when user tries to sign in before verifying | Public | `message`, `verification_link` (preview only) | Always 200; privacy-safe |
| `GET /observability/ready` | GET | Backend warm-up — fires on mount, retries until 200 (max 25s) | Public | HTTP 200 or 503 | Not surfaced in UI; warm-up completes silently |

**Critical backend behaviors:**

1. **Dual credential system**: `POST /auth/v2/login` checks `AuthUser.password_hash` (argon2) first. If that fails but `User.password_hash` (bcrypt) matches, it auto-repairs the `AuthUser` record and proceeds. Users who registered before the auth migration may have only bcrypt hashes — this is transparent to them.

2. **Email verification gate**: HTTP 403 `"Please verify your email before signing in."` is returned when `AuthUser.is_email_verified = false`. The frontend detects this via `error.toLowerCase().includes("verify your email")` and surfaces a "Resend verification" button. This is the `canResendVerification` flag.

3. **Rate limiting**: 5 attempts per 60 seconds per IP. HTTP 429 is returned. The frontend currently shows the 429 message from the backend. The UI does not show a countdown — it shows the error message.

4. **MFA gate**: If `AuthUser.mfa_enabled = true` and no `mfa_code` is in the payload, HTTP 401 "Invalid credentials." is returned (deliberately generic — does not reveal MFA status). The current frontend does NOT have an MFA code input field — MFA is implemented in `auth_secure.py` but the `/access` page does not expose it. This is a known gap.

5. **`?next=` redirect**: The `nextPath` extracted from `searchParams.get("next")` must start with `/` and must not be a loop path (`/login`, `/access`, `/register`). On successful login, `router.replace(nextPath === "/" ? roleHome : nextPath)`.

6. **`?reason=` param**: Values: `permissions_updated` (role changed by admin) · `session_expired` · `account_suspended`. Surfaces via `resolveAccessReasonMessage()`.

7. **`?reset=1`**: Shows "Password updated. Sign in with your new password." success message.

8. **`?verified=1`**: Shows "Email verified. Access is ready." success message.

9. **`?oauth_error=`**: Shows the OAuth error message from Google callback failure.

### 3.2 Entity Relationship Map

```
AuthUser (email, password_hash, is_email_verified, mfa_enabled)
    │  [legacy fallback]
    │── User (id, email, role, org_id, is_active, email_verified_at)
    │         └── UserFactoryRole (factory_id, role)
    │                   └── Factory (factory_id, name, industry_type)
    │                             └── Organization (org_id, plan)
    │
    └── [on successful auth] AuthResponse:
              access_token + refresh_token (cookie-set)
              user: {id, email, role, permissions, factory_name, ...}
              active_factory: FactoryAccess
              factories: FactoryAccess[]
              organization: OrganizationContext
```

**Primary entity:** `AuthUser` (resolution gateway to the full `User`/`Factory`/`Organization` graph)
**Post-login routing:** `getHomeDestination(user.role, accessibleFactories)` determines the destination workspace. The entity graph provides both the role and factory count required for this routing.

### 3.3 Workflow State Machine

```
[PAGE LOAD]
    → warmBackendConnection() fires (silent, no UI change)
    → resolve routeInfo from searchParams:
          ?reason=permissions_updated → neutral status message
          ?reason=session_expired → neutral status message
          ?reason=account_suspended → error status message
          ?reset=1 → success status message
          ?verified=1 → success status message
          ?oauth_error=... → error status message (from OAuth callback)
    → [READY TO SIGN IN] — status panel shown if routeInfo non-null

[EMAIL+PASSWORD SIGN-IN]
    → user types email + password → submits
    → [LOADING] form disabled, button isBusy
        → HTTP 503 → retry message; form re-enabled
        → HTTP 429 → rate-limit message; form re-enabled
        → HTTP 403 "verify your email" → error panel + canResendVerification=true
              → "Resend verification" button available
        → HTTP 401 → "Invalid credentials." error; form re-enabled
        → HTTP 200 (AuthResponse)
              → roleHome = getHomeDestination(role, accessibleFactories)
              → router.replace(nextPath || roleHome)
              → [NAVIGATED AWAY — workspace exits]

[GOOGLE SIGN-IN]
    → user clicks Google provider button
    → [GOOGLE LOADING] button shows spinner
    → startGoogleLogin(nextPath) → window.location.assign("/api/auth/google/login?next=...")
    → [NAVIGATED AWAY or returns with ?oauth_error=]

[RESEND VERIFICATION]
    → user clicks "Resend verification" (only visible when canResendVerification=true)
    → [RESENDING] button loading
        → success → info message shows; infoTone="success"
        → error → info message shows; infoTone="neutral"
```

**Status message priority hierarchy** (only one status panel shown at a time):
1. `info` (from resend-verification result) — overrides error during active resend flow
2. `error` (from failed sign-in or account_suspended reason)
3. `routeInfo` (from ?reason=, ?reset=, ?verified=, ?oauth_error=) — shown on page load, cleared on first submit

### 3.4 Realtime Contracts

| System | Transport | Behavior |
|---|---|---|
| Backend warm-up | HTTP polling | `warmBackendConnection()` fires on mount; retries `/observability/ready` up to 25s; no UI change on success; 503 error shown only if sign-in attempt fails while still waking |

### 3.5 AI System Contracts

Not applicable.

### 3.6 Permission Matrix

| Role | Access |
|---|---|
| Anonymous (unauthenticated) | Full access — this is the entry gate |
| Any authenticated user | N/A — redirected away by AppShell guard to their home destination |

**Permission implication:** Entirely public. No role-based zone visibility.

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

```
SPLIT AUTH LAYOUT: Left context panel (desktop only) + Right form panel (always visible)
```

Identical structural split to all Phase A auth-shell workspaces. Left panel: 45% desktop (≥1024px), hidden mobile. Right panel: 55% desktop, 100% mobile. Inner panel: `max-width: 480px`.

**Pattern justification:** Constitutional law — all auth-shell pages share `AuthWorkstationShell`. Uniquely for `/access`, the left panel's `metrics` prop carries the `redirectHint` — when a `?next=` redirect is in play, the metric shows "Requested destination: [workspace]" which gives the operator context for why they were redirected to sign in. This is the left panel's primary operational payload on this workspace.

**Structural reduction note:** The login form is the simplest form in Phase A. Two fields, one provider button, one submit. No FieldSection grouping, no role selectors, no multi-step workflow. The right panel's single job is: get email, get password, submit. Every element that does not directly serve this must be eliminated or minimized.

---

### 4.2 Zone Definitions

---

#### ZONE: Auth Topbar

| Property | Value |
|---|---|
| Operational Role | Brand anchor; navigation to home |
| Attention Priority | 5 |
| Position | top, full width |
| Width | fluid: 100% |
| Height | fixed: 56px |
| Sticky Behavior | not sticky |
| Collapse Behavior | never |
| Scroll Behavior | none |
| Density Mode | default |
| Existence Justification | Consistent with all Phase A auth-shell workspaces |

**Contents:**
- Logo/brand link (`Building2` + "DPR.ai") → homeHref
- Industry label + Platform label (right) — `--type-label` (12px/500/sentence case), `text-action-primary` for platform label

**Acceptance Criteria:**
- [ ] Height exactly 56px
- [ ] Logo navigates to `/`
- [ ] Both meta labels sentence case — NOT `uppercase tracking-[0.24em]`
- [ ] Platform label uses `text-action-primary`

---

#### ZONE: Left Context Panel

| Property | Value |
|---|---|
| Operational Role | Provides authentication context, workflow steps for first-time users, security posture signal; and — critically — the redirect destination hint when `?next=` is in play |
| Attention Priority | 4 |
| Position | left |
| Width | 45% desktop; hidden <1024px |
| Height | fill-remaining |
| Sticky Behavior | not sticky |
| Collapse Behavior | hidden at <1024px |
| Scroll Behavior | independent on short viewports |
| Density Mode | default |
| Existence Justification | AuthWorkstationShell left panel — provides workflow orientation + redirect destination context via metrics prop |

**Contents:**
- Eyebrow: "Authentication lane" — `--type-label` (12px/500/tertiary/sentence case); NOT uppercase
- Page title: "System access" — `--type-page-title` (18px/600/sentence case); NOT `clamp(3rem,3.9vw,4.5rem)` (shell violation to fix)
- Description: `--type-body` (14px/400/`text-text-secondary`) — "Sign in to open your factory workspace."
- Authentication steps card (3 steps, sentence case):
  - 01 — "Validate operator identity" — submitting registered inbox or connected provider
  - 02 — "Confirm access controls" — role and factory context determine workspace
  - 03 — "Resume factory workflow" — lands directly in the assigned desk
- Redirect destination metric (conditional — only when `redirectHint` non-null):
  - Label: "Requested destination" — `--type-label` (12px/500/tertiary/sentence case); NOT `uppercase tracking-[0.18em]`
  - Value: `redirectHint` text (e.g., "Open operations board") — `--type-body` (14px/500/`text-text-primary`)
- Security posture card: `ShieldCheck` icon + 3 security bullets (14px/400/`text-text-secondary`)

**Acceptance Criteria:**
- [ ] Hidden at viewport <1024px
- [ ] Page title at 18px (`--type-page-title`) — NOT clamp()
- [ ] All labels sentence case — NO uppercase tracking
- [ ] Redirect destination metric is present only when redirectHint is non-null
- [ ] Metric label uses `--type-label` (12px/500/sentence case) — NOT `uppercase tracking-[0.18em]`
- [ ] Security posture card present
- [ ] No interactive elements in left panel

---

#### ZONE: Right Sign-In Panel

| Property | Value |
|---|---|
| Operational Role | Primary operational surface; contains the complete sign-in form (Google OAuth + email+password credential form + status messages + footer navigation) |
| Attention Priority | 1 |
| Position | right (center on mobile) |
| Width | 55% desktop; 100% mobile; inner `max-width: 480px` |
| Height | fill-remaining; vertically centered; fits without scroll on standard viewports |
| Sticky Behavior | not sticky |
| Collapse Behavior | never |
| Scroll Behavior | scroll when viewport height <600px |
| Density Mode | default |
| Existence Justification | The entire sign-in action — the reason this workspace exists |

**Contents:**

**Panel header (static):**
- Badge chip: "Secure access" — `--type-label` (12px/500/sentence case/`surface-shell` bg); NOT `uppercase tracking-[0.24em]` (shell violation to fix)
- Panel title: "Identify user" — `--type-panel-title` (16px/600/sentence case); NOT `text-[2rem]` (shell violation to fix)
- Panel description: "Continue with Google or use work credentials." — `--type-body` (14px/400)

**Google OAuth provider button:**
- Full-width button (`min-h-[56px]`, `factory-auth-provider` class)
- Left content: Google logo area (rounded icon container with `ShieldCheck` or Google SVG) + text block:
  - "Continue with Google" — `--type-body` (14px/600/`text-text-primary`/sentence case)
  - "Work account" — `--type-label` (12px/500/`text-text-secondary`/sentence case); NOT `uppercase tracking-[0.16em]`
- Right content: `ArrowRight` icon (when idle), `Loader2 animate-spin` (when `googleLoading`)
- Disabled state: reduced opacity, `cursor-not-allowed`
- Surface: `surface-shell` bg, `border-border-default`
- Focus: `focus-visible:ring-action-primary` — NOT `ring-accent`

**Provider/credential divider:**
- Horizontal rule with center label: "Or sign in with email" — `--type-label` (12px/500/`text-text-secondary`/sentence case); NOT `font-mono uppercase tracking-[0.22em]`
- Divider lines: `border-border-subtle`

**Credential form:**
- Email field:
  - `Label` "Work email" — `--type-label` (12px/500/sentence case/Inter UI); NOT `font-mono uppercase tracking-[0.18em]`
  - `Input` `type="email"`, `autoComplete="email"`, `autoFocus`, `required`, `min-h-[40px]`, left icon: `Mail` at `text-text-tertiary`
- Password field:
  - `Label` row: "Password" label (left, `--type-label`) + "Forgot password?" link (right):
    - Link: `--type-label` (12px/500/sentence case), `text-action-primary` token class; NOT `uppercase tracking-[0.18em] text-[var(--action-primary)]`
  - `Input` `type="password"` (or "text" when `showPassword`), `autoComplete="current-password"`, `required`, `min-h-[40px]`, left icon: `KeyRound`, right slot: show/hide toggle button
  - Show/Hide toggle button: sentence case ("Show" / "Hide"), `--type-label` (12px/500); NOT `uppercase tracking-[0.16em]`
- Submit button: `Button variant="primary"`, full width, `h-[42px]`, label "Sign in", `isBusy` prop, `busyLabel="Signing in..."`

**Status message panel (conditional — shows only when `surfaceStatus` is non-null):**
- Container: semantic tone classes via `statusClasses(tone)`:
  - `neutral`: `surface-shell` + `border-border-default` + `text-text-secondary`
  - `success`: `status-success-bg` + `border-success` + `text-status-success-fg`
  - `error`: `status-danger-bg` + `border-danger` + `text-status-danger-fg`
- Body: status message text — `--type-body` (14px/400)
- Conditional resend row (only when `canResendVerification=true` AND tone is "error"):
  - `Button variant="outline"` "Resend verification" — `isBusy` state shows "Sending..."
  - Context hint: "Use the same signup inbox." — `--type-label` (12px/400/`text-text-secondary`/sentence case); NOT `font-mono uppercase tracking-[0.16em]`

**Footer:**
- Left: "Need provisioning?" label — `--type-label` (12px/500/`text-text-secondary`/sentence case); NOT `font-mono uppercase tracking-[0.2em]`
- Right: "Create account" link + `ArrowRight` icon — `--type-body` (14px/600/`text-action-primary`); NOT `text-[var(--action-primary)]`
- Separator: `border-border-subtle` top

**Acceptance Criteria — Panel header:**
- [ ] Badge chip at 12px/500/sentence case — NOT uppercase tracking
- [ ] Panel title at 16px — NOT `text-[2rem]`
- [ ] Panel description sentence case

**Acceptance Criteria — Google button:**
- [ ] Min height 56px
- [ ] Sub-label "Work account" at 12px/500/sentence case — NOT uppercase tracking
- [ ] Loading state shows `Loader2 animate-spin` spinner
- [ ] Focus ring uses `ring-action-primary` — NOT `ring-accent`

**Acceptance Criteria — Divider:**
- [ ] Center text "Or sign in with email" at 12px/500/sentence case/Inter UI — NOT monospace uppercase

**Acceptance Criteria — Form fields:**
- [ ] Email label "Work email" at 12px/500/sentence case/Inter UI — NOT monospace uppercase
- [ ] Email input has `autoFocus` on page mount
- [ ] Email input has `type="email"`, `autoComplete="email"`, left `Mail` icon
- [ ] Password label "Password" at 12px/500/sentence case/Inter UI — NOT monospace uppercase
- [ ] "Forgot password?" link at 12px/500/sentence case, `text-action-primary` class — NOT uppercase tracking or raw alias
- [ ] Password input has `autoComplete="current-password"`, left `KeyRound` icon
- [ ] Show/hide toggle uses sentence case ("Show" / "Hide") — NOT uppercase tracking
- [ ] Submit button uses `isBusy` + `busyLabel="Signing in..."` pattern

**Acceptance Criteria — Status panel:**
- [ ] Status panel renders only when `surfaceStatus` is non-null
- [ ] Three tone variants use semantic token classes only — no raw Tailwind color classes
- [ ] Resend verification button appears only when `canResendVerification=true`
- [ ] Resend context hint uses sentence case `--type-label` — NOT monospace uppercase

**Acceptance Criteria — Footer:**
- [ ] "Need provisioning?" at 12px/500/sentence case/Inter UI — NOT monospace uppercase
- [ ] "Create account" link uses `text-action-primary` class — NOT `text-[var(--action-primary)]`

### 4.3 Zone Interaction Rules

```yaml
zone_interactions:
  - trigger: page mounts with ?reason=, ?reset=, ?verified=, or ?oauth_error= params
    effect: Right Sign-In Panel → status panel renders with routeInfo message and tone;
      Left panel → if ?next= is present, metrics shows redirect destination
    reason: user was redirected here for a specific reason; the context must be surfaced
      immediately so they understand why they're on the sign-in page

  - trigger: user submits form (POST /auth/v2/login)
    effect: submit button enters isBusy; form inputs disabled; routeInfo status clears;
      error/info clears
    reason: loading state prevents double-submission; prior messages cleared on new attempt

  - trigger: POST /auth/v2/login returns HTTP 200 (success)
    effect: router.replace(nextPath || roleHome) → page navigates away
    reason: on success the workspace exits; it is not the operator's destination

  - trigger: POST /auth/v2/login returns HTTP 403 "verify your email"
    effect: error panel shown; canResendVerification=true → "Resend verification" button visible
    reason: user needs a specific action (resend verification) — a generic error message
      without the resend button leaves them with no path forward

  - trigger: POST /auth/v2/login returns HTTP 401 (invalid credentials)
    effect: error panel shown with "Invalid credentials." message; canResendVerification=false
    reason: generic error does not reveal whether the email exists (security)

  - trigger: POST /auth/v2/login returns HTTP 429 (rate limited)
    effect: error panel shown with rate-limit message from backend; form re-enabled
    reason: operator must know they've been rate limited before retrying

  - trigger: POST /auth/v2/login returns HTTP 503 (backend waking)
    effect: error panel shown with wake-up message "Hold for a few seconds, then try again."
    reason: Render.com sleep wake can take up to 25s; operator must not abandon the page

  - trigger: canResendVerification=true AND user clicks "Resend verification"
    effect: resend button enters isBusy; POST /auth/email/verification/resend fires;
      result shown in info panel (success or neutral tone); error clears
    reason: email verification resend is the only forward path for unverified users

  - trigger: user clicks Google provider button
    effect: googleLoading=true; spinner shown on button; startGoogleLogin(nextPath) fires
      → window.location.assign (navigates away)
    reason: Google OAuth is a redirect-based flow; the page navigates to Google's consent screen

  - trigger: viewport width < 1024px
    effect: Left Context Panel hidden; Right Sign-In Panel full width
    reason: mobile sign-in — form only, no context needed
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

### 5.1 Scan Flow

```
SCAN LEVEL 1 (0–200ms): Email input (autoFocus) / Status panel (if present from redirect)
───────────────────────────────────────────────────────────────────────────────────────────
  NORMAL (no redirect): autoFocus places cursor in email field. Shift-start operator
  begins typing immediately — zero clicks. This is the most important UX decision
  on this workspace.

  WITH REDIRECT STATUS: If ?reason= or ?reset= or ?verified= is present, the status
  panel renders before the form and captures immediate attention via its semantic tone.
  Operator reads why they're here, then eyes drop to the email field.

SCAN LEVEL 2 (200ms–800ms): Password field / Submit button
────────────────────────────────────────────────────────────
  After email is typed, Tab moves to password. The submit button is the next
  element after password. The keyboard path email→Tab→password→Enter is the
  complete sign-in flow for experienced operators.

SCAN LEVEL 3 (800ms–2s): Google button / Error panel (on failed attempt)
──────────────────────────────────────────────────────────────────────────
  Google button is above the form — first-time users or Google account holders
  may use it instead of the form. After a failed sign-in, the error panel
  renders above or below the form and captures attention at this level.

  "Forgot password?" link is inline with the password label — reachable at this
  level when the operator realizes they don't know the password.

SCAN LEVEL 4 (2s+): Footer (Create account / Need provisioning?) / Left panel
────────────────────────────────────────────────────────────────────────────────
  Footer is for new users who need to register. Left panel is for first-time
  users who want orientation. Neither is needed by the daily shift operator.
```

### 5.2 Persistent Visibility Requirements

| Element | Reason It Must Persist |
|---|---|
| Submit button | Never scrolls away; keyboard Enter completes sign-in without mouse |
| Status panel (when non-null) | Error messages must be visible before retrying — never below the fold |
| "Forgot password?" link | Reachable inline during password entry — operator must not hunt for it |

### 5.3 Contextual Visibility Rules

```yaml
contextual_rules:
  - condition: surfaceStatus !== null (from routeInfo, error, or info)
    shows: Status panel with appropriate tone class
    hides: nothing (additive)
    reason: status is always informative; additive to the form

  - condition: canResendVerification === true (HTTP 403 "verify your email" error)
    shows: Resend verification button + context hint inside status panel
    hides: nothing (additive)
    reason: specific action available for unverified user; must be visible without scrolling

  - condition: googleLoading === true
    shows: Loader2 spinner on Google button; button disabled
    hides: normal Google button content (replaced by spinner inline)
    reason: OAuth is a redirect — loading state persists until navigation occurs

  - condition: loading === true (POST in flight)
    shows: isBusy spinner on submit button; inputs disabled
    hides: nothing (isBusy is inline on button)
    reason: prevents double-submission

  - condition: ?next= param present AND nextPath !== "/"
    shows: Left panel metrics showing "Requested destination: [label]"
    hides: nothing (additive)
    reason: operator needs to know which workspace they're being redirected to

  - condition: viewport < 1024px
    shows: Right Sign-In Panel full width
    hides: Left Context Panel
    reason: mobile sign-in priority
```

---

## 6. TABLE & DATA STRATEGY

No tables — workspace is form-driven (two-field credential form).

---

## 7. FORM & INPUT STRATEGY

### 7.1 Form Role

| Field | Value |
|---|---|
| Form Purpose | Captures email + password credentials; submits to `POST /auth/v2/login`; on success resolves role-based home destination and navigates |
| Completion Frequency | Daily for shift workers; multiple times per day for managers/supervisors |
| Keyboard Efficiency Priority | CRITICAL — shift workers arrive under time pressure at shift start; entire form must be completable with keyboard only (email → Tab → password → Enter) |
| AI Assistance Available | No |
| Estimated Completion Time | 5–8 seconds for experienced operators (email already known, password memorized) |

### 7.2 Field Group Architecture

```yaml
field_groups:
  - group: Credentials
    operational_purpose: Identify operator and authenticate against factory credential store
    fields:
      - name: email
        label: "Work email"
        type: email
        required: yes
        validation: valid email format (browser native)
        tab_order: 1
        attributes:
          autoFocus: yes
          autoComplete: email
          inputMode: email
          placeholder: "operator@factory.os"
          leftIcon: Mail

      - name: password
        label: "Password"
        type: password (toggleable)
        required: yes
        validation: min_length=1 (client) — strength validated server-side at registration, not sign-in
        tab_order: 2
        attributes:
          autoComplete: current-password
          placeholder: "Enter your password"
          leftIcon: KeyRound
          rightSlot: show/hide toggle (sentence case "Show" / "Hide")
          forgotPasswordLink: "/forgot-password" — inline in label row
```

### 7.3 Validation Strategy

```yaml
validation:
  realtime: []
  on_blur: []
  on_submit:
    - email: required; valid email format (browser native type=email + required)
    - password: required (min_length=1 — not validated for strength at sign-in)
  server_side:
    - HTTP 401: "Invalid credentials." — wrong password or email not found
    - HTTP 403: "Please verify your email before signing in." — triggers resend button
    - HTTP 429: rate-limit message from backend
    - HTTP 503: backend wake-up message
  ai_flagged: []
```

### 7.4 Keyboard Flow

```
Tab Order: [email input] → [password input] → [show/hide toggle] → [submit button]
           [then Tab to]: forgot-password link → Google button → Register link

Keyboard shortcuts:
  - Enter in email: advances to password field
  - Enter in password: submits form (most common completion path)
  - Enter in submit button: submits form

autoFocus: email input on page mount
```

---

## 8. AI & AUDIT VISIBILITY STRATEGY

### 8.1 AI Placement Map
Not applicable.

### 8.2 Audit Visibility Map

```yaml
audit:
  backend_events:
    - AUTH_LOGIN_SUCCESS: written on successful sign-in
    - AUTH_LOGIN_FAILED: written on credential failure
    - AUTH_LOGIN_EMAIL_VERIFICATION_REQUIRED: written on 403 verify-email gate
    - AUTH_LOGIN_MFA_REQUIRED: written when MFA gate is reached
  frontend_display: none
```

### 8.3 Anomaly Visibility
Not applicable.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

### 9.1 Density Mode

```yaml
default_density: default
density_justification: The highest-frequency auth workspace — used at shift start daily.
  Default density (40px inputs) provides comfortable, error-resistant targets for
  fatigued shift-start conditions. Compact density would make the two-field form feel
  austere; comfortable would waste space on a form that needs to feel urgent and efficient.
density_switchable: no
density_specs:
  email_input_height: 40px (44px on mobile)
  password_input_height: 40px (44px on mobile)
  google_button_height: 56px — taller than form inputs; provider button is a distinct affordance
  submit_button_height: 42px
  field_gap: 16px (--space-md) between email and password fields
  google_to_divider_gap: 20px (--space-5)
  divider_to_form_gap: 20px (--space-5)
```

### 9.2 Spacing Rhythm

```yaml
spacing:
  panel_outer_padding: 32px horizontal / 32px vertical
  panel_inner_gap: 20px (--space-5) header to content
  field_gap: 16px (--space-md) between fields
  submit_to_status_gap: 0px (status panel is additive below submit within form space-y-5)
  footer_margin_top: 16px (--space-md) above footer divider
  topbar_height: 56px — consistent
  left_panel_padding: 40px horizontal / 40px vertical
```

### 9.3 Typography Specification

```yaml
typography:
  topbar_brand: 16px / 600 / sentence case / tracking: -0.01em
  topbar_meta: 12px / 500 / sentence case / tracking: 0em
  left_eyebrow: 12px / 500 / sentence case / text-text-tertiary
  left_title: 18px / 600 / sentence case  — NOT clamp()
  left_description: 14px / 400 / text-text-secondary
  left_step_labels: 14px / 500 / sentence case
  left_step_desc: 13px / 400 / text-text-secondary
  left_metric_label: 12px / 500 / sentence case / text-text-tertiary
  left_metric_value: 14px / 500 / text-text-primary
  panel_badge: 12px / 500 / sentence case
  panel_title: 16px / 600 / sentence case
  panel_description: 14px / 400 / text-text-secondary
  provider_button_label: 14px / 600 / sentence case / text-text-primary
  provider_button_sublabel: 12px / 500 / sentence case / text-text-secondary  — NOT mono uppercase
  divider_label: 12px / 500 / sentence case / text-text-secondary / Inter UI  — NOT mono uppercase
  field_label: 12px / 500 / sentence case / Inter UI  — NOT mono uppercase
  forgot_link: 12px / 500 / sentence case / text-action-primary
  input_text: 14px / 400
  show_hide_toggle: 12px / 500 / sentence case  — NOT uppercase tracking
  submit_button: 14px / 500 / sentence case
  status_body: 14px / 400
  resend_hint: 12px / 400 / sentence case / text-text-secondary  — NOT mono uppercase
  footer_label: 12px / 500 / sentence case / text-text-secondary  — NOT mono uppercase
  footer_link: 14px / 600 / sentence case / text-action-primary
```

### 9.4 Surface Token Hierarchy

```yaml
surfaces:
  workspace_background: var(--surface-app)
  auth_shell: var(--surface-shell)
  left_panel: var(--surface-panel)
  right_panel_bg: var(--surface-app)
  form_panel_inner: var(--surface-card)
  provider_button: var(--surface-shell) with var(--border-default) border
  credential_input: var(--surface-elevated) (via Input primitive)
  status_neutral: var(--surface-shell) with var(--border-default)
  status_success: var(--status-success-bg) with var(--status-success-border)
  status_error: var(--status-danger-bg) with var(--status-danger-border)
  security_posture: var(--surface-panel) with var(--border-subtle)
  status_rail_active: var(--status-success-icon)  — solid fill; NOT gradient
  status_rail_inactive: var(--surface-elevated)
```

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

### 10.1 Desktop Workstation (Primary)

```yaml
desktop_workstation:
  min_width: 1280px
  optimal_width: 1440px
  all_zones_visible: yes
  density_mode: default
  form_inner_max_width: 480px
  notes: >
    The most-used auth workspace on desktop — shift supervisors and managers use
    dedicated workstations. The two-field form is simpler than register (8 fields)
    and verify-email (zero fields) — the 480px max-width is appropriate.
```

### 10.2 Compact Desktop (Secondary)

```yaml
compact_desktop:
  width_range: 1024px–1279px
  density_mode: default
  adaptations:
    - left_panel: padding reduces to 24px; stays visible
    - right_panel: max-width unchanged at 480px
  degraded_functionality: none
```

### 10.3 Mobile / Tablet (Degraded Mode)

```yaml
mobile:
  width_range: <768px
  strategy: stacked — left panel hidden; right panel full width
  operational_continuity: full — email+password and Google OAuth both work on mobile
  zones_hidden: [Left Context Panel]
  touch_adjustments:
    - email_input_height: 44px
    - password_input_height: 44px
    - google_button_height: 56px (unchanged — already touch-comfortable)
    - submit_button_height: 48px
    - show_hide_toggle_min_width: 44px
    - forgot_link_min_height: 44px touch target
    - footer_link_min_height: 44px
```

### 10.4 Rail Collapse Behavior

```yaml
rail_collapse:
  left_rail:
    collapse_trigger: viewport width < 1024px
    collapsed_state: hidden
    reinvoke_method: not applicable
  right_rail: not applicable
```

---

## 11. COMPONENT MAPPING

```yaml
component_mapping:
  workspace_container:
    component: AuthWorkstationShell (via LoginOne component)
    reason: LoginOne is the presentation component that renders AuthWorkstationShell with
      the correct sign-in props. It is consumed by the login/access page component.
      The architecture is: LoginPage (state) → LoginOne (presentation) → AuthWorkstationShell (shell).
      This separation is correct and should be preserved.
    props_needed:
      - badge: "Secure access"
      - title: "Identify user"  (shell panel title)
      - description: "Continue with Google or use work credentials."
      - leftTitle: from title prop ("System access")
      - leftDescription: from subtitle prop
      - steps: [3 auth steps]
      - supportTitle: "Factory-safe account flow"
      - supportItems: [3 security bullets]
      - metrics: [{ label: "Requested destination", value: redirectHint }] when redirectHint non-null

  forms:
    - form: Credential sign-in form
      component: HTML <form> with system Field/Label/Input primitives
      field_components:
        - Label: system Label primitive, sentence case, 12px/500 Inter UI
        - Input (email): type=email, autoFocus, autoComplete=email, leftIcon=Mail
        - Input (password): type=password/text, autoComplete=current-password, leftIcon=KeyRound
        - Button (show/hide): sentence case, inline in password field right slot
        - Button (submit): variant="primary", isBusy, busyLabel="Signing in..."

  action_elements:
    - element: Google provider button
      component: <button> with providerButtonClasses (or Button asChild if refactored)
      props: onClick=onGoogleLogin, disabled when loading or no handler
      loading: Loader2 animate-spin inline
    - element: Submit button
      component: Button variant="primary"
      props: isBusy, busyLabel="Signing in...", type="submit", full width, h-[42px]
    - element: Resend verification button
      component: Button variant="outline"
      props: isBusy when resendingVerification, disabled during resend

  status_elements:
    - element: Status message panel
      component: inline div with statusClasses(tone) — conditional render
      tones: neutral (surface-shell) / success (status-success) / error (status-danger)

  navigation_elements:
    - element: Forgot password link
      component: Link (Next.js)
      styling: text-action-primary, sentence case, 12px/500
    - element: Create account link
      component: Link (Next.js)
      styling: text-action-primary, sentence case, 14px/600, ArrowRight icon
    - element: StatusRail (left panel decoration)
      component: StatusRail (existing in AuthWorkstationShell)
      fix_required: Must use solid semantic token fill (var(--status-success-icon))
        instead of bg-[linear-gradient(...)] — gradient is forbidden

  ai_elements: []
```

**Shell-level violations requiring `AuthWorkstationShell` fix (affects all Phase A pages):**
The following violations exist in `AuthWorkstationShell` itself and must be corrected before any auth-shell page fully passes governance. These affect every page using the shell:
1. `leftTitle` renders at `text-[clamp(3rem,3.9vw,4.5rem)]` → must be `18px / 600 / sentence case`
2. Badge chip renders at `uppercase tracking-[0.24em]` → must be `12px / 500 / sentence case`
3. Metadata labels (`factory-auth-metadata`) render at `uppercase tracking-[0.18em]` → sentence case
4. Topbar meta labels render at `uppercase tracking-[0.24em]` → sentence case
5. `StatusRail` active fill uses `bg-[linear-gradient(...)]` → must use `bg-[var(--status-success-icon)]` solid fill
6. Panel `h2` renders at `text-[2rem]` → must be `16px / 600 / sentence case`

---

## 12. OPERATIONAL PROBLEMS SOLVED

```yaml
problem_resolutions:
  - problem: All form labels use font-mono uppercase tracking — three simultaneous violations
      per label ("Work email", "Password" both affected)
    root_cause: Labels use `font-mono text-[11px] uppercase tracking-[0.18em]` — copying
      a stylistic pattern from an earlier design that predates typography governance;
      monospace is reserved for timestamps/codes; uppercase+tracking violate both the
      uppercase usage contract and the 0.06em tracking ceiling
    structural_solution: Section 9.3 specifies all field labels at 12px/500/sentence case/Inter UI;
      Section 4.2 acceptance criteria explicitly require NO monospace or uppercase on field labels
    section_reference: Section 9.3, Section 4.2
    measurable_outcome: Both field labels render in Inter UI at 12px/500/sentence case with
      zero tracking; field labels are visually consistent with register and forgot-password

  - problem: "Forgot password?" link uses uppercase tracking + raw token alias
    root_cause: Link styled with `uppercase tracking-[0.18em] text-[var(--action-primary)]`
      — copied from legacy auth patterns; both the tracking and the alias are forbidden
    structural_solution: Section 9.3 specifies forgot_link at 12px/500/sentence case/text-action-primary;
      Section 4.2 acceptance criteria require sentence case and text-action-primary class
    section_reference: Section 9.3, Section 4.2
    measurable_outcome: "Forgot password?" renders in sentence case with text-action-primary;
      no raw alias references

  - problem: Divider "Operator email" uses monospace + uppercase + tracking-[0.22em]
    root_cause: Divider label used a decorative pattern derived from marketing-style eyebrow
      labels; monospace+uppercase+0.22em tracking is the most extreme violation in this workspace
    structural_solution: Section 9.3 specifies divider_label at 12px/500/sentence case/Inter UI;
      Section 4.2 specifies "Or sign in with email" as the new label in sentence case
    section_reference: Section 9.3, Section 4.2
    measurable_outcome: Divider label renders in Inter UI sentence case; all three violations
      (mono, uppercase, tracking) eliminated

  - problem: Footer "Need provisioning?" uses monospace + uppercase + tracking
    root_cause: Footer label copied the decorative mono-uppercase pattern from an older
      auth page layout pass
    structural_solution: Section 9.3 specifies footer_label at 12px/500/sentence case/Inter UI;
      Section 4.2 acceptance criteria require sentence case footer labels
    section_reference: Section 9.3, Section 4.2
    measurable_outcome: Footer label renders in Inter UI sentence case at 12px

  - problem: Google button sub-label and resend hint both use uppercase + tracking violations
    root_cause: Same root cause as other labels — legacy decorative uppercase pattern
      applied to sub-labels and contextual hints
    structural_solution: Section 9.3 specifies provider_button_sublabel at 12px/500/sentence case
      and resend_hint at 12px/400/sentence case; Section 4.2 acceptance criteria cover both
    section_reference: Section 9.3, Section 4.2
    measurable_outcome: All sub-labels and hints use sentence case; zero uppercase in form area

  - problem: No autoFocus on email field — operator must click on shift start
    root_cause: autoFocus attribute not applied to the email Input
    structural_solution: Section 7.2 specifies autoFocus: yes for email field;
      Section 4.2 acceptance criteria require autoFocus; Section 7.4 keyboard flow
      specifies autoFocus on page mount
    section_reference: Section 7.2, Section 7.4, Section 4.2
    measurable_outcome: Page load places cursor in email field; shift-start operator can
      begin typing immediately without a click

  - problem: Create account and forgot-password links use text-[var(--action-primary)] raw alias
    root_cause: Developer used raw CSS variable alias reference — works but is non-compliant
      and breaks with future token restructuring
    structural_solution: Section 9.3 specifies both links using text-action-primary token class;
      Section 4.2 acceptance criteria explicitly require text-action-primary
    section_reference: Section 9.3, Section 4.2
    measurable_outcome: All links use text-action-primary token class; zero raw var() alias references

  - problem: AuthWorkstationShell StatusRail uses forbidden gradient fill
    root_cause: `bg-[linear-gradient(...)]` was used for visual polish on active rail indicators;
      gradients are explicitly forbidden as an anti-pattern at all phases
    structural_solution: Section 9.4 specifies status_rail_active uses var(--status-success-icon)
      solid fill; Section 11 flags this as a shell-level fix required
    section_reference: Section 9.4, Section 11
    measurable_outcome: StatusRail active state uses solid semantic token color; no gradient

  - problem: Google button focus ring uses ring-accent raw alias
    root_cause: focus-visible:ring-accent references the legacy --accent alias token;
      must use the canonical ring-action-primary
    structural_solution: Section 4.2 acceptance criteria require focus ring uses ring-action-primary
    section_reference: Section 4.2
    measurable_outcome: Google button focus state uses ring-action-primary
```

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

```yaml
implementation_sequence:
  step_1: Fix AuthWorkstationShell shell-level violations (clamp leftTitle, text-[2rem] h2,
    uppercase tracking on badge/metadata/topbar labels, gradient StatusRail) — these affect
    all Phase A pages; this step must be coordinated across all four auth-shell workspaces
  step_2: Fix Label components in LoginOne — replace font-mono + uppercase + tracking on both
    field labels with 12px/500/sentence case/Inter UI
  step_3: Add autoFocus to email Input
  step_4: Fix "Forgot password?" link — sentence case, text-action-primary class, remove tracking
  step_5: Fix divider label — "Or sign in with email", 12px/500/sentence case/Inter UI
  step_6: Fix provider button sub-label — "Work account", 12px/500/sentence case/Inter UI
  step_7: Fix resend-verification hint — sentence case 12px, remove font-mono + uppercase + tracking
  step_8: Fix footer "Need provisioning?" — 12px/500/sentence case/Inter UI, remove font-mono
  step_9: Fix all raw alias token references (text-[var(--action-primary)] → text-action-primary)
  step_10: Fix Google button focus ring (ring-accent → ring-action-primary)
  step_11: Verify show/hide password toggle uses sentence case ("Show" / "Hide") — not uppercase
  step_12: Responsive confirmation — left panel hides <1024px; touch targets ≥44px on mobile
```

### 13.2 Critical Constraints

```yaml
critical_constraints:
  - "AuthWorkstationShell shell fixes (step_1) must be coordinated across all four Phase A pages —
     login, register, forgot-password, verify-email all use the same shell and will all benefit
     from the same fix; do not fix in isolation"
  - "Do not modify the LoginPage → LoginOne → AuthWorkstationShell component separation;
     the state/presentation split is correct and well-structured"
  - "autoFocus on email must be present — this is the primary UX requirement for shift-start
     operators"
  - "The MFA gap is documented but out of scope — the /access workspace does not expose an
     MFA code input; MFA-enabled users receive 401 'Invalid credentials' and cannot sign in
     via this page without disabling MFA; this is a product decision, not a bug to fix here"
  - "Do not add any animation or transition to static elements — the Google button loading
     spinner (Loader2 animate-spin) is the only animation permitted and it is loading-state only"
  - "All spacing values must follow the 4px scale"
  - "No hex values anywhere — all surfaces use token variables"
  - "Do not modify AppShell scroll architecture"
```

### 13.3 Open Questions

```yaml
open_questions:
  - question: >
      MFA gap: AuthUser.mfa_enabled is supported in the backend (auth_secure.py) and the
      login endpoint checks for mfa_code in the payload. However, the /access workspace
      does not present an MFA code input field. Users with MFA enabled receive HTTP 401
      "Invalid credentials." and cannot sign in. Is there a planned MFA code input step
      for the /access workspace, or is MFA limited to the auth_secure.py direct API
      consumer path only?
    blocking: no — current behavior (no MFA UI) is consistent with existing product state
    owner: product owner / engineering
    decision_needed_by: informational; plan before Phase E (intelligence layer) if MFA
      is to be surfaced in the frontend

  - question: >
      The AuthWorkstationShell shell-level violations (clamp leftTitle, text-[2rem] h2,
      badge uppercase tracking, gradient StatusRail) are documented in this spec and in
      the forgot-password and verify-email specs. Should these be fixed in a single dedicated
      AuthWorkstationShell governance task, or as part of each page's individual implementation
      task? The former is more efficient; the latter risks partial fixes across phases.
    blocking: yes — implementing any Phase A page without fixing the shell produces
      governance violations on every render; a single coordinated shell fix is needed
      before any page implementation begins
    owner: frontend team
    decision_needed_by: before step_1 of any Phase A implementation task

  - question: >
      The ?next= redirect path is currently sanitized client-side (must start with "/",
      must not be a loop path). Should server-side redirect validation be added for
      open-redirect protection, or is client-side sanitization sufficient given the
      cookie-based session model?
    blocking: no — current sanitization is functional; server-side validation is a
      security hardening enhancement
    owner: backend team / security
    decision_needed_by: informational
```

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections fully populated — no empty fields, no placeholders
- [x] Every layout zone has a documented existence justification
- [x] Every layout zone has explicit, testable acceptance criteria
- [x] Every component is mapped to an existing primitive
- [x] Every operational failure from Section 1.3 has a resolution in Section 12
- [x] Reduction audit: simplest form in Phase A (2 fields); left panel kept for redirect context value
- [x] No anti-patterns: no gradients in spec, no glow, no pulse, no UPPERCASE labels
- [x] All spacing follows 4px scale
- [x] All surfaces reference token variables — no hex
- [x] Typography follows approved system exactly
- [x] Backend API endpoints verified (POST /auth/v2/login in auth_secure.py confirmed)
- [x] Permission matrix complete (public workspace)
- [x] Open questions section populated (3 questions, 1 blocking)
- [x] AI elements: not applicable
- [x] Implementation handoff sequence complete and ordered

---

## POST-GENERATION SELF-VALIDATION

```yaml
self_validation:
  operational_integrity:
    - [x] Every zone traced to backend entity/API (sign-in panel → POST /auth/v2/login /
          Google OAuth / POST /email/verification/resend; left panel → AuthResponse role
          routing + redirectHint context)
    - [x] Every zone justified by operator need (form = daily sign-in action; left panel =
          redirect destination context for ?next= redirects)
    - [x] No zones for visual composition
    - [x] Removed elements documented: monospace/uppercase/tracking on all labels;
          gradient StatusRail; raw token alias references; missing autoFocus

  law_compliance:
    - [x] All spacing 4px scale (16px, 20px, 32px, 40px, 42px, 56px)
    - [x] All surfaces reference CSS tokens
    - [x] All labels sentence case — no uppercase anywhere in spec
    - [x] All fonts from approved type system (12px/500 labels, 14px/400 body, 14px/600
          provider label, 16px/600 title, 18px/600 page title)
    - [x] No AI elements

  kiro_readiness:
    - [x] 12-step implementation sequence in Section 13.1
    - [x] All acceptance criteria testable with specific behaviors
    - [x] 1 blocking open question flagged (AuthWorkstationShell coordinated fix)

  anti_pattern_check:
    - [x] No gradients in spec (gradient StatusRail violation documented and fixed)
    - [x] No glow effects
    - [x] No pulse on non-loading elements
    - [x] No UPPERCASE labels — every label explicitly sentence case
    - [x] No marketing typography — 18px ceiling on left title
    - [x] No invented workflows — all paths traced to actual auth_secure.py and role-navigation.ts
    - [x] No fake data or placeholder APIs
    - [x] No forbidden interactive patterns

  structural_integrity:
    - [x] Zone interactions cover all POST response states and query param states
    - [x] Permission matrix complete (public)
    - [x] Responsive collapse defined
    - [x] All problem resolutions reference specific spec sections
    - [x] Backend dual credential system (argon2 + bcrypt fallback) documented
    - [x] Post-login role routing via getHomeDestination() fully documented
```

What made /access structurally distinct from the prior four:

The most violations in a single workspace. The LoginOne component carries the highest concentration of typography governance failures in Phase A — almost every text element uses the forbidden font-mono + uppercase + tracking triple-violation pattern. The spec catalogs all 8 violation sites and maps each to specific acceptance criteria.

The blocking shell fix. The AuthWorkstationShell violations (clamp leftTitle, text-[2rem] h2, badge uppercase, gradient StatusRail) have now been flagged across 3 specs (forgot-password, verify-email, access). This spec promotes the fix to a blocking open question — no Phase A page implementation should begin until a single coordinated AuthWorkstationShell governance task is executed. This prevents five separate half-fixes across five pages.

Post-login role routing fully mapped. The spec documents the complete getHomeDestination() routing table so any Kiro implementation agent can verify the success path without reading the source. The ?next= sanitization logic, the redirect destination metric in the left panel, and the status message priority hierarchy (info > error > routeInfo) are all formally specified.

The MFA gap. The backend supports MFA (mfa_enabled, mfa_code in payload, TOTP verification) but the frontend has no MFA input. Users with MFA enabled receive a generic 401. This is documented as a formal open question rather than silently ignored.

---

## 14. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

---

### 14A. Desktop Structural Blueprint

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  TOPBAR                                                            height: 56px        │
│  [Building2] DPR.ai                               Steel industry · Factory OS          │
│  └─ sentence case / text-action-primary for platform                                  │
├───────────────────────────────┬────────────────────────────────────────────────────────┤
│  LEFT CONTEXT PANEL [P:4]     │  RIGHT SIGN-IN PANEL [P:1]                             │
│  width: 45%  / surface-panel  │  width: 55%  /  inner max-width: 480px  centered       │
│  padding: 40px                │  padding: 32px                                         │
│  · · · · · · · · · · · · · ·  │  · · · · · · · · · · · · · · · · · · · · · · · · · ·  │
│                               │                                                        │
│  [eyebrow]                    │  ┌──────────────────────────────────────────────────┐  │
│  Authentication lane          │  │  FORM PANEL INNER          surface-card          │  │
│  12px/500/tertiary            │  │  padding: 32px                                   │  │
│                               │  │  ┌────────────────────────────────────────────┐  │  │
│  [page title]                 │  │  │ PANEL HEADER                               │  │  │
│  System access                │  │  │ [chip] Secure access                       │  │  │
│  18px/600/sentence case       │  │  │        12px/500/sentence case              │  │  │
│                               │  │  │                                            │  │  │
│  [description]                │  │  │ [h2] Identify user   16px/600              │  │  │
│  14px/400/secondary           │  │  │                                            │  │  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │  │  │ [desc] Continue with Google or use        │  │  │
│                               │  │  │ work credentials.  14px/400/secondary      │  │  │
│  AUTH STEPS CARD              │  │  └────────────────────────────────────────────┘  │  │
│  surface-shell                │  │  ↕ 20px (--space-5)                              │  │
│  ┌─────────────────────────┐  │  │  ┌────────────────────────────────────────────┐  │  │
│  │ 01 Validate operator    │  │  │  │  GOOGLE PROVIDER BUTTON  min-h: 56px       │  │  │
│  │    identity             │  │  │  │  surface-shell / border-default            │  │  │
│  │ 02 Confirm access       │  │  │  │  [icon area]  "Continue with Google"       │  │  │
│  │    controls             │  │  │  │               14px/600/sentence case       │  │  │
│  │ 03 Resume factory       │  │  │  │               "Work account"               │  │  │
│  │    workflow             │  │  │  │               12px/500/sentence case       │  │  │
│  └─────────────────────────┘  │  │  │                               [→]          │  │  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │  │  └────────────────────────────────────────────┘  │  │
│                               │  │  ↕ 20px                                          │  │
│  REDIRECT METRIC              │  │  ┌────────────────────────────────────────────┐  │  │
│  (conditional: ?next= only)   │  │  │ DIVIDER                                    │  │  │
│  ┌─────────────────────────┐  │  │  │ ──── Or sign in with email ────            │  │  │
│  │ Requested destination   │  │  │  │       12px/500/sentence case               │  │  │
│  │ 12px/500/tertiary       │  │  └────────────────────────────────────────────┘  │  │
│  │ Open operations board   │  │  ↕ 20px                                          │  │
│  │ 14px/500/primary        │  │  ┌────────────────────────────────────────────┐  │  │
│  └─────────────────────────┘  │  │  CREDENTIAL FORM                           │  │  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │  │  ┌──────────────────────────────────────┐  │  │  │
│                               │  │  │ Label: Work email                    │  │  │  │
│  SECURITY POSTURE CARD        │  │  │        12px/500/sentence case/Inter  │  │  │  │
│  surface-panel                │  │  │ [Mail] [input h:40px] ← autoFocus    │  │  │  │
│  ┌─────────────────────────┐  │  │  └──────────────────────────────────────┘  │  │  │
│  │ [ShieldCheck]           │  │  │  ↕ 16px                                    │  │  │
│  │ Factory-safe flow       │  │  │  ┌──────────────────────────────────────┐  │  │  │
│  │ · Secure connection     │  │  │  │ [Label: Password]  [Forgot password?]│  │  │  │
│  │ · Role routing          │  │  │  │  12px/500/sentence case/Inter   ↑    │  │  │  │
│  │ · Verified inbox        │  │  │  │  12px/500/sentence case/action-primary│  │  │  │
│  └─────────────────────────┘  │  │  │ [KeyRound] [input h:40px]  [Show]    │  │  │  │
│                               │  │  │             autoComplete=current-pwd │  │  │  │
│                               │  │  └──────────────────────────────────────┘  │  │  │
│                               │  │  ↕ 16px                                    │  │  │
│                               │  │  ┌──────────────────────────────────────┐  │  │  │
│                               │  │  │  SUBMIT BUTTON  variant=primary      │  │  │  │
│                               │  │  │  [Sign in]  h-[42px]  full-width     │  │  │  │
│                               │  │  │  isBusy → [⟳ Signing in...]         │  │  │  │
│                               │  │  └──────────────────────────────────────┘  │  │  │
│                               │  │  ↕ (space-y-5 gap handles status placement)│  │  │
│                               │  │  ┌──────────────────────────────────────┐  │  │  │
│                               │  │  │  STATUS PANEL (conditional)          │  │  │  │
│                               │  │  │  tone: neutral / success / error     │  │  │  │
│                               │  │  │  [status message text] 14px/400      │  │  │  │
│                               │  │  │  [Resend verification] ← conditional │  │  │  │
│                               │  │  │  "Use the same signup inbox."        │  │  │  │
│                               │  │  │   12px/400/secondary/sentence case   │  │  │  │
│                               │  │  └──────────────────────────────────────┘  │  │  │
│                               │  │  ┌──────────────────────────────────────┐  │  │  │
│                               │  │  │  FOOTER      border-top-border-subtle│  │  │  │
│                               │  │  │  "Need provisioning?"                │  │  │  │
│                               │  │  │   12px/500/secondary/sentence case   │  │  │  │
│                               │  │  │                [Create account →]    │  │  │  │
│                               │  │  │                14px/600/action-primary│  │  │  │
│                               │  │  └──────────────────────────────────────┘  │  │  │
│                               │  └──────────────────────────────────────────────┘  │  │
└───────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

### 14B. Visual Attention Flow Map

```
SCAN LEVEL 1 (0–200ms): Email input (autoFocus) [normal] /
                         Status panel (color) [redirect/error]
────────────────────────────────────────────────────────────────
  NORMAL: autoFocus → cursor in email field → shift operator types immediately.
  No scan needed. The action starts before the page is consciously read.

  WITH STATUS: The semantic-tone status panel (green=success, red=error, grey=neutral)
  captures attention before the form. Operator reads context, then moves to email.

SCAN LEVEL 2 (200ms–800ms): Password field
────────────────────────────────────────────
  One Tab away from email. The label-row contains the "Forgot password?" link inline —
  visible during password focus. If operator realizes they don't know the password,
  the link is already in their visual field.

SCAN LEVEL 3 (800ms–2s): Submit button / Google provider button
────────────────────────────────────────────────────────────────
  Submit: Enter in password field triggers submit — operator may never visually
  scan the button. It is full-width and primary variant; impossible to miss if scanning.
  Google: Above the form; scanned by Google account holders on first visit.

SCAN LEVEL 4 (2s+): Footer / Left panel
─────────────────────────────────────────
  Footer for new users (Create account).
  Left panel for first-time users (workflow orientation).
  Neither is needed by the daily experienced operator.
```

#### Persistent Visibility Requirements

```
ALWAYS IN VIEW (never scrolls off on standard viewports):
  ├── Email input (autoFocus target — first scan destination)
  ├── Submit button (keyboard Enter completes sign-in without scrolling)
  └── Status panel (when non-null — must be visible before retry attempt)

CONTEXTUAL:
  ├── Status panel (only when surfaceStatus is non-null)
  ├── Resend verification button (only when canResendVerification=true)
  ├── Google loading spinner (only during OAuth initiation)
  └── Redirect metric in left panel (only when ?next= param present)
```

---

### 14C. Spacing & Rhythm Visualization

```
DENSE:
  - Credential form area (field gap 16px, label→input 8px) — tight grouping
    communicates "these are a single unit"
  - Label row (label + forgot-link inline) — zero gap between elements in row;
    both belong to the password field

BREATHABLE:
  - Google button area (20px gap above/below divider) — provider is a distinct
    affordance; visual separation communicates "this is a different path"
  - Panel outer padding (32px) — more comfortable than a pure-form layout;
    credential entry deserves calm, not urgency

VISUAL SILENCE:
  - Panel header → form body gap (20px) — pause before credential entry begins;
    operator has oriented to the workspace before touching the form
  - Status panel (when present) sits in the space-y-5 natural gap after submit —
    no additional margin needed; the form rhythm absorbs it
```

---

### 14D. Component Nesting Hierarchy

```
LoginPage (state management)
  └── LoginOne (presentation)
        └── AuthWorkstationShell
              ├── AuthTopbar (56px)
              │     ├── BrandLink (Building2 + "DPR.ai")
              │     └── MetaLabels (12px/500/sentence case)
              ├── LeftContextPanel (45% desktop, hidden mobile)
              │     ├── EyebrowLabel (12px/500/tertiary)
              │     ├── PageTitle (18px/600 — NOT clamp())
              │     ├── Description (14px/400)
              │     ├── AuthStepsCard (surface-shell) × 3 steps
              │     ├── RedirectMetric (conditional — ?next= only)
              │     │     ├── MetricLabel (12px/500/tertiary)
              │     │     └── MetricValue (14px/500/primary)
              │     └── SecurityPostureCard (surface-panel)
              │           └── SecurityBullets × 3
              └── RightSignInPanel (55% desktop)
                    └── FormPanelInner (surface-card, max-w-480px)
                          ├── PanelHeader
                          │     ├── BadgeChip (12px/500/sentence case)
                          │     ├── PanelTitle (16px/600 — NOT text-[2rem])
                          │     └── PanelDescription (14px/400)
                          ├── GoogleProviderButton (min-h:56px)
                          │     ├── IconContainer (surface-shell)
                          │     ├── ButtonLabel (14px/600/sentence case)
                          │     ├── ButtonSubLabel (12px/500/sentence case)
                          │     └── ArrowRight / Loader2 (conditional)
                          ├── ProviderDivider
                          │     └── DividerLabel (12px/500/sentence case/Inter UI)
                          ├── CredentialForm (HTML <form>)
                          │     ├── EmailFieldGroup
                          │     │     ├── Label "Work email" (12px/500/sentence case/Inter UI)
                          │     │     └── Input (type=email, autoFocus, Mail icon)
                          │     ├── PasswordFieldGroup
                          │     │     ├── LabelRow
                          │     │     │     ├── Label "Password" (12px/500/sentence case/Inter UI)
                          │     │     │     └── Link "Forgot password?" (12px/500/action-primary)
                          │     │     └── Input (type=password/text, KeyRound icon, ShowHide toggle)
                          │     └── Button variant="primary" isBusy (submit)
                          ├── StatusPanel (conditional — surface-shell/success/danger)
                          │     ├── StatusText (14px/400)
                          │     └── ResendRow (conditional — when canResendVerification)
                          │           ├── Button variant="outline" (resend, isBusy)
                          │           └── ResendHint (12px/400/sentence case)
                          └── Footer (border-top)
                                ├── FooterLabel (12px/500/sentence case/Inter UI)
                                └── Link "Create account →" (14px/600/action-primary)
```

---

### 14E. Responsive Collapse Blueprint

```
1440px+ (Full workstation):
┌──────────────────────────────────────────────────────────────────────────┐
│  TOPBAR                                                      height: 56px│
├──────────────────────────────────┬───────────────────────────────────────┤
│  LEFT PANEL (45%)                │  RIGHT SIGN-IN PANEL (55%)            │
│  padding: 40px                   │  inner: max-w-480px centered           │
│  Auth steps + Redirect metric    │  Google button + Divider + Form        │
│  (conditional) + Security card   │  + Status + Footer                    │
└──────────────────────────────────┴───────────────────────────────────────┘

1024px–1279px (Compact desktop):
┌──────────────────────────────────────────────────────────────────────────┐
│  TOPBAR                                                      height: 56px│
├──────────────────────────────────┬───────────────────────────────────────┤
│  LEFT PANEL (45%, padding 24px)  │  RIGHT PANEL (55%)                    │
│  (stays visible)                 │  max-w-480px unchanged                │
└──────────────────────────────────┴───────────────────────────────────────┘

<768px (Mobile):
┌──────────────────────────────────────────────────────────────────────────┐
│  TOPBAR                                                      height: 56px│
├──────────────────────────────────────────────────────────────────────────┤
│  RIGHT SIGN-IN PANEL (full width, centered)                             │
│  LEFT PANEL: HIDDEN (display: none)                                     │
│  · Email input: 44px height ·  Password input: 44px height ·           │
│  · Google button: 56px (unchanged) ·  Submit: 48px ·                   │
│  · Forgot password link: ≥44px touch target ·                           │
│  · Create account link: ≥44px touch target ·                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### 14F. Structural Consistency Validation

```yaml
structural_validation:
  - [x] All zones justified by operational necessity
        (Sign-in panel = daily authentication action; left panel = redirect context
        via metrics prop; topbar = navigation anchor)
  - [x] Visual dominance matches attention priority (right panel P:1 dominant)
  - [x] Spacing rhythm follows density specs (16px field gaps, 20px block gaps,
        32px panel padding — all 4px multiples)
  - [x] Responsive adaptations preserve all critical actions on mobile
        (Google OAuth + form both functional; all touch targets ≥44px)
  - [x] Component nesting hierarchy matches Section 11
  - [x] Minimum zone count — 3 zones (topbar, left, right)
  - [x] No redundant information surfaces
  - [x] Blueprint matches SPLIT AUTH LAYOUT from Section 4.1
```

---

## KIRO TASK CHAINING

```yaml
downstream_kiro_tasks:
  task_1:
    name: "Access — AuthWorkstationShell Governance Fix (shared with all Phase A pages)"
    input: This spec → Section 11 (shell violations list), Section 9.4 (StatusRail fix)
    output: Shell leftTitle at 18px, h2 at 16px, badge sentence case, metadata sentence case,
      StatusRail solid fill — applies to login, register, forgot-password, verify-email

  task_2:
    name: "Access — Label Typography Fix"
    input: This spec → Section 9.3, Section 4.2 acceptance criteria
    output: Both field labels at 12px/500/sentence case/Inter UI; all sub-labels and hints
      at sentence case — zero monospace, zero uppercase, zero tracking violations

  task_3:
    name: "Access — autoFocus + Link Token Fix"
    input: This spec → Section 7.2, Section 9.3
    output: Email input has autoFocus; all links use text-action-primary token class;
      forgot-password link and create-account link no longer reference raw aliases

  task_4:
    name: "Access — Divider + Footer + Provider Sub-label Fix"
    input: This spec → Section 4.2 (all acceptance criteria), Section 9.3
    output: Divider label "Or sign in with email" in sentence case Inter UI;
      footer "Need provisioning?" in sentence case Inter UI; Google sub-label sentence case

  task_5:
    name: "Access — Resend Hint + Focus Ring Fix"
    input: This spec → Section 4.2, Section 11
    output: Resend hint "Use the same signup inbox." in sentence case;
      Google button focus ring uses ring-action-primary

  task_6:
    name: "Access — Responsive & Touch Target Verification"
    input: This spec → Section 10
    output: Left panel hidden <1024px; all touch targets ≥44px; submit 48px on mobile
```

---

*End of WORKSPACE_SKELETON_ACCESS.md (Sections 1–14)*
*This file is system-generated architecture. Treat as engineering law until formally amended.*
*Architectural precedent established: role-based post-login routing (getHomeDestination)
documented as spec requirement; AuthWorkstationShell shell violations consolidated into
a single coordinated fix task affecting all Phase A pages; status message priority
hierarchy (info > error > routeInfo) documented for future auth pages;
MFA gap formally documented as an open product question*

---

### CODE

<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>System Access | FactoryNerve OS</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<style>
        body {
            font-family: 'Hanken Grotesk', sans-serif;
            background-color: #0b1326; /* surface-app */
            color: #dae2fd; /* on-surface */
            margin: 0;
            overflow: hidden;
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        /* Custom scrollbar for webkit */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #131b2e; }
        ::-webkit-scrollbar-thumb { background: #3c494e; }
    </style>
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                      "secondary": "#b7c8e1",
                      "on-tertiary-fixed": "#291800",
                      "error": "#ffb4ab",
                      "surface-container-highest": "#2d3449",
                      "on-background": "#dae2fd",
                      "surface-tint": "#4cd6ff",
                      "surface-container-lowest": "#060e20",
                      "secondary-container": "#3a4a5f",
                      "on-surface-variant": "#bbc9cf",
                      "surface-container": "#171f33",
                      "on-primary-fixed": "#001f28",
                      "background": "#0b1326",
                      "surface-variant": "#2d3449",
                      "on-tertiary": "#442b00",
                      "on-primary-container": "#00566a",
                      "primary-fixed-dim": "#4cd6ff",
                      "on-secondary-container": "#a9bad3",
                      "on-primary-fixed-variant": "#004e60",
                      "primary-fixed": "#b7eaff",
                      "primary-container": "#00d1ff",
                      "inverse-on-surface": "#283044",
                      "surface-dim": "#0b1326",
                      "tertiary": "#ffd59c",
                      "primary": "#a4e6ff",
                      "on-error": "#690005",
                      "surface": "#0b1326",
                      "tertiary-fixed": "#ffddb1",
                      "secondary-fixed-dim": "#b7c8e1",
                      "outline-variant": "#3c494e",
                      "inverse-primary": "#00677f",
                      "surface-bright": "#31394d",
                      "on-surface": "#dae2fd",
                      "on-primary": "#003543",
                      "surface-container-high": "#222a3d",
                      "tertiary-container": "#feb127",
                      "on-tertiary-container": "#6b4700",
                      "on-secondary-fixed": "#0b1c30",
                      "on-secondary": "#213145",
                      "outline": "#859399",
                      "on-error-container": "#ffdad6",
                      "error-container": "#93000a",
                      "on-secondary-fixed-variant": "#38485d",
                      "tertiary-fixed-dim": "#ffba49",
                      "surface-container-low": "#131b2e",
                      "inverse-surface": "#dae2fd",
                      "secondary-fixed": "#d3e4fe",
                      "on-tertiary-fixed-variant": "#624000"
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
                      "xl": "32px",
                      "md": "16px",
                      "margin": "24px",
                      "sm": "8px",
                      "gutter": "16px",
                      "base": "4px"
              },
              "fontFamily": {
                      "button": ["Hanken Grotesk"],
                      "body": ["Hanken Grotesk"],
                      "metadata": ["JetBrains Mono"],
                      "panel-title": ["Hanken Grotesk"],
                      "page-title": ["Hanken Grotesk"],
                      "label": ["JetBrains Mono"]
              },
              "fontSize": {
                      "button": ["14px", {"lineHeight": "14px", "letterSpacing": "0.02em", "fontWeight": "500"}],
                      "body": ["14px", {"lineHeight": "20px", "letterSpacing": "0em", "fontWeight": "400"}],
                      "metadata": ["11px", {"lineHeight": "14px", "letterSpacing": "0.04em", "fontWeight": "400"}],
                      "panel-title": ["16px", {"lineHeight": "20px", "letterSpacing": "0em", "fontWeight": "600"}],
                      "page-title": ["18px", {"lineHeight": "24px", "letterSpacing": "0em", "fontWeight": "600"}],
                      "label": ["12px", {"lineHeight": "16px", "letterSpacing": "0.02em", "fontWeight": "500"}]
              }
            },
          },
        }
    </script>
</head>
<body class="h-screen w-full flex overflow-hidden">
<!-- AuthWorkstationShell: Left Panel (Environmental context) -->
<aside class="hidden md:flex flex-col relative w-1/2 lg:w-2/5 h-full overflow-hidden bg-surface-container-lowest border-r border-outline-variant">
<!-- Background Texture -->
<div class="absolute inset-0 z-0 opacity-20 grayscale mix-blend-overlay">
<img alt="Industrial server room" class="object-cover w-full h-full" data-alt="A wide-angle, cinematic view of a dimly lit industrial server room filled with glowing blue and teal LED indicators. The architectural environment features heavy steel floor plates and racks of humming hardware receding into a soft-focus background. The atmosphere is quiet, professional, and technologically sophisticated, following a dark industrial aesthetic with deep shadows and sharp metallic textures. Soft ambient light glints off cable runs and steel surfaces." src="https://lh3.googleusercontent.com/aida-public/AB6AXuD6-WyHEFt6LmQeNmOtmHIa1VwcMNykIjJrbbaTfU2pjTwIBSElUITsKU7dfRZqAAEi4U9-uZxBY-RqofNFiExzMq2mKnk4ZUnEnHfdMenN43qHqCO6GCV1fKLv7xVUv5krv1LJkFMOpqnbAzuVQutpF0DbqaID50yBLVsDcm81RBbbJy8Of2EQnRiW_JsXjY-2KtPvN-Fk8A1Ds9RORTEUVQq4mnlYXxMsbvsP7AN106aP46EKlo1kFclUXb53LxBz6n7yzRX74l0"/>
</div>
<!-- Content Overlay -->
<div class="relative z-10 flex flex-col h-full p-xl justify-between">
<div class="flex flex-col gap-md">
<div class="flex items-center gap-sm">
<span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">terminal</span>
<span class="font-page-title text-page-title font-bold tracking-tight text-on-surface">FactoryNerve OS</span>
</div>
<div class="mt-xl">
<h1 class="font-page-title text-page-title text-primary mb-xs">System access</h1>
<p class="font-body text-body text-on-surface-variant max-w-sm">Sign in to open your factory workspace.</p>
</div>
<!-- Authentication Lane Flow -->
<div class="mt-xl flex flex-col gap-lg relative">
<!-- Step 1 -->
<div class="flex gap-md items-start group">
<div class="flex flex-col items-center">
<div class="w-6 h-6 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container">
<span class="material-symbols-outlined text-[16px]" style="font-variation-settings: 'FILL' 1;">check</span>
</div>
<div class="w-[2px] h-12 bg-outline-variant mt-xs"></div>
</div>
<div class="pt-xs">
<h3 class="font-panel-title text-panel-title text-on-surface">Validate operator identity</h3>
<p class="font-metadata text-metadata text-on-surface-variant">Credentials verification protocol</p>
</div>
</div>
<!-- Step 2 -->
<div class="flex gap-md items-start group">
<div class="flex flex-col items-center">
<div class="w-6 h-6 rounded-full border border-outline-variant flex items-center justify-center text-on-surface-variant">
<span class="material-symbols-outlined text-[16px]">lock_person</span>
</div>
<div class="w-[2px] h-12 bg-outline-variant mt-xs"></div>
</div>
<div class="pt-xs">
<h3 class="font-panel-title text-panel-title text-on-surface-variant">Confirm access controls</h3>
<p class="font-metadata text-metadata text-on-surface-variant">Permissions and role synchronization</p>
</div>
</div>
<!-- Step 3 -->
<div class="flex gap-md items-start group">
<div class="flex flex-col items-center">
<div class="w-6 h-6 rounded-full border border-outline-variant flex items-center justify-center text-on-surface-variant">
<span class="material-symbols-outlined text-[16px]">rocket_launch</span>
</div>
</div>
<div class="pt-xs">
<h3 class="font-panel-title text-panel-title text-on-surface-variant">Resume factory workflow</h3>
<p class="font-metadata text-metadata text-on-surface-variant">Handover to operational dashboard</p>
</div>
</div>
</div>
</div>
<div class="font-metadata text-metadata text-on-surface-variant/60">
                © 2024 FactoryNerve OS. Industrial Infrastructure Grade.
            </div>
</div>
</aside>
<!-- AuthWorkstationShell: Right Panel (Centered Login Form) -->
<main class="flex-1 flex items-center justify-center p-margin bg-surface relative overflow-y-auto">
<!-- Floating decorative element -->
<div class="absolute top-0 right-0 p-xl opacity-10 pointer-events-none">
<span class="material-symbols-outlined text-[120px] text-primary" style="font-variation-settings: 'wght' 100;">settings_input_component</span>
</div>
<!-- Identify User Card -->
<div class="w-full max-w-[480px] bg-surface-container-low border border-outline-variant p-xl shadow-2xl">
<div class="mb-lg">
<h2 class="font-page-title text-page-title text-on-surface mb-xs">Identify user</h2>
<p class="font-body text-body text-on-surface-variant">Access the secure operation environment.</p>
</div>
<!-- Provider Button -->
<button class="w-full flex items-center justify-between p-md bg-surface-container-highest hover:bg-surface-variant transition-colors border border-outline-variant mb-lg group">
<div class="flex items-center gap-md">
<svg class="w-5 h-5" viewbox="0 0 24 24">
<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 6.23l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
</svg>
<div class="text-left">
<div class="font-button text-button text-on-surface">Continue with Google</div>
<div class="text-[10px] text-on-surface-variant font-metadata leading-tight">Work account</div>
</div>
</div>
<span class="material-symbols-outlined text-on-surface-variant group-hover:translate-x-1 transition-transform">chevron_right</span>
</button>
<!-- Divider -->
<div class="relative flex items-center mb-lg">
<div class="flex-grow border-t border-outline-variant"></div>
<span class="flex-shrink mx-md font-body text-[13px] text-on-surface-variant">Or sign in with email</span>
<div class="flex-grow border-t border-outline-variant"></div>
</div>
<!-- Form -->
<form class="flex flex-col gap-lg" onsubmit="event.preventDefault();">
<!-- Status Panel (Initially Hidden) -->
<div class="hidden flex items-start gap-md p-md bg-secondary-container/20 border-l-4 border-secondary" id="status-panel">
<span class="material-symbols-outlined text-secondary text-[20px]">info</span>
<div class="flex-1">
<p class="font-body text-body text-secondary" id="status-message">Credential field focused.</p>
</div>
</div>
<!-- Work Email -->
<div class="flex flex-col gap-xs">
<label class="font-label text-label text-on-surface-variant" for="email">Work email</label>
<div class="relative">
<input autofocus="" class="w-full h-[40px] bg-surface-container border border-outline-variant text-on-surface px-md focus:border-primary focus:ring-0 transition-colors placeholder:text-outline/50" id="email" placeholder="operator@factorynerve.com" type="email"/>
</div>
</div>
<!-- Password -->
<div class="flex flex-col gap-xs">
<div class="flex justify-between items-center">
<label class="font-label text-label text-on-surface-variant" for="password">Password</label>
<a class="font-label text-label text-primary hover:underline" href="#">Forgot password?</a>
</div>
<div class="relative group">
<input class="w-full h-[40px] bg-surface-container border border-outline-variant text-on-surface px-md pr-xl focus:border-primary focus:ring-0 transition-colors" id="password" type="password"/>
<button class="absolute right-md top-1/2 -translate-y-1/2 font-label text-label text-on-surface-variant hover:text-on-surface transition-colors" id="toggle-password" type="button">
                            Show
                        </button>
</div>
</div>
<!-- Submit Button -->
<button class="h-[42px] bg-primary hover:bg-primary-container text-on-primary font-button text-button transition-all active:scale-[0.98] flex items-center justify-center gap-sm" type="submit">
                    Sign in
                    <span class="material-symbols-outlined text-[18px]">login</span>
</button>
</form>
<!-- Footer -->
<div class="mt-xl pt-lg border-t border-outline-variant flex justify-center items-center gap-sm">
<span class="font-body text-body text-on-surface-variant">Need provisioning?</span>
<a class="font-button text-button text-primary hover:underline" href="#">Create account</a>
</div>
</div>
<!-- Decorative UI elements for "Institutional" feel -->
<div class="fixed bottom-margin right-margin flex gap-md pointer-events-none">
<div class="flex flex-col items-end opacity-40">
<div class="font-metadata text-[10px] text-on-surface-variant">NODE_ALPHA_TERMINAL</div>
<div class="font-metadata text-[10px] text-on-surface-variant">ENC_AES_256</div>
</div>
<div class="w-[2px] h-full bg-outline-variant"></div>
</div>
</main>
<script>
        // Password visibility toggle
        const toggleBtn = document.getElementById('toggle-password');
        const passwordInput = document.getElementById('password');
        let isVisible = false;

        toggleBtn.addEventListener('click', () => {
            isVisible = !isVisible;
            passwordInput.type = isVisible ? 'text' : 'password';
            toggleBtn.textContent = isVisible ? 'Hide' : 'Show';
        });

        // Demo interaction: Status Panel updates
        const emailInput = document.getElementById('email');
        const statusPanel = document.getElementById('status-panel');
        const statusMessage = document.getElementById('status-message');

        emailInput.addEventListener('focus', () => {
            statusPanel.classList.remove('hidden');
            statusMessage.textContent = 'Enter your corporate credentials to synchronize workstation preferences.';
        });

        // Simulate form behavior
        document.querySelector('form').addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalContent = btn.innerHTML;
            btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Authenticating...';
            btn.disabled = true;
            btn.classList.add('opacity-80');
            
            setTimeout(() => {
                btn.innerHTML = originalContent;
                btn.disabled = false;
                btn.classList.remove('opacity-80');
                statusPanel.classList.remove('hidden');
                statusPanel.classList.replace('bg-secondary-container/20', 'bg-error-container/20');
                statusPanel.classList.replace('border-secondary', 'border-error');
                statusMessage.classList.replace('text-secondary', 'text-error');
                statusMessage.textContent = 'Authentication terminal busy. Please retry in 5 seconds.';
            }, 1500);
        });
    </script>
</body></html>


#### MOBILE PREVIEW

<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>FactoryNerve OS - System Access</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&amp;family=JetBrains+Mono:wght@400;500&amp;family=Inter:wght@400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<style>
        body {
            font-family: 'Hanken Grotesk', sans-serif;
            -webkit-font-smoothing: antialiased;
        }
        .font-inter {
            font-family: 'Inter', sans-serif;
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
    </style>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "secondary": "#b7c8e1",
                        "on-tertiary-fixed": "#291800",
                        "error": "#ffb4ab",
                        "surface-container-highest": "#2d3449",
                        "on-background": "#dae2fd",
                        "surface-tint": "#4cd6ff",
                        "surface-container-lowest": "#060e20",
                        "secondary-container": "#3a4a5f",
                        "on-surface-variant": "#bbc9cf",
                        "surface-container": "#171f33",
                        "on-primary-fixed": "#001f28",
                        "background": "#0b1326",
                        "surface-variant": "#2d3449",
                        "on-tertiary": "#442b00",
                        "on-primary-container": "#00566a",
                        "primary-fixed-dim": "#4cd6ff",
                        "on-secondary-container": "#a9bad3",
                        "on-primary-fixed-variant": "#004e60",
                        "primary-fixed": "#b7eaff",
                        "primary-container": "#00d1ff",
                        "inverse-on-surface": "#283044",
                        "surface-dim": "#0b1326",
                        "tertiary": "#ffd59c",
                        "primary": "#a4e6ff",
                        "on-error": "#690005",
                        "surface": "#0b1326",
                        "tertiary-fixed": "#ffddb1",
                        "secondary-fixed-dim": "#b7c8e1",
                        "outline-variant": "#3c494e",
                        "inverse-primary": "#00677f",
                        "surface-bright": "#31394d",
                        "on-surface": "#dae2fd",
                        "on-primary": "#003543",
                        "surface-container-high": "#222a3d",
                        "tertiary-container": "#feb127",
                        "on-tertiary-container": "#6b4700",
                        "on-secondary-fixed": "#0b1c30",
                        "on-secondary": "#213145",
                        "outline": "#859399",
                        "on-error-container": "#ffdad6",
                        "error-container": "#93000a",
                        "on-secondary-fixed-variant": "#38485d",
                        "tertiary-fixed-dim": "#ffba49",
                        "surface-container-low": "#131b2e",
                        "inverse-surface": "#dae2fd",
                        "secondary-fixed": "#d3e4fe",
                        "on-tertiary-fixed-variant": "#624000"
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
                        "xl": "32px",
                        "md": "16px",
                        "margin": "24px",
                        "sm": "8px",
                        "gutter": "16px",
                        "base": "4px"
                    },
                    "fontFamily": {
                        "button": ["Hanken Grotesk"],
                        "body": ["Hanken Grotesk"],
                        "metadata": ["JetBrains Mono"],
                        "panel-title": ["Hanken Grotesk"],
                        "page-title": ["Hanken Grotesk"],
                        "label": ["JetBrains Mono"]
                    },
                    "fontSize": {
                        "button": ["14px", {"lineHeight": "14px", "letterSpacing": "0.02em", "fontWeight": "500"}],
                        "body": ["14px", {"lineHeight": "20px", "letterSpacing": "0em", "fontWeight": "400"}],
                        "metadata": ["11px", {"lineHeight": "14px", "letterSpacing": "0.04em", "fontWeight": "400"}],
                        "panel-title": ["16px", {"lineHeight": "20px", "letterSpacing": "0em", "fontWeight": "600"}],
                        "page-title": ["18px", {"lineHeight": "24px", "letterSpacing": "0em", "fontWeight": "600"}],
                        "label": ["12px", {"lineHeight": "16px", "letterSpacing": "0.02em", "fontWeight": "500"}]
                    }
                },
            },
        }
    </script>
<style>
    body {
      min-height: max(884px, 100dvh);
    }
  </style>
  </head>
<body class="bg-background text-on-surface min-h-screen flex flex-col">
<!-- Header Section (Derived from TopNavBar Logic) -->
<header class="w-full h-[56px] px-margin flex items-center justify-between border-b border-outline-variant fixed top-0 bg-surface-container z-50">
<div class="flex items-center gap-sm">
<span class="material-symbols-outlined text-primary" data-icon="factory">factory</span>
<h1 class="font-page-title text-page-title font-bold text-primary tracking-tight">FactoryNerve OS</h1>
</div>
<div class="flex items-center gap-md">
<span class="material-symbols-outlined text-on-surface-variant cursor-pointer" data-icon="help">help</span>
</div>
</header>
<!-- Main Content Area -->
<main class="flex-grow pt-[56px] pb-[72px] flex flex-col items-center justify-center px-margin">
<div class="w-full max-w-sm">
<!-- System Branding / Context -->
<div class="mb-xl text-center">
<div class="inline-flex items-center gap-xs px-sm py-xs bg-surface-container-high border border-outline-variant rounded-lg mb-md">
<span class="material-symbols-outlined text-[14px] text-tertiary-fixed-dim" data-icon="shield">shield</span>
<span class="font-metadata text-metadata uppercase text-on-surface-variant">Secure Terminal Access</span>
</div>
<h2 class="font-page-title text-[24px] font-bold text-on-surface mb-xs">Identify user</h2>
<p class="font-body text-on-surface-variant">Enter credentials to initialize session Alpha-01.</p>
</div>
<!-- Access Card -->
<div class="bg-surface-container-low border border-outline-variant p-lg rounded-lg shadow-sm">
<!-- Google Auth -->
<button class="w-full h-[56px] flex items-center justify-center gap-md bg-white text-on-secondary-fixed rounded-lg font-inter font-medium text-[16px] transition-all active:scale-[0.98] mb-lg shadow-sm">
<svg height="20" viewbox="0 0 20 20" width="20">
<path d="M19.6 10.2c0-.7-.1-1.4-.2-2H10v3.8h5.4c-.2 1.2-1 2.2-2 2.9v2.4h3.2c1.9-1.7 3-4.3 3-7.1z" fill="#4285F4"></path>
<path d="M10 20c2.7 0 5-1 6.6-2.5l-3.2-2.4c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H1.2v2.6C2.8 17.8 6.1 20 10 20z" fill="#34A853"></path>
<path d="M4.4 12c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V5.4H1.2C.4 6.8 0 8.3 0 10s.4 3.2 1.2 4.6l3.2-2.6z" fill="#FBBC05"></path>
<path d="M10 3.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9C14.9 1 12.7 0 10 0 6.1 0 2.8 2.2 1.2 5.4l3.2 2.6c.8-2.3 3-4.1 10-4.1z" fill="#EA4335"></path>
</svg>
                    Continue with Google
                </button>
<!-- Divider -->
<div class="flex items-center gap-md mb-lg">
<div class="h-[1px] flex-grow bg-outline-variant"></div>
<span class="font-metadata text-metadata text-on-surface-variant uppercase whitespace-nowrap">Or sign in with email</span>
<div class="h-[1px] flex-grow bg-outline-variant"></div>
</div>
<!-- Credentials Form -->
<form class="space-y-lg" onsubmit="event.preventDefault();">
<div class="space-y-xs">
<label class="font-label text-label text-on-surface-variant px-xs" for="email">Workstation Email</label>
<input autofocus="" class="w-full h-[44px] bg-surface-container border border-outline-variant text-on-surface px-md rounded-lg font-inter focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all" id="email" placeholder="operator@factorynerve.os" type="email"/>
</div>
<div class="space-y-xs">
<div class="flex justify-between items-center px-xs">
<label class="font-label text-label text-on-surface-variant" for="password">System Password</label>
<a class="font-label text-label text-primary hover:underline" href="#">Forgot password?</a>
</div>
<div class="relative">
<input class="w-full h-[44px] bg-surface-container border border-outline-variant text-on-surface px-md pr-[80px] rounded-lg font-inter focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all" id="password" placeholder="••••••••" type="password"/>
<button class="absolute right-md top-1/2 -translate-y-1/2 font-label text-label text-on-surface-variant hover:text-on-surface" onclick="togglePassword()" type="button">Show</button>
</div>
</div>
<button class="w-full h-[48px] bg-primary text-on-primary font-button text-button rounded-lg font-bold shadow-md active:opacity-90 transition-opacity flex items-center justify-center gap-sm">
                        Sign in
                        <span class="material-symbols-outlined text-[18px]" data-icon="login">login</span>
</button>
</form>
</div>
<!-- Tertiary Action -->
<div class="mt-lg text-center">
<p class="font-body text-on-surface-variant">
                    Unauthorized workstation? 
                    <a class="text-primary font-medium hover:underline" href="#">Request Access</a>
</p>
</div>
</div>
</main>
<!-- Visual Element: Scanning Grid Overlay (Subtle) -->
<div class="fixed inset-0 pointer-events-none opacity-[0.03] z-[1]">
<div class="h-full w-full" style="background-image: linear-gradient(#859399 1px, transparent 1px), linear-gradient(90deg, #859399 1px, transparent 1px); background-size: 20px 20px;"></div>
</div>
<!-- Footer (Industrial Grade) -->
<footer class="w-full h-[72px] bg-surface-container-lowest border-t border-outline-variant flex flex-col justify-center items-center px-margin gap-xs z-50">
<p class="font-metadata text-metadata text-on-surface-variant text-center">© 2024 FactoryNerve OS. Industrial Infrastructure Grade.</p>
<div class="flex gap-lg">
<a class="font-metadata text-metadata text-on-surface-variant hover:text-primary transition-colors" href="#">ISO-27001</a>
<a class="font-metadata text-metadata text-on-surface-variant hover:text-primary transition-colors" href="#">Privacy Protocol</a>
</div>
</footer>
<script>
        function togglePassword() {
            const input = document.getElementById('password');
            const btn = event.target;
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = 'Hide';
            } else {
                input.type = 'password';
                btn.textContent = 'Show';
            }
        }
    </script>
</body></html>
```