#!/usr/bin/env python3
"""
Live end-to-end test for the failure simulation system.

Connects to a RUNNING backend server via httpx and exercises each
failure mode through the /dev/* API endpoints.

Usage:
    python scripts/live_e2e_test.py [--base-url http://127.0.0.1:8765]
"""

from __future__ import annotations

import sys
import time
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else os.getenv("LIVE_TEST_BASE_URL", "http://127.0.0.1:8765")
TIMEOUT = 15.0

passed = 0
failed = 0
failures: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    global passed, failed
    if condition:
        passed += 1
        print(f"  [PASS] {name}")
    else:
        failed += 1
        msg = f"  [FAIL] {name}"
        if detail:
            msg += f": {detail}"
        print(msg)
        failures.append(f"{name}: {detail}")


def latency_ms(start: float) -> float:
    return (time.perf_counter() - start) * 1000


def section(title: str) -> None:
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}")


try:
    import httpx
except ImportError:
    print("Error: httpx is required. Install with: pip install httpx")
    sys.exit(1)


def main() -> int:
    global passed, failed, failures

    print(f"\n  LIVE E2E FAILURE SIMULATION TEST")
    print(f"  Target: {BASE_URL}")
    print(f"  Time:   {time.strftime('%Y-%m-%d %H:%M:%S')}")

    # ── Verify backend is reachable ──────────────────────────────────────
    section("0. Health Check")
    try:
        resp = httpx.get(f"{BASE_URL}/health", timeout=5.0)
        check("Backend reachable", resp.status_code == 200,
              f"Expected 200, got {resp.status_code}")
        if resp.status_code != 200:
            print("\nBackend is not healthy. Aborting.")
            return 1
    except httpx.ConnectError as e:
        print(f"  [FAIL] Cannot connect to {BASE_URL}: {e}")
        return 1

    def get(path: str, timeout: float = TIMEOUT) -> httpx.Response:
        return httpx.get(f"{BASE_URL}{path}", timeout=timeout)

    def post(path: str, timeout: float = TIMEOUT) -> httpx.Response:
        return httpx.post(f"{BASE_URL}{path}", timeout=timeout)

    # ── 1. Dev API ───────────────────────────────────────────────────────
    section("1. Dev API Endpoints")

    resp = get("/dev/failures")
    check("GET /dev/failures returns 200", resp.status_code == 200)
    if resp.status_code == 200:
        data = resp.json()
        check("  -> total_modes = 13", data.get("total_modes") == 13,
              f"Got {data.get('total_modes')}")
        check("  -> active_count = 0 (start clean)", data.get("active_count") == 0,
              f"Got {data.get('active_count')}")
        check("  -> healthy = True", data.get("healthy") is True)

    resp = get("/dev/status")
    check("GET /dev/status returns 200", resp.status_code == 200)
    if resp.status_code == 200:
        check("  -> total_modes = 13", resp.json().get("total_modes") == 13)

    # ── 2. Enable/Disable Blocking Modes ─────────────────────────────────
    section("2. Blocking Modes (Enable/Disable/Verify)")

    for mode, label, test_path, expected_status in [
        ("ocr_fail", "OCR fail", "/ocr/", 500),
        ("permission_deny", "Permission deny", "/entries/", 403),
        ("worker_crash", "Worker crash", "/jobs/", 500),
        ("queue_backlog", "Queue backlog", "/jobs/", 503),
        ("large_upload", "Large upload", "/ocr/", 413),
    ]:
        # Enable
        resp = post(f"/dev/failures/{mode}/enable")
        check(f"Enable {label}", resp.status_code == 200)

        # Verify blocking
        block_resp = get(test_path)
        check(f"  -> blocks {test_path} with {expected_status}",
              block_resp.status_code == expected_status,
              f"Got {block_resp.status_code}")

        header = block_resp.headers.get("X-Failure-Simulation", "")
        check(f"  -> X-Failure-Simulation = {mode}",
              mode in header,
              f"Got '{header}'")

        # Disable
        resp = post(f"/dev/failures/{mode}/disable")
        check(f"Disable {label}", resp.status_code == 200)

        # Verify recovery
        recovery_resp = get(test_path)
        check(f"  -> no longer blocked after disable",
              recovery_resp.status_code != expected_status,
              f"Still got {recovery_resp.status_code}")

    # Unknown mode
    resp = post("/dev/failures/unknown_mode/enable")
    check("Unknown mode returns 404", resp.status_code == 404)

    # ── 3. Enable-All / Disable-All / Reset ──────────────────────────────
    section("3. Enable-All / Disable-All / Reset")

    resp = post("/dev/failures/enable-all")
    check("Enable-all returns 200", resp.status_code == 200)

    ocr_resp = get("/ocr/")
    check("  -> ocr_fail blocks /ocr/ (500)", ocr_resp.status_code == 500)

    entries_resp = get("/entries/")
    check("  -> permission_deny blocks /entries/ (403)",
          entries_resp.status_code == 403)

    health_resp = get("/health")
    check("  -> health bypasses blocking", health_resp.status_code == 200)

    status_resp = get("/dev/failures")
    if status_resp.status_code == 200:
        check("  -> active_count > 0",
              status_resp.json().get("active_count", 0) > 0)

    resp = post("/dev/failures/disable-all")
    check("Disable-all returns 200", resp.status_code == 200)

    ocr_resp = get("/ocr/")
    check("  -> /ocr/ recovered after disable-all",
          ocr_resp.status_code != 500, f"Got {ocr_resp.status_code}")

    entries_resp = get("/entries/")
    check("  -> /entries/ recovered after disable-all",
          entries_resp.status_code != 403, f"Got {entries_resp.status_code}")

    # Enable-all then reset
    post("/dev/failures/enable-all")
    resp = post("/dev/failures/reset")
    check("Reset returns 200", resp.status_code == 200)
    status_resp = get("/dev/failures")
    if status_resp.status_code == 200:
        data = status_resp.json()
        check("  -> active_count = 0 after reset",
              data.get("active_count") == 0)
        check("  -> healthy after reset", data.get("healthy") is True)

    # ── 4. Env-Override Modes ────────────────────────────────────────────
    section("4. Env-Override Modes")

    for mode, label in [
        ("redis_down", "Redis Down"),
        ("ai_timeout", "AI Timeout"),
        ("ai_unavailable", "AI Unavailable"),
        ("email_fail", "Email Fail"),
        ("disk_full", "Disk Full"),
        ("expired_session", "Expired Session"),
    ]:
        resp = post(f"/dev/failures/{mode}/enable")
        check(f"Enable {label}", resp.status_code == 200)

        status_resp = get("/dev/failures")
        if status_resp.status_code == 200:
            m = status_resp.json().get("modes", {}).get(mode, {})
            check(f"  -> shows active in status", m.get("active") is True)

        resp = post(f"/dev/failures/{mode}/disable")
        check(f"Disable {label}", resp.status_code == 200)

    # ── 5. Slow Network (Latency) ────────────────────────────────────────
    section("5. Slow Network (Latency)")

    start = time.perf_counter()
    get("/", timeout=10.0)
    baseline = latency_ms(start)
    print(f"  Baseline / request: {baseline:.1f}ms")

    post("/dev/failures/slow_network/enable")

    start = time.perf_counter()
    get("/", timeout=10.0)
    slow_elapsed = latency_ms(start)
    print(f"  Slow network / request: {slow_elapsed:.1f}ms")

    check("Latency increased with slow_network",
          slow_elapsed > max(500, baseline * 2),
          f"baseline={baseline:.0f}ms, slow={slow_elapsed:.0f}ms")

    resp = get("/")
    check("X-Failure-Simulation = 'active' on slow requests",
          resp.headers.get("X-Failure-Simulation") == "active",
          f"Got '{resp.headers.get('X-Failure-Simulation')}'")

    post("/dev/failures/slow_network/disable")

    # ── 6. DB Lock (Latency) ────────────────────────────────────────────
    section("6. DB Lock (Latency)")

    start = time.perf_counter()
    get("/", timeout=10.0)
    baseline_db = latency_ms(start)
    print(f"  Baseline / request: {baseline_db:.1f}ms")

    post("/dev/failures/db_lock/enable")

    start = time.perf_counter()
    get("/", timeout=10.0)
    db_slow_elapsed = latency_ms(start)
    print(f"  db_lock / request: {db_slow_elapsed:.1f}ms")

    check("Latency increased with db_lock",
          db_slow_elapsed > max(100, baseline_db * 2),
          f"baseline={baseline_db:.0f}ms, db_lock={db_slow_elapsed:.0f}ms")

    post("/dev/failures/db_lock/disable")

    # ── 7. Combined Modes ────────────────────────────────────────────────
    section("6. Combined Modes")

    post("/dev/failures/ocr_fail/enable")
    post("/dev/failures/permission_deny/enable")

    ocr_resp = get("/ocr/")
    check("ocr_fail > permission_deny for /ocr/",
          ocr_resp.status_code == 500, f"Got {ocr_resp.status_code}")

    entries_resp = get("/entries/")
    check("permission_deny blocks /entries/",
          entries_resp.status_code == 403, f"Got {entries_resp.status_code}")

    health_resp = get("/health")
    check("Health bypasses blocking", health_resp.status_code == 200)

    post("/dev/failures/ocr_fail/disable")
    post("/dev/failures/permission_deny/disable")

    # worker_crash > queue_backlog for /jobs/
    post("/dev/failures/worker_crash/enable")
    post("/dev/failures/queue_backlog/enable")

    jobs_resp = get("/jobs/")
    check("worker_crash > queue_backlog for /jobs/ (500 > 503)",
          jobs_resp.status_code == 500, f"Got {jobs_resp.status_code}")

    post("/dev/failures/worker_crash/disable")
    post("/dev/failures/queue_backlog/disable")

    # ── 7. Final State ───────────────────────────────────────────────────
    section("7. Final State")

    post("/dev/failures/reset")
    status_resp = get("/dev/failures")
    if status_resp.status_code == 200:
        data = status_resp.json()
        check("All modes inactive", data.get("active_count") == 0,
              f"active_count = {data.get('active_count')}")
        check("System healthy", data.get("healthy") is True)
        print(f"\n  Final active_count: {data['active_count']}/{data['total_modes']}")
        print(f"  Final healthy: {data['healthy']}")

    # ── Summary ──────────────────────────────────────────────────────────
    print(f"\n{'=' * 60}")
    print(f"  RESULTS: {passed} passed, {failed} failed")
    print(f"{'=' * 60}")

    if failures:
        print(f"\n  Failures:")
        for f in failures:
            print(f"    - {f}")
        return 1

    print(f"\n  ALL {passed} TESTS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
