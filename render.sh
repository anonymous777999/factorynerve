#!/usr/bin/env bash
# Render startup wrapper — uses python3 explicitly since
# Render's Python buildpack shell may not have `python` in PATH.
set -euo pipefail
cd "$(dirname "$0")"
exec python3 scripts/render_start.py "$@"
