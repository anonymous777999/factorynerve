# MCP Server Setup

> Config file: `.mcp.json` (project-scope, gitignored)

---

## Server Inventory

### 1. Playwright MCP — Browser Automation

- **Package:** `@playwright/mcp@latest`
- **Scope:** `project` → `.mcp.json`
- **Command:**
  ```bash
  claude mcp add playwright --scope project -- npx -y @playwright/mcp@latest
  ```
- **Verification:** `/mcp` → `playwright` shows Connected. Tools: `browser_navigate`, `browser_snapshot`, `browser_take_screenshot`, `browser_click`, `browser_fill`, `browser_close`, etc.
- **Re-add on new machine:**
  ```bash
  # 1. Install Playwright browsers first
  npx playwright install --with-deps chromium firefox webkit

  # 2. Add the MCP server
  claude mcp add playwright --scope project -- npx -y @playwright/mcp@latest
  ```

### 2. Chrome DevTools MCP — DevTools-Level Debugging

- **Package:** `chrome-devtools-mcp@latest`
- **Scope:** `project` → `.mcp.json`
- **Command:**
  ```bash
  claude mcp add chrome-devtools --scope project -- npx -y chrome-devtools-mcp@latest --no-usage-statistics
  ```
- **Verification:** `/mcp` → `chrome-devtools` shows Connected. Tools: `list_console_messages`, `list_network_requests`, `take_screenshot`, `evaluate_script`, `performance_start_trace`, `take_snapshot` (a11y tree).
- **Opt-out flag:** `--no-usage-statistics` disables Google telemetry.
- **Re-add on new machine:** Same command as above.

### 3. Filesystem MCP — Scoped File Access

- **Package:** `@modelcontextprotocol/server-filesystem`
- **Scope:** `project` → `.mcp.json`
- **Command:**
  ```bash
  claude mcp add filesystem --scope project -- npx -y @modelcontextprotocol/server-filesystem \
    ./frontend ./backend ./logs ./config ./screenshots ./reports ./artifacts /tmp/qa-workspace
  ```
- **Granted paths (change as needed):**
  - `./frontend` — frontend source code
  - `./backend` — backend source code
  - `./logs` — application logs
  - `./config` — configuration files
  - `./screenshots` — screenshot captures
  - `./reports` — generated reports
  - `./artifacts` — build/test artifacts
  - `/tmp/qa-workspace` — temp workspace
- **Security:** Only paths explicitly listed are accessible. No access to `/`, `~/.ssh`, `.env` files outside these paths.
- **Re-add on new machine:** Same command with adjusted paths for your repo structure.

### 4. Git MCP — Repository Inspection

- **Package:** `mcp-server-git` (via `uvx`)
- **Scope:** `project` → `.mcp.json`
- **Prerequisite:** `uv` must be installed.
- **Command:**
  ```bash
  claude mcp add git --scope project -- uvx mcp-server-git --repository .
  ```
- **Tools:** `git_log`, `git_diff`, `git_diff_staged`, `git_branch`, `git_status`, `git_show`, `git_commit_create` (use with caution).
- **Re-add on new machine:**
  ```bash
  # Ensure uv is installed first
  curl -LsSf https://astral.sh/uv/install.sh | sh
  # Then add the server
  claude mcp add git --scope project -- uvx mcp-server-git --repository .
  ```

### 5. Pre-existing MCP Servers (not part of QA setup)

| Server          | Type   | Status       |
|----------------|--------|-------------|
| `code-review-graph` | stdio | ✅ Active   |
| `vercel`       | http   | ✅ Connected |
| `render`       | http   | ✅ Connected |
| `github`       | http   | ❌ Failed    |

---

## Scope Notes

- **`project` scope** writes config to `.mcp.json` at the repo root.
- **`user` scope** writes to `~/.claude.json` and is available in every project.
- **`local` scope** is private to the current project and tied to your machine.

All QA servers use `project` scope. Since `.mcp.json` is gitignored (see `.gitignore`), this config stays local to each developer's machine.

---

## Upgrade Instructions

To upgrade a server to a newer version:

```bash
# 1. Remove the old server
claude mcp remove <server-name>

# 2. Re-add with @latest or a pinned version
claude mcp add <server-name> --scope project -- <command>
```

For version pinning, replace `@latest` with a specific version like `@1.2.3` in the npm package reference.
