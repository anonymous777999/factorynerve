# MCP Setup — shadcn/ui + 21st.dev Magic

Both servers are registered in the repo-root `.mcp.json`. This doc explains what they are,
how to make them live, and how to actually use them during the redesign.

## What got added to `.mcp.json`

```jsonc
"shadcn": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "shadcn@latest", "mcp", "--cwd", "web"]
},
"magic": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@21st-dev/magic@latest"],
  "env": { "API_KEY": "${TWENTY_FIRST_API_KEY}" }
}
```

## 1. shadcn MCP  (https://ui.shadcn.com/)
- **Purpose:** browse and install shadcn/ui components (and registry items) straight from
  the model context. It reads `web/components.json` to know where components go.
- **No API key required.**
- **Pinned to `web/`:** the server is launched with `--cwd web` so it reads
  `web/components.json` and installs into `web/src`. You don't need to `cd` manually.
- **CLI fallback** (if the MCP host isn't available): `npm --prefix web exec -- shadcn@latest add <component>`.
- **Typical MCP intents:** "list available shadcn components", "add `dialog dropdown-menu
  select form` to the web project", "show the source of the `button` registry item".

### CLI fallback (always works, use if MCP is unavailable)
```bash
# from repo root
npm --prefix web exec -- shadcn@latest add button card input select dialog dropdown-menu form label tabs badge table
```

## 2. 21st.dev Magic MCP  (https://21st.dev/)
- **Purpose:** generate polished, production-shaped React/Tailwind components from a natural
  language description, and pull curated components/logos. Great for net-new UI (empty
  states, marketing sections, complex cards) that shadcn doesn't ship.
- **Requires an API key.** Get one at https://21st.dev/magic (Console -> API key).
- **Key status: INSTALLED (2026-07-18).** The key lives in the `magic` server's
  `env.API_KEY` inside `.mcp.json`. That file is git-ignored + untracked (`git rm --cached`
  was run), so the secret stays local and never enters git history. Boot-verified against
  `@21st-dev/magic` v0.0.46 (starts clean, no auth error).
- **Do NOT move the key into root `.env.local`** — that file IS tracked and would leak it.
  If you rotate the key, edit `.mcp.json` in place (it stays local) and restart the MCP host.
- **Typical Magic intents:** "/ui a responsive empty-state card for a Restricted report,
  dark theme, warm clay accent (#c56d2d)", "/21 pull a KPI stat card grid".

### If no key is available
Magic will fail to start — that's fine. **Do not block the redesign on it.** Fall back to:
1. shadcn MCP / CLI for standard primitives, then
2. hand-adapt into our tokens following `CONVENTIONS.md`.
Log the missing key in `progress/CHANGELOG.md` under BLOCKED so the human can add it.

## 3. Verifying the servers are live
- Restart the MCP host (the tool that reads `.mcp.json`) after editing it.
- List MCP servers/tools; you should now see `shadcn` and `magic` alongside the existing
  playwright/chrome-devtools/git/filesystem entries.
- Smoke test shadcn: ask it to list components. Smoke test magic: ask for a trivial button;
  if it errors on auth, the key isn't set (expected until step 2 is done).

## 4. Rules for using MCP output (non-negotiable)
1. **Adapt, don't paste.** Magic/registry output uses generic colors and its own `cn`. Rewrite
   colors to our CSS-variable tokens, route through our `@/lib/utils` `cn`, and match house
   style (see `CONVENTIONS.md`).
2. **One system.** Prefer shadcn primitives; use Magic only for compositions shadcn lacks.
   Never introduce a second component library via Magic output.
3. **Place files correctly.** Primitives -> `web/src/components/ui/`. Feature compositions ->
   the relevant `web/src/components/<area>/`.
4. **Token pass required** before commit: no raw hex/rgba survives from generated code.
