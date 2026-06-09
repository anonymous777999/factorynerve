# Settings: Attendance — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification
# Route: /settings/attendance
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/settings/attendance` |
| Workspace Name | Attendance Administration — Employee Profiles & Shift Templates |
| Operational Role | Enables managers, admins, and owners to configure `EmployeeProfile` records (employee code, department, designation, employment type, reporting manager, default shift, joining date, active status) and manage `ShiftTemplate` records (name, start/end times, grace minutes, OT threshold, cross-midnight flag, default flag). These configurations drive punch validity, late calculation, overtime thresholds, and the live attendance board. |
| Business Impact | If shift templates are misconfigured, every punch time calculation is wrong — late and OT figures are inaccurate across the entire factory. If employee profiles have incorrect departments or designations, attendance reports and review assignments are wrong. This workspace is the operational foundation for the entire attendance domain. |
| User Population | manager, admin, owner. Supervisor+ can access but the `canManageAttendance()` guard requires manager+. |
| Peak Usage Context | On-demand — configuration days (new employee onboarding, shift schedule changes, factory setup). Low-frequency but high-consequence. |
| Predecessor Workspaces | `/settings` (admin navigates from main settings) or direct URL |
| Successor Workspaces | `/attendance/live` or `/attendance/review` (to verify the configuration takes effect) |

### 1.2 Operational Importance

The attendance settings workspace is the configuration layer that makes the entire attendance domain correct. Shift templates define when "late" starts and when overtime begins — a 10-minute grace window vs. a 0-minute grace window changes every late record for every employee on every shift. Employee profiles link factory users to HR metadata (department, designation) that appears on the live board, review queue, and attendance reports. When an employee joins the factory, their profile must be configured here before they can be reliably tracked in the attendance system.

### 1.3 Current State Failures

- Hero section uses `bg-[rgba(20,24,36,0.9)] backdrop-blur shadow-2xl` — identical violation to the `/settings` hero; raw rgba, forbidden backdrop-blur on a static section, arbitrary shadow
- Hero eyebrow uses `text-sm uppercase tracking-[0.3em] text-[var(--accent)]` — tracking 5× the permitted maximum; uppercase on body text; raw alias token; sentence case required
- Hero `h1` uses `text-3xl md:text-4xl` — 30px/36px, far above the 18px ceiling; the mobile size alone is already 12px over; must be `--type-page-title` (18px/600)
- Hero description uses `text-[var(--muted)]` — forbidden alias; must be `text-text-secondary`
- The "Attendance tools" quick-nav section uses `<details>/<summary>` — forbidden pattern (same violation as `/settings` tools section); the two links (Review, Reports) should always be visible
- The `<details>` container uses `bg-[rgba(10,16,26,0.72)]` — raw rgba; must use `surface-panel`
- Status banner uses `bg-[rgba(34,197,94,0.12)] text-emerald-100` and error uses `bg-[rgba(239,68,68,0.12)] text-red-100` — raw rgba backgrounds and raw color classes; must use `status-success-bg/border/fg` and `status-danger-bg/border/fg` semantic tokens
- Tab toggle buttons use raw `bg-[var(--color-text-primary)]` for active state and `text-[var(--color-background-primary)]` for active text — both are legacy alias tokens; must use `surface-selected` or a `surface-elevated` surface with `border-default` for the active tab indicator
- Tab buttons use `text-[var(--color-text-secondary)]` for inactive — legacy alias
- Employee list item (team roster) uses `rounded-[10px] border-[0.5px]` — arbitrary radius and border shorthand; selected state uses `border-[rgb(var(--color-border-info))] bg-[rgb(var(--color-background-info)/0.3)]` — raw RGB computed values using legacy alias tokens; unselected uses `border-[color:var(--color-border-tertiary)]` — legacy alias
- Employee list avatar uses `bg-[rgb(var(--color-background-info))]` and `text-[var(--color-text-info)]` — raw RGB with legacy alias; must use `surface-panel text-text-primary`
- Employee name uses `text-[var(--color-text-primary)]` — legacy alias; must be `text-text-primary`
- Employee sub-info uses `text-[var(--color-text-tertiary)]` — legacy alias; must be `text-text-tertiary`
- Employee active/inactive status dot: active uses `bg-surface-panel` which is NOT a status indicator — a grey dot for "active" is semantically wrong; must use `bg-status-success-icon` for active and `bg-status-danger-icon` for inactive, or use a `StatusDot` component
- CardTitle on both tabs uses `text-xl` (20px) — above the 16px ceiling; same violation as settings page
- Shift template item list uses `border-[rgba(62,166,255,0.45)] bg-[rgba(62,166,255,0.12)]` for selected state — raw rgba blue; must use `surface-selected border-focus`
- Shift template unselected state uses `border-[var(--border)] bg-[var(--card-strong)]` — legacy alias tokens
- Shift template name uses `text-[var(--text)]` — legacy alias; must use `text-text-primary`
- Shift template detail uses `text-[var(--muted)]` — legacy alias; must use `text-text-secondary`
- Checkbox wrapper labels use `border-[0.5px] border-[color:var(--color-border-secondary)]` and `text-[var(--color-text-primary)]` — legacy alias tokens, arbitrary border shorthand
- Checkbox `accent-[var(--color-text-primary)]` — legacy alias; must use `accent-action-primary`
- The loading skeleton uses `rounded-[2rem]` and `rounded-2xl` — arbitrary radius values; must use `rounded-panel`
- The not-signed-in error state uses `text-red-400` — raw color; must use `text-status-danger-fg`
- The access-denied state uses `text-[var(--muted)]` — forbidden alias

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Platform Administration | Inside AppShell, role-gated to manager+; attendance configuration surface |
| Workflow Category | Entry / Record | Two tab-switched configuration editors: employee profile form + shift template form |
| Operational Behavior | Mixed — List-Select-Edit pattern on both tabs | Left: selectable item list; Right: edit form for selected item; identical pattern on both employees and shifts tab |
| Data Density | MEDIUM | Employee list (N users) + profile form (8 fields); Shift list (N templates) + shift form (8 fields + 3 checkboxes) |
| Realtime Complexity | NONE | `Promise.all` of two GET calls on mount; no subscriptions |
| AI Complexity | NONE | No AI systems |
| Audit Complexity | LOW | Backend writes audit events for profile and shift template saves — not surfaced in UI |
| Decision Pressure | LOW | Configuration workspace; deliberate, low-frequency actions; no time pressure |

**Classification Implication:**
A MEDIUM-density, List-Select-Edit workspace inside AppShell means the dominant layout pattern is the two-column selector/editor — a left-panel item list that drives the right-panel edit form. This is the same two-column pattern used by the employees and shifts tabs. Both tabs are structurally identical in their container logic. The primary structural violations are all in the `SettingsAttendancePage` component: the hero section (same gradient/backdrop-blur pattern as main settings), the forbidden `<details>/<summary>` tools section, the pervasive legacy alias token usage, and the semantically incorrect active status dot.

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

| Endpoint | Method | Purpose | Permission | Key Response Fields | Error States |
|---|---|---|---|---|---|
| `GET /attendance/settings/employees` | GET | Lists all `EmployeeProfile` records for the active factory; includes user data (name, role, user_code) joined from User model | manager+ | `[]` of `EmployeeProfileItem` (user_id, user_code, name, email, role, employee_code, department, designation, employment_type, reporting_manager_id, default_shift, joining_date, is_active) | HTTP 403 |
| `POST /attendance/settings/employees` | POST | Creates or updates an `EmployeeProfile` record for the given `user_id` (upsert); writes audit event | manager+ | `EmployeeProfileItem` | HTTP 400 (validation: employee_code format, reporting_manager role check) · HTTP 403 |
| `GET /attendance/settings/shifts` | GET | Lists all `ShiftTemplate` records for the active factory; returns defaults if none exist | manager+ | `[]` of `ShiftTemplateItem` (id, shift_name, start_time, end_time, grace_minutes, overtime_after_minutes, cross_midnight, is_default, is_active) | HTTP 403 |
| `POST /attendance/settings/shifts` | POST | Creates or updates a `ShiftTemplate` (upsert by id; creates new if id=null); writes audit event | manager+ | `ShiftTemplateItem` | HTTP 400 (validation: grace_minutes 0–180, overtime 0–1440, shift_name required) · HTTP 403 |

**Backend constraints:**
- `reporting_manager_id`: must reference a user with role in `REPORTING_MANAGER_ALLOWED_ROLES` (supervisor, manager, admin, owner)
- `employee_code`: validated via `normalize_identifier_code()` — alphanumeric + hyphens only
- `grace_minutes`: 0–180 range enforced (client validates before submit: 0–180)
- `overtime_after_minutes`: 0–1440 range enforced (client: 0–1440)
- Shift templates are factory-scoped; a factory always has templates (defaults are seeded if none exist: morning/evening/night)
- `is_default=true` on a shift template means it is pre-selected for new punch records without an explicit shift specification

### 3.2 Entity Relationship Map

```
Factory (factory_id)
    ├── EmployeeProfile × N (user_id, employee_code, department, designation,
    │         employment_type, reporting_manager_id, default_shift, joining_date, is_active)
    │         └── User (id, name, email, role) ← joined for display
    │
    └── ShiftTemplate × N (id, shift_name, start_time, end_time,
              grace_minutes, overtime_after_minutes, cross_midnight, is_default, is_active)
              ← drives AttendanceRecord.shift resolution and late/OT calculation
```

**Primary entities:** `EmployeeProfile` (employees tab) + `ShiftTemplate` (shifts tab)
**Relationship implication:** The employee form's "Default shift" selector is driven by the shift templates list — it must show available shift names from `ShiftTemplate` records. Shift templates and employee profiles are both factory-scoped; no cross-factory data appears.

### 3.3 Workflow State Machine

**Employees tab:**
```
[LOAD]
  → GET /attendance/settings/employees + GET /attendance/settings/shifts
  → [LOADED] profile list + shift templates (for default_shift options)
  → first profile auto-selected; form pre-populated

[USER SELECT]
  → click list item or change Select → form updates from selected profile
  → [EDITING] user modifies form fields

[SAVE]
  → client validates: employee_code format, reporting_manager_id numeric if provided
  → POST /attendance/settings/employees (upsert)
  → busy=true
      → error → error message shown; form stays open
      → success → status shown; loadAll() refetches list
```

**Shifts tab:**
```
[LOAD] (same data as employees tab — already loaded on mount)

[SHIFT SELECT]
  → click list item or change Select → shiftForm updates from selected template
  → click "New" button → selectedShiftId cleared; form resets to emptyShiftForm()

[SAVE]
  → client validates: grace_minutes 0–180; overtime_after_minutes 0–1440; shift_name non-empty
  → POST /attendance/settings/shifts (upsert; id=null for new)
  → busy=true
      → error → error message shown; form stays open
      → success → status shown; loadAll() refetches list
```

### 3.4 Realtime Contracts
None. `Promise.all` on mount; no subscriptions.

### 3.5 AI System Contracts
Not applicable.

### 3.6 Permission Matrix

| Role | View | Edit profiles | Edit shifts | Can be reporting manager |
|---|---|---|---|---|
| attendance | ✗ | ✗ | ✗ | ✗ |
| operator | ✗ | ✗ | ✗ | ✗ |
| supervisor | ✗ (canManageAttendance requires manager+) | ✗ | ✗ | ✓ (can be assigned as a reporting manager) |
| manager | ✓ | ✓ | ✓ | ✓ |
| admin | ✓ | ✓ | ✓ | ✓ |
| owner | ✓ | ✓ | ✓ | ✓ |

**Note on PRODUCT_WORKSPACE_TOPOLOGY.md:** The topology doc lists `/settings/attendance` as role-gated to `supervisor+` but the current implementation's `canManageAttendance()` function requires manager+. The spec follows the implementation code, not the topology doc classification, as the backend likely enforces manager+. Flag for verification.

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

```
FULL-WIDTH COMMAND with internal two-column LIST-SELECT-EDIT grid (tab-switched)
```

- Inside AppShell (sidebar + topbar present)
- Page container: max-width 1280px, standard AppShell padding
- Page structure:
  1. Page header zone (eyebrow + title + description)
  2. Quick-navigation strip (Review, Reports — always visible)
  3. Status/error message zone (appears when non-null)
  4. Tab selector (Team / Shifts — simple pill tabs)
  5. Tab content: two-column `xl:grid-cols-[0.9fr_1.1fr]` — narrow left (item list) / wider right (edit form)

**Pattern justification:** The List-Select-Edit pattern is the natural fit for both tabs: a scrollable roster of items on the left, with the selected item's detail form on the right. This is an established ERP administration pattern for record management. The left column is intentionally narrower (0.9fr) than the form (1.1fr) because the list items only need to show name + status indicator, while the form needs to render 8 fields.

**Structural reduction note:** The hero section is reduced from a gradient glassmorphism panel to a flat page header. The `<details>/<summary>` quick-nav is eliminated — Review and Reports links should be always visible since they are the validation path after making configuration changes. A supervisor who just updated shift templates should immediately be able to navigate to the live board to see the effect.

---

### 4.2 Zone Definitions

---

#### ZONE: Page Header

| Property | Value |
|---|---|
| Operational Role | Establishes workspace identity for the attendance admin context |
| Attention Priority | 5 |
| Position | top of content area |
| Width | full content width |
| Height | content-driven (~56–72px) |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | Workspace orientation; no gradient or backdrop-blur |

**Contents:**
- Eyebrow: "Attendance admin" — `--type-label-dense` (11px/500/`text-action-primary`/sentence case); NOT `uppercase tracking-[0.3em] text-[var(--accent)]`
- Page title: "Keep roster and shifts ready for review" — `--type-page-title` (18px/600/sentence case); NOT `text-3xl md:text-4xl`
- Subtitle: 14px/400/`text-text-secondary`; NOT `text-[var(--muted)]`
- Surface: `surface-panel` + `border-subtle` — NO `rgba(20,24,36,0.9)`, NO `backdrop-blur`, NO `shadow-2xl`

**Acceptance Criteria:**
- [ ] No backdrop-blur on page header — `surface-panel` + `border-subtle` only
- [ ] Eyebrow at 11px/500/sentence case/`text-action-primary`
- [ ] Title at 18px/600 — NOT text-3xl or text-4xl
- [ ] Description uses `text-text-secondary` — NOT `text-[var(--muted)]`

---

#### ZONE: Quick-Navigation Strip

| Property | Value |
|---|---|
| Operational Role | Fast navigation to adjacent attendance workspaces (Review, Reports) — validation paths after configuration changes |
| Attention Priority | 4 |
| Position | below page header |
| Width | full content width |
| Height | content-driven (~48px) |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | After updating shift templates, admins need immediate access to the live board and review queue to verify the change took effect |

**Contents:**
- "Review" → `/attendance/review` — `Button variant="ghost"` asChild + Link
- "Reports" → `/attendance/reports` — `Button variant="ghost"` asChild + Link
- Container: `surface-panel` + `border-subtle` + `rounded-panel` — ALWAYS VISIBLE; NOT `<details>/<summary>`

**Acceptance Criteria:**
- [ ] Links always visible — NOT inside `<details>/<summary>`
- [ ] Container uses `surface-panel border-subtle` — NOT `rgba(10,16,26,0.72)`
- [ ] Buttons use `Button asChild` + `Link` — NOT `<Link><Button>`

---

#### ZONE: Status / Error Message Bar

| Property | Value |
|---|---|
| Operational Role | Surfaces success and error feedback from form saves |
| Attention Priority | 1 (when visible) |
| Position | below quick-nav strip; above tab selector |
| Width | full content width |
| Height | content-driven when visible; zero-height when null |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | `POST /attendance/settings/employees` and `POST /attendance/settings/shifts` return success/error states |

**Contents:**
- Status (success): `surface-success-bg` + `border-success` + `text-status-success-fg` — NOT `rgba(34,197,94,0.12) text-emerald-100`
- Error: `surface-danger-bg` + `border-danger` + `text-status-danger-fg` — NOT `rgba(239,68,68,0.12) text-red-100`

**Acceptance Criteria:**
- [ ] Status uses `--status-success-bg/border/fg` semantic tokens — NOT raw rgba + emerald
- [ ] Error uses `--status-danger-bg/border/fg` semantic tokens — NOT raw rgba + red
- [ ] Both use `rounded-panel` — NOT arbitrary `rounded-2xl`

---

#### ZONE: Tab Selector

| Property | Value |
|---|---|
| Operational Role | Switches between Team (employee profiles) and Shifts (shift templates) tabs |
| Attention Priority | 3 |
| Position | below status bar; above tab content |
| Width | full content width |
| Height | content-driven (~36px) |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | Two distinct configuration domains (people vs. time) need separate navigation |

**Contents:**
- "Team" button and "Shifts" button
- Active tab: `surface-elevated` bg + `border-default` — NOT `bg-[var(--color-text-primary)] text-[var(--color-background-primary)]`
- Inactive tab: `text-text-secondary` — NOT `text-[var(--color-text-secondary)]` (same value but legacy alias)
- Tab labels: `--type-label` (13px/500/sentence case)

**Acceptance Criteria:**
- [ ] Active tab indicator uses `surface-elevated` + `border-default` — NOT legacy alias background/text swap
- [ ] Inactive tab uses `text-text-secondary` — NOT legacy alias
- [ ] Tab labels sentence case

---

#### ZONE: Employee List Panel (left column, Team tab)

| Property | Value |
|---|---|
| Operational Role | Scrollable roster of all factory employees; click to select and load into the profile editor |
| Attention Priority | 2 |
| Position | left column of employee tab grid |
| Width | ~45% desktop; 100% mobile |
| Height | content-driven; scrollable list |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | `GET /attendance/settings/employees` — the selectable employee roster |

**Contents:**
- Section title: "Factory team" — `--type-panel-title` (16px/600); NOT `text-xl`
- Employee list items (button, each item):
  - Avatar (34×34px): `surface-panel` bg, `rounded-full`, initials in `text-text-primary`; NOT `bg-[rgb(var(--color-background-info))] text-[var(--color-text-info)]`
  - Name: `--type-body` (14px/500/`text-text-primary`); NOT legacy alias
  - Sub-info: role + department — `--type-label-dense` (12px/400/`text-text-tertiary`); NOT legacy alias
  - Active status dot: 7×7px circle — `bg-status-success-icon` when active, `bg-status-paused-icon` when inactive; NOT `bg-surface-panel` (semantically wrong)
  - Selected state: `surface-selected` bg + `border-focus`; NOT raw RGB legacy alias
  - Unselected state: `surface-panel` bg + `border-subtle`; hover: `border-default`
  - Item container: `rounded-control` radius; NOT `rounded-[10px]`

**Acceptance Criteria:**
- [ ] Section title at 16px/600 — NOT text-xl
- [ ] Employee item containers use `rounded-control` — NOT `rounded-[10px]`
- [ ] Selected state uses `surface-selected border-focus` — NOT raw RGB
- [ ] Avatar uses `surface-panel text-text-primary` — NOT raw RGB legacy alias
- [ ] Active dot uses `bg-status-success-icon` — NOT `bg-surface-panel`
- [ ] Inactive dot uses `bg-status-paused-icon` or `bg-status-danger-icon`
- [ ] All text uses canonical `text-text-*` token classes — NOT legacy aliases

---

#### ZONE: Employee Profile Editor (right column, Team tab)

| Property | Value |
|---|---|
| Operational Role | Edit form for the selected employee's attendance profile fields |
| Attention Priority | 1 |
| Position | right column of employee tab grid |
| Width | ~55% desktop; 100% mobile |
| Height | content-driven |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | `POST /attendance/settings/employees` (upsert) — the primary editing surface |

**Contents:**
- Section title: "Profile editor" — `--type-panel-title` (16px/600); NOT `text-xl`
- User selector: Field + Select (all profiles as options, showing name + user_code)
- 2-column form grid:
  - Employee code (text, placeholder "EMP-102")
  - Department (text)
  - Designation (text)
  - Employment type (text — could be Select in future)
  - Default shift (Select — options from shift templates)
  - Joining date (`type="date"`)
  - Reporting manager (Select — options from supervisor/manager/admin/owner profiles)
  - Active status (Select — active / inactive)
- "Save profile" button: `Button variant="primary"`, `isBusy` + `busyLabel="Saving..."`, disabled when no user selected

**Acceptance Criteria:**
- [ ] Section title at 16px/600 — NOT text-xl
- [ ] All field labels use system `Label` primitive at sentence case
- [ ] "Save profile" uses `isBusy` + `busyLabel="Saving..."` — confirmed: already implemented
- [ ] Form uses canonical surface tokens for any container elements

---

#### ZONE: Shift Template List Panel (left column, Shifts tab)

| Property | Value |
|---|---|
| Operational Role | Scrollable list of all shift templates; click to select and load into the shift editor; "New" button clears form for a new template |
| Attention Priority | 2 |
| Position | left column of shifts tab grid |
| Width | ~45% desktop; 100% mobile |
| Height | content-driven |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | `GET /attendance/settings/shifts` — the selectable shift template list |

**Contents:**
- Section title: "Shift templates" — `--type-panel-title` (16px/600); NOT `text-xl`
- "New" button (ghost, top right of card header): clears form for new template creation
- Shift template items (button, each):
  - Shift name: 14px/600/`text-text-primary`; NOT `text-[var(--text)]`
  - Shift detail: start–end | grace Xm | OT after Ym — `--type-label-dense` (12px/400/`text-text-secondary`); NOT `text-[var(--muted)]`
  - Selected state: `surface-selected` bg + `border-focus`; NOT `rgba(62,166,255,...)`
  - Unselected state: `surface-card` bg + `border-subtle`; NOT `bg-[var(--card-strong)] border-[var(--border)]`
  - Container: `rounded-panel`; NOT `rounded-2xl`

**Acceptance Criteria:**
- [ ] Section title at 16px/600 — NOT text-xl
- [ ] Selected state uses `surface-selected border-focus` — NOT raw rgba blue
- [ ] Unselected state uses `surface-card border-subtle` — NOT legacy aliases
- [ ] Containers use `rounded-panel` — NOT `rounded-2xl`
- [ ] Shift name uses `text-text-primary` — NOT `text-[var(--text)]`
- [ ] Shift detail uses `text-text-secondary` — NOT `text-[var(--muted)]`

---

#### ZONE: Shift Template Editor (right column, Shifts tab)

| Property | Value |
|---|---|
| Operational Role | Edit form for the selected shift template or new template creation |
| Attention Priority | 1 |
| Position | right column of shifts tab grid |
| Width | ~55% desktop; 100% mobile |
| Height | content-driven |
| Sticky Behavior | not sticky |
| Density Mode | default |
| Existence Justification | `POST /attendance/settings/shifts` (upsert) — the primary shift editing surface |

**Contents:**
- Section title: "Shift editor" — `--type-panel-title` (16px/600); NOT `text-xl`
- Template selector: Field + Select (create new or pick existing shift)
- 2-column form grid:
  - Shift name (text, required)
  - Grace minutes (number, 0–180)
  - Start time (`type="time"`)
  - End time (`type="time"`)
  - OT after minutes (number, 0–1440)
  - 3 checkbox fields: Cross midnight, Default shift, Active
- Checkbox field pattern:
  - Currently uses raw `<label>` wrapper with arbitrary `rounded-[8px] border-[0.5px] border-[color:var(--color-border-secondary)]` — must use system `Field` + `Label` + `<input type="checkbox">` with `rounded-control border-default`; OR a `Toggle` / `Switch` primitive if available
  - `accent-[var(--color-text-primary)]` — must be `accent-action-primary`
- "Save shift" button: `Button variant="primary"`, `isBusy` + `busyLabel="Saving..."`, disabled when no shift_name; confirmed: already has isBusy

**Acceptance Criteria:**
- [ ] Section title at 16px/600 — NOT text-xl
- [ ] Checkbox containers use `rounded-control border-default` — NOT `rounded-[8px] border-[0.5px] border-legacy-alias`
- [ ] Checkbox `accent` uses `accent-action-primary` — NOT `accent-[var(--color-text-primary)]`
- [ ] All field labels sentence case via system `Label` primitive
- [ ] "Save shift" uses `isBusy` + `busyLabel="Saving..."` — confirmed present; verify pattern

### 4.3 Zone Interaction Rules

```yaml
zone_interactions:
  - trigger: user clicks employee list item (Team tab)
    effect: selectedUserId updates; employeeForm pre-populated from selected profile
    reason: list-select-edit pattern — selection drives the form

  - trigger: user clicks "New" (Shifts tab header)
    effect: selectedShiftId cleared; shiftForm resets to emptyShiftForm()
    reason: allows creating a new shift template from a blank form

  - trigger: user clicks shift template list item (Shifts tab)
    effect: selectedShiftId updates; shiftForm pre-populated from selected template
    reason: list-select-edit pattern

  - trigger: handleEmployeeSave (POST /attendance/settings/employees)
    effect: busy=true; on success → status shown; loadAll() refetches lists;
      on error → error shown; form stays open
    reason: saving employee profile must refresh the roster list

  - trigger: handleShiftSave (POST /attendance/settings/shifts)
    effect: busy=true; on success → status shown; loadAll() refetches lists;
      on error → error shown; form stays open
    reason: saving a shift template must refresh the template list and
      employee "default shift" dropdown (which reads from shiftTemplates)

  - trigger: tab change (Team ↔ Shifts)
    effect: tab state updates; content zone switches; list selections preserved
    reason: switching tabs does not reload data or clear selections
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

### 5.1 Scan Flow

```
SCAN LEVEL 1 (0–200ms): Item list (left column)
  WHY: The list provides roster context — who/what am I about to edit?
  First-loaded state auto-selects the first item, so the form is already
  populated on page load.

SCAN LEVEL 2 (200ms–1s): Selected item form (right column, primary fields)
  WHY: After selecting from the list, the admin scans the form fields.
  Employee code, department, designation are typically the most-edited fields.
  For shifts: shift name, start time, end time, grace minutes.

SCAN LEVEL 3 (1s–3s): Save button
  WHY: After editing one or more fields, the admin clicks Save.
  The button is at the bottom of the form.

SCAN LEVEL 4 (3s+): Quick-nav strip (Review / Reports)
  WHY: Validation path — after saving, the admin navigates to see the change
  reflected in the live board or reports.
```

### 5.2 Persistent Visibility Requirements

The save buttons must be visible without scrolling on standard desktop viewports (form is short enough that this should always hold for the attendance settings forms).

---

## 6. TABLE & DATA STRATEGY

No tables — workspace uses selectable item lists (left column) and edit forms (right column). No tabular data display patterns.

---

## 7. FORM & INPUT STRATEGY

### 7.1 Employee Profile Form Fields

```yaml
employee_form_fields:
  - user_id: driven by Select; required
  - employee_code: text, optional, alphanumeric+hyphens, client validates format
  - department: text, optional
  - designation: text, optional
  - employment_type: text, optional (e.g., "permanent", "contract")
  - default_shift: Select — options from shiftTemplates.shift_name values
  - joining_date: date input, optional
  - reporting_manager_id: Select — options from supervisor/manager/admin/owner profiles
  - is_active: Select — "active" / "inactive"

validation:
  client_on_save:
    - employee_code: validateIdentifierCode() if non-empty
    - reporting_manager_id: must be numeric if provided (parseIntegerField)
  server_side:
    - HTTP 400: employee_code format error
    - HTTP 400: reporting_manager not in allowed roles
```

### 7.2 Shift Template Form Fields

```yaml
shift_form_fields:
  - shift_name: text, required
  - start_time: time input (HH:MM)
  - end_time: time input (HH:MM)
  - grace_minutes: number, 0–180
  - overtime_after_minutes: number, 0–1440
  - cross_midnight: checkbox (boolean)
  - is_default: checkbox (boolean)
  - is_active: checkbox (boolean)

validation:
  client_on_save:
    - shift_name: required, non-empty
    - grace_minutes: parseIntegerField 0–180
    - overtime_after_minutes: parseIntegerField 0–1440
  server_side:
    - HTTP 400: validation errors
```

---

## 8. AI & AUDIT VISIBILITY STRATEGY

Not applicable — no AI systems. Audit events written backend only (not surfaced in UI).

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

### 9.1 Density Mode

```yaml
default_density: default
density_justification: Low-frequency admin configuration; default density provides
  comfortable, error-resistant form interaction.
density_switchable: yes — inherits AppShell density control
```

### 9.2 Spacing Rhythm

```yaml
spacing:
  page_padding: 24px–40px horizontal (AppShell standard), 24px top
  zone_gap: 24px (--space-lg) between all page sections
  column_gap: 24px (--space-lg) between list and form columns
  card_padding: 20px (--space-5)
  form_field_gap: 16px (--space-md)
  list_item_gap: 12px (--space-3)
  list_item_padding: 10px vertical / 14px horizontal
```

### 9.3 Typography Specification

```yaml
typography:
  page_eyebrow: 11px / 500 / sentence case / text-action-primary
  page_title: 18px / 600 / sentence case  (--type-page-title)
  page_subtitle: 14px / 400 / text-text-secondary
  section_title: 16px / 600 / sentence case  (--type-panel-title) — NOT text-xl
  tab_labels: 13px / 500 / sentence case
  employee_name: 14px / 500 / text-text-primary
  employee_sub_info: 12px / 400 / text-text-tertiary
  shift_name: 14px / 600 / text-text-primary
  shift_detail: 12px / 400 / text-text-secondary
  form_label: 13px / 500 / sentence case (system Label primitive)
  status_message: 13px / 400 / text-status-success-fg
  error_message: 13px / 400 / text-status-danger-fg
```

### 9.4 Surface Token Hierarchy

```yaml
surfaces:
  page_background: var(--surface-shell)
  page_header: var(--surface-panel) + border-subtle  — NOT rgba backdrop-blur
  quick_nav: var(--surface-panel) + border-subtle
  section_card: var(--surface-card) + border-subtle
  list_item_unselected: var(--surface-panel) + border-subtle
  list_item_selected: var(--surface-selected) + border-focus
  list_item_hover: border-default
  employee_avatar: var(--surface-panel) — rounded-full
  active_status_dot: var(--status-success-icon)
  inactive_status_dot: var(--status-paused-icon)
  checkbox_container: var(--surface-elevated) + border-default + rounded-control
  status_success: var(--status-success-bg) + border-success + text-status-success-fg
  status_error: var(--status-danger-bg) + border-danger + text-status-danger-fg
```

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

### 10.1 Desktop (Primary)

```yaml
desktop:
  min_width: 1280px
  layout: xl:grid-cols-[0.9fr_1.1fr] — list left, form right
  max_content_width: 1280px
```

### 10.2 Mobile

```yaml
mobile:
  width_range: <768px
  layout: stacked — list above, form below
  form_grid: 2-col → 1-col on mobile
  touch_targets: all buttons and list items ≥44px height
```

---

## 11. COMPONENT MAPPING

```yaml
component_mapping:
  workspace_container:
    component: <main> inside AppShell
    max_width: 1280px

  page_header:
    component: inline semantic HTML (no SettingsShell — standalone page)
    critical_fix: Remove backdrop-blur + rgba + shadow; fix eyebrow/title/description tokens

  quick_nav_strip:
    component: inline <div> with surface-panel border-subtle
    critical_fix: Remove <details>/<summary> → always-visible with Button asChild + Link ×2

  status_error_bar:
    component: StatusMessage or inline <div> with semantic token classes
    critical_fix: Replace raw rgba + raw color classes with status-success/danger tokens

  tab_selector:
    component: inline <div> with two <button> elements
    critical_fix: Active state → surface-elevated + border-default; NOT legacy alias background
    active_style: surface-elevated bg + border-default; text-text-primary
    inactive_style: text-text-secondary; hover: text-text-primary

  employee_list:
    component: Card (surface-card border-subtle)
    list_items: <button> elements with surface-panel/surface-selected states
    critical_fixes:
      - Container: rounded-control NOT rounded-[10px]
      - Selected: surface-selected + border-focus NOT raw RGB
      - Avatar: surface-panel text-text-primary NOT raw RGB legacy alias
      - Status dot: status-success-icon / status-paused-icon NOT surface-panel

  employee_form:
    component: Card (surface-card border-subtle)
    field_primitives: [Field, Label, Input, Select]
    critical_fix: All section titles from text-xl to --type-panel-title (16px/600)

  shift_list:
    component: Card (surface-card border-subtle)
    list_items: <button> elements with surface-card/surface-selected states
    critical_fixes:
      - Selected: surface-selected + border-focus NOT raw rgba blue
      - Unselected: surface-card + border-subtle NOT var(--card-strong)/var(--border)
      - Container: rounded-panel NOT rounded-2xl
      - Text: text-text-primary/secondary NOT text-[var(--text)]/text-[var(--muted)]

  shift_form:
    component: Card (surface-card border-subtle)
    field_primitives: [Field, Label, Input, Select]
    checkbox_fields:
      current: raw <label> wrapper with arbitrary border/radius/legacy alias
      required: Field + Label + <input type="checkbox"> with rounded-control border-default
                OR Switch/Toggle primitive if available in component library
    critical_fix:
      - Checkbox containers: rounded-control border-default NOT rounded-[8px] border-[0.5px] legacy
      - accent: accent-action-primary NOT accent-[var(--color-text-primary)]
      - Section title: 16px/600 NOT text-xl

  action_buttons:
    - Save profile: Button variant="primary" isBusy busyLabel="Saving..." — already correct
    - Save shift: Button variant="primary" isBusy busyLabel="Saving..." — already correct
    - New (shift): Button variant="ghost"
    - Review link: Button variant="ghost" asChild + Link href="/attendance/review"
    - Reports link: Button variant="ghost" asChild + Link href="/attendance/reports"

  loading_state:
    component: Skeleton
    critical_fix: rounded-panel NOT rounded-[2rem] / rounded-2xl

  error_states:
    - not_signed_in: StatusMessage variant="error" + Link to /access
      fix: text-red-400 → text-status-danger-fg; <Link><Button> → Button asChild
    - access_denied: StatusMessage + Link to /attendance
      fix: text-[var(--muted)] → text-text-secondary; <Link><Button> → Button asChild
```

---

## 12. OPERATIONAL PROBLEMS SOLVED

```yaml
problem_resolutions:
  - problem: Hero section backdrop-blur + rgba + shadow-2xl — same pattern as /settings hero
    root_cause: Component copied the SettingsShell glassmorphism hero pattern; backdrop-blur
      on a static section is explicitly forbidden
    structural_solution: Section 9.4 specifies page_header as surface-panel + border-subtle;
      Section 4.2 page header zone requires no backdrop-blur/rgba/shadow
    section_reference: Section 9.4, Section 4.2
    measurable_outcome: Attendance admin page header is a flat surface-panel; consistent
      with /settings page after its fix is applied

  - problem: h1 uses text-3xl md:text-4xl — up to 36px, double the 18px ceiling
    root_cause: Arbitrary responsive Tailwind heading scale; same root cause as all
      Phase A heading violations
    structural_solution: Section 9.3 specifies page_title at 18px/600; Section 4.2 acceptance criteria
    section_reference: Section 9.3, Section 4.2
    measurable_outcome: Heading at 18px on all viewports

  - problem: <details>/<summary> for "Attendance tools" quick nav
    root_cause: Same pattern as /settings "Admin tools"; developer used disclosure to
      keep the hero compact
    structural_solution: Section 4.2 quick-navigation strip is always-visible;
      Section 11 specifies Button asChild + Link for Review and Reports
    section_reference: Section 4.2, Section 11
    measurable_outcome: Review and Reports links always visible; admin can immediately
      navigate to validate configuration changes

  - problem: Status/error banners use raw rgba + emerald/red color classes
    root_cause: Inline status feedback implemented with raw rgba borders + Tailwind
      color classes instead of semantic token system
    structural_solution: Section 9.4 specifies status_success/error using semantic tokens;
      Section 4.2 status bar zone acceptance criteria require semantic tokens
    section_reference: Section 9.4, Section 4.2
    measurable_outcome: Status and error banners use status-success-bg/fg/border and
      status-danger-bg/fg/border — fully token-compliant

  - problem: Employee active status dot uses bg-surface-panel — wrong semantic meaning
    root_cause: Developer used a "neutral" surface background for the active indicator;
      surface-panel is grey/neutral — it communicates "neutral/inactive" not "active"
    structural_solution: Section 9.4 specifies active_status_dot as status-success-icon;
      Section 4.2 employee list acceptance criteria require status-success-icon for active
      and status-paused-icon for inactive
    section_reference: Section 9.4, Section 4.2
    measurable_outcome: Active employees show a green status dot (status-success-icon);
      inactive employees show a muted/paused dot; the semantic is correct

  - problem: All text and surface references use legacy alias tokens throughout the component
    root_cause: Component was built using the legacy --color-* alias system;
      var(--color-text-primary), var(--color-background-info), var(--color-border-secondary),
      var(--text), var(--muted), var(--border), var(--card-strong), var(--accent) all appear
    structural_solution: Section 9.4 maps every surface to canonical token;
      Section 9.3 maps every text style to canonical token class;
      Section 11 component mapping specifies canonical classes for each element
    section_reference: Section 9.3, Section 9.4, Section 11
    measurable_outcome: Zero legacy alias token references in the component

  - problem: Shift template selected state uses raw rgba blue (rgba(62,166,255,...))
    root_cause: A specific brand blue was hard-coded for the selection state instead
      of using the canonical surface-selected + border-focus pattern
    structural_solution: Section 4.2 shift list zone specifies surface-selected + border-focus
      for selected state; Section 9.4 confirms these are the correct tokens
    section_reference: Section 4.2, Section 9.4
    measurable_outcome: Selected shift template uses surface-selected + border-focus;
      consistent with every other selection-state in the system

  - problem: CardTitle uses text-xl (20px) on both tabs — above 16px ceiling
    root_cause: Same pattern flagged across all Phase A admin pages
    structural_solution: Section 9.3 specifies section_title at 16px/600;
      Section 4.2 all zone acceptance criteria require 16px
    section_reference: Section 9.3, Section 4.2
    measurable_outcome: All section titles at 16px/600
```

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

```yaml
implementation_sequence:
  step_1: Fix page header — remove backdrop-blur/rgba/shadow;
    replace with surface-panel + border-subtle; fix eyebrow and h1 typography
  step_2: Remove <details>/<summary> from quick-nav; replace with always-visible
    flex row using Button asChild + Link for Review and Reports
  step_3: Fix status and error banners — replace raw rgba + raw color classes with
    status-success and status-danger semantic token classes
  step_4: Fix tab selector active/inactive state — surface-elevated + border-default
    for active; text-text-secondary for inactive; remove legacy alias tokens
  step_5: Fix employee list items — surface-selected/border-focus for selected;
    surface-panel/border-subtle for unselected; rounded-control radius;
    avatar: surface-panel text-text-primary; status dot: status-success-icon/paused-icon
  step_6: Fix shift template list items — surface-selected/border-focus for selected;
    surface-card/border-subtle for unselected; rounded-panel radius;
    text-text-primary/secondary for name/detail
  step_7: Fix all CardTitle from text-xl to 16px/600 (--type-panel-title)
  step_8: Fix checkbox field containers from legacy alias + arbitrary border/radius
    to rounded-control + border-default; accent-action-primary on inputs
  step_9: Fix loading skeletons from rounded-[2rem]/rounded-2xl to rounded-panel
  step_10: Fix not-signed-in and access-denied error states — StatusMessage with
    semantic tokens; Button asChild + Link
  step_11: Fix all remaining legacy alias token references throughout the component
  step_12: Verify responsive layout — 2-col list/form collapses to stacked on mobile;
    touch targets ≥44px
```

### 13.2 Critical Constraints

```yaml
critical_constraints:
  - "The isBusy pattern is already implemented on both Save buttons — preserve this;
     do not regress to disabled-only pattern during the token migration"
  - "Employee 'Default shift' selector options come from shiftTemplates state —
     this reactive dependency must be preserved when fixing the Select component"
  - "The grace_minutes and overtime_after_minutes client validation (parseIntegerField)
     must remain before the POST call — prevents invalid integer round-trips"
  - "Employee code validation (validateIdentifierCode) must remain before POST"
  - "Status dot semantic fix: active = status-success-icon, NOT a neutral grey surface"
  - "All surfaces must reference CSS token variables — no hex, no rgba, no legacy aliases"
```

### 13.3 Open Questions

```yaml
open_questions:
  - question: >
      The PRODUCT_WORKSPACE_TOPOLOGY.md classifies /settings/attendance as role-gated to
      supervisor+, but the implementation's canManageAttendance() function requires manager+.
      Which is the correct minimum role? If supervisor can access this page, the backend
      must also enforce supervisor+ on the attendance settings endpoints.
    blocking: no — the implementation's manager+ gate is functional and conservative;
      a role expansion to supervisor would require backend endpoint permission changes
    owner: product owner / backend team
    decision_needed_by: informational

  - question: >
      The checkbox fields (Cross midnight, Default shift, Active) are implemented as raw
      <label>/<input type="checkbox"> wrappers with inline styling. Does a Toggle or Switch
      primitive exist in the shared component library (web/src/components/ui/) that should
      be used instead?
    blocking: no — the current checkbox pattern is functional; using a system Toggle
      would improve consistency with the component library
    owner: frontend team
    decision_needed_by: before step_8

open_questions_blocking: none
```

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections fully populated
- [x] Every zone has documented existence justification and testable acceptance criteria
- [x] Every component mapped to existing primitives; all critical fixes identified
- [x] Every operational failure from Section 1.3 has a resolution in Section 12
- [x] Reduction audit: <details>/<summary> removed; backdrop-blur hero reduced;
      semantically wrong status dot corrected
- [x] No anti-patterns in spec (no raw rgba, no raw hex, no backdrop-blur, no uppercase labels)
- [x] All spacing follows 4px scale
- [x] All surfaces reference token variables
- [x] Typography follows approved system
- [x] Backend API surface verified from attendance.ts (4 endpoints confirmed)
- [x] Permission matrix complete (manager+ for configuration)
- [x] Open questions populated; none blocking
- [x] 12-step implementation sequence complete

---

## POST-GENERATION SELF-VALIDATION

```yaml
self_validation:
  operational_integrity:
    - [x] All zones traced to backend entities (EmployeeProfile / ShiftTemplate)
    - [x] Every zone justified by operator need
    - [x] No decorative zones; hero reduced to flat header
    - [x] Removed elements documented: backdrop-blur, shadow-2xl, text-3xl/text-4xl,
          text-xl ×4, <details>/<summary>, raw rgba ×6, raw color classes ×8,
          legacy alias tokens throughout, wrong status dot semantic

  law_compliance:
    - [x] Spacing 4px scale (12px, 16px, 20px, 24px)
    - [x] All surfaces canonical token variables
    - [x] All labels sentence case — no uppercase labels in spec
    - [x] Typography from approved system (11px/500, 12px/400, 13px/500, 14px/500, 16px/600, 18px/600)
    - [x] No AI elements

  kiro_readiness:
    - [x] 12-step implementation sequence
    - [x] All acceptance criteria testable
    - [x] No blocking open questions

  anti_pattern_check:
    - [x] No gradients
    - [x] No glow or backdrop-blur
    - [x] No uppercase labels
    - [x] No marketing typography
    - [x] No <details>/<summary>
    - [x] No raw hex / rgba / RGB
    - [x] No legacy alias tokens in spec

  structural_integrity:
    - [x] Zone interactions cover list-select-edit pattern for both tabs
    - [x] Permission matrix complete (manager+)
    - [x] Responsive layout defined
    - [x] All problem resolutions reference specific spec sections
    - [x] Status dot semantic correction documented with rationale
```

---

## 14. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

---

### 14A. Desktop Structural Blueprint

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│  APP SHELL (sidebar + topbar) — context only                                             │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  ATTENDANCE ADMIN WORKSPACE  max-w-[1280px] centered  px-6 md:px-10 py-6               │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐  │
│  │  PAGE HEADER          surface-panel / border-subtle                                │  │
│  │  "Attendance admin"   11px/500/text-action-primary/sentence case                  │  │
│  │  "Keep roster and shifts ready for review"  18px/600  — NOT text-3xl              │  │
│  │  [subtitle]  14px/400/text-text-secondary  — NOT text-[var(--muted)]             │  │
│  │  NO backdrop-blur / NO rgba / NO shadow-2xl                                      │  │
│  └────────────────────────────────────────────────────────────────────────────────────┘  │
│  ↕ 24px                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐  │
│  │  QUICK-NAV STRIP      surface-panel / border-subtle                                │  │
│  │  [Review] [Reports]   — ALWAYS VISIBLE — NOT <details>/<summary>                  │  │
│  │  Button variant=ghost asChild + Link                                               │  │
│  └────────────────────────────────────────────────────────────────────────────────────┘  │
│  ↕ 24px (conditional — only when status/error non-null)                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐  │
│  │  STATUS/ERROR BAR (conditional)                                                    │  │
│  │  Status: status-success-bg / border-success / text-status-success-fg              │  │
│  │  Error:  status-danger-bg  / border-danger  / text-status-danger-fg               │  │
│  │  NOT raw rgba + raw color classes                                                  │  │
│  └────────────────────────────────────────────────────────────────────────────────────┘  │
│  ↕ 24px                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐  │
│  │  TAB SELECTOR                                                                      │  │
│  │  [Team]  [Shifts]                                                                  │  │
│  │  Active: surface-elevated + border-default + text-text-primary                    │  │
│  │  Inactive: text-text-secondary                                                     │  │
│  │  NOT bg-[var(--color-text-primary)] legacy background swap                        │  │
│  └────────────────────────────────────────────────────────────────────────────────────┘  │
│  ↕ 24px                                                                                  │
│  ╔════════════════════════════════════════════════════════════════════════════════════╗  │
│  ║  TEAM TAB:  xl:grid-cols-[0.9fr_1.1fr]  gap-6                                    ║  │
│  ║  ┌───────────────────────────────┐  ┌─────────────────────────────────────────┐  ║  │
│  ║  │ EMPLOYEE LIST [P:2]           │  │ PROFILE EDITOR [P:1]                    │  ║  │
│  ║  │ surface-card / border-subtle  │  │ surface-card / border-subtle            │  ║  │
│  ║  │ "Factory team" 16px/600       │  │ "Profile editor" 16px/600              │  ║  │
│  ║  │                               │  │                                         │  ║  │
│  ║  │ [employee item buttons]       │  │ Team member Select (all users)          │  ║  │
│  ║  │  ┌─────────────────────────┐  │  │ 2-col grid:                             │  ║  │
│  ║  │  │ [avatar] Name           │  │  │  Employee code | Department             │  ║  │
│  ║  │  │ [●] role · dept         │  │  │  Designation   | Employment type        │  ║  │
│  ║  │  │ active dot: success-icon│  │  │  Default shift | Joining date           │  ║  │
│  ║  │  │ selected: surface-sel   │  │  │  Reporting mgr | Active status          │  ║  │
│  ║  │  │ unselected: surface-pan │  │  │                                         │  ║  │
│  ║  │  │ radius: rounded-control │  │  │ [Save profile] variant=primary isBusy  │  ║  │
│  ║  │  └─────────────────────────┘  │  └─────────────────────────────────────────┘  ║  │
│  ║  └───────────────────────────────┘                                                ║  │
│  ║                                                                                    ║  │
│  ║  SHIFTS TAB:  xl:grid-cols-[0.9fr_1.1fr]  gap-6                                  ║  │
│  ║  ┌───────────────────────────────┐  ┌─────────────────────────────────────────┐  ║  │
│  ║  │ SHIFT LIST [P:2]              │  │ SHIFT EDITOR [P:1]                      │  ║  │
│  ║  │ surface-card / border-subtle  │  │ surface-card / border-subtle            │  ║  │
│  ║  │ "Shift templates" 16px/600    │  │ "Shift editor" 16px/600                │  ║  │
│  ║  │              [New] ghost btn  │  │                                         │  ║  │
│  ║  │                               │  │ Template Select                         │  ║  │
│  ║  │ [shift item buttons]          │  │ 2-col grid:                             │  ║  │
│  ║  │  ┌─────────────────────────┐  │  │  Shift name | Grace minutes             │  ║  │
│  ║  │  │ Shift name 14px/600     │  │  │  Start time | End time                  │  ║  │
│  ║  │  │ detail 12px/400/sec     │  │  │  OT after mins | [3 checkboxes]         │  ║  │
│  ║  │  │ selected: surface-sel   │  │  │                                         │  ║  │
│  ║  │  │  + border-focus         │  │  │ Checkboxes: rounded-control border-def  │  ║  │
│  ║  │  │ NOT rgba blue           │  │  │  accent-action-primary                  │  ║  │
│  ║  │  │ unselected: surface-card│  │  │                                         │  ║  │
│  ║  │  │  + border-subtle        │  │  │ [Save shift] variant=primary isBusy    │  ║  │
│  ║  │  │ radius: rounded-panel   │  │  └─────────────────────────────────────────┘  ║  │
│  ║  │  └─────────────────────────┘  │                                                ║  │
│  ║  └───────────────────────────────┘                                                ║  │
│  ╚════════════════════════════════════════════════════════════════════════════════════╝  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 14B. Visual Attention Flow Map

```
SCAN 1 (0–200ms): Item list (left column)
  First-loaded state auto-selects item 1; form already populated.
  Admin scans the list to confirm they're editing the right employee/shift.

SCAN 2 (200ms–1s): Selected item form (right column)
  After confirming the selection, admin scans form fields.
  Most common edits: employee code, department, designation (employees);
  shift name, start/end time, grace minutes (shifts).

SCAN 3 (1s–3s): Save button
  Single primary CTA at the bottom of the form; isBusy on click.

SCAN 4 (3s+): Quick-nav strip
  After saving, admin navigates to Review or Reports to validate the change.
  The strip is persistently visible and low-effort to reach.
```

---

### 14C. Spacing & Rhythm Visualization

```
DENSE: List items (12px gap; 10px/14px padding) — roster needs compact presentation
BREATHABLE: Form (16px field gaps; 20px card padding) — editing needs clear separation
VISUAL SILENCE: 24px gap between header/nav/tabs/content creates clear domain transitions
```

---

### 14D. Component Nesting Hierarchy

```
<main> (AppShell frame, max-w-1280px)
  ├── PageHeader (surface-panel/border-subtle — NOT rgba backdrop-blur)
  │     ├── Eyebrow (11px/500/action-primary/sentence)
  │     ├── <h1> (18px/600)
  │     └── Subtitle (14px/400/text-secondary)
  ├── QuickNavStrip (surface-panel/border-subtle — NOT <details>)
  │     └── Button ghost asChild + Link × 2
  ├── StatusBar (conditional — status-success or status-danger semantic tokens)
  ├── TabSelector
  │     ├── TabButton "Team" (surface-elevated/border-default when active)
  │     └── TabButton "Shifts" (surface-elevated/border-default when active)
  │
  ├── TeamTabContent (conditional on tab="employees")
  │     └── Grid (xl:grid-cols-[0.9fr_1.1fr])
  │           ├── EmployeeListCard (surface-card/border-subtle)
  │           │     └── EmployeeItem × N (button)
  │           │           ├── Avatar (surface-panel/rounded-full)
  │           │           ├── Name (14px/500/text-primary)
  │           │           ├── SubInfo (12px/400/text-tertiary)
  │           │           └── StatusDot (status-success-icon or status-paused-icon)
  │           └── ProfileEditorCard (surface-card/border-subtle)
  │                 ├── UserSelect + Field × 8 (system Label + Input/Select)
  │                 └── Button variant="primary" isBusy "Save profile"
  │
  └── ShiftsTabContent (conditional on tab="shifts")
        └── Grid (xl:grid-cols-[0.9fr_1.1fr])
              ├── ShiftListCard (surface-card/border-subtle)
              │     ├── NewButton (ghost)
              │     └── ShiftItem × N (button)
              │           ├── ShiftName (14px/600/text-primary)
              │           └── ShiftDetail (12px/400/text-secondary)
              └── ShiftEditorCard (surface-card/border-subtle)
                    ├── TemplateSelect + Field × 5
                    ├── CheckboxField × 3 (rounded-control/border-default/accent-action-primary)
                    └── Button variant="primary" isBusy "Save shift"
```

---

### 14E. Responsive Blueprint

```
1280px+ (Desktop):
┌──────────────────────────────────────────────────────────────────────┐
│  PageHeader (full width)                                             │
│  QuickNavStrip (full width)                                          │
│  TabSelector                                                         │
├─────────────────────────────┬────────────────────────────────────────┤
│  ITEM LIST (0.9fr)           │  EDIT FORM (1.1fr)                    │
│  Employee or shift list      │  Profile or shift editor              │
└─────────────────────────────┴────────────────────────────────────────┘

<768px (Mobile — stacked):
┌──────────────────────────────────────┐
│  PageHeader                          │
│  QuickNavStrip                       │
│  TabSelector                         │
├──────────────────────────────────────┤
│  ITEM LIST (full width)              │
├──────────────────────────────────────┤
│  EDIT FORM (full width)              │
│  2-col form grid → 1-col            │
└──────────────────────────────────────┘
```

---

### 14F. Structural Consistency Validation

```yaml
structural_validation:
  - [x] All zones justified by operational necessity
  - [x] Visual dominance: edit form (P:1) and item list (P:2) correct per tab
  - [x] Spacing rhythm follows density specs
  - [x] Responsive adaptations preserve all actions on mobile
  - [x] Component nesting hierarchy matches Section 11
  - [x] Two-column list/form is minimum required for this list-select-edit pattern
  - [x] No redundant information surfaces
  - [x] Blueprint matches FULL-WIDTH COMMAND with LIST-SELECT-EDIT grid (Section 4.1)
```

---

## KIRO TASK CHAINING

```yaml
downstream_kiro_tasks:
  task_1:
    name: "Settings Attendance — Page Header + Quick Nav Fix"
    input: This spec → Section 4.2 (Page Header, Quick-Nav), Section 9.4, Section 12
    output: Backdrop-blur/rgba removed; eyebrow/h1 fixed; <details>/<summary> removed;
      Review + Reports always visible

  task_2:
    name: "Settings Attendance — Status Banners + Tab Selector Fix"
    input: This spec → Section 4.2 (Status Bar, Tab Selector), Section 9.4
    output: Status/error banners use status-success/danger semantic tokens;
      active tab uses surface-elevated + border-default — NOT legacy alias background swap

  task_3:
    name: "Settings Attendance — Employee List + Status Dot Fix"
    input: This spec → Section 4.2 (Employee List), Section 9.4, Section 12
    output: List items use surface-selected/border-focus selection; rounded-control radius;
      avatar uses surface-panel; status dot uses status-success-icon (NOT surface-panel)

  task_4:
    name: "Settings Attendance — Shift List Fix"
    input: This spec → Section 4.2 (Shift List), Section 9.4
    output: Selected state surface-selected/border-focus (NOT raw rgba blue);
      unselected surface-card/border-subtle (NOT legacy aliases);
      text uses text-text-primary/secondary

  task_5:
    name: "Settings Attendance — CardTitle + Checkbox + Legacy Token Cleanup"
    input: This spec → Section 4.2 (all zones), Section 9.3, Section 9.4, Section 11
    output: All CardTitle at 16px/600; checkbox containers use rounded-control/border-default;
      accent-action-primary; all remaining legacy alias tokens eliminated
```

---

*End of WORKSPACE_SKELETON_SETTINGS_ATTENDANCE.md (Sections 1–14)*
*This file is system-generated architecture. Treat as engineering law until formally amended.*
*Architectural precedent established: List-Select-Edit pattern for admin record management
(item list left → edit form right); status dot semantic correction (active=status-success-icon,
NOT a neutral surface color); attendance settings role gate documented as manager+
(implementation) vs supervisor+ (topology doc) with open question logged;
isBusy already correctly implemented on Save buttons — preserve during migration*

### CODE
````
<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Attendance Operations | FactoryNerve OS</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@300;400;500;600;700&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<style>
        :root {
            --surface-primary: #0F1115;
            --surface-secondary: #161B22;
            --surface-accent: #1C2128;
            --border-primary: rgba(255, 255, 255, 0.06);
            --accent-soft: rgba(184, 134, 11, 0.1);
        }
        body {
            background-color: var(--surface-primary);
            background-image: 
                radial-gradient(circle at 50% 0%, rgba(30, 41, 59, 0.15) 0%, transparent 80%),
                linear-gradient(rgba(255, 255, 255, 0.01) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.01) 1px, transparent 1px);
            background-size: 100% 100%, 32px 32px, 32px 32px;
            font-family: 'Hanken Grotesk', sans-serif;
            -webkit-font-smoothing: antialiased;
            color: #d3e4fe;
            overflow: hidden;
        }
        .mono-data { font-family: 'JetBrains Mono', monospace; }

        .industrial-shell {
            background: #111418;
            border-bottom: 1px solid var(--border-primary);
        }

        .workspace-surface {
            background: #161B22;
            border: 1px solid var(--border-primary);
            box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
        }

        .panel-divider {
            border-right: 1px solid var(--border-primary);
        }

        .interactive-card {
            transition: background 0.2s ease, border-color 0.2s ease;
        }
        .interactive-card:hover {
            background: rgba(255, 255, 255, 0.02);
            border-color: rgba(255, 255, 255, 0.1);
        }

        .premium-btn {
            background: #c6c6cc;
            color: #0F1115;
            transition: all 0.2s ease;
        }
        .premium-btn:hover {
            background: #ffffff;
            transform: translateY(-1px);
        }

        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #30363D; border-radius: 10px; }

        input, select {
            background: #0F1115 !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        input:focus, select:focus {
            border-color: #c6c6cc !important;
            box-shadow: 0 0 0 2px rgba(198, 198, 204, 0.1) !important;
            outline: none;
        }
    </style>
<script id="tailwind-config">
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              colors: {
                "background": "#0F1115",
                "surface-panel": "#161B22",
                "on-surface": "#D3E4FE",
                "on-surface-variant": "#8B949E",
                "border-muted": "rgba(255,255,255,0.06)",
                "data-accent": "#B8860B",
                "primary": "#C6C6CC"
              }
            }
          }
        }
    </script>
</head>
<body class="min-h-screen">
<!-- Top Navigation -->
<header class="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 h-14 industrial-shell">
<div class="flex items-center gap-12">
<div class="flex items-center gap-3">
<div class="w-2 h-2 bg-primary rounded-full"></div>
<span class="text-base font-bold tracking-tight text-on-surface">FactoryNerve <span class="text-on-surface-variant font-normal">OS 4.0</span></span>
</div>
<nav class="hidden md:flex gap-8 h-14 items-center">
<a class="text-[13px] font-medium text-on-surface-variant hover:text-on-surface transition-colors" href="#">Dashboard</a>
<a class="text-[13px] font-medium text-on-surface-variant hover:text-on-surface transition-colors" href="#">Analytics</a>
<a class="text-[13px] font-medium text-on-surface-variant hover:text-on-surface transition-colors" href="#">Assets</a>
<a class="text-[13px] font-semibold text-on-surface border-b-2 border-primary py-[17px]" href="#">Governance</a>
</nav>
</div>
<div class="flex items-center gap-6">
<div class="flex items-center gap-2 px-3 py-1 bg-white/[0.03] border border-white/5 rounded">
<span class="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></span>
<span class="text-[11px] font-medium text-on-surface-variant">System status: Normal</span>
</div>
<div class="flex gap-5 text-on-surface-variant">
<span class="material-symbols-outlined text-xl cursor-pointer hover:text-on-surface transition-colors">notifications</span>
<span class="material-symbols-outlined text-xl cursor-pointer hover:text-on-surface transition-colors">settings</span>
</div>
<img alt="User" class="w-8 h-8 rounded-full border border-white/10" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAXCVQWf-hx9wEt4ARF1qhYLoBojF3DTNBeuDBSMQgPYYWX7H4bZxdL0sVDoRvyXhyYgvYS3bbt8t_jmT0DrkDMMhHtCRmc6lvjj97V7EDcFyxliUmpVuwz5pGlqoVOp2DzGPQfvhyFS41pjwJxGikiZvBKKivA87yfYcBg3YgED_nooWfB7RmzwLpkkK_oBGYpeJUv-Dn95JkB2VmwMCUU7i7RCz6OC5Kim7sPH_Pz8-AkMS9jcG1eYImk-n9OJYHuT7ewNS2nhec"/>
</div>
</header>
<!-- Sidebar -->
<aside class="fixed left-0 top-14 bottom-0 w-64 flex flex-col p-6 gap-2 z-40 bg-background border-r border-border-muted">
<div class="mb-6 px-2">
<p class="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Operations Center</p>
<p class="text-[12px] mono-data text-data-accent opacity-80">alpha-reg-04</p>
</div>
<nav class="space-y-1">
<a class="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.02] rounded-md transition-all group" href="#">
<span class="material-symbols-outlined text-lg">shield</span>
<span class="text-[14px]">Security</span>
</a>
<a class="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.02] rounded-md transition-all group" href="#">
<span class="material-symbols-outlined text-lg">lan</span>
<span class="text-[14px]">Network</span>
</a>
<a class="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.02] rounded-md transition-all group" href="#">
<span class="material-symbols-outlined text-lg">memory</span>
<span class="text-[14px]">Infrastructure</span>
</a>
<a class="flex items-center gap-3 px-3 py-2 bg-white/[0.04] text-on-surface rounded-md border-l-2 border-primary" href="#">
<span class="material-symbols-outlined text-lg">admin_panel_settings</span>
<span class="text-[14px] font-medium">Access Control</span>
</a>
</nav>
<div class="mt-auto pt-6 border-t border-border-muted">
<button class="w-full py-2.5 bg-white/5 hover:bg-white/10 text-on-surface rounded-md text-[13px] font-semibold transition-all mb-4">
            Refresh Data
        </button>
<div class="flex justify-center gap-6 px-2 opacity-40">
<span class="material-symbols-outlined text-lg cursor-pointer hover:opacity-100">terminal</span>
<span class="material-symbols-outlined text-lg cursor-pointer hover:opacity-100">description</span>
<span class="material-symbols-outlined text-lg cursor-pointer hover:opacity-100">help_outline</span>
</div>
</div>
</aside>
<!-- Main Content Area -->
<main class="ml-64 mt-14 p-8 h-[calc(100vh-3.5rem)] overflow-hidden flex flex-col gap-6">
<!-- Header -->
<div class="flex justify-between items-end">
<div>
<div class="flex items-center gap-2 mb-2">
<span class="text-[11px] font-semibold text-primary uppercase tracking-wider">Attendance operations</span>
<span class="w-1 h-1 rounded-full bg-white/10"></span>
<span class="text-[11px] text-on-surface-variant">Version 2.4.1</span>
</div>
<h1 class="text-2xl font-bold text-white tracking-tight">Workforce Management</h1>
</div>
<div class="flex p-1 bg-background border border-border-muted rounded-lg">
<button class="px-5 py-1.5 text-[12px] font-semibold bg-surface-panel text-on-surface rounded shadow-sm">Team</button>
<button class="px-5 py-1.5 text-[12px] font-semibold text-on-surface-variant hover:text-on-surface transition-colors">Shifts</button>
</div>
</div>
<!-- Main Workspace -->
<div class="flex-1 flex flex-col gap-6 min-h-0">
<div class="workspace-surface flex flex-1 overflow-hidden rounded-xl">
<!-- Team Roster -->
<div class="w-[360px] panel-divider flex flex-col">
<div class="p-4 border-b border-border-muted flex justify-between items-center bg-white/[0.01]">
<span class="text-[12px] font-semibold text-on-surface-variant">Active roster • 42 members</span>
<div class="relative">
<span class="material-symbols-outlined absolute left-2.5 top-1.5 text-[16px] text-on-surface-variant/60">search</span>
<input class="bg-background border border-border-muted rounded-md px-8 py-1 text-[12px] w-36 focus:w-44 transition-all" placeholder="Find member..."/>
</div>
</div>
<div class="flex-1 overflow-y-auto p-3 space-y-2">
<!-- Member Card -->
<div class="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/[0.04] interactive-card cursor-pointer relative overflow-hidden">
<div class="flex items-center gap-3">
<img alt="Erik" class="w-9 h-9 rounded-full border border-white/10" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDMd4-kmxiNIzUO1vlTb3zpbu7pHVlG3CAbklk-LPxbtf87qmolzoHM_t2o92btGSuay4yB4z06DWDcVvGhkSptxpLnWCrVDf8rIxdPFmCjZyJMZqKgk39LZZaBI1Y5QxKAar2un2aAW_sErHmghxkVHygxJ4sdnNdQxqrtxzdiK5gW4i_tPkonwjqWoi_XgRPJfrsGBR-w2-3-sHjMxfe3sqwr06oS0KD2piBPYdgRTBXNnAIwzzQOIsWxXZehXuiYt3nVhqWfk48"/>
<div>
<p class="text-[13px] font-bold text-white">Erik Rehm</p>
<p class="text-[11px] mono-data text-on-surface-variant"><span class="text-primary">ER-402</span> • Assembly</p>
</div>
</div>
<div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>
</div>
<!-- Member Card -->
<div class="flex items-center justify-between p-3 rounded-lg border border-transparent interactive-card cursor-pointer">
<div class="flex items-center gap-3 opacity-60">
<img alt="Marta" class="w-9 h-9 rounded-full border border-white/5" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAt_UfsNGZBoQWdnJo7XNG4GNyTDINYDxUSzRvNZrNKawx1sZtwwsKnY2rO9JTfEx9HGOBKMpmNVgnMMyIwtiQg7MRi71W0GxjoBTRdsXOapBlzzhIzTs9Jp2kBi5ZdX06ISsRSEi0iEo7BKrsaSYO6K3WtpKC7A0qVN4kLYOn9uzYhPhXCT9GYHnKqC21EcYHWYE7lSFqjdiBtiQUv2hG4-0Qi1J0X6rhWmzvJ1YykyW3P_z5ViRLT_P4NSXvADCn3Xs1DYoQIhqc"/>
<div>
<p class="text-[13px] font-bold">Marta Lopez</p>
<p class="text-[11px] mono-data">ML-991 • Logistics</p>
</div>
</div>
<div class="w-1.5 h-1.5 rounded-full bg-white/10"></div>
</div>
<!-- Member Card -->
<div class="flex items-center justify-between p-3 rounded-lg border border-transparent interactive-card cursor-pointer">
<div class="flex items-center gap-3">
<img alt="Sven" class="w-9 h-9 rounded-full border border-white/10" src="https://lh3.googleusercontent.com/aida-public/AB6AXuANoGFTViZoh3509ZDla_VsC0NzOYdKPKQLoS1jyjGyoX7CrjJpIUmgK0Ls8r6Ogr05ObtO4QNJxxrDVkcV7dbrwBn7bFusSGKl8lfzDzKvcSDV_EeIWj7L60ACUYQS6MmvLcb9w6LMx4zy1OITMpgjFsJI4aSFalXTp_OmQK7A_26Z-YoGPhEKvhq5XugDlOSQBF3Npmg7yYhJUSDtmoZfZJcKsGuh4_MMV5G1-eLTiG1E8zZkWo-OAPKGatvSWfD2JD1ehQEp2Tc"/>
<div>
<p class="text-[13px] font-bold text-white">Sven Jurgens</p>
<p class="text-[11px] mono-data text-on-surface-variant"><span class="text-primary">SJ-112</span> • Operations</p>
</div>
</div>
<div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>
</div>
</div>
</div>
<!-- Profile Editor -->
<div class="flex-1 flex flex-col">
<div class="p-5 border-b border-border-muted flex justify-between items-center">
<div>
<h2 class="text-sm font-bold text-white mb-0.5">Team Member Profile</h2>
<p class="text-[12px] text-on-surface-variant">Configuration for member <span class="mono-data text-primary">ER-402</span></p>
</div>
<div class="text-[11px] mono-data text-on-surface-variant bg-white/[0.04] px-3 py-1 rounded border border-white/5">
                        Last Refresh: 14:02:44
                    </div>
</div>
<form class="p-8 grid grid-cols-2 gap-x-10 gap-y-6 flex-1 overflow-y-auto">
<!-- Employee Details -->
<div class="col-span-2 flex items-center gap-4 mb-2">
<span class="text-[12px] font-bold text-primary uppercase tracking-widest whitespace-nowrap">Employee Details</span>
<div class="h-[1px] w-full bg-border-muted"></div>
</div>
<div class="flex flex-col gap-2">
<label class="text-[11px] font-semibold text-on-surface-variant uppercase">Employee code</label>
<input class="px-3 py-2 text-[13px] text-white rounded-md" readonly="" type="text" value="ER-402"/>
</div>
<div class="flex flex-col gap-2">
<label class="text-[11px] font-semibold text-on-surface-variant uppercase">Department</label>
<select class="px-3 py-2 text-[13px] text-white rounded-md">
<option>Assembly Line A</option>
<option>Logistics</option>
<option>Maintenance</option>
</select>
</div>
<div class="flex flex-col gap-2">
<label class="text-[11px] font-semibold text-on-surface-variant uppercase">Designation</label>
<input class="px-3 py-2 text-[13px] text-white rounded-md" type="text" value="Lead Technician"/>
</div>
<div class="flex flex-col gap-2">
<label class="text-[11px] font-semibold text-on-surface-variant uppercase">Reporting lead</label>
<select class="px-3 py-2 text-[13px] text-white rounded-md">
<option>Sarah Jenkins (OPS-01)</option>
<option>Marcus Aurelius (OPS-04)</option>
</select>
</div>
<!-- Work Schedules -->
<div class="col-span-2 flex items-center gap-4 mt-6 mb-2">
<span class="text-[12px] font-bold text-primary uppercase tracking-widest whitespace-nowrap">Work Schedules</span>
<div class="h-[1px] w-full bg-border-muted"></div>
</div>
<div class="flex flex-col gap-2">
<label class="text-[11px] font-semibold text-on-surface-variant uppercase">Employment type</label>
<select class="px-3 py-2 text-[13px] text-white rounded-md">
<option>Full-time Permanent</option>
<option>Contractual</option>
<option>Internship</option>
</select>
</div>
<div class="flex flex-col gap-2">
<label class="text-[11px] font-semibold text-on-surface-variant uppercase">Default shift</label>
<select class="px-3 py-2 text-[13px] text-white rounded-md">
<option>Morning (08:00 - 16:00)</option>
<option>Evening (16:00 - 00:00)</option>
<option>Night (22:00 - 06:00)</option>
</select>
</div>
<div class="flex flex-col gap-2">
<label class="text-[11px] font-semibold text-on-surface-variant uppercase">Joining date</label>
<input class="px-3 py-2 text-[13px] text-white rounded-md [color-scheme:dark]" type="date" value="2022-03-15"/>
</div>
<div class="flex flex-col gap-2">
<label class="text-[11px] font-semibold text-on-surface-variant uppercase">System status</label>
<select class="px-3 py-2 text-[13px] text-white rounded-md">
<option>Active</option>
<option>On Leave</option>
<option>Inactive</option>
</select>
</div>
</form>
<div class="p-5 border-t border-border-muted flex justify-end gap-4 bg-white/[0.01]">
<button class="px-6 py-2 text-[13px] font-semibold text-on-surface-variant hover:text-on-surface transition-colors">Discard</button>
<button class="premium-btn px-8 py-2 text-[13px] font-bold rounded shadow-lg">Save changes</button>
</div>
</div>
</div>
<!-- Footer Stats -->
<div class="h-44 grid grid-cols-3 gap-6">
<div class="col-span-2 workspace-surface rounded-xl p-5 flex flex-col">
<div class="flex items-center gap-2 mb-4">
<span class="material-symbols-outlined text-lg text-primary">history</span>
<span class="text-[12px] font-bold text-on-surface uppercase tracking-wider">Activity Log</span>
</div>
<div class="flex-1 overflow-y-auto space-y-3 pr-2">
<div class="flex gap-4 text-[13px] items-start">
<span class="mono-data opacity-40 text-[11px] mt-0.5">14:02</span>
<p class="text-on-surface-variant">Profile updated for <span class="text-white font-medium">ER-402</span> by Administrator</p>
</div>
<div class="flex gap-4 text-[13px] items-start">
<span class="mono-data opacity-40 text-[11px] mt-0.5">13:45</span>
<p class="text-on-surface-variant">Shift reassignment: <span class="text-white font-medium">ML-991</span> moved to Morning Shift</p>
</div>
<div class="flex gap-4 text-[13px] items-start">
<span class="mono-data opacity-40 text-[11px] mt-0.5">13:12</span>
<p class="text-on-surface-variant">Data refresh: 14 staff members synchronized with scheduler</p>
</div>
</div>
</div>
<div class="workspace-surface rounded-xl p-5 flex flex-col bg-data-accent/[0.02]">
<div class="flex items-center gap-2 mb-4">
<span class="material-symbols-outlined text-lg text-data-accent">analytics</span>
<span class="text-[12px] font-bold text-on-surface uppercase tracking-wider">Staff Analytics</span>
</div>
<div class="flex-1 flex flex-col justify-between">
<div class="flex justify-between items-end mb-2">
<span class="text-[11px] font-medium text-on-surface-variant uppercase">Staff Coverage</span>
<div class="flex gap-1.5 items-end h-10">
<div class="w-2.5 h-[60%] bg-white/10 rounded-t-sm"></div>
<div class="w-2.5 h-[90%] bg-primary rounded-t-sm"></div>
<div class="w-2.5 h-[40%] bg-white/20 rounded-t-sm"></div>
</div>
</div>
<div class="h-[1px] w-full bg-border-muted mb-4"></div>
<div class="grid grid-cols-2 gap-4">
<div>
<p class="text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Coverage</p>
<p class="mono-data text-lg font-bold text-primary">94.2%</p>
</div>
<div>
<p class="text-[10px] font-semibold text-on-surface-variant uppercase mb-1">Active staff</p>
<p class="mono-data text-lg font-bold">42 <span class="text-[10px] font-normal text-on-surface-variant">/ 50</span></p>
</div>
</div>
</div>
</div>
</div>
</div>
</main>
</body></html>
````