# Profile — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification
# Route: /profile
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/profile` |
| Workspace Name | Account Profile — Identity, Security & Workspace Context |
| Operational Role | Enables any authenticated user to view their identity, edit their display name and phone number, manage their profile photo, change their password, review their factory access context, inspect session activity, and log out from individual or all devices. |
| Business Impact | If this workspace fails, users cannot change passwords after a security incident, cannot update their phone number for SMS notifications, cannot log out all devices after a device loss, and cannot verify their factory access context. Shift workers also lose their primary avenue for checking their own sync status (pending entries). |
| User Population | All roles. Attendance/operator: primarily uses activity summary and sign-out. Supervisor/manager/admin/owner: uses identity edit, password change, session management, workspace context review. |
| Peak Usage Context | On-demand — most commonly accessed (1) when a user wants to change their password, (2) when a user suspects a security issue (logout all devices), (3) when a new user wants to upload a profile photo, (4) when an operator checks today's entry count and pending sync. |
| Predecessor Workspaces | Any workspace (via profile link in sidebar or command palette) |
| Successor Workspaces | Any workspace (user returns to their prior context) or `/access` (after logout) |

### 1.2 Operational Importance

The profile workspace is the primary self-service security and identity surface for every user in FactoryNerve. It is the only page where operators can change their password, remove their phone number from SMS notifications, or force-sign-out from all devices after a security concern. For shift operators, the activity section (entries today / pending sync) provides an immediate sanity check on their work data status. The workspace must function reliably because its failure directly impacts factory data integrity (operators can't verify sync) and security (users can't revoke sessions).

### 1.3 Current State Failures

- Hero section uses `bg-[linear-gradient(135deg,...)]` — gradient is explicitly forbidden at all phases; no gradients permitted
- Hero section `h1` uses `text-3xl` (30px) — 12px above the 18px `--type-page-title` ceiling; must reduce to 18px/600
- Hero eyebrow uses `text-[11px] font-semibold uppercase tracking-[0.26em]` — tracking 4.3× the permitted maximum; monospace is absent here but uppercase + extreme tracking is the same violation pattern
- `profileSurfaceClass` constant uses `rounded-[1.5rem]` and `border-[0.5px]` — arbitrary border shorthand, arbitrary radius (governance specifies `rounded-panel` or `rounded-control`); also uses `shadow-[0_18px_48px_rgba(15,23,42,0.08)]` — raw rgba shadow value, forbidden
- `profileStatClass` constant uses `rounded-[1rem]` and `border-[0.5px]` — arbitrary radius and border shorthand
- Every stat item label uses `text-xs uppercase tracking-[0.16em]` — the "Name", "Role", "Phone", "Email", "Factory", "Last Login", "Active Devices", "Entries Today", "Pending Sync", "Last Action" labels all carry this uppercase+tracking violation; all must be sentence case at `--type-label-dense` (11px/500)
- The crop selection panel eyebrow ("Crop selection") uses `text-xs uppercase tracking-[0.16em]` — same violation
- The "Final preview" panel eyebrow uses `text-xs uppercase tracking-[0.16em]` — same violation
- All four card section titles (`CardTitle`) use `text-2xl` (24px) — same heading scale violation as the main `h1`; must use `--type-panel-title` (16px/600) for section headings
- Card section sub-labels ("Identity", "Security", "Workspace", "Activity", "Actions") use plain `text-sm text-[var(--color-text-secondary)]` with `var(--color-text-secondary)` — forbidden raw legacy token alias; must use `text-text-secondary`
- `photoMessage` and `profileMessage` success text uses `text-emerald-300` — raw Tailwind color class; must use `text-status-success-fg`
- `photoError`, `profileError`, `securityError` use `text-red-300` and `text-red-400` — raw Tailwind color classes; must use `text-status-danger-fg`
- The "Status" stat shows `text-emerald-200` for "Active" — raw Tailwind; must use `text-status-success-fg`
- The session error banner uses `bg-[rgba(239,68,68,0.12)]` and `text-red-100` — raw hex rgba and raw color class; must use `status-danger-bg` and `text-status-danger-fg`
- All `var(--color-background-primary)`, `var(--color-background-secondary)`, `var(--color-border-secondary)`, `var(--color-border-info)`, `var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-text-secondary)` references — these are legacy token aliases that are not in the canonical token system (`--surface-app`, `--surface-card`, `--border-default`, `--text-primary`, `--text-secondary`); every one of them must be replaced
- The range slider inputs use `accent-[rgb(62,166,255)]` — raw RGB color; must use `accent-action-primary` or equivalent
- The "Logout" + "Switch account" actions are inside a `<details>/<summary>` element — forbidden pattern; must be replaced with a controlled disclosure or an always-visible action zone
- The mobile section collapse uses `expandedSections[key]` state with `"hidden lg:block"` class — this is a functional pattern but uses a CSS hide that creates accessibility issues (hidden elements are still in the accessibility tree); must use conditional rendering or `aria-hidden` + `data-state` approach
- The loading state renders `text-[var(--muted)]` — forbidden alias; must use `text-text-secondary` or `text-text-tertiary`
- The error state (when `!profile`) uses a raw `Card` component with `text-red-400` — forbidden; must use system StatusMessage with danger tone
- The password form "Forgot Password" link wraps a `Button` inside a `Link` — the same `<Link><Button>` accessibility violation from previous pages
- The profile photo avatar uses `border-[0.5px] border-[color:var(--color-border-info)]` and `bg-[rgba(var(--color-border-info),0.12)]` — arbitrary border shorthand, raw rgba background with legacy token
- `accent-[rgb(62,166,255)]` on range sliders — raw color forbidden; the crop UI uses raw pixel colors throughout
- The crop preview container uses `border border-[rgba(62,166,255,0.45)]` overlay — raw rgba color
- The page container uses `bg-[var(--color-background-primary)]` — legacy alias; must be `var(--surface-app)`

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Platform Administration | Self-service identity and security management; inside AppShell with sidebar |
| Workflow Category | Entry / Record | User reads static context (workspace access, activity) and edits mutable fields (name, phone, photo, password) |
| Operational Behavior | Mixed — Form-Driven sections with static display sections | Inline edit form (name/phone), photo upload + crop tool, password change form, static stat displays |
| Data Density | MEDIUM | Five sections, 8–12 stat items, photo upload with crop controls, two forms; manageable but information-dense on desktop |
| Realtime Complexity | LOW | `getSessionSummary()` and `getTodayEntries()` fire once on mount via `Promise.allSettled`; no subscriptions |
| AI Complexity | NONE | No AI systems |
| Audit Complexity | LOW | Backend writes `PROFILE_UPDATED`, `PROFILE_PHOTO_UPDATED`, `PROFILE_PHOTO_REMOVED`, `PASSWORD_CHANGED` — not surfaced in UI |
| Decision Pressure | LOW | On-demand, reflective workspace; no shift pressure; operators arrive at their own pace |

**Classification Implication:**
A MEDIUM-density, Mixed-behavior workspace inside the AppShell means this is the first Phase A workspace that lives within the operational context (not in a standalone auth shell). The page has five conceptual zones: Identity (photo + name/phone), Security (password + sessions), Workspace context (factory access display), Activity summary (entries/sync — role-gated), and Actions (logout). The two-column layout used on desktop (left: identity + security; right: workspace + activity) is structurally correct — it groups the mutable/actionable sections on the left and the read-only context sections on the right. The primary structural violations are (1) the hero section's gradient and oversized heading, (2) the pervasive uppercase+tracking on every stat label, (3) the `<details>/<summary>` for account actions, and (4) the 40+ legacy token alias references that must migrate to canonical tokens.

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Permission | Key Response Fields | Error States |
|---|---|---|---|---|---|
| `GET /auth/me` | GET | Fetches current user's full profile — session source of truth | Auth-required | `id`, `name`, `email`, `role`, `phone_number`, `profile_picture`, `last_login`, `email_verified_at`, `is_active`, `factory_name`, `org_id` | HTTP 401 if session expired |
| `PUT /auth/profile` | PUT | Updates `name` and/or `phone_number` (E.164 normalized); writes `PROFILE_UPDATED` audit event | Auth-required | Full `UserReadSchema` | HTTP 400 "Full name must be at least 2 characters." · HTTP 400 (phone format error from normalize_phone_e164) · HTTP 500 on unexpected error |
| `POST /auth/profile-photo` | POST | Accepts JPEG/PNG/etc. image; processes to 512×512 JPEG; saves to `var/profile_photos/`; writes `PROFILE_PHOTO_UPDATED` audit | Auth-required | Full `UserReadSchema` | HTTP 400 (not an image) · HTTP 413 (>5MB) · HTTP 400 (too small, <32×32) · HTTP 500 on processing failure |
| `DELETE /auth/profile-photo` | DELETE | Removes profile photo from disk and clears `user.profile_picture`; writes `PROFILE_PHOTO_REMOVED` audit | Auth-required | Full `UserReadSchema` | HTTP 500 on unexpected error |
| `POST /auth/change-password` | POST | Verifies old password, validates new password strength, updates both `AuthUser.password_hash` (argon2) and `User.password_hash` (bcrypt); writes `PASSWORD_CHANGED` audit | Auth-required | `{ message: "Password changed successfully." }` | HTTP 401 "Invalid credentials." (wrong old password) · HTTP 400 (new password fails strength check) · HTTP 500 on failure |
| `GET /auth/session-summary` | GET | Returns count of active (non-revoked, non-expired) `RefreshToken` records + last activity timestamp | Auth-required | `active_devices: int`, `last_activity: datetime \| null` | HTTP 401 if session expired |
| `POST /auth/logout` | POST | Revokes current session; clears auth cookies | Auth-required | `{ message: "Logged out." }` | None expected |
| `POST /auth/logout-all` | POST | Revokes all active `RefreshToken` records for user; clears auth cookies; invalidates session store | Auth-required | `{ message: "Logged out from all devices." }` | HTTP 500 on failure |
| `GET /entries` | GET | Fetches today's entries (for activity summary) — only called for operator/supervisor/manager/admin/owner roles | Auth-required | Array of entry objects | HTTP 401 if session expired |

**Backend constraints:**
- Photo: max 5MB, minimum 32×32px, must be image/* MIME type; server resizes to 512×512 JPEG at 88% quality before storage
- Password change: `validate_password_strength()` enforced server-side; minimum 12 chars, mixed case/number/symbol
- Profile name: minimum 2 chars after sanitization; `sanitize_text()` strips harmful content
- Phone: normalized to E.164 via `normalize_phone_e164()`; empty string treated as null (removes phone)

### 3.2 Entity Relationship Map

```
User (id, name, email, phone_number, phone_e164, profile_picture, role, last_login, org_id)
    │
    ├── UserFactoryRole (factory_id, role) ← shown in Workspace section
    ├── Organization (name, plan) ← shown in Workspace section
    ├── RefreshToken × N (active devices count) ← shown in Security section
    └── Entry × N (today's entries count) ← shown in Activity section (operator+)
```

**Primary entity:** `User` — all mutations target this record.
**Relationship implication:** Workspace section reads `UserFactoryRole` + `Organization` from session context (no additional API call needed); Activity section calls `GET /entries` only for roles with `roleCanSubmit()` = true.

### 3.3 Workflow State Machine

```
[PAGE LOAD]
    → useSession() hydrates user from session store
    → profile state set from user object
    → Promise.allSettled([getSessionSummary(), getTodayEntries(), countQueuedEntries()])
    → [LOADED] — all five sections rendered

[PROFILE EDIT]
    → user clicks "Edit" → editingProfile=true → form shown inline
    → user modifies name / phone → "Save" pressed
    → [PROFILE SAVING] profileBusy=true
        → HTTP 400/500 → profileError shown; editingProfile stays true
        → HTTP 200 → profile updated; editingProfile=false; profileMessage shown

[PHOTO SELECTION]
    → user clicks Upload or Take photo → file input opens
    → file selected → readImageDimensions() + createObjectURL() → crop UI shown
    → user adjusts zoom/offset → "Save photo" pressed
    → [PHOTO UPLOADING] photoBusy="upload"
        → error → photoError shown; crop UI stays
        → success → profile.profile_picture updated; crop UI cleared; photoMessage shown

[PASSWORD CHANGE]
    → user clicks "Change password" → showPasswordForm=true → 3-field form shown
    → user fills old + new + confirm → "Update password" pressed
    → [PASSWORD SAVING] passwordBusy=true
        → mismatch (client) → securityError shown; form stays
        → HTTP 401/400/500 → securityError shown; form stays
        → HTTP 200 → form cleared; showPasswordForm=false; securityMessage shown

[LOGOUT]
    → "Logout" clicked → handleLogout() → accountBusy="logout"
    → POST /auth/logout → window.location.href="/access"

[LOGOUT ALL DEVICES]
    → "Logout all" clicked → handleLogoutAllDevices() → accountBusy="logout_all"
    → POST /auth/logout-all
        → error → securityError shown; accountBusy=null
        → success → window.location.href="/access?logged_out=all"
```

### 3.4 Realtime Contracts

No subscriptions. Session summary and activity data fetched once on mount via `Promise.allSettled`. No refresh mechanism — data may be stale if the user stays on the page for extended periods. This is acceptable for this workspace's use case.

### 3.5 AI System Contracts

Not applicable.

### 3.6 Permission Matrix

| Role | Can edit name/phone | Can upload photo | Can change password | Can see activity section | Can see "Open settings" links |
|---|---|---|---|---|---|
| attendance | ✓ | ✓ | ✓ | ✗ (roleCanSubmit=false) | ✗ |
| operator | ✓ | ✓ | ✓ | ✓ | ✗ |
| supervisor | ✓ | ✓ | ✓ | ✓ | ✗ |
| accountant | ✓ | ✓ | ✓ | ✓ | ✗ |
| manager | ✓ | ✓ | ✓ | ✓ | ✗ |
| admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| owner | ✓ | ✓ | ✓ | ✓ | ✓ |

**Permission implication:** The `roleCanSubmit()` function gates the Activity section. All other sections are visible to all authenticated roles. No zone-level permission differences beyond the Activity section visibility.

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

```
FULL-WIDTH COMMAND with internal TWO-COLUMN GRID (desktop) / STACKED (mobile)
```

- Workspace is inside the AppShell (sidebar + topbar present)
- No left rail or right rail — content fills the main workspace frame
- Desktop layout: max-width 1152px, horizontally centered with page padding
- Page structure: page header zone → two-column content grid → full-width actions zone
- Desktop grid: left column (identity + security) / right column (workspace + activity)
- Mobile: all sections stack vertically; section expand/collapse via toggle buttons

**Pattern justification:** The profile workspace is a self-contained personal management surface. It needs the AppShell for navigation context but has no left data rail (no list to select from) and no right context rail (no entity relationship context needed). The two-column grid groups mutable actions (left) from read-only context (right) — a natural information hierarchy. The page header establishes identity before the sections.

**Structural reduction note:** The hero section with gradient background was reduced to a simple page header zone (eyebrow + 18px title + description). The gradient adds no operational value and violates anti-pattern rules. The `text-3xl` heading was reduced to `--type-page-title` (18px). The "Manage your profile and access" description is retained as useful orientation text.

---

### 4.2 Zone Definitions

---

#### ZONE: Page Header

| Property | Value |
|---|---|
| Operational Role | Orients user to the workspace; establishes identity with name and role; no interactive elements |
| Attention Priority | 4 |
| Position | top of main content area |
| Width | full width of content area |
| Height | content-driven (approximately 56–72px) |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | Provides workspace identity before sections; shows user's name + role as orientation anchor |

**Contents:**
- Eyebrow: "Account profile" — `--type-label-dense` (11px/500/`text-text-tertiary`/sentence case); NOT uppercase tracking
- Page title: "Your account" — `--type-page-title` (18px/600/sentence case); NOT `text-3xl`
- Description: "Manage your profile and access." — `--type-body` (14px/400/`text-text-secondary`)
- No background surface distinction — inherits `surface-shell` from the AppShell workspace frame

**Acceptance Criteria:**
- [ ] No gradient background — `surface-shell` only
- [ ] Eyebrow at 11px/500/sentence case — NOT uppercase tracking-[0.26em]
- [ ] Page title at 18px/600 — NOT text-3xl (30px)
- [ ] Description at 14px/400
- [ ] No border, no shadow on this zone

---

#### ZONE: Identity Section (left column, top)

| Property | Value |
|---|---|
| Operational Role | Displays and allows editing of name, phone number, and profile photo; the primary personal information zone |
| Attention Priority | 1 |
| Position | left column, first section |
| Width | ~52% desktop; 100% mobile |
| Height | content-driven; expands when editing or when crop UI is shown |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | `PUT /auth/profile` and `POST/DELETE /auth/profile-photo` — mutable user identity data |

**Sub-sections:**
- Section header: "Profile" — `--type-panel-title` (16px/600); section label "Identity" — `--type-label-dense` (11px/500/tertiary/sentence case); NOT `text-2xl`; "Edit" / "Cancel" button (right-aligned)
- Photo area (always visible):
  - Avatar display: 96×96px, `rounded-panel`, `surface-panel` bg, initials fallback, `<img>` when photo URL exists
  - "Profile photo" label: `--type-label-dense` (11px/500/`text-text-tertiary`/sentence case); NOT `text-xs uppercase tracking`
  - Photo action buttons: "Upload" (ghost), "Take photo" (outline — camera capture), "Remove photo" / "Cancel" (destructive — conditional on photo or selection existing)
- Stat display (when NOT editing): 2-column grid of stat cards — Name, Role, Phone, Email
  - Each stat card: `surface-shell` bg, `border-default`, `rounded-control`
  - Stat label: `--type-label-dense` (11px/500/`text-text-tertiary`/sentence case); NOT `text-xs uppercase tracking`
  - Stat value: `--type-body` (14px/500/`text-text-primary`)
- Edit form (when `editingProfile=true`): 2-column grid of Field components
  - Name, Phone fields (editable), Email, Role (read-only display with `surface-elevated` bg)
  - "Save" button (primary, `isBusy`), profileMessage (success: `text-status-success-fg`), profileError (danger: `text-status-danger-fg`)
- Crop UI (when photo selected, `selectedPhotoPreview` non-null):
  - Panel: `surface-panel` bg, `border-default`
  - Eyebrow: "Crop selection" — `--type-label-dense` (11px/500/tertiary/sentence case); NOT uppercase tracking
  - Crop canvas (aspect-square), zoom/offset range sliders
  - Preview panel with eyebrow: "Final preview" — sentence case
  - Range slider `accent-action-primary` — NOT `accent-[rgb(...)]`
  - "Save photo" button (primary, `isBusy`), "Reset crop" (ghost), "Cancel" (ghost)
- photoMessage: `text-status-success-fg` — NOT `text-emerald-300`
- photoError: `text-status-danger-fg` — NOT `text-red-300`

**Acceptance Criteria:**
- [ ] Section title at 16px/600 — NOT text-2xl
- [ ] Section label "Identity" at 11px/500/sentence case — NOT raw alias + uppercase
- [ ] All stat labels at 11px/500/sentence case — NOT uppercase tracking
- [ ] Surface classes use canonical tokens (surface-card, border-default, rounded-panel) — NOT arbitrary radius/border/legacy aliases
- [ ] No gradient in avatar area or any sub-section
- [ ] Range sliders use `accent-action-primary` — NOT raw RGB
- [ ] Crop canvas overlay uses semantic border token — NOT raw rgba
- [ ] "Remove photo" is `Button variant="destructive"` — only when photo or selection exists
- [ ] photoMessage uses `text-status-success-fg` — NOT `text-emerald-300`
- [ ] photoError uses `text-status-danger-fg` — NOT `text-red-300`
- [ ] "Profile photo" label at 11px/500/sentence case — NOT uppercase tracking

---

#### ZONE: Security Section (left column, bottom)

| Property | Value |
|---|---|
| Operational Role | Enables password change and session management (logout all devices); displays last login and active device count |
| Attention Priority | 2 |
| Position | left column, second section |
| Width | ~52% desktop; 100% mobile |
| Height | content-driven; expands when password form is shown |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | `POST /auth/change-password` and `POST /auth/logout-all`; `GET /auth/session-summary` |

**Contents:**
- Section header: "Password and sessions" — `--type-panel-title` (16px/600); section label "Security" — sentence case tertiary; mobile toggle button (+ / −)
- Stat cards (2-column): Last login (formatted date), Active devices (count from session summary)
  - Stat labels at 11px/500/sentence case — NOT uppercase tracking
- Action buttons: "Change password" (primary/ghost toggle), "Logout all devices" (outline, `isBusy`)
- Password form (conditional — `showPasswordForm=true`):
  - Container: `surface-panel` bg, `border-default`, `rounded-panel`
  - Three `PasswordField` components: "Current password", "New password" (autoComplete="new-password"), "Confirm new password"
  - Strength hint: "Use at least 12 characters with mixed case, a number, and a symbol." — `--type-body` (13px/400/`text-text-tertiary`)
  - "Update password" button (primary, `isBusy`), "Forgot password" link — `Link` styled as text, NOT `<Link><Button>`
  - securityMessage: `text-status-success-fg` — NOT `text-emerald-300`
  - securityError: `text-status-danger-fg` — NOT `text-red-300`

**Acceptance Criteria:**
- [ ] Section title at 16px/600 — NOT text-2xl
- [ ] Stat labels at 11px/500/sentence case — NOT uppercase tracking
- [ ] "Forgot password" link does NOT use `<Link><Button>` nesting — uses Link styled as text-action-primary
- [ ] Password form container uses canonical surface-panel + border-default
- [ ] securityMessage uses `text-status-success-fg`
- [ ] securityError uses `text-status-danger-fg`
- [ ] "Logout all devices" button has `isBusy` state and is disabled during logout_all action

---

#### ZONE: Workspace Context Section (right column, top)

| Property | Value |
|---|---|
| Operational Role | Displays current factory access context — factory name, role, active status, organization; read-only |
| Attention Priority | 3 |
| Position | right column, first section |
| Width | ~48% desktop; 100% mobile |
| Height | content-driven |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | Shows `activeFactory`, `organization`, `profile.role`, `profile.is_active` from session — helps operator verify they are in the correct factory context |

**Contents:**
- Section header: "Current access" — `--type-panel-title` (16px/600); section label "Workspace" — sentence case; mobile toggle
- Stat grid (2-column): Factory name, Role, Status (active/inactive), Organization
  - Status value: "Active" uses `text-status-success-fg` — NOT `text-emerald-200`
  - Stat labels at 11px/500/sentence case — NOT uppercase tracking

**Acceptance Criteria:**
- [ ] Section title at 16px/600 — NOT text-2xl
- [ ] Stat labels at 11px/500/sentence case
- [ ] "Active" status value uses `text-status-success-fg` — NOT `text-emerald-200`
- [ ] No interactive elements — read-only display

---

#### ZONE: Activity Section (right column, middle — role-gated)

| Property | Value |
|---|---|
| Operational Role | Shows operator's today entry count, pending offline sync queue, and last action timestamp; visible only for operator+ roles |
| Attention Priority | 3 |
| Position | right column, second section |
| Width | ~48% desktop; 100% mobile |
| Height | content-driven |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | `GET /entries` (today count) + `countQueuedEntries()` (offline queue) + session summary last_activity; operational signal for operators checking their sync status |

**Contents:**
- Section header: "Recent work" — `--type-panel-title` (16px/600); section label "Activity" — sentence case; mobile toggle; hidden for attendance role
- Three stat cards: "Entries today" (count), "Pending sync" (count), "Last action" (formatted datetime)
  - Stat labels at 11px/500/sentence case — NOT uppercase tracking
  - Count values: `--type-numeric-md` (18px/600) — these are meaningful counts, earn a larger scale
  - Timestamp value: `--type-timestamp` (11px/400/monospace) — JetBrains Mono for the datetime

**Acceptance Criteria:**
- [ ] Section hidden for attendance role (roleCanSubmit=false)
- [ ] Section title at 16px/600 — NOT text-2xl
- [ ] Stat labels at 11px/500/sentence case
- [ ] Count values at 18px/600 (--type-numeric-md) — earn numeric display scale
- [ ] Timestamp uses `--type-timestamp` (11px/monospace)

---

#### ZONE: Account Actions Section (full width, bottom)

| Property | Value |
|---|---|
| Operational Role | Provides session control actions (logout, switch account); always visible to all authenticated users |
| Attention Priority | 5 |
| Position | full width, below the two-column grid |
| Width | full content width |
| Height | content-driven |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | `POST /auth/logout` and `POST /auth/logout-all`; destructive account-level actions must have clear placement separate from profile edit actions |

**Contents:**
- Section header: "Account tools" — `--type-panel-title` (16px/600); section label "Actions" — sentence case; mobile toggle
- Description text: "Use these only when leaving this account or changing workspace context." — `--type-body` (14px/400/`text-text-secondary`)
- Action buttons (always visible — NOT inside `<details>/<summary>`):
  - "Sign out" (outline) — `isBusy` state "Signing out..."
  - "Switch account" (primary) — `isBusy` state "Switching..."
- securityMessage / securityError rendered below buttons if set

**Acceptance Criteria:**
- [ ] Actions NOT inside `<details>/<summary>` — always visible
- [ ] Section title at 16px/600 — NOT text-2xl
- [ ] "Sign out" button uses `variant="outline"` with `isBusy`
- [ ] "Switch account" button uses `variant="primary"` with `isBusy`
- [ ] Both buttons disabled when `accountBusy !== null`
- [ ] No raw color classes on status messages

### 4.3 Zone Interaction Rules

```yaml
zone_interactions:
  - trigger: user clicks "Edit" in Identity section
    effect: stat display grid → hidden; edit form shown inline with current values pre-filled
    reason: inline edit reduces navigation and preserves context visibility

  - trigger: user clicks "Save" in edit form (PUT /auth/profile)
    effect: profileBusy=true; on success → editingProfile=false; stats re-render with new values;
      profileMessage shown; on error → profileError shown; form stays open
    reason: optimistic UI — the form stays open on error so user can correct and retry

  - trigger: user clicks "Cancel" in edit form
    effect: editingProfile=false; profileForm reset to current profile values; errors cleared
    reason: user recovers from accidental edit mode without losing current data

  - trigger: file selected via Upload or Take photo input
    effect: crop UI appears below avatar; stat display / edit form not affected
    reason: photo selection is additive — crop UI layers below existing content, not replacing it

  - trigger: user clicks "Save photo" in crop UI (POST /auth/profile-photo)
    effect: photoBusy="upload"; on success → avatar updates; crop UI clears; photoMessage shown;
      on error → photoError shown; crop UI stays
    reason: avatar must update immediately after upload to confirm success visually

  - trigger: user clicks "Remove photo" (DELETE /auth/profile-photo)
    effect: photoBusy="remove"; on success → avatar shows initials; photoMessage shown
    reason: immediate avatar update confirms the removal

  - trigger: user clicks "Change password"
    effect: showPasswordForm=true; password form appears below action buttons; prior messages clear
    reason: password form is rare — hidden by default to reduce visual noise in the Security section

  - trigger: user clicks "Update password" (POST /auth/change-password)
    effect: passwordBusy=true; on success → form cleared; showPasswordForm=false; securityMessage shown;
      on error → securityError shown; form stays open
    reason: form stays open on error for correction

  - trigger: user clicks "Logout all devices" (POST /auth/logout-all)
    effect: accountBusy="logout_all"; securitySection messages clear;
      on error → securityError shown; accountBusy=null;
      on success → window.location.href="/access?logged_out=all"
    reason: destructive action navigates away on success; stays on page for error recovery

  - trigger: user clicks "Sign out" (POST /auth/logout)
    effect: accountBusy="logout"; on completion → window.location.href="/access"
    reason: sign-out always navigates to /access; no error state (logout always succeeds)

  - trigger: roleCanSubmit(user.role) === false (attendance role)
    effect: Activity section hidden entirely
    reason: attendance users have no entries to show; the section would show zeros with no meaning

  - trigger: mobile viewport (section toggle button clicked)
    effect: corresponding section content collapses / expands
    reason: mobile layout requires section management to prevent excessive scrolling
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

### 5.1 Scan Flow

```
SCAN LEVEL 1 (0–200ms): Page header (identity orientation)
────────────────────────────────────────────────────────────
  WHY: The page header with the user's context establishes "I'm in the right place."
  For a workspace accessed on-demand, orientation matters.

SCAN LEVEL 2 (200ms–1s): Identity section (photo + stat grid / edit form)
────────────────────────────────────────────────────────────────────────────
  WHY: The profile photo and identity stats are the primary content.
  The "Edit" button is visible immediately — the most common action on this page
  is editing name or phone.

SCAN LEVEL 3 (1s–3s): Security section + Workspace context
─────────────────────────────────────────────────────────────
  WHY: Password change and session management are the secondary actions.
  Workspace context is read-only reference — operators verify they're in
  the right factory, then move on.

SCAN LEVEL 4 (3s+): Activity section + Account actions
────────────────────────────────────────────────────────
  WHY: Activity is a sanity check (are my entries syncing?); operators
  may not check it every visit. Account actions (logout) are at the bottom
  because they are infrequent and should not compete with editing actions.
```

### 5.2 Persistent Visibility Requirements

The workspace scrolls — no persistent elements are required beyond the AppShell topbar. All sections are reachable by scrolling. The key design principle is: the most-used action (Edit profile) is visible immediately without scrolling on standard desktop viewports.

### 5.3 Contextual Visibility Rules

```yaml
contextual_rules:
  - condition: editingProfile === true
    shows: Edit form (name/phone/email-readonly/role-readonly) + Save + profileMessage/Error
    hides: Stat display grid
    reason: exclusive states; editing and reading are not shown simultaneously

  - condition: selectedPhotoPreview !== null
    shows: Crop UI below avatar area
    hides: nothing (crop UI is additive)
    reason: crop UI appears when a photo is staged for upload

  - condition: showPasswordForm === true
    shows: Password form (3 PasswordField components + strength hint + buttons)
    hides: nothing (additive)
    reason: password form appears below the security action buttons

  - condition: roleCanSubmit(user.role) === false
    shows: nothing extra
    hides: Activity section entirely
    reason: attendance roles have no entry data to display

  - condition: accountBusy !== null
    shows: isBusy spinner on the active button
    hides: nothing (other buttons disabled via disabled={accountBusy !== null})
    reason: prevent double-actions during async account operations
```

---

## 6. TABLE & DATA STRATEGY

No tables — workspace uses stat card grids for data display. No tabular data patterns needed.

---

## 7. FORM & INPUT STRATEGY

### 7.1 Form Roles

Three distinct forms exist, each gated by a separate trigger:

**Form 1 — Profile edit (`editingProfile=true`):**
- Purpose: Update `name` and `phone_number` via `PUT /auth/profile`
- Fields: Name (text), Phone (tel), Email (read-only display), Role (read-only display)
- Keyboard priority: MEDIUM — on-demand, not under time pressure
- Completion time: 15–30 seconds

**Form 2 — Password change (`showPasswordForm=true`):**
- Purpose: Update password via `POST /auth/change-password`
- Fields: Current password (password), New password (password), Confirm new password (password)
- Keyboard priority: MEDIUM
- Completion time: 20–40 seconds

**Form 3 — Photo crop (when `selectedPhotoPreview !== null`):**
- Purpose: Client-side crop before upload to `POST /auth/profile-photo`
- Fields: Zoom (range), Left/Right offset (range), Up/Down offset (range)
- No keyboard path — mouse/touch driven

### 7.2 Field Group Architecture

```yaml
profile_edit_fields:
  - name: name
    label: "Name"
    type: text
    required: yes
    validation: min_length=2 (client + server)
    tab_order: 1
    autoComplete: name
  - name: phone_number
    label: "Phone"
    type: tel
    required: no
    validation: E.164 format via validatePhoneNumber() if non-empty
    tab_order: 2
    autoComplete: tel
    inputMode: tel
    placeholder: "+91..."
  - name: email
    label: "Email"
    type: display (read-only)
    tab_order: — (not in tab sequence)
  - name: role
    label: "Role"
    type: display (read-only)
    tab_order: — (not in tab sequence)

password_change_fields:
  - name: old_password
    label: "Current password"
    type: password (PasswordField component with show/hide)
    required: yes
    autoComplete: current-password
    tab_order: 1
  - name: new_password
    label: "New password"
    type: password (PasswordField with show/hide)
    required: yes
    validation: min_length=12 (client enforces before submit); strength check server-side
    autoComplete: new-password
    tab_order: 2
  - name: confirm_password
    label: "Confirm new password"
    type: password (PasswordField with show/hide)
    required: yes
    validation: must match new_password (client check before submit)
    autoComplete: new-password
    tab_order: 3
```

### 7.3 Validation Strategy

```yaml
profile_edit:
  on_submit:
    - name: required, min_length=2
    - phone_number: validatePhoneNumber() if non-empty; empty is valid (removes phone)
  server_side:
    - HTTP 400 "Full name must be at least 2 characters."
    - HTTP 400 (phone normalization error)

password_change:
  on_submit_client:
    - new_password matches confirm_password
    - new_password min_length=12 (prevents round-trip for obviously too-short passwords)
  server_side:
    - HTTP 401 "Invalid credentials." (wrong current password)
    - HTTP 400 (password strength failure from validate_password_strength())
```

### 7.4 Keyboard Flow

```
Profile edit:
  [Name] → Tab → [Phone] → Tab → [Save button] → Enter

Password change:
  [Current password] → Tab → [New password] → Tab → [Confirm] → Tab → [Update password] → Enter
```

---

## 8. AI & AUDIT VISIBILITY STRATEGY

### 8.1 AI Placement Map
Not applicable.

### 8.2 Audit Visibility Map

```yaml
audit:
  backend_events:
    - PROFILE_UPDATED: written on PUT /auth/profile success
    - PROFILE_PHOTO_UPDATED: written on POST /auth/profile-photo success
    - PROFILE_PHOTO_REMOVED: written on DELETE /auth/profile-photo success
    - PASSWORD_CHANGED: written on POST /auth/change-password success
  frontend_display: none — no audit timeline shown on the profile page
  notes: >
    These events are accessible to admin/owner via premium audit trail.
    No need to surface them here — the success/error messages are sufficient
    operational feedback for the profile actions.
```

### 8.3 Anomaly Visibility
Not applicable.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

### 9.1 Density Mode

```yaml
default_density: default
density_justification: On-demand personal management workspace; no time pressure; default
  density provides comfortable reading and editing. The stat cards benefit from 12px
  horizontal padding and 8px vertical — compact enough to fit 2 per row without crowding.
density_switchable: yes — inherits AppShell density control; but density changes here
  primarily affect section gaps, not the core card layout
density_specs:
  section_gap: 24px (--space-lg)
  card_padding: 20px (--space-5) for section cards
  stat_card_padding: 12px horizontal / 12px vertical (--space-3)
  form_field_gap: 16px (--space-md)
  form_group_padding: 20px (--space-5) for password form container
  button_height: 40px standard; 42px primary CTAs
```

### 9.2 Spacing Rhythm

```yaml
spacing:
  page_padding_horizontal: 24px–40px (AppShell standard)
  page_padding_vertical: 24px top
  page_header_bottom_gap: 24px (--space-lg)
  section_card_gap: 24px (--space-lg) between cards within a column
  column_gap: 24px (--space-lg) between left and right columns
  card_header_to_content: 16px (--space-md)
  stat_grid_gap: 12px (--space-3)
  photo_area_gap: 16px (--space-md) between photo column and identity fields
  crop_ui_gap: 16px (--space-md) between crop canvas and preview panel
```

### 9.3 Typography Specification

```yaml
typography:
  page_eyebrow: 11px / 500 / sentence case / text-text-tertiary  (--type-label-dense)
  page_title: 18px / 600 / sentence case  (--type-page-title)
  page_description: 14px / 400 / text-text-secondary  (--type-body)
  section_sublabel: 11px / 500 / sentence case / text-text-tertiary  (--type-label-dense)
  section_title: 16px / 600 / sentence case  (--type-panel-title)
  stat_label: 11px / 500 / sentence case / text-text-tertiary  (--type-label-dense) — NOT uppercase tracking
  stat_value_text: 14px / 500 / text-text-primary  (--type-body / medium weight)
  stat_value_numeric: 18px / 600 / tabular-nums  (--type-numeric-md)  — entries today / pending sync
  stat_value_timestamp: 11px / 400 / monospace  (--type-timestamp / JetBrains Mono)  — last action
  crop_eyebrow: 11px / 500 / sentence case / text-text-tertiary  (--type-label-dense) — NOT uppercase tracking
  form_label: 13px / 500 / sentence case  (--type-label / system Label primitive)
  form_input: 14px / 400
  password_hint: 13px / 400 / text-text-tertiary  (--type-body / tertiary)
  success_feedback: 13px / 400 / text-status-success-fg
  error_feedback: 13px / 400 / text-status-danger-fg
  button_label: 14px / 500 / sentence case
```

### 9.4 Surface Token Hierarchy

```yaml
surfaces:
  page_background: var(--surface-shell)  — inherits from AppShell workspace frame
  section_card: var(--surface-card) with var(--border-subtle) border
    # border-subtle sufficient — surface-card already differentiated from surface-shell
    # NO arbitrary shadow values; NO gradient fills
  stat_card: var(--surface-elevated) with var(--border-subtle) border
    # one level above section-card
  edit_form_container: var(--surface-elevated)  — same as stat-card, no extra border needed when inside section-card
  password_form_container: var(--surface-panel) with var(--border-default) border
    # password form needs slightly more visual separation — slightly higher contrast border
  crop_ui_container: var(--surface-panel) with var(--border-default) border
  avatar_container: var(--surface-panel) with var(--border-subtle) border  — rounded-panel
  success_message: var(--status-success-bg) optional; or just text-status-success-fg inline
  error_message: var(--status-danger-bg) optional; or just text-status-danger-fg inline
  session_error_banner: var(--status-danger-bg) with var(--status-danger-border)
  status_active_text: var(--status-success-fg)
```

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

### 10.1 Desktop (Primary)

```yaml
desktop:
  min_width: 1280px
  layout: two-column grid (left ~52% / right ~48%)
  max_content_width: 1152px
  all_sections_visible: yes
  density_mode: default
  section_expand_buttons: hidden (lg:hidden on toggle buttons)
```

### 10.2 Compact Desktop

```yaml
compact_desktop:
  width_range: 1024px–1279px
  layout: two-column grid maintained; column widths may equalize
  section_expand_buttons: hidden (desktop — all sections expanded)
```

### 10.3 Mobile / Tablet

```yaml
mobile:
  width_range: <768px
  layout: single column, all sections stacked vertically
  section_management: each section has a toggle button (+/−) at mobile breakpoints
    — section state managed via expandedSections state
    — default state: security and workspace collapsed; identity expanded
    — Accessibility: toggle buttons must use aria-expanded + aria-controls for screen reader
    — Accessibility fix: currently using "hidden lg:block" CSS — must use conditional rendering
      or aria-hidden approach so collapsed content is not in accessibility tree
  touch_targets:
    - all buttons: ≥44px height
    - photo action buttons: ≥44px height
    - range sliders: ≥44px touch height
```

---

## 11. COMPONENT MAPPING

```yaml
component_mapping:
  workspace_container:
    component: <main> (inside AppShell workspace frame)
    classes: min-h-screen px-6 py-6 md:px-10 lg:py-8

  page_header:
    component: inline semantic HTML (no Card)
    reason: page header does not need surface elevation; it is orientation text

  section_cards:
    component: SectionPanel or Card
    surface: surface-card with border-subtle
    reason: each section is a distinct operational zone; Card is appropriate here
    critical_fix: remove all arbitrary radius/border/shadow from current profileSurfaceClass;
      replace with canonical token classes

  stat_cards:
    component: inline <div> with surface-elevated + border-subtle + rounded-control
    reason: stat items are sub-items within a section; surface-elevated on surface-card
      provides correct depth hierarchy
    critical_fix: replace profileStatClass with canonical classes

  forms:
    - profile_edit:
        component: HTML fields with system Field + Label + Input primitives
        layout: 2-column grid on sm+; stacked on mobile
    - password_change:
        component: PasswordField system primitive × 3
        container: surface-panel + border-default + rounded-panel
    - photo_crop:
        component: inline <label> + <input type="range"> with accent-action-primary
        container: surface-panel + border-default

  action_elements:
    - edit_profile_button: Button variant="primary" / "ghost" (toggle)
    - save_profile_button: Button variant="primary" isBusy busyLabel="Saving..."
    - upload_photo_button: Button variant="ghost"
    - take_photo_button: Button variant="outline"
    - remove_photo_button: Button variant="destructive"
    - save_photo_button: Button variant="primary" isBusy busyLabel="Uploading..."
    - change_password_button: Button variant="primary" / "ghost" (toggle)
    - update_password_button: Button variant="primary" isBusy busyLabel="Updating..."
    - forgot_password_link: Link styled as text-action-primary — NOT <Link><Button>
    - logout_all_button: Button variant="outline" isBusy
    - sign_out_button: Button variant="outline" isBusy busyLabel="Signing out..."
    - switch_account_button: Button variant="primary" isBusy busyLabel="Switching..."

  status_elements:
    - photoMessage: <p> text-status-success-fg (inline) — NOT text-emerald-300
    - photoError: <p> text-status-danger-fg (inline) — NOT text-red-300
    - profileMessage: <p> text-status-success-fg — NOT text-emerald-300
    - profileError: <p> text-status-danger-fg — NOT text-red-300
    - securityMessage: <p> text-status-success-fg — NOT text-emerald-300
    - securityError: <p> text-status-danger-fg — NOT text-red-300
    - sessionError: StatusMessage variant="error" (status-danger-bg/border/fg)

  loading_state:
    component: WorkstationShell loading pattern or centered spinner
    fix: remove text-[var(--muted)] — use text-text-secondary

  error_state_no_profile:
    component: StatusMessage variant="error" + Link to /access
    fix: remove raw text-red-400 + raw Card usage; use system StatusMessage

missing_components: none — all primitives exist in the component library
```

---

## 12. OPERATIONAL PROBLEMS SOLVED

```yaml
problem_resolutions:
  - problem: Hero section uses bg-[linear-gradient(135deg,...)] — gradient forbidden
    root_cause: Developer added a subtle gradient for visual polish; forbidden at all phases
    structural_solution: Section 9.4 specifies page background uses surface-shell only;
      Section 4.2 page header zone spec requires no background surface distinction;
      gradient removed entirely
    section_reference: Section 9.4, Section 4.2
    measurable_outcome: Zero gradient values in the workspace

  - problem: h1 uses text-3xl (30px); all CardTitle use text-2xl (24px) — all above 18px ceiling
    root_cause: Arbitrary Tailwind heading scale used without governance check; same root
      cause as every heading violation in Phase A
    structural_solution: Section 9.3 specifies page_title at 18px/600 (--type-page-title)
      and section_title at 16px/600 (--type-panel-title); Section 4.2 zone specs require
      specific sizes for each heading
    section_reference: Section 9.3, Section 4.2
    measurable_outcome: page h1=18px; all section CardTitle=16px; heading ceiling respected

  - problem: All stat labels use uppercase tracking-[0.16em] — tracking 2.7× maximum
    root_cause: Stat card pattern copied from legacy code that pre-dates typography governance;
      the "Name", "Role", "Phone", etc. labels carry this violation on every stat card
    structural_solution: Section 9.3 specifies stat_label at 11px/500/sentence case/--type-label-dense;
      zero tracking; every stat card zone in Section 4.2 explicitly requires sentence case
    section_reference: Section 9.3, Section 4.2 (all stat sections)
    measurable_outcome: All 10+ stat labels render in sentence case; zero uppercase tracking

  - problem: All color/surface references use legacy alias tokens (var(--color-background-primary), etc.)
    root_cause: The profileSurfaceClass and profileStatClass constants encode legacy token aliases;
      all inline styles throughout the component use the same alias system
    structural_solution: Section 9.4 maps every surface to canonical tokens (surface-card,
      surface-elevated, surface-panel, border-default, border-subtle); Section 11 component
      mapping specifies canonical classes for every element type; Section 4.2 zone specs
      explicitly name canonical tokens
    section_reference: Section 9.4, Section 11, Section 4.2
    measurable_outcome: Zero var(--color-*) legacy alias references; all surfaces use
      canonical surface-* and border-* token classes

  - problem: Success messages use text-emerald-300; error messages use text-red-300/text-red-400
    root_cause: Raw Tailwind color classes used for status feedback; no semantic token mapping
    structural_solution: Section 9.3 specifies success_feedback at text-status-success-fg
      and error_feedback at text-status-danger-fg; Section 11 component mapping specifies
      the correct class names; Section 4.2 zone acceptance criteria explicitly require these classes
    section_reference: Section 9.3, Section 11, Section 4.2
    measurable_outcome: All feedback text uses semantic token classes; zero raw Tailwind color classes

  - problem: Account actions inside <details>/<summary> — forbidden pattern
    root_cause: Developer used HTML disclosure primitive for the "Open account actions" toggle;
      same pattern forbidden across the codebase
    structural_solution: Section 4.2 Account Actions zone spec requires actions to be always
      visible (NOT inside details/summary); description text explains when to use them;
      Section 4.3 zone interactions do not include a collapse trigger for this section
    section_reference: Section 4.2 (Account Actions), Section 1.3
    measurable_outcome: "Sign out" and "Switch account" are always visible below the description text

  - problem: <Link><Button> nesting on "Forgot password" link in password form
    root_cause: Same accessibility violation flagged in verify-email, access, and factory-required
    structural_solution: Section 4.2 Security section specifies "Forgot password" as a Link
      styled as text-action-primary (NOT <Link><Button>); Section 11 component mapping
      specifies the correct pattern
    section_reference: Section 4.2, Section 11
    measurable_outcome: Zero <a><button> nested interactive element violations

  - problem: range slider inputs use accent-[rgb(62,166,255)] and crop overlay uses
      border border-[rgba(62,166,255,0.45)] — raw RGB colors
    root_cause: The crop UI was built with hard-coded brand blue RGB without token mapping
    structural_solution: Section 9.4 specifies crop_ui uses canonical tokens;
      Section 4.2 Identity section acceptance criteria require accent-action-primary on sliders
    section_reference: Section 9.4, Section 4.2
    measurable_outcome: All crop UI interactive elements use semantic token classes

  - problem: Mobile section collapse uses "hidden lg:block" CSS — hidden content remains
      in accessibility tree
    root_cause: CSS-only hide pattern used for mobile expand/collapse; screen readers
      can still access collapsed content which creates navigation confusion
    structural_solution: Section 10.3 mobile adaptation specifies conditional rendering
      or aria-hidden + data-state approach; toggle buttons must use aria-expanded + aria-controls
    section_reference: Section 10.3
    measurable_outcome: Collapsed sections are removed from accessibility tree;
      toggle buttons announce state correctly to screen readers
```

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

```yaml
implementation_sequence:
  step_1: Fix all legacy token aliases (var(--color-background-*), var(--color-border-*),
    var(--color-text-*)) → replace with canonical surface-*, border-*, text-* token classes
    throughout the entire component file
  step_2: Remove gradient from page header/hero section; fix h1 from text-3xl to 18px
  step_3: Fix all CardTitle from text-2xl to text-[16px] font-semibold (--type-panel-title)
  step_4: Fix all stat labels from text-xs uppercase tracking to --type-label-dense
    (11px/500/sentence case); affects 10+ stat items across Identity, Security, Workspace,
    Activity sections
  step_5: Fix section sub-labels ("Identity", "Security", etc.) from raw alias to
    text-text-tertiary with --type-label-dense styling; sentence case
  step_6: Replace profileSurfaceClass with canonical Card surface (surface-card border-subtle
    rounded-panel); remove all arbitrary radius/border shorthand/shadow
  step_7: Replace profileStatClass with canonical stat card (surface-elevated border-subtle
    rounded-control)
  step_8: Fix all success/error feedback text (text-emerald-300 → text-status-success-fg,
    text-red-300 → text-status-danger-fg)
  step_9: Remove <details>/<summary> from Account Actions; make Sign out + Switch account
    always visible with description text
  step_10: Fix <Link><Button> nesting on "Forgot password" → Link with text-action-primary class
  step_11: Fix range slider accent and crop overlay border to use token classes
  step_12: Fix mobile section collapse — replace "hidden lg:block" CSS with conditional
    rendering + aria-expanded + aria-controls on toggle buttons
  step_13: Fix loading state text-[var(--muted)] → text-text-secondary
  step_14: Fix no-profile error state: replace raw Card + text-red-400 with system
    StatusMessage variant="error" + Link to /access
  step_15: Verify Activity section uses --type-numeric-md (18px/600) for count values
    and --type-timestamp for last-action datetime
  step_16: Responsive verification — touch targets ≥44px on all interactive elements
```

### 13.2 Critical Constraints

```yaml
critical_constraints:
  - "Step 1 is the foundation — all legacy alias replacements must happen before any
     other visual fix is applied; the alias system and the canonical system will conflict
     if mixed"
  - "Gradient removal is non-negotiable — the gradient is forbidden at all phases;
     no partial gradient is acceptable"
  - "Do NOT use <details>/<summary> for the account actions — always visible is required"
  - "The photo upload + crop functionality must remain fully functional through all surface
     token migrations — do not break the crop canvas rendering while fixing CSS classes"
  - "The Activity section (entries today / pending sync) must remain hidden for attendance
     role — roleCanSubmit() check must be preserved"
  - "All form submissions must use isBusy pattern — the save/update/upload buttons must
     show a spinner via isBusy prop, not just disabled state"
  - "changePassword confirm check must remain client-side before POST to avoid a round-trip
     for the password mismatch case"
  - "Do not modify AppShell scroll architecture"
  - "All spacing values must follow 4px base scale"
```

### 13.3 Open Questions

```yaml
open_questions:
  - question: >
      The "Take photo" button uses a camera capture input (<input capture="user">).
      On desktop this falls back to the regular file picker (no capture). Should "Take photo"
      be hidden on desktop (where camera capture is not meaningful) or kept as a universal
      fallback file picker? Currently it shows on all viewports.
    blocking: no — showing it on all viewports is functional; hiding on desktop is a UX
      refinement question only
    owner: product owner
    decision_needed_by: before step_11

  - question: >
      The activity "Last action" timestamp currently uses the later of session_summary.last_activity
      and user.last_login. Should this be shown as a relative time ("3 hours ago") using a
      formatting utility, or as the current formatted absolute date (formatDateTime)?
      Relative time is more meaningful for a "recent activity" signal.
    blocking: no — current absolute format is functional; relative time is a UX improvement
    owner: product owner
    decision_needed_by: informational

open_questions_blocking: none
```

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections fully populated
- [x] Every zone has documented existence justification and testable acceptance criteria
- [x] Every component mapped to existing primitives
- [x] Every operational failure from Section 1.3 has a resolution in Section 12
- [x] Reduction audit: gradient hero removed; text-3xl reduced; all text-2xl reduced
- [x] No anti-patterns in spec (no gradients, no glow, no uppercase labels)
- [x] All spacing follows 4px scale
- [x] All surfaces reference token variables
- [x] Typography follows approved system exactly
- [x] Backend API surface verified from auth.py source (all 9 endpoints confirmed)
- [x] Permission matrix complete with roleCanSubmit gate for Activity section
- [x] Open questions populated; none blocking
- [x] Implementation sequence complete (16 steps)

---

## POST-GENERATION SELF-VALIDATION

```yaml
self_validation:
  operational_integrity:
    - [x] All zones traced to backend entities or session state
    - [x] Every zone justified by operator need
    - [x] No decorative zones — gradient hero reduced to simple orientation text
    - [x] Removed elements documented (gradient, text-3xl, text-2xl×4, uppercase tracking×10+,
          <details>/<summary>, <Link><Button>, raw rgba/hex/RGB colors, legacy alias tokens×40+)

  law_compliance:
    - [x] All spacing 4px scale (12px, 16px, 20px, 24px, 40px)
    - [x] All surfaces use canonical token variables
    - [x] All labels sentence case — no uppercase labels in spec
    - [x] Typography from approved system (11px/500, 13px/400, 14px/400, 16px/600, 18px/600)
    - [x] Numeric values use --type-numeric-md; timestamps use --type-timestamp
    - [x] No AI elements

  kiro_readiness:
    - [x] 16-step implementation sequence
    - [x] All acceptance criteria testable
    - [x] No blocking open questions

  anti_pattern_check:
    - [x] No gradients specified in spec
    - [x] No glow effects
    - [x] No pulse on static elements
    - [x] No uppercase labels
    - [x] No marketing typography
    - [x] No invented workflows
    - [x] No <details>/<summary>
    - [x] No <Link><Button> nesting
    - [x] No raw hex / rgba / RGB colors in spec

  structural_integrity:
    - [x] Zone interactions cover all async operations and their outcomes
    - [x] Permission matrix documents roleCanSubmit() gate for Activity section
    - [x] Mobile section collapse addressed with accessibility requirements
    - [x] All problem resolutions reference specific spec sections
    - [x] The 40+ legacy alias token violations consolidated into step_1 of implementation
```

---

## 14. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

---

### 14A. Desktop Structural Blueprint

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  APP SHELL TOPBAR (48px) + SIDEBAR (220px left) — not part of profile spec             │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  PROFILE WORKSPACE FRAME  (surface-shell, inside AppShell)                              │
│  px-6 md:px-10 py-6 max-w-[1152px] centered                                            │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │  PAGE HEADER                                                                    │    │
│  │  "Account profile"  11px/500/tertiary/sentence case (--type-label-dense)        │    │
│  │  "Your account"     18px/600/sentence case           (--type-page-title)        │    │
│  │  "Manage your profile and access."  14px/400/secondary                          │    │
│  │  NO background / NO gradient / NO border / NO shadow                           │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│  ↕ 24px (--space-lg)                                                                    │
│  ┌──────────────────────────────────────┬──────────────────────────────────────────┐   │
│  │  LEFT COLUMN (~52%)                  │  RIGHT COLUMN (~48%)                     │   │
│  │  gap: 24px between cards             │  gap: 24px between cards                 │   │
│  │                                      │                                          │   │
│  │  ┌──────────────────────────────┐    │  ┌───────────────────────────────────┐   │   │
│  │  │ IDENTITY SECTION             │    │  │ WORKSPACE CONTEXT SECTION         │   │   │
│  │  │ surface-card / border-subtle │    │  │ surface-card / border-subtle       │   │   │
│  │  │ ─────────────────────────── │    │  │ ─────────────────────────────────  │   │   │
│  │  │ "Identity"  11px/500/tertiary│    │  │ "Workspace"  11px/500/tertiary     │   │   │
│  │  │ "Profile"   16px/600        │    │  │ "Current access"  16px/600         │   │   │
│  │  │               [Edit/Cancel] │    │  │                                    │   │   │
│  │  │ ─────────────────────────── │    │  │ Stat grid (2-col):                 │   │   │
│  │  │ [avatar 96×96]  [Upload]    │    │  │ ┌──────────┐ ┌──────────┐         │   │   │
│  │  │                 [Take photo]│    │  │ │ Factory  │ │ Role     │         │   │   │
│  │  │ "Profile photo"             │    │  │ │ 11px/500 │ │ 11px/500 │         │   │   │
│  │  │  11px/500/tertiary          │    │  │ │ value    │ │ value    │         │   │   │
│  │  │  [Remove photo] ← cond.     │    │  │ └──────────┘ └──────────┘         │   │   │
│  │  │                             │    │  │ ┌──────────┐ ┌──────────┐         │   │   │
│  │  │ [CROP UI — when photo staged]│    │  │ │ Status   │ │ Org      │         │   │   │
│  │  │ surface-panel / border-def  │    │  │ │ 11px/500 │ │ 11px/500 │         │   │   │
│  │  │ "Crop selection" 11px/500   │    │  │ │ Active   │ │ name     │         │   │   │
│  │  │  (sentence case — NOT UPPER)│    │  │ │ success  │ │ value    │         │   │   │
│  │  │ [canvas] [zoom/x/y sliders] │    │  │ └──────────┘ └──────────┘         │   │   │
│  │  │ accent-action-primary        │    │  └───────────────────────────────────┘   │   │
│  │  │ [Save photo] [Reset] [Cancel]│    │  ↕ 24px                                  │   │
│  │  │                             │    │                                          │   │
│  │  │ STAT GRID / EDIT FORM (alt) │    │  ┌───────────────────────────────────┐   │   │
│  │  │ [Name] [Role] [Phone][Email] │    │  │ ACTIVITY SECTION (operator+ only) │   │   │
│  │  │  stat labels 11px/500/lower  │    │  │ surface-card / border-subtle       │   │   │
│  │  │  stat values 14px/500/primary│    │  │ "Activity"  11px/500/tertiary      │   │   │
│  │  │                             │    │  │ "Recent work"  16px/600            │   │   │
│  │  │ [profile/photo messages]    │    │  │                                    │   │   │
│  │  └──────────────────────────────┘    │  │ ┌────────────────────────────┐    │   │   │
│  │  ↕ 24px                              │  │ │ Entries today              │    │   │   │
│  │                                      │  │ │ 11px/500/tertiary          │    │   │   │
│  │  ┌──────────────────────────────┐    │  │ │ 18px/600 (numeric scale)   │    │   │   │
│  │  │ SECURITY SECTION             │    │  │ └────────────────────────────┘    │   │   │
│  │  │ surface-card / border-subtle │    │  │ ┌────────────────────────────┐    │   │   │
│  │  │ "Security"  11px/500/tertiary│    │  │ │ Pending sync               │    │   │   │
│  │  │ "Password and sessions" 16px │    │  │ │ 11px/500/tertiary          │    │   │   │
│  │  │                             │    │  │ │ 18px/600 (numeric scale)   │    │   │   │
│  │  │ Stats: Last login │ Devices  │    │  │ └────────────────────────────┘    │   │   │
│  │  │  (11px/500/sentence case)   │    │  │ ┌────────────────────────────┐    │   │   │
│  │  │                             │    │  │ │ Last action                │    │   │   │
│  │  │ [Change password] [Logout all]│    │  │ │ 11px/500/tertiary          │    │   │   │
│  │  │                             │    │  │ │ 11px/mono (--type-timestamp)│    │   │   │
│  │  │ [PASSWORD FORM — cond.]     │    │  │ └────────────────────────────┘    │   │   │
│  │  │ surface-panel / border-def  │    │  └───────────────────────────────────┘   │   │
│  │  │ [Current pw] [New pw]       │    │                                          │   │
│  │  │ [Confirm pw]                │    │                                          │   │
│  │  │ "12+ chars, mixed..." 13px  │    │                                          │   │
│  │  │ [Update pw] [Forgot pw link]│    │                                          │   │
│  │  │  ↑ Link text-action-primary  │    │                                          │   │
│  │  │  NOT <Link><Button>          │    │                                          │   │
│  │  │ [security messages]         │    │                                          │   │
│  │  └──────────────────────────────┘    │                                          │   │
│  └──────────────────────────────────────┴──────────────────────────────────────────┘   │
│  ↕ 24px                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │  ACCOUNT ACTIONS SECTION  (full width)  surface-card / border-subtle            │    │
│  │  "Actions"  11px/500/tertiary/sentence case                                     │    │
│  │  "Account tools"  16px/600                                                      │    │
│  │  "Use these only when leaving..." 14px/400/secondary                            │    │
│  │  [Sign out] (outline)   [Switch account] (primary)                             │    │
│  │  ALWAYS VISIBLE — NOT inside <details>/<summary>                               │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 14B. Visual Attention Flow Map

```
SCAN LEVEL 1 (0–200ms): Page header + Identity section card (left column, top)
────────────────────────────────────────────────────────────────────────────────
  The profile/avatar area + "Edit" button captures immediate attention. Most visits
  to the profile page are for editing — the "Edit" button must be visible in the
  first 200ms without scrolling.

SCAN LEVEL 2 (200ms–1s): Identity stat grid or edit form
──────────────────────────────────────────────────────────
  Name, role, phone, email are the primary data. When editing, the form occupies
  this space. The stat labels at 11px/500/sentence case are calibrated to be
  readable but not dominant — the values are what matter.

SCAN LEVEL 3 (1s–3s): Security section + Workspace context
────────────────────────────────────────────────────────────
  "Change password" and "Logout all" are the next-priority actions. Factory name
  and organization in the Workspace section give the operator confirmation that
  they're in the right context before making account changes.

SCAN LEVEL 4 (3s+): Activity summary + Account actions
────────────────────────────────────────────────────────
  Entries today and pending sync are sanity-check signals. Account actions
  (sign out, switch) are last because they are rare and should not compete
  visually with the more frequent editing actions.
```

---

### 14C. Spacing & Rhythm Visualization

```
DENSE: Stat card grids (12px padding, 12px gap) — multiple data points in compact space
BREATHABLE: Section card padding (20px) — each section needs room for its sub-elements
VISUAL SILENCE: Column gap (24px) between left and right columns creates clear domain separation
  Left = mutable/actionable | Right = read-only context
  The gap communicates: "these are different kinds of information"
```

---

### 14D. Component Nesting Hierarchy

```
<main> (AppShell workspace frame)
  ├── PageHeader (no card — orientation text)
  │     ├── <p> eyebrow (11px/500/tertiary)
  │     ├── <h1> (18px/600)
  │     └── <p> description (14px/400)
  │
  ├── TwoColumnGrid
  │     ├── LeftColumn
  │     │     ├── Card (surface-card/border-subtle) ← Identity Section
  │     │     │     ├── SectionSubLabel + SectionTitle + EditButton
  │     │     │     ├── PhotoArea
  │     │     │     │     ├── Avatar (96×96, rounded-panel)
  │     │     │     │     ├── PhotoLabel (11px/500/tertiary/sentence case)
  │     │     │     │     └── PhotoActions (Upload/TakePhoto/Remove)
  │     │     │     ├── CropUI (conditional)
  │     │     │     │     ├── CropCanvas + RangeSliders (accent-action-primary)
  │     │     │     │     └── SavePhoto/Reset/Cancel buttons
  │     │     │     ├── StatGrid (when !editingProfile) — 4 stat cards (surface-elevated)
  │     │     │     └── EditForm (when editingProfile) — Field×4 + Save button
  │     │     │
  │     │     └── Card (surface-card/border-subtle) ← Security Section
  │     │           ├── SectionSubLabel + SectionTitle + MobileToggle
  │     │           ├── StatGrid (2 stats: last login, active devices)
  │     │           ├── ActionRow (Change password / Logout all devices)
  │     │           └── PasswordForm (conditional — surface-panel/border-default)
  │     │                 ├── PasswordField × 3
  │     │                 ├── StrengthHint (13px/400/tertiary)
  │     │                 └── UpdatePassword button + ForgotPassword Link
  │     │
  │     └── RightColumn
  │           ├── Card (surface-card/border-subtle) ← Workspace Section
  │           │     ├── SectionSubLabel + SectionTitle + MobileToggle
  │           │     └── StatGrid (4 stats: factory, role, status, org)
  │           │
  │           └── Card (surface-card/border-subtle) ← Activity Section (operator+ only)
  │                 ├── SectionSubLabel + SectionTitle + MobileToggle
  │                 └── StatStack (3 stats: entries today [18px], pending sync [18px], last action [mono])
  │
  └── Card (surface-card/border-subtle) ← Account Actions Section (full width)
        ├── SectionSubLabel + SectionTitle + MobileToggle
        ├── Description text (14px/400/secondary)
        └── ActionRow (Sign out [outline] + Switch account [primary])
              — ALWAYS VISIBLE — NOT <details>/<summary>
```

---

### 14E. Responsive Collapse Blueprint

```
1280px+ (Desktop):
┌────────────────────────────────────────────────────────────────────────────┐
│  PageHeader (full width)                                                   │
├──────────────────────────────────┬─────────────────────────────────────────┤
│  LEFT COLUMN (~52%)              │  RIGHT COLUMN (~48%)                    │
│  Identity Card                   │  Workspace Card                         │
│  Security Card                   │  Activity Card (operator+)              │
├──────────────────────────────────┴─────────────────────────────────────────┤
│  Account Actions Card (full width)                                         │
└────────────────────────────────────────────────────────────────────────────┘
Section toggle buttons: hidden (all sections expanded by default on desktop)

<768px (Mobile — stacked):
┌────────────────────────────────────┐
│  PageHeader                        │
├────────────────────────────────────┤
│  Identity Card [expanded]          │
│  [+ toggle button visible]         │
├────────────────────────────────────┤
│  Security Card [collapsed default] │
│  [+ toggle button]                 │
├────────────────────────────────────┤
│  Workspace Card [collapsed default]│
├────────────────────────────────────┤
│  Activity Card [operator+ only]    │
├────────────────────────────────────┤
│  Account Actions [always visible]  │
└────────────────────────────────────┘

Mobile accessibility fix:
  - Toggle buttons: aria-expanded={expandedSections[key]} aria-controls="{key}-content"
  - Collapsed content: conditional render (not "hidden" CSS class)
  - All buttons ≥44px height
```

---

### 14F. Structural Consistency Validation

```yaml
structural_validation:
  - [x] All zones justified by operational necessity (no decorative zones)
  - [x] Visual dominance: Identity section (top-left, P:1) dominates; Account Actions (bottom) last
  - [x] Spacing rhythm follows density specs throughout
  - [x] Mobile adaptations preserve all critical actions with accessibility requirements
  - [x] Component nesting hierarchy matches Section 11
  - [x] Two-column layout is minimum required for this data density on desktop
  - [x] No redundant information surfaces (role shown in Identity; Workspace section shows context,
        not the same role card duplicated)
  - [x] Blueprint matches FULL-WIDTH COMMAND with internal grid from Section 4.1
```

---

## KIRO TASK CHAINING

```yaml
downstream_kiro_tasks:
  task_1:
    name: "Profile — Legacy Token Alias Migration (foundation)"
    input: This spec → Section 9.4, Section 11
    output: All var(--color-background-*), var(--color-border-*), var(--color-text-*) aliases
      replaced with canonical surface-*, border-*, text-* token classes throughout the component

  task_2:
    name: "Profile — Heading & Typography Governance Fix"
    input: This spec → Section 9.3, Section 4.2 (all zones)
    output: h1=18px; all CardTitle=16px; all stat labels=11px/500/sentence case;
      eyebrows at --type-label-dense; crop UI labels at sentence case

  task_3:
    name: "Profile — Surface Class Rebuild (profileSurfaceClass + profileStatClass)"
    input: This spec → Section 9.4, Section 4.2
    output: Section cards use surface-card/border-subtle/rounded-panel;
      stat cards use surface-elevated/border-subtle/rounded-control; no arbitrary values

  task_4:
    name: "Profile — Status Feedback Color Fix"
    input: This spec → Section 9.3, Section 12
    output: All text-emerald-*/text-red-* replaced with text-status-success-fg/text-status-danger-fg;
      session error banner uses status-danger-bg/border/fg

  task_5:
    name: "Profile — Account Actions <details>/<summary> Removal"
    input: This spec → Section 4.2 (Account Actions), Section 12
    output: Sign out + Switch account always visible; description text explains usage;
      no <details>/<summary> in the component

  task_6:
    name: "Profile — Accessibility Fixes (mobile collapse + <Link><Button>)"
    input: This spec → Section 10.3, Section 12
    output: Mobile section toggle uses conditional render + aria-expanded/aria-controls;
      Forgot password link is text Link (not <Link><Button>)

  task_7:
    name: "Profile — Crop UI Token Fix + Numeric Display Scale"
    input: This spec → Section 9.4, Section 4.2 (Activity)
    output: Range sliders use accent-action-primary; Activity counts at --type-numeric-md (18px);
      last action timestamp at --type-timestamp (monospace)

  task_8:
    name: "Profile — Gradient Removal + Loading/Error State Fix"
    input: This spec → Section 4.2 (Page Header), Section 12
    output: Hero gradient eliminated; loading state uses text-text-secondary;
      no-profile error state uses system StatusMessage
```

---

*End of WORKSPACE_SKELETON_PROFILE.md (Sections 1–14)*
*This file is system-generated architecture. Treat as engineering law until formally amended.*
*Architectural precedent established: multi-section profile pattern (Identity/Security/Workspace/Activity/Actions);
two-column desktop layout with left=mutable/right=read-only grouping;
--type-numeric-md (18px/600) for operational count values (entries, pending sync);
--type-timestamp (monospace) for datetime display;
legacy alias migration as step_1 prerequisite pattern for complex components;
Activity section role-gating via roleCanSubmit() established as reusable pattern*


### CODE
```
@"D:\DPR APP\DPR.ai\FRONTEND-REDESIGN\factorynerve-profile.html"
```