# Installation Report

> Generated: July 9, 2026
> Host: Windows 10 (build 26200), Git Bash (MINGW64)
> Project root: `D:\DPR APP\DPR.ai`

---

## Base Runtimes

| Tool     | Version      | Source               |
|----------|-------------|----------------------|
| Node.js  | v24.14.0    | Pre-installed        |
| npm      | 11.9.0      | Ships with Node.js   |
| pnpm     | 10.33.3     | Pre-installed        |
| Python   | 3.12.10     | Pre-installed        |
| pip      | 26.1.2      | Pre-installed        |
| uv       | 0.11.27     | Pre-installed        |
| uvx      | 0.11.27     | Ships with uv        |
| Git      | 2.45.1.windows.1 | Pre-installed    |
| Claude Code | 2.1.161  | Pre-installed        |

## Browsers (Playwright-managed)

All installed under `C:\Users\shubh\AppData\Local\ms-playwright\`:

| Browser               | Version        | Status |
|-----------------------|---------------|--------|
| Chromium for Testing  | 1228          | ✅ Pre-installed |
| Chrome Headless Shell | 1228          | ✅ Pre-installed |
| Firefox               | 1532          | ✅ Pre-installed |
| WebKit                | 2311          | ✅ Pre-installed |
| FFmpeg                | 1011          | ✅ Pre-installed |

Also detected: Google Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe` (not in PATH).

## MCP Servers Installed

| Server          | Package                                   | Command                     | Scope   |
|----------------|-------------------------------------------|-----------------------------|---------|
| playwright     | `@playwright/mcp@latest`                  | `npx -y @playwright/mcp@latest` | project |
| chrome-devtools| `chrome-devtools-mcp@latest`              | `npx -y chrome-devtools-mcp@latest --no-usage-statistics` | project |
| filesystem     | `@modelcontextprotocol/server-filesystem` | `npx -y @modelcontextprotocol/server-filesystem ./frontend ./backend ./logs ./config ./screenshots ./reports ./artifacts /tmp/qa-workspace` | project |
| git            | `mcp-server-git`                          | `uvx mcp-server-git --repository .` | project |

## Packages (project devDependencies)

| Package              | Version   | Added From |
|----------------------|----------|------------|
| `@playwright/test`   | ^1.61.1  | `web/package.json` (already present) |

## Skipped

- **PostgreSQL MCP** — No PostgreSQL instance or `psql` client detected.
- **Docker MCP** — Docker Desktop not installed.

## Artifact Directories Created

```
screenshots/
reports/
playwright-report/
artifacts/
logs/
qa-workspace/
tests/smoke/
tests/regression/
tests/accessibility/
tests/performance/
```

All artifact dirs added to `.gitignore`.
