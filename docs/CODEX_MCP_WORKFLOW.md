# Codex MCP Workflow

This file standardizes how FactoryNerve uses external context in Codex without turning every task into a setup project.

## Current rollout

As of 2026-04-06, this machine is set up like this:

- `Vercel`: active as a real Codex MCP server through `https://mcp.vercel.com`.
- `GitHub`: available through the local plugin bundle and authenticated `gh` CLI fallback.
- `Figma`: plugin bundle is present locally, but no CLI-side MCP server is configured on this machine.
- `Sentry`: read-only skill is present locally, but requires local env vars before it can query issues.

Important constraint:

- In this environment, `Vercel` is the only one of the four using the `codex mcp` server flow directly.
- `GitHub` and `Figma` are packaged as plugin or connector workflows.
- `Sentry` is a token-backed skill that uses the bundled API script.
- After adding or logging into a new MCP server with `codex mcp`, restart the Codex client or session before expecting new MCP tools to appear in that live session.

## When to use each integration

### Figma

Use for:

- dashboard or page redesign work
- spacing, typography, and component parity checks
- extracting design intent before implementation

Prompt requirements:

- include a Figma file link
- include a frame link or frame or node ID when possible
- say which route or component should match the design

Default expectation:

- if a prompt does not include a Figma link or frame, the task is treated as general UI polish rather than design-parity work

### GitHub

Use for:

- repo or branch context
- PR and issue triage
- release traceability
- CI inspection when paired with `gh`

Prompt requirements:

- include repo, branch, PR number, or GitHub URL
- if the task is about the current branch, say that explicitly

Default expectation:

- use plugin or connector context when available
- use local `git` and `gh` for branch state, Actions logs, and publish flows

### Vercel

Use for:

- preview and production deployment status
- alias verification for `factorynerve.online`
- deployment logs and release sanity checks

Prompt requirements:

- include target environment such as `preview` or `production`
- include project or domain when ambiguity is possible

Default expectation:

- verify Vercel after shipping instead of guessing whether the live site updated

### Sentry

Use for:

- post-deploy regression checks
- recent issue summaries
- issue or event drill-down for production failures

Prompt requirements:

- include Sentry org
- include project
- include environment such as `prod`
- include issue short ID or issue link when available

Default expectation:

- Sentry is only used after local checks and deployment verification
- it does not replace lint, typecheck, build, or tests

## Standard FactoryNerve flow

Use this sequence for UI shipping work:

1. `Figma` for design reference and scope locking
2. local code changes in the repo
3. `GitHub` for branch and PR context
4. local verification: lint, types, build, tests as needed
5. `Vercel` to confirm the actual deployed state
6. `Sentry` to check for immediate post-release regressions

## Prompt conventions

Use prompts with explicit context, not vague requests.

Good examples:

- `Implement the attendance header from this Figma frame: <link>. Match /attendance and keep the existing data flow.`
- `Check the current PR on this branch in GitHub and summarize what still blocks merge.`
- `Verify whether the latest production deploy for factorynerve.online is live in Vercel.`
- `Check Sentry for new prod issues after the latest dashboard deploy in project factorynerve-web.`

Avoid prompts like:

- `make UI better`
- `check deploy`
- `see errors`

Those usually force extra clarification and slow the workflow down.

## Local readiness checklist

Use `scripts/check_codex_mcp_readiness.ps1` from the repo root to verify the current machine state.

It checks:

- `codex mcp` Vercel status
- `gh` authentication
- `vercel` authentication
- local Figma token presence
- local Sentry env var presence

## Required local secrets

### Figma

No local token is currently configured on this machine.

If Figma live access is needed, connect it through the Codex plugin or app flow used by your Codex client, or configure the relevant local Figma credential method supported by your client.

### Sentry

Set these locally before using the Sentry skill:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Recommended token scopes:

- `org:read`
- `project:read`
- `event:read`

Do not paste the token into chat.

## Verification commands

```powershell
codex mcp list
codex mcp get vercel --json
gh auth status
cd web; npx vercel whoami
pwsh scripts/check_codex_mcp_readiness.ps1
```
