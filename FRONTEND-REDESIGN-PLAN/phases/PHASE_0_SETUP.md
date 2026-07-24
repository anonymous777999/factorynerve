# Phase 0 — Setup: MCP + shadcn stack + `cn()` fix + guardrails

**Priority:** Critical | **Effort:** Medium | **Depends on:** nothing

## Goal
Make the design system real: enable both MCP servers, install the actual shadcn dependency
stack, fix the `cn()` merge footgun, and add a guardrail script so raw hex/rgba/raw-buttons
can't silently creep back in. After this phase, all later component work is unblocked.

## Preconditions
- You are in the repo root `DPR.ai/`. The app is `web/`.
- `node` and `npx` available (verified: node v24, npx 11.9).

## Tasks

### 0.1 — Confirm MCP servers are registered
- `.mcp.json` already contains `shadcn` and `magic` server entries (added during planning).
- Restart the MCP host so they load. Confirm both appear in the tool/server list.
- If `magic` errors on auth, that's expected until `TWENTY_FIRST_API_KEY` is set — see
  `reference/MCP_SETUP.md`. Log it as BLOCKED and continue; shadcn does not need a key.

### 0.2 — Install the real shadcn stack (in `web/`)
```bash
npm --prefix web install class-variance-authority clsx tailwind-merge tailwindcss-animate
npm --prefix web install @radix-ui/react-slot @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu @radix-ui/react-select @radix-ui/react-label \
  @radix-ui/react-separator @radix-ui/react-toast
```
> `@radix-ui/react-tabs` is already present — don't reinstall.

### 0.3 — Fix `cn()` to actually merge Tailwind classes
- File: `web/src/lib/utils.ts`
- Replace the naive join with clsx + tailwind-merge:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```
- This changes the SIGNATURE from `Array<string|false|null|undefined>` to `ClassValue[]`
  (a superset) — existing call sites keep working. Build to confirm.

### 0.4 — Align `components.json` baseColor with our theme
- File: `web/components.json`. It says `"baseColor": "slate"`. Our surfaces are warm neutrals.
- Leave `cssVariables: true` (we drive everything from `globals.css`). Optionally set
  `baseColor` to `stone` so future `shadcn add` scaffolds warm neutrals instead of cold slate.
  Do NOT let shadcn overwrite our existing `globals.css` tokens when adding components —
  review each `add` diff.

### 0.5 — Add guardrail script + npm script
- Create `web/scripts/audit-design-tokens.mjs` that fails (exit 1) when staged/target `.tsx`
  files under `web/src` contain raw `#rrggbb`, `rgba(`, or `<button` (allowlist
  `web/src/components/ui/**` for primitives that legitimately define base styles).
- Add to `web/package.json` scripts: `"audit:tokens": "node scripts/audit-design-tokens.mjs"`.
- This is the enforcement behind `CONVENTIONS.md`. Wire into pre-commit later if desired.

### 0.6 — Baseline the metrics
- Record current counts so later phases can show progress. Append to
  `progress/CHANGELOG.md`:
```bash
echo "hex: $(grep -rEo '#[0-9a-fA-F]{6}' web/src --include=*.tsx | wc -l)"
echo "rgba: $(grep -rEo 'rgba\(' web/src --include=*.tsx | wc -l)"
echo "raw <button>: $(grep -rE '<button' web/src --include=*.tsx | wc -l)"
echo "arbitrary text-[..]: $(grep -rEo 'text-\[[0-9]' web/src --include=*.tsx | wc -l)"
```

## Verification (must pass before Phase 1)
- [ ] `npm --prefix web run build` completes with no new errors.
- [ ] `web/src/lib/utils.ts` uses `twMerge(clsx(...))`; a quick test proves override wins:
      `cn("px-2","px-4")` -> `"px-4"`.
- [ ] `node web/scripts/audit-design-tokens.mjs` runs and reports the baseline (non-zero, ok).
- [ ] shadcn MCP responds to "list components"; magic status (working / BLOCKED-no-key) logged.
- [ ] Baseline metrics written to `progress/CHANGELOG.md`.

## Rollback
All changes are additive except `cn()` and `components.json`. `git checkout web/src/lib/utils.ts
web/components.json` and `npm --prefix web install` reverts cleanly.
