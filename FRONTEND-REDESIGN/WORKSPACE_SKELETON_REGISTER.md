# Register — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Architecture — Phase A, Item 2
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity
- Route: `/register`
- Workspace Name: Factory Access Provisioning — New Account Registration
- Operational Role: Captures the identity, credentials, role intent, and factory context for a new user; creates a pending registration record that is activated only after email verification is completed.
- Business Impact: If this workspace fails, no new organizations can be bootstrapped and no new operators can self-onboard to existing factories. All org-level setup pathways are blocked.
- User Population: Two distinct personas — (1) First-time owner who is setting up a brand-new organization and factory from zero, (2) Existing factory operator/attendance user joining an established factory by providing a company code. Both are low-frequency, high-stakes users.
- Peak Usage Context: Org setup day (once per organization lifetime for owners); Ad-hoc for new operators joining an established factory (on-demand, typically during onboarding periods).

### 1.2 Operational Importance
Registration is a once-in-a-lifetime event for each user — the factory owner sets up the organization exactly once, and an operator joins exactly once. The form must be correct on the first attempt because email verification introduces a delay loop between submission and activation. Errors on submission waste this high-stakes interaction. The system also enforces a critical constraint: public registration is limited to `attendance` and `operator` roles for existing organizations — higher roles require admin invitation. The UI must surface this constraint clearly so users with wrong role expectations don't waste a registration attempt.

### 1.3 Current State Problems
- `FieldLabel` component uses `uppercase tracking-[0.18em]` — violates typography governance; tracking above 0.06em on uppercase labels is explicitly forbidden
- Password show/hide toggle button uses `uppercase tracking-[0.16em] text-[10px]` — same tracking violation; must use sentence case at `--type-label` scale
- Success state panels use `text-[11px] font-medium uppercase tracking-[0.22em]` as eyebrow labels in three locations — violation across all three instances
- Footer "Existing operator?" label uses `uppercase tracking-[0.2em]` — violation
- Success state "After verification" redirect panel uses `uppercase tracking-[0.22em]` — violation
- "Pending identity" label in success state uses `uppercase tracking-[0.22em]` — violation
- The inline chip (retry required / inbox action / link ready) in success state uses `uppercase tracking-[0.18em]` — violation
- Preview verification link panel uses `uppercase tracking-[0.22em]` eyebrow — violation
- Sign-in link uses `text-[var(--accent)]` raw token reference — must use `text-action-primary` token class
- The role description card ("Operational onboarding" header) uses `uppercase tracking-[0.22em]` — violation
- Phone number field uses `<Mail>` icon instead of a phone icon — incorrect icon mapping (operational error, not aesthetic)
- The `FieldLabel` component is a local inline component rendering raw label HTML without the system `Label` primitive — inconsistent with the component library; must use system `Label`
- The `IdentityField` and `PasswordInput` are local inline components not using the system `Field` → `Label` → `Input` pattern — prevents correct validation state propagation
- The form uses `grid-cols-2 gap-3` for all fields without consideration of logical groupings — organization/name belong together (first group), email/role belong together (second group), passwords together (third group), company code/phone together (fourth group); no `FieldSection` grouping exists
- The `owner` role option is present in `roleOptions` array but `POST /auth/register` returns HTTP 403 if `role=owner` is submitted — the frontend silently allows selecting owner, guaranteeing a backend rejection for that choice; must remove owner from the selectable options or surface a clear inline constraint notice
- The `Select` for role uses a raw `<select>` element with `ChevronDown` overlay — must use the system `Select` or `Field` + select primitive for consistent validation state
- Role description is surfaced in a separate card below the grid, disconnected from the role selector — the detail should be contextual to the select field, not a separate card that shifts layout
- No `autoFocus` on first field (company/organization name) — operators must click to begin on page load
- The success state is rendered entirely within the same `AuthWorkstationShell` — this is correct behavior; but the instruction steps in the left panel do not update after success to reflect the completed workflow state
- The resend verification action in success state is a `Button` that fires immediately without rate-limit feedback — the `resendStatus` feedback is shown only in a separate `<div>` below; user has no indication the button was pressed until async completion

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Auth / Onboarding | Route exists outside the app shell; no sidebar, no topbar; pre-operational entry gate — same shell class as login |
| Workflow Category | Entry | User performs a single sequential workflow: fill credentials + context → submit → verify email → access granted |
| Operational Behavior | Form-Driven | Eight fields plus role select; two distinct workflow phases (form entry vs. post-submission success state) |
| Data Density | LOW-MEDIUM | Eight input fields, one role selector, one role context card, success state with verification instructions; no tables |
| Realtime Complexity | NONE | No polling, no subscriptions; one async POST response; resend email is a secondary async action |
| AI Complexity | NONE | No AI systems involved in registration |
| Audit Complexity | LOW | Backend writes `PUBLIC_SIGNUP_PENDING_VERIFICATION` or `USER_REGISTERED_VERIFIED` to `AuditLog` — not surfaced in the frontend UI |
| Decision Pressure | LOW | User makes one meaningful decision (role selection); all other fields are deterministic data entry; the pressure is completeness, not speed |

**Classification Implication:**
A LOW-MEDIUM density, NONE-realtime, Form-Driven Auth workspace means the form structure is the entire product. The eight-field form is significantly more complex than the two-field login form, which means logical grouping and progressive clarity matter here in a way they do not on login. The role selector is the most consequential decision on this page — it determines organizational authority and has a backend enforcement gate. The two-phase behavior (form vs. success state) must be handled as a single-surface state machine, not as a navigation change. Left panel content updates to reflect the current phase. The workspace shares the `AuthWorkstationShell` container pattern established by the login skeleton and must maintain identical shell-level spacing, topbar height, and left panel behavior.

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Permission | Key Response Fields |
|---|---|---|---|---|
| `POST /auth/register` | POST | Accepts registration payload; validates uniqueness, password strength, role constraints, company code matching; creates `PendingRegistration` record; sends verification email | Public | `message`, `email`, `pending_factory_name`, `verification_required: true`, `verification_link` (preview mode only), `delivery_mode: "email" \| "preview" \| "email_failed"` |
| `POST /auth/email/verification/resend` | POST | Resend verification email for a pending registration | Public | `message`, `verification_link` (preview only), `delivery_mode` |
| `GET /observability/ready` | GET | Backend warm-up check on page mount | Public | HTTP 200 (ready) or 503 (waking) |

**Backend constraints to surface in UI:**
- `role=owner` is rejected with HTTP 403: `"Owner accounts cannot be created from public registration."` — must not offer owner in role options
- Password minimum length: 12 characters, maximum: 128 characters — client must validate before submit
- `validate_password_strength()` is called server-side — if it fails, HTTP 400 is returned; client pre-validation against length rule reduces round-trips
- Duplicate email: HTTP 409 `"Email is already registered."` — must surface clearly with sign-in CTA
- Company code mismatch: HTTP 400 `"Company code does not match factory name."` — field-level error on company code field
- Invalid company code: HTTP 400 `"Invalid company code."` — field-level error on company code field
- High-role attempt on existing org: HTTP 403 `"Public registration is limited to attendance accounts. Ask an admin or owner to invite higher roles."` — must surface as inline constraint notice

**Registration two-phase architecture:**
- Phase 1 (this page): Creates `PendingRegistration` record. No `User` record exists yet. The account is NOT active.
- Phase 2 (`/verify-email` route): Email click → `POST /auth/email/verify` token → `_activate_pending_registration()` → creates actual `User` record, `UserFactoryRole`, `Subscription` (if new org)

### 3.2 Entity Relationship Map

```
PendingRegistration (email, name, password_hash, requested_role, factory_name, company_code)
    │
    │ [after email verification]
    ▼
AuthUser (email, is_email_verified=true)
    └── User (id, org_id, role=OWNER if new org / ATTENDANCE if existing org)
          └── UserFactoryRole (factory_id, role)
                └── Factory (factory_id, org_id) ← resolved from factory_name + company_code
                      └── Organization (org_id) ← created if new / matched if existing
                            └── Subscription (plan=DEFAULT_PLAN, status="trialing") ← only if new org
```

The registration workspace only creates a `PendingRegistration` — the real entity graph is built at email verification. This is critical for UX: the success state must clearly communicate that the account does not yet exist and email verification is the activation gate.

### 3.3 Workflow State Machine

```
[FORM ENTRY STATE]
    → user fills all required fields, selects role
    → client validates: password match, min length 12, phone format (if provided)
    → [SUBMITTING] (loading state, form disabled)
        → 400 (password too weak / company code mismatch / factory name mismatch)
              → [FORM ERROR] inline error message, form re-enabled
        → 403 (owner role submitted / high-role on existing org)
              → [FORM ERROR] inline error message, form re-enabled
        → 409 (email already registered)
              → [FORM ERROR] "Email already registered" + sign-in CTA link
        → 201 + RegisterResponse (delivery_mode: "email")
              → [SUCCESS STATE — EMAIL PENDING] show verification instructions
        → 201 + RegisterResponse (delivery_mode: "preview")
              → [SUCCESS STATE — PREVIEW LINK] show clickable verification link
        → 201 + RegisterResponse (delivery_mode: "email_failed")
              → [SUCCESS STATE — EMAIL FAILED] show warning + resend CTA

[SUCCESS STATE]
    → user can click "Resend email" button
    → [RESENDING] (button loading state)
        → error → show resend status message (error tone)
        → success → update resendStatus message; if preview link returned, show new link
```

**Frontend Implication:**
The two-phase nature (form → success) means the form and success panels are exclusive states within the same page mount — no navigation occurs. The left panel must update its `steps` array to reflect completion of step 1 after success, highlighting step 2 ("Verify operational inbox") as the current active step. The success state must not show the form again unless the user explicitly navigates away and returns.

### 3.4 Realtime Contracts
None. No polling or subscriptions. Backend warm-up check is fire-and-forget on mount.

### 3.5 AI System Contracts
Not applicable. No AI systems involved in the registration workflow.

### 3.6 Permission Matrix

| Role | View Form | Submit Form | Resend Verification |
|---|---|---|---|
| Anonymous (unauthenticated) | ✓ | ✓ | ✓ |
| Any authenticated role | N/A — redirected away by AppShell guard | — | — |

**Role Selection Constraints (backend-enforced, must be mirrored in UI):**

| Role Option | Available in Selector | Constraint |
|---|---|---|
| Owner | ✗ — must be removed | HTTP 403 if submitted |
| Admin | Conditionally — show warning if company code matches existing org | HTTP 403 if existing org has users |
| Manager | Conditionally — show warning if company code matches existing org | HTTP 403 if existing org has users |
| Supervisor | Conditionally — show warning if company code matches existing org | HTTP 403 if existing org has users |
| Attendance | ✓ always available | Always permitted |
| Operator | ✓ always available | Always permitted |

**Permission Implication:**
The role selector must exclude `owner` entirely. The remaining role options (admin, manager, supervisor, attendance, operator) are always visible but the form must surface a contextual notice when a company code is provided: "For this factory, only attendance and operator roles can be registered publicly. Higher roles require an invitation." This prevents guaranteed 403 failures for users who select manager/supervisor when joining an existing org.

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

```
SPLIT AUTH LAYOUT: Left context panel (desktop only) + Right form panel (always visible)
```

Left panel: 45% width on desktop (≥1024px), hidden on mobile/tablet. Contains provisioning workflow steps, role description context, and security signals. Updates content between form-entry phase and success phase. Does NOT contain anything interactive.

Right panel: 55% width on desktop, 100% width on mobile. Contains either the registration form (phase 1) or the verification success state (phase 2).

**Pattern Justification:**
Inherits the identical SPLIT AUTH LAYOUT established in the login skeleton. This is law — all auth-shell pages share the same structural split so that users navigating between `/login` and `/register` experience zero spatial reorientation. The left panel is proportionally more valuable here than on login because registration is a higher-cognitive-load event (8 fields, role selection, factory context). The left panel's provisioning steps reduce anxiety for first-time factory owners who are uncertain what they are committing to. On mobile, the panel collapses for the same reason as login: form completion speed is the only priority.

### 4.2 Zone Definitions

---

#### ZONE: Auth Topbar

**Role:** Brand anchor and cross-navigation. Communicates platform identity. Provides the sign-in link as the escape hatch for users who already have accounts.

**Attention Priority:** 5 (lowest — background orientation only)

**Position:** top, spans full width

**Width:** fluid: 100%

**Height:** fixed: 56px

**Sticky Behavior:** not sticky — no scrolling on this page

**Collapse Behavior:** never collapses; on mobile the right-side metadata abbreviates but topbar remains

**Scroll Behavior:** no scroll needed

**Density Mode:** default (no density switching on auth pages)

**Contents:**
- Logo/brand link (Building2 icon + "DPR.ai" label): links to homeHref `/`
- Industry label (right side): `text-text-secondary`, sentence case
- Platform label (right side): `text-action-primary` token class — "Factory OS"

**Acceptance Criteria:**
- [ ] Topbar renders at exactly 56px height, consistent with login skeleton
- [ ] Logo link navigates to `/`
- [ ] Industry and platform labels use `--type-label` (12px, 500 weight) sentence case — NOT uppercase
- [ ] Platform label uses `text-action-primary` class — NOT `text-[var(--accent)]` inline style
- [ ] No gradient, border-bottom, or shadow on topbar

---

#### ZONE: Left Context Panel

**Role:** Provides provisioning workflow context, role authority explanation, and security posture signals. Updates its step indicators between form-entry phase and success phase to show workflow progression.

**Attention Priority:** 4

**Position:** left

**Width:** fixed: 45% on desktop (≥1024px); hidden: 0% on mobile/tablet (<1024px)

**Height:** fill-remaining (100vh minus topbar 56px)

**Sticky Behavior:** not sticky

**Collapse Behavior:** hidden entirely at <1024px — zero visual trace on mobile

**Scroll Behavior:** independent scroll if content overflows on very short desktop heights; otherwise no scroll

**Density Mode:** default

**Contents:**
- Eyebrow label: "Factory onboarding channel" — `--type-label` (12px, 500 weight), sentence case, `text-text-tertiary`; NOT uppercase
- Page title: "Establish factory access" — `--type-page-title` (18px, 600 weight), sentence case; NOT marketing scale `clamp()` sizing
- Description: `--type-body` (14px, 400 weight), `text-text-secondary`
- Provisioning steps card: 3 numbered steps (01, 02, 03), each with title + description. Step 1 shows active/completed state based on `success !== null`. `--type-body` (14px, 400 weight). Step labels in sentence case.
- Role authority card (phase 1 only): shows current selected role label + role detail description. Updates reactively as role selector changes in the right panel. `--type-body` (14px). `surface-panel` background.
- Security posture card: `ShieldCheck` icon + "Secure connection active" + 2–3 security context bullets. `--type-body` (14px).
- Phase 2 override: when `success !== null`, the provisioning steps card highlights step 2 ("Verify operational inbox") as the current active step and marks step 1 as completed. The role authority card is hidden in success phase — replaced by a verification status summary (delivery mode label + email address).

**Acceptance Criteria:**
- [ ] Left panel is invisible (display: none or width: 0) at viewport width below 1024px
- [ ] Page title renders at maximum 18px (`--type-page-title`) — NOT marketing heading scale
- [ ] All labels use sentence case — NO uppercase tracking wider than 0.06em anywhere in this zone
- [ ] Eyebrow uses `--type-label` (12px, 500 weight), `text-text-tertiary`
- [ ] Provisioning steps are numbered and use `--type-body` (14px, 400 weight), sentence case
- [ ] Step 1 shows completed indicator after successful form submission
- [ ] Step 2 shows active indicator after successful form submission
- [ ] Role authority card updates when role selector changes in right panel (reactive)
- [ ] Role authority card is hidden in success phase
- [ ] Verification status summary appears in success phase
- [ ] No gradient on any element in this zone
- [ ] No interactive elements in this zone

---

#### ZONE: Right Form Panel

**Role:** Primary operational surface. Phase 1: contains the registration form. Phase 2: contains the verification success state. Only one phase is visible at a time.

**Attention Priority:** 1 (highest)

**Position:** right (center on mobile)

**Width:** fluid: 55% desktop; 100% mobile; inner panel has `max-width: 520px` centered within the column (wider than login's 480px to accommodate 2-column field grid)

**Height:** fill-remaining; inner panel vertically centered; scroll enabled for very tall content (form + all fields on short desktop viewports)

**Sticky Behavior:** not sticky

**Collapse Behavior:** never collapses — always the primary visible zone

**Scroll Behavior:** scroll: explicit height when viewport height <700px; otherwise content fits without scroll

**Density Mode:** default

**Contents — Phase 1 (form-entry state):**
- Panel header:
  - Badge chip: "Factory access provisioning" — `--type-label` (12px, 500 weight), sentence case, `surface-shell` background
  - Panel title: "Create account" — `--type-panel-title` (16px, 600 weight), sentence case; NOT arbitrary `text-[2rem]`
  - Panel description: `--type-body` (14px, 400 weight), `text-text-secondary`
- Redirect notice (conditional): shown when `?next=` param is present; `surface-selected` background; `--type-body` (14px)
- Registration form:
  - FieldSection 1 — "Organization": `factoryName` + `companyCode` (optional) fields. `companyCode` has helper text: "Optional — enter if joining an existing factory". These two fields belong together because company code validates factory name.
  - FieldSection 2 — "Account": `name` + `email` + `role` selector. These three fields define the user identity.
  - FieldSection 3 — "Security": `password` + `confirmPassword`. Both use password input with show/hide toggle.
  - FieldSection 4 — "Contact" (optional group): `phoneNumber` field alone. Optional, not required.
  - Role constraint notice (conditional, inline after role select): rendered when `companyCode.trim()` is non-empty AND selected role is NOT attendance/operator. Notice reads: "For existing factories, only attendance and operator roles can be registered publicly. Contact your admin for higher roles." Uses `--status-warning-bg/fg/border` semantic tokens.
  - Error message zone: renders when `error` is non-null; `--status-danger-bg/fg/border` tokens
  - Submit button: full width, `h-[42px]`, "Create account" label; `isBusy` state shows "Creating..."
  - Footer: "Already have an account?" + "Sign in →" link — `--type-body` (14px), sentence case; link uses `text-action-primary` token class

**Contents — Phase 2 (success state):**
- Panel header:
  - Badge chip: context-dependent label — "Verification pending" / "Verification link ready" / "Email delivery failed" — sentence case, semantic tone
  - Panel title: context-dependent — "Check your inbox" / "Open verification link" / "Signup saved" — `--type-panel-title` (16px, 600 weight), sentence case
  - Panel description: `--type-body` (14px), `text-text-secondary`
- Redirect context notice (conditional): when `?next=` param present, shows "After verification, sign in to continue into [destination]." — `surface-selected` background
- Status panel: semantic tone border+bg+fg (success/warning/info) based on `delivery_mode`. Contains: status title + explanation text. Uses `--type-body` (14px).
- Pending identity card: `surface-panel` background, shows email address + status chip ("Inbox action" / "Link ready" / "Retry required"). Email in `--type-body` (14px, 600 weight). Chip uses `--type-label` (12px, 500 weight), sentence case — NOT uppercase tracking.
- Instructions list: 3 numbered steps explaining what to do next. `surface-shell` background per step, `--type-body` (14px), `text-text-secondary`.
- Preview link panel (conditional): when `success.verification_link` is non-null (preview mode). `surface-selected` background, eyebrow label in `--type-label` (12px, 500 weight) sentence case. Link button navigates to the verification URL.
- Resend action + sign-in link row: `Button variant="outline"` "Resend email" with `isBusy` state; sign-in link uses `text-action-primary`
- Resend status message (conditional): appears below resend row after resend attempt

**Acceptance Criteria — Phase 1:**
- [ ] Panel badge chip renders at 12px, 500 weight, sentence case — NOT uppercase tracking
- [ ] Panel title renders at 16px (`--type-panel-title`) — no arbitrary sizing
- [ ] All field labels use sentence case, `--type-label` (12px, 500 weight) — NOT uppercase tracking
- [ ] All fields use system `Field` → `Label` → `Input` pattern with correct `htmlFor` linkage
- [ ] `factoryName` field has `autoFocus` on page mount
- [ ] `companyCode` field has helper text indicating it is optional
- [ ] `owner` role is NOT present in role selector options
- [ ] Role constraint notice appears when `companyCode.trim()` is non-empty and role is not attendance/operator
- [ ] Password field has `autoComplete="new-password"`, `minLength={12}`
- [ ] Confirm password field has `autoComplete="new-password"`
- [ ] Password show/hide toggle uses sentence case ("Show" / "Hide") — NOT uppercase tracking
- [ ] Phone number field uses `<Phone>` icon (or equivalent), NOT `<Mail>` icon
- [ ] Phone number field has `type="tel"`, `inputMode="tel"`, `autoComplete="tel"`
- [ ] Submit button has `isBusy` loading state with spinner; disabled during loading
- [ ] Error zone uses `--status-danger-bg/fg/border` semantic token classes
- [ ] Footer sign-in link uses `text-action-primary` class — NOT `text-[var(--accent)]`
- [ ] Footer label uses sentence case — NOT uppercase tracking
- [ ] `FieldSection` grouping renders with subtle divider + section label in sentence case

**Acceptance Criteria — Phase 2:**
- [ ] Phase 2 is rendered in place of the form (exclusive state — form NOT shown simultaneously)
- [ ] All eyebrow labels in success state use sentence case — NOT uppercase tracking
- [ ] Status chip on pending identity card uses `--type-label` (12px, 500 weight), sentence case
- [ ] Email in pending identity card uses `--type-body` (14px, 600 weight)
- [ ] Verification link (preview mode) is clearly actionable — link button with ArrowRight icon
- [ ] Resend button shows `isBusy` state immediately on click
- [ ] Resend status message appears below the resend row when non-null
- [ ] Sign-in link uses `text-action-primary` class — NOT raw token reference

### 4.3 Zone Interaction Rules

```yaml
zone_interactions:
  - trigger: user selects a role in the role selector (right panel)
    effect: Left Context Panel → role authority card updates with new role label + role detail text
    reason: left panel reflects the current registration intent; reactive update keeps context aligned

  - trigger: success !== null (form submitted successfully)
    effect: Right Form Panel → switches from form to success state; Left Context Panel → step 1 marked
      completed, step 2 highlighted as active; role authority card hidden; verification summary shown
    reason: two-phase state machine — form phase and success phase are mutually exclusive visual states

  - trigger: delivery_mode === "email"
    effect: Right Form Panel success state → shows inbox-check instructions; status panel uses
      success tone (green semantic tokens)
    reason: email was delivered successfully; user must check inbox to complete activation

  - trigger: delivery_mode === "preview"
    effect: Right Form Panel success state → shows clickable verification link panel; status panel
      uses info tone (surface-selected + border-focus)
    reason: local/staging environment; developer can click directly to verify without email

  - trigger: delivery_mode === "email_failed"
    effect: Right Form Panel success state → shows warning tone status panel; resend CTA is primary
      instruction; instructs user to wait and retry
    reason: email delivery infrastructure failed; account is saved but not yet verifiable

  - trigger: error === HTTP 409 (email already registered)
    effect: Right Form Panel → error zone shows "Email is already registered." with sign-in CTA link
    reason: user may have forgotten they already registered; direct path to sign-in reduces friction

  - trigger: error === HTTP 403 (high role on existing org)
    effect: Right Form Panel → error zone shows constraint message; no role authority indicator
    reason: backend rejected the request; user needs to understand why and what to do next

  - trigger: companyCode.trim() is non-empty AND selected role is admin/manager/supervisor
    effect: Right Form Panel → role constraint notice appears inline below role selector
    reason: proactive prevention of guaranteed 403 failure; surface constraint before submit is attempted

  - trigger: viewport width < 1024px
    effect: Left Context Panel → hidden entirely; Right Form Panel → 100% width, vertically aligned
    reason: mobile users need the form only; context panel is desktop-exclusive

  - trigger: searchParams.get("next") is a valid path
    effect: Right Form Panel → redirect notice appears in both form phase and success phase
    reason: user was sent to register for a specific purpose; context is maintained throughout
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

### 5.1 Scan Flow

```
SCAN LEVEL 1 (0–200ms): Organization / Company name field (first field, autoFocus)
→ Operational necessity: This is the first data point that identifies the factory context.
  For a first-time owner, naming the factory is the first real act. autoFocus ensures
  the cursor is already here on page load — no click required at shift-start equivalent.

SCAN LEVEL 2 (200ms–1s): Name + email + role fields (FieldSection 2)
→ Operational necessity: Personal identity and role intent are the next sequential inputs.
  The operator scans down the form naturally through the grouped sections.
  Role selector is the only non-trivial decision on this form.

SCAN LEVEL 3 (1s–3s): Password fields + Submit button
→ Operational necessity: Credential creation requires care (minimum 12 chars, confirmation match).
  The submit button must be the bottom of the visible form — no hunting required.
  Error message zone appears here if validation fails.

SCAN LEVEL 4 (3s+): Company code + phone fields; footer sign-in link
→ Operational necessity: These are optional or secondary. Company code is only relevant for
  users joining an existing factory. Phone is optional. The sign-in escape hatch is needed
  only by users who accidentally landed on register when they meant login.
```

### 5.2 Persistent Visibility Requirements

- Submit button: must remain at the bottom of the form without scrolling on typical viewport heights (700px+); if viewport is shorter, allow vertical scroll but submit must be reachable
- Error message zone: must appear immediately above or below the submit button — operator must see it without scrolling after a failed submit
- Role constraint notice: must be visible inline after the role selector — must not require scrolling to see when role and company code combination triggers it

### 5.3 Contextual Visibility Rules

```yaml
- condition: success === null (form phase)
  shows: Registration form (all FieldSections + submit button)
  hides: Success state entirely
  reason: form and success are mutually exclusive

- condition: success !== null (success phase)
  shows: Success state (status panel + instructions + resend)
  hides: Registration form entirely
  reason: form is no longer actionable after submission

- condition: companyCode.trim().length > 0 AND selectedRole NOT IN [attendance, operator]
  shows: Role constraint notice below role selector
  hides: nothing
  reason: proactive gate against guaranteed backend rejection

- condition: delivery_mode === "preview"
  shows: Preview verification link panel with clickable link button
  hides: Standard inbox instructions (replace with preview-mode instructions)
  reason: developer preview environment needs direct link access

- condition: success.verification_link !== null
  shows: Preview link panel in success state
  hides: nothing (additive)
  reason: link is only present in preview mode

- condition: resendStatus is non-null after resend attempt
  shows: Resend status message below resend row
  hides: nothing (additive, fades in)
  reason: feedback on async resend action

- condition: searchParams.get("next") is a valid non-trivial path
  shows: Redirect context notice in both form phase and success phase
  hides: nothing
  reason: user needs to know why they're registering (they were redirected here)

- condition: viewport width < 1024px
  shows: Right Form Panel at 100% width
  hides: Left Context Panel entirely
  reason: mobile-first form completion priority
```

---

## 6. TABLE & DATA STRATEGY

*Not applicable — no tables exist in the registration workspace.*

---

## 7. FORM & INPUT STRATEGY

### 7.1 Form Role
- **Form Purpose:** Captures the organizational context, personal identity, role authority, and security credentials for a new factory user, then creates a `PendingRegistration` record that is activated upon email verification.
- **Completion Frequency:** Once per user lifecycle. Not a repeated-use form.
- **Keyboard Efficiency Priority:** MEDIUM — the form has 8 fields, some optional. Tab order matters but this is not a speed-critical form like login. Users will read each field carefully.
- **AI Assistance Available:** No.

### 7.2 Field Group Architecture

```yaml
field_groups:
  - group: Organization
    purpose: Identify the factory context — new org or joining existing org
    fields:
      - name: factoryName
        label: "Organization / company"
        type: text
        required: yes
        validation: min_length=2, max_length=255
        ai_assisted: no
        keyboard_tab_order: 1
        default_value: none
        help_text: none
        attributes:
          autoFocus: yes
          autoComplete: organization
          placeholder: "Shree Steel Rolling Works"
      - name: companyCode
        label: "Company code"
        type: text
        required: no
        validation: max_length=32; only alphanumeric + hyphens
        ai_assisted: no
        keyboard_tab_order: 2
        default_value: none
        help_text: "Optional — enter if joining an existing factory"
        attributes:
          autoComplete: off
          placeholder: "Optional verification code"

  - group: Account
    purpose: Define the user's identity within the factory system
    fields:
      - name: name
        label: "Full name"
        type: text
        required: yes
        validation: min_length=2, max_length=120
        ai_assisted: no
        keyboard_tab_order: 3
        default_value: none
        help_text: none
        attributes:
          autoComplete: name
          placeholder: "Aman Patel"
      - name: email
        label: "Work email"
        type: email
        required: yes
        validation: valid email format (browser native + backend EmailStr)
        ai_assisted: no
        keyboard_tab_order: 4
        default_value: none
        help_text: none
        attributes:
          autoComplete: email
          inputMode: email
          placeholder: "ops.admin@factory.com"
      - name: role
        label: "Factory role"
        type: select
        required: yes
        validation: must be one of [admin, manager, supervisor, operator, attendance] — owner excluded
        ai_assisted: no
        keyboard_tab_order: 5
        default_value: "admin"
        help_text: none
        options:
          - value: admin, label: "Factory admin"
          - value: manager, label: "Operations manager"
          - value: supervisor, label: "Shift supervisor"
          - value: operator, label: "Production operator"
          - value: attendance, label: "Attendance operator"
        inline_constraint_notice: shown when companyCode is non-empty AND role NOT IN [attendance, operator]

  - group: Security
    purpose: Set the operator's authentication credentials
    fields:
      - name: password
        label: "Password"
        type: password (toggleable)
        required: yes
        validation: min_length=12, max_length=128 (client enforces before submit)
        ai_assisted: no
        keyboard_tab_order: 6
        default_value: none
        help_text: "Minimum 12 characters"
        attributes:
          autoComplete: new-password
          placeholder: "Minimum 12 characters"
        toggle: show/hide button, sentence case labels "Show" / "Hide"
      - name: confirmPassword
        label: "Confirm password"
        type: password (toggleable)
        required: yes
        validation: must match password field value
        ai_assisted: no
        keyboard_tab_order: 7
        default_value: none
        help_text: none
        attributes:
          autoComplete: new-password
          placeholder: "Repeat access password"
        toggle: show/hide button, sentence case labels "Show" / "Hide"

  - group: Contact (optional)
    purpose: Capture optional phone number for operational notifications
    fields:
      - name: phoneNumber
        label: "Operations phone"
        type: tel
        required: no
        validation: international phone format if provided (client validates via validatePhoneNumber utility)
        ai_assisted: no
        keyboard_tab_order: 8
        default_value: none
        help_text: "Optional — used for SMS notifications"
        attributes:
          autoComplete: tel
          inputMode: tel
          type: tel
          placeholder: "+91 98765 43210"
        icon: Phone icon (NOT Mail icon — this is a phone field)
```

### 7.3 Validation Strategy

```yaml
validation:
  inline_realtime:
    - confirmPassword: shows match/mismatch indicator when both password + confirmPassword have values
  on_blur: []
  on_submit:
    - factoryName: required, min_length=2 (browser native via required + minLength attributes)
    - name: required, min_length=2
    - email: required, valid email format (browser native type=email + required)
    - password: required, min_length=12 (client checks before submit to avoid round-trip)
    - confirmPassword: must match password field value (client check)
    - phoneNumber: when non-empty, must pass validatePhoneNumber() — show inline error before submit
    - companyCode + factoryName: when companyCode provided, both must be submitted together
  server_side:
    - HTTP 409 → "Email is already registered." — show with sign-in CTA
    - HTTP 400 (company code mismatch) → "Company code does not match factory name."
    - HTTP 400 (invalid company code) → "Invalid company code."
    - HTTP 400 (password too weak) → server message text
    - HTTP 403 (owner role) → "Owner accounts cannot be created from public registration."
    - HTTP 403 (high role on existing org) → "Public registration is limited to attendance accounts. Ask an admin or owner to invite higher roles."
  ai_flagged: []
```

### 7.4 Keyboard Flow

```
Tab Order: [factoryName] → [companyCode] → [name] → [email] → [role] → [password] →
           [confirmPassword] → [phoneNumber] → [Submit button]

Shortcuts:
- Enter in any field: advances to next field (except last field — Enter submits)
- Enter in phoneNumber (last field): submits form if not loading
- Escape: no global escape action defined (auth pages have no navigation state to escape)

Show/Hide password toggle: accessible via Tab after each password input field.
Sign-in footer link: accessible via Tab after submit button.
```

---

## 8. AI & AUDIT VISIBILITY STRATEGY

### 8.1 AI Placement Map
Not applicable — no AI systems are involved in the registration workflow.

### 8.2 Audit Visibility Map

```yaml
audit:
  timeline_placement: not displayed — registration audit events
    (PUBLIC_SIGNUP_PENDING_VERIFICATION, USER_REGISTERED_VERIFIED,
    PUBLIC_SIGNUP_PENDING_VERIFICATION_EMAIL_FAILED) are written to AuditLog
    on the backend but are not surfaced in the registration UI.
  events_shown: none in the UI
  detail_level: n/a
  who_can_see: n/a — admin/owner via premium audit trail only after account activation
  realtime_updates: n/a
```

### 8.3 Anomaly Visibility
Not applicable — no anomaly system on the registration workspace.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

### 9.1 Density Mode

```yaml
default_density: default
density_justification: Auth pages are not operational data workspaces. Registration is a
  deliberate, careful interaction. Default density (40px input height, 16px field gap) provides
  comfortable, error-resistant targets. This form has 8 fields which is more than login —
  default density prevents the form from feeling cramped without requiring scroll on standard screens.
density_switchable: no — auth pages do not expose the density toggle
density_specs:
  form_field_gap:
    default: 16px (--space-md) between Field components within a FieldSection
  field_section_gap:
    default: 24px (--space-lg) between FieldSection groups
  input_height:
    default: 40px minimum
  button_height:
    default: 42px (consistent with login and all factory-auth-cta elements)
```

### 9.2 Spacing Rhythm

```yaml
spacing:
  panel_outer_padding: 32px (--space-8) horizontal, 28px vertical
    (slightly less vertical than login because form is taller — needs to breathe on short viewports)
  panel_inner_gap: 20px (--space-5) between panel header and form body
  field_section_gap: 24px (--space-lg) between FieldSection dividers
  field_group_gap: 16px (--space-md) between Field components within a section
  role_constraint_notice_margin: 8px (--space-sm) top margin from role selector
  error_zone_margin_top: 16px (--space-md) above submit button
  footer_margin_top: 16px (--space-md) above footer divider
  redirect_notice_margin_bottom: 16px (--space-md) below redirect notice before form
  topbar_height: 56px (--space-14) — identical to login
  left_panel_padding: 40px (--space-10) horizontal, 40px vertical on desktop
```

### 9.3 Typography Hierarchy

```yaml
typography:
  topbar_brand_label: 16px / 600 weight / sentence case / tracking: -0.01em
  topbar_meta_labels: 12px / 500 weight / sentence case / tracking: 0em
  left_eyebrow: 12px / 500 weight / sentence case / text-text-tertiary / tracking: 0em
  left_title: 18px / 600 weight / sentence case / tracking: -0.01em
  left_description: 14px / 400 weight / text-text-secondary
  left_step_labels: 14px / 500 weight / sentence case
  left_step_descriptions: 13px / 400 weight / text-text-secondary
  panel_badge: 12px / 500 weight / sentence case / tracking: 0em
  panel_title: 16px / 600 weight / sentence case
  panel_description: 14px / 400 weight / text-text-secondary
  field_label: 12px / 500 weight / sentence case — (--type-label)
  field_helper: 12px / 400 weight / text-text-tertiary
  input_text: 14px / 400 weight
  role_constraint_notice: 13px / 400 weight / text-status-warning-fg
  error_message: 13px / 400 weight / text-status-danger-fg
  submit_button: 14px / 500 weight / sentence case
  footer_label: 14px / 400 weight / text-text-secondary / sentence case
  success_eyebrow: 12px / 500 weight / sentence case / text-text-tertiary — NOT uppercase tracking
  success_title: 16px / 600 weight / sentence case — (--type-panel-title)
  success_body: 14px / 400 weight / text-text-secondary
  pending_email: 14px / 600 weight / text-text-primary
  status_chip: 12px / 500 weight / sentence case — NOT uppercase tracking
  instruction_steps: 13px / 400 weight / text-text-secondary
```

### 9.4 Surface Hierarchy

```yaml
surfaces:
  workspace_background: var(--surface-app)
  auth_shell: var(--surface-shell)
  left_panel: var(--surface-panel)
  right_panel_bg: var(--surface-app) (or transparent — form panel floats above shell bg)
  form_panel_inner: var(--surface-card)
  input_surface: var(--surface-elevated)
  role_constraint_notice: var(--status-warning-bg) with var(--status-warning-border) border
  error_zone: var(--status-danger-bg) with var(--status-danger-border) border
  redirect_notice: var(--surface-selected) with var(--border-focus) border
  success_email_panel: var(--surface-panel) with var(--border-default) border
  success_preview_link: var(--surface-selected) with var(--border-focus) border
  instruction_steps_bg: var(--surface-shell) with var(--border-default) border
  resend_status_bg: var(--surface-shell) with var(--border-default) border
```

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

### 10.1 Desktop Workstation (Primary)

```yaml
desktop_workstation:
  min_width: 1280px
  optimal_width: 1440px
  all_zones_visible: yes (left panel + right form panel)
  density_mode: default
  form_inner_max_width: 520px (centered in 55% right column)
```

### 10.2 Compact Desktop (Secondary)

```yaml
compact_desktop:
  width: 1024px — 1279px
  adaptations:
    - left_panel: remains visible but inner padding reduces to 24px horizontal
    - right_panel: inner max-width reduces to 480px
    - field_section_gap: reduces to 20px
  density_mode: default
```

### 10.3 Mobile / Tablet (Degradation)

```yaml
mobile:
  width: <1024px
  strategy: stack — left panel hidden, right form panel fills full width
  primary_zone_only: yes (right form panel only)
  zones_hidden: [Left Context Panel]
  touch_adjustments:
    - min_touch_target: 44px for all interactive elements
    - input_height: 44px minimum (larger touch target than desktop 40px)
    - submit_button_height: 48px (full-width, comfortable tap target)
    - role_selector: native select is acceptable on mobile (no custom overlay needed)
    - password_toggle_min_width: 44px
```

### 10.4 Rail Collapse Behavior

```yaml
rail_collapse:
  left_rail:
    collapse_trigger: viewport width < 1024px
    collapsed_state: hidden (display: none, width: 0)
    operator_reinvoke: not applicable — panel is context-only, not interactive
  right_rail:
    not_applicable: registration workspace has no right rail
```

---

## 11. COMPONENT MAPPING

```yaml
component_mapping:
  workspace_container:
    component: AuthWorkstationShell
    reason: All auth-shell pages use this container. Established in login skeleton.
    props_needed:
      - badge: "Factory access provisioning"
      - title: "Create account" (drives the right panel heading)
      - description: "..." (right panel sub-description)
      - leftEyebrow: "Factory onboarding channel" (sentence case)
      - leftTitle: "Establish factory access" (sentence case, sentence case only)
      - leftDescription: descriptive text (sentence case)
      - steps: [{title, description}] × 3 — controlled, updates in success phase
      - supportTitle: reactive to selectedRole (role label)
      - supportDescription: role-aware description
      - supportItems: [{icon, text}] × 3 (security posture bullets)
      - metrics: [{label, value}] × 2 — Verification mode + Provisioning role

  forms:
    - form: Registration form (phase 1)
      component: HTML <form> element with system Field/Label/Input primitives
      field_components:
        - FieldSection: groups Organization / Account / Security / Contact sections
        - Field: wraps each input with validation state propagation
        - Label: system Label primitive (htmlFor linked to input id) — sentence case
        - Input: system Input primitive for text/email/tel/password types
        - Select: system Select or Field + native select for role selector
        - HelperText: for companyCode helper + phoneNumber helper
        - Button (variant="primary"): submit button, full width, h-[42px]
        - Button (variant="outline"): resend email button in success state

  status_elements:
    - element: Error message zone
      component: StatusMessage or inline div using semantic token classes
      variant: error (--status-danger-bg/fg/border)
    - element: Role constraint notice
      component: StatusMessage or inline div using semantic token classes
      variant: warning (--status-warning-bg/fg/border)
    - element: Success status panel (delivery_mode variants)
      component: StatusMessage or inline div with tone-based semantic tokens
      variant: success (email) / info (preview) / warning (email_failed)
    - element: Status chip on pending identity card
      component: Badge
      variant: semantic — uses sentence case label; no uppercase tracking

  navigation_elements:
    - element: Sign-in footer link
      component: Link (Next.js)
      styling: text-action-primary token class (NOT raw var reference)
    - element: Verification link button (preview mode)
      component: Link (Next.js) or <a> styled as button
      icon: ArrowRight (lucide)

  ai_elements: []
```

**Missing Components:**
- `FieldSection` — the `FieldSection` grouping primitive described in `FRONTEND_MODERNIZATION_EXECUTION_BLUEPRINT.md` Section 5.5 (`FieldSection` with `title` + `description` + divider). If not yet built, registration form uses a manual divider + label pattern as a fallback — but `FieldSection` must be created before final implementation.
- Inline `RoleConstraintNotice` — currently no system component for inline constraint notices within form fields. This can be implemented as a `StatusMessage` variant with `warning` tone, rendered immediately below the role selector. No new component required if `StatusMessage` supports inline placement.

---

## 12. OPERATIONAL UX PROBLEMS SOLVED

```yaml
problem_resolutions:
  - problem: FieldLabel uses uppercase tracking-[0.18em] — violates typography governance
    root_cause: FieldLabel is a local inline component that bypasses the system Label primitive
      and adds its own className with forbidden tracking/uppercase
    skeleton_solution: Section 7.2 mandates system Field → Label → Input pattern for all fields;
      Section 9.3 specifies all field labels at 12px/500 weight/sentence case/tracking 0em;
      Section 11 removes local FieldLabel from component mapping
    measurable_outcome: Zero uppercase labels in the registration form; label tracking ≤ 0.06em

  - problem: Password show/hide toggle uses uppercase tracking-[0.16em]
    root_cause: Toggle button has hardcoded className with uppercase + tracking — copied from
      existing auth patterns without governance check
    skeleton_solution: Section 7.2 specifies show/hide toggle with sentence case "Show" / "Hide";
      Section 9.3 specifies toggle text at sentence case; Section 4.2 Zone acceptance criteria
      explicitly require sentence case on toggle
    measurable_outcome: Toggle renders "Show" / "Hide" in sentence case with tracking ≤ 0.06em

  - problem: Success state eyebrow labels use uppercase tracking-[0.22em] in 5+ locations
    root_cause: Success state panels copy-pasted a label pattern from marketing-style headers
      without governance review; 0.22em tracking is more than 3× the allowed maximum
    skeleton_solution: Section 9.3 specifies success_eyebrow at 12px/500 weight/sentence case;
      Section 4.2 Zone acceptance criteria require sentence case on all success state labels;
      Section 7.4 typography hierarchy explicitly bans uppercase tracking > 0.06em
    measurable_outcome: All success state eyebrow labels render in sentence case, no tracking

  - problem: Sign-in link uses text-[var(--accent)] raw token reference
    root_cause: Developer used raw CSS variable inline style syntax instead of token class system
    skeleton_solution: Section 4.2 and Section 11 both specify text-action-primary token class
      for all sign-in links; Section 1.3 explicitly flags this as a violation
    measurable_outcome: Sign-in link uses text-action-primary class; no raw var() references

  - problem: owner role available in selector but backend returns HTTP 403 for owner registrations
    root_cause: roleOptions array includes owner as a valid option; no backend-alignment check
      was performed when the selector was built
    skeleton_solution: Section 7.2 field group for role explicitly states owner is excluded;
      Section 3.6 permission matrix marks owner as unavailable in selector; Section 4.2
      acceptance criteria require owner to NOT be present in role options
    measurable_outcome: Zero users receive HTTP 403 due to owner role selection; the option
      is not available to select

  - problem: Phone number field uses Mail icon instead of Phone icon
    root_cause: Icon was copy-pasted from the email field without updating to the correct icon
    skeleton_solution: Section 7.2 field group for phoneNumber explicitly specifies Phone icon;
      Section 4.2 acceptance criteria require Phone icon (NOT Mail) for phone field
    measurable_outcome: Phone field has correct semantic icon at all times

  - problem: No proactive role constraint notice for users joining existing factories
    root_cause: The constraint (attendance/operator only for public registration) was only
      surfaced as a backend error after form submission; no frontend pre-validation existed
    skeleton_solution: Section 4.3 zone interactions define the companyCode + high-role trigger;
      Section 7.3 validation includes the client-side role constraint logic; Section 4.2 acceptance
      criteria require the notice to appear inline below the role selector before submit
    measurable_outcome: Users selecting manager/supervisor with a company code see the constraint
      notice before attempting to submit; HTTP 403 errors for this case drop to near zero

  - problem: Fields use grid-cols-2 without logical grouping — context-disconnected layout
    root_cause: All 8 fields were placed in a flat 2-column grid without workflow sequence logic;
      the display order was spatial, not cognitive
    skeleton_solution: Section 7.2 defines 4 FieldSection groups with explicit operational purpose;
      Section 9.2 specifies 24px section gap between groups; Section 11 includes FieldSection
      in component mapping
    measurable_outcome: Form reads as a logical workflow sequence; related fields are visually
      grouped; role detail is contextual to the role selector, not in a separate card

  - problem: Role description card is disconnected from the role selector — layout fragmentation
    root_cause: The role detail was rendered in a separate "Operational onboarding" card below
      the form grid, far from the selector that controls its content
    skeleton_solution: Role detail is moved to the Left Context Panel as a reactive card that
      updates when the role selector changes (Section 4.2 Left Context Panel, Section 4.3
      zone interactions); the separate card below the form is eliminated
    measurable_outcome: Role detail is always contextually adjacent to the selector (in the
      left panel); the right panel form is cleaner, with no disconnected informational card
```

---

## 13. IMPLEMENTATION HANDOFF NOTES

### 13.1 Implementation Order

```yaml
implementation_sequence:
  1: Build AuthWorkstationShell phase-state support — the shell must accept a `phase`
     prop ("form" | "success") that drives which step is highlighted in the left panel
     and which card appears in the left context area (role authority vs. verification summary)
  2: Remove owner from roleOptions array — single-line change, prevents HTTP 403 entirely
  3: Replace FieldLabel local component with system Label primitive — update all 8 fields
  4: Implement FieldSection grouping — 4 groups with divider + label
  5: Fix phone field icon from Mail to Phone icon
  6: Add password min-length client validation (length check before submit, not just on blur)
  7: Add confirmPassword realtime match indicator
  8: Add role constraint notice (companyCode + high-role trigger) — inline below role selector
  9: Fix all success state eyebrow labels from uppercase tracking to sentence case
  10: Fix sign-in links from text-[var(--accent)] to text-action-primary
  11: Fix password show/hide toggle from uppercase to sentence case
  12: Add autoFocus to factoryName field
  13: Wire left panel role authority card to react to role selector changes
  14: Implement responsive collapse (left panel hides at <1024px)
```

### 13.2 Critical Constraints

```yaml
critical_constraints:
  - "Do NOT add owner to the role selector under any circumstances — backend hard-rejects it with HTTP 403"
  - "The registration form and success state are exclusive phases — never render both simultaneously"
  - "Do NOT modify AuthWorkstationShell container structure — only extend it with phase prop"
  - "All field labels must use sentence case — NO uppercase tracking, period"
  - "Phone field must use type='tel', inputMode='tel', autoComplete='tel' for mobile keyboard optimization"
  - "Password field must have autoComplete='new-password' (not current-password) — prevents browser autofill of existing credentials"
  - "Company code + factory name must both be present when company code is submitted — enforce before POST"
  - "Do NOT show verification_link to users unless delivery_mode === 'preview' — never expose verification tokens in production"
  - "PendingRegistration TTL is EMAIL_VERIFICATION_TTL_HOURS (default 24h) — do not promise permanent pending state to users"
  - "All surfaces must reference CSS token variables, not hex or rgba values"
```

### 13.3 Open Questions

```yaml
open_questions:
  - question: >
      Does AuthWorkstationShell currently support reactive step state (completed/active
      indicators per step based on a phase prop)? Or does it require a new prop to be added?
    blocking: yes — needed for left panel to reflect form vs. success phase progression
    needs_answer_from: frontend team (inspect auth-workstation-shell.tsx component)

  - question: >
      Is FieldSection (from FRONTEND_MODERNIZATION_EXECUTION_BLUEPRINT.md Section 5.5)
      already built as a component in the shared primitives, or does it need to be created
      before this form can use it?
    blocking: yes — form grouping architecture depends on this primitive
    needs_answer_from: frontend team (search shared/primitives for FieldSection)

  - question: >
      The role constraint notice (for users providing a company code with high-role selection)
      requires knowing whether the provided company code points to an existing org. Currently
      this validation only happens server-side. Should the frontend make a lightweight
      check (e.g., GET /auth/company-code-preview) to detect this earlier, or should the
      notice appear based on the presence of any non-empty company code + high role, as a
      conservative proxy?
    blocking: no — conservative proxy (show notice whenever companyCode + high role) is safe
      and prevents HTTP 403 in most real cases; a dedicated endpoint is a future enhancement
    needs_answer_from: backend team / product owner

  - question: >
      The success state `pending_factory_name` from RegisterResponse is currently not
      displayed anywhere in the UI. Should it be shown in the success state (e.g., in the
      "Pending identity" card alongside the email address)?
    blocking: no
    needs_answer_from: product owner
```

---

## ACCEPTANCE CRITERIA (OVERALL SPEC)

The spec is considered COMPLETE and ready for Kiro implementation when:

- [x] All 13 sections are fully populated — no empty fields, no placeholders
- [x] Every layout zone has explicit acceptance criteria
- [x] Every component is mapped to an existing primitive or flagged as new (FieldSection flagged)
- [x] Every operational problem from Section 1.3 has a resolution in Section 12
- [x] No anti-patterns present (no gradients, no glow, no pulsing, no UPPERCASE labels, no marketing typography)
- [x] All measurements follow the 4px spacing scale
- [x] All surfaces reference token variables, not hex values
- [x] Typography follows FRONTEND_MODERNIZATION_EXECUTION_BLUEPRINT.md exactly
- [x] Backend API endpoints are verified to exist (POST /auth/register confirmed in auth.py, lines 630–940)
- [x] Permission matrix is complete and drives zone visibility rules
- [x] Open questions section is populated (3 questions, 1 blocking)
- [x] Implementation handoff notes are present

---

## POST-GENERATION SELF-VALIDATION

```yaml
self_validation_checklist:
  operational_integrity:
    - [x] Every layout zone traced to a backend entity or API (form → POST /auth/register;
        success state → RegisterResponse fields; left panel → reactive to role selector state)
    - [x] Every zone justified by operator need (form zone = account creation; left panel =
        reduce anxiety for first-time factory setup; success zone = verification guidance)
    - [x] No zones exist for aesthetic reasons — role authority card in left panel was retained
        only because it solves the disconnect between role selector and role description

  law_compliance:
    - [x] Every spacing value follows 4px scale (16px, 20px, 24px, 28px, 32px, 40px)
    - [x] Every surface references a CSS token variable (surface-app, surface-shell, surface-panel,
        surface-card, surface-elevated, status-warning-bg, status-danger-bg, surface-selected)
    - [x] Every text label is in sentence case — no uppercase anywhere in spec
    - [x] Every font specification from approved type system (--type-label 12px/500,
        --type-body 14px/400, --type-panel-title 16px/600, --type-page-title 18px/600)
    - [x] All AI elements: N/A — no AI systems on this workspace

  kiro_readiness:
    - [x] Implementation sequence is clear (14-step sequence in Section 13.1)
    - [x] All acceptance criteria are testable (checkboxes with specific, measurable outcomes)
    - [x] Blocking open questions flagged (1 blocking: AuthWorkstationShell phase support)

  anti_pattern_check:
    - [x] No gradients specified anywhere
    - [x] No glow effects specified anywhere
    - [x] No pulsing on non-loading elements
    - [x] No UPPERCASE labels (every label explicitly specified as sentence case)
    - [x] No marketing typography (no clamp(), no hero sizing, no >18px headings)
    - [x] No invented workflows — all behaviors traced to actual auth.py backend code
    - [x] No fake data or placeholder APIs — all endpoints verified in auth.py
```

---

## KIRO TASK CHAINING

After this spec is APPROVED, the following Kiro tasks can be created from it:

```yaml
downstream_kiro_tasks:
  task_1:
    name: "Register — AuthWorkstationShell Phase Extension"
    input: This spec → Section 13.1 (step 1) + Section 4.3 (zone interactions)
    output: AuthWorkstationShell extended with phase prop driving left panel step state

  task_2:
    name: "Register — Field System Migration"
    input: This spec → Section 7.2 (field group architecture) + Section 11 (component mapping)
    output: All 8 fields migrated from local FieldLabel/IdentityField primitives to system
      Field → Label → Input pattern with correct autoComplete, htmlFor, and icon assignments

  task_3:
    name: "Register — FieldSection Grouping Implementation"
    input: This spec → Section 7.2 (groups) + Section 9.2 (spacing rhythm)
    output: 4 FieldSection groups with section labels and 24px gaps; linear form layout
      replaces flat 2-column grid

  task_4:
    name: "Register — Role Constraint Logic"
    input: This spec → Section 7.3 (validation) + Section 4.3 (zone interactions)
    output: Owner removed from role options; inline role constraint notice when
      companyCode + high-role combination is detected

  task_5:
    name: "Register — Typography Governance Fixes"
    input: This spec → Section 1.3 (current problems) + Section 9.3 (typography hierarchy)
    output: All uppercase tracking violations eliminated; all labels in sentence case;
      all raw token references replaced with token classes

  task_6:
    name: "Register — Success State Rebuild"
    input: This spec → Section 4.2 (Right Form Panel phase 2) + Section 9.3 (typography)
    output: Success state panels with sentence case labels, semantic token surfaces,
      reactive left panel phase indicator, and resend button loading state

  task_7:
    name: "Register — Responsive Behavior"
    input: This spec → Section 10 (responsive strategy)
    output: Left panel hidden at <1024px; right panel fills full width on mobile;
      touch targets at 44px minimum on mobile
```

Each downstream task references THIS spec as its source of truth.
Kiro must not deviate from this spec without creating a spec amendment.

---

*End of WORKSPACE_SKELETON_REGISTER.md (sections 1–13)*
*This file is system-generated architecture. Treat as engineering law until formally amended.*
*Architectural precedent established: FieldSection grouping pattern, phase-state AuthWorkstationShell, role constraint inline notices*

---

## 14. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

> Operational wireframe architecture for the `/register` workspace.
> This section communicates structural anatomy, component hierarchy, attention flow,
> spacing rhythm, and responsive behavior. It is NOT visual design. It IS structural law.

---

### 14A. Desktop Structural Blueprint

#### Phase 1 — Form Entry State (desktop ≥1024px)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  TOPBAR                                                          height: 56px    │
│  [Building2 icon] DPR.ai                    Steel industry · Factory OS          │
│  └─ brand anchor, links to /               └─ text-text-secondary / text-action  │
├─────────────────────────┬────────────────────────────────────────────────────────┤
│  LEFT CONTEXT PANEL     │  RIGHT FORM PANEL                                      │
│  width: 45%             │  width: 55%  (inner max-width: 520px, centered)        │
│  surface-panel          │  surface-app                                           │
│  padding: 40px          │  padding: 32px horizontal, 28px vertical               │
│  · · · · · · · · · · ·  │  · · · · · · · · · · · · · · · · · · · · · · · · · ·  │
│                         │                                                        │
│  [eyebrow]              │  ┌─────────────────────────────────────────────────┐  │
│  Factory onboarding     │  │  FORM PANEL INNER                surface-card   │  │
│  channel                │  │  ┌───────────────────────────────────────────┐  │  │
│  12px/500/tertiary       │  │  │ PANEL HEADER                              │  │  │
│                         │  │  │ [chip] Factory access provisioning        │  │  │
│  [page title]           │  │  │        12px/500/sentence case             │  │  │
│  Establish factory      │  │  │                                           │  │  │
│  access                 │  │  │ [h2] Create account                       │  │  │
│  18px/600               │  │  │      16px/600 — panel title scale         │  │  │
│                         │  │  │                                           │  │  │
│  [description]          │  │  │ [desc] Configure organization…            │  │  │
│  14px/400/secondary     │  │  │        14px/400/text-secondary            │  │  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │  │  └───────────────────────────────────────────┘  │  │
│                         │  │  ↕ 20px gap (--space-5)                          │  │
│  PROVISIONING STEPS     │  │  ┌───────────────────────────────────────────┐  │  │
│  surface-shell          │  │  │ REDIRECT NOTICE (conditional)             │  │  │
│  ┌────────────────────┐ │  │  │ surface-selected / border-focus           │  │  │
│  │ ● 01 completed     │ │  │  │ 14px — shown only when ?next= param set   │  │  │
│  │    Register company│ │  │  └───────────────────────────────────────────┘  │  │
│  │    identity        │ │  │  ↕ 16px gap (--space-md) if notice present      │  │
│  │                    │ │  │  ┌───────────────────────────────────────────┐  │  │
│  │ ◉ 02 active        │ │  │  │ FIELD SECTION 1 — Organization            │  │  │
│  │    Verify inbox    │ │  │  │ label: 12px/500/tertiary/sentence case    │  │  │
│  │                    │ │  │  │ ┌─────────────────────────────────────┐  │  │  │
│  │ ○ 03 pending       │ │  │  │ │ Field: Organization / company       │  │  │  │
│  │    Initialize      │ │  │  │ │ [Building2] [input 40px h]          │  │  │  │
│  │    workspace       │ │  │  │ │ autoFocus ← cursor lands here       │  │  │  │
│  └────────────────────┘ │  │  │ └─────────────────────────────────────┘  │  │  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │  │  │ ↕ 16px                                   │  │  │
│                         │  │  │ ┌─────────────────────────────────────┐  │  │  │
│  ROLE AUTHORITY CARD    │  │  │ │ Field: Company code (optional)      │  │  │  │
│  [reactive to selector] │  │  │ │ [ShieldCheck] [input 40px h]        │  │  │  │
│  surface-panel          │  │  │ │ helper: "Optional — enter if        │  │  │  │
│  ┌────────────────────┐ │  │  │ │ joining an existing factory"        │  │  │  │
│  │ [role label]       │ │  │  │ └─────────────────────────────────────┘  │  │  │
│  │ Factory admin      │ │  │  └───────────────────────────────────────────┘  │  │
│  │ 14px/500/primary   │ │  │  ↕ 24px gap (--space-lg) — FieldSection divider │  │
│  │                    │ │  │  ┌───────────────────────────────────────────┐  │  │
│  │ [role detail]      │ │  │  │ FIELD SECTION 2 — Account                 │  │  │
│  │ 13px/400/secondary │ │  │  │ ┌─────────────────────────────────────┐  │  │  │
│  └────────────────────┘ │  │  │ │ Field: Full name                    │  │  │  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │  │  │ │ [User2] [input 40px h]              │  │  │  │
│                         │  │  │ └─────────────────────────────────────┘  │  │  │
│  SECURITY POSTURE       │  │  │ ↕ 16px                                   │  │  │
│  surface-panel          │  │  │ ┌─────────────────────────────────────┐  │  │  │
│  ┌────────────────────┐ │  │  │ │ Field: Work email                   │  │  │  │
│  │ [ShieldCheck]      │ │  │  │ │ [Mail] [input 40px h]               │  │  │  │
│  │ Secure connection  │ │  │  │ └─────────────────────────────────────┘  │  │  │
│  │ active             │ │  │  │ ↕ 16px                                   │  │  │
│  │ · credential bound │ │  │  │ ┌─────────────────────────────────────┐  │  │  │
│  │ · factory metadata │ │  │  │ │ Field: Factory role                 │  │  │  │
│  │ · email-gated      │ │  │  │ │ [select 40px h ▾]                   │  │  │  │
│  └────────────────────┘ │  │  │ │  admin / manager / supervisor /     │  │  │  │
│                         │  │  │ │  operator / attendance              │  │  │  │
│                         │  │  │ │  [owner NOT present]                │  │  │  │
│                         │  │  │ └─────────────────────────────────────┘  │  │  │
│                         │  │  │ ↕ 8px                                    │  │  │
│                         │  │  │ [ROLE CONSTRAINT NOTICE — conditional]   │  │  │
│                         │  │  │ surface-warning-bg / border-warning      │  │  │
│                         │  │  │ "For existing factories, only            │  │  │
│                         │  │  │  attendance/operator roles can be        │  │  │
│                         │  │  │  registered publicly."                   │  │  │
│                         │  │  │ 13px/400/status-warning-fg               │  │  │
│                         │  │  │ visible when: companyCode + high role    │  │  │
│                         │  │  └───────────────────────────────────────────┘  │  │
│                         │  │  ↕ 24px (--space-lg) — FieldSection divider     │  │
│                         │  │  ┌───────────────────────────────────────────┐  │  │
│                         │  │  │ FIELD SECTION 3 — Security                │  │  │
│                         │  │  │ ┌─────────────────────────────────────┐  │  │  │
│                         │  │  │ │ Field: Password                     │  │  │  │
│                         │  │  │ │ [KeyRound] [input 40px h] [Show]    │  │  │  │
│                         │  │  │ │ helper: "Minimum 12 characters"     │  │  │  │
│                         │  │  │ └─────────────────────────────────────┘  │  │  │
│                         │  │  │ ↕ 16px                                   │  │  │
│                         │  │  │ ┌─────────────────────────────────────┐  │  │  │
│                         │  │  │ │ Field: Confirm password             │  │  │  │
│                         │  │  │ │ [KeyRound] [input 40px h] [Show]    │  │  │  │
│                         │  │  │ │ [match indicator inline — on change]│  │  │  │
│                         │  │  │ └─────────────────────────────────────┘  │  │  │
│                         │  │  └───────────────────────────────────────────┘  │  │
│                         │  │  ↕ 24px (--space-lg) — FieldSection divider     │  │
│                         │  │  ┌───────────────────────────────────────────┐  │  │
│                         │  │  │ FIELD SECTION 4 — Contact (optional)      │  │  │
│                         │  │  │ ┌─────────────────────────────────────┐  │  │  │
│                         │  │  │ │ Field: Operations phone             │  │  │  │
│                         │  │  │ │ [Phone] [input 40px h]  ← Phone icon│  │  │  │
│                         │  │  │ │ helper: "Optional — SMS notifs"     │  │  │  │
│                         │  │  │ └─────────────────────────────────────┘  │  │  │
│                         │  │  └───────────────────────────────────────────┘  │  │
│                         │  │  ↕ 16px (--space-md)                           │  │
│                         │  │  ┌───────────────────────────────────────────┐  │  │
│                         │  │  │ ERROR ZONE (conditional)                  │  │  │
│                         │  │  │ surface-danger-bg / border-danger         │  │  │
│                         │  │  │ 13px/400/status-danger-fg                 │  │  │
│                         │  │  │ hidden when error === null                │  │  │
│                         │  │  └───────────────────────────────────────────┘  │  │
│                         │  │  ↕ 16px (or 0 if no error)                     │  │
│                         │  │  ┌───────────────────────────────────────────┐  │  │
│                         │  │  │ SUBMIT BUTTON                             │  │  │
│                         │  │  │ [Create account]  full-width  h: 42px     │  │  │
│                         │  │  │ variant: primary / isBusy: "Creating..."  │  │  │
│                         │  │  └───────────────────────────────────────────┘  │  │
│                         │  │  ↕ 16px (--space-md)                           │  │
│                         │  │  ┌───────────────────────────────────────────┐  │  │
│                         │  │  │ FOOTER                border-top/subtle   │  │  │
│                         │  │  │ "Already have an account?"  "Sign in →"   │  │  │
│                         │  │  │ 14px/400/secondary     text-action-primary│  │  │
│                         │  │  └───────────────────────────────────────────┘  │  │
│                         │  └─────────────────────────────────────────────────┘  │
└─────────────────────────┴────────────────────────────────────────────────────────┘
```


#### Phase 2 — Success State (desktop ≥1024px)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  TOPBAR                                                          height: 56px    │
│  [Building2 icon] DPR.ai                    Steel industry · Factory OS          │
├─────────────────────────┬────────────────────────────────────────────────────────┤
│  LEFT CONTEXT PANEL     │  RIGHT FORM PANEL                                      │
│  [PHASE UPDATED]        │  [FORM HIDDEN — SUCCESS STATE SHOWN]                  │
│  · · · · · · · · · · ·  │  · · · · · · · · · · · · · · · · · · · · · · · · · ·  │
│                         │                                                        │
│  [eyebrow]              │  ┌─────────────────────────────────────────────────┐  │
│  Factory onboarding     │  │  FORM PANEL INNER                surface-card   │  │
│  channel                │  │  ┌───────────────────────────────────────────┐  │  │
│  12px/500/tertiary      │  │  │ PANEL HEADER                              │  │  │
│                         │  │  │ [chip] Verification pending               │  │  │
│  [page title]           │  │  │        (tone-variant chip)                │  │  │
│  Establish factory      │  │  │                                           │  │  │
│  access                 │  │  │ [h2] Check your inbox                     │  │  │
│  18px/600               │  │  │      16px/600 — panel title scale         │  │  │
│                         │  │  └───────────────────────────────────────────┘  │  │
│  PROVISIONING STEPS     │  │  ↕ 20px                                          │  │
│  ┌────────────────────┐ │  │  ┌───────────────────────────────────────────┐  │  │
│  │ ✓ 01 COMPLETE      │ │  │  │ REDIRECT NOTICE (conditional)             │  │  │
│  │    Register company│ │  │  │ surface-selected / border-focus           │  │  │
│  │    identity        │ │  │  │ "After verification, sign in to continue" │  │  │
│  │    [green accent]  │ │  │  └───────────────────────────────────────────┘  │  │
│  │                    │ │  │  ↕ 16px                                          │  │
│  │ ◉ 02 ACTIVE NOW    │ │  │  ┌───────────────────────────────────────────┐  │  │
│  │    Verify inbox    │ │  │  │ STATUS PANEL                              │  │  │
│  │    [active accent] │ │  │  │ Tone: success (email) /                   │  │  │
│  │                    │ │  │  │        info (preview) /                   │  │  │
│  │ ○ 03 pending       │ │  │  │        warning (email_failed)             │  │  │
│  │    Initialize      │ │  │  │ ┌─────────────────────────────────────┐  │  │  │
│  │    workspace       │ │  │  │ │ [title] Inbox verification required │  │  │  │
│  └────────────────────┘ │  │  │ │ 16px/600/primary                    │  │  │  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │  │  │ │ [detail] 14px/400/secondary         │  │  │  │
│                         │  │  │ └─────────────────────────────────────┘  │  │  │
│  VERIFICATION SUMMARY   │  │  └───────────────────────────────────────────┘  │  │
│  [replaces role card]   │  │  ↕ 16px                                          │  │
│  surface-panel          │  │  ┌───────────────────────────────────────────┐  │  │
│  ┌────────────────────┐ │  │  │ PENDING IDENTITY CARD    surface-panel    │  │  │
│  │ Delivery mode      │ │  │  │ ┌─────────────────────────────────────┐  │  │  │
│  │ Email-gated        │ │  │  │ │ ops.admin@factory.com               │  │  │  │
│  │ activation         │ │  │  │ │ 14px/600/primary                    │  │  │  │
│  │ 13px/400/secondary │ │  │  │ │              [Inbox action]         │  │  │  │
│  │                    │ │  │  │ │              chip: 12px/500/sentence│  │  │  │
│  │ Pending email:     │ │  │  │ └─────────────────────────────────────┘  │  │  │
│  │ ops.admin@...      │ │  │  └───────────────────────────────────────────┘  │  │
│  │ 13px/500/primary   │ │  │  ↕ 16px                                          │  │
│  └────────────────────┘ │  │  ┌───────────────────────────────────────────┐  │  │
│                         │  │  │ INSTRUCTIONS LIST        surface-shell    │  │  │
│  SECURITY POSTURE       │  │  │ ┌─────────────────────────────────────┐  │  │  │
│  [unchanged]            │  │  │ │ 1. Open inbox for email@...         │  │  │  │
│  surface-panel          │  │  │ │    13px/400/secondary               │  │  │  │
│  ┌────────────────────┐ │  │  │ └─────────────────────────────────────┘  │  │  │
│  │ [ShieldCheck]      │ │  │  │ ↕ 8px                                    │  │  │
│  │ Secure connection  │ │  │  │ ┌─────────────────────────────────────┐  │  │  │
│  │ active             │ │  │  │ │ 2. Activate verification email      │  │  │  │
│  └────────────────────┘ │  │  │ │    13px/400/secondary               │  │  │  │
│                         │  │  │ └─────────────────────────────────────┘  │  │  │
│                         │  │  │ ↕ 8px                                    │  │  │
│                         │  │  │ ┌─────────────────────────────────────┐  │  │  │
│                         │  │  │ │ 3. Return to sign in                │  │  │  │
│                         │  │  │ └─────────────────────────────────────┘  │  │  │
│                         │  │  └───────────────────────────────────────────┘  │  │
│                         │  │  ↕ 8px — PREVIEW LINK PANEL (conditional only) │  │
│                         │  │  ┌───────────────────────────────────────────┐  │  │
│                         │  │  │ PREVIEW LINK PANEL (delivery_mode=preview)│  │  │
│                         │  │  │ surface-selected / border-focus           │  │  │
│                         │  │  │ eyebrow: "Preview verification link"      │  │  │
│                         │  │  │          12px/500/tertiary/sentence case  │  │  │
│                         │  │  │ [Open verification page →] link-button    │  │  │
│                         │  │  │ [url text] break-all 12px/tertiary        │  │  │
│                         │  │  └───────────────────────────────────────────┘  │  │
│                         │  │  ↕ 16px                                          │  │
│                         │  │  ┌───────────────────────────────────────────┐  │  │
│                         │  │  │ RESEND ACTION ROW                         │  │  │
│                         │  │  │ [Resend email] (outline btn) [Sign in →]  │  │  │
│                         │  │  │  isBusy → "Sending..."                    │  │  │
│                         │  │  │  sign-in link: text-action-primary        │  │  │
│                         │  │  └───────────────────────────────────────────┘  │  │
│                         │  │  ↕ 8px — RESEND STATUS (conditional only)      │  │
│                         │  │  ┌───────────────────────────────────────────┐  │  │
│                         │  │  │ RESEND STATUS surface-shell/border-default│  │  │
│                         │  │  │ 13px/400/secondary — appears after resend │  │  │
│                         │  │  └───────────────────────────────────────────┘  │  │
│                         │  └─────────────────────────────────────────────────┘  │
└─────────────────────────┴────────────────────────────────────────────────────────┘
```

**Structural delta between Phase 1 and Phase 2 (right panel):**
```
REMOVED:    All 4 FieldSections + all inputs
REMOVED:    Error zone
REMOVED:    Submit button
REMOVED:    Footer "Already have an account?"
ADDED:      Status panel (tone-responsive)
ADDED:      Pending identity card
ADDED:      Instructions list
ADDED:      Preview link panel (conditional)
ADDED:      Resend action row
ADDED:      Resend status (conditional)
UNCHANGED:  Panel header (badge + title + description change content, structure stays)
UNCHANGED:  Redirect notice (conditional, same zone)
```

**Structural delta between Phase 1 and Phase 2 (left panel):**
```
UNCHANGED:  Topbar
UNCHANGED:  Eyebrow + page title + description
CHANGED:    Provisioning steps — step 1 → completed; step 2 → active
CHANGED:    Role authority card → replaced by Verification summary card
UNCHANGED:  Security posture card
```

---

### 14B. Visual Attention Flow Map

#### Phase 1 — Form Entry

```
SCAN LEVEL 1 (0–200ms): Organization / company field
────────────────────────────────────────────────────
  WHY FIRST: autoFocus places cursor here on page load.
  The user's eye and hands are already coordinated at this field.
  This is the most consequential field — wrong factory name
  causes company code mismatch errors later.

  Visual anchor: the field is the first element below the panel
  header. The panel header (chip + h2 + description) is read
  ONLY on first visit; experienced operators skip directly to
  the first input.

  ↓ (eye moves down the form sequentially)

SCAN LEVEL 2 (200ms–1s): Company code field → Full name → Work email
──────────────────────────────────────────────────────────────────────
  WHY SECOND: These fields are sequential data entry.
  No decision required. The eye tracks the form structure
  top-to-bottom, left context panel is peripheral at this point.

  Company code: optional, but scanning the helper text
  "Optional — joining existing factory" answers the question
  "do I need this?" immediately.

  ↓

SCAN LEVEL 3 (1s–3s): Factory role selector + Role constraint notice
──────────────────────────────────────────────────────────────────────
  WHY THIRD: Role is the ONE decision on this form.
  It is not data entry — it is a choice with consequences.
  The operator pauses here longer than any other field.

  If a company code is present AND a high role is selected,
  the role constraint notice appears 8px below the selector.
  This notice MUST be in the scan path at level 3 — it prevents
  a guaranteed backend failure.

  Left panel role authority card updates reactively here —
  providing context about the selected role without the operator
  needing to look elsewhere.

  ↓

SCAN LEVEL 4 (3s–8s): Password + Confirm password
───────────────────────────────────────────────────
  WHY FOURTH: Password creation is deliberate.
  Minimum 12 characters requires conscious effort.
  The match indicator on confirmPassword provides
  immediate validation feedback without a submit cycle.

  The "Show" / "Hide" toggle is accessible by Tab —
  no mouse movement needed for keyboard-first operators.

  ↓

SCAN LEVEL 5 (8s+): Phone field (optional) → Submit
─────────────────────────────────────────────────────
  WHY LAST: Phone is optional and most users skip it.
  The field is present and labeled "Optional" clearly.
  Submit button is the final destination — the eye
  lands on it after phone field is decided.

  Error zone (if present from prior failed submit) appears
  immediately ABOVE the submit button, intercepting the eye
  before it reaches the submit action.
```

#### Phase 2 — Success State

```
SCAN LEVEL 1 (0–200ms): Status panel (success/warning/info tone)
──────────────────────────────────────────────────────────────────
  WHY FIRST: The form is gone. The first visible colored surface
  is the status panel. Color communicates outcome immediately:
  green = email sent, amber = delivery failed, indigo = preview.
  The operator does not need to read text to know if it worked.

SCAN LEVEL 2 (200ms–1s): Status panel title + description
──────────────────────────────────────────────────────────
  The title ("Check your inbox" / "Open verification link" /
  "Signup saved") is 16px/600 — dominates the status panel.
  This is what the operator reads to understand their next action.

SCAN LEVEL 3 (1s–2s): Pending identity card (email address)
─────────────────────────────────────────────────────────────
  The email address confirms "yes, we registered THIS email."
  At 14px/600/primary it is the most visually heavy text in the
  success state. The operator verifies it matches what they typed.

SCAN LEVEL 4 (2s–5s): Instructions list (3 steps)
───────────────────────────────────────────────────
  Numbered steps tell the operator exactly what to do next.
  13px/400/secondary — readable but not dominant.
  Step 2 varies by delivery_mode (email vs. preview vs. failed).

SCAN LEVEL 5 (5s+): Resend action + Sign-in link
──────────────────────────────────────────────────
  Action of last resort. If the email didn't arrive,
  the operator finds the resend button here.
  Sign-in link is the exit — used after verification completes.
```

#### Persistent Visibility Requirements

```
ALWAYS IN VIEW (never scrolls away, never hides):
  ├── Submit button (Phase 1) — final action, must be reachable
  │   without scroll on viewports ≥700px tall
  ├── Error zone (Phase 1, when non-null) — appears above submit,
  │   intercepting the eye before action is taken
  └── Status panel (Phase 2) — first visible surface, tone-coded

CONTEXTUAL (appears based on state, hidden when irrelevant):
  ├── Redirect notice — only when ?next= param is set
  ├── Role constraint notice — only when companyCode + high role
  ├── Preview link panel — only when delivery_mode === "preview"
  └── Resend status message — only after resend attempt

PROGRESSIVE (appears after user interaction):
  └── confirmPassword match indicator — after both password
      fields have value (realtime feedback, not on-blur)
```

#### Destructive / Irreversible Action Placement

```
There are no destructive actions on this workspace.
Registration is additive — it creates a PendingRegistration
record. No deletion, no override, no approval required.

The submit button is the only consequential action.
Its placement (bottom of form, full width, after all fields)
ensures the operator has completed all inputs before it is
reachable by keyboard Tab flow.
```

---

### 14C. Spacing & Rhythm Visualization

```
VERTICAL RHYTHM — Phase 1 Form (top to bottom, right panel inner)
══════════════════════════════════════════════════════════════════

  ┌─ Panel outer padding top: 28px ─────────────────────────────────
  │
  │  [PANEL HEADER block]
  │    chip (12px) ↕ 8px gap → h2 (16px) ↕ 8px gap → desc (14px)
  │
  ├─ 20px gap (--space-5) ────────── header → form body transition
  │
  │  [REDIRECT NOTICE] (if present — 16px inner padding)
  │
  ├─ 16px gap (--space-md) ────────── (notice to first section)
  │  OR: 0 gap if notice absent
  │
  │  ╔═══════════════════════════════════════════════════════════╗
  │  ║  FIELD SECTION 1 — Organization              [dense]     ║
  │  ║  section label: 12px/500/tertiary                        ║
  │  ║  ↕ 8px under label                                       ║
  │  ║  [factoryName field: 40px input height]                  ║
  │  ║  ↕ 16px (--space-md) between fields                      ║
  │  ║  [companyCode field: 40px + helper 12px below]           ║
  │  ╚═══════════════════════════════════════════════════════════╝
  │
  ├─ 24px gap (--space-lg) ────────── FieldSection separator
  │  [thin border-subtle divider line spans full width]
  │
  │  ╔═══════════════════════════════════════════════════════════╗
  │  ║  FIELD SECTION 2 — Account                  [dense]     ║
  │  ║  [name] ↕16px [email] ↕16px [role select]               ║
  │  ║  ↕8px                                                    ║
  │  ║  [role constraint notice — conditional]                  ║
  │  ╚═══════════════════════════════════════════════════════════╝
  │
  ├─ 24px gap (--space-lg) ────────── FieldSection separator
  │
  │  ╔═══════════════════════════════════════════════════════════╗
  │  ║  FIELD SECTION 3 — Security                 [dense]     ║
  │  ║  [password] ↕16px [confirmPassword]                     ║
  │  ╚═══════════════════════════════════════════════════════════╝
  │
  ├─ 24px gap (--space-lg) ────────── FieldSection separator
  │
  │  ╔═══════════════════════════════════════════════════════════╗
  │  ║  FIELD SECTION 4 — Contact (optional)       [breathable] ║
  │  ║  [phoneNumber — single field]                            ║
  │  ╚═══════════════════════════════════════════════════════════╝
  │
  ├─ 16px gap (--space-md) ────────── section → error transition
  │
  │  [ERROR ZONE — conditional, 0 height when null]
  │
  ├─ 16px gap (--space-md) ────────── (or 0 if no error)
  │
  │  [SUBMIT BUTTON — 42px height, full width]
  │
  ├─ 16px gap (--space-md) ────────── submit → footer
  │
  │  [FOOTER — border-top/subtle, pt-16px]
  │
  └─ Panel outer padding bottom: 28px ──────────────────────────────


DENSITY BEHAVIOR WITHIN FIELD SECTIONS:
  ┌──────────────────────────────────────────────────────────────
  │  DENSE ZONE (Fields within a FieldSection)
  │  Gap: 16px between fields — minimum for readability
  │  Input height: 40px — efficient touch + keyboard target
  │  Label font: 12px — small but fully legible at 500 weight
  │  This zone is intentionally compact: all inputs are
  │  simple text entry; no need for comfortable density here.
  │
  │  BREATHABLE ZONE (Between FieldSections)
  │  Gap: 24px — creates visual silence between logical groups
  │  The divider line marks cognitive chunking: "this group
  │  is about your organization; this group is about you"
  │  This gap is the whitespace that makes the form feel
  │  organized rather than crammed.
  │
  │  ANCHOR ZONE (Submit button + footer)
  │  16px gaps above and below: the submit button needs
  │  visual isolation — it must not be visually connected
  │  to the last input field or to the footer link.
  └──────────────────────────────────────────────────────────────


LEFT PANEL RHYTHM (desktop):
  ┌──────────────────────────────────────────────────────────────
  │  40px outer padding (all sides)
  │
  │  [eyebrow] — 12px
  │  ↕ 8px
  │  [page title] — 18px (visual anchor of the panel)
  │  ↕ 8px
  │  [description] — 14px
  │  ↕ 24px (--space-lg) ─── title → steps card transition
  │
  │  [STEPS CARD — surface-panel, 20px inner padding]
  │    Step 01 → ↕8px gap → Step 02 → ↕8px gap → Step 03
  │    Each step: number (12px/mono) + title (13px/500) +
  │               description (12px/400/secondary)
  │
  │  ↕ 16px ─────────────────── steps → role card
  │
  │  [ROLE AUTHORITY CARD — surface-panel, 16px inner padding]
  │    role label (14px/500) ↕ 4px → role detail (13px/400)
  │
  │  ↕ 16px ─────────────────── role card → security card
  │
  │  [SECURITY POSTURE CARD — surface-panel, 16px inner padding]
  │    icon + title (13px/500) ↕ 8px → bullets (12px/400)
  │
  │  40px outer padding bottom
  └──────────────────────────────────────────────────────────────


VISUAL SILENCE ZONES (intentional empty space that creates calm):
  ┌──────────────────────────────────────────────────────────────
  │  1. Between FieldSections (24px gaps with divider)
  │     Purpose: cognitive chunking — separates distinct
  │     identity concerns without visual noise
  │
  │  2. Between left panel cards (16px gaps)
  │     Purpose: prevents the panel from feeling like a
  │     list dump; each card breathes independently
  │
  │  3. Panel outer padding (32px right / 40px left)
  │     Purpose: the content never touches the split edge;
  │     maintains dignity of both columns
  │
  │  4. Topbar (56px fixed)
  │     Purpose: the form is contained BELOW the topbar;
  │     the topbar is pure brand anchor — no functional weight
  └──────────────────────────────────────────────────────────────
```

---

### 14D. Component Nesting Hierarchy

```
AuthWorkstationShell [root container]
│  surface-app (workspace floor)
│  phase: "form" | "success"
│
├── Topbar [56px, full-width]
│   ├── BrandLink (Building2 icon + "DPR.ai")
│   └── MetaLabels (industry label + platform label)
│       └── Uses: text-action-primary class (NOT raw var)
│
├── LeftContextPanel [45% desktop, hidden <1024px]
│   surface-panel / padding: 40px
│   │
│   ├── EyebrowLabel [12px/500/tertiary/sentence case]
│   ├── PageTitle [18px/600 — --type-page-title]
│   ├── PageDescription [14px/400/secondary]
│   │
│   ├── ProvisioningStepsCard [surface-shell / 20px padding]
│   │   ├── Step 01 [completed | active | pending state]
│   │   │   ├── StepNumber [12px/JetBrains Mono/tertiary]
│   │   │   ├── StepTitle [13px/500/primary]
│   │   │   └── StepDesc [12px/400/secondary]
│   │   ├── Step 02 [state driven by phase prop]
│   │   └── Step 03
│   │
│   ├── RoleAuthorityCard [surface-panel / 16px padding]
│   │   [PHASE 1 ONLY — hidden in phase 2]
│   │   ├── RoleLabel [14px/500/primary — reactive to selector]
│   │   └── RoleDetail [13px/400/secondary — reactive to selector]
│   │
│   ├── VerificationSummaryCard [surface-panel / 16px padding]
│   │   [PHASE 2 ONLY — hidden in phase 1]
│   │   ├── DeliveryModeLabel [12px/500/tertiary]
│   │   └── PendingEmail [13px/500/primary]
│   │
│   └── SecurityPostureCard [surface-panel / 16px padding]
│       ├── Icon (ShieldCheck)
│       ├── Title [13px/500/primary]
│       └── Bullets [12px/400/secondary] × 3
│
└── RightFormPanel [55% desktop, 100% mobile]
    surface-app / inner max-width: 520px / centered
    │
    ├── FormPanelInner [surface-card / padding: 32px h, 28px v]
    │   │
    │   ├── PanelHeader
    │   │   ├── BadgeChip [12px/500/sentence case / surface-shell bg]
    │   │   ├── PanelTitle [h2 / 16px/600 — --type-panel-title]
    │   │   └── PanelDescription [14px/400/secondary]
    │   │
    │   │   ↕ 20px
    │   │
    │   ├── RedirectNotice [conditional / surface-selected / border-focus]
    │   │   └── [14px / shown when searchParams.next is set]
    │   │
    │   │   ↕ 16px (if notice) / 0 (if no notice)
    │   │
    │   ├── ─────────── PHASE 1 TREE ─────────────────────────────
    │   │
    │   ├── RegistrationForm [<form> element]
    │   │   │
    │   │   ├── FieldSection [Organization / 24px gap above next]
    │   │   │   ├── SectionDivider + SectionLabel [12px/500/tertiary]
    │   │   │   ├── Field [factoryName]
    │   │   │   │   ├── Label [htmlFor="factoryName"]
    │   │   │   │   └── Input [type=text / autoFocus / autoComplete=organization]
    │   │   │   │       └── PrefixIcon: Building2
    │   │   │   └── Field [companyCode]
    │   │   │       ├── Label [htmlFor="companyCode"]
    │   │   │       ├── Input [type=text / autoComplete=off]
    │   │   │       │   └── PrefixIcon: ShieldCheck
    │   │   │       └── HelperText ["Optional — enter if joining…"]
    │   │   │
    │   │   ├── FieldSection [Account / 24px gap above next]
    │   │   │   ├── SectionDivider + SectionLabel
    │   │   │   ├── Field [name]
    │   │   │   │   └── Input [type=text / autoComplete=name]
    │   │   │   │       └── PrefixIcon: User2
    │   │   │   ├── Field [email]
    │   │   │   │   └── Input [type=email / autoComplete=email / inputMode=email]
    │   │   │   │       └── PrefixIcon: Mail
    │   │   │   ├── Field [role]
    │   │   │   │   └── Select [options: admin/manager/supervisor/operator/attendance]
    │   │   │   │       NO owner option
    │   │   │   └── RoleConstraintNotice [conditional]
    │   │   │       surface-warning-bg / border-warning
    │   │   │       [visible when: companyCode.trim() AND role NOT IN attendance/operator]
    │   │   │
    │   │   ├── FieldSection [Security / 24px gap above next]
    │   │   │   ├── SectionDivider + SectionLabel
    │   │   │   ├── Field [password]
    │   │   │   │   ├── Input [type=password/text / autoComplete=new-password / minLength=12]
    │   │   │   │   │   └── PrefixIcon: KeyRound
    │   │   │   │   ├── ShowHideToggle ["Show" / "Hide" — sentence case]
    │   │   │   │   └── HelperText ["Minimum 12 characters"]
    │   │   │   └── Field [confirmPassword]
    │   │   │       ├── Input [type=password/text / autoComplete=new-password]
    │   │   │       │   └── PrefixIcon: KeyRound
    │   │   │       ├── ShowHideToggle
    │   │   │       └── MatchIndicator [inline / appears after both fields have value]
    │   │   │
    │   │   ├── FieldSection [Contact — optional / 24px gap]
    │   │   │   ├── SectionDivider + SectionLabel
    │   │   │   └── Field [phoneNumber]
    │   │   │       ├── Input [type=tel / inputMode=tel / autoComplete=tel]
    │   │   │       │   └── PrefixIcon: Phone  ← NOT Mail
    │   │   │       └── HelperText ["Optional — SMS notifications"]
    │   │   │
    │   │   ├── ErrorZone [conditional / surface-danger-bg / border-danger]
    │   │   │   └── [13px/400/status-danger-fg — hidden when error === null]
    │   │   │
    │   │   ├── SubmitButton [full-width / h-[42px] / variant=primary]
    │   │   │   └── isBusy → "Creating..." with spinner
    │   │   │
    │   │   └── Footer [border-top/subtle / pt-16px]
    │   │       ├── "Already have an account?" [14px/400/secondary/sentence case]
    │   │       └── Link → /access ["Sign in →" / text-action-primary]
    │   │
    │   ├── ─────────── PHASE 2 TREE ─────────────────────────────
    │   │
    │   └── SuccessState [replaces RegistrationForm entirely]
    │       │
    │       ├── StatusPanel [tone: success | info | warning]
    │       │   ├── StatusTitle [16px/600/primary]
    │       │   └── StatusDetail [14px/400/secondary]
    │       │
    │       ├── PendingIdentityCard [surface-panel / border-default]
    │       │   ├── EmailAddress [14px/600/primary]
    │       │   └── StatusChip [12px/500/sentence case — NOT uppercase]
    │       │
    │       ├── InstructionsList [surface-shell steps × 3]
    │       │   └── each step: 13px/400/secondary / border-default / 8px inner padding
    │       │
    │       ├── PreviewLinkPanel [conditional / surface-selected / border-focus]
    │       │   ├── EyebrowLabel [12px/500/tertiary/sentence case]
    │       │   ├── VerificationLinkButton [Link + ArrowRight icon]
    │       │   └── LinkText [12px/tertiary/break-all]
    │       │
    │       ├── ResendActionRow
    │       │   ├── Button [variant=outline / "Resend email" / isBusy="Sending..."]
    │       │   └── Link → /access ["Sign in" / text-action-primary]
    │       │
    │       └── ResendStatus [conditional / surface-shell / 13px/400/secondary]
```

**Nesting depth analysis:**

```
Maximum nesting depth: 6 levels
(AuthWorkstationShell → RightFormPanel → FormPanelInner → RegistrationForm → FieldSection → Field → Input)

This depth is appropriate for an auth form. It mirrors the system
Field → Label → Input primitive chain, which is a fixed architectural depth.

Anti-pattern prevention:
  ✗ No Card inside Card (surface-panel Card wrapping a surface-card Input Card)
  ✗ No decorative wrapper divs between FieldSection and Field
  ✗ No SectionPanel wrapper around the form — form panel inner IS the surface-card
  ✗ No MetricStrip on auth pages — not an operational data workspace
```

---

### 14E. Responsive Collapse Blueprint

#### Mobile / Tablet (<1024px)

```
┌─────────────────────────────────────────────┐
│  TOPBAR                       height: 56px  │
│  [Building2] DPR.ai     Factory OS          │
│  (industry label hidden on narrow screens)  │
├─────────────────────────────────────────────┤
│  FORM PANEL (full width, centered)          │
│  padding: 20px horizontal, 24px vertical    │
│  inner max-width: 100%                      │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ PANEL HEADER                          │  │
│  │ [chip] Factory access provisioning   │  │
│  │ [h2] Create account                  │  │
│  │ [desc] Configure organization…       │  │
│  └───────────────────────────────────────┘  │
│  ↕ 16px                                     │
│  ┌───────────────────────────────────────┐  │
│  │ FIELD SECTION 1 — Organization        │  │
│  │ [factoryName: full-width, 44px h]     │  │
│  │ ↕ 16px                               │  │
│  │ [companyCode: full-width, 44px h]     │  │
│  └───────────────────────────────────────┘  │
│  ↕ 20px (slightly compressed from 24px)     │
│  ┌───────────────────────────────────────┐  │
│  │ FIELD SECTION 2 — Account             │  │
│  │ [name: full-width, 44px h]            │  │
│  │ [email: full-width, 44px h]           │  │
│  │ [role select: native, full-width]     │  │
│  │ [constraint notice if triggered]      │  │
│  └───────────────────────────────────────┘  │
│  ↕ 20px                                     │
│  ┌───────────────────────────────────────┐  │
│  │ FIELD SECTION 3 — Security            │  │
│  │ [password: full-width / Show toggle]  │  │
│  │ [confirmPassword: full-width / Show]  │  │
│  └───────────────────────────────────────┘  │
│  ↕ 20px                                     │
│  ┌───────────────────────────────────────┐  │
│  │ FIELD SECTION 4 — Contact (optional)  │  │
│  │ [phone: full-width, 44px h]           │  │
│  └───────────────────────────────────────┘  │
│  ↕ 16px                                     │
│  [ERROR ZONE — conditional]                 │
│  ↕ 16px                                     │
│  ┌───────────────────────────────────────┐  │
│  │ [Create account]  h: 48px full-width  │  │
│  │ ← larger touch target on mobile       │  │
│  └───────────────────────────────────────┘  │
│  ↕ 16px                                     │
│  [Already have an account?] [Sign in →]     │
│                                             │
└─────────────────────────────────────────────┘

LEFT CONTEXT PANEL: COMPLETELY HIDDEN (display: none)
No drawer, no collapsible, no access mechanism.
Rationale: the left panel is context-only (non-interactive).
On mobile, all context is either inline (role constraint notice,
helper text) or eliminated. The form is the entire workspace.
```

#### Mobile — Phase 2 Success State

```
┌─────────────────────────────────────────────┐
│  TOPBAR                       height: 56px  │
├─────────────────────────────────────────────┤
│  SUCCESS PANEL (full width)                 │
│  padding: 20px horizontal                   │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ PANEL HEADER                          │  │
│  │ [chip] Verification pending           │  │
│  │ [h2] Check your inbox                 │  │
│  └───────────────────────────────────────┘  │
│  ↕ 16px                                     │
│  [STATUS PANEL — full width, tone-coded]    │
│  ↕ 12px                                     │
│  [PENDING IDENTITY CARD]                    │
│  email address + status chip                │
│  ↕ 12px                                     │
│  [INSTRUCTIONS LIST — 3 steps stacked]      │
│  each step full-width, 44px min-height      │
│  ↕ 12px (conditional)                       │
│  [PREVIEW LINK PANEL — if preview mode]     │
│  ↕ 16px                                     │
│  [Resend email btn]  [Sign in link]         │
│  resend btn: full-width on narrow screens   │
│  ↕ 8px (conditional)                        │
│  [RESEND STATUS — if present]               │
│                                             │
└─────────────────────────────────────────────┘
```

#### Collapse Decision Table

```
┌──────────────────────────────┬──────────────┬─────────────┬────────────────────┐
│ Element                      │ Desktop      │ Tablet      │ Mobile             │
│                              │ ≥1024px      │ 768–1023px  │ <768px             │
├──────────────────────────────┼──────────────┼─────────────┼────────────────────┤
│ Left context panel           │ Visible 45%  │ HIDDEN      │ HIDDEN             │
│ (eyebrow+title+steps+cards)  │              │ (no drawer) │ (no drawer)        │
├──────────────────────────────┼──────────────┼─────────────┼────────────────────┤
│ Form inner max-width         │ 520px        │ 480px       │ 100% (no max-w)    │
├──────────────────────────────┼──────────────┼─────────────┼────────────────────┤
│ Input height                 │ 40px         │ 40px        │ 44px (touch)       │
├──────────────────────────────┼──────────────┼─────────────┼────────────────────┤
│ Submit button height         │ 42px         │ 42px        │ 48px (touch)       │
├──────────────────────────────┼──────────────┼─────────────┼────────────────────┤
│ Panel outer padding          │ 32px h/28px v│ 24px/24px   │ 20px h / 20px v    │
├──────────────────────────────┼──────────────┼─────────────┼────────────────────┤
│ FieldSection gap             │ 24px         │ 20px        │ 20px               │
├──────────────────────────────┼──────────────┼─────────────┼────────────────────┤
│ Topbar industry label        │ Visible      │ Hidden      │ Hidden             │
├──────────────────────────────┼──────────────┼─────────────┼────────────────────┤
│ Role constraint notice       │ Inline below │ Inline      │ Inline (full-width)│
│                              │ role selector│ below select│                    │
├──────────────────────────────┼──────────────┼─────────────┼────────────────────┤
│ Role select input            │ System Select│ System/     │ Native <select>    │
│                              │ with overlay │ native      │ (acceptable)       │
├──────────────────────────────┼──────────────┼─────────────┼────────────────────┤
│ 2-column field grid          │ NEVER USED   │ NEVER USED  │ NEVER USED         │
│ (current implementation)     │ (eliminated) │ (eliminated)│ (eliminated)       │
└──────────────────────────────┴──────────────┴─────────────┴────────────────────┘

NOTE ON THE CURRENT 2-COLUMN GRID:
The existing implementation uses grid-cols-2 for fields side-by-side.
This is eliminated entirely. Reasons:
  1. Side-by-side inputs create unequal visual weight and break Tab order
  2. Fields in the same row (e.g. factoryName + name) have no workflow
     relationship — they are in different FieldSections
  3. Responsive handling of a 2-col grid is fragile at tablet widths
  4. Single-column form with FieldSection grouping is cleaner, faster to
     scan, and more consistent with the login workspace pattern
```

---

### 14F. Structural Consistency Validation

#### Zone Existence Justification

```
┌──────────────────────────┬────────────────────┬──────────────────────────────────┐
│ Zone                     │ Justified by        │ Operational test                 │
├──────────────────────────┼────────────────────┼──────────────────────────────────┤
│ Topbar                   │ Brand anchor +      │ Operator knows they are on       │
│                          │ escape to /         │ FactoryNerve, not a phishing     │
│                          │                     │ page. Trust signal. KEEP.        │
├──────────────────────────┼────────────────────┼──────────────────────────────────┤
│ Left context panel       │ Provisioning steps  │ Reduces anxiety for first-time   │
│ (desktop only)           │ reduce uncertainty  │ factory owners. Shows what        │
│                          │ + role detail is    │ comes next. Makes the commitment  │
│                          │ contextual to select│ legible. Role reactive card       │
│                          │                     │ eliminates disconnected card.     │
│                          │                     │ KEEP (desktop only).             │
├──────────────────────────┼────────────────────┼──────────────────────────────────┤
│ FieldSection: Org        │ Company + code must │ Grouping prevents user from      │
│                          │ be validated        │ submitting code without name.    │
│                          │ together            │ Helper text answers "do I        │
│                          │                     │ need this?" proactively. KEEP.   │
├──────────────────────────┼────────────────────┼──────────────────────────────────┤
│ FieldSection: Account    │ Identity fields     │ Name + email + role are the      │
│                          │ + the one decision  │ user's identity in the system.   │
│                          │ (role selector)     │ Role selector needs its own      │
│                          │                     │ section to signal its weight.    │
│                          │                     │ KEEP.                            │
├──────────────────────────┼────────────────────┼──────────────────────────────────┤
│ Role constraint notice   │ Prevents guaranteed │ Without this: companyCode +      │
│ (conditional)            │ backend HTTP 403    │ manager role = guaranteed 403.   │
│                          │                     │ With this: operator understands  │
│                          │                     │ the constraint before submit.    │
│                          │                     │ KEEP.                            │
├──────────────────────────┼────────────────────┼──────────────────────────────────┤
│ FieldSection: Security   │ Password fields     │ Credential creation needs its    │
│                          │ + minimum length    │ own section. Min-length helper    │
│                          │ + confirmation      │ prevents unnecessary round-trips. │
│                          │                     │ KEEP.                            │
├──────────────────────────┼────────────────────┼──────────────────────────────────┤
│ FieldSection: Contact    │ Optional phone      │ Phone enables SMS notifications. │
│                          │ for SMS notifs      │ It is optional — kept in its own  │
│                          │                     │ section so its optional nature   │
│                          │                     │ is structurally clear. KEEP.     │
├──────────────────────────┼────────────────────┼──────────────────────────────────┤
│ Error zone               │ Backend error       │ Without this: errors from HTTP   │
│                          │ surface             │ 409/403/400 have no visible      │
│                          │                     │ surface. Operator can't retry    │
│                          │                     │ without understanding the error. │
│                          │                     │ KEEP.                            │
├──────────────────────────┼────────────────────┼──────────────────────────────────┤
│ Phase 2: Status panel    │ Communicates        │ Without tone coding: operator    │
│                          │ outcome immediately │ must read text to know if email  │
│                          │                     │ was sent or failed. Tone color   │
│                          │                     │ gives immediate scan-level 1     │
│                          │                     │ answer. KEEP.                    │
├──────────────────────────┼────────────────────┼──────────────────────────────────┤
│ Phase 2: Pending         │ Email verification  │ Operator verifies "did I submit  │
│ identity card            │ confirmation        │ the right email?" before opening │
│                          │                     │ inbox. Prevents verification on  │
│                          │                     │ wrong account. KEEP.             │
├──────────────────────────┼────────────────────┼──────────────────────────────────┤
│ Phase 2: Instructions    │ Next-action         │ 3 steps tell the operator        │
│ list                     │ guidance            │ exactly what to do. Without this:│
│                          │                     │ operator stares at a "success"   │
│                          │                     │ screen with no clear path to     │
│                          │                     │ activation. KEEP.                │
├──────────────────────────┼────────────────────┼──────────────────────────────────┤
│ Phase 2: Preview link    │ Developer           │ Preview mode only — dev can      │
│ panel (conditional)      │ verification        │ click to verify without email    │
│                          │ shortcut            │ infra. Irrelevant in production  │
│                          │                     │ (never shown). KEEP (conditional)│
├──────────────────────────┼────────────────────┼──────────────────────────────────┤
│ Phase 2: Resend action   │ Email delivery      │ Email can fail. Resend gives the │
│                          │ failure recovery    │ operator a recovery path without │
│                          │                     │ leaving the page. KEEP.          │
└──────────────────────────┴────────────────────┴──────────────────────────────────┘
```

#### Removed from Current Implementation (Justified Reductions)

```
┌──────────────────────────────────────┬──────────────────────────────────────────┐
│ Removed element                      │ Why removed                              │
├──────────────────────────────────────┼──────────────────────────────────────────┤
│ "Operational onboarding" role card   │ Disconnected from role selector by the   │
│ below the form grid                  │ entire form height. Role detail moved to  │
│                                      │ left panel (reactive). Right panel is    │
│                                      │ cleaner without this card.               │
├──────────────────────────────────────┼──────────────────────────────────────────┤
│ grid-cols-2 field layout             │ No workflow justification for side-by-   │
│                                      │ side inputs. Breaks FieldSection grouping│
│                                      │ logic. Single-column is cleaner, more    │
│                                      │ accessible, and consistent with login.   │
├──────────────────────────────────────┼──────────────────────────────────────────┤
│ FieldLabel local component           │ Bypasses system Label primitive.         │
│                                      │ Produces forbidden tracking/uppercase.   │
│                                      │ Replaced by system Field → Label chain.  │
├──────────────────────────────────────┼──────────────────────────────────────────┤
│ IdentityField local component        │ Local wrappers that bypass validation    │
│ + PasswordInput local component      │ state system. Replaced by system         │
│                                      │ Field + Input primitives.                │
├──────────────────────────────────────┼──────────────────────────────────────────┤
│ owner option in role selector        │ Backend rejects with HTTP 403. Including │
│                                      │ it guarantees failures. No operational   │
│                                      │ path for owner self-registration exists. │
└──────────────────────────────────────┴──────────────────────────────────────────┘
```

#### Spacing System Compliance Check

```
All spacing values used in this spec (4px scale verification):
  8px   ✓  (--space-2 / --space-sm × 1)
  12px  ✓  (--space-3)
  16px  ✓  (--space-md / --space-4)
  20px  ✓  (--space-5)
  24px  ✓  (--space-lg / --space-6)
  28px  ✓  (--space-7)
  32px  ✓  (--space-8)
  40px  ✓  (--space-10)
  44px  ✓  (--space-11 — mobile touch targets)
  48px  ✓  (--space-12 — mobile button height)
  56px  ✓  (--space-14 — topbar height)

No arbitrary values used. All values are multiples of 4px.
```

#### Typography Compliance Check

```
Typography values used (FRONTEND_MODERNIZATION_BLUEPRINT verification):
  10px / 600 weight  ✓  table column headers only — NOT used here
  11px / 500 weight  ✓  --type-metadata — NOT used in labels here (correctly avoided)
  12px / 500 weight  ✓  --type-label — used for field labels, eyebrows, chips, step numbers
  13px / 400 weight  ✓  --type-table-cell equivalent — used for role detail, instructions
  14px / 400 weight  ✓  --type-body — used for descriptions, panel desc, body text
  14px / 600 weight  ✓  --type-body bold — used for pending email, footer links weight
  16px / 600 weight  ✓  --type-panel-title — used for h2 panel title
  18px / 600 weight  ✓  --type-page-title — used for left panel page title

Uppercase usage (allowed contexts only):
  Table column headers: N/A (no tables)
  Section eyebrow labels: ZERO uppercase used — all sentence case ✓
  Navigation group titles: N/A

Tracking > 0.06em: ZERO instances ✓
Arbitrary font sizes (text-[Npx]): ZERO instances ✓
Raw var() references in class strings: ZERO instances ✓
```

#### Anti-Pattern Final Check

```
  ✓ No gradients — zero gradient specifications anywhere in this spec
  ✓ No glow effects — zero box-shadow or filter:glow specifications
  ✓ No pulsing animations on static content — no idle animations
  ✓ No UPPERCASE labels — all labels explicitly sentence case
  ✓ No marketing typography — max heading size is 18px (--type-page-title)
  ✓ No invented workflows — all states trace to RegisterResponse delivery_mode
  ✓ No placeholder APIs — POST /auth/register verified in auth.py lines 630–940
  ✓ No decorative cards — every card justified by operational necessity in Section 14F
  ✓ No 2-column field grid — eliminated, replaced by FieldSection single-column
  ✓ No disconnected role detail card — moved to left panel, made reactive
  ✓ No owner role in selector — backend enforcement acknowledged and respected
  ✓ No Mail icon on phone field — Phone icon specified
  ✓ No raw var() token references — text-action-primary everywhere
```

---

*End of Section 14 — Visual Structural Hierarchy Blueprint*
*End of WORKSPACE_SKELETON_REGISTER.md*
*This file is system-generated architecture. Treat as engineering law until formally amended.*
*Architectural precedent established: FieldSection grouping, phase-state AuthWorkstationShell,*
*role constraint inline notices, single-column auth form pattern, reactive left panel cards*


#### CODE

`
<!DOCTYPE html><html class="dark" lang="en"><head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>Provision Credentials | FactoryNerve OS</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet">
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        input:focus {
            outline: none !important;
            box-shadow: none !important;
        }
        .tracking-tight-custom {
            letter-spacing: -0.01em;
        }
        .glass-panel {
            background: rgba(23, 31, 51, 0.7);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(133, 147, 153, 0.15);
        }
        .pulse-indicator {
            box-shadow: 0 0 0 0 rgba(76, 214, 255, 0.7);
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(76, 214, 255, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(76, 214, 255, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(76, 214, 255, 0); }
        }
        .topo-line {
            stroke: #3c494e;
            stroke-dasharray: 4;
            animation: dash 20s linear infinite;
        }
        @keyframes dash {
            to { stroke-dashoffset: -100; }
        }
        .input-group:focus-within label {
            color: #a4e6ff;
        }
    </style>
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                      "primary-fixed-dim": "#4cd6ff",
                      "on-error": "#690005",
                      "surface-variant": "#2d3449",
                      "error-container": "#93000a",
                      "outline": "#859399",
                      "on-tertiary": "#442b00",
                      "on-surface-variant": "#bbc9cf",
                      "primary-container": "#00d1ff",
                      "on-primary-container": "#00566a",
                      "on-surface": "#dae2fd",
                      "on-primary-fixed": "#001f28",
                      "tertiary": "#ffd59c",
                      "surface-container-low": "#131b2e",
                      "secondary-fixed": "#d3e4fe",
                      "error": "#ffb4ab",
                      "on-tertiary-fixed-variant": "#624000",
                      "tertiary-fixed": "#ffddb1",
                      "on-secondary": "#213145",
                      "tertiary-fixed-dim": "#ffba49",
                      "tertiary-container": "#feb127",
                      "on-primary": "#003543",
                      "background": "#0b1326",
                      "secondary": "#b7c8e1",
                      "outline-variant": "#3c494e",
                      "surface-container-highest": "#2d3449",
                      "secondary-fixed-dim": "#b7c8e1",
                      "inverse-primary": "#00677f",
                      "surface-container-lowest": "#060e20",
                      "on-tertiary-fixed": "#291800",
                      "secondary-container": "#3a4a5f",
                      "on-tertiary-container": "#6b4700",
                      "surface-tint": "#4cd6ff",
                      "on-primary-fixed-variant": "#004e60",
                      "surface": "#0b1326",
                      "surface-container": "#171f33",
                      "inverse-on-surface": "#283044",
                      "primary-fixed": "#b7eaff",
                      "on-secondary-fixed": "#0b1c30",
                      "primary": "#a4e6ff",
                      "inverse-surface": "#dae2fd",
                      "surface-bright": "#31394d",
                      "surface-dim": "#0b1326",
                      "surface-container-high": "#222a3d",
                      "on-secondary-fixed-variant": "#38485d",
                      "on-error-container": "#ffdad6",
                      "on-background": "#dae2fd"
              },
              "borderRadius": {
                      "DEFAULT": "0.125rem",
                      "lg": "0.25rem",
                      "xl": "0.5rem",
                      "full": "0.75rem"
              },
              "spacing": {
                      "base": "4px",
                      "gutter": "16px",
                      "xl": "32px",
                      "lg": "24px",
                      "sm": "8px",
                      "xs": "4px",
                      "margin": "24px",
                      "md": "16px"
              },
              "fontFamily": {
                      "metadata": ["JetBrains Mono"],
                      "button": ["Hanken Grotesk"],
                      "page-title": ["Hanken Grotesk"],
                      "panel-title": ["Hanken Grotesk"],
                      "label": ["JetBrains Mono"],
                      "body": ["Hanken Grotesk"]
              },
              "fontSize": {
                      "metadata": ["11px", {"lineHeight": "14px", "letterSpacing": "0.04em", "fontWeight": "400"}],
                      "button": ["14px", {"lineHeight": "14px", "letterSpacing": "0.02em", "fontWeight": "500"}],
                      "page-title": ["18px", {"lineHeight": "24px", "letterSpacing": "0em", "fontWeight": "600"}],
                      "panel-title": ["16px", {"lineHeight": "20px", "letterSpacing": "0em", "fontWeight": "600"}],
                      "label": ["12px", {"lineHeight": "16px", "letterSpacing": "0.02em", "fontWeight": "500"}],
                      "body": ["14px", {"lineHeight": "20px", "letterSpacing": "0em", "fontWeight": "400"}]
              }
            },
          },
        }
    </script>
</head>
<body class="bg-background text-on-background font-body min-h-screen selection:bg-primary selection:text-on-primary-fixed overflow-x-hidden">
<header class="fixed top-0 w-full h-[56px] flex items-center justify-between px-margin z-50 bg-surface-container border-b border-outline-variant">
<div class="flex items-center gap-sm">
<span class="material-symbols-outlined text-primary" data-icon="factory">factory</span>
<span class="font-page-title text-page-title font-bold text-on-surface tracking-tight-custom">FactoryNerve OS</span>
</div>
<div class="flex items-center gap-md">
<button class="material-symbols-outlined text-on-surface-variant hover:bg-surface-variant transition-colors p-xs rounded" data-icon="help">help</button>
<button class="material-symbols-outlined text-on-surface-variant hover:bg-surface-variant transition-colors p-xs rounded" data-icon="settings">settings</button>
</div>
</header>
<main class="pt-[56px] min-h-screen flex">
<!-- LEFT PANEL -->
<section class="hidden lg:flex w-[40%] flex-col bg-surface-container-low border-r border-outline-variant p-xl sticky top-[56px] h-[calc(100vh-56px)] overflow-y-auto">
<div class="space-y-sm mb-xl">
<span class="font-label text-label text-on-surface-variant block tracking-normal">Factory onboarding channel</span>
<h1 class="font-page-title text-[24px] leading-tight text-on-surface tracking-tight-custom">Initialize Organization Node</h1>
<p class="font-body text-body text-on-surface-variant max-w-sm">Configure credentials and organizational context for node initialization.</p>
</div>
<!-- Connected Stepper -->
<div class="space-y-0 mb-xl relative">
<div class="absolute left-[9px] top-2 bottom-2 w-px bg-outline-variant"></div>
<div class="flex gap-md items-start relative pb-8">
<div class="flex flex-col items-center z-10 bg-surface-container-low">
<span class="material-symbols-outlined text-primary text-[20px]" style="font-variation-settings: 'FILL' 1;">radio_button_checked</span>
</div>
<div class="pt-px">
<span class="font-label text-label text-primary block mb-xs tracking-normal">Step 01</span>
<span class="font-panel-title text-on-surface">Register company identity</span>
</div>
</div>
<div class="flex gap-md items-start relative pb-8 opacity-40">
<div class="flex flex-col items-center z-10 bg-surface-container-low">
<span class="material-symbols-outlined text-outline text-[20px]">radio_button_unchecked</span>
</div>
<div class="pt-px">
<span class="font-label text-label text-on-surface-variant block mb-xs tracking-normal">Step 02</span>
<span class="font-panel-title text-on-surface-variant">Verify operational inbox</span>
</div>
</div>
<div class="flex gap-md items-start relative opacity-40">
<div class="flex flex-col items-center z-10 bg-surface-container-low">
<span class="material-symbols-outlined text-outline text-[20px]">radio_button_unchecked</span>
</div>
<div class="pt-px">
<span class="font-label text-label text-on-surface-variant block mb-xs tracking-normal">Step 03</span>
<span class="font-panel-title text-on-surface-variant">Initialize workspace</span>
</div>
</div>
</div>
<!-- Network Topology Trust Signal -->
<div class="mb-xl p-md border border-outline-variant bg-surface-container/30 rounded">
<span class="font-label text-label text-outline block mb-sm tracking-normal">Network topology</span>
<svg class="w-full h-24" viewBox="0 0 300 100">
<circle cx="20" cy="50" fill="#4cd6ff" r="3"></circle>
<circle cx="150" cy="20" fill="#3c494e" r="3"></circle>
<circle cx="150" cy="80" fill="#3c494e" r="3"></circle>
<circle cx="280" cy="50" fill="#3c494e" r="3"></circle>
<path class="topo-line" d="M23 50 L147 20" fill="none"></path>
<path class="topo-line" d="M23 50 L147 80" fill="none"></path>
<path class="topo-line" d="M153 20 L277 50" fill="none"></path>
<path class="topo-line" d="M153 80 L277 50" fill="none"></path>
</svg>
<div class="flex justify-between mt-sm">
<span class="font-metadata text-[9px] text-outline">NODE_A: ACTIVE</span>
<span class="font-metadata text-[9px] text-outline">UPLINK_STABLE</span>
</div>
</div>
<!-- Role Authority Card -->
<div class="bg-surface-container border border-outline-variant p-md flex items-start gap-md mb-xl" id="role-authority-card">
<div class="bg-secondary-container p-xs rounded">
<span class="material-symbols-outlined text-on-secondary-container" data-icon="admin_panel_settings">admin_panel_settings</span>
</div>
<div>
<span class="font-panel-title text-panel-title text-on-surface block tracking-tight-custom">Factory admin</span>
<p class="font-body text-body text-on-surface-variant mt-xs">Full administrative authority over organization setup and factory configuration.</p>
</div>
</div>
<!-- Security Telemetry Block -->
<div class="mt-auto space-y-md">
<div class="p-md glass-panel rounded border-l-2 border-primary">
<div class="flex items-center justify-between mb-sm">
<span class="font-label text-label text-on-surface tracking-normal uppercase text-[10px]">System health &amp; security</span>
<div class="flex items-center gap-xs">
<div class="w-1.5 h-1.5 bg-primary rounded-full pulse-indicator"></div>
<span class="font-metadata text-[10px] text-primary">ACTIVE</span>
</div>
</div>
<div class="space-y-xs font-metadata text-[10px] text-on-surface-variant">
<div class="flex justify-between">
<span class="">Provisioning node:</span>
<span class="text-on-surface">Global-East-01</span>
</div>
<div class="flex justify-between">
<span class="">Encrypted tunnel:</span>
<span class="text-on-surface">256-bit GCM</span>
</div>
<div class="flex justify-between">
<span class="">Identity vaulting:</span>
<span class="text-on-surface">AES-XTS-512</span>
</div>
<div class="flex justify-between">
<span class="">SOC2 Compliance:</span>
<span class="text-on-surface">Verified</span>
</div>
</div>
</div>
<div class="p-md glass-panel rounded border-l-2 border-tertiary">
<div class="flex items-center justify-between mb-sm">
<span class="font-label text-label text-on-surface tracking-normal uppercase text-[10px]">Security &amp; Compliance Certifications</span>
<span class="material-symbols-outlined text-tertiary text-[16px]" data-icon="verified_user">verified_user</span>
</div>
<div class="space-y-xs font-metadata text-[10px] text-on-surface-variant">
<div class="flex justify-between">
<span class="">ISO 27001:</span>
<span class="text-on-surface">Verified</span>
</div>
<div class="flex justify-between">
<span class="">HIPAA Compliant:</span>
<span class="text-on-surface">Certified</span>
</div>
<div class="flex justify-between">
<span class="">GDPR Ready:</span>
<span class="text-on-surface">Compliant</span>
</div>
</div>
</div></div>
</section>
<!-- RIGHT PANEL -->
<section class="flex-1 flex flex-col items-center py-xl px-margin overflow-y-auto" id="form-container">
<div class="w-full max-w-[560px] glass-panel rounded-xl p-10 lg:p-12 shadow-2xl space-y-xl bg-surface-container-low">
<header class="space-y-sm">
<div class="flex items-center gap-xs">
<span class="inline-flex px-sm py-xs bg-surface-container-highest border border-outline-variant rounded font-label text-[10px] text-on-surface-variant tracking-normal uppercase">Access provisioning</span>
</div>
<h2 class="font-page-title text-[28px] text-on-surface tracking-tight-custom">Provision Credentials</h2>
<p class="font-body text-body text-on-surface-variant">Securely register operational identity and node authority.</p>
</header>
<!-- Premium SSO Options -->
<div class="space-y-md">
<div class="grid grid-cols-2 gap-md">
<button class="flex items-center justify-center gap-sm h-[48px] bg-surface-container border border-outline-variant rounded-full hover:bg-surface-variant hover:border-primary/50 transition-all group">
<svg class="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path><path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path></svg>
<span class="font-button text-on-surface">Google</span>
</button>
<button class="flex items-center justify-center gap-sm h-[48px] bg-surface-container border border-outline-variant rounded-full hover:bg-surface-variant hover:border-primary/50 transition-all group">
<span class="material-symbols-outlined text-[20px] text-primary transition-transform group-hover:scale-110" data-icon="vpn_key">vpn_key</span>
<span class="font-button text-on-surface">Enterprise SSO</span>
</button>
</div>
<div class="flex items-center gap-md">
<div class="flex-1 h-px bg-outline-variant/30"></div>
<span class="font-label text-label text-outline/60 tracking-normal opacity-40">Or provision via identity form</span>
<div class="flex-1 h-px bg-outline-variant/30"></div>
</div>
</div>
<!-- Form -->
<form class="space-y-lg" id="provisioning-form">
<!-- FieldSection: Organization -->
<div class="space-y-md">
<div class="flex items-center gap-sm border-b border-outline-variant/30 pb-xs">
<span class="font-label text-label text-primary tracking-normal">Organization details</span>
</div>
<div class="grid grid-cols-1 gap-md">
<div class="space-y-xs input-group">
<label class="font-label text-label sentence-case tracking-normal transition-colors text-on-surface">Organization or company</label>
<div class="relative flex items-center">
<span class="material-symbols-outlined absolute left-md text-outline text-[18px]" data-icon="corporate_fare">corporate_fare</span>
<input autofocus="" class="w-full h-[44px] pl-[44px] pr-md bg-surface-container/50 border border-outline-variant rounded focus:border-primary focus:bg-surface-container transition-all text-on-surface font-body placeholder:text-outline/40" placeholder="Enter full organization name" type="text">
</div>
</div>
<div class="space-y-xs input-group">
<div class="flex justify-between items-center">
<label class="font-label text-label sentence-case tracking-normal transition-colors text-on-surface">Company code</label>
<span class="font-metadata text-[10px] text-outline uppercase opacity-40">Optional</span>
</div>
<div class="relative flex items-center">
<span class="material-symbols-outlined absolute left-md text-outline text-[18px]" data-icon="shield">shield</span>
<input class="w-full h-[44px] pl-[44px] pr-md bg-surface-container/50 border border-outline-variant rounded focus:border-primary focus:bg-surface-container transition-all text-on-surface font-body placeholder:text-outline/40" placeholder="e.g. FN-ALPHA-00" type="text">
</div>
</div>
</div>
</div>
<!-- FieldSection: Personal Identity -->
<div class="space-y-md">
<div class="flex items-center gap-sm border-b border-outline-variant/30 pb-xs">
<span class="font-label text-label text-primary tracking-normal">Node operator identity</span>
</div>
<div class="grid grid-cols-1 gap-md">
<div class="space-y-xs input-group">
<label class="font-label text-label sentence-case tracking-normal transition-colors text-on-surface">Full name</label>
<div class="relative flex items-center">
<span class="material-symbols-outlined absolute left-md text-outline text-[18px]" data-icon="person">person</span>
<input class="w-full h-[44px] pl-[44px] pr-md bg-surface-container/50 border border-outline-variant rounded focus:border-primary focus:bg-surface-container transition-all text-on-surface font-body placeholder:text-outline/40" placeholder="Legal full name" required="" type="text">
</div>
</div>
<div class="space-y-xs input-group">
<label class="font-label text-label sentence-case tracking-normal transition-colors text-on-surface">Work email address</label>
<div class="relative flex items-center">
<span class="material-symbols-outlined absolute left-md text-outline text-[18px]" data-icon="mail">mail</span>
<input class="w-full h-[44px] pl-[44px] pr-md bg-surface-container/50 border border-outline-variant rounded focus:border-primary focus:bg-surface-container transition-all text-on-surface font-body placeholder:text-outline/40" id="email-input" placeholder="name@company.com" required="" type="email">
</div>
</div>
<div class="space-y-xs input-group">
<label class="font-label text-label sentence-case tracking-normal transition-colors text-on-surface">Factory role assignment</label>
<div class="relative flex items-center">
<span class="material-symbols-outlined absolute left-md text-outline text-[18px]" data-icon="assignment_ind">assignment_ind</span>
<select class="w-full h-[44px] pl-[44px] pr-md bg-surface-container/50 border border-outline-variant rounded focus:border-primary focus:bg-surface-container transition-all text-on-surface font-body appearance-none cursor-pointer" id="role-select" required="">
<option value="admin">Admin (System Authority)</option>
<option value="manager">Manager (Node Oversight)</option>
<option value="supervisor">Supervisor (Process Audit)</option>
<option value="operator">Operator (Line Execution)</option>
<option value="attendance">Attendance (Logistics)</option>
</select>
<span class="material-symbols-outlined absolute right-md text-outline pointer-events-none" data-icon="expand_more">expand_more</span>
</div>
</div>
</div>
</div>
<!-- FieldSection: Security Credentials -->
<div class="space-y-md">
<div class="flex items-center gap-sm border-b border-outline-variant/30 pb-xs">
<span class="font-label text-label text-primary tracking-normal">Security credentials</span>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-md">
<div class="space-y-xs input-group">
<label class="font-label text-label sentence-case tracking-normal transition-colors text-on-surface">Create password</label>
<div class="relative flex items-center">
<span class="material-symbols-outlined absolute left-md text-outline text-[18px]" data-icon="key">key</span>
<input class="w-full h-[44px] pl-[44px] pr-md bg-surface-container/50 border border-outline-variant rounded focus:border-primary focus:bg-surface-container transition-all text-on-surface font-body placeholder:text-outline/40" id="password-input" placeholder="Minimum 12 chars" required="" type="password">
</div>
<!-- Elegant Strength Meter -->
<div class="flex gap-1 mt-2 h-[2px]">
<div class="flex-1 bg-outline-variant/30 rounded-full overflow-hidden">
<div class="h-full w-0 transition-all duration-500" id="strength-fill"></div>
</div>
</div>
</div>
<div class="space-y-xs input-group">
<label class="font-label text-label sentence-case tracking-normal transition-colors text-on-surface">Confirm credentials</label>
<div class="relative flex items-center">
<span class="material-symbols-outlined absolute left-md text-outline text-[18px]" data-icon="key">key</span>
<input class="w-full h-[44px] pl-[44px] pr-md bg-surface-container/50 border border-outline-variant rounded focus:border-primary focus:bg-surface-container transition-all text-on-surface font-body placeholder:text-outline/40" placeholder="Repeat password" required="" type="password">
</div>
</div>
</div>
</div>
<div class="pt-lg space-y-xl">
<button class="w-full h-[52px] bg-primary text-on-primary font-button text-button rounded shadow-lg active:scale-[0.98] transition-all hover:bg-primary-fixed-dim hover:shadow-primary/20 flex items-center justify-center gap-sm" type="submit">
                        Provision Credentials
                        <span class="material-symbols-outlined text-[18px]" data-icon="arrow_forward">arrow_forward</span>
</button>
<div class="flex items-center justify-center gap-xs">
<span class="font-body text-body text-on-surface-variant">Already have a node account?</span>
<a class="font-body text-body text-primary hover:underline flex items-center gap-xs" href="#">Sign in <span class="material-symbols-outlined text-[14px]" data-icon="arrow_right_alt">arrow_right_alt</span></a>
</div>
</div>
</form>
</div>
</section>
<!-- SUCCESS STATE (Hidden) -->
<section class="hidden flex-1 flex flex-col items-center justify-center py-xl px-margin" id="success-container">
<div class="w-full max-w-[520px] space-y-xl text-center">
<div class="w-16 h-16 bg-primary/10 border border-primary/30 rounded-full flex items-center justify-center mx-auto mb-xl">
<span class="material-symbols-outlined text-primary text-[32px] pulse-indicator rounded-full" data-icon="check_circle" style="font-variation-settings: 'FILL' 1;">check_circle</span>
</div>
<header class="space-y-sm">
<div class="inline-flex px-sm py-xs bg-primary/10 border-l-2 border-primary font-label text-label text-primary tracking-normal uppercase text-[10px]">Verification dispatched</div>
<h2 class="font-panel-title text-[32px] leading-tight text-on-surface tracking-tight-custom">Check your operational inbox</h2>
<p class="font-body text-body text-on-surface-variant">A secure activation link has been routed to your workspace identity.</p>
</header>
<div class="glass-panel p-lg rounded-lg flex flex-col items-center gap-md">
<div class="flex items-center gap-sm">
<span class="material-symbols-outlined text-primary" data-icon="alternate_email">alternate_email</span>
<span class="font-panel-title text-on-surface" id="display-email">name@company.com</span>
</div>
<span class="px-sm py-xs bg-secondary-container text-on-secondary-container rounded font-label text-[10px] tracking-normal uppercase">Activation pending</span>
</div>
<div class="text-left space-y-md border-t border-outline-variant/30 pt-xl">
<span class="font-label text-label text-on-surface-variant block mb-sm tracking-normal">Next steps</span>
<ol class="space-y-md">
<li class="flex gap-md">
<span class="w-6 h-6 flex items-center justify-center bg-surface-container-highest border border-outline-variant rounded-full text-primary font-label text-label">1</span>
<span class="font-body text-body text-on-surface-variant">Locate the FactoryNerve activation transmission.</span>
</li>
<li class="flex gap-md">
<span class="w-6 h-6 flex items-center justify-center bg-surface-container-highest border border-outline-variant rounded-full text-primary font-label text-label">2</span>
<span class="font-body text-body text-on-surface-variant">Authorize activation via the secure token.</span>
</li>
</ol>
</div>
<div class="pt-xl">
<a class="inline-flex h-[46px] px-xl items-center justify-center border border-primary text-primary font-button text-button rounded hover:bg-primary/5 transition-colors" href="#">
                    Return to Sign In
                </a>
</div>
</div>
</section>
</main>
<footer class="w-full py-sm px-margin flex flex-col md:flex-row justify-between items-center bg-surface-container-lowest border-t border-outline-variant">
<div class="flex items-center gap-md">
<span class="font-metadata text-metadata text-on-surface-variant">© 2024 FactoryNerve Industrial Systems. Enterprise Node Provisioning.</span>
</div>
<div class="flex gap-lg">
<a class="font-metadata text-metadata text-secondary hover:text-primary underline transition-opacity" href="#">Privacy Policy</a>
<a class="font-metadata text-metadata text-secondary hover:text-primary underline transition-opacity" href="#">Terms of Service</a>
<a class="font-metadata text-metadata text-secondary hover:text-primary underline transition-opacity" href="#">Security Audit</a>
</div>
</footer>
<script>
    // Role selection feedback
    const roleSelect = document.getElementById('role-select');
    const roleCard = document.getElementById('role-authority-card');
    
    roleSelect.addEventListener('change', function() {
        roleCard.classList.add('bg-primary/10', 'border-primary/50');
        setTimeout(() => {
            roleCard.classList.remove('bg-primary/10', 'border-primary/50');
        }, 800);
        
        const role = this.value;
        const title = roleCard.querySelector('span.font-panel-title');
        const desc = roleCard.querySelector('p.font-body');
        
        const roles = {
            admin: ["Factory Admin", "Full administrative authority over organization setup and factory configuration."],
            manager: ["Node Manager", "Oversight of operational nodes, resource allocation, and reporting."],
            supervisor: ["Process Supervisor", "Direct auditing of line performance and safety compliance."],
            operator: ["Line Operator", "Execution of industrial processes and asset interaction."],
            attendance: ["Logistics Clerk", "Management of personnel flow and scheduling logs."]
        };
        
        title.textContent = roles[role][0];
        desc.textContent = roles[role][1];
    });

    // Password Strength Meter
    const passwordInput = document.getElementById('password-input');
    passwordInput.addEventListener('input', function() {
        const val = this.value;
        const fill = document.getElementById('strength-fill');
        
        if (val.length === 0) {
            fill.style.width = '0%';
            return;
        }

        let strength = 0;
        if (val.length > 6) strength += 25;
        if (val.length >= 12) strength += 25;
        if (/[A-Z]/.test(val)) strength += 25;
        if (/[0-9]/.test(val) && /[^A-Za-z0-9]/.test(val)) strength += 25;

        fill.style.width = strength + '%';
        
        if (strength <= 25) fill.className = 'h-full bg-error transition-all duration-500';
        else if (strength <= 50) fill.className = 'h-full bg-tertiary transition-all duration-500';
        else if (strength <= 75) fill.className = 'h-full bg-primary-fixed-dim transition-all duration-500';
        else fill.className = 'h-full bg-primary transition-all duration-500';
    });

    // Form submission
    document.getElementById('provisioning-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const emailValue = document.getElementById('email-input').value;
        document.getElementById('display-email').textContent = emailValue;
        
        const formContainer = document.getElementById('form-container');
        const successContainer = document.getElementById('success-container');
        
        formContainer.classList.add('opacity-0', 'transition-opacity', 'duration-300');
        setTimeout(() => {
            formContainer.classList.add('hidden');
            successContainer.classList.remove('hidden');
            successContainer.classList.add('opacity-0');
            setTimeout(() => {
                successContainer.classList.add('transition-opacity', 'duration-500', 'opacity-100');
            }, 50);
        }, 300);
    });
</script>




</body></html>
`