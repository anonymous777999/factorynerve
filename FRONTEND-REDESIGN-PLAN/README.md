# DPR.ai Frontend Redesign — Agent Playbook

> **Who this is for:** Buffy (Freebuff AI coding agent), or any agent/dev picking up the
> frontend redesign. This folder is the **single source of truth** for the redesign. Read
> this file first, then work phase-by-phase from `phases/`.

> **Boot rule:** Do NOT free-improvise the redesign. Follow the phases in order. Each phase
> file is a self-contained work order with exact commands, file targets, acceptance
> criteria, and a verification step. Check a box only after you verified it.

---

## 0. TL;DR of the situation

The app lives in `web/` (Next.js 16, React 19, Tailwind v4, App Router, ~94 routes, 287
`.tsx` files, 5 locales). The backend is done; this is a **frontend-only** effort.

A real design-token system exists in `web/src/app/globals.css` and shadcn-shaped primitives
exist in `web/src/components/ui/*` — **but almost nobody uses them consistently.** The
result looks unpolished. Full findings: `reference/AUDIT.md`.

The redesign standardizes on **ONE component system (shadcn/ui) + the existing CSS-variable
tokens**, wired up with two MCP servers (shadcn + 21st.dev Magic) so components are pulled
from registries instead of hand-written. See `reference/MCP_SETUP.md`.

---

## 1. The golden rules (do not break these)

1. **One system only.** shadcn/ui is the single source of truth. Do **not** add HeroUI, MUI,
   Chakra, Ant, or a second kit. Mixing kits is the #1 cause of the current mess.
2. **Tokens, not literals.** Never write raw `#hex` or `rgba()` in a `.tsx`. Use the CSS
   variables / Tailwind token classes. (Today there are ~1,332 raw hex + ~1,436 rgba
   literals in components — that is the disease, not the cure.)
3. **Primitives, not raw tags.** Use `@/components/ui/*` (`Button`, `Card`, `Input`, `Tabs`,
   ...). Do not write raw `<button>` or re-define local `TabButton`/`StatCard`.
4. **Smallest correct diff, one phase at a time.** Do not start Phase N+1 until Phase N's
   acceptance criteria pass. Update every call site when you change a shared component.
5. **Verify before you claim done.** Run the build, the overflow audit, and the a11y tests.
   Paste real output into the phase's progress log. "Looks right" is not verification.
6. **Preserve behavior.** This is a visual/structural redesign. Do not change API calls,
   auth, routing logic, or data shapes unless a phase explicitly says so.
7. **MCP-first for components.** When you need a new component, pull it via the shadcn MCP
   or 21st.dev Magic MCP (see `reference/MCP_SETUP.md`) and then adapt it to our tokens —
   don't hand-write from scratch, and don't paste external output wholesale.

---

## 2. How to use this playbook (agent loop)

For each phase:

1. Open `phases/PHASE_<n>_*.md`. Read the **Goal**, **Preconditions**, **Tasks**.
2. Do the tasks in order. Use the exact commands given.
3. Run the **Verification** block. Capture output.
4. Tick the checkboxes in that phase file and append a dated entry to
   `progress/CHANGELOG.md`.
5. Only then move to the next phase.

If a task is blocked (missing key, failing build you didn't cause), **stop and report** in
`progress/CHANGELOG.md` under a `BLOCKED` heading — don't paper over it.

---

## 3. Phase index

| Phase | File | Theme | Priority |
|------:|------|-------|----------|
| 0 | `phases/PHASE_0_SETUP.md` | MCP + shadcn stack + `cn()` fix + guardrails | Critical |
| 1 | `phases/PHASE_1_FOUNDATION.md` | Tokens, color unification, breakpoints, fonts | Critical |
| 2 | `phases/PHASE_2_COMPONENTS.md` | Buttons, forms, cards, tabs, icons, nav | High |
| 3 | `phases/PHASE_3_LAYOUT_SHELL.md` | Decompose `app-shell`, responsive grids, fix billing/reports | High |
| 4 | `phases/PHASE_4_VISUAL_POLISH.md` | Type scale, spacing rhythm, micro-interactions | Medium |
| 5 | `phases/PHASE_5_A11Y_DEVICE.md` | Contrast, tap targets, focus, device matrix tests | High |

Supporting docs:
- `reference/AUDIT.md` — full findings with file:line evidence.
- `reference/UIUX_DEFECT_INVENTORY.md` — **every code-level UI/UX defect** (color leaks, tiny text, z-index, viewport traps, a11y, DRY) as fixable DEF-IDs with grep evidence + phase.
- `reference/PAGE_REFERENCE_MAP.md` — **every route → shadcn/Magic component reference + verdict.** Read this when rebuilding any page.
- `reference/ATOMIC_COMPONENT_REFERENCE.md` — **every small UI atom** (checkbox, switch, scrollbar, tooltip, spinner, pagination…) with status, shadcn item, Magic pull, and verdict.
- `reference/COMPONENT_COVERAGE_MATRIX.md` — one-row-per-atom quick lookup + build priority order.
- `reference/MCP_SETUP.md` — how to enable & use both MCP servers.
- `reference/DESIGN_TOKENS.md` — the canonical token contract.
- `reference/CONVENTIONS.md` — do/don't cheatsheet for every change.
- `reference/EXTERNAL_DRAFTS.md` — how to handle v0/Lovable/Figma inputs.
- `progress/CHANGELOG.md` — running log; every phase appends here.

---

## 4. Scope guardrails

- **In scope:** everything under `web/src/` (components, app routes, `globals.css`,
  `tailwind.config.ts`, `lib/utils.ts`, `components.json`).
- **Out of scope:** `backend/`, `alembic/`, anything Python, `frontend/` (legacy Jinja
  templates — the live app is `web/`), API contracts, and business logic.
- **Never touch:** `.env*`, auth token handling, payment/Razorpay flows' logic (you may
  restyle their UI, not their behavior).

---

## 5. Definition of done (whole redesign)

- `npm run build` passes with no new type/lint errors.
- `npm run audit:overflow` reports zero horizontal-overflow regressions at 360/768/1024/1440.
- `npm run test:a11y` passes (contrast, focus, labels).
- Zero raw `#hex`/`rgba()` in changed files; zero raw `<button>` in changed files.
- One accent identity across the whole app (no blue/orange split).
- Every phase file's checkboxes are ticked and logged in `progress/CHANGELOG.md`.
