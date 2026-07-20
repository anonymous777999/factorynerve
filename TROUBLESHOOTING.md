# Troubleshooting Guide

> Real errors encountered during QA environment setup and their resolutions.

---

## MCP Server Issues

### Playwright MCP: "Executable doesn't exist"

**Symptom:** Playwright MCP fails to start because the browser executable is not found.

**Fix:**
```bash
npx playwright install --with-deps
```

Check installed browsers:
```bash
npx playwright install --dry-run
ls ~/AppData/Local/ms-playwright/
```

### Chrome DevTools MCP: Cannot connect to Chrome

**Symptom:** Chrome DevTools MCP fails because Chrome is not in PATH.

**Fix:** Ensure Chrome is installed (detected at `C:\Program Files\Google\Chrome\Application\chrome.exe` locally). If not in PATH, either:
- Add Chrome to PATH, or
- Use Playwright's Chromium for Testing instead (already installed with Playwright).

### Git MCP: "uvx command not found"

**Symptom:** `uvx mcp-server-git` fails.

**Fix:** Install `uv`:
```bash
# Windows (PowerShell as admin)
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### Filesystem MCP: Permission denied

**Symptom:** Cannot read/write files in a granted path.

**Fix:** Verify the path was included in the startup args:
```bash
claude mcp add filesystem --scope project -- npx -y @modelcontextprotocol/server-filesystem \
  ./frontend ./backend ./logs ./config ./screenshots ./reports ./artifacts /tmp/qa-workspace
```

Only paths explicitly listed are accessible.

---

## Playwright Test Runner Issues

### Tests fail with "ERR_CONNECTION_REFUSED"

**Symptom:** Playwright can't connect to the app at `http://127.0.0.1:3000`.

**Fix:**
1. Ensure the dev server is running or let `webServer` in `playwright.config.ts` start it automatically.
2. Check that `python run.py` (backend) and `npm run dev` (frontend) start without errors.
3. Increase `timeout` in the `webServer` config if the app takes longer to start.

### Tests fail on Windows with path separator issues

**Symptom:** File paths with backslashes or forward slashes don't match expected patterns.

**Fix:** Use `path.posix` or `path.win32` explicitly, or normalize paths with `path.resolve()`.

---

## Known Limitations

### Docker Not Available

Docker is not installed on this machine. Any test infrastructure that requires Docker containers must be handled separately (e.g., via CI runners with Docker installed).

### PostgreSQL Not Available

PostgreSQL client (`psql`) is not installed. Database MCP (Postgres MCP Pro) is not configured. Database-level testing is out of scope for this environment.

### MCP Config is Gitignored

`.mcp.json` is in `.gitignore`, so project-scoped MCP configuration is local-only. Each developer needs to run `claude mcp add` commands on their own machine. Consider a setup script if this needs to be automated.

---

## Restarting MCP Servers

If an MCP server is stuck or unresponsive:

```bash
# List all servers
claude mcp list

# Remove and re-add a server
claude mcp remove <server-name>
claude mcp add <server-name> --scope project -- <command>
```

You can also restart Claude Code fresh with `/reload` (Cmd+R) to reconnect all MCP servers.
