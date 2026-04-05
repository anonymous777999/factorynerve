#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-sqlite:///dpr_ai_bootstrap.db}"
MESSAGE="${1:-initial_schema}"

python - <<'PY'
import importlib.util
if not importlib.util.find_spec("alembic"):
    raise SystemExit("Alembic is not installed. Run: pip install -r requirements.txt")
PY

export DATABASE_URL="$DATABASE_URL"
echo "DATABASE_URL=$DATABASE_URL"
python -m alembic revision --autogenerate -m "$MESSAGE"
