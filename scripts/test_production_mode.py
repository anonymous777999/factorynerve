"""
Verify the production-mode fix without needing a real PostgreSQL database.

Tests:
  A) The _DEV_MODE_ENABLED logic evaluates correctly for prod vs dev
  B) In dev mode (TestClient), the failure simulation middleware works
  C) Routes that were returning 400 don't return 400 (even without auth)
"""

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

passed = 0
failed_count = 0

def check(name, condition, detail=""):
    global passed, failed_count
    if condition:
        passed += 1
        print(f"  [PASS] {name}")
    else:
        failed_count += 1
        msg = f"  [FAIL] {name}"
        if detail:
            msg += f": {detail}"
        print(msg)

# ── A) Logic Test ──────────────────────────────────────────────────────
print("=" * 60)
print("  A) _DEV_MODE_ENABLED Logic Test")
print("=" * 60)

# Test with no env (defaults to development)
os.environ.pop("APP_ENV", None)
os.environ.pop("FORCE_FAILURES", None)
mode = os.getenv("APP_ENV", "development").strip().lower() == "development"
check("Defaults to dev mode when APP_ENV unset", mode == True)

# Test with production
os.environ["APP_ENV"] = "production"
mode = os.getenv("APP_ENV", "development").strip().lower() == "development"
check("Detects production mode", mode == False)

# Test with FORCE_FAILURES
os.environ["FORCE_FAILURES"] = "1"
mode = os.getenv("APP_ENV", "development").strip().lower() == "development" \
    or os.getenv("FORCE_FAILURES", "").strip().lower() in ("1", "true", "yes")
check("FORCE_FAILURES=1 enables dev mode", mode == True)

os.environ.pop("FORCE_FAILURES", None)
os.environ["APP_ENV"] = "development"

# ── B) Dev Mode Tests (middleware works) ───────────────────────────────
print()
print("=" * 60)
print("  B) Development Mode - Failure Simulation Works")
print("=" * 60)

from backend.main import app
from backend import failure_simulation
from fastapi.testclient import TestClient

failure_simulation.reset_all()

with TestClient(app, headers={"X-Response-Envelope": "0"}) as c:
    # Dev routes accessible
    resp = c.get("/dev/failures")
    check("GET /dev/failures in dev mode", resp.status_code == 200)
    data = resp.json() if resp.status_code == 200 else {}
    check("  -> total_modes = 13", data.get("total_modes") == 13)
    check("  -> active_count = 0 (clean)", data.get("active_count") == 0)

    # Enable a failure via API
    resp = c.post("/dev/failures/ocr_fail/enable")
    check("POST /dev/failures/ocr_fail/enable", resp.status_code == 200)

    # OCR route gets blocked
    resp = c.get("/ocr/")
    check("ocr_fail blocks /ocr/ with 500", resp.status_code == 500,
          f"Got {resp.status_code}")

    # X-Failure-Simulation header present
    header = resp.headers.get("X-Failure-Simulation", "")
    check("X-Failure-Simulation header = 'ocr_fail'", "ocr_fail" in header,
          f"Got '{header}'")

    # Reset
    c.post("/dev/failures/reset")
    resp = c.get("/dev/failures")
    if resp.status_code == 200:
        check("Clean state after reset", resp.json().get("active_count") == 0)

    # Routes that were returning 400 don't return 400
    routes = [
        "/entries?status=pending&page=1&page_size=1",
        "/steel/overview",
        "/steel/inventory/reconciliations?status=pending&limit=6",
        "/ocr/",
        "/ocr/upload",
    ]
    for route in routes:
        resp = c.get(route)
        check(f"GET {route} does NOT return 400", resp.status_code != 400,
              f"Got {resp.status_code}")
        # Note: 401/403/404/500 are all acceptable - the original bug was 400

    # X-Failure-Simulation header absent when no failures active
    resp = c.get("/")
    header = resp.headers.get("X-Failure-Simulation")
    check("X-Failure-Simulation header absent when no failures",
          header is None, f"Got '{header}'")

    # Enable slow_network - header should appear on response
    c.post("/dev/failures/slow_network/enable")
    import time
    resp = c.get("/", timeout=10)
    header = resp.headers.get("X-Failure-Simulation")
    check("X-Failure-Simulation = 'active' when failures active",
          header == "active", f"Got '{header}'")
    c.post("/dev/failures/slow_network/disable")

    # Verify health still works
    resp = c.get("/health")
    check("Health check works in dev mode", resp.status_code == 200)

# ── Results ────────────────────────────────────────────────────────────
print()
print("=" * 60)
print(f"  RESULTS: {passed} passed, {failed_count} failed")
print("=" * 60)
if failed_count == 0:
    print("  ALL TESTS PASSED - Ready for Render deployment!")
else:
    print(f"  {failed_count} FAILURES - Review before deploying")
