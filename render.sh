#!/usr/bin/env bash
# Render startup wrapper.
#
# 1. Installs dependencies at startup as a safety net — Render's Python
#    buildpack auto-installs during the build phase, but the custom
#    startCommand shell can sometimes use a different Python environment
#    that doesn't have the packages. This ensures deps are always present.
# 2. Runs the real startup script (render_start.py) which handles
#    database migration, env diagnostics, and uvicorn launch.
set -euo pipefail
cd "$(dirname "$0")"

echo "[render-start] Installing dependencies (safety net)..."
python3 -m pip install -r requirements.txt --quiet 2>&1 || echo "[render-start] WARNING: pip install had issues, continuing anyway..."
echo "[render-start] Dependencies ready."

exec python3 scripts/render_start.py "$@"
