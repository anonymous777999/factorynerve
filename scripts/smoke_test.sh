#!/usr/bin/env bash
set -euo pipefail

# ────────────────────────────────────────────────────────────
# smoke_test.sh
# Pre-deploy smoke test: runs Alembic migrations against a
# test database, starts the backend, and verifies the
# /observability/ready endpoint responds 200.
#
# Usage:
#   export DATABASE_URL="postgresql://..."   # required
#   bash scripts/smoke_test.sh
# ────────────────────────────────────────────────────────────

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

PASS=0
FAIL=0

pass() { echo "  [PASS] $1"; ((PASS++)); }
fail() { echo "  [FAIL] $1"; ((FAIL++)); }
warn() { echo "  [WARN] $1"; }

echo ""
echo "============================================"
echo "  Pre-Deploy Smoke Test"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================"
echo ""

# ── Check prerequisites ───────────────────────────────
echo "-- Prerequisites -------------------------------------"

if [ -z "${DATABASE_URL:-}" ]; then
  fail "DATABASE_URL is not set"
  echo "Set DATABASE_URL to a PostgreSQL or SQLite test database and retry."
  exit 1
else
  pass "DATABASE_URL is set"
fi

if command -v python &>/dev/null; then
  pass "python is available"
else
  fail "python is not available"
  exit 1
fi

echo ""

# ── Step 1: Run Alembic migrations ────────────────────
echo "-- Step 1: Run Alembic migrations -------------------"
if python -m alembic upgrade head 2>&1; then
  pass "Alembic upgrade head"
else
  fail "Alembic upgrade head"
fi

echo ""

# ── Step 2: Start server & health check with retries ────
echo "-- Step 2: Health endpoint check --------------------"
PORT=18765

python -m uvicorn backend.main:app --host 127.0.0.1 --port "$PORT" > /dev/null 2>&1 &
SERVER_PID=$!

# Retry loop: try up to 10 times, 2s apart
HEALTHY=false
for i in $(seq 1 10); do
  if curl -sf "http://127.0.0.1:$PORT/observability/ready" > /dev/null 2>&1; then
    HEALTHY=true
    break
  fi
  sleep 2
done

if [ "$HEALTHY" = true ]; then
  pass "/observability/ready responded 200"
elif curl -s "http://127.0.0.1:$PORT/observability/ready" 2>&1 | head -20; then
  fail "/observability/ready returned non-200 (see above)"
else
  fail "Server did not start within 20 seconds"
fi

kill "$SERVER_PID" 2>/dev/null || true
wait "$SERVER_PID" 2>/dev/null || true

echo ""

# ── Summary ────────────────────────────────────────────
echo "============================================"
echo "  Results: ${PASS} passed, ${FAIL} failed"
echo "============================================"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
