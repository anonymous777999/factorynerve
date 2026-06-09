# Settings — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification
# Route: /settings?tab=factory  |  /settings?tab=users
# Generated: 2026-06-03
# Status: DRAFT
# Note: This spec covers the factory and users tabs together as they share a container,
#       a data loading strategy, and common shell violations. Usage/alerts/feedback tabs
#       are secondary and noted where relevant but not the primary focus.

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/settings?tab=factory` (primary) · `/settings?tab=users` (primary) · `/settings?tab=usage` (secondary) |
| Workspace Name | Factory Administration — Configuration & Team Governance |
| Operational Role | Enables managers, admins, and owners to configure factory identity (name, industry profile, workflow template, shift targets), create additional factories, manage user invitations, assign factory access across orgs, update user roles, and deactivate users. The tab state is URL-persisted so admins can deep-link into specific tasks. |
| Business Impact | If settings is broken, no factory can be configured for a new industry profile, no new operators can be onboarded via invitation, no user role changes can be executed, and multi-factory organizations lose the ability to manage cross-factory access. Every new org deployment depends on settings working correctly. |
| User Population | manager / admin / owner roles. Admin and owner use all tabs. Manager uses factory tab only (cannot invite users or manage roles). Attendance/operator/supervisor roles have no access. |
| Peak Usage Context | On-demand — factory setup days (org deployment, new factory creation); periodic (new operator onboarding via invitation, role changes during promotions). |
| Predecessor Workspaces | `/dashboard` or any workspace (via sidebar admin link) |
| Successor Workspaces | Back to the dashboard or the workspace where the configuration change takes effect |

### 1.2 Operational Importance

The settings workspace is the administrative foundation of every active factory. The factory tab determines the industry profile and workflow template that shapes every other workspace in the system — changing the workflow template reconfigures what operational modules operators see. The users tab is the gating mechanism for all new factory access: no invitation means no account creation, no factory access management means cross-factory deployments cannot be coordinated. Every time a factory adds a new shift worker, an admin or owner uses this workspace.

### 1.3 Current State Failures

**Shell / hero section violations (SettingsShell component):**
- Hero section uses `bg-[rgba(20,24,36,0.88)] backdrop-blur` — raw rgba background and backdrop blur; backdrop blur is forbidden on static page sections; must use `surface-panel` or `surface-card` with proper border
- Hero section uses `shadow-2xl` — arbitrary shadow; must use `var(--shadow-md)` or remove
- Hero eyebrow uses `text-sm uppercase tracking-[0.28em] text-[var(--accent)]` — extreme tracking (4.7× maximum), uppercase on body text, raw alias token; must be `--type-label-dense` (11px/500/sentence case/`text-action-primary`)
- Hero `h1` uses `text-3xl font-semibold` — 30px, 12px above the 18px ceiling; must be `--type-page-title` (18px/600)
- The "Admin tools" section uses `<details>/<summary>` — forbidden pattern; the four quick-navigation links (Board, Reports, Plans, Billing) should be always-visible navigation, not a collapsible
- GuidanceBlock guidance cards use `rounded-[24px]` and `bg-[rgba(10,14,24,0.68)]` — arbitrary radius and raw rgba background; must use `rounded-panel` and `surface-panel`

**Summary cards (SettingsShell):**
- Summary cards use `rounded-[10px] bg-[var(--color-background-secondary)] text-[var(--color-text-primary)]` — arbitrary radius (8px governance: `rounded-control`), legacy alias tokens; the 22px value size uses no type token
- Card title labels use `text-[12px] font-normal text-[var(--color-text-tertiary)]` — legacy alias; must be `--type-label-dense` with `text-text-tertiary`

**Factory tab violations (SettingsFactoryTab):**
- `CardTitle` uses `text-xl` (20px) — above the 16px `--type-panel-title` ceiling
- `moduleChipTone` function returns raw hex colors (`text-[#185FA5]`, `text-[#3B6D11]`, `text-[#854F0B]`) — forbidden raw hex; must use semantic token classes
- Starter modules panel uses `bg-[var(--card-strong)]` and `border-[var(--border)]` — legacy alias tokens
- Template sections container uses `bg-[rgba(8,12,20,0.55)]` — raw rgba forbidden
- Factory directory control tower items use `uppercase tracking-[0.16em]` on "Active" badge — same violation pattern; also uses `bg-[rgba(34,197,94,0.12)] text-emerald-200` — raw rgba and raw color class
- Factory directory card uses `rounded-2xl border-[var(--border)] bg-[var(--card-strong)]` — legacy aliases, arbitrary radius
- Control tower snapshot description uses `text-[var(--muted)]` — forbidden alias
- `<p>` helper texts under selects use `text-[var(--color-text-tertiary)]` — legacy alias; must use `text-text-tertiary`

**Users tab violations (SettingsUsersTab):**
- Mobile card user-code label uses `text-xs uppercase tracking-wide` — the "User ID #..." label has tracking violation
- Stat labels in mobile cards ("Factory access", "Plan", "Status") use `text-[11px] uppercase tracking-wide` — same uppercase tracking violation
- Desktop table column headers use `text-xs uppercase tracking-wide` — governs all 7 column headers; must be `text-xs font-medium` sentence case (table column headers are the ONE context where uppercase IS permitted but tracking must be ≤0.06em; `tracking-wide` = 0.025em which is under the limit — this is compliant for table headers ONLY)
- Invite form field labels use `text-xs uppercase tracking-wide text-text-secondary` on Label elements — this is a Label within a Field; field labels must use sentence case (`--type-label`); the uppercase usage is only permitted on TABLE COLUMN HEADERS
- Factory access label "Select user", "User Code or ID", etc. use inline `className="text-xs uppercase tracking-wide text-text-secondary"` — same field label violation
- Update role card `CardTitle` uses `text-xl` — above 16px ceiling
- Factory access checkbox uses `accent-[var(--action-primary)]` — this is compliant (using a token variable reference, not raw hex); however `accent-[...]` Tailwind bracket syntax with a token var is borderline; if `accent-action-primary` utility class exists, prefer it
- The "Generate invitation" button does not use `isBusy` pattern — uses `disabled={busy}` only
- The "Save factory access" button does not use `isBusy` pattern
- The "Update Role" button does not use `isBusy` pattern
- The "Deactivate User" button does not use `isBusy` pattern

**Settings page level violations:**
- `status` message uses `text-sm text-green-400` — raw color class; must use `text-status-success-fg`
- `error` message uses `text-sm text-red-400` — raw color class; must use `text-status-danger-fg`
- `sessionError` shares the same raw red-400 class
- Loading state uses `text-[var(--muted)]` — forbidden alias
- Not-signed-in error state uses `text-red-400` — same
- The feedback-only platform-admin path renders a standalone section with `bg-[rgba(20,24,36,0.88)] backdrop-blur shadow-2xl` hero — same shell violations in the alternative path

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Platform Administration | Inside AppShell; role-gated to manager+; foundational org configuration |
| Workflow Category | Entry / Record | Factory tab = configuration record editing; Users tab = governance actions (invite, role, access, deactivate) |
| Operational Behavior | Mixed — Form-Driven (factory config) + Action-Driven (user management) | Factory tab: single-form configuration save; Users tab: multi-action governance operations |
| Data Density | HIGH | Factory tab: 8 form fields + module chips + template sections + factory directory; Users tab: user table + 4 management action cards |
| Realtime Complexity | LOW | `Promise.allSettled` of 8 API calls on mount; factory template updates on industry_type change; factory access load on user select; no subscriptions |
| AI Complexity | NONE | No AI systems |
| Audit Complexity | LOW | Backend writes audit events for factory updates, user invitations, role changes, deactivations — not surfaced in UI |
| Decision Pressure | LOW-MEDIUM | Admin workflows are deliberate; but user deactivation is irreversible — requires extra confirmation; role downgrade requires typed "DOWNGRADE" confirmation |

**Classification Implication:**
A HIGH-density, Mixed-behavior Platform Administration workspace inside AppShell means this workspace is fundamentally different from the preceding six auth-shell pages. It operates within the full app context (sidebar, topbar, density token propagation). The two-column layout on both the factory and users tab (wide form/table left, narrow supporting cards right) mirrors the established ERP workstation layout pattern. The primary structural violations are concentrated in the `SettingsShell` component (hero section) and the two tab components (CardTitle scale, label tracking, raw alias tokens, `<details>/<summary>`).

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Permission | Key Response Fields | Error States |
|---|---|---|---|---|---|
| `GET /settings/factory` | GET | Fetches current factory configuration | manager+ | `factory_name`, `address`, `industry_type`, `industry_label`, `workflow_template_key`, `workflow_template_label`, `starter_modules`, `target_morning/evening/night` | HTTP 401, HTTP 403 |
| `PUT /settings/factory` | PUT | Updates factory configuration; writes audit event | manager+ | `message`, `industry_type`, `industry_label`, `workflow_template_key`, `workflow_template_label` | HTTP 400 (validation) · HTTP 403 |
| `GET /settings/factory/templates?industry_type=` | GET | Returns available workflow templates for a given industry type; re-fetched reactively when industry_type changes | manager+ | `industry_type`, `starter_modules`, `active_template_key`, `templates[]` (key, label, description, modules, sections) | HTTP 403 |
| `GET /settings/factory-profiles` | GET | Returns all available industry profile options | manager+ | `[]` of `{key, label, description, starter_modules}` | HTTP 403 |
| `GET /settings/factories` | GET | Lists all factories accessible to this org | manager+ | `[]` of `FactorySummary` (factory_id, name, industry_label, member_count, my_role, is_active_context) | HTTP 403 |
| `POST /settings/factories` | POST | Creates a new factory within the org | admin/owner | `{message, factory: FactorySummary}` | HTTP 400 (missing name) · HTTP 403 (not admin/owner) · HTTP 409 (duplicate name) |
| `GET /settings/control-tower` | GET | Returns org-level factory summary and industry breakdown | manager+ | `organization: {name, plan, total_factories, industry_breakdown}`, `factories[]` | HTTP 403 |
| `GET /settings/users` | GET | Lists all managed users in the org scoped to accessible factories | manager+ | `[]` of `ManagedUser` (id, user_code, name, email, role, factory_count, is_active, plan) | HTTP 403 |
| `POST /settings/users/invite` | POST | Creates user account + sends invitation email; creates `PendingRegistration` if email-gated | admin/owner | `message`, `user_code`, `verification_link?`, `reset_link?` | HTTP 400 (validation) · HTTP 403 (not admin/owner) · HTTP 409 (email exists) |
| `GET /settings/users/{id}/factory-access` | GET | Returns a user's current factory access list with has_access flags | admin/owner | `{user: {...}, factories: [{factory_id, name, has_access, is_primary, ...}]}` | HTTP 403 · HTTP 404 |
| `PUT /settings/users/{id}/factory-access` | PUT | Updates which factories a user has access to | admin/owner | Same as GET above + `message` | HTTP 400 · HTTP 403 |
| `PUT /settings/users/{id}/role` | PUT | Updates a user's role; requires `confirm_action: "DOWNGRADE"` for role reductions | admin/owner | `{message}` | HTTP 400 (missing confirm for downgrade) · HTTP 403 · HTTP 422 (self-role-change restrictions) |
| `DELETE /settings/users/{id}` | DELETE | Deactivates a user (soft delete — sets `is_active=false`) | admin/owner | `{message}` | HTTP 403 · HTTP 404 · HTTP 422 (cannot deactivate self) |
| `GET /settings/usage` | GET | Returns current org AI and feature usage metrics | manager+ | `UsageSummary` fields | HTTP 403 |
| `GET /billing/status` | GET | Returns billing plan, status, trial dates, active addons | admin/owner | `BillingStatus` | HTTP 403 |

**Critical backend constraints:**
- Factory creation (`POST /settings/factories`): requires admin or owner; manager cannot create factories
- User invitation (`POST /settings/users/invite`): requires admin or owner; manager cannot invite
- Factory access update: requires admin or owner; min one factory must remain for a user
- Role downgrade confirmation: `confirm_action: "DOWNGRADE"` string must be explicitly provided in payload when demoting a user; the UI must enforce the typed-input confirmation pattern
- `deactivate_user`: cannot deactivate yourself (HTTP 422); deactivation is soft (is_active=false, not deleted)
- `assignableRoles`: admin/owner can assign any role including admin/owner; manager can only assign up to supervisor

### 3.2 Entity Relationship Map

```
Organization (org_id, name, plan)
    └── Factory × N (factory_id, name, industry_type, workflow_template_key)
          └── User × N (id, user_code, email, role, is_active)
                └── UserFactoryRole (factory_id, role)

InviteUser → creates User + UserFactoryRole + sends email
UpdateUserRole → updates UserFactoryRole.role
UpdateFactoryAccess → modifies UserFactoryRole records (add/remove)
DeactivateUser → User.is_active = false
UpdateFactorySettings → updates Factory fields + triggers session refresh
CreateFactory → adds Factory to org
```

**Primary entities per tab:**
- Factory tab: `Factory` (configuration update) + `WorkflowTemplate` (read-only reference)
- Users tab: `User` + `UserFactoryRole` (all mutations)

### 3.3 Workflow State Machine

**Factory tab:**
```
[LOAD] → GET /settings/factory + GET /settings/factory-profiles + GET /settings/factory/templates
       + GET /settings/factories + GET /settings/control-tower
       → [FACTORY SETTINGS LOADED]
    → user changes industry_type → reactive GET /settings/factory/templates?industry_type=...
    → user edits fields → [DIRTY STATE]
    → user clicks "Save profile" → [SAVING] PUT /settings/factory
        → error → error message shown
        → success → getAuthContext() refresh + loadAll() + status message shown
    → user fills "Create factory" form → clicks "Create factory" → [CREATING]
        → error → error message shown
        → success → status message + form cleared + loadAll()
```

**Users tab:**
```
[LOAD] → GET /settings/users (users list)
    → user table rendered

[INVITE]
    → fill name + email + role → "Generate invitation"
    → [BUSY] POST /settings/users/invite
        → success → status + form cleared + loadAll()
        → error → error message shown

[FACTORY ACCESS]
    → accessUserId set (auto-selected on load) → GET /settings/users/{id}/factory-access
    → [ACCESS LOADED] checkboxes shown
    → user toggles checkboxes → "Save factory access"
    → [BUSY] PUT /settings/users/{id}/factory-access
        → success → status + snapshot updated + session refresh if self
        → error → error message shown

[ROLE UPDATE]
    → fill User Code or ID + New Role + DOWNGRADE confirmation if demoting
    → "Update Role"
    → [BUSY] PUT /settings/users/{id}/role
        → success → status + loadAll()
        → error → error message shown

[DEACTIVATE]
    → fill Deactivate User Code or ID
    → "Deactivate User" (destructive button)
    → [BUSY] DELETE /settings/users/{id}
        → success → status + loadAll()
        → error → error message shown
```

### 3.4 Realtime Contracts

No subscriptions. All data loaded via `Promise.allSettled` on mount. Factory templates reactively re-fetched when `industry_type` changes. Factory access data reactively re-fetched when `accessUserId` changes.

### 3.5 AI System Contracts

Not applicable.

### 3.6 Permission Matrix

| Role | View settings | Factory tab | Users tab | Create factory | Invite user | Manage access | Update role | Deactivate |
|---|---|---|---|---|---|---|---|---|
| attendance | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| operator | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| supervisor | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| accountant | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| manager | ✓ | ✓ (edit factory, no create) | ✓ (view users only, no invite/manage) | ✗ | ✗ | ✗ | ✗ (up to supervisor) | ✗ |
| admin | ✓ | ✓ (full) | ✓ (full) | ✓ | ✓ | ✓ | ✓ (all roles) | ✓ |
| owner | ✓ | ✓ (full) | ✓ (full) | ✓ | ✓ | ✓ | ✓ (all roles) | ✓ |

**Permission implication:** The `canManage` flag (manager+) gates loading. The `canManageFactoryAccess` flag (admin/owner) gates factory access, invitation, role, and deactivation panels. The `assignableRoles` list is restricted for manager role — cannot assign admin or owner. The Users tab shows the governance registry table to all canManage roles but hides action panels when canManageFactoryAccess=false.

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

```
FULL-WIDTH COMMAND with internal tab-switched content
```

- Inside AppShell (sidebar + topbar present)
- Page container: max-width 1280px, horizontally centered, standard AppShell padding
- Page structure:
  1. Page header zone (eyebrow + title + description)
  2. Quick-navigation strip (Board / Reports / Plans / Billing — always visible, NOT collapsible)
  3. Summary cards strip (3 KPI cards: Current Factory / Factory Network / Active Users)
  4. Tab navigation (factory / users / usage / alerts / feedback)
  5. Tab content zone (switches per activeTab)
- Tab content layouts:
  - Factory tab: `xl:grid-cols-[1.15fr_0.85fr]` — wide left (factory profile form) / narrow right (create factory + control tower)
  - Users tab: `xl:grid-cols-[1.1fr_0.9fr]` — wide left (user governance table) / narrow right (invite + access + role/deactivate cards)

**Pattern justification:** The tabbed command center pattern correctly models this workspace — factory configuration and user governance are distinct enough to deserve tab separation, but share enough context (user list affects factory access; factory profile affects user onboarding) that co-location in one route is correct. The two-column grid within each tab follows the ERP convention: primary data/list on left, supporting actions on right.

**Structural reduction note:** The `<details>/<summary>` "Admin tools" section was evaluated and rejected. Four navigation links that point to adjacent admin workspaces (Dashboard, Reports, Plans, Billing) should be always-visible quick-access buttons, not hidden behind a disclosure. They have minimal visual weight and provide high utility for the admin workflow.

---

### 4.2 Zone Definitions

---

#### ZONE: Page Header

| Property | Value |
|---|---|
| Operational Role | Establishes workspace identity; shows factory name and admin context |
| Attention Priority | 5 |
| Position | top of content area |
| Width | full content width |
| Height | content-driven (~56–72px) |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | Orientation for admin users; establishes that this is an administrative surface, not an operational one |

**Contents:**
- Eyebrow: "Settings" — `--type-label-dense` (11px/500/`text-action-primary`/sentence case); NOT `uppercase tracking-[0.28em] text-[var(--accent)]`
- Page title: "Keep factory setup and team control in one admin lane" — `--type-page-title` (18px/600/sentence case); NOT `text-3xl`
- Subtitle: 14px/400/`text-text-secondary`
- Background: `surface-panel` with `border-subtle` — NO `rgba(20,24,36,0.88)`, NO `backdrop-blur`, NO `shadow-2xl`

**Acceptance Criteria:**
- [ ] No gradient or backdrop-blur on page header
- [ ] Eyebrow at 11px/500/sentence case with `text-action-primary` — NOT uppercase tracking alias
- [ ] Title at 18px/600 — NOT text-3xl
- [ ] Surface uses canonical tokens only

---

#### ZONE: Quick-Navigation Strip

| Property | Value |
|---|---|
| Operational Role | Provides fast navigation to adjacent admin workspaces (Dashboard, Reports, Plans, Billing) |
| Attention Priority | 4 |
| Position | below page header |
| Width | full content width |
| Height | content-driven (~48px) |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | Admin users commonly navigate between settings, billing, reports, and dashboard in a single session; quick links reduce navigation friction |

**Contents:**
- 4 ghost/outline buttons: "Board" → `/dashboard`, "Reports" → `/reports`, "Plans" → `/plans`, "Billing" → `/billing` (conditional on `canViewBilling`)
- Container: `surface-panel` with `border-subtle`, `rounded-panel` — NOT inside `<details>/<summary>`
- ALWAYS VISIBLE — NOT collapsible

**Acceptance Criteria:**
- [ ] Quick-nav links are always visible — NOT inside `<details>/<summary>`
- [ ] Container uses `surface-panel` with `border-subtle` — NOT `rgba(12,16,24,0.72)`
- [ ] "Billing" link conditionally rendered only when `canViewBilling=true`
- [ ] Buttons use ghost/outline variant — no primary buttons here

---

#### ZONE: Summary Cards Strip

| Property | Value |
|---|---|
| Operational Role | Shows current factory name + template, factory network count, and active user count — three operational signals that give admins immediate context before entering a tab |
| Attention Priority | 3 |
| Position | below quick-navigation |
| Width | full content width; 3-column grid on md+ |
| Height | content-driven (approx 80px per card) |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | `GET /settings/control-tower` provides factory network; `GET /settings/users` provides user count; `GET /settings/factory` provides factory name — all loaded on mount |

**Contents:**
- 3 summary cards: Current Factory, Factory Network, Active Users
- Card structure: title label (`--type-label-dense`), value (`--type-numeric-md` or `--type-body`/600), detail (`--type-label-dense`/`text-text-tertiary`)
- Surface: `surface-card` with `border-subtle`, `rounded-panel`

**Acceptance Criteria:**
- [ ] Cards use `surface-card` with `border-subtle` — NOT `rounded-[10px] bg-[var(--color-background-secondary)]`
- [ ] Card title labels at 11px/500/sentence case — NOT raw legacy alias
- [ ] Card value at 18px/600 (--type-numeric-md) for numeric values
- [ ] Card detail at 11px/400/`text-text-tertiary`

---

#### ZONE: Tab Navigation

| Property | Value |
|---|---|
| Operational Role | Switches between factory, users, usage, alerts, feedback tabs; state URL-persisted via `?tab=` |
| Attention Priority | 2 |
| Position | below summary cards |
| Width | full content width |
| Height | fixed: 40–48px |
| Sticky Behavior | sticky-on-scroll — the tab bar should remain accessible when scrolling through long tab content |
| Density Mode | default |
| Existence Justification | Tab-switched content requires a persistent navigation mechanism |

**Contents:**
- Tab buttons: factory / users / usage / alerts (canManageAlerts only) / feedback (canManageFeedback only)
- Active tab: `text-action-primary` with `border-bottom-action-primary` indicator
- Inactive tabs: `text-text-secondary`, hover: `text-text-primary`
- All tab labels: sentence case (`--type-label`)

**Acceptance Criteria:**
- [ ] Tab labels in sentence case — NOT uppercase
- [ ] Alerts tab only shown when `canManageAlerts=true`
- [ ] Feedback tab only shown when `canManageFeedback=true`
- [ ] Active tab indicator uses `border-action-primary` — NOT raw color

---

#### ZONE: Factory Tab — Profile Form (left column)

| Property | Value |
|---|---|
| Operational Role | Allows editing of the factory's identity fields: name, address, industry profile, workflow template, production targets |
| Attention Priority | 1 (within factory tab) |
| Position | left column of factory tab grid |
| Width | ~54% desktop; 100% mobile |
| Height | content-driven |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | `PUT /settings/factory` — the primary factory configuration mutation |

**Contents:**
- Section title: "Factory profile" — `--type-panel-title` (16px/600); NOT `text-xl`
- 2-column form grid: Factory name (text), Industry profile (Select), Workflow template (Select), Address (full width)
- Starter modules display: chip badges for each enabled module; module chips use semantic status token classes — NOT raw hex colors (`text-[#185FA5]` etc.); must map module categories to semantic tokens
- Template sections (conditional): shown when template has sections; uses `surface-panel` + `border-subtle` — NOT `rgba(8,12,20,0.55)`
- Production targets: Morning target, Evening target, Night target (number inputs)
- "Save profile" button: `Button variant="primary"`, `isBusy` pattern; NOT `disabled={busy}` only

**Module chip token mapping** (replaces raw hex colors):
- DPR / Traceability: `surface-panel text-action-primary` — operational core module
- Quality / Certificates: `surface-panel text-status-success-fg` — quality assurance category
- Scrap / Downtime: `surface-panel text-status-warning-fg` — loss/performance category
- Default: `surface-panel text-text-secondary`

**Acceptance Criteria:**
- [ ] Section title at 16px/600 — NOT text-xl
- [ ] Module chips use semantic token classes — NOT raw hex colors
- [ ] Template sections container uses `surface-panel border-subtle` — NOT raw rgba bg
- [ ] "Save profile" uses `isBusy` + `busyLabel="Saving..."` — NOT disabled-only
- [ ] Field helper texts use `text-text-tertiary` — NOT `text-[var(--color-text-tertiary)]`
- [ ] Starter modules container uses `surface-panel border-default` — NOT `bg-[var(--card-strong)] border-[var(--border)]`

---

#### ZONE: Factory Tab — Right Column (Create Factory + Control Tower)

| Property | Value |
|---|---|
| Operational Role | Create factory form (admin/owner) + control tower snapshot showing all org factories |
| Attention Priority | 2 (within factory tab) |
| Position | right column of factory tab grid |
| Width | ~46% desktop; 100% mobile |
| Height | content-driven |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | `POST /settings/factories` (create); `GET /settings/control-tower` (snapshot); factory directory gives org-level visibility |

**Contents:**
- Create factory card: section title "Create factory" (16px/600), fields: Factory name, Industry profile, Workflow template, Location, Address; pack preview module chips; "Create factory" button with `isBusy`
- Control tower snapshot card: section title "Control tower snapshot" (16px/600); org name + plan display; factory directory list with factory cards showing name, industry, template, member count, my role; "Active" badge for `is_active_context`

**"Active" badge fix:**
- Currently: `bg-[rgba(34,197,94,0.12)] text-emerald-200 uppercase tracking-[0.16em]` — forbidden
- Must be: `StatusBadge` or inline badge using `status-success-bg/fg/border` semantic tokens, sentence case, `--type-label-dense`

**Factory directory card fix:**
- Currently: `rounded-2xl border-[var(--border)] bg-[var(--card-strong)]` — legacy aliases
- Must be: `surface-card border-subtle rounded-panel`
- Control tower description text currently uses `text-[var(--muted)]` — must use `text-text-secondary`

**Acceptance Criteria:**
- [ ] "Create factory" section title at 16px/600 — NOT text-xl
- [ ] "Create factory" button uses `isBusy` + `busyLabel="Creating..."`
- [ ] "Active" badge on active factory uses `status-success-bg/fg` semantic tokens + sentence case — NOT rgba + emerald + uppercase tracking
- [ ] Factory directory cards use `surface-card border-subtle rounded-panel` — NOT legacy aliases
- [ ] Control tower description text uses `text-text-secondary` — NOT `text-[var(--muted)]`

---

#### ZONE: Users Tab — Governance Registry Table (left column)

| Property | Value |
|---|---|
| Operational Role | Displays all org users with their role, factory access count, plan, and status; read-only reference for admin decisions |
| Attention Priority | 1 (within users tab) |
| Position | left column of users tab grid |
| Width | ~55% desktop; 100% mobile |
| Height | content-driven; scrollable table on desktop |
| Sticky Behavior | table header sticky within scroll container |
| Density Mode | default (compact in dense preference) |
| Existence Justification | `GET /settings/users` — the governance registry provides the data context for all user management actions in the right column |

**Contents:**
- Section title: "Governance registry" — `--type-panel-title` (16px/600); currently `text-xl` — fix needed
- Desktop table: 7 columns — User ID (JetBrains Mono, `--type-timestamp`), Name, Email, Role, Factory access, Plan, Status
- Table column headers: `--type-table-header` (10px/600/uppercase/tracking ≤0.06em) — uppercase IS permitted here (table column headers only); `tracking-wide` (0.025em) is compliant
- Mobile card list: each user as a card with mobile-appropriate layout
- Mobile card stat labels ("User ID", "Factory access", "Plan", "Status"): these are NOT table column headers — must use sentence case `--type-label-dense`; currently use `uppercase tracking-wide` which violates field label rules

**Acceptance Criteria:**
- [ ] Section title at 16px/600 — NOT text-xl (currently missing from users tab CardTitle — it DOES use text-xl; fix needed)
- [ ] Desktop table headers: uppercase is PERMITTED here; tracking-wide (0.025em) is compliant; no fix needed for table headers
- [ ] Mobile card stat labels: must use sentence case — NOT uppercase (these are NOT table column headers)
- [ ] User role values displayed in sentence case (capitalize: currently uses CSS `capitalize` — this is acceptable)
- [ ] Inactive users visually distinguished from active users — currently shows "Active"/"Inactive" text only; add structural treatment (muted row or status indicator)

---

#### ZONE: Users Tab — Action Cards (right column)

| Property | Value |
|---|---|
| Operational Role | Four action cards: Invite new user, Factory access management, Role update, User deactivation |
| Attention Priority | 2 (within users tab) |
| Position | right column of users tab grid |
| Width | ~45% desktop; 100% mobile |
| Height | content-driven |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | All four user management mutations: `POST /users/invite`, `PUT /users/{id}/factory-access`, `PUT /users/{id}/role`, `DELETE /users/{id}` |

**Sub-zones:**

**Invite card:**
- Section title: "Invite new user" — 16px/600; currently `text-xl` in CardTitle — fix
- Field labels currently use `text-xs uppercase tracking-wide text-text-secondary` — these are form field labels, NOT table headers; must use sentence case `--type-label` (12px/500/`text-text-secondary`)
- "Generate invitation" button: add `isBusy` + `busyLabel="Inviting..."`

**Factory access card (admin/owner only):**
- Section title: "Factory access" — 16px/600; currently `text-xl`
- "Select user" label: sentence case — NOT uppercase tracking
- Factory checkbox items: `surface-panel border-subtle rounded-panel` — currently `rounded-2xl border-border-subtle bg-surface-panel` (partially correct; radius fix needed)
- "Save factory access" button: add `isBusy` + `busyLabel="Saving..."`
- `accent-[var(--action-primary)]` on checkbox: acceptable (token reference in bracket); if `accent-action-primary` utility exists prefer it

**Role update + deactivate card (admin/owner — role update only; full for admin/owner):**
- Section title: "Update role / deactivate" — 16px/600; currently `text-xl`
- "User Code or ID" label: sentence case
- "New Role" label: sentence case
- "Type DOWNGRADE to confirm lower roles" label: sentence case; the DOWNGRADE word within the label is a product requirement (it must say DOWNGRADE), but the label itself should use sentence case as the outer frame
- Deactivate section: `border-top` separator is correct; "Deactivate User Code or ID" label: sentence case
- "Update Role" button: add `isBusy` + `busyLabel="Updating..."`
- "Deactivate User" button (`variant="destructive"`): add `isBusy` + `busyLabel="Deactivating..."`; currently uses `disabled={busy}` only without isBusy spinner

**Acceptance Criteria — all action cards:**
- [ ] All CardTitle values at 16px/600 — NOT text-xl
- [ ] All form field labels use sentence case `--type-label` — NOT uppercase tracking
- [ ] All action buttons use `isBusy` + `busyLabel` pattern — NOT disabled-only
- [ ] Factory access card conditionally rendered only when `canManageFactoryAccess=true`
- [ ] "Deactivate User" button uses `variant="destructive"` — confirmed correct; isBusy fix needed
- [ ] Role update card only shows admin/owner-assignable roles when admin/owner; manager sees restricted list

### 4.3 Zone Interaction Rules

```yaml
zone_interactions:
  - trigger: user changes Industry profile selector (factory tab)
    effect: reactive GET /settings/factory/templates?industry_type={new} fires;
      workflow template selector updates with new template options;
      starter modules display updates
    reason: templates are industry-scoped; selecting a different industry changes
      what templates are available

  - trigger: user changes Workflow template selector (factory tab)
    effect: starter modules display updates to reflect the selected template's modules;
      template sections (if any) render below the modules chips
    reason: template selection determines which operational modules are enabled

  - trigger: user clicks "Save profile" (PUT /settings/factory)
    effect: busy=true; on success → getAuthContext() refresh (updates sidebar factory name);
      loadAll() refetches all settings data; status message shown
    reason: factory name change must propagate to the AppShell sidebar immediately

  - trigger: accessUserId changes (users tab)
    effect: GET /settings/users/{id}/factory-access fires; loading state shown;
      factory checkbox list updates
    reason: access data is per-user; changing selection requires fetching the new user's access

  - trigger: user toggles factory checkbox (users tab)
    effect: accessFactoryIds array updates; at least one must remain selected
      (prevents removing all factory access — enforced client-side)
    reason: a user with zero factory access would be in an invalid state

  - trigger: user clicks "Generate invitation" (POST /settings/users/invite)
    effect: busy=true; on success → status shows user code + invitation details;
      inviteName + inviteEmail cleared; loadAll() refetches user list
    reason: invite button should clear to ready for the next invitation immediately

  - trigger: user clicks "Update Role" (PUT /settings/users/{id}/role)
    effect: busy=true; DOWNGRADE confirmation required client-side before submission
      if new role is lower than current role (checked against USER_ROLES order);
      on success → status shown; loadAll() refetches users
    reason: role downgrade has operational consequences; explicit confirmation prevents accidents

  - trigger: user clicks "Deactivate User" (DELETE /settings/users/{id})
    effect: busy=true; on success → status shown; loadAll() refetches users
    reason: deactivation is irreversible (soft delete); no recovery path from this page

  - trigger: activeTab changes (URL ?tab= changes)
    effect: tab content zone switches; URL is updated via router.replace/push
    reason: tab state is URL-persisted for deep-linking and browser history

  - trigger: canManageFactoryAccess=false (manager role)
    effect: factory access card hidden; invite card hidden; role/deactivate card hidden
    reason: manager cannot perform user governance actions; showing disabled panels
      creates confusion about what is available
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

### 5.1 Scan Flow — Factory Tab

```
SCAN LEVEL 1 (0–200ms): Factory name field (first editable field, top of form)
WHY: Admin arrived to change factory configuration; the name field is the first
  actionable target. The form label "Factory profile" orients them to the section.

SCAN LEVEL 2 (200ms–1s): Industry profile + Workflow template selects
WHY: These are the two highest-consequence configuration choices. Changing the
  industry profile triggers reactive template updates. Both sit below factory name.

SCAN LEVEL 3 (1s–3s): Starter modules chips + Target fields + Save button
WHY: The modules display is informational — confirms what the template enables.
  Target fields (morning/evening/night) are secondary configuration. Save is at
  the bottom of the form.

SCAN LEVEL 4 (3s+): Right column (Create factory, Control tower snapshot)
WHY: Factory creation is rare (done once per new factory). Control tower snapshot
  is read-only reference. Both serve occasional use, not daily admin workflow.
```

### 5.2 Scan Flow — Users Tab

```
SCAN LEVEL 1 (0–200ms): Governance registry table (user list)
WHY: The full user list establishes who is in the factory before any action
  is taken. Admin must know who exists before inviting, modifying, or deactivating.

SCAN LEVEL 2 (200ms–1s): Invite new user card (top of right column)
WHY: Most common admin action is onboarding new operators. The invite card
  is at the top of the right column — immediately reachable after reviewing the user list.

SCAN LEVEL 3 (1s–3s): Factory access card + Role update card
WHY: Multi-factory access and role changes are less frequent than invitations.
  The factory access card requires choosing a user from a dropdown first.
  The role update card requires knowing a user code.

SCAN LEVEL 4 (3s+): Deactivate section (bottom of role card)
WHY: Deactivation is rare and destructive. It sits at the bottom, separated by
  a border from the role update fields. Operators must scroll to it intentionally.
```

### 5.3 Persistent Visibility Requirements

| Element | Reason It Must Persist |
|---|---|
| Tab navigation | Must remain accessible as admin scrolls through long tab content |
| Status/error messages | Global status and error messages (at page bottom) must be reachable after any action |
| "Save profile" button (factory tab) | Must be visible without excessive scrolling after editing factory fields |

### 5.4 Contextual Visibility Rules

```yaml
contextual_rules:
  - condition: canManageFactoryAccess=false (manager role)
    shows: factory tab form only; users tab shows table only
    hides: invite card, factory access card, role/deactivate card
    reason: manager lacks admin authority; showing disabled governance panels
      creates confusion

  - condition: selectedFactoryTemplate has sections
    shows: template sections grid below starter modules
    hides: nothing (additive)
    reason: sections provide workflow field detail; not all templates have sections

  - condition: accessLoading=true (fetching factory access for selected user)
    shows: loading placeholder in factory access card
    hides: factory checkbox list
    reason: checkboxes must not be interactive before data is confirmed loaded

  - condition: accessSnapshot=null (no user selected)
    shows: empty-state message "Choose a user to manage factory membership."
    hides: factory checkbox list + save button
    reason: save with no user selected would be a no-op

  - condition: canViewBilling=false (manager role)
    shows: Board / Reports / Plans quick links
    hides: Billing quick link
    reason: manager cannot access billing page

  - condition: activeTab !== "alerts" OR canManageAlerts=false
    shows/hides: alerts tab conditional per canManageAlerts

  - condition: activeTab !== "feedback" OR canManageFeedback=false
    shows/hides: feedback tab conditional per canManageFeedback
```

---

## 6. TABLE & DATA STRATEGY

### 6.1 Table Role (Users tab — governance registry)

| Field | Value |
|---|---|
| Primary Purpose | Give admins a complete view of all factory users, their roles, factory access counts, and active status before making governance decisions |
| Scanning Pattern | Top-to-bottom; admin scans for a specific user by name or user code before acting |
| Primary Decision | Which user to target for invitation/role/access/deactivation actions |
| Action Trigger | Admin identifies a user and enters their user_code into the action cards on the right |
| Row Volume | Typically 5–50 users; max: 200; scrollable; no virtualization required below 200 |

### 6.2 Column Architecture

| Column | Data Type | Alignment | Sticky | Operational Purpose |
|---|---|---|---|---|
| User ID | `--type-timestamp` (JetBrains Mono) | left | no | Used as input in role/deactivate action fields |
| Name | text | left | no | Primary identification |
| Email | text | left | no | Secondary identification; confirms user before action |
| Role | text (capitalize) | left | no | Current permission level — informs role change decisions |
| Factory access | text + sub-text | left | no | Count of factories assigned; factory name below |
| Plan | text | left | no | Informs access tier decisions |
| Status | text | left | no | Active/Inactive — confirms deactivated vs. live users |

**Table column headers:** 10px/600/uppercase/tracking ≤0.06em — table column headers are the ONE governed context where uppercase is permitted. `tracking-wide` (0.025em) is compliant.

### 6.3 Row State Specification

```yaml
row_states:
  normal: standard row, text-text-primary
  inactive: `is_active=false` — text-text-tertiary; muted visual treatment vs. active rows
  loading: not applicable (table is loaded once, no per-row async)
```

### 6.4 Mobile Card Layout (users tab)

Mobile shows card-per-user instead of table. Card stat labels ("User ID", "Factory access", "Plan", "Status") must use sentence case `--type-label-dense` — NOT `uppercase tracking-wide` (these are card labels, not table headers; uppercase is NOT permitted here).

---

## 7. FORM & INPUT STRATEGY

### 7.1 Factory Profile Form

```yaml
factory_form_fields:
  - factory_name: text, required, min_length=1
  - industry_type: Select (reactive — triggers template reload)
  - workflow_template_key: Select (options depend on industry_type)
  - address: text, optional
  - target_morning: number, min=0, step=1, inputMode=numeric
  - target_evening: number, min=0, step=1, inputMode=numeric
  - target_night: number, min=0, step=1, inputMode=numeric

validation:
  on_submit:
    - factory_name: required (non-empty)
    - targets: must be non-negative integers (coerceIntegerInput enforces this)
  server_side:
    - HTTP 400 (validation errors from backend)
```

### 7.2 Invite User Form

```yaml
invite_form_fields:
  - inviteName: text, required ("User name")
  - inviteEmail: email, required ("Email address")
  - inviteRole: Select, required ("System role") — options from assignableRoles

validation:
  on_submit:
    - name: required, non-empty
    - email: valid email format
    - role: must be in assignableRoles (enforced by Select options)
  server_side:
    - HTTP 409 "Email already registered" or similar
    - HTTP 400 validation errors
```

### 7.3 Role Update Form

```yaml
role_update_fields:
  - roleUserId: number input ("User Code or ID") — digitsOnly enforced
  - newRole: Select ("New Role")
  - downgradeConfirm: text input ("Type DOWNGRADE to confirm lower roles")

validation:
  on_submit_client:
    - roleUserId: required, must resolve to a valid user in the loaded users list
    - if new role is lower in USER_ROLES order: downgradeConfirm must equal "DOWNGRADE"
  server_side:
    - HTTP 400 "confirm_action required" if downgrade not confirmed
    - HTTP 422 self-modification restrictions
```

### 7.4 Deactivate User Form

```yaml
deactivate_form_fields:
  - deactivateUserId: number input ("Deactivate User Code or ID") — digitsOnly enforced

validation:
  on_submit_client:
    - deactivateUserId: required, must resolve to a valid user
  server_side:
    - HTTP 422 "Cannot deactivate yourself"
    - HTTP 404 user not found
```

---

## 8. AI & AUDIT VISIBILITY STRATEGY

### 8.1 AI Placement Map
Not applicable.

### 8.2 Audit Visibility Map

```yaml
audit_events_written_backend:
  - FACTORY_SETTINGS_UPDATED: PUT /settings/factory
  - FACTORY_CREATED: POST /settings/factories
  - USER_INVITED: POST /settings/users/invite
  - USER_FACTORY_ACCESS_UPDATED: PUT /settings/users/{id}/factory-access
  - USER_ROLE_UPDATED: PUT /settings/users/{id}/role
  - USER_DEACTIVATED: DELETE /settings/users/{id}
frontend_display: none — these events are accessible via premium audit trail only
```

### 8.3 Anomaly Visibility
Not applicable.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

### 9.1 Density Mode

```yaml
default_density: default
density_justification: Administrative configuration workspace; deliberate, low-frequency actions;
  default density provides comfortable targets and clear visual separation between
  the many form fields and action cards.
density_switchable: yes — inherits AppShell density control
density_specs:
  form_field_gap: 16px (--space-md)
  card_gap: 24px (--space-lg) between section cards
  section_gap: 24px (--space-lg) between page sections
  table_row_height_default: 40px
  table_cell_padding: 12px horizontal / 8px vertical
```

### 9.2 Spacing Rhythm

```yaml
spacing:
  page_padding_horizontal: 24px–40px (AppShell standard)
  page_padding_vertical: 24px top
  zone_gap: 24px (--space-lg) between all page sections
  column_gap: 24px (--space-lg) between left and right columns
  card_padding: 20px (--space-5) for all section cards
  form_group_gap: 16px (--space-md) between form fields
  module_chip_gap: 8px (--space-sm)
  summary_card_gap: 12px (--space-3) between summary cards
```

### 9.3 Typography Specification

```yaml
typography:
  page_eyebrow: 11px / 500 / sentence case / text-action-primary  (--type-label-dense)
  page_title: 18px / 600 / sentence case  (--type-page-title)
  page_subtitle: 14px / 400 / text-text-secondary
  summary_card_label: 11px / 500 / sentence case / text-text-tertiary  (--type-label-dense)
  summary_card_value: 18px / 600 / tabular-nums  (--type-numeric-md for numbers)
  summary_card_detail: 11px / 400 / text-text-tertiary
  tab_labels: 13px / 500 / sentence case  (--type-label)
  section_title: 16px / 600 / sentence case  (--type-panel-title) — NOT text-xl
  form_field_label: 13px / 500 / sentence case  (--type-label via Label primitive)
  helper_text: 12px / 400 / text-text-tertiary
  table_column_header: 10px / 600 / UPPERCASE / tracking ≤0.06em  (table headers only — governed exception)
  table_cell: 13px / 400 / text-text-primary  (--type-table-cell)
  table_meta: 12px / 400 / text-text-tertiary  (for sub-text like factory name)
  user_id_cell: 11px / 400 / monospace  (--type-timestamp / JetBrains Mono)
  mobile_card_label: 11px / 500 / sentence case  (--type-label-dense) — NOT uppercase
  status_active: text-status-success-fg  (NOT text-emerald-200)
  module_chip_text: 12px / 500 / sentence case
  button_label: 14px / 500 / sentence case
  status_message: 13px / 400 / text-status-success-fg
  error_message: 13px / 400 / text-status-danger-fg
```

### 9.4 Surface Token Hierarchy

```yaml
surfaces:
  page_background: var(--surface-shell)  — AppShell workspace frame
  page_header: var(--surface-panel) with var(--border-subtle)  — NOT rgba backdrop-blur
  quick_nav_strip: var(--surface-panel) with var(--border-subtle)
  summary_card: var(--surface-card) with var(--border-subtle)
  section_card: var(--surface-card) with var(--border-subtle)
  starter_modules_container: var(--surface-panel) with var(--border-default)
  template_sections_container: var(--surface-panel) with var(--border-subtle)
  template_section_card: var(--surface-elevated) with var(--border-subtle)
  factory_directory_card: var(--surface-card) with var(--border-subtle)
  factory_access_item: var(--surface-panel) with var(--border-subtle)
  module_chip: var(--surface-panel)
  status_success: text-status-success-fg (inline text color only)
  status_error: text-status-danger-fg (inline text color only)
  active_badge: var(--status-success-bg) with var(--status-success-border)
```

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

### 10.1 Desktop (Primary)

```yaml
desktop:
  min_width: 1280px
  max_content_width: 1280px
  factory_tab_columns: xl:grid-cols-[1.15fr_0.85fr]
  users_tab_columns: xl:grid-cols-[1.1fr_0.9fr]
  summary_cards: 3-column md:grid-cols-3
  all_sections_visible: yes
```

### 10.2 Compact Desktop

```yaml
compact_desktop:
  width_range: 1024px–1279px
  layout: single column below xl breakpoint; factory tab and users tab stack vertically
  all_content_accessible: yes
```

### 10.3 Mobile

```yaml
mobile:
  width_range: <768px
  factory_tab: all form fields stacked; 2-column field grid collapses to single column
  users_tab: table hidden (md:hidden); mobile card list shown
  touch_targets: all buttons ≥44px height
  notes: >
    Settings is not a primary mobile workspace; admin tasks are desk-first.
    Mobile must remain functional for urgent role changes or factory access fixes.
```

---

## 11. COMPONENT MAPPING

```yaml
component_mapping:
  workspace_container:
    component: <main> inside AppShell
    max_width: 1280px, centered with page padding

  page_header:
    component: SettingsShell (modified)
    critical_fixes:
      - Remove backdrop-blur + raw rgba from hero section → surface-panel + border-subtle
      - Remove shadow-2xl → no shadow
      - Fix eyebrow from uppercase tracking alias → --type-label-dense sentence case text-action-primary
      - Fix h1 from text-3xl → 18px/600 (--type-page-title)

  quick_nav_strip:
    component: SettingsShell (modified)
    critical_fix: Remove <details>/<summary> → always-visible flex row of Button asChild + Link

  summary_cards:
    component: SettingsShell (modified)
    critical_fix: Replace rounded-[10px] + legacy alias → surface-card + border-subtle + rounded-panel

  tab_navigation:
    component: SettingsTabNav (existing)
    note: tab labels in sentence case; verified from SettingsTabKey type

  factory_profile_form:
    component: SettingsFactoryTab (modified)
    field_primitives: [Field, Label, Input, Select]
    critical_fixes:
      - CardTitle text-xl → 16px/600
      - Module chip colors: raw hex → semantic token classes
      - Starter modules container: legacy aliases → surface-panel + border-default
      - Template sections: rgba → surface-panel + border-subtle
      - Save button: add isBusy + busyLabel="Saving..."
      - Helper texts: var(--color-text-tertiary) → text-text-tertiary

  factory_directory:
    component: SettingsFactoryTab (modified)
    critical_fixes:
      - Factory cards: legacy aliases → surface-card + border-subtle + rounded-panel
      - Active badge: rgba + emerald + uppercase → status-success-bg/fg + sentence case
      - Description text: var(--muted) → text-text-secondary
      - CardTitle: text-xl → 16px/600

  user_governance_table:
    component: SettingsUsersTab (modified) — table is structurally correct
    critical_fixes:
      - CardTitle: text-xl → 16px/600
      - Mobile card stat labels: uppercase tracking → sentence case --type-label-dense
      - Inactive row: add text-text-tertiary treatment for is_active=false rows

  invite_card:
    component: SettingsUsersTab (modified)
    critical_fixes:
      - CardTitle: text-xl → 16px/600
      - Field labels: uppercase tracking → sentence case --type-label
      - Generate invitation button: add isBusy + busyLabel="Inviting..."

  factory_access_card:
    component: SettingsUsersTab (modified)
    critical_fixes:
      - CardTitle: text-xl → 16px/600
      - Field labels: uppercase tracking → sentence case
      - Save factory access button: add isBusy + busyLabel="Saving..."

  role_deactivate_card:
    component: SettingsUsersTab (modified)
    critical_fixes:
      - CardTitle: text-xl → 16px/600
      - Update Role button: add isBusy + busyLabel="Updating..."
      - Deactivate User button: add isBusy + busyLabel="Deactivating..."

  status_elements:
    - global status: text-status-success-fg (NOT text-green-400)
    - global error: text-status-danger-fg (NOT text-red-400)

  action_buttons:
    - Save profile: Button variant="primary" isBusy busyLabel="Saving..."
    - Create factory: Button variant="primary" isBusy busyLabel="Creating..."
    - Generate invitation: Button isBusy busyLabel="Inviting..."
    - Save factory access: Button isBusy busyLabel="Saving..."
    - Update Role: Button isBusy busyLabel="Updating..."
    - Deactivate User: Button variant="destructive" isBusy busyLabel="Deactivating..."

  quick_nav_buttons:
    - Board: Button variant="ghost" asChild + Link href="/dashboard"
    - Reports: Button variant="outline" asChild + Link href="/reports"
    - Plans: Button variant="ghost" asChild + Link href="/plans"
    - Billing: Button variant="ghost" asChild + Link href="/billing" (conditional on canViewBilling)
```

---

## 12. OPERATIONAL PROBLEMS SOLVED

```yaml
problem_resolutions:
  - problem: Hero section uses backdrop-blur + rgba background + shadow-2xl
    root_cause: SettingsShell component used a "glassy dark" hero aesthetic pattern
      that pre-dates governance; backdrop-blur is explicitly forbidden on static page sections
    structural_solution: Section 9.4 specifies surface-panel + border-subtle for page header;
      Section 4.2 page header acceptance criteria require no backdrop-blur/rgba/shadow;
      Section 11 flags SettingsShell as requiring this fix
    section_reference: Section 9.4, Section 4.2, Section 11
    measurable_outcome: Zero backdrop-blur on settings page; page header renders as a flat
      surface-panel with border — same visual language as every other admin page

  - problem: Hero h1 uses text-3xl (30px); all CardTitle use text-xl (20px)
    root_cause: Arbitrary Tailwind heading scale used throughout; same root cause as
      every heading violation across Phase A
    structural_solution: Section 9.3 specifies page_title at 18px/600 and section_title at 16px/600;
      Section 4.2 acceptance criteria require specific sizes for each zone heading
    section_reference: Section 9.3, Section 4.2 (all zones)
    measurable_outcome: page h1=18px; all CardTitle=16px; consistent with profile and other pages

  - problem: "Admin tools" uses <details>/<summary> — forbidden pattern
    root_cause: Developer used HTML disclosure for quick-nav links to keep the hero section compact
    structural_solution: Section 4.2 quick-navigation strip is always-visible; Section 4.3 confirms
      no collapse trigger; Section 11 specifies Button asChild + Link for all four quick-nav buttons
    section_reference: Section 4.2, Section 4.3, Section 11
    measurable_outcome: Board/Reports/Plans/Billing links always visible; no hidden navigation

  - problem: Hero eyebrow uses uppercase tracking-[0.28em] — 4.7× maximum + raw alias
    root_cause: Same root cause as every eyebrow violation in Phase A; copied from a
      marketing-style pattern
    structural_solution: Section 9.3 specifies page_eyebrow at 11px/500/sentence case/text-action-primary;
      Section 4.2 page header acceptance criteria explicitly require sentence case
    section_reference: Section 9.3, Section 4.2
    measurable_outcome: Eyebrow renders "Settings" in sentence case without tracking violation

  - problem: Module chip colors use raw hex (#185FA5, #3B6D11, #854F0B)
    root_cause: Developer hard-coded brand colors for module categories without a token mapping;
      raw hex is forbidden at all phases
    structural_solution: Section 4.2 factory profile form zone defines semantic token mapping
      for each module category (action-primary / status-success / status-warning / text-secondary);
      Section 9.4 specifies module_chip surface; Section 11 details the fix
    section_reference: Section 4.2, Section 9.4, Section 11
    measurable_outcome: Module chips use semantic token classes; zero raw hex colors

  - problem: All action buttons use disabled={busy} without isBusy spinner
    root_cause: Developer used the simpler disabled pattern; isBusy pattern was not
      applied consistently to settings action buttons
    structural_solution: Section 11 component mapping specifies isBusy + busyLabel for all
      six action buttons; Section 4.2 acceptance criteria require isBusy on each action card
    section_reference: Section 4.2, Section 11
    measurable_outcome: All six action buttons show spinner + contextual busy label during
      async operations; consistent with the isBusy pattern established across Phase A

  - problem: Invite form field labels, factory access labels use uppercase tracking
    root_cause: Same governance confusion as profile page: Label components were given
      uppercase tracking className overrides, which is only permitted on TABLE COLUMN HEADERS
    structural_solution: Section 9.3 specifies form_field_label at 13px/500/sentence case;
      Section 4.2 acceptance criteria for each action card explicitly require sentence case;
      Section 6.2 clarifies that table column headers (and ONLY those) may use uppercase
    section_reference: Section 9.3, Section 4.2 (users tab action cards), Section 6.2
    measurable_outcome: All form field labels in sentence case; table column headers retain
      uppercase (compliant); mobile card labels corrected to sentence case

  - problem: Global status uses text-green-400; global error uses text-red-400
    root_cause: Raw Tailwind color classes used for page-level status feedback
    structural_solution: Section 9.3 specifies status_message at text-status-success-fg
      and error_message at text-status-danger-fg; Section 11 component mapping specifies
      the correct classes
    section_reference: Section 9.3, Section 11
    measurable_outcome: Status and error feedback uses semantic token classes throughout

  - problem: Factory directory "Active" badge uses rgba + emerald + uppercase tracking
    root_cause: Status badge built inline with raw rgba background and forbidden tracking;
      same pattern as factory-required's role-gated button — visually similar violations
    structural_solution: Section 9.4 specifies active_badge uses status-success-bg/border/fg;
      Section 4.2 factory directory acceptance criteria require sentence case + semantic tokens;
      Section 9.3 specifies status_active at text-status-success-fg
    section_reference: Section 9.4, Section 4.2, Section 9.3
    measurable_outcome: "Active" badge uses semantic token surface + sentence case; zero raw rgba
```

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

```yaml
implementation_sequence:
  step_1: Fix SettingsShell hero section — remove backdrop-blur + raw rgba + shadow-2xl;
    replace with surface-panel + border-subtle; fix eyebrow from uppercase tracking
    alias to --type-label-dense sentence case text-action-primary; fix h1 from text-3xl
    to 18px/600
  step_2: Remove <details>/<summary> from SettingsShell "Admin tools" — replace with
    always-visible flex row; Button asChild + Link for all four quick-nav buttons
  step_3: Fix SettingsShell summary cards from rounded-[10px] + legacy aliases to
    surface-card + border-subtle + rounded-panel with --type-label-dense labels
  step_4: Fix all CardTitle components in SettingsFactoryTab and SettingsUsersTab
    from text-xl (20px) to text-[16px] font-semibold (--type-panel-title)
  step_5: Fix SettingsFactoryTab module chip colors from raw hex to semantic token classes
    (action-primary / status-success-fg / status-warning-fg / text-secondary)
  step_6: Fix SettingsFactoryTab container surfaces — starter modules panel and template
    sections from raw rgba + legacy aliases to surface-panel + border-subtle
  step_7: Fix SettingsFactoryTab factory directory cards and control tower description
    from legacy aliases to canonical tokens; fix Active badge to status-success semantic
  step_8: Fix SettingsUsersTab invite form field labels and factory access labels from
    uppercase tracking to sentence case --type-label
  step_9: Fix SettingsUsersTab mobile card stat labels from uppercase tracking to
    sentence case --type-label-dense; add inactive row visual treatment
  step_10: Add isBusy + busyLabel to all six action buttons:
    Save profile / Create factory / Generate invitation / Save factory access /
    Update Role / Deactivate User
  step_11: Fix global status and error messages from text-green-400/text-red-400 to
    text-status-success-fg / text-status-danger-fg
  step_12: Fix all remaining legacy alias token references throughout SettingsPage
    and SettingsShell (var(--muted), var(--text), var(--accent), var(--border),
    var(--card-strong), var(--color-*))
  step_13: Verify sticky tab navigation behavior; confirm tab bar remains accessible
    during scroll through long factory or users tab content
  step_14: Responsive verification — form columns collapse to single on mobile;
    touch targets ≥44px
```

### 13.2 Critical Constraints

```yaml
critical_constraints:
  - "Step 1 is the foundation — SettingsShell is the container for the entire workspace;
     fix it before any tab-level work to avoid visual conflicts"
  - "The <details>/<summary> removal (step 2) must NOT hide any navigation links;
     all four quick-nav buttons must remain visible after the fix"
  - "Module chip semantic token mapping must be COMPLETE before step 5 is deployed —
     partial hex-to-token migration leaves inconsistent chip colors"
  - "The DOWNGRADE confirmation (typed text) must remain as a client-side gate before
     the role update API call — do not remove this safety mechanism"
  - "Factory access: at least one factory must remain selected — the client-side guard
     (prevent removing the last selected factory) must be preserved"
  - "Deactivate user: cannot deactivate yourself — the server enforces this (HTTP 422);
     the UI should ideally filter out the current user from the deactivate input options"
  - "All spacing values must follow the 4px scale"
  - "All surfaces use canonical CSS token variables — no hex, no rgba, no var(--legacy-alias)"
```

### 13.3 Open Questions

```yaml
open_questions:
  - question: >
      The "Deactivate User" action currently has no confirmation dialog — the admin
      types a user ID and clicks the button. Should a confirmation step be added
      (e.g., a modal requiring the user's name to be typed) given that deactivation
      is irreversible (soft delete)?
    blocking: no — current typed-ID input provides some friction; a confirmation modal
      would be a UX safety improvement but is not required to proceed
    owner: product owner
    decision_needed_by: before step_10

  - question: >
      The SettingsShell GuidanceBlock cards use rounded-[24px] and rgba backgrounds.
      Should the GuidanceBlock component itself be governance-fixed as part of this
      spec, or is GuidanceBlock a shared component that should be fixed in a separate
      component governance task?
    blocking: no — fixing GuidanceBlock in this task is acceptable but should be
      coordinated if GuidanceBlock is used in other workspaces
    owner: frontend team
    decision_needed_by: before step_1

  - question: >
      The "Create factory" action is only available to admin/owner but the Create Factory
      card is inside SettingsFactoryTab which is shown to managers too. Currently the
      button is not disabled for managers — it relies on the server rejecting the request.
      Should the Create Factory card be conditionally hidden for manager role on the frontend?
    blocking: no — server enforces the restriction (HTTP 403); but surfacing the card
      to managers who cannot use it is poor UX
    owner: product owner / frontend team
    decision_needed_by: before step_4

open_questions_blocking: none
```

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections fully populated
- [x] Every layout zone has documented existence justification and testable acceptance criteria
- [x] Every component mapped to existing primitives; all critical fixes identified per component
- [x] Every operational failure from Section 1.3 has a resolution in Section 12
- [x] Reduction audit: <details>/<summary> removed (2 instances); raw hex colors removed;
      backdrop-blur removed; all oversized headings reduced
- [x] No anti-patterns in spec (no gradients, no glow, no uppercase labels, no raw hex)
- [x] All spacing follows 4px scale
- [x] All surfaces reference token variables
- [x] Typography follows approved system; table column headers correctly identified as the
      one governed exception for uppercase
- [x] Backend API surface verified from settings.py source (15 endpoints confirmed)
- [x] Permission matrix complete across 4 user tiers
- [x] Open questions populated; none blocking
- [x] 14-step implementation sequence complete

---

## POST-GENERATION SELF-VALIDATION

```yaml
self_validation:
  operational_integrity:
    - [x] All zones traced to backend entities/API
    - [x] Every zone justified by admin operator need
    - [x] No decorative zones; backdrop-blur hero reduced to flat panel
    - [x] Removed elements documented: <details>/<summary> ×2, backdrop-blur, shadow-2xl,
          text-3xl, text-xl ×6, raw hex ×3, rgba ×5, uppercase tracking ×12+,
          raw alias tokens ×15+, disabled-only buttons ×6

  law_compliance:
    - [x] Spacing 4px scale (12px, 16px, 20px, 24px, 40px)
    - [x] All surfaces use canonical token variables
    - [x] All labels sentence case EXCEPT table column headers (governed exception documented)
    - [x] Typography from approved system; numeric values use --type-numeric-md
    - [x] No AI elements

  kiro_readiness:
    - [x] 14-step implementation sequence
    - [x] All acceptance criteria testable
    - [x] No blocking open questions

  anti_pattern_check:
    - [x] No gradients
    - [x] No glow
    - [x] No backdrop-blur on static sections
    - [x] No UPPERCASE labels (except compliant table column headers documented)
    - [x] No marketing typography
    - [x] No <details>/<summary>
    - [x] No raw hex / rgba / RGB
    - [x] No disabled-only buttons without isBusy

  structural_integrity:
    - [x] Zone interactions cover all reactive behaviors (industry_type change, user select)
    - [x] Permission matrix complete and drives zone visibility
    - [x] Responsive layouts documented
    - [x] All problem resolutions reference specific spec sections
    - [x] Table column headers correctly identified as the one governed uppercase exception
```

---

## 14. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

---

### 14A. Desktop Structural Blueprint

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│  APP SHELL (sidebar 220px + topbar 48px) — context, not part of settings spec          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│  SETTINGS WORKSPACE FRAME  max-w-[1280px] centered  px-6 md:px-10 py-6                 │
│                                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │  PAGE HEADER          surface-panel / border-subtle                             │    │
│  │  "Settings"           11px/500/text-action-primary/sentence case               │    │
│  │  "Keep factory setup…" 18px/600 — NOT text-3xl                                 │    │
│  │  [subtitle]  14px/400/secondary                                                 │    │
│  │  NO backdrop-blur / NO rgba / NO shadow-2xl                                    │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│  ↕ 24px                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │  QUICK-NAV STRIP      surface-panel / border-subtle                             │    │
│  │  [Board] [Reports] [Plans] [Billing]   — ALWAYS VISIBLE                        │    │
│  │  Button ghost/outline asChild + Link                                            │    │
│  │  NOT inside <details>/<summary>                                                 │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│  ↕ 24px                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │  SUMMARY CARDS STRIP  grid md:grid-cols-3  gap-3                                │    │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                  │    │
│  │  │ Current Factory │ │ Factory Network │ │  Active Users   │                  │    │
│  │  │ surface-card    │ │ surface-card    │ │ surface-card    │                  │    │
│  │  │ border-subtle   │ │ border-subtle   │ │ border-subtle   │                  │    │
│  │  │ 11px/500/tert   │ │ 11px/500/tert   │ │ 11px/500/tert   │                  │    │
│  │  │ [name] 14px/600 │ │ [count] 18px/600│ │ [count] 18px/600│                  │    │
│  │  │ [detail] 11px   │ │ [detail] 11px   │ │ [detail] 11px   │                  │    │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘                  │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│  ↕ 24px                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │  TAB NAVIGATION  (sticky-on-scroll)                                             │    │
│  │  [Factory] [Users] [Usage] [Alerts?] [Feedback?]  — sentence case               │    │
│  │  Active tab: border-bottom action-primary                                       │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│  ↕ 24px                                                                                 │
│  ╔═════════════════════════════════════════════════════════════════════════════════╗    │
│  ║  TAB CONTENT ZONE (switches per activeTab)                                     ║    │
│  ║                                                                                 ║    │
│  ║  FACTORY TAB:  xl:grid-cols-[1.15fr_0.85fr]  gap-6                            ║    │
│  ║  ┌───────────────────────────────────┐  ┌───────────────────────────────────┐ ║    │
│  ║  │ FACTORY PROFILE FORM [P:1]         │  │ CREATE FACTORY [P:2]              │ ║    │
│  ║  │ surface-card / border-subtle       │  │ surface-card / border-subtle      │ ║    │
│  ║  │ "Factory profile" 16px/600         │  │ "Create factory" 16px/600         │ ║    │
│  ║  │ 2-col grid: Name | Industry        │  │ Name / Industry / Template /      │ ║    │
│  ║  │            Template | Address      │  │ Location / Address / Pack preview │ ║    │
│  ║  │ Starter modules (surface-panel)   │  │ [Create factory] (isBusy)         │ ║    │
│  ║  │ [chip chips — semantic tokens]    │  ├───────────────────────────────────┤ ║    │
│  ║  │ Template sections (cond.)         │  │ CONTROL TOWER SNAPSHOT [P:3]      │ ║    │
│  ║  │ Morning/Evening/Night targets     │  │ surface-card / border-subtle      │ ║    │
│  ║  │ [Save profile] (isBusy)           │  │ Org name + plan display           │ ║    │
│  ║  └───────────────────────────────────┘  │ Factory directory cards:          │ ║    │
│  ║                                          │  surface-card / border-subtle     │ ║    │
│  ║                                          │  [Active] badge: status-success   │ ║    │
│  ║                                          │  name/industry/code/members/role  │ ║    │
│  ║                                          └───────────────────────────────────┘ ║    │
│  ║                                                                                 ║    │
│  ║  USERS TAB:  xl:grid-cols-[1.1fr_0.9fr]  gap-6                                ║    │
│  ║  ┌───────────────────────────────────┐  ┌───────────────────────────────────┐ ║    │
│  ║  │ GOVERNANCE REGISTRY TABLE [P:1]   │  │ INVITE NEW USER [P:2]             │ ║    │
│  ║  │ surface-card / border-subtle       │  │ surface-card / border-subtle      │ ║    │
│  ║  │ "Governance registry" 16px/600    │  │ "Invite new user" 16px/600        │ ║    │
│  ║  │ Desktop table (md:block):         │  │ Name / Email / Role fields        │ ║    │
│  ║  │  headers: 10px/600/UPPER/≤0.06em  │  │  labels: sentence case --type-label│ ║    │
│  ║  │  cells: 13px/400                  │  │ [Generate invitation] (isBusy)    │ ║    │
│  ║  │  user_id: monospace               │  ├───────────────────────────────────┤ ║    │
│  ║  │  inactive row: text-tertiary      │  │ FACTORY ACCESS [admin/owner]      │ ║    │
│  ║  │ Mobile cards (md:hidden):         │  │ surface-card / border-subtle      │ ║    │
│  ║  │  labels: 11px/500/sentence case   │  │ User select + factory checkboxes  │ ║    │
│  ║  │  (NOT uppercase)                  │  │ [Save factory access] (isBusy)    │ ║    │
│  ║  └───────────────────────────────────┘  ├───────────────────────────────────┤ ║    │
│  ║                                          │ UPDATE ROLE / DEACTIVATE          │ ║    │
│  ║                                          │ surface-card / border-subtle      │ ║    │
│  ║                                          │ User code + New role + DOWNGRADE  │ ║    │
│  ║                                          │ confirmation input                │ ║    │
│  ║                                          │ [Update Role] (isBusy)            │ ║    │
│  ║                                          │ ── border-top separator ──        │ ║    │
│  ║                                          │ Deactivate ID input               │ ║    │
│  ║                                          │ [Deactivate User] (destructive)   │ ║    │
│  ║                                          │                     (isBusy)      │ ║    │
│  ║                                          └───────────────────────────────────┘ ║    │
│  ╚═════════════════════════════════════════════════════════════════════════════════╝    │
│  ↕ 24px                                                                                 │
│  [STATUS MESSAGE]  text-status-success-fg — NOT text-green-400                         │
│  [ERROR MESSAGE]   text-status-danger-fg  — NOT text-red-400                           │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

# FactoryNerve OS — Visual Workspace Blueprints
# Settings Tabs: factory · usage · alerts
# Desktop 1440px · Dense, operational, alive
# Generated: 2026-06-03

---

## LEGEND
```
████ surface-card    ▓▓▓▓ surface-panel    ░░░░ surface-shell/elevated
──── border-default  ···· border-subtle    ════ zone separator
◉ active/selected    ○ inactive    ★ status    [i] interactive    [!] required
```

---
---

## /settings?tab=factory  [P:1 — Factory Profile]  [P:2 — Create + Control Tower]

```
┌─[APP TOPBAR 48px]──────────────────────────────────────────────────────────────────────┐
│ DPR.ai  ·  Shree Steel Works  ·  Factory profile             ⚙ Commands  [≡ Nav]       │
└────────────────────────────────────────────────────────────────────────────────────────┘
┌─[SIDEBAR 220px]─┬─[MAIN WORKSPACE surface-shell]──────────────────────────────────────┐
│ ■ Dashboard     │                                                                      │
│ ○ Approvals     │  ░ Settings                      11px/500 text-action-primary        │
│ ○ Attendance    │  Keep factory setup and team control in one admin lane  18px/600     │
│ ○ Reports       │  Update factory setup, manage people, and check plan posture.        │
│ ○ Settings  ◉   │  ───────────────────────────────────────────────────────────────    │
│ ·               │  [Board] [Reports] [Plans] [Billing]    ← ALWAYS VISIBLE quick-nav  │
│ ○ Profile       │  ───────────────────────────────────────────────────────────────    │
│                 │  ┌─ Current Factory ──┐ ┌─ Factory Network ──┐ ┌─ Active Users ──┐  │
│                 │  │░░░░░░░░░░░░░░░░░░░│ │░░░░░░░░░░░░░░░░░░░│ │░░░░░░░░░░░░░░░░│  │
│                 │  │ Current factory    │ │ Factory network    │ │ Active users   │  │
│                 │  │ Shree Steel Works  │ │         3          │ │       12       │  │
│                 │  │ Steel · General Ops│ │ Steel:2 · Gen:1    │ │ Starter · Active│  │
│                 │  └────────────────────┘ └────────────────────┘ └────────────────┘  │
│                 │  ════ [Factory] [Users] [Usage] [Alerts] ═══════════════════════    │
│                 │       ───────                                                        │
│                 │  ┌─[LEFT col 54% surface-card]────────────────────────────────────┐ │
│                 │  │ Factory profile                  16px/600                       │ │
│                 │  │ ────────────────────────────────────────────────────────────── │ │
│                 │  │ Factory name [!]        Industry profile [!]                   │ │
│                 │  │ [Shree Steel Rolling Works       ] [Steel Manufacturing  ▾]    │ │
│                 │  │                                                                 │ │
│                 │  │ Workflow template [!]   Address                                │ │
│                 │  │ [Steel Ops Pack         ▾]  [123 Industrial Area, Surat  ]     │ │
│                 │  │ Choose the operating template → starter pack for this factory. │ │
│                 │  │ ──────────────────────────────────────────────────────────── │ │
│                 │  │ ░ Starter modules ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │
│                 │  │  [DPR] [Traceability] [Quality] [Dispatch] [Reports] [Scrap]  │ │
│                 │  │  ·─ Template sections ─────────────────────────────────────   │ │
│                 │  │  ┌─ Daily Production ──────┐  ┌─ Quality Control ───────────┐ │ │
│                 │  │  │░ shift · heat · output  │  │░ grade · batch · pass/fail  │ │ │
│                 │  │  └─────────────────────────┘  └────────────────────────────┘ │ │
│                 │  │ ──────────────────────────────────────────────────────────── │ │
│                 │  │ Morning target   Evening target   Night target                │ │
│                 │  │ [ 120         ]  [ 80          ]  [ 40        ]               │ │
│                 │  │ ──────────────────────────────────────────────────────────── │ │
│                 │  │ [Save profile ─── primary ── isBusy → "Saving..."]           │ │
│                 │  └─────────────────────────────────────────────────────────────┘ │
└─────────────────┤                                                                      │
                  │  ┌─[RIGHT col 46%]─────────────────────────────────────────────┐    │
                  │  │  ┌─[CREATE FACTORY surface-card]───────────────────────┐    │    │
                  │  │  │ Create factory                   16px/600            │    │    │
                  │  │  │ Factory name [!]  [New Factory Name              ]   │    │    │
                  │  │  │ Industry profile  [General Manufacturing         ▾]   │    │    │
                  │  │  │ Workflow template [General Ops Pack              ▾]   │    │    │
                  │  │  │ Location          [City, State                   ]   │    │    │
                  │  │  │ Address           [Street address                ]   │    │    │
                  │  │  │ ░ Pack preview ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   │    │    │
                  │  │  │  [DPR] [Downtime] [Quality]  shared starter modules  │    │    │
                  │  │  │ [Create factory ── primary ── isBusy → "Creating..."]│    │    │
                  │  │  └──────────────────────────────────────────────────────┘    │    │
                  │  │  ┌─[CONTROL TOWER surface-card]────────────────────────┐    │    │
                  │  │  │ Control tower snapshot          16px/600             │    │    │
                  │  │  │ Org: Shree Industries · Plan Starter                 │    │    │
                  │  │  │ ┌─────────────────────────────────────────────────┐ │    │    │
                  │  │  │ │████ Shree Steel Works                           │ │    │    │
                  │  │  │ │     Steel Manufacturing · General Ops Pack       │ │    │    │
                  │  │  │ │     Code SHR-01 · Members 12 · My role: owner   │ │    │    │
                  │  │  │ │                              ★ Active            │ │    │    │
                  │  │  │ └─────────────────────────────────────────────────┘ │    │    │
                  │  │  │ ┌─────────────────────────────────────────────────┐ │    │    │
                  │  │  │ │▓▓▓▓ Shree Wire Factory                          │ │    │    │
                  │  │  │ │     Steel Manufacturing · Wire Ops Pack          │ │    │    │
                  │  │  │ │     Code SHR-02 · Members 8 · My role: admin    │ │    │    │
                  │  │  │ └─────────────────────────────────────────────────┘ │    │    │
                  │  │  └──────────────────────────────────────────────────────┘    │    │
                  │  └────────────────────────────────────────────────────────────────┘   │
                  │  ★ Factory settings saved.      13px text-status-success-fg           │
                  └───────────────────────────────────────────────────────────────────────┘

SCAN FLOW:
  [1] 0–200ms → Factory name field (top of form, first editable)
  [2] 200ms–1s → Industry profile + Workflow template (reactive selectors)
  [3] 1–3s → Starter modules chips + targets + Save button
  [4] 3s+ → Right col: Create factory (occasional) · Control tower (read-only reference)

DENSITY RULES:
  · Factory profile form: fields at 16px gap — tight enough to read as one unit
  · Starter modules: chip gap 8px — dense horizontal scan
  · Template sections: 2-col grid — visual scan without hunting
  · Right column: two stacked cards with 24px gap — visually distinct tasks
  · Control tower items: full-width cards — each factory gets equal weight, no cramping
  · Save button: separated by 16px from last target field — clear but not isolated
```

---
---

## /settings?tab=usage  [P:1 — AI Usage · Billing Status]

```
┌─[APP TOPBAR 48px]──────────────────────────────────────────────────────────────────────┐
│ DPR.ai  ·  Shree Steel Works  ·  Settings                    ⚙ Commands  [≡ Nav]       │
└────────────────────────────────────────────────────────────────────────────────────────┘
┌─[SIDEBAR 220px]─┬─[MAIN WORKSPACE surface-shell]──────────────────────────────────────┐
│ ■ Dashboard     │                                                                      │
│ ○ Approvals     │  ░ Settings · 11px/500/action-primary                               │
│ ○ Settings  ◉   │  Keep factory setup and team control in one admin lane  18px/600     │
│                 │  ───────────────────────────────────────────────────────────────    │
│                 │  [Board] [Reports] [Plans] [Billing]                                 │
│                 │  ───────────────────────────────────────────────────────────────    │
│                 │  ┌── Current Factory ──┐ ┌── Factory Network ──┐ ┌── Users ──────┐ │
│                 │  │░ Shree Steel Works  │ │░       3            │ │░     12       │ │
│                 │  │  Steel · General Ops│ │  Steel:2 · Gen:1    │ │  Starter · ✓  │ │
│                 │  └─────────────────────┘ └─────────────────────┘ └───────────────┘ │
│                 │  ════ [Factory] [Users] [◉ Usage] [Alerts] ══════════════════════   │
│                 │                ──────                                                │
│                 │  ┌─[LEFT col 50% — USAGE SUMMARY surface-card]──────────────────┐  │
│                 │  │ Usage summary                              16px/600           │  │
│                 │  │ ──────────────────────────────────────────────────────────── │  │
│                 │  │ ┌── Requests used ─┐  ┌── Credits used ──┐                  │  │
│                 │  │ │░░░░░░░░░░░░░░░░░│  │░░░░░░░░░░░░░░░░░│                  │  │
│                 │  │ │ Requests used    │  │ Credits used     │                  │  │
│                 │  │ │ 11px/500/tert    │  │ 11px/500/tert    │                  │  │
│                 │  │ │    1,240         │  │     88           │                  │  │
│                 │  │ │ 18px/600 mono    │  │ 18px/600 mono    │                  │  │
│                 │  │ └──────────────────┘  └──────────────────┘                  │  │
│                 │  │ ┌── Request limit ─┐  ┌── Rate limit/min ┐                  │  │
│                 │  │ │░░░░░░░░░░░░░░░░░│  │░░░░░░░░░░░░░░░░░│                  │  │
│                 │  │ │ Request limit    │  │ Rate limit / min │                  │  │
│                 │  │ │ 11px/500/tert    │  │ 11px/500/tert    │                  │  │
│                 │  │ │   Unlimited      │  │      60          │                  │  │
│                 │  │ │ 18px/600 mono    │  │ 18px/600 mono    │                  │  │
│                 │  │ └──────────────────┘  └──────────────────┘                  │  │
│                 │  └──────────────────────────────────────────────────────────────┘  │
│                 │                                                                      │
│                 │  ┌─[RIGHT col 50% — BILLING STATUS surface-card]─────────────────┐ │
│                 │  │ Billing status                             16px/600            │ │
│                 │  │ ──────────────────────────────────────────────────────────── │ │
│                 │  │ ┌── Plan ──────────┐  ┌── Status ────────┐                  │ │
│                 │  │ │░░░░░░░░░░░░░░░░░│  │░░░░░░░░░░░░░░░░░│                  │ │
│                 │  │ │ Plan             │  │ Status           │                  │ │
│                 │  │ │ 11px/500/tert    │  │ 11px/500/tert    │                  │ │
│                 │  │ │   Starter        │  │   trialing       │                  │ │
│                 │  │ │ 18px/600 mono    │  │ 18px/600 mono    │                  │ │
│                 │  │ └──────────────────┘  └──────────────────┘                  │ │
│                 │  │ ┌── Trial ends ────┐  ┌── Period end ────┐                  │ │
│                 │  │ │░░░░░░░░░░░░░░░░░│  │░░░░░░░░░░░░░░░░░│                  │ │
│                 │  │ │ Trial ends       │  │ Period end       │                  │ │
│                 │  │ │ 11px/500/tert    │  │ 11px/500/tert    │                  │ │
│                 │  │ │ 30 Jun 2026      │  │ 30 Jun 2026      │                  │ │
│                 │  │ │ 11px mono        │  │ 11px mono        │                  │ │
│                 │  │ └──────────────────┘  └──────────────────┘                  │ │
│                 │  │                                                               │ │
│                 │  │ ┄ Pending plan (conditional) ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │ │
│                 │  │ ░ Pending plan: Pro  effective 01 Jul 2026  14px/secondary  │ │
│                 │  └──────────────────────────────────────────────────────────────┘ │
└─────────────────┴────────────────────────────────────────────────────────────────────┘

SCAN FLOW:
  [1] 0–300ms → Two stat grids render as a unit — eye reads left-to-right: requests, credits,
                limit, rate. No hunting. 4 stats = one cognitive chunk.
  [2] 300ms–1s → Billing grid: plan name + status — the two highest-signal values.
  [3] 1s–2s → Date values: trial end + period end — confirm billing health.
  [4] 2s+ → Pending plan notice (conditional) — only rendered when a plan change is queued.

DENSITY RULES:
  · Both columns equal width (50/50) — usage and billing are co-equal concerns.
  · 4 stat cards per column, 2-col grid, 12px gap — information-dense without crowding.
  · Stat card: surface-elevated bg, 12px/12px padding (compact but tactile).
  · Label 11px/tert sits 4px above value — label recedes, value dominates.
  · Value at 18px/600/mono — tabular nums ensure column alignment on repeating scans.
  · Date values at 11px/mono (--type-timestamp) — smaller than counts; dates are reference, not KPI.
  · Pending plan uses surface-shell strip — stands out structurally, not with color.
  · No empty panels, no placeholder text — if data is null show "-" inline, not a blank card.

RESPONSIVE (compact ≤1279px):
  Both cards stack vertically. 2-col stat grid preserved within each card. No information lost.

MOBILE (<768px):
  Single column. Stat grid collapses to 1-col. Dates shown as full ISO string (readable on small screen).
```

---
---

## /settings?tab=alerts  [P:1 — Recipients · P:2 — Activity Log]

```
┌─[APP TOPBAR 48px]──────────────────────────────────────────────────────────────────────┐
│ DPR.ai  ·  Shree Steel Works  ·  Settings                    ⚙ Commands  [≡ Nav]       │
└────────────────────────────────────────────────────────────────────────────────────────┘
┌─[SIDEBAR 220px]─┬─[MAIN WORKSPACE surface-shell]──────────────────────────────────────┐
│ ■ Dashboard     │                                                                      │
│ ○ Settings  ◉   │  ░ Settings                                                          │
│                 │  Keep factory setup and team control in one admin lane  18px/600     │
│                 │  ─────────────────────────────────────────────────────────────────  │
│                 │  [Board] [Reports] [Plans] [Billing]                                 │
│                 │  ─────────────────────────────────────────────────────────────────  │
│                 │  ┌─ Current Factory ─┐ ┌─ Factory Network ─┐ ┌─ Active Users ────┐  │
│                 │  │░ Shree Steel Works│ │░       3          │ │░       12         │  │
│                 │  │  Steel · Gen Ops  │ │  Steel:2 · Gen:1  │ │  Starter · Active │  │
│                 │  └───────────────────┘ └───────────────────┘ └───────────────────┘  │
│                 │  ════ [Factory] [Users] [Usage] [◉ Alerts] ═════════════════════    │
│                 │                                  ────────                            │
│                 │  ┌── Active recipients ──┐ ┌── Remaining capacity ──┐ ┌── Last sent ──┐│
│                 │  │░░░░░░░░░░░░░░░░░░░░░░│ │░░░░░░░░░░░░░░░░░░░░░░░│ │░░░░░░░░░░░░░│ │
│                 │  │ Active recipients     │ │ Remaining capacity     │ │ Last alert  │ │
│                 │  │         2             │ │           1            │ │  Delivered  │ │
│                 │  │ 18px/600/mono         │ │ 18px/600/mono          │ │ 14px/600    │ │
│                 │  │ STARTER_PLAN·3 slots  │ │ Unverified ≠ active   │ │ Auth anomaly│ │
│                 │  │ 11px/mono/tert        │ │ 11px/mono/tert         │ │ 03 Jun 11:24│ │
│                 │  └───────────────────────┘ └────────────────────────┘ └─────────────┘ │
│                 │                                                                        │
│                 │  ┌─[LEFT 60% — WHATSAPP RECIPIENTS surface-card]──────────────────┐  │
│                 │  │ WhatsApp recipients          16px/600        [Refresh] [Add +]  │  │
│                 │  │ Decide who receives critical factory alerts.  14px/secondary    │  │
│                 │  │ ──────────────────────────────────────────────────────────────  │  │
│                 │  │ ┌─[RECIPIENT CARD surface-card]────────────────────────────┐   │  │
│                 │  │ │ +91 98765 ***** 4210                         14px/600    │   │  │
│                 │  │ │ [★ verified  success-bg] [● Active  success-bg]          │   │  │
│                 │  │ │ ┌── Receives ────────┐ ┌── Verified at ─────┐ ┌Safety──┐│   │  │
│                 │  │ │ │░ Critical, Security│ │░ 01 Jun 2026 09:14 │ │░Eligible││   │  │
│                 │  │ │ │  Warnings, Reports │ │  11px/mono/tert     │ │  live  ││   │  │
│                 │  │ │ └────────────────────┘ └────────────────────┘ └────────┘│   │  │
│                 │  │ │ ┌── Live delivery ─────────────────┐                    │   │  │
│                 │  │ │ │ Enabled    ◉─────────●           │  [Verify] [Edit]   │   │  │
│                 │  │ │ │            active toggle          │  [Delete!]         │   │  │
│                 │  │ │ └──────────────────────────────────┘                    │   │  │
│                 │  │ └──────────────────────────────────────────────────────────┘   │  │
│                 │  │ ┌─[RECIPIENT CARD surface-card]────────────────────────────┐   │  │
│                 │  │ │ +91 77654 ***** 9901                         14px/600    │   │  │
│                 │  │ │ [⚠ pending  warning-bg]  [○ Paused  surface-elevated]    │   │  │
│                 │  │ │ ┌── Receives ────────┐ ┌── Verified at ─────┐ ┌Safety──┐│   │  │
│                 │  │ │ │░ Critical, Security│ │░ Not verified yet  │ │░Verify ││   │  │
│                 │  │ │ │  14px/secondary     │ │  11px/mono/tert     │ │ first  ││   │  │
│                 │  │ │ └────────────────────┘ └────────────────────┘ └────────┘│   │  │
│                 │  │ │ ┌────────────────────────────────────────────────────┐  │   │  │
│                 │  │ │ │⚠ Verify number before enabling alerts. warning-bg │  │   │  │
│                 │  │ │ └────────────────────────────────────────────────────┘  │   │  │
│                 │  │ │ ┌── Live delivery (disabled) ──────────────────────┐   │   │  │
│                 │  │ │ │ Disabled   ●─────────○     [Verify] [Edit] [Del!]│   │   │  │
│                 │  │ │ └──────────────────────────────────────────────────┘   │   │  │
│                 │  │ └──────────────────────────────────────────────────────────┘   │  │
│                 │  │                                                                  │  │
│                 │  │ ┌─[CONFIG RULES surface-card]──────────────────────────────┐   │  │
│                 │  │ │ Alert configuration rules   16px/600                      │   │  │
│                 │  │ │ ░ Each recipient has independent subscriptions—critical   │   │  │
│                 │  │ │   alerts reach the right people without spam. 13px/sec    │   │  │
│                 │  │ │ ░ Critical/warning maps to existing severity filters.     │   │  │
│                 │  │ │ ░ Machine downtime reserved for future backend support.   │   │  │
│                 │  │ └──────────────────────────────────────────────────────────┘   │  │
│                 │  └──────────────────────────────────────────────────────────────────┘ │
│                 │                                                                        │
│                 │  ┌─[RIGHT 40% — ACTIVITY LOG surface-card]────────────────────────┐  │
│                 │  │ Activity / Logs           16px/600              [Refresh]       │  │
│                 │  │ Delivery problems visible in real time. 14px/secondary          │  │
│                 │  │ ─────────────────────────────────────────────────────────────  │  │
│                 │  │ ┌──────────────────────────────────────────────────────────┐  │  │
│                 │  │ │ [! CRITICAL danger-bg] [Delivered success-bg]  11:24 am  │  │  │
│                 │  │ │ Security Anomaly                                14px/600  │  │  │
│                 │  │ │ Auth anomaly detected on 3 accounts.           13px/sec   │  │  │
│                 │  │ └──────────────────────────────────────────────────────────┘  │  │
│                 │  │ ┌──────────────────────────────────────────────────────────┐  │  │
│                 │  │ │ [HIGH warning-bg]  [Delivered success-bg]      09:01 am  │  │  │
│                 │  │ │ OCR Failure Spike                               14px/600  │  │  │
│                 │  │ │ 14 consecutive OCR failures in 10 min.         13px/sec   │  │  │
│                 │  │ └──────────────────────────────────────────────────────────┘  │  │
│                 │  │ ┌──────────────────────────────────────────────────────────┐  │  │
│                 │  │ │◉[SELECTED surface-selected border-focus]                 │  │  │
│                 │  │ │ [MEDIUM surface-panel]  [Suppressed warning-bg]  Yesterday│  │  │
│                 │  │ │ Abnormal Error Rate                             14px/600  │  │  │
│                 │  │ │ Error rate exceeded baseline threshold.         13px/sec   │  │  │
│                 │  │ └──────────────────────────────────────────────────────────┘  │  │
│                 │  │ ─── Alert detail: selected ref ────────────────────────────   │  │
│                 │  │ ┌──────────────────────────────────────────────────────────┐  │  │
│                 │  │ │ Alert delivery detail                   ref: ALT-20240603 │  │  │
│                 │  │ │ [MEDIUM surface-panel] [Suppressed warning-bg]            │  │  │
│                 │  │ │ Abnormal Error Rate · Yesterday 14:32                     │  │  │
│                 │  │ │ ─────────────────────────────────────────────────────    │  │  │
│                 │  │ │ ┌── Per-recipient deliveries ──────────────────────────┐ │  │  │
│                 │  │ │ │[Suppressed] +91 98765**** 4210  OT threshold window   │ │  │  │
│                 │  │ │ │[Suppressed] +91 77654**** 9901  Not verified         │ │  │  │
│                 │  │ │ └──────────────────────────────────────────────────────┘ │  │  │
│                 │  │ └──────────────────────────────────────────────────────────┘  │  │
│                 │  └──────────────────────────────────────────────────────────────────┘ │
└─────────────────┴────────────────────────────────────────────────────────────────────────┘

────────────────── ACTION MODAL (Add/Edit Recipient) ──────────────────
Triggered by: [Add +] or [Edit] on a recipient card
Rendered as: overlay on top of the full settings page

┌─[MODAL OVERLAY surface-overlay backdrop-blur]─────────────────────────────────────────┐
│                  ┌─[MODAL CONTAINER surface-overlay border-default rounded-panel]────┐ │
│                  │ ░ Alerts                     11px/500/action-primary              │ │
│                  │ Add WhatsApp Recipient        16px/600/text-text-primary          │ │
│                  │ New numbers saved as pending.                         [Close]     │ │
│                  │ ══════════════════════════════════════════════════════════════   │ │
│                  │ Phone number [!]                                                  │ │
│                  │ [+919876543210                                                 ]  │ │
│                  │ This is the only place where the full number is shown. 12px/tert  │ │
│                  │ ──────────────────────────────────────────────────────────────   │ │
│                  │ ┌── Critical alerts ──────┐  ┌── Warning alerts ───────────┐    │ │
│                  │ │▓ High+critical severity │  │▓ Low+medium severity        │    │ │
│                  │ │  ops alerts. 13px/sec   │  │  factory warnings. 13px/sec │    │ │
│                  │ │                    [✓] │  │                         [✓] │    │ │
│                  │ └─────────────────────────┘  └────────────────────────────┘    │ │
│                  │ ┌── Security alerts ──────┐  ┌── Reports ──────────────────┐   │ │
│                  │ │▓ Auth anomaly+access    │  │▓ Daily summary + rollups    │   │ │
│                  │ │  risk alerts.  13px/sec │  │  messages.       13px/sec   │   │ │
│                  │ │                    [✓] │  │                         [✓] │   │ │
│                  │ └─────────────────────────┘  └────────────────────────────┘   │ │
│                  │ ┌── Machine downtime ─────────────────────────────────────┐   │ │
│                  │ │▓ Reserved — future backend support.     disabled [  ] │   │ │
│                  │ └──────────────────────────────────────────────────────────┘   │ │
│                  │ ──────────────────────────────────────────────────────────────  │ │
│                  │ ┌── Active delivery ──────────────────────────────────────┐    │ │
│                  │ │▓ Keep off until verified and ready for live alerts.     │    │ │
│                  │ │  ⚠ Verify number before enabling alerts. warning-bg    │    │ │
│                  │ │                                             [  ] Off    │    │ │
│                  │ └──────────────────────────────────────────────────────────┘   │ │
│                  │ ─────────────────────────────────── [Cancel] [Save recipient]  │ │
│                  └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘

────────────────── OTP VERIFICATION MODAL ──────────────────
Triggered by: [Verify] or [Re-verify] on a recipient card

┌─[MODAL OVERLAY surface-overlay backdrop-blur]─────────────────────────────────────────┐
│                  ┌─[MODAL CONTAINER surface-overlay border-default rounded-panel]────┐ │
│                  │ ░ Alerts   · 11px/500/action-primary                              │ │
│                  │ Verify Alert Recipient         16px/600                           │ │
│                  │ OTP sent only when needed.                           [Close]      │ │
│                  │ ══════════════════════════════════════════════════════════════   │ │
│                  │ ┌── Destination ────────────────────────────────────────────┐   │ │
│                  │ │░ +91 98765 ***** 4210          masked after first send     │   │ │
│                  │ │  Code expires in  04m 32s    ← --type-timestamp countdown  │   │ │
│                  │ └──────────────────────────────────────────────────────────┘   │ │
│                  │ Enter OTP [!]                                                    │ │
│                  │ [______  6-digit code  inputMode=numeric maxLength=6        ]    │ │
│                  │ ─────────────────────────────────────────────────────────────   │ │
│                  │ [Resend code]       [Cancel]    [Confirm verification isBusy]    │ │
│                  └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘

SCAN FLOW — main alerts tab:
  [1] 0–200ms → KPI strip: active count + capacity + last alert status.
                Operator knows immediately if the alert system is healthy.
  [2] 200ms–1s → Recipient list: each card scanned top-to-bottom.
                 Status badges (verified/pending + active/paused) are the decision signals.
  [3] 1–3s → Individual recipient controls: toggle, verify, edit, delete.
             Verification warning (amber) intercepts attention before toggle attempt.
  [4] 3s+ → Activity log: scan badges (severity + delivery) first, then read event type.
             Selected alert expands detail below without navigation — inline drill-down.

DENSITY RULES:
  · KPI strip: 3-col, surface-panel, 12px/12px padding — tight; counts dominate at 18px/600/mono.
  · Recipient cards: surface-card full-width; inner stat strip 3-col at 8px gap — always 3 facts visible.
  · Toggle: inline in its own surface row — visual separation from the action buttons below it.
  · Verification warning: amber status strip sits directly below toggle — spatial proximity = cause+effect.
  · Activity log items: no wasted space — severity badge + delivery badge + time on one line,
    event name on next, summary on next. 3 lines per item. Dense, scannable.
  · Selected item opens detail INLINE below the log — no navigation, no modal.
  · Config rules card: 3 dense text blocks, no decorative containers. Plain surface-elevated tiles.

BADGE SEMANTIC MAP (replaces all raw rgba/color helpers):
  CRITICAL  → status-danger-bg  / border-status-danger-border  / text-status-danger-fg
  HIGH      → status-warning-bg / border-status-warning-border / text-status-warning-fg
  MEDIUM    → surface-panel     / border-default               / text-text-secondary
  LOW       → surface-elevated  / border-subtle                / text-text-tertiary
  delivered → status-success-bg / border-status-success-border / text-status-success-fg
  suppressed→ status-warning-bg / border-status-warning-border / text-status-warning-fg
  failed    → status-danger-bg  / border-status-danger-border  / text-status-danger-fg
  verified  → status-success-bg / border-status-success-border / text-status-success-fg
  pending   → status-warning-bg / border-status-warning-border / text-status-warning-fg
  failed    → status-danger-bg  / border-status-danger-border  / text-status-danger-fg

RESPONSIVE:
  ≤1279px: xl:grid-cols collapses — recipients and activity log stack vertically.
           KPI strip wraps to 1-col. All recipient cards remain full-width. Detail stays inline.
  <768px:  Single column. Recipient inner stat strip stacks (3-col → 1-col).
           Modal stays centered, max-w-2xl becomes 100% with 16px inset.
```


---

### 14B. Visual Attention Flow Map

**Factory tab:**
```
SCAN 1 (0–200ms): Factory name field (top of profile form — first editable element)
SCAN 2 (200ms–1s): Industry profile + Workflow template selects (high-consequence choices)
SCAN 3 (1s–3s): Starter modules chips + targets + Save button
SCAN 4 (3s+): Right column (Create factory, Control tower snapshot — occasional use)
```

**Users tab:**
```
SCAN 1 (0–200ms): User table (who is in my factory?)
SCAN 2 (200ms–1s): Invite new user card (most common admin action)
SCAN 3 (1s–3s): Factory access + role update cards
SCAN 4 (3s+): Deactivate section (rare, destructive — intentionally last)
```

---

### 14C. Spacing & Rhythm Visualization

```
DENSE: Table rows (40px height, 12px/8px padding) — user list needs compact scanning
BREATHABLE: Section cards (20px padding) — each admin task needs visual separation
VISUAL SILENCE: The 24px gap between page sections creates clear domain transitions:
  Header → Quick nav → Summary → Tabs → Tab content
  Each section is a distinct operational concern; the gap communicates separation
```

---

### 14D. Component Nesting Hierarchy

```
<main> (AppShell workspace frame, max-w-1280px)
  ├── SettingsShell
  │     ├── PageHeader (surface-panel/border-subtle)
  │     │     ├── Eyebrow (11px/500/action-primary/sentence)
  │     │     ├── <h1> (18px/600)
  │     │     └── Subtitle (14px/400/secondary)
  │     ├── QuickNavStrip (surface-panel/border-subtle — NOT <details>)
  │     │     └── Button asChild + Link × 4
  │     ├── SummaryCardsStrip (grid 3-col)
  │     │     └── SummaryCard × 3 (surface-card/border-subtle)
  │     ├── SettingsTabNav (sticky)
  │     │     └── TabButton × 3–5 (sentence case)
  │     └── TabContent (children — switches per activeTab)
  │
  ├── SettingsFactoryTab (factory tab content)
  │     ├── FactoryProfileCard (surface-card, left col)
  │     │     ├── Field × 4 + Label (sentence case) + Input/Select
  │     │     ├── StarterModulesPanel (surface-panel/border-default)
  │     │     │     └── ModuleChip × N (semantic token colors)
  │     │     ├── TemplateSectionsGrid (conditional, surface-panel/border-subtle)
  │     │     ├── TargetFields × 3 (number inputs)
  │     │     └── Button variant="primary" isBusy "Save profile"
  │     └── RightColumn (right col)
  │           ├── CreateFactoryCard (surface-card)
  │           │     └── Field × 5 + PackPreview + Button isBusy "Create factory"
  │           └── ControlTowerCard (surface-card)
  │                 └── FactoryDirectoryItem × N (surface-card/border-subtle)
  │                       └── ActiveBadge (status-success-bg/fg, sentence case)
  │
  ├── SettingsUsersTab (users tab content)
  │     ├── GovernanceRegistryCard (surface-card, left col)
  │     │     ├── <table> (desktop, md:block)
  │     │     │     ├── <thead> — 10px/600/UPPERCASE/tracking≤0.06em (table headers — OK)
  │     │     │     └── <tbody> rows — 13px/400; inactive rows text-tertiary
  │     │     └── MobileCardList (md:hidden)
  │     │           └── UserCard × N (surface-panel/border-subtle)
  │     │                 └── StatLabel (11px/500/sentence case — NOT uppercase)
  │     └── ActionCardsColumn (right col)
  │           ├── InviteCard (surface-card)
  │           │     └── Field × 3 (sentence case labels) + Button isBusy "Inviting..."
  │           ├── FactoryAccessCard (surface-card, admin/owner only)
  │           │     └── UserSelect + FactoryCheckboxList + Button isBusy "Saving..."
  │           └── RoleDeactivateCard (surface-card)
  │                 ├── UserCodeInput + RoleSelect + DowngradeConfirmInput
  │                 ├── Button isBusy "Updating..."
  │                 ├── Separator (border-top)
  │                 ├── DeactivateUserInput
  │                 └── Button variant="destructive" isBusy "Deactivating..."
  │
  ├── StatusMessage (text-status-success-fg)
  └── ErrorMessage (text-status-danger-fg)
```

---

### 14E. Responsive Blueprint

```
1280px+ (Desktop):
┌──────────────────────────────────────────────────────────────┐
│ PageHeader (full width)                                      │
│ QuickNavStrip (full width)                                   │
│ SummaryCards (3-col)                                         │
│ TabNav (sticky)                                              │
├──────────────────────────────────┬───────────────────────────┤
│ FACTORY TAB:                     │  CREATE FACTORY +         │
│ Profile form (1.15fr)             │  Control tower (0.85fr)   │
│ OR                               │  OR                       │
│ USERS TAB:                       │  ACTION CARDS             │
│ Governance table (1.1fr)          │  (0.9fr)                  │
└──────────────────────────────────┴───────────────────────────┘

<768px (Mobile — stacked):
┌──────────────────────────────────────┐
│ PageHeader                           │
│ QuickNavStrip (wraps to 2 rows)      │
│ SummaryCards (1-col stacked)         │
│ TabNav (scrollable horizontally)     │
├──────────────────────────────────────┤
│ Factory tab: stacked single column   │
│ 2-col form grid → 1-col             │
│ OR                                   │
│ Users tab: mobile card list          │
│ (table hidden)                       │
│ + action cards stacked below        │
└──────────────────────────────────────┘
```

---

### 14F. Structural Consistency Validation

```yaml
structural_validation:
  - [x] All zones justified by operational necessity
  - [x] Visual dominance: factory profile form (P:1) and governance table (P:1) dominant per tab
  - [x] Spacing rhythm follows density specs throughout
  - [x] Responsive layouts preserve all actions on mobile
  - [x] Component nesting hierarchy matches Section 11
  - [x] Tab content columns (1.15fr/0.85fr and 1.1fr/0.9fr) are minimum required for density
  - [x] No redundant information surfaces
  - [x] Blueprint matches FULL-WIDTH COMMAND with internal tab-switched grid (Section 4.1)
```

---

## KIRO TASK CHAINING

```yaml
downstream_kiro_tasks:
  task_1:
    name: "Settings — SettingsShell Hero + Quick Nav Fix"
    input: This spec → Section 4.2 (Page Header, Quick-Nav Strip), Section 9.4, Section 12
    output: Backdrop-blur/rgba/shadow-2xl removed; eyebrow/h1 typography fixed;
      <details>/<summary> replaced with always-visible quick-nav strip

  task_2:
    name: "Settings — Summary Cards + Typography Governance"
    input: This spec → Section 4.2 (Summary Cards), Section 9.3
    output: Summary cards use canonical surface-card/border-subtle/rounded-panel;
      all CardTitle values at 16px/600; all eyebrows at --type-label-dense sentence case

  task_3:
    name: "Settings — Factory Tab Surface + Color Fix"
    input: This spec → Section 4.2 (Factory Profile Form, Factory Directory), Section 9.4, Section 12
    output: Module chip colors → semantic token classes; containers → surface-panel/surface-card;
      Active badge → status-success semantic; all legacy alias tokens eliminated from factory tab

  task_4:
    name: "Settings — Users Tab Label Fix"
    input: This spec → Section 4.2 (Action Cards, Mobile Cards), Section 9.3, Section 12
    output: Invite/access/role form field labels → sentence case --type-label;
      mobile card stat labels → sentence case --type-label-dense; no uppercase on field labels

  task_5:
    name: "Settings — isBusy Pattern on All Action Buttons"
    input: This spec → Section 11 (action_elements), Section 12
    output: All 6 action buttons use isBusy + busyLabel;
      status/error messages use semantic token classes

  task_6:
    name: "Settings — Responsive + Legacy Token Cleanup"
    input: This spec → Section 10, Section 13.1 (step_12, step_13, step_14)
    output: All remaining var(--legacy-alias) replaced; responsive layout verified;
      tab navigation sticky behavior confirmed
```

---

*End of WORKSPACE_SKELETON_SETTINGS.md (Sections 1–14)*
*This file is system-generated architecture. Treat as engineering law until formally amended.*
*Architectural precedent established: table column headers are the ONE governed exception
for uppercase text (tracking ≤0.06em only; tracking-wide = 0.025em is compliant);
mobile card labels vs. table column headers distinction documented and enforced;
SettingsShell component identified as requiring coordinated fix before tab-level work;
six isBusy button fixes consolidated into single task;
canManageFactoryAccess gates user governance panels (not just the API)*


---

# ADDENDUM: `/settings?tab=usage` — Usage & Billing Tab Specification

---

## U1. TAB OVERVIEW

| Field | Value |
|---|---|
| Route | `/settings?tab=usage` |
| Tab Name | Usage & Billing |
| Operational Role | Read-only display of current org AI/feature usage metrics (requests, credits, rate limit) and billing plan status (plan name, status, trial dates, period end, pending plan, active addons). No mutations occur on this tab. |
| Business Impact | Low — this is a read-only reference surface. Admins use it to verify their plan tier and remaining quota before making operational decisions about AI feature use. |
| User Population | admin, owner (`canViewBilling` gate for billing card; usage card visible to manager+) |
| Data Source | `GET /settings/usage` (UsageSummary) + `GET /billing/status` (BillingStatus) — both loaded on mount via `loadAll()` in SettingsPage |
| Operational Frequency | On-demand; low frequency; no realtime |

---

## U2. CURRENT STATE (Usage Tab)

The usage tab (`SettingsUsageTab`) is notably the **cleanest component in the settings workspace** — it largely uses canonical token classes. Violations are minimal:

- Both `CardTitle` components have no explicit size class — they inherit the default CardTitle styling which may or may not match `--type-panel-title` (16px/600); must verify and pin to 16px/600 explicitly
- `StatCard` label uses `text-label-dense font-medium text-text-tertiary` — `text-label-dense` may be a utility class not directly corresponding to the `--type-label-dense` token spec; must verify this maps to 11px/500
- `StatCard` value uses `font-mono text-xl font-semibold tabular-nums text-text-primary` — `text-xl` is 20px which exceeds the `--type-panel-title` 16px ceiling; but these are KPI values (numeric displays), NOT headings — the appropriate spec is `--type-numeric-md` (18px/600/tabular-nums/monospace); close but needs alignment to the correct token name
- Timestamps in billing cards (`trial_end_at`, `current_period_end_at`, `pending_plan_effective_at`) are rendered as raw strings without date formatting — should use `--type-timestamp` (JetBrains Mono/11px) and `formatDateTime()` consistent with the profile page pattern
- The `rounded-panel border border-border-subtle bg-surface-shell` pattern on StatCard uses `bg-surface-shell` — in the context of inside a `surface-card` section card, stat items should use `surface-elevated` (one level above card) not `surface-shell` (same as workspace background); this is a surface-level hierarchy violation

---

## U3. BACKEND API SURFACE

| Endpoint | Method | Purpose | Permission | Key Response Fields |
|---|---|---|---|---|
| `GET /settings/usage` | GET | Returns current AI/feature usage metrics for org | manager+ | `plan`, `requests_used`, `max_requests`, `credits_used`, `max_credits`, `rate_limit_per_minute`, `summary_used`, `smart_used`, `email_used` |
| `GET /billing/status` | GET | Returns billing plan, status, trial/period dates, active addons | admin/owner | `plan`, `status`, `trial_start_at`, `trial_end_at`, `current_period_end_at`, `pending_plan`, `pending_plan_effective_at`, `active_addons[]` |

---

## U4. STRUCTURAL ANATOMY (Usage Tab)

**Layout pattern:** `xl:grid-cols-[1fr_1fr]` — two equal-width cards side by side on desktop; stacked on mobile.

**Left card — Usage summary:**
- Section title: "Usage summary" — `--type-panel-title` (16px/600)
- 2-column stat grid: Requests used, Credits used, Request limit, Rate limit/min
- Each StatCard: `surface-elevated` bg + `border-subtle` + `rounded-control`
- StatCard label: `--type-label-dense` (11px/500/`text-text-tertiary`)
- StatCard value: `--type-numeric-md` (18px/600/tabular-nums/monospace) — NOT `text-xl font-mono`

**Right card — Billing status:**
- Section title: "Billing status" — `--type-panel-title` (16px/600)
- 2-column stat grid: Plan, Status (same StatCard pattern)
- 2-column date row: Trial ends, Period end — `--type-timestamp` (JetBrains Mono, 11px) formatted with `formatDateTime()`
- Pending plan notice (conditional): `surface-shell` + `border-subtle` + 14px/400
- Active addons (if present): list of addon items — addon name (14px/500) + price + status

**Permission gate:** The billing card renders data only if `canViewBilling=true` (admin/owner). Manager role sees the usage card only; billing card is hidden or shows a "not available" notice.

---

## U5. USAGE TAB ACCEPTANCE CRITERIA

- [ ] Both CardTitle at 16px/600 (`--type-panel-title`)
- [ ] StatCard background uses `surface-elevated` — NOT `surface-shell`
- [ ] StatCard values use `--type-numeric-md` (18px/600/tabular-nums) — NOT `text-xl`
- [ ] Date values in billing card use `--type-timestamp` (JetBrains Mono/11px) with `formatDateTime()` formatting
- [ ] Billing card hidden or shows access-restricted notice for manager role

---

## U6. IMPLEMENTATION NOTES (Usage Tab)

The usage tab needs only minor fixes — it is the most governance-compliant component in the settings workspace. Four targeted changes:

1. Pin both CardTitle to explicit `text-[16px] font-semibold`
2. Change StatCard bg from `bg-surface-shell` → `bg-surface-elevated`
3. Change StatCard value from `text-xl font-mono font-semibold tabular-nums` → `--type-numeric-md` class or `text-[18px] font-semibold font-mono tabular-nums`
4. Format date strings in billing card through `formatDateTime()` + `--type-timestamp` class

---
---

# ADDENDUM: `/settings?tab=alerts` — Alert Recipients & Activity Tab Specification

---

## A1. TAB OVERVIEW

| Field | Value |
|---|---|
| Route | `/settings?tab=alerts` |
| Tab Name | Alerts |
| Operational Role | Admin/owner management of WhatsApp alert recipients: add/edit/delete phone numbers, configure alert category subscriptions (critical/warning/security/reports), verify phone numbers via OTP, enable/disable delivery, and inspect per-recipient delivery history. Also surfaces recent org-wide alert activity feed with delivery status. |
| Business Impact | HIGH — if alert recipients are misconfigured or unverified, no factory alerts reach the admins during critical events (server failures, payment failures, OCR spikes, auth anomalies). A factory running blind on alerts during a production incident has no automated early warning. |
| User Population | admin, owner (`canManageAlerts` gate) |
| Data Sources | `GET /settings/alert-recipients`, `GET /observability/alerts`, `GET /observability/alerts/{ref_id}` |
| Operational Frequency | Low-frequency setup; but urgently important when adding a new admin phone or diagnosing a delivery failure |

---

## A2. CURRENT STATE FAILURES (Alerts Tab)

**ActionModal violations:**
- Modal backdrop uses `bg-[rgba(3,7,18,0.72)] backdrop-blur-sm` — raw rgba + forbidden backdrop-blur on overlays; overlays DO permit backdrop-blur per the Blueprint, so backdrop-blur IS allowed here; but the rgba background must be replaced with the `surface-overlay` token
- Modal container uses `rounded-[32px] border-[var(--border)] bg-[rgba(11,16,25,0.98)] shadow-2xl` — arbitrary radius (must be `rounded-panel`), legacy alias border, raw rgba background, arbitrary shadow; must use `surface-overlay + border-default + shadow-md`
- Modal header eyebrow uses `text-sm uppercase tracking-[0.18em] text-[var(--accent)]` — uppercase + tracking 3× maximum + raw alias; must be `--type-label-dense` sentence case `text-action-primary`
- Modal title uses `text-xl font-semibold text-white` — 20px above 16px ceiling + raw `text-white`; must be `--type-panel-title` (16px/600) + `text-text-primary`
- Modal close button uses `text-xs uppercase tracking-[0.18em]` — uppercase + tracking violation on button label
- Modal description uses `text-[var(--muted)]` — forbidden alias

**KPI summary cards (alerts tab top strip):**
- Cards use `bg-surface-panel border-border-subtle` — correct surface and border tokens ✓
- `CardTitle` uses implicit size — must be pinned to `--type-panel-title` (16px/600); currently renders with `font-mono` on the numeric value which is correct for a count display; the `CardTitle` rendering for the "Last alert sent" card uses `text-xl` which exceeds the ceiling
- Sub-labels ("Active recipients", "Remaining capacity", "Last alert sent") use `text-sm text-text-secondary font-medium` — `text-sm` is 14px which is too large for a card-header sub-label; should use `--type-label-dense` (11px/500/`text-text-tertiary`)
- CardContent uses `font-mono` throughout — JetBrains Mono for these operational counts is correct; but the content strings like `ACTIVE_SLOTS_TOTAL` use uppercase all-caps formatting which violates sentence case

**Recipient list cards:**
- Recipient cards use `rounded-[28px] border-[var(--border)] bg-[var(--card-strong)]` — arbitrary radius, legacy alias tokens; must use `surface-card border-subtle rounded-panel`
- Recipient phone number uses `text-lg font-semibold text-white` — 18px is actually `--type-numeric-md` scale, which is correct for a phone number display; but `text-white` is raw; must use `text-text-primary`
- Verification status badge uses `uppercase tracking-[0.16em]` — in the context of a STATUS BADGE, uppercase with tight tracking is permitted per the governance (badge text similar to table column header context); however tracking-[0.16em] exceeds the ≤0.06em limit even for badge contexts; must reduce tracking
- Active/Paused badge uses same uppercase tracking pattern — same tracking violation
- Inner stat cards ("Receives", "Verified at", "Safety rule") use `rounded-2xl border-[var(--border)]/80 bg-[rgba(8,14,24,0.6)]` — arbitrary radius, legacy alias, raw rgba; must use `surface-elevated border-subtle rounded-control`
- Inner stat labels ("Receives", "Verified at", "Safety rule") use `text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]` — uppercase + tracking 2.7× maximum + legacy alias; must be `--type-label-dense` sentence case `text-text-tertiary`
- Phone number (masked, inside stat card controls) uses `text-white` — must use `text-text-primary`
- Toggle button uses `border-emerald-400/40 bg-emerald-500/20` for active state — raw Tailwind colors; must use `status-success-bg border-success` semantic tokens
- Verification-pending warning uses `bg-amber-500/10 border-amber-400/20 text-amber-100` — raw colors; must use `status-warning-bg border-warning text-status-warning-fg`

**Alert Configuration Rules card:**
- CardTitle uses `text-xl` — above ceiling
- Rule content cards use `rounded-2xl border-[var(--border)] bg-[var(--card-strong)]` — legacy aliases
- Description text uses `text-[var(--muted)]` — forbidden alias

**Activity / Logs card:**
- CardTitle uses `text-xl` — above ceiling
- Description uses `text-[var(--muted)]` — legacy alias
- Activity log item buttons use selected state `border-sky-300/35 bg-[rgba(62,166,255,0.08)]` and hover `hover:bg-[rgba(62,166,255,0.05)]` — raw rgba; must use `surface-selected border-focus` for selected, `hover:surface-hover` for hover
- Unselected activity items use `border-[var(--border)] bg-[var(--card-strong)]` — legacy aliases
- Severity badges (CRITICAL/HIGH/MEDIUM/LOW) and delivery status badges all use raw rgba + raw color classes (emerald, amber, red, sky); must map to semantic tokens
- `text-[var(--muted)]` appears 12+ times in this section
- Alert detail expansion panel uses `bg-[rgba(8,12,20,0.84)]` — raw rgba
- Empty state uses `bg-[rgba(11,16,26,0.6)]` + raw `text-white` — raw rgba + raw color
- "No recent alert" / empty states use `text-white` and `text-[var(--muted)]` — raw colors and aliases

**Modal form (add/edit recipient):**
- Category card checkboxes use `rounded-[24px] border-[var(--border)] bg-[var(--card-strong)]` — arbitrary radius, legacy aliases; must use `surface-panel border-subtle rounded-panel`
- Category descriptions use `text-[var(--muted)]` — legacy alias
- Active delivery toggle label uses legacy alias tokens (same pattern from settings-attendance)
- Checkbox `accent-[var(--accent)]` — forbidden raw alias; must be `accent-action-primary`
- Modal save buttons don't use `isBusy` — currently `disabled={panelSubmitting}` with conditional label string; must add `isBusy` + `busyLabel`

**`verificationStatusTone()` and `deliveryTone()` and `severityTone()` helper functions:**
- ALL return raw Tailwind color strings (emerald, red, amber, sky, white/5) — these should be replaced with semantic token mappings

---

## A3. BACKEND API SURFACE (Alerts Tab)

| Endpoint | Method | Purpose | Permission | Key Response/Error |
|---|---|---|---|---|
| `GET /settings/alert-recipients` | GET | Lists all alert recipients for org with active_count, limit, plan | admin/owner | `AlertRecipientListPayload` |
| `POST /settings/alert-recipients` | POST | Creates new recipient (phone, event_types, severity_levels, daily_summary, is_active=false) | admin/owner | `AlertRecipient` · HTTP 400 (phone format) · HTTP 409 (duplicate) |
| `PATCH /settings/alert-recipients/{id}` | PATCH | Updates recipient settings; if phone changed, verification reset + is_active forced false | admin/owner | `AlertRecipient` |
| `DELETE /settings/alert-recipients/{id}` | DELETE | Removes recipient from alert delivery | admin/owner | void · HTTP 404 |
| `POST /settings/alert-recipients/{id}/start-verification` | POST | Initiates OTP verification for a recipient phone number; respects cooldown | admin/owner | `{masked_phone, expires_in}` · HTTP 429 (rate limited, retry_after) |
| `POST /settings/alert-recipients/{id}/confirm-verification` | POST | Validates submitted OTP; marks recipient as verified on success | admin/owner | `{verified, phone_e164}` · HTTP 400 (invalid_otp, otp_expired, max_attempts_reached, no_active_otp, sms_delivery_failed, rate_limited) |
| `GET /observability/alerts?limit=N` | GET | Returns recent alert activity items (last N alerts, org-wide) | admin/owner | `AlertActivityPayload` |
| `GET /observability/alerts/{ref_id}` | GET | Returns full delivery detail for a specific alert event | admin/owner | `AlertActivityDetail` |

**Critical backend constraints:**
- Verification: 6-digit OTP, time-limited (expires_in seconds from start); rate-limited per recipient with cooldown; max attempts per session
- Phone number: must be E.164 format; changing phone resets verification status and forces is_active=false
- Active delivery: requires verification_status === "verified"; cannot enable an unverified recipient
- Plan-based limit: `recipientPayload.limit` caps total active recipients; plan gates how many slots are available

---

## A4. STRUCTURAL ANATOMY (Alerts Tab)

**Layout:** `space-y-6` (stacked sections); inside the main settings grid.

**Top: KPI strip (3-column lg:grid-cols-3):**
- Active recipients count
- Remaining capacity count
- Last alert sent (delivery status + event type + timestamp)
- Card surface: `surface-panel border-subtle rounded-panel`
- Sub-labels: `--type-label-dense` (11px/500/`text-text-tertiary`)
- Values: `--type-numeric-md` for counts; `--type-body` (14px/600) for the last-alert status text

**Main area (xl:grid-cols-[1.2fr_0.8fr]):**

**Left — WhatsApp recipients card:**
- Section title: "WhatsApp recipients" — `--type-panel-title` (16px/600); sentence case (NOT `uppercase font-mono`)
- "Refresh" (ghost) + "Add number" (primary) — primary button should NOT use `bg-[var(--accent)]` raw alias; use `variant="primary"` system class
- Recipient item card: `surface-card border-subtle rounded-panel`
  - Masked phone: 14px/600/`text-text-primary` (NOT `text-lg text-white`)
  - Status badges: `StatusBadge` component or inline badge using semantic tokens + sentence case; tracking ≤0.06em
  - Inner stat cards: `surface-elevated border-subtle rounded-control`
  - Inner stat labels: `--type-label-dense` sentence case — NOT uppercase tracking
  - Toggle button: `surface-success-bg border-success` for active; `surface-elevated border-default` for inactive
  - Verify/Edit/Delete buttons: ghost/ghost/destructive variant respectively
  - Verification warning: `status-warning-bg border-warning text-status-warning-fg`
- Empty state: `surface-panel border-dashed border-default` + `--type-body` sentence case; NOT raw rgba/text-white

**Right column (stacked):**

**Alert Configuration Rules card:**
- Section title: "Alert configuration rules" — 16px/600 sentence case
- Rule description cards: `surface-elevated border-subtle rounded-control` + 13px/400/`text-text-secondary`

**Activity / Logs card:**
- Section title: "Activity / Logs" — 16px/600 sentence case
- Activity item buttons: selected → `surface-selected border-focus`; unselected → `surface-card border-subtle`; hover → `hover:bg-surface-hover`
- Severity badges: map to semantic tokens:
  - CRITICAL → `status-danger-bg border-danger text-status-danger-fg`
  - HIGH → `status-warning-bg border-warning text-status-warning-fg`
  - MEDIUM → `surface-panel border-default text-text-secondary`
  - LOW → `surface-elevated border-subtle text-text-tertiary`
- Delivery status badges: map to semantic tokens:
  - delivered/success → `status-success-bg border-success text-status-success-fg`
  - suppressed/dropped → `status-warning-bg border-warning text-status-warning-fg`
  - failed/partial_failure → `status-danger-bg border-danger text-status-danger-fg`
  - default → `surface-panel border-default text-text-secondary`
- Alert detail panel: `surface-panel border-default rounded-panel`
- Empty states: `surface-panel border-dashed` + sentence case text

**ActionModal (add/edit recipient):**
- Backdrop: `bg-surface-overlay backdrop-blur-sm` — backdrop-blur IS permitted on overlays
- Modal container: `surface-overlay border-default rounded-panel shadow-md`
- Modal header eyebrow: `--type-label-dense` sentence case `text-action-primary` — NOT uppercase tracking alias
- Modal title: 16px/600 `text-text-primary` — NOT `text-xl text-white`
- Category checkbox cards: `surface-panel border-subtle rounded-panel`; hover: `border-default`
- Category descriptions: `text-text-secondary` — NOT `text-[var(--muted)]`
- Active delivery toggle: system checkbox pattern (see settings-attendance)
- Modal error: `status-danger-bg border-danger text-status-danger-fg`
- Save button: add `isBusy` + `busyLabel="Saving..."` — NOT disabled+string only

**OTP Verification Modal:**
- Same surface treatment as ActionModal
- OTP input field: `type="number"`, `inputMode="numeric"`, `maxLength=6`
- Destination card: `surface-elevated border-subtle rounded-control`
- Error: `status-danger-bg border-danger text-status-danger-fg`
- Countdown timer text: `--type-timestamp` (JetBrains Mono/11px)
- Confirm Verification button: add `isBusy` + `busyLabel="Confirming..."`

---

## A5. ALERTS TAB ACCEPTANCE CRITERIA

- [ ] ActionModal container uses `surface-overlay border-default rounded-panel shadow-md` — NOT raw rgba + arbitrary radius
- [ ] ActionModal header eyebrow sentence case `--type-label-dense` — NOT uppercase tracking alias
- [ ] All CardTitle values at 16px/600 sentence case — NOT `text-xl uppercase font-mono`
- [ ] Recipient cards use `surface-card border-subtle rounded-panel` — NOT legacy aliases
- [ ] Inner stat labels use `--type-label-dense` sentence case — NOT uppercase tracking
- [ ] Status badges use semantic token classes + tracking ≤0.06em — NOT raw rgba + raw colors
- [ ] Toggle button active state uses `status-success-bg border-success` — NOT emerald raw classes
- [ ] Activity items selected state uses `surface-selected border-focus` — NOT raw rgba blue
- [ ] Severity and delivery status badge helpers replaced with semantic token mappings
- [ ] `text-[var(--muted)]` eliminated everywhere (12+ instances) — use `text-text-secondary/tertiary`
- [ ] `text-white` eliminated everywhere — use `text-text-primary`
- [ ] Category checkboxes use `accent-action-primary` — NOT `accent-[var(--accent)]`
- [ ] Modal save/confirm buttons use `isBusy` + `busyLabel` pattern
- [ ] Empty states use `surface-panel border-dashed` + sentence case — NOT raw rgba

---

## A6. SEVERITY & DELIVERY BADGE TOKEN MAP

```typescript
// Replace all three helper functions (verificationStatusTone, deliveryTone, severityTone)
// with this semantic mapping pattern:

function severityBadgeClass(severity: string): string {
  switch (severity.toUpperCase()) {
    case "CRITICAL":
      return "bg-status-danger-bg border-status-danger-border text-status-danger-fg";
    case "HIGH":
      return "bg-status-warning-bg border-status-warning-border text-status-warning-fg";
    case "MEDIUM":
      return "bg-surface-panel border-border-default text-text-secondary";
    default: // LOW
      return "bg-surface-elevated border-border-subtle text-text-tertiary";
  }
}

function deliveryBadgeClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "delivered" || normalized === "success")
    return "bg-status-success-bg border-status-success-border text-status-success-fg";
  if (normalized.startsWith("suppressed") || normalized.startsWith("dropped"))
    return "bg-status-warning-bg border-status-warning-border text-status-warning-fg";
  if (normalized === "failed" || normalized === "partial_failure")
    return "bg-status-danger-bg border-status-danger-border text-status-danger-fg";
  return "bg-surface-panel border-border-default text-text-secondary";
}

function verificationBadgeClass(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "verified")
    return "bg-status-success-bg border-status-success-border text-status-success-fg";
  if (normalized === "failed")
    return "bg-status-danger-bg border-status-danger-border text-status-danger-fg";
  return "bg-status-warning-bg border-status-warning-border text-status-warning-fg";
}
```

---

## A7. IMPLEMENTATION SEQUENCE (Alerts Tab)

```yaml
alerts_implementation_sequence:
  step_1: Fix ActionModal container — surface-overlay + border-default + rounded-panel;
    fix header eyebrow sentence case; fix title to 16px/600; remove text-white
  step_2: Fix all CardTitle from text-xl/uppercase to 16px/600 sentence case;
    fix sub-labels to --type-label-dense sentence case text-text-tertiary
  step_3: Replace verificationStatusTone/deliveryTone/severityTone functions with
    semantic token mapping functions (Section A6)
  step_4: Fix recipient cards — surface-card/border-subtle/rounded-panel;
    inner stat cards — surface-elevated/border-subtle/rounded-control;
    inner stat labels — --type-label-dense sentence case
  step_5: Fix toggle button colors — active → status-success-bg/border; inactive → surface-elevated
  step_6: Fix activity log items — selected → surface-selected/border-focus;
    unselected → surface-card/border-subtle; hover → hover:bg-surface-hover
  step_7: Fix all text-white → text-text-primary; text-[var(--muted)] → text-text-secondary/tertiary
  step_8: Fix category checkbox cards in modal — surface-panel/border-subtle/rounded-panel
  step_9: Fix checkbox accent-[var(--accent)] → accent-action-primary
  step_10: Add isBusy + busyLabel to modal save button and OTP confirm button
  step_11: Fix empty state panels — surface-panel/border-dashed + sentence case text
  step_12: Fix all remaining raw rgba + legacy alias token references throughout
```

---

## A8. OPEN QUESTIONS (Alerts Tab)

```yaml
open_questions:
  - question: >
      The `Add number` button currently uses `bg-[var(--accent)] hover:bg-[var(--accent-hover)]`
      which are raw alias references. Using `variant="primary"` on the Button primitive should
      replace this correctly. Confirm that `variant="primary"` maps to the intended
      action-primary color in the current Button implementation.
    blocking: no — using variant="primary" is the correct fix; verify in Button component
    owner: frontend team

  - question: >
      The recipient card's phone number toggle switch is a custom `<button>` element with a
      white `<span>` indicator. Does a system `Toggle` or `Switch` primitive exist that should
      be used instead? Using a system primitive would ensure consistent focus management and
      aria-checked semantics.
    blocking: no — current custom toggle is functional; system Switch would improve consistency
    owner: frontend team
```



#### CODE 
FACTORY TAB FROM SETTING 

```
<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Factory Administration</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&amp;family=JetBrains+Mono:wght@400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<style>
  /* Industrial Grid Background & Ambient Light */
  .industrial-grid {
    background-image: 
      linear-gradient(to right, rgba(60, 73, 78, 0.15) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(60, 73, 78, 0.15) 1px, transparent 1px);
    background-size: 32px 32px;
  }
  .radial-glow {
    background: radial-gradient(circle at 50% 0%, rgba(76, 214, 255, 0.05) 0%, transparent 60%);
  }
  
  /* Material Icons Configuration */
  .material-symbols-outlined {
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  }
  .icon-fill {
    font-variation-settings: 'FILL' 1;
  }
</style>
<script id="tailwind-config">
  tailwind.config = {
    darkMode: "class",
    theme: {
      extend: {
        "colors": {
          "primary-fixed-dim": "#4cd6ff", "primary-container": "#00d1ff", "on-tertiary-fixed": "#291800",
          "on-tertiary": "#442b00", "on-secondary-fixed": "#0b1c30", "secondary-container": "#3a4a5f",
          "surface-dim": "#0b1326", "on-error-container": "#ffdad6", "primary-fixed": "#b7eaff",
          "primary": "#a4e6ff", "inverse-surface": "#dae2fd", "tertiary": "#ffd59c",
          "on-tertiary-fixed-variant": "#624000", "surface-bright": "#31394d", "on-primary-fixed": "#001f28",
          "inverse-on-surface": "#283044", "surface": "#0b1326", "outline": "#859399",
          "surface-container": "#171f33", "on-background": "#dae2fd", "inverse-primary": "#00677f",
          "on-secondary": "#213145", "surface-tint": "#4cd6ff", "error": "#ffb4ab",
          "on-primary-container": "#00566a", "on-secondary-container": "#a9bad3", "tertiary-container": "#feb127",
          "on-surface": "#dae2fd", "tertiary-fixed": "#ffddb1", "on-secondary-fixed-variant": "#38485d",
          "secondary-fixed": "#d3e4fe", "on-tertiary-container": "#6b4700", "surface-container-highest": "#2d3449",
          "secondary": "#b7c8e1", "background": "#0b1326", "outline-variant": "#3c494e",
          "on-surface-variant": "#bbc9cf", "tertiary-fixed-dim": "#ffba49", "surface-container-lowest": "#060e20",
          "on-primary-fixed-variant": "#004e60", "on-error": "#690005", "surface-variant": "#2d3449",
          "surface-container-high": "#222a3d", "on-primary": "#003543", "surface-container-low": "#131b2e",
          "secondary-fixed-dim": "#b7c8e1", "error-container": "#93000a"
        },
        "borderRadius": { "DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem", "panel": "0.5rem" },
        "spacing": { "md": "16px", "base": "4px", "xs": "4px", "sm": "8px", "gutter": "16px", "xl": "32px", "lg": "24px", "margin": "24px" },
        "fontFamily": {
          "metadata": ["JetBrains Mono"], "panel-title": ["Hanken Grotesk"], "button": ["Hanken Grotesk"],
          "label": ["JetBrains Mono"], "page-title": ["Hanken Grotesk"], "body": ["Hanken Grotesk"]
        },
        "fontSize": {
          "metadata": ["11px", {"lineHeight": "14px", "letterSpacing": "0.04em", "fontWeight": "400"}],
          "panel-title": ["16px", {"lineHeight": "20px", "letterSpacing": "0em", "fontWeight": "600"}],
          "button": ["14px", {"lineHeight": "14px", "letterSpacing": "0.02em", "fontWeight": "500"}],
          "label": ["12px", {"lineHeight": "16px", "letterSpacing": "0.02em", "fontWeight": "500"}],
          "page-title": ["18px", {"lineHeight": "24px", "letterSpacing": "0em", "fontWeight": "600"}],
          "body": ["14px", {"lineHeight": "20px", "letterSpacing": "0em", "fontWeight": "400"}]
        }
      }
    }
  }
</script>
</head>
<body class="bg-surface text-on-surface font-body overflow-x-hidden min-h-screen relative industrial-grid">
<!-- Ambient Core Light -->
<div class="absolute inset-0 radial-glow pointer-events-none z-0"></div>
<!-- TopNavBar Shared Component -->
<nav class="bg-surface border-b border-outline-variant flex justify-between items-center px-gutter w-full fixed top-0 z-50 h-[56px]">
<div class="flex items-center gap-6">
<div class="font-page-title text-page-title text-primary font-bold tracking-tight">Industrial OS</div>
<div class="hidden md:flex gap-4">
<a class="text-on-surface-variant font-medium hover:text-primary-container transition-colors text-body font-body" href="#">Systems</a>
<a class="text-on-surface-variant font-medium hover:text-primary-container transition-colors text-body font-body" href="#">Assets</a>
<a class="text-primary font-bold border-b-2 border-primary pb-1 text-body font-body opacity-80 transition-all" href="#">Security</a>
</div>
</div>
<div class="flex items-center gap-4">
<span class="material-symbols-outlined text-on-surface-variant hover:text-primary-container cursor-pointer transition-colors" data-icon="notifications">notifications</span>
<span class="material-symbols-outlined text-on-surface-variant hover:text-primary-container cursor-pointer transition-colors" data-icon="settings">settings</span>
<span class="material-symbols-outlined text-on-surface-variant hover:text-primary-container cursor-pointer transition-colors" data-icon="help">help</span>
<img alt="Operator Profile Avatar" class="w-8 h-8 rounded-full border border-outline-variant" data-alt="A macro portrait photograph of a stern industrial operator in a high-tech facility. Sharp contrast, low key lighting, with a subtle cyan rim light hitting the left side of the face. Clean, professional composition reflecting a stable, secure engineering aesthetic." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCK0qphU4Pb79QuWDTP5Nvu8QGdIclvFQGLsP6u_8g4rNfL8ykqyvBnj5SNgHQqkCJ9R5h5gTdDN9ef_CpdIW9hs4EwMlHHTVYEQng8yIL6K89XvcM_u0SbbkqhAVOSkBJbNDxewpSqlwtiRvBxv5lhbFmGrGesz2Ir5ZRT4hfzjZuKUPqssC4ROHuiJo9xi0LoZx6TAR9Krj-4B4jq8h5M_TZYqlwwcnI3_WA3z_eW6ha1aMbVV2xZSqndAh_95gSuBhLtlbTSPkA"/>
</div>
</nav>
<!-- SideNavBar Shared Component -->
<aside class="bg-surface-container-low border-r border-outline-variant flex flex-col h-screen fixed left-0 top-[56px] py-md z-40 w-64 hidden md:flex">
<div class="px-6 pb-6 border-b border-outline-variant/50">
<div class="flex items-center gap-3">
<div class="w-8 h-8 rounded-md bg-secondary-container flex items-center justify-center border border-outline-variant">
<span class="material-symbols-outlined text-on-secondary-container text-[18px]">dns</span>
</div>
<div>
<h2 class="font-panel-title text-panel-title text-on-surface">Core Engine</h2>
<p class="font-metadata text-metadata text-on-surface-variant">v4.2.0-stable</p>
</div>
</div>
<button class="w-full mt-4 bg-primary text-on-primary font-button text-button h-[42px] rounded-lg hover:opacity-90 transition-opacity">Deploy Update</button>
</div>
<div class="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
<a class="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-colors font-label text-label" href="#">
<span class="material-symbols-outlined text-[20px]" data-icon="grid_view">grid_view</span> Dashboard
      </a>
<a class="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-colors font-label text-label" href="#">
<span class="material-symbols-outlined text-[20px]" data-icon="settings_input_component">settings_input_component</span> Node Control
      </a>
<a class="flex items-center gap-3 px-3 py-2 bg-secondary-container text-on-secondary-container rounded-lg font-label text-label scale-[0.98] transition-transform" href="#">
<span class="material-symbols-outlined icon-fill text-[20px]" data-icon="lan">lan</span> Network
      </a>
<a class="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-colors font-label text-label" href="#">
<span class="material-symbols-outlined text-[20px]" data-icon="database">database</span> Storage
      </a>
<a class="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-colors font-label text-label" href="#">
<span class="material-symbols-outlined text-[20px]" data-icon="terminal">terminal</span> Logs
      </a>
</div>
<div class="p-3 border-t border-outline-variant/50 flex flex-col gap-1">
<a class="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-colors font-label text-label" href="#">
<span class="material-symbols-outlined text-[20px]" data-icon="contact_support">contact_support</span> Support
      </a>
<a class="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-lg transition-colors font-label text-label" href="#">
<span class="material-symbols-outlined text-[20px]" data-icon="logout">logout</span> Exit
      </a>
</div>
</aside>
<!-- Main Workspace -->
<main class="md:pl-[256px] pt-[56px] min-h-screen relative z-10 w-full flex justify-center">
<div class="w-full max-w-[1280px] px-6 md:px-10 py-6 flex flex-col gap-lg">
<!-- PAGE HEADER ZONE -->
<section class="bg-surface-container-low border border-outline-variant rounded-xl p-5 flex flex-col gap-2">
<div class="font-label text-[11px] leading-tight font-medium text-primary">Settings</div>
<h1 class="font-page-title text-page-title text-on-surface">Keep factory setup and team control in one admin lane</h1>
<p class="font-body text-[14px] text-on-surface-variant max-w-2xl">Manage foundational organization settings, deploy factory identities, and coordinate cross-factory user access from a centralized operational surface.</p>
</section>
<!-- QUICK-NAV STRIP -->
<section class="bg-surface-container-low border border-outline-variant rounded-xl p-2 flex gap-2 overflow-x-auto">
<a class="px-4 py-2 text-on-surface-variant border border-transparent hover:border-outline-variant hover:bg-surface-container rounded-lg font-button text-button transition-all whitespace-nowrap" href="#">Board</a>
<a class="px-4 py-2 text-on-surface-variant border border-outline-variant bg-surface-container hover:bg-surface-container-high rounded-lg font-button text-button transition-all whitespace-nowrap" href="#">Reports</a>
<a class="px-4 py-2 text-on-surface-variant border border-transparent hover:border-outline-variant hover:bg-surface-container rounded-lg font-button text-button transition-all whitespace-nowrap" href="#">Plans</a>
<a class="px-4 py-2 text-on-surface-variant border border-transparent hover:border-outline-variant hover:bg-surface-container rounded-lg font-button text-button transition-all whitespace-nowrap" href="#">Billing</a>
</section>
<!-- SUMMARY CARDS STRIP -->
<section class="grid grid-cols-1 md:grid-cols-3 gap-3">
<div class="bg-surface border border-outline-variant rounded-xl p-5 flex flex-col gap-1 shadow-sm">
<div class="font-label text-[11px] text-on-surface-variant font-medium">Current factory</div>
<div class="font-panel-title text-[18px] text-on-surface tracking-tight mt-1">Omega Fabrication Node</div>
<div class="font-label text-[11px] text-on-surface-variant/80 mt-2">Active Workflow: Deep-Tech Assembly</div>
</div>
<div class="bg-surface border border-outline-variant rounded-xl p-5 flex flex-col gap-1 shadow-sm">
<div class="font-label text-[11px] text-on-surface-variant font-medium">Factory network</div>
<div class="font-metadata text-[18px] text-on-surface font-semibold tabular-nums mt-1">12</div>
<div class="font-label text-[11px] text-on-surface-variant/80 mt-2">Enterprise Plan Active</div>
</div>
<div class="bg-surface border border-outline-variant rounded-xl p-5 flex flex-col gap-1 shadow-sm">
<div class="font-label text-[11px] text-on-surface-variant font-medium">Active users</div>
<div class="font-metadata text-[18px] text-on-surface font-semibold tabular-nums mt-1">2,408</div>
<div class="font-label text-[11px] text-on-surface-variant/80 mt-2">Cross-factory org assignments</div>
</div>
</section>
<!-- TAB NAVIGATION -->
<nav class="border-b border-outline-variant flex gap-6 overflow-x-auto sticky top-[56px] bg-surface/90 backdrop-blur-sm z-20 pt-2">
<button class="pb-3 text-primary font-label text-[13px] font-medium border-b-2 border-primary whitespace-nowrap">Factory</button>
<button class="pb-3 text-on-surface-variant hover:text-on-surface font-label text-[13px] font-medium border-b-2 border-transparent transition-colors whitespace-nowrap">Users</button>
<button class="pb-3 text-on-surface-variant hover:text-on-surface font-label text-[13px] font-medium border-b-2 border-transparent transition-colors whitespace-nowrap">Usage</button>
</nav>
<!-- TAB CONTENT ZONE: FACTORY (2 Column Layout) -->
<section class="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6 items-start">
<!-- LEFT COLUMN: Factory Profile Form -->
<div class="bg-surface border border-outline-variant rounded-xl p-5 flex flex-col gap-6">
<h2 class="font-panel-title text-panel-title text-on-surface">Factory profile</h2>
<div class="grid grid-cols-1 md:grid-cols-2 gap-md">
<div class="flex flex-col gap-2">
<label class="font-label text-label text-on-surface-variant">Factory name</label>
<input class="bg-surface-container-lowest border border-outline-variant rounded-md px-3 h-[40px] text-body font-body text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" type="text" value="Omega Fabrication Node"/>
</div>
<div class="flex flex-col gap-2">
<label class="font-label text-label text-on-surface-variant">Industry profile</label>
<select class="bg-surface-container-lowest border border-outline-variant rounded-md px-3 h-[40px] text-body font-body text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none">
<option>Advanced Manufacturing</option>
<option>Chemical Processing</option>
<option>Aerospace Assembly</option>
</select>
</div>
<div class="flex flex-col gap-2 md:col-span-2">
<label class="font-label text-label text-on-surface-variant">Workflow template</label>
<select class="bg-surface-container-lowest border border-outline-variant rounded-md px-3 h-[40px] text-body font-body text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none">
<option>Deep-Tech Assembly Standard (v2)</option>
</select>
<p class="font-label text-[12px] text-on-surface-variant/70 mt-1">Changes to workflow template alter the baseline metric models for operators.</p>
</div>
<div class="flex flex-col gap-2 md:col-span-2">
<label class="font-label text-label text-on-surface-variant">Address</label>
<input class="bg-surface-container-lowest border border-outline-variant rounded-md px-3 h-[40px] text-body font-body text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" type="text" value="Sector 7G, Industrial Park Alpha, NA"/>
</div>
</div>
<!-- Starter Modules Container -->
<div class="bg-surface-container-low border border-outline rounded-lg p-4 flex flex-col gap-3">
<h3 class="font-label text-label text-on-surface-variant">Active starter modules</h3>
<div class="flex flex-wrap gap-2">
<span class="px-3 py-1 bg-surface-container-highest text-primary font-label text-[12px] rounded-md border border-outline-variant/50">DPR / Traceability</span>
<span class="px-3 py-1 bg-surface-container-highest text-[#66bb6a] font-label text-[12px] rounded-md border border-outline-variant/50">Quality / Certificates</span>
<span class="px-3 py-1 bg-surface-container-highest text-[#ffa726] font-label text-[12px] rounded-md border border-outline-variant/50">Scrap / Downtime</span>
<span class="px-3 py-1 bg-surface-container-highest text-on-surface-variant font-label text-[12px] rounded-md border border-outline-variant/50">Labor Analytics</span>
</div>
</div>
<!-- Production Targets -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-md border-t border-outline-variant pt-6">
<div class="flex flex-col gap-2">
<label class="font-label text-label text-on-surface-variant">Morning target</label>
<input class="bg-surface-container-lowest border border-outline-variant rounded-md px-3 h-[40px] text-body font-body text-on-surface focus:border-primary outline-none font-metadata tabular-nums" type="number" value="1200"/>
</div>
<div class="flex flex-col gap-2">
<label class="font-label text-label text-on-surface-variant">Evening target</label>
<input class="bg-surface-container-lowest border border-outline-variant rounded-md px-3 h-[40px] text-body font-body text-on-surface focus:border-primary outline-none font-metadata tabular-nums" type="number" value="1150"/>
</div>
<div class="flex flex-col gap-2">
<label class="font-label text-label text-on-surface-variant">Night target</label>
<input class="bg-surface-container-lowest border border-outline-variant rounded-md px-3 h-[40px] text-body font-body text-on-surface focus:border-primary outline-none font-metadata tabular-nums" type="number" value="980"/>
</div>
</div>
<div class="flex justify-end pt-4">
<button class="bg-primary text-on-primary font-button text-button h-[42px] px-6 rounded-lg flex items-center justify-center gap-2 hover:bg-primary-fixed transition-colors">
<span class="material-symbols-outlined text-[18px]">save</span> Save profile
            </button>
</div>
</div>
<!-- RIGHT COLUMN: Create Factory & Control Tower -->
<div class="flex flex-col gap-6">
<!-- Create Factory Card -->
<div class="bg-surface border border-outline-variant rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden">
<!-- Subtle diagonal accent -->
<div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent pointer-events-none rounded-tr-xl"></div>
<h2 class="font-panel-title text-panel-title text-on-surface">Create factory</h2>
<div class="flex flex-col gap-3">
<div class="flex flex-col gap-2">
<label class="font-label text-label text-on-surface-variant">Factory name</label>
<input class="bg-surface-container-lowest border border-outline-variant rounded-md px-3 h-[40px] text-body font-body text-on-surface focus:border-primary outline-none" placeholder="New designated node..." type="text"/>
</div>
<div class="flex flex-col gap-2">
<label class="font-label text-label text-on-surface-variant">Location</label>
<input class="bg-surface-container-lowest border border-outline-variant rounded-md px-3 h-[40px] text-body font-body text-on-surface focus:border-primary outline-none" placeholder="Geographic zone..." type="text"/>
</div>
</div>
<button class="bg-surface-container-low border border-outline-variant text-on-surface font-button text-button h-[42px] px-6 rounded-lg flex items-center justify-center gap-2 hover:bg-surface-container-high transition-colors mt-2">
<span class="material-symbols-outlined text-[18px]">add</span> Create factory
            </button>
</div>
<!-- Control Tower Snapshot -->
<div class="bg-surface border border-outline-variant rounded-xl p-5 flex flex-col gap-4">
<h2 class="font-panel-title text-panel-title text-on-surface">Control tower snapshot</h2>
<p class="font-body text-[13px] text-on-surface-variant">Organizational deployment overview.</p>
<div class="flex flex-col gap-3 mt-2">
<!-- Factory Directory Item 1 -->
<div class="bg-surface border border-outline-variant rounded-lg p-4 flex flex-col gap-2 hover:border-primary/50 transition-colors group cursor-pointer">
<div class="flex justify-between items-start">
<div class="font-label text-[13px] text-on-surface font-medium group-hover:text-primary transition-colors">Omega Fabrication Node</div>
<div class="bg-[#1b3d2b] border border-[#2e7d32] text-[#66bb6a] px-2 py-0.5 rounded-sm font-metadata text-[10px] uppercase tracking-wide">Active</div>
</div>
<div class="font-metadata text-[11px] text-on-surface-variant flex gap-3">
<span>Adv. Mfg</span>
<span class="text-outline-variant">•</span>
<span>1.2k Members</span>
<span class="text-outline-variant">•</span>
<span>Owner role</span>
</div>
</div>
<!-- Factory Directory Item 2 -->
<div class="bg-surface border border-outline-variant rounded-lg p-4 flex flex-col gap-2 hover:border-primary/50 transition-colors group cursor-pointer opacity-80">
<div class="flex justify-between items-start">
<div class="font-label text-[13px] text-on-surface font-medium group-hover:text-primary transition-colors">Delta Assembly Core</div>
<div class="bg-surface-container border border-outline-variant text-on-surface-variant px-2 py-0.5 rounded-sm font-metadata text-[10px] uppercase tracking-wide">Standby</div>
</div>
<div class="font-metadata text-[11px] text-on-surface-variant flex gap-3">
<span>Chemical Proc.</span>
<span class="text-outline-variant">•</span>
<span>450 Members</span>
<span class="text-outline-variant">•</span>
<span>Admin role</span>
</div>
</div>
</div>
</div>
</div>
</section>
</div>
</main>
</body></html>
```

---

### FACOTORY TAB USER_GOVERNANCE

```
<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Team Governance Workspace - Industrial OS</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
  tailwind.config = {
    darkMode: "class",
    theme: {
      extend: {
        "colors": {
                "primary": "#a4e6ff",
                "on-primary-container": "#00566a",
                "inverse-on-surface": "#283044",
                "outline-variant": "#3c494e",
                "surface-container-low": "#131b2e",
                "primary-fixed": "#b7eaff",
                "surface-variant": "#2d3449",
                "surface-container-lowest": "#060e20",
                "on-surface-variant": "#bbc9cf",
                "secondary-fixed-dim": "#b7c8e1",
                "surface-dim": "#0b1326",
                "surface-container-high": "#222a3d",
                "inverse-primary": "#00677f",
                "surface-bright": "#31394d",
                "on-secondary-fixed-variant": "#38485d",
                "tertiary": "#ffd59c",
                "surface-tint": "#4cd6ff",
                "error": "#ffb4ab",
                "tertiary-fixed-dim": "#ffba49",
                "error-container": "#93000a",
                "on-tertiary": "#442b00",
                "primary-fixed-dim": "#4cd6ff",
                "on-error-container": "#ffdad6",
                "on-tertiary-container": "#6b4700",
                "on-secondary": "#213145",
                "secondary-fixed": "#d3e4fe",
                "on-background": "#dae2fd",
                "on-surface": "#dae2fd",
                "on-primary-fixed-variant": "#004e60",
                "tertiary-fixed": "#ffddb1",
                "secondary-container": "#3a4a5f",
                "on-primary": "#003543",
                "primary-container": "#00d1ff",
                "on-error": "#690005",
                "secondary": "#b7c8e1",
                "outline": "#859399",
                "on-primary-fixed": "#001f28",
                "background": "#0b1326",
                "tertiary-container": "#feb127",
                "surface-container-highest": "#2d3449",
                "on-tertiary-fixed-variant": "#624000",
                "surface-container": "#171f33",
                "inverse-surface": "#dae2fd",
                "on-secondary-fixed": "#0b1c30",
                "surface": "#0b1326",
                "on-tertiary-fixed": "#291800",
                "on-secondary-container": "#a9bad3"
        },
        "borderRadius": {
                "DEFAULT": "0.125rem",
                "lg": "0.25rem",
                "xl": "0.5rem",
                "full": "0.75rem"
        },
        "spacing": {
                "gutter": "16px",
                "xs": "4px",
                "md": "16px",
                "lg": "24px",
                "margin": "24px",
                "base": "4px",
                "xl": "32px",
                "sm": "8px"
        },
        "fontFamily": {
                "metadata": [
                        "JetBrains Mono"
                ],
                "body": [
                        "Hanken Grotesk"
                ],
                "label": [
                        "JetBrains Mono"
                ],
                "button": [
                        "Hanken Grotesk"
                ],
                "panel-title": [
                        "Hanken Grotesk"
                ],
                "page-title": [
                        "Hanken Grotesk"
                ]
        },
        "fontSize": {
                "metadata": [
                        "11px",
                        {
                                "lineHeight": "14px",
                                "letterSpacing": "0.04em",
                                "fontWeight": "400"
                        }
                ],
                "body": [
                        "14px",
                        {
                                "lineHeight": "20px",
                                "letterSpacing": "0em",
                                "fontWeight": "400"
                        }
                ],
                "label": [
                        "12px",
                        {
                                "lineHeight": "16px",
                                "letterSpacing": "0.02em",
                                "fontWeight": "500"
                        }
                ],
                "button": [
                        "14px",
                        {
                                "lineHeight": "14px",
                                "letterSpacing": "0.02em",
                                "fontWeight": "500"
                        }
                ],
                "panel-title": [
                        "16px",
                        {
                                "lineHeight": "20px",
                                "letterSpacing": "0em",
                                "fontWeight": "600"
                        }
                ],
                "page-title": [
                        "18px",
                        {
                                "lineHeight": "24px",
                                "letterSpacing": "0em",
                                "fontWeight": "600"
                        }
                ]
        }
},
    },
  }
</script>
<style>
        body { background-color: theme('colors.background'); color: theme('colors.on-surface'); }
        
        /* Custom scrollbar for table */
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: theme('colors.surface-variant'); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: theme('colors.outline'); }
    </style>
</head>
<body class="font-body text-body antialiased min-h-screen flex flex-col pt-[56px] pl-[0px] md:pl-[256px]">
<!-- TopNavBar -->
<nav class="bg-surface border-b border-outline-variant flex justify-between items-center px-gutter w-full fixed top-0 z-50 h-[56px]">
<div class="flex items-center gap-md">
<span class="font-page-title text-page-title text-primary font-bold tracking-tight">Industrial OS</span>
<div class="hidden md:flex gap-lg ml-xl h-full items-center">
<a class="text-on-surface-variant font-medium hover:text-primary transition-colors h-full flex items-center" href="#">Systems</a>
<a class="text-on-surface-variant font-medium hover:text-primary transition-colors h-full flex items-center" href="#">Assets</a>
<a class="text-on-surface-variant font-medium hover:text-primary transition-colors h-full flex items-center" href="#">Security</a>
<a class="text-primary font-bold border-b-2 border-primary h-full flex items-center mt-[2px]" href="#">Settings</a>
</div>
</div>
<div class="flex items-center gap-sm">
<button class="p-xs text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center rounded-full hover:bg-surface-variant">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">notifications</span>
</button>
<button class="p-xs text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center rounded-full hover:bg-surface-variant">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">settings</span>
</button>
<button class="p-xs text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center rounded-full hover:bg-surface-variant">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">help</span>
</button>
<div class="w-8 h-8 rounded-full bg-secondary-container overflow-hidden ml-sm border border-outline-variant">
<img alt="Operator Profile Avatar" class="w-full h-full object-cover" data-alt="A close up, well-lit professional headshot of an industrial system operator in a modern control room context. Cool lighting, professional attire, dark mode UI aesthetic matching the surrounding corporate design. High quality, clear features." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCkZ8n4qwxRJN4cWzCp_4fKaeT9C35a0_e69Gh8yvi40qL_tVznjIAKrnLNJoYoexU1NRH17J34UhY_MIPfDPmI-KMy1DWX02xMH-nwdwIGu1FsMJoz-3u24c2XffjrF926p0O_EzXf1efaKOrpC_A7BMyTcZwm9lHGq4U1DsQZnV9OcjItYax8e7lKumJuxOiK7b3C1oPl07lNWPez665a61iTHjGQ0YbVRauBHEQl7C9MNwgHyJI82wKcpwc59Pkgq-DSV2xwBng"/>
</div>
</div>
</nav>
<!-- SideNavBar -->
<aside class="bg-surface-container-low border-r border-outline-variant hidden md:flex flex-col h-screen fixed left-0 top-[56px] py-md z-40 w-64">
<div class="px-gutter mb-lg flex items-center gap-sm">
<div class="w-8 h-8 rounded-md bg-surface-variant flex items-center justify-center text-primary border border-outline-variant">
<span class="material-symbols-outlined text-lg" style="font-variation-settings: 'FILL' 1;">memory</span>
</div>
<div>
<h2 class="font-panel-title text-panel-title text-on-surface">Core Engine</h2>
<div class="font-metadata text-metadata text-on-surface-variant">v4.2.0-stable</div>
</div>
</div>
<nav class="flex-1 px-sm space-y-1">
<a class="flex items-center gap-sm px-3 py-2 text-on-surface-variant hover:bg-surface-container-highest transition-colors rounded-lg font-label text-label" href="#">
<span class="material-symbols-outlined text-lg">grid_view</span>
                Dashboard
            </a>
<a class="flex items-center gap-sm px-3 py-2 text-on-surface-variant hover:bg-surface-container-highest transition-colors rounded-lg font-label text-label" href="#">
<span class="material-symbols-outlined text-lg">settings_input_component</span>
                Node Control
            </a>
<a class="flex items-center gap-sm px-3 py-2 text-on-surface-variant hover:bg-surface-container-highest transition-colors rounded-lg font-label text-label" href="#">
<span class="material-symbols-outlined text-lg">lan</span>
                Network
            </a>
<a class="flex items-center gap-sm px-3 py-2 text-on-surface-variant hover:bg-surface-container-highest transition-colors rounded-lg font-label text-label" href="#">
<span class="material-symbols-outlined text-lg">database</span>
                Storage
            </a>
<a class="flex items-center gap-sm px-3 py-2 text-on-surface-variant hover:bg-surface-container-highest transition-colors rounded-lg font-label text-label" href="#">
<span class="material-symbols-outlined text-lg">terminal</span>
                Logs
            </a>
<div class="pt-4 pb-2 px-3">
<div class="h-px bg-outline-variant w-full"></div>
</div>
<a class="flex items-center gap-sm px-3 py-2 bg-secondary-container text-on-secondary-container rounded-lg transition-transform scale-[0.98] font-label text-label" href="#">
<span class="material-symbols-outlined text-lg">admin_panel_settings</span>
                Settings
            </a>
</nav>
<div class="px-gutter mt-auto pt-lg border-t border-outline-variant">
<button class="w-full bg-primary text-on-primary font-button text-button py-2 rounded flex items-center justify-center gap-sm hover:opacity-90 transition-opacity">
<span class="material-symbols-outlined text-sm">cloud_upload</span>
                Deploy Update
            </button>
<div class="flex gap-2 mt-sm">
<button class="flex-1 flex items-center justify-center gap-1 py-1.5 text-on-surface-variant hover:text-on-surface transition-colors font-metadata text-metadata rounded hover:bg-surface-variant">
<span class="material-symbols-outlined text-sm">contact_support</span>
                    Support
                </button>
<button class="flex-1 flex items-center justify-center gap-1 py-1.5 text-on-surface-variant hover:text-on-surface transition-colors font-metadata text-metadata rounded hover:bg-surface-variant">
<span class="material-symbols-outlined text-sm">logout</span>
                    Exit
                </button>
</div>
</div>
</aside>
<!-- Main Content Area -->
<main class="flex-1 p-gutter md:p-lg max-w-[1280px] mx-auto w-full flex flex-col gap-lg">
<!-- Page Header Zone -->
<header class="bg-surface-container rounded-lg border border-outline-variant p-lg flex flex-col md:flex-row md:items-end justify-between gap-md relative overflow-hidden">
<!-- Subtle background accent -->
<div class="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
<div class="relative z-10">
<div class="font-label text-label text-primary flex items-center gap-2 mb-sm">
<span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                    Settings
                </div>
<h1 class="font-page-title text-page-title text-on-surface mb-xs">Keep factory setup and team control in one admin lane</h1>
<p class="font-body text-body text-on-surface-variant">Factory Administration — Configuration &amp; Team Governance</p>
</div>
<!-- Quick-Navigation Strip -->
<div class="flex flex-wrap gap-sm relative z-10">
<a class="px-3 py-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-all font-button text-button flex items-center gap-2" href="#">
<span class="material-symbols-outlined text-sm">dashboard</span> Board
                </a>
<a class="px-3 py-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-all font-button text-button flex items-center gap-2" href="#">
<span class="material-symbols-outlined text-sm">bar_chart</span> Reports
                </a>
<a class="px-3 py-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-all font-button text-button flex items-center gap-2" href="#">
<span class="material-symbols-outlined text-sm">assignment</span> Plans
                </a>
<a class="px-3 py-1.5 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-all font-button text-button flex items-center gap-2" href="#">
<span class="material-symbols-outlined text-sm">receipt_long</span> Billing
                </a>
</div>
</header>
<!-- Summary Cards Strip -->
<div class="grid grid-cols-1 md:grid-cols-3 gap-md">
<!-- Card 1 -->
<div class="bg-surface-container rounded-lg border border-outline-variant p-md flex flex-col justify-between">
<div class="font-label text-label text-on-surface-variant mb-sm">Current Factory</div>
<div class="font-page-title text-page-title text-on-surface mb-1">Detroit Assembly Plant 4</div>
<div class="font-metadata text-metadata text-on-surface-variant">Automotive Assembly Profile</div>
</div>
<!-- Card 2 -->
<div class="bg-surface-container rounded-lg border border-outline-variant p-md flex flex-col justify-between relative overflow-hidden">
<div class="absolute top-0 right-0 p-3 opacity-10 text-primary">
<span class="material-symbols-outlined text-4xl">factory</span>
</div>
<div class="font-label text-label text-on-surface-variant mb-sm">Factory Network</div>
<div class="text-[24px] font-bold text-on-surface mb-1 tracking-tight leading-none">12</div>
<div class="font-metadata text-metadata text-on-surface-variant">Active nodes across region</div>
</div>
<!-- Card 3 -->
<div class="bg-surface-container rounded-lg border border-outline-variant p-md flex flex-col justify-between relative overflow-hidden">
<div class="absolute top-0 right-0 p-3 opacity-10 text-primary">
<span class="material-symbols-outlined text-4xl">group</span>
</div>
<div class="font-label text-label text-on-surface-variant mb-sm">Active Users</div>
<div class="text-[24px] font-bold text-on-surface mb-1 tracking-tight leading-none">342</div>
<div class="font-metadata text-metadata text-on-surface-variant">Across all accessible facilities</div>
</div>
</div>
<!-- Tab Navigation (Sticky) -->
<div class="sticky top-[56px] z-30 bg-background/90 backdrop-blur-md pt-2 pb-0 -mx-gutter px-gutter md:-mx-lg md:px-lg border-b border-outline-variant mb-4">
<div class="flex gap-lg overflow-x-auto custom-scrollbar">
<button class="pb-3 font-label text-label text-on-surface-variant hover:text-on-surface transition-colors whitespace-nowrap">Factory profile</button>
<button class="pb-3 font-label text-label text-primary border-b-2 border-primary whitespace-nowrap relative">
                    User governance
                    <span class="absolute -top-1 -right-3 w-1.5 h-1.5 rounded-full bg-error"></span>
</button>
<button class="pb-3 font-label text-label text-on-surface-variant hover:text-on-surface transition-colors whitespace-nowrap">Usage metrics</button>
<button class="pb-3 font-label text-label text-on-surface-variant hover:text-on-surface transition-colors whitespace-nowrap">System alerts</button>
</div>
</div>
<!-- Main Tab Content: Two Column Layout (Users Tab) -->
<div class="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-lg items-start">
<!-- Left Column: Governance Registry Table -->
<div class="flex flex-col gap-4">
<div class="bg-surface-container rounded-lg border border-outline-variant overflow-hidden flex flex-col shadow-sm">
<div class="p-4 border-b border-outline-variant bg-surface-container-high flex justify-between items-center">
<h2 class="font-panel-title text-panel-title text-on-surface flex items-center gap-2">
<span class="material-symbols-outlined text-primary text-sm">shield_person</span>
                            Governance Registry
                        </h2>
<div class="relative">
<span class="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
<input class="bg-surface border border-outline-variant rounded pl-8 pr-3 py-1 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary w-48 transition-all font-body" placeholder="Search ID or Name" type="text"/>
</div>
</div>
<!-- Desktop Table -->
<div class="hidden md:block overflow-x-auto">
<table class="w-full text-left border-collapse">
<thead>
<tr class="bg-surface-container border-b border-outline-variant">
<th class="px-3 py-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.06em]">User ID</th>
<th class="px-3 py-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.06em]">Name</th>
<th class="px-3 py-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.06em]">Role</th>
<th class="px-3 py-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.06em]">Access</th>
<th class="px-3 py-2 text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.06em]">Status</th>
</tr>
</thead>
<tbody class="font-body text-[13px]">
<!-- Row 1 Active -->
<tr class="border-b border-outline-variant/50 hover:bg-surface-variant/50 transition-colors cursor-pointer group">
<td class="px-3 py-2.5 font-metadata text-metadata text-on-surface-variant group-hover:text-primary transition-colors">USR-8492</td>
<td class="px-3 py-2.5">
<div class="text-on-surface font-medium">Sarah Jenkins</div>
<div class="text-on-surface-variant text-xs">s.jenkins@factory.os</div>
</td>
<td class="px-3 py-2.5">
<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-secondary-container/50 text-secondary-fixed border border-secondary-container">Admin</span>
</td>
<td class="px-3 py-2.5">
<div class="text-on-surface">All Nodes (12)</div>
<div class="text-on-surface-variant text-xs">Global scope</div>
</td>
<td class="px-3 py-2.5">
<div class="flex items-center gap-1 text-primary">
<div class="w-1.5 h-1.5 rounded-full bg-primary"></div>
<span class="text-xs font-medium">Active</span>
</div>
</td>
</tr>
<!-- Row 2 Active -->
<tr class="border-b border-outline-variant/50 hover:bg-surface-variant/50 transition-colors cursor-pointer group">
<td class="px-3 py-2.5 font-metadata text-metadata text-on-surface-variant group-hover:text-primary transition-colors">USR-9104</td>
<td class="px-3 py-2.5">
<div class="text-on-surface font-medium">Michael Chen</div>
<div class="text-on-surface-variant text-xs">m.chen@factory.os</div>
</td>
<td class="px-3 py-2.5">
<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-surface-variant text-on-surface border border-outline-variant">Manager</span>
</td>
<td class="px-3 py-2.5">
<div class="text-on-surface">3 Facilities</div>
<div class="text-on-surface-variant text-xs">Detroit region</div>
</td>
<td class="px-3 py-2.5">
<div class="flex items-center gap-1 text-primary">
<div class="w-1.5 h-1.5 rounded-full bg-primary"></div>
<span class="text-xs font-medium">Active</span>
</div>
</td>
</tr>
<!-- Row 3 Active, currently selected implied by bg -->
<tr class="border-b border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer relative">
<td class="absolute left-0 top-0 bottom-0 w-0.5 bg-primary"></td>
<td class="px-3 py-2.5 font-metadata text-metadata text-primary">USR-3381</td>
<td class="px-3 py-2.5">
<div class="text-on-surface font-medium">Elena Rodriguez</div>
<div class="text-on-surface-variant text-xs">e.rodriguez@factory.os</div>
</td>
<td class="px-3 py-2.5">
<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-surface-variant text-on-surface border border-outline-variant">Supervisor</span>
</td>
<td class="px-3 py-2.5">
<div class="text-on-surface">1 Facility</div>
<div class="text-on-surface-variant text-xs">Detroit Assembly 4</div>
</td>
<td class="px-3 py-2.5">
<div class="flex items-center gap-1 text-primary">
<div class="w-1.5 h-1.5 rounded-full bg-primary"></div>
<span class="text-xs font-medium">Active</span>
</div>
</td>
</tr>
<!-- Row 4 Inactive (muted) -->
<tr class="border-b border-outline-variant/30 opacity-60 hover:opacity-100 transition-opacity bg-surface-dim">
<td class="px-3 py-2.5 font-metadata text-metadata text-on-surface-variant">USR-1192</td>
<td class="px-3 py-2.5">
<div class="text-on-surface-variant font-medium">David Kim</div>
<div class="text-on-surface-variant text-xs">d.kim@factory.os</div>
</td>
<td class="px-3 py-2.5">
<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-surface-variant text-on-surface-variant border border-outline-variant/50">Operator</span>
</td>
<td class="px-3 py-2.5">
<div class="text-on-surface-variant">None</div>
<div class="text-on-surface-variant text-xs">Access revoked</div>
</td>
<td class="px-3 py-2.5">
<div class="flex items-center gap-1 text-on-surface-variant">
<div class="w-1.5 h-1.5 rounded-full border border-on-surface-variant"></div>
<span class="text-xs font-medium">Inactive</span>
</div>
</td>
</tr>
</tbody>
</table>
</div>
<!-- Mobile Card View (Hidden on desktop) -->
<div class="md:hidden flex flex-col divide-y divide-outline-variant">
<div class="p-4 bg-surface-container flex flex-col gap-2">
<div class="flex justify-between items-start">
<div>
<div class="font-medium text-on-surface">Sarah Jenkins</div>
<div class="font-metadata text-metadata text-primary">USR-8492</div>
</div>
<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-secondary-container/50 text-secondary-fixed border border-secondary-container">Admin</span>
</div>
<div class="grid grid-cols-2 gap-2 mt-2">
<div>
<div class="font-label text-[11px] font-medium text-on-surface-variant">Factory access</div>
<div class="text-sm">All Nodes (12)</div>
</div>
<div>
<div class="font-label text-[11px] font-medium text-on-surface-variant">Status</div>
<div class="text-sm text-primary">Active</div>
</div>
</div>
</div>
</div>
<div class="p-3 border-t border-outline-variant bg-surface-container-low flex justify-between items-center text-xs text-on-surface-variant">
<span>Showing 4 of 342 users</span>
<div class="flex gap-1">
<button class="p-1 rounded hover:bg-surface-variant disabled:opacity-50"><span class="material-symbols-outlined text-sm">chevron_left</span></button>
<button class="p-1 rounded hover:bg-surface-variant"><span class="material-symbols-outlined text-sm">chevron_right</span></button>
</div>
</div>
</div>
<!-- System Status Banner -->
<div class="bg-surface-container rounded border-l-4 border-primary p-3 flex items-start gap-3">
<span class="material-symbols-outlined text-primary text-sm mt-0.5">info</span>
<div>
<div class="text-sm font-medium text-on-surface">Directory Sync Active</div>
<div class="text-xs text-on-surface-variant mt-0.5">User records were last synchronized with corporate Active Directory 12 minutes ago.</div>
</div>
</div>
</div>
<!-- Right Column: Action Cards -->
<div class="flex flex-col gap-lg">
<!-- Invite Card -->
<div class="bg-surface-container rounded-lg border border-outline-variant p-5 shadow-sm">
<h2 class="font-panel-title text-panel-title text-on-surface mb-4 flex items-center gap-2">
<span class="material-symbols-outlined text-on-surface-variant text-sm">person_add</span>
                        Invite new user
                    </h2>
<form class="space-y-4">
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
<div class="flex flex-col gap-1.5">
<label class="text-[13px] font-medium text-on-surface-variant">User name</label>
<input class="bg-surface border border-outline-variant rounded p-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all font-body h-10" type="text"/>
</div>
<div class="flex flex-col gap-1.5">
<label class="text-[13px] font-medium text-on-surface-variant">Email address</label>
<input class="bg-surface border border-outline-variant rounded p-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all font-body h-10" type="email"/>
</div>
</div>
<div class="flex flex-col gap-1.5">
<label class="text-[13px] font-medium text-on-surface-variant">System role</label>
<div class="relative">
<select class="bg-surface border border-outline-variant rounded p-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all font-body w-full appearance-none h-10">
<option>Select role...</option>
<option>Operator</option>
<option>Supervisor</option>
<option>Manager</option>
</select>
<span class="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-sm">expand_more</span>
</div>
</div>
<button class="w-full bg-surface-variant text-on-surface border border-outline-variant font-button text-button h-10 rounded flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-all relative overflow-hidden group" type="button">
                            Generate invitation
                        </button>
</form>
</div>
<!-- Factory Access Card (Contextual to selected user) -->
<div class="bg-surface-container border border-outline-variant rounded-lg p-5 shadow-sm relative overflow-hidden">
<div class="absolute top-0 left-0 w-1 h-full bg-primary"></div>
<div class="flex justify-between items-start mb-4">
<div>
<h2 class="font-panel-title text-panel-title text-on-surface flex items-center gap-2">
<span class="material-symbols-outlined text-primary text-sm">domain</span>
                                Factory access
                            </h2>
<div class="text-xs text-on-surface-variant mt-1">Managing access for <span class="font-metadata text-primary">USR-3381</span> (Elena Rodriguez)</div>
</div>
</div>
<div class="space-y-2 mb-4 max-h-48 overflow-y-auto custom-scrollbar pr-2">
<!-- Access Items -->
<label class="flex items-center gap-3 p-2 rounded bg-surface border border-primary/30 cursor-pointer hover:bg-surface-variant transition-colors group">
<input checked="" class="w-4 h-4 rounded-sm border-outline-variant bg-surface text-primary focus:ring-primary focus:ring-offset-surface" type="checkbox"/>
<div class="flex flex-col">
<span class="text-sm font-medium text-on-surface group-hover:text-primary transition-colors">Detroit Assembly Plant 4</span>
<span class="text-[11px] text-on-surface-variant">Primary Assignment</span>
</div>
</label>
<label class="flex items-center gap-3 p-2 rounded bg-surface border border-outline-variant/50 cursor-pointer hover:bg-surface-variant transition-colors group">
<input class="w-4 h-4 rounded-sm border-outline-variant bg-surface text-primary focus:ring-primary focus:ring-offset-surface" type="checkbox"/>
<div class="flex flex-col">
<span class="text-sm font-medium text-on-surface">Chicago Stamping Facility</span>
<span class="text-[11px] text-on-surface-variant">Secondary Region</span>
</div>
</label>
<label class="flex items-center gap-3 p-2 rounded bg-surface border border-outline-variant/50 cursor-pointer hover:bg-surface-variant transition-colors group">
<input class="w-4 h-4 rounded-sm border-outline-variant bg-surface text-primary focus:ring-primary focus:ring-offset-surface" type="checkbox"/>
<div class="flex flex-col">
<span class="text-sm font-medium text-on-surface">Cleveland Powertrain</span>
<span class="text-[11px] text-on-surface-variant">Secondary Region</span>
</div>
</label>
</div>
<button class="w-full bg-primary text-surface-dim font-button text-button h-10 rounded flex items-center justify-center gap-2 hover:bg-primary-container transition-colors relative overflow-hidden group" type="button">
<span class="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></span>
<span class="relative flex items-center gap-2">
<span class="material-symbols-outlined text-sm">save</span>
                            Save factory access
                        </span>
</button>
</div>
<!-- Role Update & Deactivate Card -->
<div class="bg-surface-container rounded-lg border border-outline-variant overflow-hidden shadow-sm">
<div class="p-5">
<h2 class="font-panel-title text-panel-title text-on-surface mb-4 flex items-center gap-2">
<span class="material-symbols-outlined text-on-surface-variant text-sm">manage_accounts</span>
                            Update role / deactivate
                        </h2>
<div class="space-y-4">
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
<div class="flex flex-col gap-1.5">
<label class="text-[13px] font-medium text-on-surface-variant">User Code or ID</label>
<input class="bg-surface border border-outline-variant rounded p-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all font-metadata h-10" type="text" value="USR-3381"/>
</div>
<div class="flex flex-col gap-1.5">
<label class="text-[13px] font-medium text-on-surface-variant">New Role</label>
<div class="relative">
<select class="bg-surface border border-outline-variant rounded p-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all font-body w-full appearance-none h-10">
<option>Supervisor</option>
<option>Manager</option>
<option>Operator</option>
</select>
<span class="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-sm">expand_more</span>
</div>
</div>
</div>
<div class="flex flex-col gap-1.5">
<label class="text-[13px] font-medium text-on-surface-variant">Type DOWNGRADE to confirm lower roles</label>
<input class="bg-surface border border-outline-variant rounded p-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all font-body h-10" placeholder="Required for demotions" type="text"/>
</div>
<button class="w-full bg-surface-variant text-on-surface border border-outline-variant font-button text-button h-10 rounded flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-all relative overflow-hidden group" type="button">
                                Update Role
                            </button>
</div>
</div>
<!-- Danger Zone -->
<div class="p-5 border-t border-error/20 bg-error/5 mt-2">
<div class="flex flex-col gap-1.5 mb-4">
<label class="text-[13px] font-medium text-error flex items-center gap-1">
<span class="material-symbols-outlined text-[14px]">warning</span>
                                Deactivate User Code or ID
                            </label>
<input class="bg-surface border border-error/30 rounded p-2 text-sm text-on-surface focus:border-error focus:ring-1 focus:ring-error transition-all font-metadata h-10 placeholder:text-on-surface-variant/50" placeholder="Enter ID to confirm" type="text"/>
</div>
<button class="w-full bg-transparent text-error border border-error/50 font-button text-button h-10 rounded flex items-center justify-center gap-2 hover:bg-error/10 transition-colors relative overflow-hidden group" type="button">
<span class="material-symbols-outlined text-sm">person_off</span>
                            Deactivate User
                        </button>
</div>
</div>
</div>
</div>
</main>
<script>
        // Inline JS for micro-interactions if needed
        document.addEventListener('DOMContentLoaded', () => {
            // Example: Add subtle hover effects to table rows beyond CSS
            const rows = document.querySelectorAll('.group');
            rows.forEach(row => {
                row.addEventListener('mouseenter', () => {
                    const idCell = row.querySelector('.font-metadata');
                    if(idCell && !row.classList.contains('bg-primary/5')) {
                        idCell.style.color = 'var(--tw-colors-primary)';
                    }
                });
                row.addEventListener('mouseleave', () => {
                    const idCell = row.querySelector('.font-metadata');
                    if(idCell && !row.classList.contains('bg-primary/5')) {
                        idCell.style.color = '';
                    }
                });
            });
        });
    </script>
</body></html>
```


---



---

### setting alert tab

### code 

````
<!DOCTYPE html><html class="dark" lang="en"><head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>Alerts &amp; Notifications - Industrial OS</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&amp;family=JetBrains+Mono:wght@400;500;600&amp;display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet">
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "tertiary-fixed": "#ffddb1",
                        "surface-container-high": "#222a3d",
                        "secondary": "#b7c8e1",
                        "error-container": "#93000a",
                        "on-secondary-container": "#a9bad3",
                        "primary": "#a4e6ff",
                        "on-tertiary-fixed": "#291800",
                        "surface-container-highest": "#2d3449",
                        "on-error-container": "#ffdad6",
                        "surface-dim": "#0b1326",
                        "primary-container": "#00d1ff",
                        "on-tertiary-fixed-variant": "#624000",
                        "on-secondary-fixed-variant": "#38485d",
                        "on-secondary-fixed": "#0b1c30",
                        "surface-variant": "#2d3449",
                        "outline": "#859399",
                        "error": "#ffb4ab",
                        "on-primary-fixed-variant": "#004e60",
                        "secondary-container": "#3a4a5f",
                        "on-tertiary": "#442b00",
                        "tertiary-container": "#feb127",
                        "surface": "#0b1326",
                        "inverse-primary": "#00677f",
                        "on-surface": "#dae2fd",
                        "on-error": "#690005",
                        "on-background": "#dae2fd",
                        "tertiary": "#ffd59c",
                        "inverse-on-surface": "#283044",
                        "outline-variant": "#3c494e",
                        "on-secondary": "#213145",
                        "primary-fixed": "#b7eaff",
                        "surface-container-lowest": "#060e20",
                        "on-surface-variant": "#bbc9cf",
                        "surface-bright": "#31394d",
                        "inverse-surface": "#dae2fd",
                        "on-tertiary-container": "#6b4700",
                        "on-primary-fixed": "#001f28",
                        "secondary-fixed-dim": "#b7c8e1",
                        "on-primary-container": "#00566a",
                        "background": "#0b1326",
                        "tertiary-fixed-dim": "#ffba49",
                        "surface-container": "#171f33",
                        "secondary-fixed": "#d3e4fe",
                        "on-primary": "#003543",
                        "surface-container-low": "#131b2e",
                        "primary-fixed-dim": "#4cd6ff",
                        "surface-tint": "#4cd6ff"
                    },
                    "borderRadius": {
                        "DEFAULT": "0.125rem",
                        "lg": "0.25rem",
                        "xl": "0.5rem",
                        "full": "0.75rem"
                    },
                    "spacing": {
                        "xl": "32px",
                        "base": "4px",
                        "md": "16px",
                        "gutter": "16px",
                        "xs": "4px",
                        "margin": "24px",
                        "lg": "24px",
                        "sm": "8px"
                    },
                    "fontFamily": {
                        "panel-title": ["Hanken Grotesk"],
                        "metadata": ["JetBrains Mono"],
                        "button": ["Hanken Grotesk"],
                        "label": ["JetBrains Mono"],
                        "body": ["Hanken Grotesk"],
                        "page-title": ["Hanken Grotesk"]
                    },
                    "fontSize": {
                        "panel-title": ["16px", { "lineHeight": "20px", "letterSpacing": "0em", "fontWeight": "600" }],
                        "metadata": ["11px", { "lineHeight": "14px", "letterSpacing": "0.04em", "fontWeight": "400" }],
                        "button": ["14px", { "lineHeight": "14px", "letterSpacing": "0.02em", "fontWeight": "500" }],
                        "label": ["12px", { "lineHeight": "16px", "letterSpacing": "0.02em", "fontWeight": "500" }],
                        "body": ["14px", { "lineHeight": "20px", "letterSpacing": "0em", "fontWeight": "400" }],
                        "page-title": ["18px", { "lineHeight": "24px", "letterSpacing": "0em", "fontWeight": "600" }]
                    }
                }
            }
        }
    </script>
<style>
        body { background-color: theme('colors.background'); color: theme('colors.on-background'); }
        /* Radial ambient light */
        .ambient-glow {
            position: fixed; top: -20%; left: -10%; width: 50vw; height: 50vh;
            background: radial-gradient(circle, rgba(0, 209, 255, 0.05) 0%, transparent 70%);
            z-index: -1; pointer-events: none;
        }
        /* Grid background pattern */
        .grid-bg {
            background-image: 
                linear-gradient(theme('colors.surface-container-high') 1px, transparent 1px),
                linear-gradient(90deg, theme('colors.surface-container-high') 1px, transparent 1px);
            background-size: 24px 24px;
            background-position: center center;
            opacity: 0.1; position: fixed; inset: 0; z-index: -2; pointer-events: none;
        }
    </style>
</head>
<body class="font-body text-body antialiased min-h-screen flex flex-col bg-surface">


<!-- TopNavBar -->
<nav class="flex justify-between items-center px-gutter w-full fixed top-0 z-50 bg-surface dark:bg-surface docked full-width top-0 h-[56px] border-b border-outline-variant dark:border-outline-variant bg-surface flat no shadows">
<div class="flex items-center gap-md">
<span class="font-page-title text-page-title text-primary font-bold tracking-tight">Industrial OS</span>
<div class="hidden md:flex gap-md ml-lg">
<a class="text-on-surface-variant font-medium hover:text-primary-container transition-colors" href="#">Systems</a>
<a class="text-on-surface-variant font-medium hover:text-primary-container transition-colors" href="#">Assets</a>
<a class="text-on-surface-variant font-medium hover:text-primary-container transition-colors" href="#">Security</a>
</div>
</div>
<div class="flex items-center gap-sm">
<button class="p-2 text-on-surface-variant hover:text-primary-container transition-colors"><span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">notifications</span></button>
<button class="p-2 text-on-surface-variant hover:text-primary-container transition-colors"><span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">settings</span></button>
<button class="p-2 text-on-surface-variant hover:text-primary-container transition-colors"><span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">help</span></button>
<div class="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant ml-sm overflow-hidden flex items-center justify-center">
<span class="material-symbols-outlined text-on-surface-variant" style="font-variation-settings: 'FILL' 1;">account_circle</span>
</div>
</div>
</nav>
<!-- SideNavBar & Main Content Wrapper -->
<div class="flex flex-1 pt-[56px]">
<!-- SideNavBar -->
<aside class="hidden md:flex flex-col h-[calc(100vh-56px)] fixed left-0 top-[56px] py-md z-40 bg-surface-container-low dark:bg-surface-container-low docked left-0 h-full w-64 bg-surface-container-low border-r border-outline-variant flat no shadows">
<div class="px-md pb-md mb-md border-b border-outline-variant flex items-center gap-sm">
<div class="w-10 h-10 rounded-DEFAULT bg-surface-container-highest border border-outline flex items-center justify-center">
<span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">memory</span>
</div>
<div>
<h2 class="font-panel-title text-panel-title text-on-surface">Core Engine</h2>
<p class="font-metadata text-metadata text-on-surface-variant">v4.2.0-stable</p>
</div>
</div>
<nav class="flex-1 px-sm space-y-xs">
<a class="flex items-center gap-sm px-sm py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-DEFAULT font-label text-label hover:bg-surface-container-high transition-colors" href="#">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">grid_view</span> Dashboard
                </a>
<a class="flex items-center gap-sm px-sm py-2 bg-secondary-container text-on-secondary-container rounded-lg font-label text-label opacity-80 transition-all scale-[0.98] transition-transform" href="#">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">settings_input_component</span> Node Control
                </a>
<a class="flex items-center gap-sm px-sm py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-DEFAULT font-label text-label hover:bg-surface-container-high transition-colors" href="#">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">lan</span> Network
                </a>
<a class="flex items-center gap-sm px-sm py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-DEFAULT font-label text-label hover:bg-surface-container-high transition-colors" href="#">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">database</span> Storage
                </a>
<a class="flex items-center gap-sm px-sm py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-DEFAULT font-label text-label hover:bg-surface-container-high transition-colors" href="#">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">terminal</span> Logs
                </a>
</nav>
<div class="px-md mt-auto space-y-sm">
<button class="w-full bg-primary text-on-primary font-button text-button h-[42px] rounded-DEFAULT flex items-center justify-center gap-xs hover:bg-primary-fixed transition-colors">
                    Deploy Update
                </button>
<div class="pt-sm border-t border-outline-variant space-y-xs">
<a class="flex items-center gap-sm px-sm py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-DEFAULT font-label text-label hover:bg-surface-container-high transition-colors" href="#">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">contact_support</span> Support
                    </a>
<a class="flex items-center gap-sm px-sm py-2 text-on-surface-variant hover:bg-surface-container-highest rounded-DEFAULT font-label text-label hover:bg-surface-container-high transition-colors" href="#">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 0;">logout</span> Exit
                    </a>
</div>
</div>
</aside>
<!-- Main Canvas -->
<main class="flex-1 ml-0 md:ml-64 p-margin overflow-y-auto">
<!-- 1. Page Header -->
<header class="mb-lg flex flex-col md:flex-row md:items-end justify-between gap-md border-b border-outline-variant pb-md">
<div>
<span class="font-metadata text-metadata text-tertiary-container tracking-widest uppercase mb-xs block">Settings</span>
<h1 class="font-page-title text-[24px] leading-tight font-bold text-on-surface">Keep factory setup and team control in one admin lane</h1>
</div>
<div class="flex flex-wrap gap-sm">
<button class="h-[42px] px-md border border-outline text-on-surface bg-surface-container-low hover:bg-surface-container-highest rounded-DEFAULT font-button text-button transition-colors">Board</button>
<button class="h-[42px] px-md border border-outline text-on-surface bg-surface-container-low hover:bg-surface-container-highest rounded-DEFAULT font-button text-button transition-colors">Reports</button>
<button class="h-[42px] px-md border border-outline text-on-surface bg-surface-container-low hover:bg-surface-container-highest rounded-DEFAULT font-button text-button transition-colors">Plans</button>
<button class="h-[42px] px-md border border-outline text-on-surface bg-surface-container-low hover:bg-surface-container-highest rounded-DEFAULT font-button text-button transition-colors">Billing</button>
</div>
</header>
<!-- 2. KPI Summary Strip -->
<section class="grid grid-cols-1 md:grid-cols-3 gap-md mb-xl">
<div class="bg-surface-container-lowest border border-outline-variant p-md rounded-lg relative overflow-hidden group">
<div class="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
<span class="font-label text-label text-on-surface-variant block mb-sm">Current Factory</span>
<div class="flex items-center justify-between">
<span class="font-panel-title text-panel-title text-on-surface">Shree Steel Works</span>
<span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">factory</span>
</div>
</div>
<div class="bg-surface-container-lowest border border-outline-variant p-md rounded-lg relative overflow-hidden group">
<div class="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
<span class="font-label text-label text-on-surface-variant block mb-sm">Factory Network</span>
<div class="flex items-center justify-between">
<span class="font-panel-title text-panel-title text-on-surface font-mono text-[18px]">3</span>
<span class="material-symbols-outlined text-secondary" style="font-variation-settings: 'FILL' 1;">hub</span>
</div>
</div>
<div class="bg-surface-container-lowest border border-outline-variant p-md rounded-lg relative overflow-hidden group">
<div class="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
<span class="font-label text-label text-on-surface-variant block mb-sm">Active Users</span>
<div class="flex items-center justify-between">
<span class="font-panel-title text-panel-title text-on-surface font-mono text-[18px]">12</span>
<span class="material-symbols-outlined text-tertiary" style="font-variation-settings: 'FILL' 1;">group</span>
</div>
</div>
</section>
<!-- 3. Tab Navigation -->
<nav class="flex gap-lg border-b border-outline-variant mb-lg font-button text-button">
<a class="text-on-surface-variant pb-sm hover:text-on-surface transition-colors" href="#">Factory</a>
<a class="text-on-surface-variant pb-sm hover:text-on-surface transition-colors" href="#">Users</a>
<a class="text-on-surface-variant pb-sm hover:text-on-surface transition-colors" href="#">Usage</a>
<a class="text-primary font-bold border-b-2 border-primary pb-sm shadow-[0_2px_10px_rgba(0,209,255,0.3)]" href="#">Alerts</a>
</nav>
<!-- 4. Alerts KPI Row -->
<section class="grid grid-cols-1 sm:grid-cols-3 gap-md mb-lg">
<div class="bg-surface-container border border-outline-variant rounded-DEFAULT p-sm flex items-center justify-between">
<span class="font-label text-label text-on-surface-variant">Active recipients</span>
<span class="font-metadata text-[18px] font-semibold text-on-surface">2</span>
</div>
<div class="bg-surface-container border border-outline-variant rounded-DEFAULT p-sm flex items-center justify-between">
<span class="font-label text-label text-on-surface-variant">Remaining capacity</span>
<span class="font-metadata text-[18px] font-semibold text-tertiary-container">1</span>
</div>
<div class="bg-surface-container border border-outline-variant rounded-DEFAULT p-sm flex items-center justify-between">
<span class="font-label text-label text-on-surface-variant">Last alert</span>
<span class="font-metadata text-[14px] font-semibold text-primary">Delivered</span>
</div>
</section>
<!-- 5. Two-Column Grid -->
<div class="grid grid-cols-1 lg:grid-cols-12 gap-lg">
<!-- Left Column (60%) -->
<div class="space-y-md lg:col-span-12">
<h3 class="font-panel-title text-panel-title text-on-surface border-b border-outline-variant pb-xs">WhatsApp recipients</h3>
<!-- Recipient 1 -->
<div class="bg-surface-container-low border border-outline-variant rounded-lg p-md flex flex-col sm:flex-row sm:items-center justify-between gap-md relative">
<div class="absolute left-0 top-0 bottom-0 w-1 bg-secondary rounded-l-lg"></div>
<div>
<div class="flex items-center gap-sm mb-xs">
<span class="font-metadata text-[14px] text-on-surface">+91 98765 ***** 4210</span>
<span class="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20 font-metadata text-[10px] uppercase">Verified</span>
</div>
<span class="font-label text-label text-on-surface-variant">Status: Active</span>
</div>
<div class="flex items-center gap-md">
<label class="relative inline-flex items-center cursor-pointer">
<input checked="" class="sr-only peer" type="checkbox">
<div class="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-primary after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
<span class="ml-3 font-label text-label text-on-surface">Enabled</span>
</label>
</div>
</div>
<!-- Recipient 2 -->
<div class="bg-surface-container-low border border-outline-variant rounded-lg p-md flex flex-col sm:flex-row sm:items-center justify-between gap-md relative">
<div class="absolute left-0 top-0 bottom-0 w-1 bg-tertiary-container rounded-l-lg"></div>
<div>
<div class="flex items-center gap-sm mb-xs">
<span class="font-metadata text-[14px] text-on-surface">+91 77654 ***** 9901</span>
<span class="px-2 py-0.5 rounded-full bg-tertiary-container/10 text-tertiary-container border border-tertiary-container/20 font-metadata text-[10px] uppercase">Pending</span>
</div>
<span class="font-label text-label text-on-surface-variant flex items-center gap-xs"><span class="material-symbols-outlined text-[14px] text-tertiary-container">warning</span> Verify number</span>
</div>
<div class="flex items-center gap-md">
<label class="relative inline-flex items-center cursor-pointer opacity-50">
<input class="sr-only peer" disabled="" type="checkbox">
<div class="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-surface-variant after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
<span class="ml-3 font-label text-label text-on-surface-variant">Paused</span>
</label>
</div>
</div>
</div>
<!-- Right Column (40%) -->

</div>
</main>
</div>


</body></html>

````

````
### CODE 
FACTORY TAB SETTING?USAGE

<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>FactoryNerve OS | Usage &amp; Billing</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&amp;family=Geist:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<style>
        body {
            background-color: #151311; /* surface-dim from DESIGN_SYSTEM_10 */
            color: #d3e4fe; 
            font-family: 'Geist', sans-serif;
            margin: 0;
            overflow-x: hidden;
            background-image: 
                radial-gradient(circle at 50% -20%, rgba(212, 157, 106, 0.08), transparent 70%),
                linear-gradient(rgba(141, 148, 158, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(141, 148, 158, 0.03) 1px, transparent 1px);
            background-size: 100% 100%, 24px 24px, 24px 24px;
        }
        .milled-edge {
            border-top: 1px solid rgba(212, 157, 106, 0.1);
        }
        .glass-hud {
            backdrop-filter: blur(20px);
            background: rgba(21, 19, 17, 0.85);
        }
        .zebra-row:nth-child(even) {
            background-color: rgba(60, 56, 54, 0.2);
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            vertical-align: middle;
            font-size: 18px;
        }
        /* Custom scrollbar for high-density feel */
        ::-webkit-scrollbar {
            width: 4px;
            height: 4px;
        }
        ::-webkit-scrollbar-track {
            background: #100e0c;
        }
        ::-webkit-scrollbar-thumb {
            background: #45474b;
            border-radius: 2px;
        }
    </style>
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                "on-surface-variant": "#c6c6cb",
                "inverse-surface": "#d3e4fe",
                "primary-fixed-dim": "#c6c6cc",
                "system-navy": "#1E293B",
                "primary-container": "#100e0c",
                "on-primary-container": "#797a7f",
                "inverse-primary": "#5d5e63",
                "on-secondary": "#2c3138",
                "surface-bright": "#3c3836",
                "secondary-fixed": "#dee2ec",
                "on-surface": "#d3e4fe",
                "on-tertiary": "#233144",
                "primary-fixed": "#e2e2e8",
                "on-primary": "#2f3035",
                "on-primary-fixed": "#1a1c20",
                "surface-container-highest": "#3c3836",
                "on-secondary-fixed": "#171c23",
                "error": "#ffb4ab",
                "surface-graphite": "#0F1115",
                "surface": "#151311",
                "surface-dim": "#151311",
                "surface-container": "#1e1b19",
                "surface-tint": "#d49d6a",
                "secondary": "#c2c7d0",
                "on-tertiary-container": "#6d7b91",
                "error-container": "#93000a",
                "accent-steel": "#8B949E",
                "tertiary-container": "#100e0c",
                "surface-container-lowest": "#100e0c",
                "on-error": "#690005",
                "on-background": "#d3e4fe",
                "outline": "#45474b",
                "secondary-fixed-dim": "#c2c7d0",
                "secondary-container": "#42474f",
                "surface-panel": "#1e1b19",
                "on-tertiary-fixed": "#0d1c2f",
                "border-muted": "#3c3836",
                "surface-variant": "#3c3836",
                "surface-container-low": "#1e1b19",
                "data-blue": "#d49d6a", /* Updated brand color to bronze tint */
                "inverse-on-surface": "#213145",
                "background": "#151311",
                "on-secondary-fixed-variant": "#42474f",
                "on-primary-fixed-variant": "#45474b",
                "on-error-container": "#ffdad6",
                "surface-container-high": "#262422",
                "on-secondary-container": "#b1b5bf",
                "tertiary-fixed": "#d5e3fd",
                "outline-variant": "#45474b",
                "tertiary": "#b9c7e0",
                "primary": "#d49d6a",
                "tertiary-fixed-dim": "#b9c7e0",
                "on-tertiary-fixed-variant": "#3a485c"
              },
              "borderRadius": {
                "DEFAULT": "0.25rem", /* Rounding set to 4px (ROUND_FOUR) */
                "lg": "0.25rem",
                "xl": "0.25rem",
                "full": "9999px"
              },
              "spacing": {
                "base-unit": "4px",
                "padding-xs": "4px",
                "padding-sm": "8px",
                "padding-md": "12px",
                "gutter": "16px"
              },
              "fontFamily": {
                "data-numeric": ["JetBrains Mono"],
                "headline-lg": ["Geist"],
                "data-label": ["JetBrains Mono"],
                "body-sm": ["Geist"],
                "headline-md": ["Geist"],
                "body-md": ["Geist"]
              },
              "fontSize": {
                "data-numeric": ["13px", {"lineHeight": "18px", "letterSpacing": "0em", "fontWeight": "400"}],
                "headline-lg": ["24px", {"lineHeight": "32px", "letterSpacing": "-0.02em", "fontWeight": "600"}],
                "data-label": ["12px", {"lineHeight": "16px", "letterSpacing": "0.02em", "fontWeight": "500"}],
                "body-sm": ["13px", {"lineHeight": "18px", "fontWeight": "400"}],
                "headline-md": ["18px", {"lineHeight": "24px", "letterSpacing": "-0.01em", "fontWeight": "600"}],
                "body-md": ["14px", {"lineHeight": "20px", "fontWeight": "400"}]
              }
            },
          },
        }
    </script>
</head>
<body class="bg-background text-on-surface selection:bg-primary-container selection:text-primary">
<!-- TopNavBar -->
<header class="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-gutter h-14 bg-surface-container-low border-b border-border-muted/50">
<div class="flex items-center gap-gutter">
<span class="text-headline-md font-headline-md font-bold tracking-tighter text-on-surface">FactoryNerve OS</span>
<nav class="hidden md:flex gap-gutter items-center h-full">
<a class="text-on-surface-variant hover:text-primary transition-colors duration-200 font-body-md text-body-md" href="#">Dashboard</a>
<a class="text-on-surface-variant hover:text-primary transition-colors duration-200 font-body-md text-body-md" href="#">Analytics</a>
<a class="text-on-surface-variant hover:text-primary transition-colors duration-200 font-body-md text-body-md" href="#">Assets</a>
<a class="text-on-surface-variant hover:text-primary transition-colors duration-200 font-body-md text-body-md" href="#">Governance</a>
</nav>
</div>
<div class="flex items-center gap-padding-md">
<button class="flex items-center gap-padding-xs bg-surface-container-high px-padding-sm py-1 rounded border border-border-muted text-primary hover:bg-surface-container-highest transition-all">
<span class="material-symbols-outlined text-[14px]">sensors</span>
<span class="font-data-label text-data-label">System Status</span>
</button>
<div class="flex gap-padding-sm border-l border-border-muted pl-padding-md">
<span class="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer transition-colors">notifications</span>
<span class="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer transition-colors">settings</span>
<span class="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer transition-colors">help</span>
</div>
<img alt="Operator Profile" class="w-8 h-8 rounded-full border border-border-muted ml-padding-sm" data-alt="A close-up of a high-tech biometric user avatar displayed on a dark industrial screen. The image features a stylized human silhouette with digital scanning lines and teal holographic accents against a graphite gray background. The lighting is cold and clinical, emphasizing the professional and secure identity of a systems operator within a smart factory environment." src="https://lh3.googleusercontent.com/aida-public/AB6AXuD5IEVw0DKOgBM-fj3jEu1YvZlJiRHmgt70tHIBIYot6648-cmYQJllcZVUBhv8YsmanekFzVdv6mZYaoHFBd5X3T87dI5hPBHq41OLXUi-uvk75qHCpG-spGsA4Yj2AjEf7no-h3dYDS_9L5-3IBxlrvggtzl2e9PUX8atNsambCkcm02QqkRFqX9KIfu2sr3YBOwSS3hzQFRPLwEgdGx-xlBxcJQhz2yeu-xI9jl9z37V1R8mwssNkwmKgdkbhdKPNR_Ziwi_LtU"/>
</div>
</header>
<!-- SideNavBar -->
<aside class="fixed left-0 top-14 bottom-0 w-64 flex flex-col p-padding-md gap-base-unit z-40 bg-surface-container-lowest border-r border-border-muted/50">
<div class="mb-padding-md p-padding-sm">
<div class="flex items-center gap-padding-sm mb-2">
<div class="w-8 h-8 bg-surface-container-highest rounded flex items-center justify-center border border-border-muted">
<span class="material-symbols-outlined text-primary">precision_manufacturing</span>
</div>
<div>
<h3 class="font-headline-sm text-headline-sm text-primary leading-tight">Command Center</h3>
<p class="font-data-numeric text-[10px] text-on-surface-variant opacity-60">Instance: Alpha-Grid-4</p>
</div>
</div>
</div>
<nav class="flex-1 flex flex-col gap-1">
<a class="flex items-center gap-padding-sm px-padding-md py-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all rounded group" href="#">
<span class="material-symbols-outlined group-hover:text-primary" data-icon="shield">shield</span>
<span class="font-body-sm text-body-sm">Security</span>
</a>
<a class="flex items-center gap-padding-sm px-padding-md py-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all rounded group" href="#">
<span class="material-symbols-outlined group-hover:text-primary" data-icon="lan">lan</span>
<span class="font-body-sm text-body-sm">Network</span>
</a>
<a class="flex items-center gap-padding-sm px-padding-md py-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all rounded group" href="#">
<span class="material-symbols-outlined group-hover:text-primary" data-icon="memory">memory</span>
<span class="font-body-sm text-body-sm">Compute</span>
</a>
<a class="flex items-center gap-padding-sm px-padding-md py-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all rounded group" href="#">
<span class="material-symbols-outlined group-hover:text-primary" data-icon="database">database</span>
<span class="font-body-sm text-body-sm">Storage</span>
</a>
<a class="flex items-center gap-padding-sm px-padding-md py-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all rounded group" href="#">
<span class="material-symbols-outlined group-hover:text-primary" data-icon="admin_panel_settings">admin_panel_settings</span>
<span class="font-body-sm text-body-sm">Access Control</span>
</a>
</nav>
<div class="mt-auto flex flex-col gap-2 pt-padding-md border-t border-border-muted/50">
<button class="w-full bg-surface-container-highest text-primary font-data-label text-data-label py-2 rounded border border-border-muted hover:border-primary transition-all">
            Deploy Changes
        </button>
<div class="flex justify-between px-padding-sm pt-2">
<div class="flex items-center gap-1 text-on-surface-variant cursor-pointer hover:text-on-surface">
<span class="material-symbols-outlined text-[16px]">description</span>
<span class="text-[10px] font-data-label">Logs</span>
</div>
<div class="flex items-center gap-1 text-on-surface-variant cursor-pointer hover:text-on-surface">
<span class="material-symbols-outlined text-[16px]">terminal</span>
<span class="text-[10px] font-data-label">Terminal</span>
</div>
</div>
</div>
</aside>
<!-- Main Canvas -->
<main class="ml-64 mt-14 p-gutter min-h-[calc(100vh-3.5rem)] flex flex-col gap-6">
<!-- Settings Header Section -->
<header class="flex flex-col gap-4">
<div class="flex flex-col gap-1">
<span class="text-[11px] font-[500] text-primary tracking-wider">Settings</span>
<h1 class="text-headline-md font-headline-md text-on-surface">Keep factory setup and team control in one admin lane</h1>
</div>
<!-- Quick Nav Strip -->
<div class="flex items-center gap-gutter text-on-surface-variant border-b border-border-muted pb-4">
<a class="text-body-sm font-body-sm hover:text-primary transition-colors flex items-center gap-1" href="#">
<span class="material-symbols-outlined text-[16px]">dashboard</span> Board
            </a>
<a class="text-body-sm font-body-sm hover:text-primary transition-colors flex items-center gap-1" href="#">
<span class="material-symbols-outlined text-[16px]">analytics</span> Reports
            </a>
<a class="text-body-sm font-body-sm hover:text-primary transition-colors flex items-center gap-1" href="#">
<span class="material-symbols-outlined text-[16px]">description</span> Plans
            </a>
<a class="text-primary font-body-sm hover:text-primary transition-colors flex items-center gap-1 border-b-2 border-primary pb-4 -mb-4" href="#">
<span class="material-symbols-outlined text-[16px]">payments</span> Billing
            </a>
</div>
<!-- Summary Cards Strip -->
<div class="grid grid-cols-3 gap-padding-md">
<div class="bg-surface-panel border border-border-muted p-padding-md rounded milled-edge flex items-center gap-padding-md shadow-lg shadow-black/20">
<span class="material-symbols-outlined text-primary p-2 bg-surface-container rounded">factory</span>
<div>
<p class="text-[10px] text-on-surface-variant font-data-label">CURRENT FACTORY</p>
<p class="text-body-md font-headline-md">Main Assembly Alpha</p>
</div>
</div>
<div class="bg-surface-panel border border-border-muted p-padding-md rounded milled-edge flex items-center gap-padding-md shadow-lg shadow-black/20">
<span class="material-symbols-outlined text-primary p-2 bg-surface-container rounded">hub</span>
<div>
<p class="text-[10px] text-on-surface-variant font-data-label">FACTORY NETWORK</p>
<p class="text-body-md font-headline-md">v2.4.1 Stable</p>
</div>
</div>
<div class="bg-surface-panel border border-border-muted p-padding-md rounded milled-edge flex items-center gap-padding-md shadow-lg shadow-black/20">
<span class="material-symbols-outlined text-primary p-2 bg-surface-container rounded">group</span>
<div>
<p class="text-[10px] text-on-surface-variant font-data-label">ACTIVE USERS</p>
<p class="text-body-md font-headline-md">12 / 25 Operators</p>
</div>
</div>
</div>
<!-- Tab Navigation -->
<div class="flex gap-1 bg-surface-container-lowest p-1 rounded w-fit border border-border-muted">
<button class="px-6 py-1.5 rounded text-body-sm font-body-sm text-on-surface-variant hover:text-on-surface transition-all">Factory</button>
<button class="px-6 py-1.5 rounded text-body-sm font-body-sm text-on-surface-variant hover:text-on-surface transition-all">Users</button>
<button class="px-6 py-1.5 rounded text-body-sm font-body-sm bg-surface-container-highest text-primary border border-border-muted shadow-sm">Usage</button>
<button class="px-6 py-1.5 rounded text-body-sm font-body-sm text-on-surface-variant hover:text-on-surface transition-all">Alerts</button>
</div>
</header>
<!-- Usage & Billing Main Grid (50/50 Split) -->
<div class="grid grid-cols-1 lg:grid-cols-2 gap-gutter flex-1">
<!-- Left Panel: Usage Summary -->
<section class="bg-surface-panel border border-border-muted rounded p-gutter flex flex-col gap-gutter milled-edge shadow-xl shadow-black/40">
<div class="flex justify-between items-center">
<h2 class="text-[16px] font-[600] text-on-surface">Usage summary</h2>
<span class="material-symbols-outlined text-on-surface-variant opacity-40">query_stats</span>
</div>
<div class="grid grid-cols-2 gap-padding-md">
<!-- StatCard 1 -->
<div class="bg-surface-container rounded p-padding-md border border-border-muted hover:border-primary/50 transition-colors group">
<p class="text-data-label font-data-label text-on-surface-variant mb-2">Requests used</p>
<div class="flex items-baseline gap-2">
<span class="text-[18px] font-[600] font-data-numeric text-primary">842,109</span>
<span class="text-[11px] font-data-numeric text-primary">↑ 12%</span>
</div>
<div class="mt-4 w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
<div class="bg-primary h-full w-[84%] transition-all duration-1000 shadow-[0_0_8px_rgba(212,157,106,0.5)]"></div>
</div>
</div>
<!-- StatCard 2 -->
<div class="bg-surface-container rounded p-padding-md border border-border-muted hover:border-primary/50 transition-colors group">
<p class="text-data-label font-data-label text-on-surface-variant mb-2">Credits used</p>
<div class="flex items-baseline gap-2">
<span class="text-[18px] font-[600] font-data-numeric text-primary">4,200</span>
<span class="text-[11px] font-data-numeric text-on-surface-variant opacity-40">/ 5,000</span>
</div>
<div class="mt-4 w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
<div class="bg-primary h-full w-[84%] transition-all duration-1000 opacity-60"></div>
</div>
</div>
<!-- StatCard 3 -->
<div class="bg-surface-container rounded p-padding-md border border-border-muted hover:border-primary/50 transition-colors group">
<p class="text-data-label font-data-label text-on-surface-variant mb-2">Request limit</p>
<div class="flex items-baseline gap-2">
<span class="text-[18px] font-[600] font-data-numeric text-primary">1,000,000</span>
</div>
<p class="mt-2 text-[11px] text-on-surface-variant font-body-sm">Hard limit enforced</p>
</div>
<!-- StatCard 4 -->
<div class="bg-surface-container rounded p-padding-md border border-border-muted hover:border-primary/50 transition-colors group">
<p class="text-data-label font-data-label text-on-surface-variant mb-2">Rate limit/min</p>
<div class="flex items-baseline gap-2">
<span class="text-[18px] font-[600] font-data-numeric text-primary">6,000</span>
</div>
<p class="mt-2 text-[11px] text-on-surface-variant font-body-sm">Peak load: 4,821</p>
</div>
</div>
<!-- Decorative Data Visualization (Minor) -->
<div class="mt-auto pt-gutter border-t border-border-muted/50 flex flex-col gap-padding-sm">
<p class="text-data-label font-data-label text-on-surface-variant">24H PERFORMANCE MATRIX</p>
<div class="flex gap-[2px] h-12 items-end">
<div class="bg-surface-container-highest w-full h-[60%] rounded-t-sm"></div>
<div class="bg-primary w-full h-[85%] rounded-t-sm"></div>
<div class="bg-surface-container-highest w-full h-[45%] rounded-t-sm"></div>
<div class="bg-surface-container-highest w-full h-[70%] rounded-t-sm"></div>
<div class="bg-primary w-full h-[95%] rounded-t-sm"></div>
<div class="bg-surface-container-highest w-full h-[55%] rounded-t-sm"></div>
<div class="bg-surface-container-highest w-full h-[40%] rounded-t-sm"></div>
<div class="bg-primary w-full h-[65%] rounded-t-sm opacity-50"></div>
<div class="bg-surface-container-highest w-full h-[30%] rounded-t-sm"></div>
<div class="bg-surface-container-highest w-full h-[50%] rounded-t-sm"></div>
</div>
</div>
</section>
<!-- Right Panel: Billing Status -->
<section class="bg-surface-panel border border-border-muted rounded flex flex-col milled-edge shadow-xl shadow-black/40">
<div class="p-gutter border-b border-border-muted/50 flex justify-between items-center">
<h2 class="text-[16px] font-[600] text-on-surface">Billing status</h2>
<span class="px-2 py-0.5 bg-surface-container rounded text-[10px] font-bold text-primary border border-primary/20">LIVE</span>
</div>
<div class="p-gutter flex flex-col gap-6 flex-1">
<!-- Plan Info Grid -->
<div class="grid grid-cols-2 gap-gutter">
<div>
<p class="text-data-label font-data-label text-on-surface-variant mb-1">Plan</p>
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-primary">token</span>
<span class="text-body-md font-headline-md">Starter Enterprise</span>
</div>
</div>
<div>
<p class="text-data-label font-data-label text-on-surface-variant mb-1">Status</p>
<div class="flex items-center gap-2">
<div class="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
<span class="text-body-md font-headline-md">trialing</span>
</div>
</div>
</div>
<!-- Timestamps Section -->
<div class="flex flex-col gap-padding-md py-padding-md border-y border-border-muted/50">
<div class="flex justify-between items-center">
<span class="text-data-label font-data-label text-on-surface-variant">Trial ends</span>
<span class="font-data-numeric text-[11px] text-primary">2023-11-24 23:59:59 UTC</span>
</div>
<div class="flex justify-between items-center">
<span class="text-data-label font-data-label text-on-surface-variant">Period end</span>
<span class="font-data-numeric text-[11px] text-primary">2023-12-01 00:00:00 UTC</span>
</div>
</div>
<!-- Recent Invoices List (Cinematic Data Table) -->
<div class="flex flex-col gap-padding-sm overflow-hidden">
<p class="text-data-label font-data-label text-on-surface-variant">RECENT INVOICES</p>
<div class="border border-border-muted rounded overflow-hidden">
<div class="grid grid-cols-3 bg-surface-container-highest px-padding-md py-1 border-b border-border-muted/50">
<span class="text-[10px] font-data-label text-on-surface-variant">ID</span>
<span class="text-[10px] font-data-label text-on-surface-variant text-center">DATE</span>
<span class="text-[10px] font-data-label text-on-surface-variant text-right">AMOUNT</span>
</div>
<div class="zebra-row grid grid-cols-3 px-padding-md py-2 items-center">
<span class="font-data-numeric text-[11px] text-on-surface opacity-80">INV-0042</span>
<span class="font-data-numeric text-[11px] text-on-surface opacity-80 text-center">OCT 24</span>
<span class="font-data-numeric text-[11px] text-primary text-right">$0.00</span>
</div>
<div class="zebra-row grid grid-cols-3 px-padding-md py-2 items-center">
<span class="font-data-numeric text-[11px] text-on-surface opacity-80">INV-0041</span>
<span class="font-data-numeric text-[11px] text-on-surface opacity-80 text-center">SEP 24</span>
<span class="font-data-numeric text-[11px] text-primary text-right">$0.00</span>
</div>
</div>
</div>
<!-- Pending Plan Notice Strip -->
<div class="mt-auto bg-surface-container-low border border-border-muted p-padding-md rounded flex items-start gap-padding-md group">
<span class="material-symbols-outlined text-primary mt-0.5">info</span>
<div>
<p class="text-body-sm font-[600] text-primary">Pending plan change</p>
<p class="text-[12px] text-on-surface-variant">Your upgrade to <span class="text-on-surface">Pro Tier</span> is scheduled for the next billing cycle. No immediate action required.</p>
</div>
<button class="ml-auto text-primary opacity-40 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined">close</span>
</button>
</div>
</div>
<!-- Footer Actions -->
<div class="p-gutter border-t border-border-muted/50 flex gap-padding-md justify-end bg-surface-container-lowest rounded-b">
<button class="px-gutter py-2 rounded font-data-label text-data-label border border-border-muted text-on-surface-variant hover:text-on-surface transition-all">Download CSV</button>
<button class="px-gutter py-2 rounded font-data-label text-data-label bg-surface-container-highest border border-primary/40 text-primary hover:border-primary transition-all">Manage Payment</button>
</div>
</section>
</div>
</main>
<!-- Visual Polish: Ambient HUD Effects -->
<div class="fixed bottom-gutter right-gutter z-50 pointer-events-none">
<div class="glass-hud border border-border-muted p-padding-md rounded flex items-center gap-padding-md milled-edge opacity-60">
<div class="w-2 h-2 rounded-full bg-primary animate-ping"></div>
<span class="font-data-numeric text-[11px] text-on-surface tracking-widest uppercase">Encryption Active: AES-256</span>
</div>
</div>
<script>
    // Simple micro-interaction for the progress bars
    document.addEventListener('DOMContentLoaded', () => {
        const bars = document.querySelectorAll('.bg-primary');
        bars.forEach(bar => {
            const width = bar.style.width;
            bar.style.width = '0%';
            setTimeout(() => {
                bar.style.width = width;
            }, 300);
        });
    });
</script>
</body></html>

````