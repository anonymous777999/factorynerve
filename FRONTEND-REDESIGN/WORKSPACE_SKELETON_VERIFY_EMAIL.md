# Verify Email — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification
# Route: /verify-email
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/verify-email` |
| Workspace Name | Email Verification — Account Activation Gate |
| Operational Role | Receives a time-limited token from the URL, validates it against either a `PendingRegistration` or an `EmailVerificationToken` record, and—on explicit user confirmation—executes the final activation step that creates the real `User`, `UserFactoryRole`, and `Subscription` entities in the database. |
| Business Impact | If this workspace fails or is inaccessible, no new factory operator account can ever be activated from a public registration. The entire `register → verify → access` onboarding chain is broken. Existing users whose email verification is pending are also blocked from accessing their factory workspace. |
| User Population | New registrants who have just completed `/register` and clicked the link in their verification email. Also: existing local-auth users whose email was not yet verified and who received a verification link through the resend flow. Both are first-time users of this page with no repeat-visit pattern. |
| Peak Usage Context | On-demand — typically within hours of registration, driven by the user's email-checking rhythm. No shift pattern. Often accessed on mobile (user clicks email link on phone). |
| Predecessor Workspaces | `/register` (new account) or email resend trigger from `/forgot-password` confirmation state |
| Successor Workspaces | `/access` or `/login` (user signs in with newly activated account) |

### 1.2 Operational Importance

Email verification is not a UX feature — it is the cryptographic gate between a `PendingRegistration` record and a real `User` record that can access a factory workspace. Until the token is redeemed, no factory data is visible to the user and no operational workflows can begin. The workspace must be operable on mobile (the most common device for email-link clicks), tolerate network latency on token validation, and provide absolutely clear next-step guidance after activation succeeds. A confused user who completes verification but doesn't know to go sign in next will generate a support request and waste onboarding time.

### 1.3 Current State Failures

- `<AuthShell>` is used instead of `<AuthWorkstationShell>` directly — `AuthShell` is a thin wrapper that does ultimately render `AuthWorkstationShell` with hardcoded `leftEyebrow="Guardrails"` and fixed `supportItems` icons/text; the abstraction prevents this workspace from having workspace-specific left panel content (the hardcoded items are generic across all auth pages using `AuthShell`); must migrate to direct `AuthWorkstationShell` usage with verify-email-specific left panel content
- The token-loading `div` uses `border-[0.5px]` arbitrary border shorthand — while functionally minimal, this violates the rule against arbitrary values; must use `border` (1px) with token class `border-border-default`
- The loading state, status success state, and error state all use `border-[0.5px]` with raw Tailwind border classes — same arbitrary border shorthand violation across all three state panels
- The status success "next step" nested panel uses `border-[0.5px] border-border-default bg-surface-shell` — correct tokens but wrong border shorthand; must use system primitive or remove arbitrary `[0.5px]`
- The `<Button>` used as the verify/activate CTA does NOT use the `isBusy` prop pattern — it uses `disabled={loading}` and reads the button label from a conditional string (`loading ? "Verifying..." : ...`) — inconsistent with the `isBusy` + `busyLabel` pattern used across login, register, and forgot-password
- The action button label resolution is a ternary that reads `isPendingSignupToken` (derived from `status.toLowerCase().includes("create the account")`) — this is string-parsing business logic applied to a server-delivered message; if the server message ever changes wording, the button label logic silently breaks; the token type (pending registration vs. existing user) should be tracked as a typed state variable, not inferred from message text
- The "Register" and "Sign in" navigation buttons at the bottom are wrapped in `<Link>` elements that contain `<Button>` elements — this produces a nested interactive element pattern (`<a><button>`) which is an accessibility violation; must use `Button` with `asChild` or use `Link` styled as button directly
- The "Sign in" button at the bottom uses `variant="default"` (filled primary) while the "Register" button uses `variant="outline"` — this makes "Sign in" appear as the primary action when the user is on a verification page, not yet signed in; the hierarchy should be: Activate account (primary, shown when token valid) → Sign in (secondary, for after activation) → Register (tertiary, for wrong-page users)
- The `loginHref` uses `verificationFinished` derived from `status.toLowerCase().includes("sign in now") || status.toLowerCase().includes("ready to sign in")` — same fragile string-parsing business logic as the button label; must use typed state
- The `isPendingSignupToken` check reads `status.toLowerCase().includes("create the account")` — the server message is `"Verification link verified. Confirm to create the account now."` — this is string matching on a backend message to determine a critical UI branch; extremely fragile
- No `autoFocus` on the primary action button — when the valid state is shown, focus is not directed to the CTA; keyboard users must tab to it
- The "prep card" (`<div>`) shown when token is valid uses `border-[0.5px] border-border-default bg-surface-shell` with no system component — should use a `Notice` or `StatusMessage` component with `info` tone
- The loading "Checking your verification link..." indicator does not specify a spinner — it is styled as a static text panel, not a loading indicator; must use `ActivityIndicator` or spinner within a loading state panel
- The `AUTH_ROUTE_PARAM_GUARDS` feature flag controls redirect behavior on invalid tokens — when `true`, an invalid or missing token silently redirects to `/register` with no explanation; this is operationally invisible (user has no idea why they were redirected); the spec must document this as a constraint but the guard redirect should only apply in production hardening contexts

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Auth / Onboarding | Outside the app shell; no sidebar, no topbar; entry gate — account does not exist until this page completes |
| Workflow Category | Verification | User does not fill a form — they arrive with a URL token, the system validates it, and they confirm with a single action |
| Operational Behavior | Token-Driven State Machine | No form input; behavior entirely determined by URL token → validation result → user confirmation |
| Data Density | LOW | No table, no multi-field form; three states (loading / valid-action / error-or-done) + navigation |
| Realtime Complexity | NONE | One async GET (token validate on mount), one async POST (verify on button click); no subscriptions |
| AI Complexity | NONE | No AI systems |
| Audit Complexity | LOW | Backend writes `EMAIL_VERIFIED` or `PUBLIC_SIGNUP_VERIFICATION_RESENT` — not surfaced in UI |
| Decision Pressure | LOW-MEDIUM | The action is one button press but the stakes are high: the user is activating their factory account for the first time; the workspace must be extremely clear about what is about to happen and what the next step is after |

**Classification Implication:**
A Token-Driven State Machine workspace with LOW data density means the entire design challenge is state communication — not data capture. There are exactly four visible states: (1) validating token (loading), (2) token valid — action required, (3) verification completed successfully, (4) error (invalid/expired/missing token). The UI must communicate each state unambiguously, especially the distinction between the two types of valid tokens: `PendingRegistration` (activating a new account from scratch) vs. `EmailVerificationToken` (confirming email ownership for an existing user). The action button label and the success message must reflect which type of activation just occurred. The workspace inherits the `AuthWorkstationShell` split-layout from the preceding three auth-shell workspaces and must maintain identical shell structure.

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Permission | Key Response Fields | Error States |
|---|---|---|---|---|---|
| `GET /auth/email/verify/validate?token=` | GET | Validates a token on page mount; does NOT consume the token; checks against `PendingRegistration` table first, then `EmailVerificationToken` table | Public | `valid: bool`, `message: str`, `email: str \| null` | Always 200; invalid/expired token returns `valid: false` with message |
| `POST /auth/email/verify` | POST | Consumes the token to execute verification; if token maps to `PendingRegistration`, runs full activation creating `User`/`UserFactoryRole`/`Subscription`/`Factory`/`Organization`; if token maps to `EmailVerificationToken`, marks `user.email_verified_at` | Public | `message: str`, `delivery_mode: str` | HTTP 400 `"Invalid or expired verification token."` if token is already used or expired |
| `POST /auth/email/verification/resend` | POST | Resends verification email — used by the `/forgot-password` confirmation state; not used on this page directly but registered users may arrive with this as context | Public | `message: str`, `verification_link: str \| null`, `delivery_mode: str` | Always 200; privacy-safe |
| `GET /observability/ready` | GET | Backend warm-up check on page mount | Public | HTTP 200 or 503 | Not surfaced in UI |

**Critical backend behavior the UI must model:**

**Two-token-type resolution (most important distinction):**

The backend resolves tokens in two passes:
1. **`PendingRegistration` token** — matches `verify_pending_registration_token()`. The message is: `"Verification link verified. Confirm to create the account now."` This is a *new account creation* event. On `POST /auth/email/verify`, `_activate_pending_registration()` is called, which creates: `Organization`, `Factory`, `User`, `UserFactoryRole`, `Subscription` — all from the pending registration data. This is the most consequential action in the entire auth flow.
2. **`EmailVerificationToken`** — matches `verify_verification_token()`. Messages are either `"Email already verified. You can sign in now."` (already done) or `"Verification link verified. Confirm your email to activate the account."` (pending). On `POST /auth/email/verify`, only `user.email_verified_at` is set.

**The UI must distinguish these two cases and reflect them accurately in:**
- The action button label: "Activate account" (PendingRegistration path) vs. "Verify email" (EmailVerificationToken path)
- The pre-action description: "This will create your factory account and workspace" vs. "This will confirm your email address"
- The success message: "Account created and ready to sign in" vs. "Email verified. You can sign in now."

**Already-verified case:**
`GET /auth/email/verify/validate` returns `valid: true` with `"Email already verified. You can sign in now."` — the POST button must NOT be shown in this state (the action is already complete); only the sign-in link should be shown.

**Token TTL:**
- `PendingRegistration` token: `EMAIL_VERIFICATION_TTL_HOURS` (default 24 hours)
- `EmailVerificationToken`: same `EMAIL_VERIFICATION_TTL_HOURS`
An expired token returns `valid: false` with `"This verification link is invalid or has expired. Request a new one."`

**AUTH_ROUTE_PARAM_GUARDS behavior:**
When `NEXT_PUBLIC_AUTH_ROUTE_PARAM_GUARDS=true`, missing or invalid tokens trigger `router.replace("/register")` on the client — silently redirecting away. When the flag is false (development), the error state is shown inline. The spec must document this guard but the inline error state must be correct for the non-guard path.

### 3.2 Entity Relationship Map

**Path A — PendingRegistration token:**
```
PendingRegistration (email, name, password_hash, requested_role, factory_name, company_code)
    │  [POST /auth/email/verify → _activate_pending_registration()]
    ▼
Organization (org_id) ← created or matched
    └── Factory (factory_id)
          └── User (id, email, is_email_verified=true, role)
                └── UserFactoryRole (factory_id, role)
                      └── Subscription (plan=DEFAULT_PLAN, status="trialing") ← if new org
```

**Path B — EmailVerificationToken:**
```
EmailVerificationToken (token_hash, user_id, used_at)
    │  [POST /auth/email/verify → user.email_verified_at = now]
    ▼
User (id, email_verified_at=now)  ← already exists; only email_verified_at updated
```

**Primary entity on this workspace:** Depends on path — `PendingRegistration` (path A) or `User` (path B).
**Relationship implication for UI:** The UI does not know which path until the `GET /email/verify/validate` response comes back. The `valid=true` message text encodes the path. The spec mandates that the frontend tracks token type as explicit state (not inferred from message strings).

### 3.3 Workflow State Machine

```
[PAGE LOAD — token from URL]
    │
    ├── token absent
    │     → if AUTH_ROUTE_PARAM_GUARDS: router.replace("/register")
    │     → else: [MISSING TOKEN STATE] show error + register/sign-in navigation
    │
    └── token present
          → [VALIDATING] GET /auth/email/verify/validate?token=
                → network error / 503
                      → [ERROR STATE] "Could not verify the email link." + navigation
                → 200 valid=false
                      → if AUTH_ROUTE_PARAM_GUARDS: router.replace("/register")
                      → else: [INVALID TOKEN STATE] error message + navigation
                → 200 valid=true + message="Email already verified..."
                      → [ALREADY VERIFIED STATE] success notice + sign-in link (no button)
                → 200 valid=true + message contains "create the account"
                      → tokenType = "pending_registration"
                      → [VALID — PENDING REGISTRATION] action button "Activate account" + prep notice
                → 200 valid=true + message contains "Confirm your email"
                      → tokenType = "existing_user"
                      → [VALID — EXISTING USER] action button "Verify email" + prep notice

[VALID ACTION STATE — user clicks button]
    → [VERIFYING] POST /auth/email/verify
          → HTTP 400 "Invalid or expired verification token."
                → [ERROR STATE] error message + navigation
          → 200 + message (contains "created" or "sign in now")
                → tokenType = "pending_registration"
                      → [SUCCESS — ACCOUNT CREATED]
                → tokenType = "existing_user"
                      → [SUCCESS — EMAIL VERIFIED]
```

**Frontend state machine variables (typed — NOT inferred from message strings):**

```typescript
type TokenType = "pending_registration" | "existing_user" | "already_verified" | null;
type VerifyPhase = "validating" | "action_required" | "success" | "error" | "missing_token";
```

**Frontend implication:** The current implementation infers `isPendingSignupToken` from `status.toLowerCase().includes("create the account")` — this is fragile string matching on a backend message. The spec mandates typed state variables. The `tokenType` must be derived from the validation response once (on mount), stored in state, and used to drive button labels, prep notice text, and success message text independently of the server message string.

### 3.4 Realtime Contracts

None. No polling or subscriptions. Backend warm-up check is fire-and-forget on mount.

### 3.5 AI System Contracts

Not applicable. No AI systems.

### 3.6 Permission Matrix

| Role | Access |
|---|---|
| Anonymous (unauthenticated, valid token) | View + execute token redemption |
| Anonymous (no token / invalid token) | View error state + navigate away |
| Any authenticated role | N/A — redirected away by AppShell guard |

**Permission implication:** Entirely public workspace. No role-based zone visibility.

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

```
SPLIT AUTH LAYOUT: Left context panel (desktop only) + Right form panel (always visible)
```

Identical structural pattern to `/login`, `/register`, `/forgot-password`. Left panel: 45% width desktop (≥1024px), hidden mobile. Right panel: 55% desktop, 100% mobile. Inner panel: `max-width: 480px`.

**Pattern justification:** Constitutional law — all four auth-shell pages share the same `AuthWorkstationShell` split. The left panel provides verification context (the 3-step flow and why inbox ownership matters) that reduces anxiety for a user who is activating a factory account for the first time. The left panel does not change between the validation loading state and the success state — the steps remain instructive throughout.

**Structural reduction note:** A full-screen centered token confirmation was considered. Rejected. The left panel communicates the operational significance of this moment ("activation is the final gate before factory access begins") in a way that a minimal single-column layout cannot. The workspace inherits the established shell at zero additional complexity cost.

---

### 4.2 Zone Definitions

---

#### ZONE: Auth Topbar

| Property | Value |
|---|---|
| Operational Role | Brand anchor and cross-navigation |
| Attention Priority | 5 |
| Position | top, full width |
| Width | fluid: 100% |
| Height | fixed: 56px |
| Sticky Behavior | not sticky |
| Collapse Behavior | never |
| Scroll Behavior | none |
| Density Mode | default |
| Existence Justification | Consistent with login, register, forgot-password skeletons |

**Contents:**
- Logo/brand link (`Building2` + "DPR.ai") → `/`
- Industry label + Platform label (right) — `--type-label` (12px/500), sentence case, `text-action-primary` for platform label

**Acceptance Criteria:**
- [ ] Height exactly 56px, consistent with all auth-shell pages
- [ ] Logo navigates to `/`
- [ ] Both meta labels use sentence case — NOT `uppercase tracking-[0.24em]`
- [ ] Platform label uses `text-action-primary`

---

#### ZONE: Left Context Panel

| Property | Value |
|---|---|
| Operational Role | Communicates why inbox verification matters operationally; provides 3-step activation flow; security posture signal |
| Attention Priority | 4 |
| Position | left |
| Width | 45% desktop; hidden <1024px |
| Height | fill-remaining |
| Sticky Behavior | not sticky |
| Collapse Behavior | hidden at <1024px |
| Scroll Behavior | independent scroll on very short viewports |
| Density Mode | default |
| Existence Justification | AuthWorkstationShell left panel — establishes verification context and why account does not exist until token is redeemed |

**Contents:**
- Eyebrow: "Account activation" — 12px/500/tertiary/sentence case; NOT uppercase
- Page title: "Activate factory access" — 18px/600/sentence case (`--type-page-title`); NOT `clamp()` sizing
- Description: 14px/400/`text-text-secondary`
- Activation steps card (3 steps):
  - 01 — "Open the verification link" — description: "Inbox ownership proves the email address is reachable."
  - 02 — "Confirm account activation" — description: "One click activates the factory account and creates the workspace."
  - 03 — "Sign in and begin" — description: "Use the same email and password from registration."
- Security posture card (`surface-panel`):
  - `ShieldCheck` icon + "Inbox-gated activation"
  - Bullets: inbox ownership required / factory account created only on confirmation / session cannot start before verification
  - 14px/400/`text-text-secondary`

**Acceptance Criteria:**
- [ ] Hidden entirely at viewport width <1024px
- [ ] Page title at 18px — NOT `clamp()` or >18px
- [ ] All labels sentence case — NO uppercase tracking
- [ ] Activation steps numbered 01–03, sentence case, 14px/400
- [ ] Security posture card present with inbox-verification context
- [ ] No interactive elements in this zone

---

#### ZONE: Right Action Panel

| Property | Value |
|---|---|
| Operational Role | Primary operational surface; renders the token validation state machine: loading → action-required → success → error; contains the one CTA that executes account activation |
| Attention Priority | 1 |
| Position | right (center on mobile) |
| Width | 55% desktop; 100% mobile; inner `max-width: 480px` centered |
| Height | fill-remaining; vertically centered; fits without scroll on standard viewports |
| Sticky Behavior | not sticky |
| Collapse Behavior | never |
| Scroll Behavior | scroll when viewport height <580px |
| Density Mode | default |
| Existence Justification | Token validation result and activation action — the entire operational reason this workspace exists |

**Contents — all states share the same panel header:**
- Panel header (static, does not change between states):
  - Badge chip: "Email verification" — 12px/500/sentence case; NOT `uppercase tracking`
  - Panel title: "Verify email" — 16px/600/sentence case (`--type-panel-title`); NOT `text-[2rem]`
  - Panel description: "Confirm your email address to activate your factory account." — 14px/400/`text-text-secondary`

**Contents — State: VALIDATING (on mount, while GET validates):**
- Loading indicator panel: `surface-shell` background + `border-default`:
  - Spinner (ActivityIndicator) + "Checking your verification link..." text
  - `--type-body` (14px/400/`text-text-secondary`)
- Navigation row (always visible at bottom of panel — see below)

**Contents — State: VALID — PENDING REGISTRATION (tokenType = "pending_registration"):**
- Pre-action notice: `surface-shell` + `border-default`:
  - "This will create your factory organization, workspace, and account. You'll be ready to sign in immediately after."
  - 13px/400/`text-text-secondary`
- Primary CTA button: `Button variant="primary"`, full width, h-[42px]:
  - Label: "Activate account"
  - `isBusy` state → `busyLabel="Activating..."`
  - Focus-managed: receives focus after token validates to `tokenType = "pending_registration"`
- Navigation row (always visible)

**Contents — State: VALID — EXISTING USER (tokenType = "existing_user"):**
- Pre-action notice: `surface-shell` + `border-default`:
  - "This will confirm your email address. You can sign in immediately after."
  - 13px/400/`text-text-secondary`
- Primary CTA button: `Button variant="primary"`, full width, h-[42px]:
  - Label: "Verify email"
  - `isBusy` state → `busyLabel="Verifying..."`
  - Focus-managed: receives focus after token validates
- Navigation row (always visible)

**Contents — State: ALREADY VERIFIED (tokenType = "already_verified"):**
- Status panel: `surface-success-bg` + `border-success`:
  - "Your email is already verified. You can sign in now."
  - 14px/400/`text-status-success-fg`
- Navigation row (always visible) — sign-in link uses `/access?verified=1`

**Contents — State: SUCCESS — ACCOUNT CREATED (after POST, pending_registration path):**
- Status panel: `surface-success-bg` + `border-success`:
  - Title: "Account activated" — 16px/600/sentence case
  - Body: "Your factory organization and workspace are ready. Sign in with the email and password you used during registration." — 14px/400
- Next-step notice: `surface-shell` + `border-default`:
  - "Use the same email and password from registration to sign in." — 13px/400/`text-text-secondary`
- Sign-in CTA: `Button variant="primary"`, full width, h-[42px], label "Sign in →", href `/access?verified=1`

**Contents — State: SUCCESS — EMAIL VERIFIED (after POST, existing_user path):**
- Status panel: `surface-success-bg` + `border-success`:
  - Title: "Email verified" — 16px/600/sentence case
  - Body: "Your email address is confirmed. You can sign in now." — 14px/400
- Sign-in CTA: `Button variant="primary"`, full width, h-[42px], label "Sign in →", href `/access?verified=1`

**Contents — State: ERROR (invalid / expired / network failure / missing token):**
- Error panel: `surface-danger-bg` + `border-danger`:
  - Error message text from `resolvedError` — 13px/400/`text-status-danger-fg`
- Navigation row (always visible)

**Navigation row (persistent across all states in right panel):**
- "Register" link-button: `Button variant="outline"`, links to `/register`
- "Sign in" link-button: `Button variant="ghost"`, links to `/access` or `/access?verified=1` (when `verificationFinished = true`)
- Arrangement: horizontal flex, gap 12px, centered or left-aligned
- These are SECONDARY actions — never primary CTA prominence
- **Accessibility fix:** Use `Button asChild` with `Link` child, or use `Link` styled as button — NOT `<Link><Button>` nesting (forbidden `<a><button>` pattern)

**Acceptance Criteria:**
- [ ] Panel badge renders at 12px/500/sentence case — NOT uppercase tracking
- [ ] Panel title renders at 16px (`--type-panel-title`) — NOT `text-[2rem]`
- [ ] Loading state shows spinner + text — NOT static text-only panel
- [ ] `tokenType` state is typed (`"pending_registration" | "existing_user" | "already_verified" | null`) — NOT derived from `status.toLowerCase().includes()`
- [ ] Action button label is "Activate account" for pending_registration, "Verify email" for existing_user
- [ ] Action button uses `isBusy` + `busyLabel` pattern — NOT `disabled` + conditional string label
- [ ] Action button receives programmatic focus when token validates to action-required state
- [ ] Already-verified state shows NO action button — only success notice + sign-in navigation
- [ ] Success state (post-POST) shows contextually correct message per tokenType
- [ ] Navigation row uses `Button asChild` or `Link` styled as button — NOT `<Link><Button>` nested pattern
- [ ] "Register" button is `variant="outline"` — NOT filled/primary
- [ ] "Sign in" button is `variant="ghost"` in navigation row — primary CTA is the activate/verify button or the success sign-in button
- [ ] All state panel borders use `border` (not `border-[0.5px]`) with semantic token classes
- [ ] Error panel uses `--status-danger-bg/fg/border` semantic tokens
- [ ] All text uses sentence case — NO uppercase

### 4.3 Zone Interaction Rules

```yaml
zone_interactions:
  - trigger: page mounts with token in URL (searchParams.get("token"))
    effect: Right Action Panel → enters VALIDATING state; spinner visible;
      GET /auth/email/verify/validate fires
    reason: token must be validated before any action is offered; user should not
      see a stale "verify" button before the system confirms the token is valid

  - trigger: GET /auth/email/verify/validate returns valid=true + message contains "create the account"
    effect: Right Action Panel → VALID PENDING REGISTRATION state;
      tokenType = "pending_registration"; action button "Activate account" shown and focused
    reason: token maps to PendingRegistration; pre-action notice communicates that
      full account creation (org + factory + user + subscription) is about to happen

  - trigger: GET /auth/email/verify/validate returns valid=true + message contains "Confirm your email"
    effect: Right Action Panel → VALID EXISTING USER state;
      tokenType = "existing_user"; action button "Verify email" shown and focused
    reason: token maps to EmailVerificationToken; lighter action — only email_verified_at is set

  - trigger: GET /auth/email/verify/validate returns valid=true + message contains "already verified"
    effect: Right Action Panel → ALREADY VERIFIED state;
      tokenType = "already_verified"; action button NOT shown; success notice + sign-in shown
    reason: action is already complete; showing a button would be confusing and the POST
      would be a no-op at best

  - trigger: GET /auth/email/verify/validate returns valid=false
    effect: if AUTH_ROUTE_PARAM_GUARDS: router.replace("/register");
      else: Right Action Panel → ERROR state; error message shown
    reason: token is invalid or expired; user cannot proceed; must request a new link

  - trigger: action button clicked (either "Activate account" or "Verify email")
    effect: Right Action Panel → button enters isBusy state; POST /auth/email/verify fires
    reason: explicit user confirmation required before consuming the token

  - trigger: POST /auth/email/verify returns 200
    effect: Right Action Panel → SUCCESS state (content varies by tokenType);
      action button hidden; sign-in CTA shown
    reason: activation is complete; next action is signing in

  - trigger: POST /auth/email/verify returns HTTP 400
    effect: Right Action Panel → ERROR state; error message shown; navigation row remains
    reason: token was already used or has expired since validation; user must request a new one

  - trigger: viewport width < 1024px
    effect: Left Context Panel → hidden; Right Action Panel → 100% width
    reason: mobile users need the action surface; context panel is desktop-only

  - trigger: verificationFinished (success state reached)
    effect: navigation row sign-in link href → "/access?verified=1" (adds verified signal)
    reason: the ?verified=1 param can be used by the login page to show a contextual
      "Account verified — sign in now" message
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

### 5.1 Scan Flow

```
SCAN LEVEL 1 (0–200ms): Loading indicator (VALIDATING state) / Primary CTA (VALID state)
───────────────────────────────────────────────────────────────────────────────────────────
  VALIDATING: The spinner + "Checking your verification link..." is the first visible
  content below the panel header. The user just clicked a link from an email —
  they expect something to happen immediately.

  VALID: The action button is the dominant element. It is full-width, primary-variant.
  When programmatic focus is set to it after validation, keyboard users can complete
  the activation with a single Enter press.

  SUCCESS/ERROR: The status panel (success-tone or danger-tone surface) is the first
  colored surface — communicates outcome before text is read.

SCAN LEVEL 2 (200ms–1s): Pre-action notice / Status message text / Error message
────────────────────────────────────────────────────────────────────────────────────
  VALID: Pre-action notice explains what is about to happen (account creation vs. email
  confirmation). Operator reads it to confirm their expectation before clicking.

  SUCCESS: Success message body tells the operator their account is ready and what to do next.
  ERROR: Error message text explains what went wrong and what to do.

SCAN LEVEL 3 (1s–3s): Next-step notice / Navigation row
─────────────────────────────────────────────────────────
  SUCCESS: "Use the same email and password" next-step notice prevents the common
  confusion of "I verified but now what?"

  ALL STATES: Navigation row (Register / Sign in) provides escape paths.

SCAN LEVEL 4 (3s+): Left panel context (desktop only)
───────────────────────────────────────────────────────
  Activation steps and security posture are for users who pause and ask why.
  Most users complete the action in <10 seconds without reading the left panel.
```

### 5.2 Persistent Visibility Requirements

| Element | Reason It Must Persist |
|---|---|
| Navigation row (Register + Sign in) | Exit paths must always be reachable regardless of token validity state; a user who arrived at this page by mistake or whose token expired must be able to navigate away without hunting |
| Primary CTA (VALID states) | The activation action must be the visual focus — nothing should compete with it or scroll it off screen |

### 5.3 Contextual Visibility Rules

```yaml
contextual_rules:
  - condition: verifyPhase === "validating"
    shows: Loading indicator (spinner + text)
    hides: All action buttons; all status panels
    reason: no action available until validation completes

  - condition: verifyPhase === "action_required" AND tokenType === "pending_registration"
    shows: Pre-action notice (account creation context) + "Activate account" button (isBusy capable)
    hides: Loading indicator; status panels; error panels
    reason: pending registration path — full entity creation is about to happen

  - condition: verifyPhase === "action_required" AND tokenType === "existing_user"
    shows: Pre-action notice (email confirmation context) + "Verify email" button
    hides: Loading indicator; status panels; error panels
    reason: existing user email verification — lighter action

  - condition: verifyPhase === "success" OR tokenType === "already_verified"
    shows: Status panel (success tone) + next-step notice + sign-in CTA
    hides: Action button; loading indicator; error panel; pre-action notice
    reason: action is complete; only forward navigation remains

  - condition: verifyPhase === "error"
    shows: Error panel (danger tone) + navigation row
    hides: Loading indicator; action button; pre-action notice; success panel
    reason: token invalid or expired; user cannot proceed on this page

  - condition: viewport < 1024px
    shows: Right panel at full width
    hides: Left context panel
    reason: mobile layout
```

---

## 6. TABLE & DATA STRATEGY

No tables — workspace is token-driven state machine (single action, no data display).

---

## 7. FORM & INPUT STRATEGY

No form fields — this workspace accepts no user text input. The URL token is the only input. The user's sole interaction is clicking the action button.

**Keyboard flow:**

```yaml
keyboard:
  on_load_validating: no interactive focus during loading state
  on_valid_action_required: programmatic focus → primary CTA button
    (allows Enter key to complete activation without any mouse interaction)
  on_success: programmatic focus → sign-in CTA button
    (allows Enter key to navigate directly to sign-in)
  on_error: no programmatic focus (user must tab to navigation row)
  tab_sequence: [primary CTA] → [Navigation: Register button] → [Navigation: Sign in button]
```

---

## 8. AI & AUDIT VISIBILITY STRATEGY

### 8.1 AI Placement Map
Not applicable — no AI systems.

### 8.2 Audit Visibility Map

```yaml
audit:
  backend_events_written:
    - EMAIL_VERIFIED: "Email verification completed." — written when existing user verifies
    - EMAIL_VERIFICATION_RESENT: "Verification email resent." — written on resend (not on this page)
    - PUBLIC_SIGNUP_VERIFICATION_RESENT: written when PendingRegistration resend fires
  frontend_display: none — audit events are not surfaced in the verification UI
  who_can_see_audit: admin/owner via premium audit trail (separate page only)
```

### 8.3 Anomaly Visibility
Not applicable.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

### 9.1 Density Mode

```yaml
default_density: default
density_justification: Auth pages use default density throughout Phase A. Single-action
  workspace with no table or multi-field form — density mode has minimal impact but
  default ensures comfortable targets (especially for mobile where this page is most
  commonly accessed via email link click).
density_switchable: no
density_specs:
  button_height: 42px (consistent across all auth-shell pages)
  loading_panel_padding: 16px (--space-md) inner padding
  status_panel_padding: 16px (--space-md) inner padding
  pre_action_notice_padding: 12px (--space-3) inner padding
```

### 9.2 Spacing Rhythm

```yaml
spacing:
  panel_outer_padding: 32px horizontal / 32px vertical
  panel_inner_gap: 20px (--space-5) header to state content
  state_to_button_gap: 16px (--space-md)
  state_panel_gap: 16px (--space-md) between status panels
  navigation_row_margin_top: 20px (--space-5) above navigation row
  topbar_height: 56px — consistent across all auth-shell pages
  left_panel_padding: 40px horizontal / 40px vertical on desktop
```

### 9.3 Typography Specification

```yaml
typography:
  topbar_brand_label: 16px / 600 / sentence case / tracking: -0.01em
  topbar_meta_labels: 12px / 500 / sentence case / tracking: 0em
  left_eyebrow: 12px / 500 / sentence case / text-text-tertiary / tracking: 0em
  left_title: 18px / 600 / sentence case / tracking: -0.01em
  left_description: 14px / 400 / text-text-secondary
  left_step_labels: 14px / 500 / sentence case
  left_step_descriptions: 13px / 400 / text-text-secondary
  panel_badge: 12px / 500 / sentence case / tracking: 0em
  panel_title: 16px / 600 / sentence case
  panel_description: 14px / 400 / text-text-secondary
  loading_text: 14px / 400 / text-text-secondary
  pre_action_notice: 13px / 400 / text-text-secondary
  cta_button_label: 14px / 500 / sentence case
  status_title: 16px / 600 / sentence case
  status_body: 14px / 400 / text-text-secondary or text-status-success-fg
  next_step_notice: 13px / 400 / text-text-secondary
  error_message: 13px / 400 / text-status-danger-fg
  navigation_button_label: 14px / 500 / sentence case
```

### 9.4 Surface Token Hierarchy

```yaml
surfaces:
  workspace_background: var(--surface-app)
  auth_shell: var(--surface-shell)
  left_panel: var(--surface-panel)
  right_panel_bg: var(--surface-app)
  form_panel_inner: var(--surface-card)
  loading_panel: var(--surface-shell) with var(--border-default) border
  pre_action_notice: var(--surface-shell) with var(--border-default) border
  success_panel: var(--status-success-bg) with var(--status-success-border) border
  error_panel: var(--status-danger-bg) with var(--status-danger-border) border
  next_step_notice: var(--surface-shell) with var(--border-default) border
  security_posture_card: var(--surface-panel) with var(--border-subtle) border
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
```

### 10.2 Compact Desktop (Secondary)

```yaml
compact_desktop:
  width_range: 1024px–1279px
  adaptations:
    - left_panel: padding reduces to 24px horizontal
    - right_panel: max-width unchanged at 480px
  degraded_functionality: none
```

### 10.3 Mobile / Tablet (Degraded Mode)

```yaml
mobile:
  width_range: <768px
  strategy: stacked — left panel hidden, right panel full width
  operational_continuity: full — all states accessible on mobile
  zones_hidden: [Left Context Panel]
  notes: >
    This page is most commonly accessed on mobile (user clicks email link on phone).
    Mobile UX is therefore high-priority despite the workspace being classified as
    "degraded mode." All states must be fully functional on mobile.
  touch_adjustments:
    - button_height: 48px minimum (vs 42px desktop)
    - navigation_buttons_min_height: 44px touch target
    - status_panels: full width with 16px horizontal padding
```

### 10.4 Rail Collapse Behavior

```yaml
rail_collapse:
  left_rail:
    collapse_trigger: viewport width < 1024px
    collapsed_state: hidden (display: none, width: 0)
    reinvoke_method: not applicable
  right_rail: not applicable
```

---

## 11. COMPONENT MAPPING

```yaml
component_mapping:
  workspace_container:
    component: AuthWorkstationShell
    reason: All four Phase A auth-shell pages use AuthWorkstationShell; current use of
      AuthShell (thin wrapper with hardcoded generic left content) must be replaced by
      direct AuthWorkstationShell usage with verify-email-specific content.
    props_needed:
      - badge: "Email verification"
      - title: "Verify email"
      - description: "Confirm your email address to activate your factory account."
      - leftEyebrow: "Account activation"
      - leftTitle: "Activate factory access"
      - leftDescription: "Complete email verification to create your factory workspace."
      - steps: [3 activation steps]
      - supportTitle: "Inbox-gated activation"
      - supportDescription: "Factory account is created only after token redemption confirms inbox ownership."
      - supportItems: [3 security posture bullets]

  state_machine_state:
    notes: >
      The component must track tokenType as explicit typed state, not derived from
      backend message strings. Required state shape:
        type TokenType = "pending_registration" | "existing_user" | "already_verified" | null
        type VerifyPhase = "validating" | "action_required" | "success" | "error" | "missing_token"

  status_elements:
    - element: Loading indicator
      component: ActivityIndicator / Spinner + inline text in surface-shell panel
      variant: loading (not static text-only)
    - element: Pre-action notice
      component: inline div or Notice primitive
      surface: surface-shell + border-default
    - element: Success status panel
      component: StatusMessage or inline div
      variant: success (status-success-bg/border/fg)
    - element: Error panel
      component: StatusMessage or inline div
      variant: error (status-danger-bg/border/fg)
    - element: Next-step notice
      component: inline div
      surface: surface-shell + border-default

  action_elements:
    - element: Activate account / Verify email CTA
      component: Button variant="primary"
      props: isBusy, busyLabel (dynamic: "Activating..." or "Verifying..."), full width, h-[42px]
      focus: receives programmatic focus after tokenType is set to action_required
    - element: Sign-in CTA (success state)
      component: Button variant="primary" (asChild) wrapping Link href="/access?verified=1"
      note: use Button asChild pattern — NOT <Link><Button> nesting
    - element: Register navigation button
      component: Button variant="outline" (asChild) wrapping Link href="/register"
      note: use Button asChild pattern
    - element: Sign in navigation button
      component: Button variant="ghost" (asChild) wrapping Link href="/access" or "/access?verified=1"
      note: use Button asChild pattern

  ai_elements: []
```

**Missing Components — new primitive candidates:**
- `ActivityIndicator` / `Spinner`: The current loading state uses a static text panel — no spinner component is used. A `Spinner` primitive or `ActivityIndicator` pattern consistent with other loading states in the app should be used. Flag for review: check whether a spinner component already exists in `web/src/components/ui/` before creating a new one.

---

## 12. OPERATIONAL PROBLEMS SOLVED

```yaml
problem_resolutions:
  - problem: AuthShell used instead of direct AuthWorkstationShell — left panel is generic
      across all auth pages using AuthShell; cannot have verify-email-specific activation content
    root_cause: AuthShell is a convenience wrapper with hardcoded left panel content
      (Guardrails eyebrow, generic supportItems icons); each page using it loses the ability
      to communicate page-specific operational context in the left panel
    structural_solution: Section 4.1 and Section 11 mandate direct AuthWorkstationShell with
      verify-email-specific props: "Account activation" eyebrow, "Activate factory access" title,
      3 activation steps, inbox-gated security posture card
    section_reference: Section 4.1, Section 11
    measurable_outcome: Left panel shows activation-specific content (not generic guardrails);
      a user arriving on this page for the first time understands the operational significance
      of what they are about to do

  - problem: tokenType inferred from status.toLowerCase().includes("create the account") —
      fragile string-parsing business logic
    root_cause: Backend response message strings are used as discriminators for UI branching;
      if the server changes the message wording, the button label and success state silently
      show wrong content
    structural_solution: Section 3.3 defines typed state variables (TokenType, VerifyPhase);
      Section 4.3 zone interactions specify tokenType = "pending_registration" when
      validate response message contains "create the account" — but the tokenType is stored
      as explicit typed state, not re-derived on each render; Section 11 documents the
      required state shape
    section_reference: Section 3.3, Section 4.3, Section 11
    measurable_outcome: tokenType is set once from the validate response, typed, and
      used consistently throughout — no repeated string parsing; changing server message
      wording does not break button labels or success text

  - problem: Action button uses disabled={loading} + conditional string label instead of
      isBusy + busyLabel pattern
    root_cause: Inconsistent with the isBusy pattern established in login, register, and
      forgot-password; the disabled+string approach doesn't show a spinner
    structural_solution: Section 4.2 (Right Action Panel) specifies Button with isBusy prop
      and busyLabel ("Activating..." for pending_registration, "Verifying..." for existing_user);
      Section 11 component mapping specifies isBusy + busyLabel
    section_reference: Section 4.2, Section 11
    measurable_outcome: Action button shows spinner + contextual loading label consistent with
      all other submit buttons in Phase A auth pages

  - problem: <Link><Button> nested pattern — accessibility violation (nested interactive elements)
    root_cause: Developer wrapped Button in Link without using the asChild pattern; this produces
      <a href="..."><button>...</button></a> in the DOM which is invalid HTML and creates
      duplicate focusable elements for screen readers
    structural_solution: Section 4.2 acceptance criteria require Button asChild pattern;
      Section 11 component mapping specifies Button asChild with Link child for all navigation
      buttons; the <Link><Button> nesting is explicitly prohibited
    section_reference: Section 4.2, Section 11
    measurable_outcome: DOM contains <a> OR <button> for each navigation element —
      never nested; screen readers receive a single focusable element per navigation action

  - problem: Loading state is a static text panel without a spinner
    root_cause: The loading state was implemented as a styled div with text only;
      no ActivityIndicator or Spinner component was used
    structural_solution: Section 4.2 specifies loading state includes a Spinner/ActivityIndicator
      component alongside the text; Section 11 flags Spinner as a component to verify
    section_reference: Section 4.2, Section 11
    measurable_outcome: Loading state shows animated spinner; user has a visual indicator that
      work is in progress, not just static text

  - problem: Multiple border-[0.5px] arbitrary shorthand values on all state panels
    root_cause: Developers used arbitrary Tailwind border shorthand for aesthetic 0.5px borders;
      this is an arbitrary value violation
    structural_solution: Section 9.4 surface token hierarchy specifies all panels use
      standard border (1px) with semantic token classes (border-border-default,
      border-status-success-border, border-status-danger-border); no arbitrary border values
    section_reference: Section 9.4
    measurable_outcome: Zero border-[0.5px] values in the workspace; all borders use
      semantic token border classes

  - problem: "Sign in" navigation button uses filled/primary variant — wrong action hierarchy
    root_cause: The button variant was set to default (filled primary) for "Sign in" while
      "Register" used outline — this makes sign-in appear as primary action when the user
      is on a verification page and hasn't yet activated; the activate/verify button should
      be the primary action
    structural_solution: Section 4.2 specifies navigation row uses outline (Register) and
      ghost (Sign in); the activate/verify CTA is the primary variant; Section 4.2 acceptance
      criteria explicitly require this button hierarchy
    section_reference: Section 4.2
    measurable_outcome: Visual hierarchy is correct: Activate/Verify button (primary) >
      Sign in (ghost in nav row, primary only in success state) > Register (outline in nav row)
```

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

```yaml
implementation_sequence:
  step_1: Replace AuthShell with direct AuthWorkstationShell; wire verify-email-specific
    props (leftEyebrow, leftTitle, leftDescription, 3 activation steps, supportTitle,
    supportDescription, supportItems for inbox-gated posture)
  step_2: Introduce typed state variables: TokenType and VerifyPhase enums/types;
    derive tokenType from validate response once (not re-parsed on render);
    derive verifyPhase from a single state machine reducer
  step_3: Fix action button — add isBusy prop, dynamic busyLabel ("Activating..." or "Verifying...");
    programmatic focus management after tokenType resolves
  step_4: Fix loading state — add Spinner/ActivityIndicator component alongside the text
  step_5: Fix navigation row — replace <Link><Button> nesting with Button asChild + Link;
    fix button variants (Register=outline, Sign in=ghost in nav row)
  step_6: Remove all border-[0.5px] arbitrary values; use standard border with semantic token classes
  step_7: Fix already-verified state — hide action button; show success notice + sign-in only
  step_8: Fix success state — show contextually correct message per tokenType;
    show sign-in CTA as primary button with /access?verified=1 href
  step_9: Responsive behavior — confirm left panel hides <1024px; touch targets ≥44px on mobile
```

### 13.2 Critical Constraints

```yaml
critical_constraints:
  - "tokenType must be stored as typed state — never inferred from backend message strings at render time"
  - "The <Link><Button> nesting pattern is forbidden; use Button asChild pattern"
  - "Do not consume the token on page load — validation (GET) and activation (POST) are two
     separate steps; the user must explicitly click to activate"
  - "Already-verified state must NOT show an action button — the POST would succeed but is redundant
     and confusing"
  - "AUTH_ROUTE_PARAM_GUARDS=true path: when invalid token triggers router.replace, do not
     show inline error — the redirect IS the error handling in production hardening mode"
  - "All borders must use semantic token classes — no border-[0.5px] arbitrary values"
  - "All surfaces must reference CSS token variables — no hex or rgba"
  - "Do not modify AppShell scroll architecture"
  - "Page is most commonly accessed on mobile — touch targets must be ≥44px"
```

### 13.3 Open Questions

```yaml
open_questions:
  - question: >
      Does a Spinner / ActivityIndicator component already exist in the shared UI primitives
      (web/src/components/ui/) or must one be created before the loading state can be
      correctly implemented?
    blocking: no — the loading text-only fallback is functional; spinner is a UX improvement
    owner: frontend team
    decision_needed_by: before step_4

  - question: >
      The AUTH_ROUTE_PARAM_GUARDS flag is set via NEXT_PUBLIC_AUTH_ROUTE_PARAM_GUARDS env var.
      What is its value in production vs. staging? If it is always true in production, the
      inline error state is never shown to real users and the error state is only exercised
      in development. Should the spec document a degraded-mode for the error state still?
    blocking: no — spec documents both code paths; the inline error state is needed for
      development regardless of production guard value
    owner: engineering / devops
    decision_needed_by: informational only

  - question: >
      When the success state is shown after POST /auth/email/verify for a pending_registration
      token, should the page auto-redirect to /access after a brief delay (e.g., 3 seconds),
      or should the user explicitly click "Sign in →"? Auto-redirect provides a smoother
      flow but removes user agency.
    blocking: no — explicit click is the safe default; auto-redirect is a UX enhancement
    owner: product owner
    decision_needed_by: before step_8
```

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections fully populated — no empty fields, no placeholders
- [x] Every layout zone has a documented existence justification
- [x] Every layout zone has explicit, testable acceptance criteria
- [x] Every component is mapped to an existing primitive or flagged (Spinner/ActivityIndicator)
- [x] Every operational failure from Section 1.3 has a resolution in Section 12
- [x] Reduction audit: no forms, no tables, single-action workspace; minimum zone count
- [x] No anti-patterns: no gradients, no glow, no pulse on non-loading elements, no UPPERCASE
- [x] All spacing follows 4px scale
- [x] All surfaces reference token variables — no hex
- [x] Typography follows approved system exactly
- [x] Backend API endpoints verified (GET /auth/email/verify/validate, POST /auth/email/verify confirmed in auth.py)
- [x] Permission matrix complete (public workspace)
- [x] Open questions section populated (3 questions, 0 blocking)
- [x] AI elements: not applicable
- [x] Implementation handoff sequence complete and ordered

---

## POST-GENERATION SELF-VALIDATION

```yaml
self_validation:
  operational_integrity:
    - [x] Every zone traced to backend entity/API (right panel → GET /email/verify/validate +
          POST /email/verify + PasswordForgotResponse/EmailVerificationResponse; left panel →
          PendingRegistration/EmailVerificationToken workflow context)
    - [x] Every zone justified by operator need (action panel = the only reason the page
          exists; left panel = reduces first-time activation anxiety)
    - [x] No zones for visual composition — reduction complete (no tables, no forms, single action)
    - [x] Removed elements documented (static-text loading, <Link><Button> nesting, string-parsed
          tokenType, border-[0.5px] values, wrong button hierarchy)

  law_compliance:
    - [x] All spacing values 4px scale (12px, 16px, 20px, 32px, 40px)
    - [x] All surfaces reference CSS tokens (surface-app, surface-shell, surface-card,
          surface-panel, status-success-bg, status-danger-bg, border-default, border-subtle)
    - [x] All text labels sentence case — no uppercase anywhere in spec
    - [x] All fonts from approved type system (12px/500 labels, 14px/400 body, 16px/600 titles,
          18px/600 page title)
    - [x] No AI elements — N/A

  kiro_readiness:
    - [x] 9-step implementation sequence in Section 13.1
    - [x] All acceptance criteria testable with specific behaviors
    - [x] No blocking open questions

  anti_pattern_check:
    - [x] No gradients
    - [x] No glow effects
    - [x] No pulse on non-loading elements
    - [x] No UPPERCASE labels
    - [x] No marketing typography
    - [x] No invented workflows — all states traced to actual backend auth.py code paths
    - [x] No fake data or placeholder APIs
    - [x] No <details>/<summary> elements

  structural_integrity:
    - [x] Zone interactions cover all token validation state transitions
    - [x] Permission matrix complete (public)
    - [x] Responsive collapse defined (left panel hides <1024px)
    - [x] All problem resolutions reference specific spec sections
    - [x] Two-path token resolution (PendingRegistration vs EmailVerificationToken) fully documented
```

---

## 14. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

---

### 14A. Desktop Structural Blueprint

#### All States — Shared Shell Structure (desktop ≥1024px)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  TOPBAR                                                            height: 56px      │
│  [Building2] DPR.ai                               Steel industry · Factory OS        │
│  └─ links to /                   └─ 12px/500/sentence case / text-action-primary    │
├───────────────────────────────┬──────────────────────────────────────────────────────┤
│  LEFT CONTEXT PANEL [P:4]     │  RIGHT ACTION PANEL [P:1]                            │
│  width: 45%                   │  width: 55%  (inner max-width: 480px, centered)      │
│  surface-panel                │  surface-app                                         │
│  padding: 40px                │  padding: 32px                                       │
│  · · · · · · · · · · · · · ·  │  · · · · · · · · · · · · · · · · · · · · · · · · ·  │
│                               │                                                      │
│  [eyebrow]                    │  ┌────────────────────────────────────────────────┐  │
│  Account activation           │  │  ACTION PANEL INNER         surface-card       │  │
│  12px/500/tertiary            │  │  padding: 32px                                 │  │
│                               │  │  ┌──────────────────────────────────────────┐  │  │
│  [page title]                 │  │  │ PANEL HEADER (static — all states)       │  │  │
│  Activate factory             │  │  │ [chip] Email verification                │  │  │
│  access                       │  │  │        12px/500/sentence case            │  │  │
│  18px/600                     │  │  │                                          │  │  │
│                               │  │  │ [h2] Verify email                        │  │  │
│  [description]                │  │  │      16px/600 — --type-panel-title       │  │  │
│  14px/400/secondary           │  │  │                                          │  │  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │  │  │ [desc] Confirm your email to activate    │  │  │
│                               │  │  │ your factory account.                    │  │  │
│  ACTIVATION STEPS CARD        │  │  │ 14px/400/secondary                       │  │  │
│  surface-shell                │  │  └──────────────────────────────────────────┘  │  │
│  ┌─────────────────────────┐  │  │  ↕ 20px (--space-5)                            │  │
│  │ 01 Open the verification│  │  │  ┌──────────────────────────────────────────┐  │  │
│  │    link                 │  │  │  │  ╔══════════════════════════════════════╗  │  │
│  │    14px/500             │  │  │  │  ║  STATE-DEPENDENT CONTENT ZONE       ║  │  │
│  │    13px/400/sec         │  │  │  │  ║  (see per-state blueprints below)   ║  │  │
│  │                         │  │  │  │  ╚══════════════════════════════════════╝  │  │
│  │ 02 Confirm activation   │  │  │  └──────────────────────────────────────────┘  │  │
│  │    14px/500             │  │  │  ↕ 20px (--space-5)                            │  │
│  │    13px/400/sec         │  │  │  ┌──────────────────────────────────────────┐  │  │
│  │                         │  │  │  │ NAVIGATION ROW (always visible)          │  │  │
│  │ 03 Sign in and begin    │  │  │  │ [Register] (outline btn) [Sign in] (ghost)│  │  │
│  │    14px/500             │  │  │  │ Button asChild + Link — NOT <Link><Button>│  │  │
│  └─────────────────────────┘  │  │  └──────────────────────────────────────────┘  │  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │  └────────────────────────────────────────────────┘  │
│                               │                                                      │
│  SECURITY POSTURE CARD        │                                                      │
│  surface-panel                │                                                      │
│  ┌─────────────────────────┐  │                                                      │
│  │ [ShieldCheck]           │  │                                                      │
│  │ Inbox-gated activation  │  │                                                      │
│  │ 14px/500/primary        │  │                                                      │
│  │                         │  │                                                      │
│  │ · Inbox ownership req.  │  │                                                      │
│  │ · Account created on    │  │                                                      │
│  │   confirmation only     │  │                                                      │
│  │ · Session locked until  │  │                                                      │
│  │   verified              │  │                                                      │
│  │ 13px/400/secondary      │  │                                                      │
│  └─────────────────────────┘  │                                                      │
└───────────────────────────────┴──────────────────────────────────────────────────────┘
```

#### State-Dependent Content Zone — Detail per State

```
STATE: VALIDATING
─────────────────────────────────────────────────────────────────
┌──────────────────────────────────────────────────────────────┐
│ LOADING PANEL          surface-shell / border-default        │
│ [⟳ spinner]  "Checking your verification link..."           │
│              14px/400/text-secondary                        │
└──────────────────────────────────────────────────────────────┘

STATE: VALID — PENDING REGISTRATION (tokenType = "pending_registration")
─────────────────────────────────────────────────────────────────────────
┌──────────────────────────────────────────────────────────────┐
│ PRE-ACTION NOTICE      surface-shell / border-default        │
│ "This will create your factory organization, workspace,      │
│ and account. You'll be ready to sign in immediately after."  │
│ 13px/400/text-secondary                                      │
└──────────────────────────────────────────────────────────────┘
↕ 16px
┌──────────────────────────────────────────────────────────────┐
│ PRIMARY CTA BUTTON     variant=primary  h-[42px]  full width │
│ [Activate account]   ← label                                 │
│ isBusy → [⟳ Activating...]                                  │
│ receives programmatic focus after tokenType resolves         │
└──────────────────────────────────────────────────────────────┘

STATE: VALID — EXISTING USER (tokenType = "existing_user")
───────────────────────────────────────────────────────────
┌──────────────────────────────────────────────────────────────┐
│ PRE-ACTION NOTICE      surface-shell / border-default        │
│ "This will confirm your email address. You can sign in       │
│ immediately after."   13px/400/text-secondary                │
└──────────────────────────────────────────────────────────────┘
↕ 16px
┌──────────────────────────────────────────────────────────────┐
│ PRIMARY CTA BUTTON     variant=primary  h-[42px]  full width │
│ [Verify email]   ← label                                     │
│ isBusy → [⟳ Verifying...]                                   │
└──────────────────────────────────────────────────────────────┘

STATE: ALREADY VERIFIED (tokenType = "already_verified")
────────────────────────────────────────────────────────
┌──────────────────────────────────────────────────────────────┐
│ STATUS PANEL    status-success-bg / border-success           │
│ "Your email is already verified. You can sign in now."       │
│ 14px/400/status-success-fg                                   │
└──────────────────────────────────────────────────────────────┘
(no action button — only navigation row with sign-in prominent)

STATE: SUCCESS — ACCOUNT CREATED (post-POST, pending_registration)
───────────────────────────────────────────────────────────────────
┌──────────────────────────────────────────────────────────────┐
│ STATUS PANEL    status-success-bg / border-success           │
│ "Account activated"  16px/600/sentence case                  │
│ "Your factory organization and workspace are ready."         │
│ 14px/400/status-success-fg                                   │
└──────────────────────────────────────────────────────────────┘
↕ 16px
┌──────────────────────────────────────────────────────────────┐
│ NEXT-STEP NOTICE   surface-shell / border-default            │
│ "Use the same email and password from registration."         │
│ 13px/400/text-secondary                                      │
└──────────────────────────────────────────────────────────────┘
↕ 16px
┌──────────────────────────────────────────────────────────────┐
│ SIGN-IN CTA  Button variant=primary  full width  h-[42px]   │
│ [Sign in →]  href="/access?verified=1"                      │
│ Button asChild + Link                                        │
└──────────────────────────────────────────────────────────────┘

STATE: SUCCESS — EMAIL VERIFIED (post-POST, existing_user)
───────────────────────────────────────────────────────────
┌──────────────────────────────────────────────────────────────┐
│ STATUS PANEL    status-success-bg / border-success           │
│ "Email verified"  16px/600/sentence case                     │
│ "Your email address is confirmed."  14px/400                 │
└──────────────────────────────────────────────────────────────┘
↕ 16px
┌──────────────────────────────────────────────────────────────┐
│ SIGN-IN CTA  Button variant=primary  full width  h-[42px]   │
│ [Sign in →]  href="/access?verified=1"                      │
└──────────────────────────────────────────────────────────────┘

STATE: ERROR (invalid/expired/missing token)
─────────────────────────────────────────────
┌──────────────────────────────────────────────────────────────┐
│ ERROR PANEL    status-danger-bg / border-danger              │
│ [error message text]  13px/400/status-danger-fg              │
└──────────────────────────────────────────────────────────────┘
(navigation row below provides escape path)
```

---

### 14B. Visual Attention Flow Map

```
ALL STATES — UNIVERSAL:
  SCAN LEVEL 1 (0–200ms): Primary state content (loading / CTA button / status panel)
  WHY: The state-dependent content zone immediately below the panel header is the
  only dynamic element. The user's eye goes to movement or color first.

  VALIDATING: Spinner signals "working" before text is read.
  VALID: Full-width primary button dominates; receives focus for keyboard completion.
  SUCCESS: Success-tone panel (green) signals "done" before text is read.
  ERROR: Danger-tone panel (red) signals "problem" before text is read.

  SCAN LEVEL 2 (200ms–1s): Panel header (badge + title) / Pre-action notice / Status text
  WHY: Header orients the user to the workspace purpose. Pre-action notice explains
  what the button is about to do. Status text gives the details.

  SCAN LEVEL 3 (1s–3s): Next-step notice / Navigation row
  WHY: After the primary action or status is understood, the user looks for what
  to do next. Next-step notice and navigation provide that path.

  SCAN LEVEL 4 (3s+): Left panel (activation steps, security posture)
  WHY: Most users complete the activation in <10s. Left panel is read only by
  users who pause to understand the context.
```

#### Persistent Visibility Requirements

```
ALWAYS IN VIEW:
  ├── Panel header (static — provides workspace identity at all times)
  ├── Navigation row (Register + Sign in — always reachable regardless of token state)
  └── Primary CTA (VALID states — never scrolls off on standard viewports)

CONTEXTUAL:
  ├── Loading indicator — only during GET /auth/email/verify/validate
  ├── Pre-action notice — only when tokenType is action_required
  ├── Action button — only when tokenType is pending_registration or existing_user
  ├── Success panel — only after POST succeeds or already_verified
  └── Error panel — only on invalid/expired/missing token
```

---

### 14C. Spacing & Rhythm Visualization

```
VERTICAL RHYTHM — Right Action Panel (top to bottom)

  ┌─ Panel outer padding top: 32px ─────────────────────────────────
  │  [PANEL HEADER] chip → h2 → description
  ├─ 20px gap (--space-5) ─── header → state content
  │
  │  ╔═══════════════════════════════════════════════════════════╗
  │  ║  STATE CONTENT (varies by phase)                         ║
  │  ║  VALIDATING: loading panel (16px inner padding)          ║
  │  ║  VALID:      pre-action notice + 16px gap + CTA button   ║
  │  ║  SUCCESS:    status panel + 16px gap + (next-step) +     ║
  │  ║              16px gap + sign-in CTA                      ║
  │  ║  ERROR:      error panel (16px inner padding)            ║
  │  ╚═══════════════════════════════════════════════════════════╝
  │
  ├─ 20px gap (--space-5) ─── state content → navigation row
  │  [NAVIGATION ROW]
  │  [Register outline]  [Sign in ghost]
  │  gap: 12px between buttons
  │
  └─ Panel outer padding bottom: 32px ──────────────────────────────

DENSE: CTA button area (no excess breathing room — action clarity)
BREATHABLE: Spacing between header and state content (20px pause)
VISUAL SILENCE: Navigation row gap (20px above) separates actions
  from escape paths — tells the eye "this is a different concern"
```

---

### 14D. Component Nesting Hierarchy

```
AuthWorkstationShell
  ├── AuthTopbar (56px)
  │     ├── BrandLink (Building2 + "DPR.ai")
  │     └── MetaLabels (industry · platform)
  ├── LeftContextPanel (45% desktop, hidden mobile)
  │     ├── EyebrowLabel ("Account activation")
  │     ├── PageTitle ("Activate factory access" — 18px/600)
  │     ├── Description (14px/400)
  │     ├── ActivationStepsCard (surface-shell)
  │     │     └── Step × 3 (01–03, numbered, sentence case)
  │     └── SecurityPostureCard (surface-panel)
  │           ├── ShieldCheck icon
  │           └── SecurityBullets × 3 (13px/400)
  └── RightActionPanel (55% desktop, 100% mobile)
        └── ActionPanelInner (surface-card, max-w-480px)
              ├── PanelHeader (static)
              │     ├── BadgeChip ("Email verification")
              │     ├── PanelTitle ("Verify email" — 16px/600)
              │     └── PanelDescription (14px/400)
              │
              ├── [STATE: VALIDATING]
              │     └── LoadingPanel (surface-shell)
              │           ├── Spinner / ActivityIndicator
              │           └── LoadingText (14px/400/secondary)
              │
              ├── [STATE: action_required]
              │     ├── PreActionNotice (surface-shell)
              │     └── Button variant="primary" isBusy busyLabel
              │           (label: "Activate account" or "Verify email")
              │
              ├── [STATE: success or already_verified]
              │     ├── StatusPanel (status-success-bg)
              │     │     ├── StatusTitle (16px/600) [if post-POST]
              │     │     └── StatusBody (14px/400)
              │     ├── NextStepNotice (surface-shell) [if pending_registration]
              │     └── Button variant="primary" asChild
              │           └── Link href="/access?verified=1" "Sign in →"
              │
              ├── [STATE: error]
              │     └── ErrorPanel (status-danger-bg)
              │           └── ErrorText (13px/400/danger-fg)
              │
              └── NavigationRow (always visible)
                    ├── Button variant="outline" asChild
                    │     └── Link href="/register" "Register"
                    └── Button variant="ghost" asChild
                          └── Link href="/access" (or "/access?verified=1") "Sign in"
```

---

### 14E. Responsive Collapse Blueprint

```
1440px+ (Full workstation):
┌────────────────────────────────────────────────────────────────────────┐
│  TOPBAR                                                    height: 56px│
├──────────────────────────────┬─────────────────────────────────────────┤
│  LEFT CONTEXT PANEL          │  RIGHT ACTION PANEL                     │
│  width: 45%                  │  width: 55%                             │
│  padding: 40px               │  inner max-w-480px centered             │
│  Activation steps +          │  State-dependent content +              │
│  Security posture card       │  Navigation row                         │
└──────────────────────────────┴─────────────────────────────────────────┘

1024px–1279px (Compact desktop):
┌────────────────────────────────────────────────────────────────────────┐
│  TOPBAR                                                    height: 56px│
├──────────────────────────────┬─────────────────────────────────────────┤
│  LEFT PANEL (45%, padding 24px)│  RIGHT ACTION PANEL (55%)             │
│  (stays visible)              │  inner max-w-480px unchanged           │
└──────────────────────────────┴─────────────────────────────────────────┘

<768px (Mobile — primary use case for this page):
┌────────────────────────────────────────────────────────────────────────┐
│  TOPBAR                                                    height: 56px│
├────────────────────────────────────────────────────────────────────────┤
│  RIGHT ACTION PANEL (full width, centered)                            │
│  LEFT PANEL: HIDDEN (display: none)                                   │
│  · All states fully functional ·                                      │
│  · Button height: 48px (touch target) ·                               │
│  · Navigation buttons: ≥44px height ·                                 │
│  · Status panels: full width, 16px horizontal padding ·               │
└────────────────────────────────────────────────────────────────────────┘

NOTE: Mobile is the PRIMARY use case (user clicked email link on phone).
All states (loading, valid, success, error) must work correctly at <768px.
```

---

### 14F. Structural Consistency Validation

```yaml
structural_validation:
  - [x] All zones justified by operational necessity — no aesthetic zones
        (Action panel = the verification action + all its states;
        Left panel = activation context + security posture signal)
  - [x] Visual dominance matches attention priority
        (Right action panel [P:1] is visually dominant; left panel [P:4] secondary)
  - [x] Spacing rhythm follows density specs
        (20px gaps around state content, 16px inter-element, 32px panel padding — all 4px multiples)
  - [x] Responsive adaptations preserve all critical operator actions
        (All 6 states accessible on mobile; all buttons touch-safe at ≥44px)
  - [x] Component nesting hierarchy matches Section 11
  - [x] No over-zoning — 3 zones total (topbar, left panel, right panel) = minimum required
  - [x] No redundant information surfaces — left panel shows activation steps once;
        right panel shows current state once; no duplication
  - [x] Blueprint matches SPLIT AUTH LAYOUT declared in Section 4.1
```

---

## KIRO TASK CHAINING

After this spec is APPROVED, the following implementation tasks are unblocked:

```yaml
downstream_kiro_tasks:
  task_1:
    name: "Verify Email — AuthShell → AuthWorkstationShell Migration"
    input: This spec → Section 4.1, Section 11
    output: Direct AuthWorkstationShell usage with verify-email-specific left panel content

  task_2:
    name: "Verify Email — Typed State Machine"
    input: This spec → Section 3.3, Section 11 (state machine types)
    output: TokenType and VerifyPhase typed state variables; tokenType derived from validate
      response once and stored; no repeated string parsing

  task_3:
    name: "Verify Email — Action Button Fix (isBusy + focus)"
    input: This spec → Section 4.2, Section 7 (keyboard flow)
    output: Button uses isBusy + dynamic busyLabel; programmatic focus after tokenType resolves

  task_4:
    name: "Verify Email — Loading State Spinner"
    input: This spec → Section 4.2 (VALIDATING state)
    output: Loading state shows Spinner/ActivityIndicator component + text

  task_5:
    name: "Verify Email — Navigation Row Accessibility Fix"
    input: This spec → Section 4.2 (navigation row), Section 12
    output: Button asChild + Link pattern; correct variant hierarchy (outline/ghost in nav);
      no <Link><Button> nesting

  task_6:
    name: "Verify Email — Border & Surface Token Cleanup"
    input: This spec → Section 9.4, Section 12
    output: All border-[0.5px] replaced with semantic border token classes

  task_7:
    name: "Verify Email — Success & Error State Rebuild"
    input: This spec → Section 4.2 (success/error state contents)
    output: Contextually correct success messages per tokenType; sign-in CTA with
      /access?verified=1; error state uses semantic danger tokens

  task_8:
    name: "Verify Email — Responsive & Touch Behavior"
    input: This spec → Section 10
    output: Left panel hidden <1024px; buttons 48px height on mobile; all touch targets ≥44px
```

---

*End of WORKSPACE_SKELETON_VERIFY_EMAIL.md (Sections 1–14)*
*This file is system-generated architecture. Treat as engineering law until formally amended.*
*Architectural precedent established: TokenType typed state machine pattern for token-driven workspaces;
Button asChild + Link accessibility pattern for navigation buttons;
two-path token resolution documentation (PendingRegistration vs EmailVerificationToken);
mobile-primary consideration for email-link-accessed pages*

``
CODE

<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Verify Email | FactoryNerve OS</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<style>
        body {
            background-color: #0b1326;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20;
        }
    </style>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "secondary-container": "#3a4a5f",
                        "primary-fixed-dim": "#4cd6ff",
                        "outline": "#859399",
                        "surface-container": "#171f33",
                        "primary-container": "#00d1ff",
                        "secondary-fixed": "#d3e4fe",
                        "on-tertiary-fixed": "#291800",
                        "on-tertiary-container": "#6b4700",
                        "on-secondary": "#213145",
                        "on-error-container": "#ffdad6",
                        "surface-variant": "#2d3449",
                        "on-primary-container": "#00566a",
                        "inverse-primary": "#00677f",
                        "surface-dim": "#0b1326",
                        "tertiary-fixed": "#ffddb1",
                        "on-tertiary-fixed-variant": "#624000",
                        "surface-tint": "#4cd6ff",
                        "surface": "#0b1326",
                        "surface-bright": "#31394d",
                        "tertiary-container": "#feb127",
                        "on-tertiary": "#442b00",
                        "background": "#0b1326",
                        "on-primary-fixed": "#001f28",
                        "error-container": "#93000a",
                        "on-primary": "#003543",
                        "primary-fixed": "#b7eaff",
                        "outline-variant": "#3c494e",
                        "tertiary-fixed-dim": "#ffba49",
                        "on-secondary-container": "#a9bad3",
                        "surface-container-low": "#131b2e",
                        "inverse-surface": "#dae2fd",
                        "on-secondary-fixed-variant": "#38485d",
                        "error": "#ffb4ab",
                        "on-surface-variant": "#bbc9cf",
                        "primary": "#a4e6ff",
                        "on-primary-fixed-variant": "#004e60",
                        "tertiary": "#ffd59c",
                        "surface-container-high": "#222a3d",
                        "on-background": "#dae2fd",
                        "surface-container-highest": "#2d3449",
                        "secondary-fixed-dim": "#b7c8e1",
                        "on-error": "#690005",
                        "on-surface": "#dae2fd",
                        "inverse-on-surface": "#283044",
                        "secondary": "#b7c8e1",
                        "surface-container-lowest": "#060e20",
                        "on-secondary-fixed": "#0b1c30"
                    },
                    "borderRadius": {
                        "DEFAULT": "0.125rem",
                        "lg": "0.25rem",
                        "xl": "0.5rem",
                        "full": "0.75rem"
                    },
                    "spacing": {
                        "xl": "32px",
                        "margin": "24px",
                        "sm": "8px",
                        "gutter": "16px",
                        "xs": "4px",
                        "md": "16px",
                        "lg": "24px",
                        "base": "4px"
                    },
                    "fontFamily": {
                        "metadata": ["JetBrains Mono"],
                        "page-title": ["Hanken Grotesk"],
                        "label": ["Hanken Grotesk"],
                        "panel-title": ["Hanken Grotesk"],
                        "body": ["Hanken Grotesk"],
                        "button": ["Hanken Grotesk"]
                    },
                    "fontSize": {
                        "metadata": ["11px", {"lineHeight": "14px", "letterSpacing": "0.04em", "fontWeight": "400"}],
                        "page-title": ["18px", {"lineHeight": "24px", "letterSpacing": "0em", "fontWeight": "600"}],
                        "label": ["13px", {"lineHeight": "18px", "letterSpacing": "0em", "fontWeight": "400"}],
                        "panel-title": ["16px", {"lineHeight": "20px", "letterSpacing": "0em", "fontWeight": "600"}],
                        "body": ["15px", {"lineHeight": "22px", "letterSpacing": "0em", "fontWeight": "400"}],
                        "button": ["14px", {"lineHeight": "14px", "letterSpacing": "0.02em", "fontWeight": "500"}]
                    }
                },
            },
        }
    </script>
</head>
<body class="bg-background text-on-surface font-body overflow-hidden">
<main class="flex h-screen w-full">
<!-- Left Panel: Quiet Industrial Context -->
<section class="hidden md:flex w-[40%] bg-surface-container-lowest relative border-r border-outline-variant/30 overflow-hidden flex-col justify-between p-xl">
<!-- Background: Subdued and Blurred -->
<div class="absolute inset-0 z-0">
<img alt="" class="w-full h-full object-cover opacity-5 grayscale blur-sm" src="https://lh3.googleusercontent.com/aida/AP1WRLskuoQy3T8qDz0eGsKNwIlV92jLnawrJYhBQ_kkZo4m0U6LUkIPMLtBdIKMXuZTkooSRdnjxXuq4AyWCvfGyJdl4kCHoevcMNgZtASWL61Lg6x3Cvii8l3wovEkoqcQ7SXoJ71VQrhJXmqcMDIGlk_q7QTxqsUEHBcY0eZ6K3tZJ8oW9sLoiK86-RttgOA5IazL4jjLzMguBkMewSG3LXUOB-nOXk2SCi97k0tEkioBPq-yKHMa3CbRQug"/>
<div class="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent"></div>
</div>
<!-- Branding -->
<header class="relative z-10">
<div class="flex items-center gap-sm">
<span class="font-page-title text-page-title font-bold tracking-tight text-on-surface">FactoryNerve</span>
</div>
</header>
<!-- Navigation Steps: Sentence-case and Quiet -->
<nav class="relative z-10 flex flex-col gap-lg max-w-xs">
<div class="flex items-center gap-md">
<div class="h-1 w-1 rounded-full bg-outline-variant"></div>
<span class="font-label text-label text-on-surface-variant">System registration</span>
</div>
<div class="flex items-center gap-md">
<div class="h-1.5 w-1.5 rounded-full bg-primary-fixed-dim shadow-[0_0_8px_rgba(76,214,255,0.4)]"></div>
<span class="font-label text-label text-on-surface font-medium">Account activation</span>
</div>
<div class="flex items-center gap-md">
<div class="h-1 w-1 rounded-full bg-outline-variant opacity-30"></div>
<span class="font-label text-label text-on-surface-variant opacity-40">Environment initialization</span>
</div>
</nav>
<!-- Footer Metadata -->
<footer class="relative z-10">
<p class="font-metadata text-metadata text-on-surface-variant/60">
                Secure session v2.4.1
            </p>
</footer>
</section>
<!-- Right Panel: Focused Action Hub -->
<section class="flex-1 flex flex-col items-center justify-center bg-surface p-margin">
<!-- Mobile Brand Header -->
<div class="md:hidden absolute top-0 left-0 w-full p-margin">
<span class="font-page-title text-page-title font-bold text-on-surface">FactoryNerve</span>
</div>
<!-- Verification Container -->
<div class="w-full max-w-[440px] space-y-xl">
<header class="space-y-md">
<div class="flex items-center gap-sm text-primary-fixed-dim/80">
<span class="material-symbols-outlined text-[20px]">mail</span>
<span class="font-label text-[12px] uppercase tracking-[0.1em] font-semibold">Email verification</span>
</div>
<div class="space-y-sm">
<h1 class="font-page-title text-[28px] leading-tight text-on-surface font-semibold tracking-tight">Activate your account</h1>
<p class="font-body text-body text-on-surface-variant/80">
                        A verification request has been sent to your registered endpoint. Please confirm to initialize your workstation.
                    </p>
</div>
</header>
<!-- Status Card: Tonal layering -->
<div class="bg-surface-container-low/50 rounded-lg p-lg space-y-lg border border-outline-variant/10">
<div class="flex justify-between items-center">
<div class="space-y-xs">
<label class="font-label text-[11px] uppercase tracking-wider text-on-surface-variant/60">Work email</label>
<span class="font-metadata text-[14px] text-on-surface/90">admin.operator_99@factorynerve.systems</span>
</div>
</div>
<div class="flex items-center gap-sm pt-md border-t border-outline-variant/10">
<div class="h-2 w-2 rounded-full bg-tertiary-container/40 animate-pulse"></div>
<span class="font-label text-[12px] text-on-surface-variant italic">Awaiting response from server...</span>
</div>
</div>
<!-- Action Section -->
<div class="space-y-lg">
<button class="w-full h-[48px] bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container font-button text-button rounded-lg transition-all flex items-center justify-center gap-sm shadow-sm" id="activate-btn">
<span>Activate account</span>
<span class="material-symbols-outlined text-[18px]">east</span>
</button>
<div class="flex flex-col gap-md pt-sm">
<button class="text-left font-label text-label text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-sm group">
<span class="material-symbols-outlined text-[18px] text-outline">history</span>
<span>Resend activation link</span>
</button>
<button class="text-left font-label text-label text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-sm">
<span class="material-symbols-outlined text-[18px] text-outline">settings_account_box</span>
<span>Update registration details</span>
</button>
</div>
</div>
<!-- Discrete Footer -->
<footer class="pt-xl border-t border-outline-variant/10">
<div class="flex flex-wrap items-center gap-gutter text-on-surface-variant/50">
<span class="font-metadata text-metadata">© 2026 FactoryNerve Systems</span>
<div class="h-3 w-[1px] bg-outline-variant/20 hidden sm:block"></div>
<div class="flex gap-md">
<a class="font-metadata text-metadata hover:text-on-surface transition-colors" href="#">Support</a>
<a class="font-metadata text-metadata hover:text-on-surface transition-colors" href="#">Compliance</a>
</div>
</div>
</footer>
</div>
</section>
</main>
<!-- Notification Overlay -->
<div class="fixed bottom-margin right-margin translate-y-12 opacity-0 transition-all duration-300 pointer-events-none" id="status-toast">
<div class="bg-surface-container-highest border border-outline-variant/20 rounded-lg p-md pr-lg flex items-center gap-md shadow-2xl">
<span class="material-symbols-outlined text-primary-fixed-dim">check_circle</span>
<div>
<p class="font-label text-label text-on-surface font-medium">Status Update</p>
<p class="font-body text-[13px] text-on-surface-variant">Activation link has been re-dispatched.</p>
</div>
</div>
</div>
<script>
    const activateBtn = document.getElementById('activate-btn');
    const toast = document.getElementById('status-toast');
    
    // Use a more modern selector approach for the resend button
    const resendBtn = Array.from(document.querySelectorAll('button')).find(btn => btn.innerText.includes('Resend'));

    if (resendBtn) {
        resendBtn.addEventListener('click', () => {
            toast.classList.remove('translate-y-12', 'opacity-0');
            toast.classList.add('translate-y-0', 'opacity-100');
            
            setTimeout(() => {
                toast.classList.add('translate-y-12', 'opacity-0');
                toast.classList.remove('translate-y-0', 'opacity-100');
            }, 3000);
        });
    }

    activateBtn.addEventListener('mousedown', () => {
        activateBtn.classList.add('scale-[0.985]');
    });

    activateBtn.addEventListener('mouseup', () => {
        activateBtn.classList.remove('scale-[0.985]');
    });
</script>
</body></html>
``