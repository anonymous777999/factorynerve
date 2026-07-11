#!/usr/bin/env bash
# Render startup wrapper — used as startCommand when using the Python buildpack.
# When using Docker (current config), this script is not needed because the
# Dockerfile handles pip install during the Docker build phase.
set -euo pipefail
cd "$(dirname "$0")"
exec python3 scripts/render_start.py "$@"
