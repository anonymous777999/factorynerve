# Onboarding: Factory Required — Workspace Skeleton Architecture
# FactoryNerve OS | Phase 3 Skeleton Specification
# Route: /onboarding/factory-required
# Generated: 2026-06-03
# Status: DRAFT

---

## 1. WORKSPACE OVERVIEW

### 1.1 Identity

| Field | Value |
|---|---|
| Route | `/onboarding/factory-required` |
| Workspace Name | Factory Access — Authenticated Dead-End Guard |
| Operational Role | Displayed to authenticated users who have no accessible factory context — either because their factory access was revoked, their `UserFactoryRole` was deleted, or the `recoverWorkspaceContextFromError()` workspace recovery path failed to find any alternative factory to switch to. Provides a clear explanation of why the user is blocked and gives them the two available forward paths. |
| Business Impact | If this workspace fails or shows a confusing message, a legitimate factory user who lost access through an admin error has no way to understand what happened or how to get back in. This creates support tickets and perceived platform instability. |
| User Population | Any authenticated role whose factory access is missing. Most common scenario: (1) admin accidentally deletes a `UserFactoryRole` record, (2) owner logs in before factory setup is complete, (3) new account activated before admin assigns a factory role. Always low-frequency but high-anxiety when it occurs. |
| Peak Usage Context | On-demand — no pattern. Often appears unexpectedly after what the user believed was a normal action (e.g., changed browser, new device, session expired on a revoked account). |
| Predecessor Workspaces | Any protected route that triggered a 403/404 workspace recovery failure, OR `/access` post-login if `getHomeDestination` routes to a workspace but the factory context is missing |
| Successor Workspaces | `/settings` (if user has admin/owner access) or `/access` (sign in with a different account) |

### 1.2 Operational Importance

This workspace is a last-resort guard. When it appears, the user's entire factory context is broken. They cannot access any operational workflow, any report, any attendance record. The workspace must accomplish three things simultaneously: (1) explain the situation clearly enough that the user understands they are not experiencing a software bug, (2) give them the maximum available forward paths (fix their own access if they have admin role, or sign in with a different account), (3) communicate the next administrative action required (ask their factory admin to check Settings → Users). A vague or broken guard page here converts a resolvable configuration problem into a perceived platform failure.

### 1.3 Current State Failures

- The eyebrow label `text-label-dense font-semibold text-text-tertiary` renders at 11px/600 but uses a utility class (`text-label-dense`) that may not correspond to the governance token `--type-label-dense` (11px/500/+0.03em tracking) — the weight is 600 (semibold) but governance specifies 500 for this scale; must use the correct token weight
- `h1` uses `text-2xl font-semibold` — `text-2xl` is 24px which is 6px above the `--type-page-title` ceiling of 18px; this is a standalone guard page (not in AuthWorkstationShell) so the 18px ceiling still applies; must reduce to 18px/600
- The "Open factory settings" and "Back to sign in" navigation buttons use `<Link><Button>` nested pattern — the same accessibility violation flagged in the verify-email skeleton; must use `Button asChild` + `Link`
- The "Open factory settings" button has no role check beyond `user !== null` — it shows for any authenticated user including `attendance` and `operator` roles who cannot change their own settings; must also check that the user has a role of `admin` or `owner` before showing the settings button (or at minimum show a differently-labeled button for lower roles)
- The card uses `shadow-md` — arbitrary Tailwind shadow class; must use the token variable `var(--shadow-md)` if a shadow is needed, or use `--surface-panel` surface context which does not require shadow
- The card container is `rounded-panel border border-border-default bg-surface-card p-8` — `p-8` is 32px which is correct (4px scale compliant); but the container uses `bg-surface-card` on a `bg-surface-app` background which is correct layering; the `border border-border-default` on a `surface-card` is the double-border anti-pattern: `surface-card` is already visually distinct from `surface-app` through elevation; a border is redundant
- The descriptive text `text-sm leading-7` uses Tailwind shorthand — `text-sm` is 14px (correct) but `leading-7` is 28px line-height which is very loose for an explanatory paragraph; should use `--type-body` (14px/400/leading: 1.6) system token
- The `<strong>` tag on "Settings → Users" uses `text-text-secondary` — this makes the emphasized text LESS visible than if it used `text-text-primary`; the intent is to emphasize; must use `text-text-primary` or a functional emphasis style
- No `role="main"` or semantic landmark on the root `<main>` — the element is `<main>` which is correct semantically; however, the page has no `<h1>` landmark text that screen readers can navigate to as the main heading; it does have an `<h1>` but within a card that is centered in a full-screen container; this is acceptable structure

---

## 2. WORKSPACE CLASSIFICATION

| Dimension | Classification | Rationale |
|---|---|---|
| Workspace Type | Auth / Onboarding | Listed in `shellHiddenRoutes` — rendered outside AppShell; no sidebar, no topbar |
| Workflow Category | Entry (blocked) | User cannot proceed to any operational workflow; the page IS the workflow terminus |
| Operational Behavior | Static Guard | No form input, no async data fetching, no state machine; one conditional button based on user session |
| Data Density | VERY LOW | One card, three text elements, two buttons; the simplest workspace in Phase A |
| Realtime Complexity | NONE | No subscriptions, no polling; `useSession()` is synchronous from session-store |
| AI Complexity | NONE | No AI systems |
| Audit Complexity | NONE | No audit events written from this page |
| Decision Pressure | MEDIUM | The user is frustrated and confused; the workspace must resolve that emotional state quickly with clear guidance |

**Classification Implication:**
A VERY LOW density, static guard page means the design challenge is purely communicative — not structural. This workspace does not use `AuthWorkstationShell` and should not. A single centered card on the `surface-app` background is the correct structure because: (1) the user is authenticated (no need for the left panel's auth context workflow), (2) the workspace must be impossible to mistake for a normal operational page (the full-screen centering communicates "you are not in your workspace"), (3) the two available actions are simple enough that a card with two buttons is the complete UX. The only structural improvement is fixing the violations documented in Section 1.3 and ensuring the button visibility logic correctly gates by role.

---

## 3. BACKEND OPERATIONAL MAPPING

### 3.1 API Surface

This workspace makes no API calls directly. It is a static guard page that relies entirely on the client-side session state.

| Endpoint | Method | Purpose | Notes |
|---|---|---|---|
| `GET /auth/context` | GET | Called by `useSession()` / `ensureSessionLoaded()` on mount to hydrate session state | The `active_factory` and `factories` arrays from this endpoint are what drive the `recoverWorkspaceContextFromError()` decision; if both are empty/null, the user ends up here |
| None (static page) | — | This page makes no additional API calls | Navigation buttons are pure Next.js `Link` elements |

**Trigger path from `auth.ts`:**

```
API call on any protected route → HTTP 403 or 404
    → recoverWorkspaceContextFromError(status) called
    → resolveWorkspaceRecoveryPlan({ activeFactoryId, factories }, status)
          → factories.filter(f => f.factory_id !== activeFactoryId)
          → if nextFactories.length > 0:
                → selectFactory(nextFactories[0].factory_id)  [tries to switch]
          → if nextFactories.length === 0:
                → { action: "redirect", href: "/onboarding/factory-required" }
                → window.location.assign("/onboarding/factory-required")
```

**So this workspace appears only when:**
- The user is authenticated (valid session cookie exists)
- `getAuthContext()` returned 403 or 404
- There are no alternative factories to switch to (`factories.filter(...)` is empty)

**What `useSession()` provides to this page:**
- `user`: the current `CurrentUser` object (email, role, name) — always non-null if session is valid
- `active_factory`: null (this is why the page is shown)
- `factories`: [] (empty, otherwise the user would have been auto-switched)

### 3.2 Entity Relationship Map

```
AuthUser (authenticated session exists)
    └── User (id, email, role, org_id)
          └── UserFactoryRole (missing or revoked ← reason this page shows)
                ↑
        This link is broken. The page exists because this relationship is absent.
```

**Primary entity:** None — there is no entity to act on from this page.
**Relationship implication:** The UI cannot repair the relationship. It can only direct the user to someone who can.

### 3.3 Workflow State Machine

```
[PAGE RENDERS]
    → useSession() provides user object (authenticated user, no factory)
    → if user.role is admin or owner:
          → show both action buttons: "Open factory settings" + "Back to sign in"
    → if user.role is any other role (attendance, operator, supervisor, accountant, manager):
          → show single button: "Back to sign in"
          → show additional guidance: "Contact your factory admin" message

[USER CLICKS "Open factory settings"]
    → Next.js Link navigates to /settings
    → Admin/owner can investigate Settings → Users and restore factory access

[USER CLICKS "Back to sign in"]
    → Next.js Link navigates to /access
    → User can sign in with a different account that has factory access
```

**No async state transitions.** This is a static page with conditional rendering.

### 3.4 Realtime Contracts

None. No subscriptions or polling. `useSession()` reads from the session store synchronously.

### 3.5 AI System Contracts

Not applicable.

### 3.6 Permission Matrix

| Role | View page | "Open factory settings" button visible | "Back to sign in" visible |
|---|---|---|---|
| attendance | ✓ | ✗ | ✓ |
| operator | ✓ | ✗ | ✓ |
| supervisor | ✓ | ✗ | ✓ |
| accountant | ✓ | ✗ | ✓ |
| manager | ✓ | ✗ | ✓ |
| admin | ✓ | ✓ (can reach /settings) | ✓ |
| owner | ✓ | ✓ (can reach /settings) | ✓ |
| null (unauthenticated) | Should not reach this page (auth guard redirects to /access) | ✗ | ✓ (as fallback) |

**Permission implication:** The current implementation shows "Open factory settings" based only on `user !== null`. This must be tightened to `user !== null && (user.role === "admin" || user.role === "owner")`. For non-admin/owner roles, showing the settings button leads them to a page they cannot use — it would show a 403 or an empty settings state.

**Additional guidance by role:** Non-admin/owner users should see additional text: "To restore factory access, ask your factory admin or owner to check Settings → Users and reassign your role." This text is currently present in generic form but should be role-aware — it is most helpful for operator/attendance/supervisor users who have no self-service path.

---

## 4. WORKSPACE STRUCTURAL ANATOMY

### 4.1 Layout Pattern

```
FULL-SCREEN CENTERED CARD: Single card, vertically and horizontally centered on surface-app
```

This is the only Phase A workspace that does NOT use `AuthWorkstationShell`. The reasoning is intentional and documented:

1. The user is already authenticated — there is no auth workflow context to provide in a left panel
2. The full-screen centering communicates "you are not in your normal workspace" — which is precisely the message needed; an `AuthWorkstationShell` split would suggest the user is in an auth flow when they are not
3. The workspace is static and single-action — a centered card is the minimum sufficient structure
4. Other guard pages (`/403`, `/offline`) follow the same single-card pattern for the same reasons

**Pattern selection justification:** The full-screen centered card is the most direct way to communicate a dead-end guard state to an authenticated user. Any additional structure (split panel, left rail, topbar) would dilute this communication. The reduction is the design.

**Structural reduction note:** A two-column layout and a topbar were considered and rejected. A topbar on this page would imply the user is navigating — they are not. A left panel would imply context is available — it isn't. The card is the workspace.

---

### 4.2 Zone Definitions

---

#### ZONE: Full-Screen Centered Container

| Property | Value |
|---|---|
| Operational Role | Page background that creates the visual separation from the operational app — communicates "you are outside your workspace" |
| Attention Priority | 5 (background layer) |
| Position | fixed or flex full-screen behind the card |
| Width | 100vw |
| Height | 100vh (min-h-screen) |
| Sticky Behavior | not applicable |
| Collapse Behavior | not applicable |
| Scroll Behavior | overflow-y: auto |
| Density Mode | not applicable |
| Existence Justification | Creates visual context separation from the normal app shell; `surface-app` background is the lowest surface level — farthest from operational UI |

**Acceptance Criteria:**
- [ ] Background uses `var(--surface-app)` — NOT a hardcoded color
- [ ] Full viewport height and width — no partial coverage
- [ ] Content is centered both horizontally and vertically

---

#### ZONE: Guard Card

| Property | Value |
|---|---|
| Operational Role | Contains all informational and action content; the single operational surface of this workspace |
| Attention Priority | 1 |
| Position | centered in the full-screen container |
| Width | fixed: max-width 520px, full width on mobile below that |
| Height | content-driven; no fixed height |
| Sticky Behavior | not sticky |
| Collapse Behavior | never |
| Scroll Behavior | no scroll needed |
| Density Mode | default |
| Existence Justification | Contains the three content elements (eyebrow, heading, description) and two action buttons |

**Contents:**
- Eyebrow label: "Workspace access" — `--type-label-dense` (11px/500/`text-text-tertiary`); sentence case; NOT `font-semibold` (600 weight violates the 500 weight for this scale)
- Heading: "Factory access is not available" — `--type-page-title` (18px/600); sentence case; NOT `text-2xl` (24px)
- Description body: `--type-body` (14px/400/`text-text-secondary`/leading 1.6):
  - Primary sentence: "Your active factory access has been removed or has not been set up yet."
  - Admin path (conditional — role is admin or owner): "Open factory settings to review and restore your access in Settings → Users."
  - Non-admin path (conditional — all other roles): "Contact your factory admin or owner to restore your role in Settings → Users."
- Action buttons:
  - If role is admin or owner:
    - Primary: `Button variant="primary"` — "Open factory settings" — `Button asChild` + `Link href="/settings"`
    - Secondary: `Button variant="outline"` — "Back to sign in" — `Button asChild` + `Link href="/access"`
  - If role is not admin/owner (or user is null):
    - Single: `Button variant="outline"` — "Back to sign in" — `Button asChild` + `Link href="/access"`
- Footer help text: "If this is a mistake, ask your factory admin to check your user access in **Settings → Users**." — `--type-body` (14px/400/`text-text-tertiary`); `<strong>` uses `text-text-primary`

**Surface specs:**
- Card background: `var(--surface-card)` on `var(--surface-app)` — correct layering, no border needed (surface-card is visually distinct from surface-app without a border)
- Card padding: 32px (--space-8)
- No shadow: the surface elevation difference provides separation; `shadow-md` adds visual noise without operational benefit and violates the "borders are structural, not decorative" principle

**Acceptance Criteria:**
- [ ] Eyebrow at 11px/500/sentence case/`text-text-tertiary` — NOT `font-semibold` (600)
- [ ] Heading at 18px/600 — NOT 24px (`text-2xl`)
- [ ] Description uses `--type-body` (14px/400/leading 1.6) — NOT arbitrary `leading-7`
- [ ] `<strong>` on "Settings → Users" uses `text-text-primary` — NOT `text-text-secondary`
- [ ] "Open factory settings" button visible ONLY when `user.role === "admin" || user.role === "owner"` — NOT just `user !== null`
- [ ] "Open factory settings" button uses `Button asChild` + `Link` — NOT `<Link><Button>`
- [ ] "Back to sign in" button uses `Button asChild` + `Link` — NOT `<Link><Button>`
- [ ] Card has NO `border` (surface-card on surface-app needs no border to differentiate)
- [ ] Card has NO `shadow-md` arbitrary shadow class
- [ ] Card max-width 520px; full width below 520px
- [ ] Card padding 32px (--space-8)
- [ ] Non-admin/owner users see description text directing them to contact their admin
- [ ] Admin/owner users see description text directing them to open settings

### 4.3 Zone Interaction Rules

```yaml
zone_interactions:
  - trigger: user.role === "admin" OR user.role === "owner"
    effect: Guard Card → "Open factory settings" button visible (primary variant);
      description text shows admin-path guidance
    reason: admin and owner roles can navigate to /settings and potentially restore
      their own factory access without external help

  - trigger: user.role is NOT admin/owner (or user is null)
    effect: Guard Card → "Open factory settings" button hidden;
      description text shows non-admin guidance ("contact your factory admin")
    reason: non-admin roles cannot fix their own factory access; sending them to
      /settings would result in a 403 or empty page — unhelpful and confusing

  - trigger: user is null (session not yet hydrated)
    effect: Guard Card → show only "Back to sign in" button; both description texts hidden
      until user object loads; show loading skeleton or empty state on description area
    reason: role cannot be determined before session hydrates; default to minimum safe state
```

---

## 5. OPERATIONAL ATTENTION HIERARCHY

### 5.1 Scan Flow

```
SCAN LEVEL 1 (0–200ms): "Factory access is not available" heading
────────────────────────────────────────────────────────────────────
  WHY FIRST: The 18px/600 heading is the heaviest text element on the page.
  The user immediately knows the category of problem — access failure — without
  reading any body text. This prevents the "is this a bug?" panic.

SCAN LEVEL 2 (200ms–800ms): Description paragraph
────────────────────────────────────────────────────
  WHY SECOND: The description explains the reason (removed/not set up) and the
  path (contact admin OR open settings). After reading this, the user knows
  what happened and what to do. Two sentences maximum.

SCAN LEVEL 3 (800ms–2s): Action buttons
─────────────────────────────────────────
  WHY THIRD: The buttons are the forward actions. Primary (settings) is visually
  dominant for admin/owner. Outline (sign in) is always present as the fallback.
  No decision required — the right button is obvious from the heading context.

SCAN LEVEL 4 (2s+): Footer help text
──────────────────────────────────────
  WHY LAST: "Settings → Users" reinforces the admin path for users who need
  to communicate the specific location to their administrator via phone/message.
```

### 5.2 Persistent Visibility Requirements

No persistent visibility requirements — the entire card is always in view. The workspace has no scrolling content.

### 5.3 Contextual Visibility Rules

```yaml
contextual_rules:
  - condition: user.role === "admin" OR user.role === "owner"
    shows: "Open factory settings" button (primary) + admin-path description
    hides: non-admin description text
    reason: admin/owner have a self-service resolution path

  - condition: user.role is NOT admin/owner
    shows: non-admin description text ("Contact your factory admin")
    hides: "Open factory settings" button
    reason: non-admin users have no self-service path; showing a useless button
      increases frustration

  - condition: user is null (session not hydrated)
    shows: "Back to sign in" only; skeleton on description
    hides: role-dependent content until user object available
    reason: no role means no role-based visibility decision can be made safely
```

---

## 6. TABLE & DATA STRATEGY

No tables — workspace is a static guard card.

---

## 7. FORM & INPUT STRATEGY

No forms — workspace has no user input. All interactions are button clicks that trigger navigation.

---

## 8. AI & AUDIT VISIBILITY STRATEGY

### 8.1 AI Placement Map
Not applicable.

### 8.2 Audit Visibility Map
No audit events written from this page. The event that caused the guard state (403/404 on protected route) is logged by the backend; this page is the recovery surface only.

### 8.3 Anomaly Visibility
Not applicable.

---

## 9. DENSITY, SPACING & LAYOUT RHYTHM

### 9.1 Density Mode

```yaml
default_density: default
density_justification: Static guard page; density mode is irrelevant (no table rows,
  no form fields). Default spacing provides comfortable reading of the 2–3 sentence
  description.
density_switchable: no
```

### 9.2 Spacing Rhythm

```yaml
spacing:
  card_padding: 32px (--space-8) on all sides
  eyebrow_to_heading_gap: 12px (--space-3) — tight grouping communicates these are one unit
  heading_to_body_gap: 16px (--space-md) — transition from title to explanation
  body_to_buttons_gap: 24px (--space-lg) — clear separation between explanation and action
  button_gap: 12px (--space-3) between action buttons
  buttons_to_footer_gap: 24px (--space-lg) — clear separation between action zone and support text
  max_card_width: 520px
  container_padding: 24px horizontal on mobile (--space-6)
```

### 9.3 Typography Specification

```yaml
typography:
  eyebrow: 11px / 500 / sentence case / text-text-tertiary / tracking: +0.03em (--type-label-dense)
  heading: 18px / 600 / sentence case / text-text-primary (--type-page-title)
  description_body: 14px / 400 / text-text-secondary / leading: 1.6 (--type-body)
  settings_path_emphasis: 14px / 500 / text-text-primary (within description — <strong> tag)
  footer_help_text: 14px / 400 / text-text-tertiary (--type-body / tertiary color)
  footer_emphasis: 14px / 500 / text-text-primary (within footer <strong> tag)
  button_labels: 14px / 500 / sentence case (Button default)
```

### 9.4 Surface Token Hierarchy

```yaml
surfaces:
  page_background: var(--surface-app)
  guard_card: var(--surface-card)
  # No border on guard card — surface-card elevation on surface-app is self-distinguishing
  # No shadow — not needed and adds visual noise
```

---

## 10. RESPONSIVE & OPERATOR ADAPTATION

### 10.1 Desktop (Primary)

```yaml
desktop:
  card_max_width: 520px
  centering: flex min-h-screen items-center justify-center
  padding: 24px horizontal
```

### 10.2 Mobile

```yaml
mobile:
  card_width: 100% (below 520px breakpoint)
  padding: 24px horizontal
  touch_targets:
    - button_height: 44px minimum
    - button_gap: 12px (maintains safe separation)
```

### 10.3 Responsive Notes

No left panel to collapse. No rails. The page is already minimal by design. The only mobile adaptation is ensuring touch targets are ≥44px.

---

## 11. COMPONENT MAPPING

```yaml
component_mapping:
  workspace_container:
    component: HTML <main> element (direct — no AuthWorkstationShell; no AppShell)
    reason: this is an authenticated dead-end guard, not an auth-flow workspace;
      AuthWorkstationShell would imply auth context that does not exist here
    classes: flex min-h-screen items-center justify-center bg-surface-app px-6 py-10

  guard_card:
    component: inline <div> with surface-card background
    classes: w-full max-w-[520px] rounded-panel bg-surface-card p-8
    reason: no border (surface-card on surface-app is self-distinguishing);
      no shadow-md (surface elevation provides separation without extra visual noise)

  typography_elements:
    - element: eyebrow
      component: <p> or <div>
      classes: text-[11px] font-medium text-text-tertiary (--type-label-dense, weight 500)
    - element: heading
      component: <h1>
      classes: text-[18px] font-semibold text-text-primary (--type-page-title)
    - element: description
      component: <p>
      classes: text-sm leading-relaxed text-text-secondary (--type-body, leading: 1.6)
    - element: <strong> emphasis
      component: <strong>
      classes: text-text-primary font-medium (NOT text-text-secondary)
    - element: footer help text
      component: <p>
      classes: text-sm text-text-tertiary (--type-body / tertiary)

  action_elements:
    - element: "Open factory settings" (admin/owner only)
      component: Button variant="primary" asChild
      child: Link href="/settings"
      condition: user?.role === "admin" || user?.role === "owner"
    - element: "Back to sign in"
      component: Button variant="outline" asChild
      child: Link href="/access"
      always_visible: yes (even when user is null)

  session_hook:
    hook: useSession()
    provides: user object (email, role, name)
    usage: conditional rendering of "Open factory settings" button + description variant
```

---

## 12. OPERATIONAL PROBLEMS SOLVED

```yaml
problem_resolutions:
  - problem: h1 uses text-2xl (24px) — 6px above the 18px page-title ceiling
    root_cause: Developer used standard Tailwind prose sizing; no governance check applied
    structural_solution: Section 9.3 specifies heading at 18px/600 (--type-page-title);
      Section 4.2 acceptance criteria require NOT text-2xl
    section_reference: Section 9.3, Section 4.2
    measurable_outcome: Heading renders at 18px; consistent with all other auth-context
      page titles in Phase A

  - problem: "Open factory settings" shows for ANY authenticated user including
      attendance/operator roles who cannot use settings
    root_cause: Conditional is `user !== null` — does not check role; attendance users
      seeing a "Open factory settings" button that leads to a 403 or useless page
      increases confusion rather than providing help
    structural_solution: Section 3.6 permission matrix defines admin/owner as the only
      roles that should see this button; Section 4.3 zone interactions specify the role
      check; Section 4.2 acceptance criteria require the role guard
    section_reference: Section 3.6, Section 4.3, Section 4.2
    measurable_outcome: Only admin/owner roles see the settings button; attendance/operator
      roles see only "Back to sign in" and appropriate contact-admin guidance

  - problem: <Link><Button> nested pattern — accessibility violation
    root_cause: Same pattern flagged in verify-email and access skeletons; developer
      wrapped Button inside Link producing <a><button> in DOM
    structural_solution: Section 4.2 acceptance criteria require Button asChild + Link;
      Section 11 component mapping specifies asChild pattern for both buttons
    section_reference: Section 4.2, Section 11
    measurable_outcome: DOM contains valid single focusable element per action; no
      nested interactive element accessibility violation

  - problem: Card has border + surface-card background — double-border anti-pattern
    root_cause: Developer added visible border to a container that already differentiates
      itself from the background through surface elevation; the border is visually redundant
    structural_solution: Section 9.4 specifies surface-card on surface-app with no border;
      Section 4.2 acceptance criteria require NO border on the guard card
    section_reference: Section 9.4, Section 4.2
    measurable_outcome: Guard card has no border; surface elevation provides visual
      separation; the anti-pattern is eliminated

  - problem: shadow-md arbitrary class on card
    root_cause: Developer used Tailwind shadow shorthand; shadows on guard cards add
      visual noise without operational purpose
    structural_solution: Section 4.2 acceptance criteria require NO shadow-md;
      Section 9.4 confirms no shadow is needed
    section_reference: Section 4.2, Section 9.4
    measurable_outcome: Guard card renders without shadow; surface background contrast
      provides adequate visual separation

  - problem: <strong> "Settings → Users" uses text-text-secondary making it less visible
    root_cause: text-text-secondary was applied to <strong> content — the opposite of
      the intended emphasis effect; secondary text color is dimmer than primary
    structural_solution: Section 9.3 specifies settings_path_emphasis at text-text-primary;
      Section 4.2 acceptance criteria require text-text-primary on <strong>
    section_reference: Section 9.3, Section 4.2
    measurable_outcome: "Settings → Users" text renders at text-text-primary; the
      emphasis is actually visible; operators know exactly where to direct their admin

  - problem: Description text uses leading-7 (28px) — excessively loose line height
    root_cause: leading-7 is a common Tailwind prose convention but is too loose for
      the 14px body text in this context; governance requires leading: 1.6 (~22px)
    structural_solution: Section 9.3 specifies description_body at --type-body
      (14px/400/leading 1.6); Section 4.2 acceptance criteria require NOT arbitrary leading-7
    section_reference: Section 9.3, Section 4.2
    measurable_outcome: Description text uses appropriate 1.6 line height; no
      arbitrary Tailwind leading class
```

---

## 13. IMPLEMENTATION HANDOFF

### 13.1 Build Sequence

```yaml
implementation_sequence:
  step_1: Fix h1 from text-2xl (24px) to text-[18px] (--type-page-title)
  step_2: Fix eyebrow from font-semibold (600) to font-medium (500); confirm class
    resolves to 11px/500 matching --type-label-dense
  step_3: Fix <strong> tags from text-text-secondary to text-text-primary
  step_4: Tighten "Open factory settings" condition from user !== null to
    user?.role === "admin" || user?.role === "owner"
  step_5: Add role-aware description text (admin path vs. non-admin contact-admin path)
  step_6: Replace <Link><Button> nesting with Button asChild + Link pattern for both buttons
  step_7: Remove border from guard card (keep bg-surface-card; remove border class)
  step_8: Remove shadow-md from guard card
  step_9: Fix description leading from leading-7 to leading-relaxed (or explicit leading-[1.6])
  step_10: Verify mobile touch targets — buttons ≥44px height on mobile
```

### 13.2 Critical Constraints

```yaml
critical_constraints:
  - "Do NOT use AuthWorkstationShell — this is an authenticated guard page, not an auth
     entry point; the full-screen centered card is the correct pattern"
  - "Do NOT show 'Open factory settings' to roles below admin — attendance, operator,
     supervisor, accountant, manager cannot use that page and it creates confusion"
  - "Button asChild + Link pattern is required — no <Link><Button> nesting"
  - "Card must NOT have both a border AND surface-card background — eliminate the border"
  - "All surfaces reference CSS token variables — no hex"
  - "All text uses sentence case — no uppercase labels"
```

### 13.3 Open Questions

```yaml
open_questions:
  - question: >
      When user is null (session not yet hydrated from useSession()), should the
      page show a loading skeleton on the description area, or is it acceptable to
      show the generic non-admin description text as a default (which is safe to
      show regardless of role since it only directs to contact an admin)?
    blocking: no — showing the generic non-admin text as the default (before hydration)
      is safe and avoids a loading flash; admin/owner-specific text appears after hydration
    owner: frontend team
    decision_needed_by: before step_4

  - question: >
      Should this page also handle the case where the user's account has been fully
      deactivated (is_active=false)? Currently a deactivated account would get a 401
      on auth context refresh, which navigates to /access — it would never reach this page.
      The page only appears for 403/404 workspace recovery. Is the current trigger path
      complete?
    blocking: no — the trigger path documented in Section 3.1 is accurate; deactivated
      accounts are handled by the auth layer before this page
    owner: engineering
    decision_needed_by: informational only

open_questions: none blocking
```

---

## ACCEPTANCE CRITERIA (SPEC COMPLETENESS)

- [x] All 13 sections fully populated
- [x] Every zone has documented existence justification and testable acceptance criteria
- [x] Every component mapped to existing primitives
- [x] Every operational failure from Section 1.3 has a resolution in Section 12
- [x] Reduction audit: intentionally minimal — single card; no unnecessary zones
- [x] No anti-patterns: no gradients, no glow, no uppercase labels, no shadow anti-patterns
- [x] All spacing follows 4px scale
- [x] All surfaces reference token variables
- [x] Typography follows approved system
- [x] Permission matrix drives conditional rendering documented in Section 4.3
- [x] No blocking open questions
- [x] Implementation sequence complete and ordered

---

## POST-GENERATION SELF-VALIDATION

```yaml
self_validation:
  operational_integrity:
    - [x] Zone traced to operational necessity (guard card = the reason the page exists;
          full-screen bg = visual separation from operational app)
    - [x] Every zone justified by operator need
    - [x] No decorative zones
    - [x] Removed elements documented (border, shadow, leading-7, 24px heading,
          wrong role guard, <Link><Button> nesting)

  law_compliance:
    - [x] Spacing 4px scale (12px, 16px, 24px, 32px)
    - [x] All surfaces reference CSS tokens (surface-app, surface-card)
    - [x] All labels sentence case
    - [x] All fonts from approved type system (11px/500, 14px/400, 18px/600)
    - [x] No AI elements

  kiro_readiness:
    - [x] 10-step implementation sequence
    - [x] All acceptance criteria testable
    - [x] No blocking open questions

  anti_pattern_check:
    - [x] No gradients
    - [x] No glow
    - [x] No pulse on static elements
    - [x] No uppercase labels
    - [x] No marketing typography
    - [x] No invented workflows — trigger path traced to auth.ts recoverWorkspaceContextFromError()
    - [x] No <details>/<summary>
    - [x] No <Link><Button> nesting

  structural_integrity:
    - [x] Zone interactions cover all role-based conditional rendering
    - [x] Permission matrix complete with role-specific visibility rules
    - [x] No responsive collapse needed — single card already minimal
    - [x] All problem resolutions reference specific spec sections
```

---

## 14. VISUAL STRUCTURAL HIERARCHY BLUEPRINT

---

### 14A. Desktop Structural Blueprint

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                        │
│                          FULL-SCREEN CONTAINER                                         │
│                          background: var(--surface-app)                               │
│                          flex items-center justify-center min-h-screen                │
│                                                                                        │
│              ┌─────────────────────────────────────────────────────┐                  │
│              │  GUARD CARD                  max-width: 520px        │                  │
│              │  background: var(--surface-card)                    │                  │
│              │  padding: 32px                                       │                  │
│              │  NO border / NO shadow                               │                  │
│              │                                                      │                  │
│              │  ┌───────────────────────────────────────────────┐  │                  │
│              │  │ EYEBROW                                        │  │                  │
│              │  │ "Workspace access"                             │  │                  │
│              │  │  11px / 500 / text-text-tertiary / sentence    │  │                  │
│              │  │  tracking: +0.03em (--type-label-dense)        │  │                  │
│              │  └───────────────────────────────────────────────┘  │                  │
│              │  ↕ 12px (--space-3)                                  │                  │
│              │  ┌───────────────────────────────────────────────┐  │                  │
│              │  │ HEADING [h1]                                   │  │                  │
│              │  │ "Factory access is not available"              │  │                  │
│              │  │  18px / 600 / text-text-primary / sentence     │  │                  │
│              │  │  (--type-page-title)                           │  │                  │
│              │  └───────────────────────────────────────────────┘  │                  │
│              │  ↕ 16px (--space-md)                                 │                  │
│              │  ┌───────────────────────────────────────────────┐  │                  │
│              │  │ DESCRIPTION                                    │  │                  │
│              │  │  14px / 400 / text-text-secondary / leading 1.6│  │                  │
│              │  │                                                │  │                  │
│              │  │  [ADMIN/OWNER PATH]                            │  │                  │
│              │  │  "Your active factory access has been removed  │  │                  │
│              │  │  or not set up. Open factory settings to       │  │                  │
│              │  │  review your access in                         │  │                  │
│              │  │  <strong>Settings → Users</strong>."           │  │                  │
│              │  │                          ↑ text-text-primary   │  │                  │
│              │  │                                                │  │                  │
│              │  │  [NON-ADMIN PATH]                              │  │                  │
│              │  │  "Your active factory access has been removed  │  │                  │
│              │  │  or not set up. Contact your factory admin to  │  │                  │
│              │  │  restore your role in                          │  │                  │
│              │  │  <strong>Settings → Users</strong>."           │  │                  │
│              │  └───────────────────────────────────────────────┘  │                  │
│              │  ↕ 24px (--space-lg)                                 │                  │
│              │  ┌───────────────────────────────────────────────┐  │                  │
│              │  │ ACTION BUTTONS (flex-wrap gap-3)              │  │                  │
│              │  │                                                │  │                  │
│              │  │  [ADMIN/OWNER]                                 │  │                  │
│              │  │  [Open factory settings] (primary)             │  │                  │
│              │  │  [Back to sign in]       (outline)             │  │                  │
│              │  │                                                │  │                  │
│              │  │  [NON-ADMIN/OWNER]                             │  │                  │
│              │  │  [Back to sign in]       (outline only)        │  │                  │
│              │  │                                                │  │                  │
│              │  │  Button asChild + Link — NOT <Link><Button>    │  │                  │
│              │  └───────────────────────────────────────────────┘  │                  │
│              │  ↕ 24px (--space-lg)                                 │                  │
│              │  ┌───────────────────────────────────────────────┐  │                  │
│              │  │ FOOTER HELP TEXT                               │  │                  │
│              │  │ "If this is a mistake, ask your factory admin  │  │                  │
│              │  │  to check your user access in                  │  │                  │
│              │  │  <strong>Settings → Users</strong>."           │  │                  │
│              │  │  14px / 400 / text-text-tertiary               │  │                  │
│              │  │  <strong> → text-text-primary / 500 weight     │  │                  │
│              │  └───────────────────────────────────────────────┘  │                  │
│              └─────────────────────────────────────────────────────┘                  │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 14B. Visual Attention Flow Map

```
SCAN LEVEL 1 (0–200ms): "Factory access is not available" heading
──────────────────────────────────────────────────────────────────
  WHY: 18px/600 is the heaviest text on the page. The user knows the
  category of problem instantly — factory access failure, not a software bug.
  This prevents the "what is happening?" panic that causes support tickets.

SCAN LEVEL 2 (200ms–800ms): Description paragraph
─────────────────────────────────────────────────────
  WHY: Two sentences explain the situation and point to the resolution path.
  "Settings → Users" in text-text-primary acts as an anchor within the paragraph.
  The user now knows: (1) what happened, (2) what to do about it.

SCAN LEVEL 3 (800ms–2s): Action buttons
──────────────────────────────────────────
  WHY: One or two buttons, immediately below the description.
  Admin/owner: primary "Open factory settings" → they can act now.
  Everyone else: outline "Back to sign in" → sign in with a working account.

SCAN LEVEL 4 (2s+): Footer help text
───────────────────────────────────────
  WHY: For users who need to communicate the problem to their admin,
  "Settings → Users" provides the exact location to mention. This is the
  message they forward or read aloud to their administrator.
```

#### Destructive / Irreversible Actions

None. Both actions are pure navigation — no data is changed, no records are deleted.

---

### 14C. Spacing & Rhythm Visualization

```
GUARD CARD INTERNAL RHYTHM:

  ┌─ 32px card padding top ──────────────────────────────────
  │
  │  [EYEBROW]        11px / tertiary
  │
  ├─ 12px gap ── tight grouping (eyebrow + heading = one unit)
  │
  │  [HEADING]        18px / primary / bold
  │
  ├─ 16px gap ── transition (title → explanation)
  │
  │  [DESCRIPTION]    14px / secondary / leading 1.6
  │
  ├─ 24px gap ── clear separation (explanation → action zone)
  │
  │  [BUTTONS]        flex-wrap gap-3 (12px between buttons)
  │
  ├─ 24px gap ── clear separation (action zone → support note)
  │
  │  [FOOTER HELP]    14px / tertiary
  │
  └─ 32px card padding bottom ──────────────────────────────────

INTENTIONAL VISUAL SILENCE:
  - The card itself is small relative to the full-screen background.
  - The white space around the card IS the design — it communicates
    "you are outside your operational context" more effectively than
    any structural element could.
```

---

### 14D. Component Nesting Hierarchy

```
<main> (flex min-h-screen items-center justify-center bg-surface-app px-6 py-10)
  └── <div> (guard card — max-w-[520px] w-full rounded-panel bg-surface-card p-8)
        ├── <p> (eyebrow — 11px/500/text-text-tertiary)
        │       "Workspace access"
        ├── <h1> (18px/600/text-text-primary)
        │       "Factory access is not available"
        ├── <p> (description — 14px/400/text-text-secondary/leading-relaxed)
        │       [ADMIN/OWNER version or NON-ADMIN version]
        │       └── <strong> (text-text-primary/font-medium)
        │               "Settings → Users"
        ├── <div> (buttons — flex flex-wrap gap-3)
        │     ├── Button variant="primary" asChild  [admin/owner only]
        │     │     └── Link href="/settings" — "Open factory settings"
        │     └── Button variant="outline" asChild  [always]
        │           └── Link href="/access" — "Back to sign in"
        └── <p> (footer — 14px/400/text-text-tertiary)
                "If this is a mistake..."
                └── <strong> (text-text-primary/font-medium)
                        "Settings → Users"
```

---

### 14E. Responsive Blueprint

```
≥520px (Desktop and large mobile):
┌────────────────────────────────────────────────────┐
│  FULL-SCREEN BG (surface-app)                      │
│  flex center                                        │
│  ┌──────────────────────────────────┐              │
│  │  GUARD CARD  (max-w: 520px)      │              │
│  │  padding: 32px                   │              │
│  │  Eyebrow → Heading → Body →      │              │
│  │  Buttons (row) → Footer          │              │
│  └──────────────────────────────────┘              │
└────────────────────────────────────────────────────┘

<520px (Mobile):
┌──────────────────────────────────┐
│  FULL-SCREEN BG                  │
│  flex center  px-6               │
│  ┌──────────────────────────┐    │
│  │  GUARD CARD (full width) │    │
│  │  padding: 32px            │    │
│  │  Eyebrow → Heading →      │    │
│  │  Body → Buttons (stacked) │    │
│  │  → Footer                 │    │
│  └──────────────────────────┘    │
└──────────────────────────────────┘
Buttons stack when text wraps:
  flex-wrap on the button container handles this automatically
  Each button ≥44px height on mobile for touch safety
```

---

### 14F. Structural Consistency Validation

```yaml
structural_validation:
  - [x] Single zone justified by operational necessity — the entire workspace
        is the guard message and its two action paths
  - [x] Visual dominance: heading (18px/600) is clearly dominant
  - [x] Spacing rhythm follows 4px scale throughout
  - [x] Mobile adaptations preserve all actions (buttons stack, still reachable)
  - [x] Component nesting matches Section 11
  - [x] Minimum zone count — 1 functional zone (the card) inside 1 background zone
  - [x] No redundant information surfaces
  - [x] Blueprint matches FULL-SCREEN CENTERED CARD pattern from Section 4.1
```

---

## KIRO TASK CHAINING

```yaml
downstream_kiro_tasks:
  task_1:
    name: "Factory Required — Typography + Heading Fix"
    input: This spec → Section 9.3, Section 4.2 acceptance criteria
    output: h1 at 18px; eyebrow at 11px/500; description at leading-relaxed;
      <strong> tags at text-text-primary

  task_2:
    name: "Factory Required — Role-Gated Button + Description"
    input: This spec → Section 3.6, Section 4.2, Section 4.3
    output: "Open factory settings" conditioned on admin/owner role;
      role-aware description text (admin path vs. contact-admin path)

  task_3:
    name: "Factory Required — Button Accessibility Fix"
    input: This spec → Section 4.2 (acceptance criteria), Section 11
    output: Button asChild + Link pattern; no <Link><Button> nesting; ≥44px on mobile

  task_4:
    name: "Factory Required — Surface Cleanup"
    input: This spec → Section 9.4, Section 4.2
    output: No border on guard card; no shadow-md; surface-card on surface-app only
```

---

*End of WORKSPACE_SKELETON_ONBOARDING_FACTORY_REQUIRED.md (Sections 1–14)*
*This file is system-generated architecture. Treat as engineering law until formally amended.*
*Architectural precedent established: authenticated dead-end guard uses full-screen centered
card, NOT AuthWorkstationShell; role-gated action buttons require admin/owner check (not
just user !== null); <strong> emphasis requires text-text-primary not text-text-secondary;
double-border anti-pattern documented and resolved for surface-card on surface-app contexts*


### CODE 
``
```html
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>Factory Access | FactoryNerve OS</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

  <script src="https://cdn.tailwindcss.com"></script>

  <style>
    :root {
      --mouse-x: 0;
      --mouse-y: 0;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      overflow: hidden;
      background:
        radial-gradient(
          circle at top,
          rgba(0, 180, 255, 0.08),
          transparent 40%
        ),
        linear-gradient(
          180deg,
          #08111d 0%,
          #050b14 100%
        );

      color: #d7e3f4;
      font-family: "Hanken Grotesk", sans-serif;
      min-height: 100vh;

      -webkit-font-smoothing: antialiased;

      perspective: 1400px;
    }

    .ambient-glow {
      position: fixed;
      inset: 0;

      background:
        radial-gradient(
          circle at calc(var(--mouse-x) * 1px)
          calc(var(--mouse-y) * 1px),
          rgba(120, 210, 255, 0.06),
          transparent 22%
        );

      pointer-events: none;
      z-index: 0;

      transition: background 0.3s ease;
    }

    .topbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;

      height: 56px;

      display: flex;
      align-items: center;
      justify-content: space-between;

      padding: 0 28px;

      border-bottom: 1px solid rgba(255,255,255,0.05);

      z-index: 10;
    }

    .brand {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.03em;
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 20px;

      color: rgba(215,227,244,0.45);

      font-size: 12px;
      font-family: "JetBrains Mono", monospace;
    }

    .workspace {
      position: relative;
      z-index: 2;

      min-height: 100vh;

      display: flex;
      align-items: center;
      justify-content: center;

      padding: 32px;
    }

    .access-card {
      width: 100%;
      max-width: 520px;

      padding: 40px;

      background: rgba(14, 22, 35, 0.82);

      border:
        1px solid rgba(255,255,255,0.06);

      box-shadow:
        0 40px 120px rgba(0,0,0,0.45);

      transform-style: preserve-3d;

      transition:
        transform 0.25s ease-out,
        box-shadow 0.25s ease-out;

      position: relative;
    }

    .access-card::before {
      content: "";

      position: absolute;
      inset: 0;

      background:
        linear-gradient(
          180deg,
          rgba(255,255,255,0.03),
          transparent 40%
        );

      pointer-events: none;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 10px;

      margin-bottom: 28px;
    }

    .status-dot {
      width: 10px;
      height: 10px;

      border-radius: 999px;

      background: #ffb36b;

      box-shadow:
        0 0 12px rgba(255,179,107,0.5);
    }

    .status-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.18em;

      color: rgba(255,190,120,0.9);

      font-family: "JetBrains Mono", monospace;
    }

    .eyebrow {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.12em;

      color: rgba(215,227,244,0.45);

      margin-bottom: 10px;

      font-family: "JetBrains Mono", monospace;
    }

    h1 {
      margin: 0;

      font-size: 34px;
      line-height: 1.1;
      letter-spacing: -0.04em;

      margin-bottom: 22px;
    }

    .description {
      color: rgba(215,227,244,0.72);

      line-height: 1.8;

      margin-bottom: 34px;
    }

    .actions {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;

      margin-bottom: 36px;
    }

    .primary-btn {
      height: 48px;
      padding: 0 22px;

      border: none;

      background: #9ddfff;

      color: #03131e;

      font-weight: 600;

      cursor: pointer;

      transition:
        transform 0.18s ease,
        background 0.18s ease;
    }

    .primary-btn:hover {
      transform: translateY(-1px);

      background: #b6e9ff;
    }

    .primary-btn:active {
      transform: scale(0.985);
    }

    .secondary-btn {
      height: 48px;
      padding: 0 22px;

      background: transparent;

      border:
        1px solid rgba(255,255,255,0.08);

      color: rgba(215,227,244,0.85);

      cursor: pointer;

      transition:
        background 0.18s ease,
        border 0.18s ease;
    }

    .secondary-btn:hover {
      background: rgba(255,255,255,0.03);

      border-color:
        rgba(255,255,255,0.12);
    }

    .footer-note {
      padding-top: 24px;

      border-top:
        1px solid rgba(255,255,255,0.06);

      color:
        rgba(215,227,244,0.5);

      line-height: 1.7;
    }

    .global-footer {
      position: fixed;

      bottom: 26px;
      left: 0;
      right: 0;

      display: flex;
      justify-content: center;
      gap: 18px;

      font-size: 11px;

      color: rgba(215,227,244,0.28);

      font-family: "JetBrains Mono", monospace;
    }

    @media (max-width: 768px) {
      .access-card {
        padding: 28px;
      }

      h1 {
        font-size: 28px;
      }

      .actions {
        flex-direction: column;
      }

      .primary-btn,
      .secondary-btn {
        width: 100%;
      }
    }
  </style>
</head>

<body>

  <div class="ambient-glow"></div>

  <header class="topbar">
    <div class="brand">
      FactoryNerve OS
    </div>

    <div class="topbar-right">
      <span>v2.4.1</span>
      <span>SECURE</span>
    </div>
  </header>

  <main class="workspace">

    <section class="access-card" id="card">

      <div class="status">
        <div class="status-dot"></div>

        <div class="status-label">
          Workspace access restricted
        </div>
      </div>

      <div class="eyebrow">
        Factory workspace
      </div>

      <h1>
        Factory access is currently unavailable
      </h1>

      <div class="description">
        Your active factory role has either been removed or has not been configured yet.
        Open factory settings to review operational access permissions.
      </div>

      <div class="actions">
        <button class="primary-btn">
          Open factory settings
        </button>

        <button class="secondary-btn">
          Return to sign in
        </button>
      </div>

      <div class="footer-note">
        If you believe this is incorrect, contact your factory administrator to restore access permissions.
      </div>

    </section>

  </main>

  <footer class="global-footer">
    <span>© 2026 FactoryNerve Systems</span>
    <span>Privacy</span>
    <span>Terms</span>
    <span>Support</span>
  </footer>

  <script>
    const card = document.getElementById("card");

    let currentX = 0;
    let currentY = 0;

    let targetX = 0;
    let targetY = 0;

    document.addEventListener("mousemove", (e) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;

      document.documentElement.style.setProperty("--mouse-x", e.clientX);
      document.documentElement.style.setProperty("--mouse-y", e.clientY);

      targetX = (x - 0.5) * 1.2;
      targetY = (y - 0.5) * -1.2;
    });

    function animate() {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;

      card.style.transform = `
        rotateY(${currentX}deg)
        rotateX(${currentY}deg)
      `;

      requestAnimationFrame(animate);
    }

    animate();
  </script>

</body>
</html>
```

``