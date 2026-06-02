# FactoryNerve OS — Frontend Architecture

This file is the contract. Read it before adding a new file. Update it when
the contract changes.

## Six Layers

```
┌─────────────────────────────────────────────────────────┐
│ 6. Routes                  app/<route>/page.tsx         │
│ 5. Workspaces              features/<domain>/workspaces │
│ 4. Feature components      features/<domain>/components │
│ 3. Cross-cutting systems   shared/{tables,forms,ai,…}   │
│ 2. Operational widgets     shared/operational           │
│ 1. Atoms                   shared/primitives            │
│    Tokens                  design-system/tokens.css     │
└─────────────────────────────────────────────────────────┘
```

**Dependency rule:** components import only downward.

A workspace can import features's components and shared/.
A feature component imports shared/ and the same feature's api/hooks.
A shared/ module imports only other shared/ and core/.
Nothing in shared/ imports from features/.

## Folders

```
web/src/
├── app/                    # Next.js routes (thin wrappers only)
├── features/               # business modules (one folder per domain)
│   ├── attendance/
│   ├── entry/
│   ├── ocr/
│   ├── approvals/          # unified approval engine with adapters
│   ├── dashboard/
│   ├── reports/
│   ├── ai/
│   ├── steel/
│   ├── control-tower/
│   ├── billing/
│   ├── settings/
│   └── auth/
├── shared/                 # cross-feature presentation, no business logic
│   ├── primitives/         # atoms (button, input, badge, …)
│   ├── operational/        # workstation-shell, queue-layout, sticky-bar
│   ├── tables/             # data-table system
│   ├── forms/              # field, label, schemas
│   ├── feedback/           # success/error/recovery banners
│   ├── ai/                 # confidence-meter, ai-disclosure, anomaly-strip
│   ├── audit/              # audit-timeline, evidence-panel, lineage-trace
│   ├── layouts/            # full-page shells
│   ├── permissions/        # role gates
│   └── i18n/
├── core/                   # cross-cutting infrastructure
│   ├── api/                # HTTP client (lib/api.ts)
│   ├── query/              # React Query keys
│   ├── stores/             # cross-feature Zustand stores
│   ├── session/            # current user / factory / role
│   ├── realtime/           # workflow-sync bus
│   ├── permissions/        # role gates, navigation rules
│   ├── observability/
│   ├── offline/
│   ├── service-worker/
│   ├── feature-flags/
│   └── routing/
├── design-system/
│   └── tokens.css
└── types/                  # global ambient types only
```

## Migration Strategy

The repo has the new structure in place. Every route is wired through
its feature's public API. The `lib/<domain>.ts` files still contain the
implementations; their feature `api/<domain>.ts` shims re-export from
them for now. Moving the implementations into the feature folders is
purely mechanical and can happen any time without changing consumers.

### Wired features (as of this commit)

| Feature | Public API | Routes wired |
|---|---|---|
| `features/attendance` | workspaces + api + types | `/attendance`, `/attendance/live`, `/attendance/reports`, `/attendance/review` |
| `features/entry` | workspaces + api + helpers + types | `/entry`, `/entry/[id]` (workspace + helpers extracted) |
| `features/ocr` | workspaces + api + types | `/ocr/scan`, `/ocr/history` (route `/ocr/verify` already feature-flag forked) |
| `features/dashboard` | workspaces + api + helpers + operator branch component | `/dashboard` (operator branch extracted as `OperatorDashboardWorkspace`), `/premium/dashboard` |
| `features/reports` | workspaces + api | `/reports`, `/analytics`, `/email-summary` |
| `features/ai` | workspaces + api | `/ai` |
| `features/steel` | workspaces + api + helpers | all 14 `/steel/*` routes (shared formatKg / formatCurrency / tone helpers) |
| `features/approvals` | workspaces + types + adapter scaffold | `/approvals` |
| `features/work-queue` | workspaces | `/work-queue`, `/tasks` |
| `features/control-tower` | workspaces | `/control-tower` |
| `features/billing` | workspaces + api | `/billing`, `/plans` |
| `features/settings` | workspaces + api | `/settings`, `/settings/attendance` |
| `features/profile` | workspaces | `/profile` |
| `features/auth` | workspaces + api | `/forgot-password`, `/reset-password`, `/verify-email` |

### Pattern: shim + replace

1. Create `features/<domain>/api/<domain>.ts` that re-exports from
   `@/lib/<domain>`. New code imports the new path; old code unchanged.
2. Create `features/<domain>/index.ts` exposing the public API.
3. Create `features/<domain>/workspaces/index.ts` re-exporting current
   page components.
4. Update `app/<route>/page.tsx` to import from `@/features/<domain>`.
5. Move the body of `lib/<domain>.ts` into `features/<domain>/api/<domain>.ts`
   when convenient. Replace `lib/<domain>.ts` with a re-export shim.
6. Move workspace bodies (`components/<domain>-page.tsx`) into
   `features/<domain>/workspaces/` when convenient.

Each step is independently shippable.

### Pattern: feature public API

A feature exposes only what's in its `index.ts`. Other features and
routes import from `@/features/<domain>` only. They never reach into
`@/features/<domain>/components/...` directly.

```ts
// features/attendance/index.ts
export * from "./workspaces";
export * as attendanceApi from "./api/attendance";
export type { AttendanceShift, AttendanceStatus } from "./api/attendance";
```

Consumers:

```ts
// good
import { OperatorAttendanceWorkspace, attendanceApi } from "@/features/attendance";

// bad — reaches past the feature boundary
import { punchAttendance } from "@/features/attendance/api/attendance";
```

The badge of a healthy feature is a small `index.ts`. If it grows to
50 exports, the feature is a junk drawer.

## State Ownership

| Class | Owner | Examples |
|---|---|---|
| URL state | router | `?id=N&step=3&pane=workspace` |
| Server state | React Query | OCR detail, attendance today, approvals list |
| Cross-feature | Zustand | session, workflow-sync bus, UI prefs |
| Workflow | workspace hook | step / pane / form draft |
| Local | useState | hover, toggle, focus |

**One owner per piece of state.** No prop drilling, no duplicated truth.

## Workspace FSM Contract

Every workspace honors this contract:

```ts
interface Workspace<TStep, TPane, TStatus> {
  step: TStep;
  pane: TPane;
  status: TStatus;
  hydrateFromUrl(params: URLSearchParams): WorkspaceState;
  serializeToUrl(state: WorkspaceState): URLSearchParams;
  goToStep(next: TStep): void;
  setPane(next: TPane): void;
  detail: UseQueryResult<...>;
  list: UseQueryResult<...>;
  primaryAction: UseMutationResult<...>;
}
```

Reference implementations:
- `hooks/use-ocr-verify-route-state.ts`
- `hooks/use-ocr-scan-route-state.ts`
- `hooks/use-data-table-route-state.ts`

## Approval Engine Contract

Every approvable kind ships an `ApprovalAdapter` (see
`features/approvals/types.ts`). The adapter knows how to:

1. Convert raw backend rows to `ApprovalItem`.
2. Submit approve / reject decisions.
3. Tell the queue where to click through.

Adding a new approvable kind = writing one adapter + registering it in
`features/approvals/adapters/index.ts`. The queue, the card, the bulk
actions never change.

### Adapter status

| Kind | Adapter | Used in production | Notes |
|---|---|---|---|
| attendance | `attendance-approval.adapter.ts` | Yes | `/approvals` queue routes through it |
| entry | `entry-approval.adapter.ts` | Yes | `/approvals` queue routes through it |
| ocr | `ocr-approval.adapter.ts` | Yes | role-gated to manager/admin/owner |
| reconciliation | `reconciliation-approval.adapter.ts` | Yes | role-gated to admin/owner |
| dispatch | (pending) | No | needs backend approval endpoint |
| batch | (pending) | No | currently read-only signals only |

## Token Discipline

Three tiers, three rules:

1. **Primitive tokens** (`--_prim-*`): defined in `tokens.css`. Never
   reference directly in a component.
2. **Semantic tokens** (`--action-primary`, `--status-success-bg`,
   `--surface-card`): meaning-mapped. Components reference these.
3. **Tailwind palette** (`text-emerald-200`, `bg-rose-500/15`): forbidden
   in components. Tokenize first.

This is the rule that keeps dark mode, density modes, and brand changes
a single-file edit.

## Forbidden Patterns

- Importing from another feature's internals (only the public `index.ts`).
  **Enforced by ESLint**: see `eslint.config.mjs` `no-restricted-imports`.
- `core/` importing from `features/*`, `app/*`, or `components/*`.
  **Enforced by ESLint**.
- `shared/` importing from `features/*` or `app/*`.
  **Enforced by ESLint**.
- Hardcoded color values in components (`text-emerald-*`, `#ff0000`,
  `rgba(...)` outside tokens.css).
- Two `useEffect` hooks where one writes state another reads. Use one
  effect per derivation.
- React Query `queryClient.clear()`. Always invalidate explicit keys.
- `console.log` in production code.
- `text-[10px]` or `text-[9px]` (below the 11px legibility floor).
- UPPERCASE labels with `tracking-wide` or wider in operator surfaces.
- Animation libraries. CSS only, ≤150ms transitions.

## Performance Budgets

| Surface | Budget |
|---|---|
| Operator pages (TTI) | < 2s on 3G |
| Page bundle (initial) | < 250KB gzipped |
| Table render | < 16ms / 100 rows |
| Form input lag | < 50ms keystroke |

CI enforces with Lighthouse and bundle analyzer where possible.

## When Adding A New Feature

1. Read this file end-to-end.
2. Create `features/<domain>/`:
   - `index.ts` (public surface)
   - `api/<domain>.ts` (server contract)
   - `workspaces/<role>-<screen>-workspace.tsx` (full pages)
   - `components/` (feature-internal pieces)
   - `hooks/` (feature hooks)
   - `state/` (Zustand stores, only if cross-component within the feature)
3. Add routes under `app/<feature>/page.tsx` that delegate to workspaces.
4. Register navigation in `lib/navigation/registry.ts` with role gates.
5. Add types to `core/api/index.ts` only if cross-cutting.
6. Document non-obvious decisions in the feature's `README.md`.

## When Adding A Component

Decide which tier:

- **Atom** (button, badge): `shared/primitives/`. No business knowledge.
- **Operational widget** (sticky-bar, drawer): `shared/operational/`.
  Industrial-domain concept but feature-agnostic.
- **Cross-cutting system** (table column adapter, AI primitive,
  audit primitive): `shared/<system>/`.
- **Feature component**: `features/<domain>/components/`. Specific to
  one feature.

If you're not sure, default to `features/<domain>/components/`. Promote
upward only when a second feature actually needs it. Premature shared
abstractions are worse than duplication.
