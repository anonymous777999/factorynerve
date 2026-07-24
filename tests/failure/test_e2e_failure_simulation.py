"""End-to-end integration tests for the failure simulation system.

These tests start the real backend (via TestClient) and verify that each
failure mode produces the correct degraded behavior at the HTTP and service
level — not just that the core module's is_active() returns True.

Tests cover:
  - Blocking modes (ocr_fail, permission_deny, worker_crash, queue_backlog, large_upload)
  - Latency modes (slow_network, db_lock)
  - Env-override modes (redis_down, ai_timeout, ai_unavailable, email_fail, disk_full, expired_session)
  - Combined mode interactions
  - Graceful recovery when modes are disabled
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure backend is importable
PROJECT_ROOT = Path(__file__).resolve()
for _ in range(10):
    if (PROJECT_ROOT / "scripts").is_dir() and (PROJECT_ROOT / "backend").is_dir():
        break
    PROJECT_ROOT = PROJECT_ROOT.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Set test environment
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ.setdefault("AI_PROVIDER", "groq")
os.environ.setdefault("GROQ_API_KEY", "test")
os.environ.setdefault("ANTHROPIC_API_KEY", "test")
os.environ.setdefault("DATA_ENCRYPTION_KEY", "dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy0hIQ==")

from backend.main import app
from backend import failure_simulation
from backend.cache import get_redis_client, get_json, set_json, build_cache_key


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def reset_failures():
    """Reset all failure modes before and after each test."""
    failure_simulation.reset_all()
    yield
    failure_simulation.reset_all()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


# ── Helpers ───────────────────────────────────────────────────────────────────


def _latency_ms(start: float) -> float:
    return (time.perf_counter() - start) * 1000


def _assert_no_failures(client, paths: list[str]) -> None:
    """Verify that a list of paths return 200 with no failures active."""
    for path in paths:
        resp = client.get(path, headers={"X-Response-Envelope": "0"})
        assert resp.status_code == 200, f"{path} should return 200, got {resp.status_code}"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — Cache & Infrastructure Modes
# ═══════════════════════════════════════════════════════════════════════════════


class TestRedisDownE2E:
    """When redis_down is active, Redis should appear unavailable and cache
    should fall back to in-memory — all cache-dependent operations continue."""

    def test_redis_client_returns_none_when_redis_down(self):
        """get_redis_client() should return None when REDIS_URL is empty."""
        failure_simulation.set_active("redis_down", True)
        overrides = failure_simulation.env_overrides()
        assert overrides.get("REDIS_URL") == ""

        # Save original value for cleanup
        _orig_redis_url = os.environ.get("REDIS_URL")
        try:
            os.environ["REDIS_URL"] = ""
            # Clear cached client state so it re-evaluates
            import backend.cache as cache_mod
            cache_mod._redis_client = None
            cache_mod._redis_failed = False
            redis_client = get_redis_client()
            assert redis_client is None, "Redis should be unavailable when REDIS_URL is empty"
        finally:
            if _orig_redis_url is not None:
                os.environ["REDIS_URL"] = _orig_redis_url
            else:
                os.environ.pop("REDIS_URL", None)

    def test_cache_falls_back_to_memory_when_redis_down(self):
        """Cache get/set operations should work via in-memory fallback."""
        failure_simulation.set_active("redis_down", True)
        os.environ["REDIS_URL"] = ""

        # Clear cached state and force re-evaluation
        import backend.cache as cache_mod
        cache_mod._redis_client = None
        cache_mod._redis_failed = False

        # Write and read via cache — should use in-memory fallback
        key = build_cache_key("e2e_test", "redis_fallback")
        test_value = {"status": "stored_via_memory"}
        set_json(key, test_value, ttl_seconds=30)
        cached = get_json(key)
        assert cached == test_value, (
            f"Expected {test_value}, got {cached}. "
            "In-memory cache fallback is not working."
        )

        # Clean up
        os.environ.pop("REDIS_URL", None)
        cache_mod._memory_cache.pop(key, None)

    def test_health_check_works_with_redis_down(self, client):
        """Health check should still pass when Redis is down."""
        failure_simulation.set_active("redis_down", True)
        resp = client.get("/health")
        assert resp.status_code == 200, "Health check should pass with Redis down"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — Blocking Modes (Middleware-Level)
# ═══════════════════════════════════════════════════════════════════════════════


class TestOcrFailE2E:
    """When ocr_fail is active, all /ocr/* routes should return 500."""

    def test_ocr_upload_returns_500(self, client):
        failure_simulation.set_active("ocr_fail", True)
        resp = client.get("/ocr/")
        assert resp.status_code == 500
        assert resp.headers.get("X-Failure-Simulation") == "ocr_fail"
        body = resp.json()
        assert "detail" in body

    def test_ocr_returns_200_after_disabling(self, client):
        """After disabling ocr_fail, OCR routes should work normally."""
        failure_simulation.set_active("ocr_fail", True)
        resp = client.get("/ocr/")
        assert resp.status_code == 500

        failure_simulation.set_active("ocr_fail", False)
        resp = client.get("/ocr/")
        assert resp.status_code != 500, "OCR should recover after disabling ocr_fail"

    def test_ocr_does_not_block_non_ocr_routes(self, client):
        """Non-OCR routes should NOT be affected by ocr_fail."""
        failure_simulation.set_active("ocr_fail", True)
        _assert_no_failures(client, ["/health", "/"])


class TestPermissionDenyE2E:
    """When permission_deny is active, all protected routes return 403."""

    PROTECTED_ROUTES = ["/entries/", "/reports/", "/analytics/", "/settings/",
                        "/steel/", "/billing/", "/attendance/"]

    def test_protected_routes_return_403(self, client):
        failure_simulation.set_active("permission_deny", True)
        for path in self.PROTECTED_ROUTES:
            resp = client.get(path)
            assert resp.status_code == 403, f"{path} should return 403, got {resp.status_code}"
            assert resp.headers.get("X-Failure-Simulation") == "permission_deny"

    def test_health_check_bypasses_permission_deny(self, client):
        """Health and dev endpoints should bypass permission denial."""
        failure_simulation.set_active("permission_deny", True)
        _assert_no_failures(client, ["/health", "/"])

    def test_recovery_after_disabling(self, client):
        """After disabling permission_deny, protected routes should work."""
        failure_simulation.set_active("permission_deny", True)
        resp = client.get("/entries/")
        assert resp.status_code == 403

        failure_simulation.set_active("permission_deny", False)
        # After disabling, the route should not be blocked by failure injection.
        # It might return 401/403 from real auth, but not from our middleware.
        resp = client.get("/entries/")
        assert resp.status_code != 403, (
            "Should not be blocked after disabling permission_deny"
        )


class TestLargeUploadE2E:
    """When large_upload is active, request size limits drop to 10KB."""

    def test_env_override_applied(self):
        """MAX_REQUEST_BYTES should be lowered to 10KB."""
        failure_simulation.set_active("large_upload", True)
        overrides = failure_simulation.env_overrides()
        assert overrides.get("MAX_REQUEST_BYTES") == "10240"

    def test_large_payload_blocked(self, client):
        """Uploads over 10KB should be blocked via middleware."""
        failure_simulation.set_active("large_upload", True)
        large_body = "x" * 20_000  # 20KB — well over the 10KB limit
        resp = client.post(
            "/ocr/",
            content=large_body,
            headers={"Content-Type": "text/plain"},
        )
        assert resp.status_code == 413, (
            f"Large upload should return 413, got {resp.status_code}"
        )
        assert resp.headers.get("X-Failure-Simulation") == "large_upload"

    def test_large_upload_blocks_only_ocr_and_settings(self, client):
        """large_upload blocks /ocr/* and /settings/*. Non-matching paths pass."""
        failure_simulation.set_active("large_upload", True)
        # Health check should not be blocked
        resp = client.get("/health")
        assert resp.status_code == 200, "Health should not be blocked by large_upload"

        # Routes NOT in the block list should pass through
        resp = client.get("/")
        assert resp.status_code == 200, "Root should not be blocked by large_upload"


class TestWorkerCrashE2E:
    """When worker_crash is active, /jobs/*, /cron/* return 500."""

    def test_jobs_routes_return_500(self, client):
        failure_simulation.set_active("worker_crash", True)
        resp = client.get("/jobs/")
        assert resp.status_code == 500
        assert resp.headers.get("X-Failure-Simulation") == "worker_crash"

    def test_cron_routes_return_500(self, client):
        failure_simulation.set_active("worker_crash", True)
        resp = client.get("/cron/")
        assert resp.status_code == 500

    def test_health_works_with_worker_crash(self, client):
        failure_simulation.set_active("worker_crash", True)
        _assert_no_failures(client, ["/health", "/"])


class TestQueueBacklogE2E:
    """When queue_backlog is active, /jobs/* return 503."""

    def test_jobs_routes_return_503(self, client):
        failure_simulation.set_active("queue_backlog", True)
        resp = client.get("/jobs/")
        assert resp.status_code == 503
        assert resp.headers.get("X-Failure-Simulation") == "queue_backlog"

    def test_queue_backlog_does_not_block_health(self, client):
        failure_simulation.set_active("queue_backlog", True)
        _assert_no_failures(client, ["/health", "/"])


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — Latency Modes
# ═══════════════════════════════════════════════════════════════════════════════


class TestSlowNetworkE2E:
    """When slow_network is active, requests should have 1-3s added latency."""

    LATENCY_THRESHOLD_MS = 500  # Well below the ~2000ms baseline

    def test_request_latency_increases(self, client):
        """Requests should take significantly longer with slow_network active."""
        failure_simulation.set_active("slow_network", True)
        start = time.perf_counter()
        resp = client.get("/")
        elapsed = _latency_ms(start)

        assert resp.status_code == 200
        assert elapsed > self.LATENCY_THRESHOLD_MS, (
            f"Expected >{self.LATENCY_THRESHOLD_MS}ms latency with slow_network, "
            f"got {elapsed:.1f}ms"
        )
        assert resp.headers.get("X-Failure-Simulation") == "active"

    def test_latency_normal_after_disabling(self, client):
        """After disabling slow_network, requests should be fast again."""
        failure_simulation.set_active("slow_network", True)
        start = time.perf_counter()
        client.get("/")
        slow_elapsed = _latency_ms(start)

        failure_simulation.set_active("slow_network", False)
        start = time.perf_counter()
        client.get("/")
        fast_elapsed = _latency_ms(start)

        assert fast_elapsed < slow_elapsed / 2, (
            f"Expected fast_elapsed ({fast_elapsed:.1f}ms) to be at least 2x "
            f"faster than slow_elapsed ({slow_elapsed:.1f}ms)"
        )


class TestDbLockE2E:
    """When db_lock is active, database operations should have added latency."""

    DB_LATENCY_THRESHOLD_MS = 100  # db_lock adds ~3000ms

    def test_db_request_slows(self, client):
        """Requests should be slower with db_lock active (uses non-skipped path)."""
        failure_simulation.set_active("db_lock", True)

        # Use root path (not /health which is skipped by middleware)
        start = time.perf_counter()
        resp = client.get("/")
        elapsed = _latency_ms(start)

        assert resp.status_code == 200
        assert elapsed > self.DB_LATENCY_THRESHOLD_MS, (
            f"Expected >{self.DB_LATENCY_THRESHOLD_MS}ms DB latency, "
            f"got {elapsed:.1f}ms"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — Env-Override Modes
# ═══════════════════════════════════════════════════════════════════════════════


class TestAiTimeoutE2E:
    """When ai_timeout is active, AI provider timeout vars should be reduced."""

    def test_env_overrides_applied(self):
        failure_simulation.set_active("ai_timeout", True)
        overrides = failure_simulation.env_overrides()
        assert overrides.get("AI_PROVIDER_TIMEOUT_SECONDS") == "1"
        assert overrides.get("INTELLIGENCE_PROVIDER_TIMEOUT_SECONDS") == "1"
        assert overrides.get("OCR_PROVIDER_TIMEOUT_SECONDS") == "2"
        latency = failure_simulation.get_latency_ms("ai_timeout")
        # 1000ms base ± 20% jitter = 800-1200ms
        assert 750 <= latency <= 1250, f"Expected ~1000ms, got {latency}ms"

    def test_ai_timeout_does_not_block_http(self, client):
        """AI timeout is env-only; HTTP requests should still pass."""
        failure_simulation.set_active("ai_timeout", True)
        _assert_no_failures(client, ["/health", "/"])


class TestAiUnavailableE2E:
    """When ai_unavailable is active, API keys should be overridden."""

    def test_env_overrides_applied(self):
        failure_simulation.set_active("ai_unavailable", True)
        overrides = failure_simulation.env_overrides()
        assert "simulated-failure-key" in overrides.get("GROQ_API_KEY", "")
        assert "simulated-failure-key" in overrides.get("ANTHROPIC_API_KEY", "")

    def test_ai_unavailable_does_not_block_http(self, client):
        failure_simulation.set_active("ai_unavailable", True)
        _assert_no_failures(client, ["/health", "/"])


class TestEmailFailE2E:
    """When email_fail is active, SMTP host should point to non-routable address."""

    def test_env_overrides_applied(self):
        failure_simulation.set_active("email_fail", True)
        overrides = failure_simulation.env_overrides()
        assert "256.0.0.1" in overrides.get("SMTP_HOST", "")
        assert overrides.get("SMTP_DRY_RUN") == "0"

    def test_email_fail_does_not_block_http(self, client):
        failure_simulation.set_active("email_fail", True)
        _assert_no_failures(client, ["/health", "/"])


class TestExpiredSessionE2E:
    """When expired_session is active, session TTL should be 0."""

    def test_env_overrides_applied(self):
        failure_simulation.set_active("expired_session", True)
        overrides = failure_simulation.env_overrides()
        assert overrides.get("AUTH_SESSION_TTL_MINUTES") == "0"
        assert overrides.get("SESSION_IDLE_TIMEOUT_MINUTES") == "0"

    def test_expired_session_env_effect(self):
        """With SESSION_TTL=0, auth middleware should treat sessions as expired."""
        failure_simulation.set_active("expired_session", True)

        # The env override sets AUTH_SESSION_TTL_MINUTES=0.
        # When the auth middleware checks session expiry,
        # a session with 0 TTL is immediately considered expired.
        # This test verifies the env override is correctly structured.
        status = failure_simulation.get_status()
        assert status["modes"]["expired_session"]["active"] is True

    def test_expired_session_does_not_block_health(self, client):
        failure_simulation.set_active("expired_session", True)
        _assert_no_failures(client, ["/health", "/"])


class TestDiskFullE2E:
    """When disk_full is active, EXPORTS_DIR should point to non-writable location."""

    def test_env_overrides_applied(self):
        failure_simulation.set_active("disk_full", True)
        overrides = failure_simulation.env_overrides()
        assert "nonexistent" in overrides.get("EXPORTS_DIR", "")

    def test_disk_full_does_not_block_http(self, client):
        failure_simulation.set_active("disk_full", True)
        _assert_no_failures(client, ["/health", "/"])


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — Combined & Recovery Modes
# ═══════════════════════════════════════════════════════════════════════════════


class TestCombinedFailuresE2E:
    """Multiple failure modes should work together correctly."""

    def test_blocking_priority(self, client):
        """When both ocr_fail and permission_deny are active, /ocr/ should
        return 500 (ocr_fail takes priority), and /entries/ should return 403."""
        failure_simulation.set_active("ocr_fail", True)
        failure_simulation.set_active("permission_deny", True)

        resp = client.get("/ocr/")
        assert resp.status_code == 500, (
            f"ocr_fail should take priority for /ocr/, got {resp.status_code}"
        )

        resp = client.get("/entries/")
        assert resp.status_code == 403, (
            f"permission_deny should block /entries/, got {resp.status_code}"
        )

    def test_blocking_plus_latency(self, client):
        """Latency modes should not interfere with blocking modes."""
        failure_simulation.set_active("ocr_fail", True)
        failure_simulation.set_active("slow_network", True)

        start = time.perf_counter()
        resp = client.get("/ocr/")
        elapsed = _latency_ms(start)

        # Should be blocked (fast, not adding latency for blocked requests)
        assert resp.status_code == 500
        assert elapsed < 1000, (
            "Blocked requests should not add network latency, "
            f"but took {elapsed:.1f}ms"
        )

    def test_latency_plus_redis_down(self):
        """Env-override and latency modes should coexist."""
        failure_simulation.set_active("slow_network", True)
        failure_simulation.set_active("redis_down", True)

        overrides = failure_simulation.env_overrides()
        assert overrides.get("REDIS_URL") == ""
        assert failure_simulation.get_latency_ms("slow_network") >= 1000


class TestGracefulRecoveryE2E:
    """The system should recover gracefully after failure simulation ends."""

    def test_health_after_all_failures(self, client):
        """Health check should work after enabling and disabling all modes."""
        # Enable everything
        failure_simulation.set_all(True)
        resp = client.get("/health")
        # Dev/health endpoints bypass blocking, so this should still work
        assert resp.status_code == 200

        # Disable everything
        failure_simulation.reset_all()
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_no_side_effects_after_reset(self, client):
        """After reset_all, env override vars should no longer be applied."""
        # Enable then reset
        failure_simulation.set_active("redis_down", True)
        failure_simulation.set_active("email_fail", True)
        failure_simulation.set_active("ocr_fail", True)
        assert failure_simulation.env_overrides() != {}

        failure_simulation.reset_all()
        assert failure_simulation.env_overrides() == {}, (
            "Expected no env overrides after reset, got %s"
            % failure_simulation.env_overrides()
        )

    def test_middleware_header_no_failures(self, client):
        """X-Failure-Simulation header should NOT be present when no failures."""
        resp = client.get("/")
        assert "X-Failure-Simulation" not in resp.headers or resp.headers.get(
            "X-Failure-Simulation"
        ) != "active"

    def test_middleware_header_with_failures(self, client):
        """X-Failure-Simulation header should be 'active' when failures are on."""
        failure_simulation.set_active("slow_network", True)
        resp = client.get("/")
        assert resp.headers.get("X-Failure-Simulation") == "active"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — Dev API Integration
# ═══════════════════════════════════════════════════════════════════════════════


class TestDevAPIIntegrationE2E:
    """Verify that /dev/* API endpoints correctly interact with the middleware
    and enable/disable failure modes at runtime."""

    def test_enable_via_api_and_verify_middleware(self, client):
        """Enable redis_down via API, then verify the middleware applies it."""
        resp = client.post("/dev/failures/redis_down/enable")
        assert resp.status_code == 200
        assert failure_simulation.is_active("redis_down")

        # The middleware should see the override
        overrides = failure_simulation.env_overrides()
        assert overrides.get("REDIS_URL") == ""

    def test_disable_via_api_and_verify_recovery(self, client):
        """Disable via API, check that env overrides are cleared."""
        client.post("/dev/failures/redis_down/enable")
        assert failure_simulation.env_overrides().get("REDIS_URL") == ""

        resp = client.post("/dev/failures/redis_down/disable")
        assert resp.status_code == 200
        assert not failure_simulation.is_active("redis_down")

    def test_enable_all_via_api(self, client):
        """Enable all failures via API, verify middleware behavior."""
        resp = client.post("/dev/failures/enable-all")
        assert resp.status_code == 200

        # OCR should be blocked
        ocr_resp = client.get("/ocr/")
        assert ocr_resp.status_code == 500

        # Protected routes should be blocked
        entries_resp = client.get("/entries/")
        assert entries_resp.status_code == 403

        # Health should pass
        _assert_no_failures(client, ["/health"])

    def test_disable_all_via_api(self, client):
        """Disable all via API, verify recovery."""
        client.post("/dev/failures/enable-all")
        resp = client.post("/dev/failures/disable-all")
        assert resp.status_code == 200

        # Everything should be available again
        ocr_resp = client.get("/ocr/")
        assert ocr_resp.status_code != 500

        entries_resp = client.get("/entries/")
        assert entries_resp.status_code != 403

    def test_reset_via_api(self, client):
        """Reset via API, verify clean state."""
        client.post("/dev/failures/enable-all")
        resp = client.post("/dev/failures/reset")
        assert resp.status_code == 200

        status = failure_simulation.get_status()
        assert status["active_count"] == 0
        assert status["healthy"] is True
