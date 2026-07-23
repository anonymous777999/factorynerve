# QA Automation Architecture

> How the testing and automation components fit together.

---

## High-Level Overview

```
                      ┌─────────────────────────────────────┐
                      │         Claude Code Session          │
                      │     (AI Agent orchestrating tests)   │
                      └───┬──────┬──────┬──────┬──────┬─────┘
                          │      │      │      │      │
         ┌────────────────┘      │      │      │      └──────────────┐
         │                       │      │      │                     │
    ┌────▼────┐           ┌──────▼──┐ ┌──▼───┐ ┌▼────────┐   ┌─────▼─────┐
    │Playwright│           │Chrome    │ │File- │ │Git MCP  │   │(Optional) │
    │MCP       │           │DevTools  │ │system │ │(uvx)    │   │Postgres   │
    │(npx)     │           │MCP (npx) │ │MCP    │ │         │   │MCP Pro    │
    └────┬────┘           └──────┬──┘ └──┬───┘ └──┬───────┘   └─────┬─────┘
         │                       │       │        │                 │
         ▼                       ▼       ▼        ▼                 ▼
    ┌─────────┐           ┌──────────┐ ┌──────┐ ┌──────┐      ┌──────┐
    │Browser  │           │Chrome    │ │Local │ │Git   │      │Post- │
    │(Chromium│◄──────────┤DevTools  │ │File- │ │Repo  │      │greSQL│
    │Firefox, │  CDP/WS   │Protocol  │ │system │ │      │      │DB    │
    │WebKit)  │           │          │ │      │ │      │      │      │
    └─────────┘           └──────────┘ └──────┘ └──────┘      └──────┘

    ┌─────────────────────────────────────────────────────────────┐
    │                    Playwright Test Runner                    │
    │              (@playwright/test, for CI/regression)           │
    │  Config: web/playwright.config.ts                           │
    │  Tests:  web/e2e/*.spec.ts                                  │
    │  Reports: playwright-report/, screenshots/, artifacts/      │
    └─────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

### 1. Playwright MCP
- **Purpose:** Interactive browser control within Claude Code sessions.
- **Usage:** Navigate pages, click elements, fill forms, take screenshots.
- **Under the hood:** Launches Chromium/Firefox/WebKit from `ms-playwright` cache.
- **Config location:** `.mcp.json` (project scope).

### 2. Chrome DevTools MCP
- **Purpose:** DevTools-level inspection — console, network, performance, DOM/a11y.
- **Usage:** Capture console errors, list network requests, run performance traces.
- **Under the hood:** Connects to Chrome via Chrome DevTools Protocol (CDP).
- **Config location:** `.mcp.json` (project scope).

### 3. Filesystem MCP
- **Purpose:** Scoped read/write access to project directories.
- **Usage:** Read log files, write test reports, save screenshots.
- **Access control:** Only paths listed in the startup args are visible.
- **Config location:** `.mcp.json` (project scope).

### 4. Git MCP
- **Purpose:** Repository inspection without leaving the chat.
- **Usage:** Read commit history, view diffs, check branches.
- **Deliberate limitation:** Commit creation is tool-available but should be used with caution.
- **Config location:** `.mcp.json` (project scope).

### 5. Playwright Test Runner (Standalone)
- **Purpose:** Headless regression suite for CI/CD and local verification.
- **Usage:** `npx playwright test` — runs all `e2e/*.spec.ts` tests.
- **Config:** `web/playwright.config.ts` with multiple device profiles.
- **Not an MCP server** — runs as a standalone CLI tool.

---

## Data Flow

```
User Prompt
    │
    ▼
Claude Code ──MCP──► Playwright MCP ──► Browser (page.navigate, click, etc.)
    │                                         │
    │                                         ▼
    │                                   Screenshot/HTML
    │                                         │
    │                                         ▼
    │                                   Filesystem MCP (save to ./screenshots/)
    │
    ├──MCP──► Chrome DevTools MCP ──► DevTools (console, network, perf)
    │
    ├──MCP──► Git MCP ──► Repository (log, diff, status)
    │
    └──MCP──► Filesystem MCP ──► Local files (read configs, write reports)
```

---

## Security Model

| Server        | Attack Surface     | Mitigation |
|---------------|-------------------|------------|
| Playwright    | Browser execution  | Runs in headless mode; no persistent profile |
| Chrome DevTools | CDP access      | Same Chrome instance as Playwright |
| Filesystem    | File read/write    | Path whitelist; no system paths |
| Git           | Repository access  | Read-only operations typically; avoid `git_commit_create` |
| Postgres (skip) | Database access | Not configured |

**Key principle:** Least privilege. Each server gets only the access it needs and nothing more.
