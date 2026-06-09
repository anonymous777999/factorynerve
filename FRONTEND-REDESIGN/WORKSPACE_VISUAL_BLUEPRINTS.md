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
