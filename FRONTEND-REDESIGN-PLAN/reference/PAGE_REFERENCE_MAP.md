# Page-by-Page Component Reference Map

> Every route grouped by structural archetype, with the exact reference to pull from
> **shadcn/ui** and **21st.dev Magic**, plus a **VERDICT** on which to use and why. This is
> the practical bridge between the audit and actual building.
>
> **How to use (agent):** find the page -> read its archetype -> pull the "USE" source via
> the matching MCP (see MCP_SETUP.md) -> token-adapt per CONVENTIONS.md. Never paste output
> unadapted.
>
> **Decision rule:** shadcn = structural/interactive primitives (tables, tabs, dialogs,
> forms) - accessible, merges with our tokens, default choice. 21st.dev Magic = polished
> visual compositions shadcn does not ship (KPI grids, empty states, hero/pricing sections).
> When both fit, prefer shadcn for interactive/data-bound, Magic for hero/marketing/empty.

Matrix legend: Table / Chart / Tabs / Form / Grid / KPI / Search.

---

## Archetype A - KPI / Intelligence Dashboard
Dense stat cards + charts + tab-switched sections. The visual centerpiece of the app.

**Pages (14):** dashboard (dashboard-home), premium/dashboard, control-tower, steel
(command-center), analytics, ai (ai-insights), email-summary, and the *-intelligence family:
steel/financial-intelligence (**210 raw hex!**), steel/production-intelligence,
steel/inventory-intelligence (67), steel/sales-intelligence (87), steel/fraud-intelligence,
steel/scrap-loss-intelligence, workforce.

**shadcn references:** card, tabs, badge, separator, scroll-area, chart (Recharts wrapper),
hover-card, skeleton. Block: dashboard-01 as layout skeleton.

**21st.dev Magic references:** search "KPI stat card", "metric card grid", "analytics
dashboard cards". /ui prompt: "responsive KPI grid of 4 metric cards (label, big value,
delta % with up/down arrow, sparkline), dark theme, warm clay accent #c56d2d, CSS-var tokens."

**VERDICT - USE shadcn for structure (card/tabs/chart) + Magic for the StatCard visual.**
Tab-switching and chart wiring must be robust/accessible (shadcn). The stat-card LOOK is
where Magic earns its keep - pull ONE great StatCard, token-adapt it, make it the shared
components/shared/StatCard. 14 pages depend on it - highest-leverage component in the app.
Do NOT keep ApexCharts AND shadcn chart both; pick one charting lib.

---

## Archetype B - Data Table / List
Searchable/filterable table of records with row actions. The workhorse screens.

**Pages (22):** approvals, work-queue, steel/batches, steel/customers, steel/dispatches,
steel/invoices, steel/vendors (26), steel/machines, steel/machine-alerts, steel/inventory,
steel/inventory/transactions, steel/expenses (23), steel/production/lines (20),
steel/anomalies, steel/quality (**202 hex!**), steel/reconciliations, attendance/reports,
attendance/review, attendance/live, ocr/history, analytics, reports.

**shadcn references:** table + data-table pattern (TanStack recipe - you already have
@tanstack/react-table + react-virtual), input (search), select + dropdown-menu (filters/row
actions), badge (status), checkbox, pagination, scroll-area.

**21st.dev Magic references:** search "data table toolbar", "table empty state", "filter
bar". Use /ui only for the empty state and filter toolbar visuals.

**VERDICT - USE shadcn (data-table recipe) almost exclusively.**
Interactive, virtualized, sortable, accessible data = shadcn + TanStack strength, and you own
the deps. Magic tables are pretty but not wired. Pull only EmptyState + filter toolbar from
Magic. Build ONE shared DataTable wrapper (toolbar+search+column menu+pagination+mobile card
fallback) reused across all 22 pages. Mobile: table -> stacked cards below md.

---

## Archetype C - Detail / Record View
Single-record read view: header, meta, related sub-lists, timeline.

**Pages (6):** entry/[id], steel/batches/[id], steel/customers/[id] (ledger),
steel/dispatches/[id], steel/invoices/[id], notifications/[id].

**shadcn references:** card, separator, badge, tabs (sub-sections), table (line items),
breadcrumb, button. Invoices: card + print (you use jspdf).

**21st.dev Magic references:** search "detail page header", "record summary panel", "timeline
activity". /ui prompt: "record detail header (title, status badge, key-value meta row, action
buttons) above a two-column summary-card layout; dark, tokenized."

**VERDICT - USE shadcn for structure + Magic for PageHeader + Timeline visuals.**
Layout is standard (shadcn card/breadcrumb/tabs); a polished header and activity timeline are
where Magic adds shine. Build shared PageHeader + Timeline once; reuse across all 6.

---

## Archetype D - Form / Settings
Input-heavy configuration or record-creation screens.

**Pages (9):** settings, settings/attendance, settings/users, profile, admin-billing,
billing, steel/production/record, steel/reconciliations, onboarding/factory-required.

**shadcn references:** form (RHF + zod recipe), input, textarea, select, checkbox, switch,
radio-group, label, tabs (settings sections), dialog (confirm), sonner/toast.

**21st.dev Magic references:** search "settings form section", "profile form", "pricing
checkout card". Use Magic ONLY for the billing/admin-billing checkout card (current desktop
billing is visibly broken - see AUDIT).

**VERDICT - USE shadcn form end-to-end; Magic only for the billing checkout card.**
Forms need validation/accessibility/label association - shadcn form (RHF+zod) is the correct
backbone; Magic forms usually lack wiring. Billing checkout is the one spot to pull a Magic
composition (fix the overlap/empty-column bug) and token-adapt.

---

## Archetype E - Auth
Login / register / password / verification, inside the animated auth-shell.

**Pages (5):** access (login, 356L), register (407L), forgot-password, reset-password,
verify-email. (login just redirects to access.)

**shadcn references:** card, input, label, button, form, input-otp (verify/2FA), alert.
Block: login-03 / login-04 as structural reference.

**21st.dev Magic references:** search "auth split screen", "login hero panel", "sign in
card". /ui prompt: "split-screen auth: left brand panel with subtle animated mesh, right a
sign-in card; dark, warm clay accent, IBM Plex/Space Grotesk; NOT blue."

**VERDICT - USE shadcn form/input-otp for fields + Magic for the brand panel.**
auth-shell has nice animations but is BLUE (Phase 1 fixes). Keep the shell, swap inner fields
to shadcn form+input (retires .auth-input); optionally refresh the brand panel from Magic and
recolor to accent. Kill inline SVG icons here (use lucide).

---

## Archetype F - Marketing / Public
Landing, pricing, features, and the many "coming soon" placeholders.

**Pages (11+):** / (home-route/landing), pricing, plans (pricing-page), signup, plus
coming-soon-backed: about, features, compliance, privacy, terms, cookies, dpa, sla, refunds,
acceptable-use, data-retention, disclosure, subprocessors, security. Long-form legal:
contact, eula, faq.

**shadcn references:** card, accordion (FAQ), badge, button, tabs (monthly/annual toggle).

**21st.dev Magic references:** search "pricing table", "hero section", "feature grid",
"coming soon page", "CTA section". /ui for hero, feature grid, 3-tier pricing table + toggle,
and ONE reusable coming-soon template.

**VERDICT - USE 21st.dev Magic as primary here; shadcn only for accordion/pricing toggle.**
The ONE archetype where Magic clearly wins - marketing visuals are its core catalog and
shadcn does not ship them. Pull, token-adapt to clay. Build ONE ComingSoon template for the
~13 placeholder pages. Pricing must reflect real Razorpay tiers (do not invent).

---

## Archetype G - Specialized / Bespoke
Custom interaction surfaces that do not map to a generic pattern.

**Pages:** ocr/scan (99KB camera capture, 76 hex), ocr/verify (98KB OCR correction grid),
attendance/live (live roster), alerts, notifications, my-tasks, 403, offline.

**shadcn references:** dialog/sheet (mobile capture), progress, toast, card, badge, table
(verify grid), tooltip, alert.

**21st.dev Magic references:** search "camera capture UI", "file upload dropzone",
"notification list", "empty inbox". Magic for the notifications/alerts list-item + empty
states only.

**VERDICT - USE mostly hand-built on shadcn primitives; Magic for list-item + empty visuals.**
OCR scan/verify are bespoke, high-logic - do not source wholesale; rebuild their chrome on
shadcn primitives (sheet, progress, dialog) and keep the custom logic. Pull only the
notification list-item and empty-state visuals from Magic.

---

## Rollup: build ONCE, reuse everywhere (the shared kit)

| Shared component | Source verdict | Reused by |
|---|---|---|
| StatCard / metric card | Magic visual, token-adapted | Archetype A (14 pages) |
| DataTable (toolbar+search+cols+pagination+mobile cards) | shadcn (TanStack recipe) | Archetype B (22 pages) |
| PageHeader | Magic visual | A, C, D, G |
| EmptyState | Magic visual | B, F, G (fixes repeated "Restricted") |
| Timeline | Magic visual | C |
| FilterToolbar | shadcn (input+select+dropdown-menu) | B |
| ComingSoon template | Magic | F (~13 pages) |
| Section / CardGrid | shadcn / hand (tokens) | all |
| Auth fields | shadcn form/input/input-otp | E |

> Build these nine first (Phase 2) and ~80 of the 88 pages become assembly, not authorship.

## Per-component sourcing checklist
1. Pull from the "USE" source via MCP (shadcn MCP or Magic MCP).
2. Delete generic colors -> our CSS-var tokens (DESIGN_TOKENS.md).
3. Route className through our cn (tailwind-merge).
4. Replace icons with lucide-react.
5. Verify responsive at 360/768/1024/1440 + audit:tokens clean.
6. Log the source + adaptation in progress/CHANGELOG.md.

## Coverage note
This maps ~88 routes into 7 archetypes. When MCP servers are live (shadcn loaded, Magic keyed),
the agent pulls each shared component from its verdict source, and every page's block above
tells it exactly which primitives to assemble. Update this file if a new page does not fit an
archetype.
