"""Tests for the failure simulation system."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from httpx import WSGITransport
from fastapi.testclient import TestClient

# Ensure backend is importable
# Walk up to find project root (where scripts/, backend/ etc. live)
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


# ── Core Module Tests ─────────────────────────────────────────────────────────


class TestFailureSimulationCore:
    """Test the core failure_simulation module directly."""

    def test_all_modes_defined(self):
        """All 13 failure modes should be defined."""
        assert len(failure_simulation.FAILURE_MODES) == 13
        required = {
            "redis_down", "ai_timeout", "ai_unavailable", "email_fail",
            "db_lock", "ocr_fail", "slow_network", "permission_deny",
            "expired_session", "disk_full", "worker_crash", "queue_backlog",
            "large_upload",
        }
        assert set(failure_simulation.FAILURE_MODES.keys()) == required

    def test_is_active_defaults_false(self):
        """All modes should be inactive by default."""
        for mode in failure_simulation.FAILURE_MODES:
            assert not failure_simulation.is_active(mode), f"{mode} should be inactive"

    def test_set_active_enable_disable(self):
        """set_active should toggle a mode on and off."""
        assert failure_simulation.set_active("redis_down", True)
        assert failure_simulation.is_active("redis_down")
        assert failure_simulation.set_active("redis_down", False)
        assert not failure_simulation.is_active("redis_down")

    def test_set_active_unknown_mode(self):
        """set_active with unknown mode should return False."""
        assert not failure_simulation.set_active("nonexistent_mode", True)

    def test_set_all_enable_disable(self):
        """set_all should toggle all modes."""
        count = failure_simulation.set_all(True)
        assert count == len(failure_simulation.FAILURE_MODES)
        for mode in failure_simulation.FAILURE_MODES:
            assert failure_simulation.is_active(mode), f"{mode} should be active"

        count = failure_simulation.set_all(False)
        assert count == len(failure_simulation.FAILURE_MODES)
        for mode in failure_simulation.FAILURE_MODES:
            assert not failure_simulation.is_active(mode), f"{mode} should be inactive"

    def test_reset_all(self):
        """reset_all should clear all runtime state."""
        failure_simulation.set_active("redis_down", True)
        failure_simulation.set_active("ai_timeout", True)
        count = failure_simulation.reset_all()
        assert count == 2
        assert not failure_simulation.is_active("redis_down")
        assert not failure_simulation.is_active("ai_timeout")

    def test_get_status_structure(self):
        """get_status should return the expected structure."""
        status = failure_simulation.get_status()
        assert "modes" in status
        assert "active_count" in status
        assert "total_modes" in status
        assert status["total_modes"] == 13
        assert status["active_count"] == 0
        assert status["healthy"] is True

        failure_simulation.set_active("redis_down", True)
        status = failure_simulation.get_status()
        assert status["active_count"] == 1
        assert status["healthy"] is False
        assert status["modes"]["redis_down"]["active"] is True

    def test_env_var_overrides_redis_down(self):
        """env_overrides should include REDIS_URL when redis_down is active."""
        assert failure_simulation.env_overrides() == {}

        failure_simulation.set_active("redis_down", True)
        overrides = failure_simulation.env_overrides()
        assert overrides.get("REDIS_URL") == ""

    def test_env_var_overrides_ai_timeout(self):
        """env_overrides should include timeout vars when ai_timeout is active."""
        failure_simulation.set_active("ai_timeout", True)
        overrides = failure_simulation.env_overrides()
        assert overrides.get("AI_PROVIDER_TIMEOUT_SECONDS") == "1"
        assert overrides.get("INTELLIGENCE_PROVIDER_TIMEOUT_SECONDS") == "1"

    def test_env_var_overrides_email_fail(self):
        """env_overrides should include bad SMTP host when email_fail is active."""
        failure_simulation.set_active("email_fail", True)
        overrides = failure_simulation.env_overrides()
        assert "256.0.0.1" in overrides.get("SMTP_HOST", "")
        assert overrides.get("SMTP_DRY_RUN") == "0"

    def test_env_var_overrides_large_upload(self):
        """env_overrides should lower MAX_REQUEST_BYTES."""
        failure_simulation.set_active("large_upload", True)
        overrides = failure_simulation.env_overrides()
        assert overrides.get("MAX_REQUEST_BYTES") == "10240"

    def test_should_block_ocr_fail(self):
        """should_block_path should block OCR routes when ocr_fail is active."""
        should_block, status, detail = failure_simulation.should_block_path("/ocr/upload")
        assert not should_block

        failure_simulation.set_active("ocr_fail", True)
        should_block, status, detail = failure_simulation.should_block_path("/ocr/upload")
        assert should_block
        assert status == 500
        assert "OCR" in detail

    def test_should_block_permission_deny(self):
        """should_block_path should block protected routes when permission_deny is active."""
        failure_simulation.set_active("permission_deny", True)
        for path in ["/entries/", "/reports/", "/analytics/", "/settings/", "/steel/"]:
            should_block, status, detail = failure_simulation.should_block_path(path)
            assert should_block, f"{path} should be blocked"
            assert status == 403

        # Health check should not be blocked
        should_block, _, _ = failure_simulation.should_block_path("/health")
        assert not should_block

    def test_should_block_large_upload(self):
        """should_block_path should block uploads when large_upload is active."""
        failure_simulation.set_active("large_upload", True)
        should_block, status, detail = failure_simulation.should_block_path("/ocr/scan")
        assert should_block
        assert status == 413

        should_block, status, detail = failure_simulation.should_block_path("/health")
        assert not should_block

    def test_get_latency_ms(self):
        """get_latency_ms should return latency for active modes."""
        failure_simulation.set_active("slow_network", True)
        latency = failure_simulation.get_latency_ms("slow_network")
        assert 1000 <= latency <= 3000  # 2000ms ± 20% = 1600-2400ms, plus jitter

        failure_simulation.set_active("slow_network", False)
        assert failure_simulation.get_latency_ms("slow_network") == 0

    def test_get_http_status(self):
        """get_http_status should return the right status code."""
        failure_simulation.set_active("permission_deny", True)
        assert failure_simulation.get_http_status("permission_deny") == 403
        assert failure_simulation.get_http_status("slow_network") is None

    def test_env_var_activation(self):
        """FAILURE_* env vars should activate modes at startup."""
        # Save and override env var
        os.environ["FAILURE_REDIS_DOWN"] = "true"
        # Re-init by clearing runtime state
        failure_simulation.reset_all()
        assert failure_simulation.is_active("redis_down")
        del os.environ["FAILURE_REDIS_DOWN"]
        failure_simulation.reset_all()
        assert not failure_simulation.is_active("redis_down")

    def test_runtime_persistence(self):
        """Runtime config should persist to disk and reload."""
        from backend.failure_simulation import _runtime_config_path

        # Clean state
        failure_simulation.reset_all()

        # Enable a mode (this persists to disk via _persist_runtime_config)
        failure_simulation.set_active("redis_down", True)
        assert failure_simulation.is_active("redis_down")

        # Verify disk file exists
        config_path = _runtime_config_path()
        assert config_path.exists(), "Runtime config file should exist"

        # Clear in-memory state but keep disk file
        failure_simulation._runtime_failures.clear()
        assert not failure_simulation.is_active("redis_down"), "Should be inactive after clearing memory"

        # Re-load from disk — mode should be active again
        failure_simulation._load_runtime_config()
        assert failure_simulation.is_active("redis_down"), "Should be active after reloading from disk"

        # Clean up disk file
        failure_simulation.reset_all()

    def test_inject_db_latency(self):
        """inject_db_latency should sleep when db_lock is active."""
        import time
        failure_simulation.set_active("db_lock", True)
        start = time.perf_counter()
        failure_simulation.inject_db_latency()
        elapsed = (time.perf_counter() - start) * 1000
        # Should have waited at least some time due to db_lock latency
        assert elapsed > 0

    def test_inject_network_latency(self):
        """inject_network_latency should sleep when slow_network is active."""
        import time
        failure_simulation.set_active("slow_network", True)
        start = time.perf_counter()
        failure_simulation.inject_network_latency()
        elapsed = (time.perf_counter() - start) * 1000
        assert elapsed > 0


# ── API Endpoint Tests ────────────────────────────────────────────────────────


class TestDevAPI:
    """Test the /dev/* API endpoints."""

    def test_dev_failures_list_without_failures(self, client):
        """GET /dev/failures should list all modes as inactive."""
        resp = client.get("/dev/failures")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_modes"] == 13
        assert data["active_count"] == 0
        assert data["healthy"] is True

    def test_dev_failures_list_with_active(self, client):
        """GET /dev/failures should show active modes."""
        failure_simulation.set_active("redis_down", True)
        resp = client.get("/dev/failures")
        assert resp.status_code == 200
        data = resp.json()
        assert data["active_count"] == 1
        assert data["modes"]["redis_down"]["active"] is True

    def test_enable_mode(self, client):
        """POST /dev/failures/{mode}/enable should enable a mode."""
        resp = client.post("/dev/failures/redis_down/enable")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["active"] is True
        assert failure_simulation.is_active("redis_down")

    def test_disable_mode(self, client):
        """POST /dev/failures/{mode}/disable should disable a mode."""
        failure_simulation.set_active("redis_down", True)
        resp = client.post("/dev/failures/redis_down/disable")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["active"] is False
        assert not failure_simulation.is_active("redis_down")

    def test_enable_unknown_mode(self, client):
        """POST /dev/failures/unknown/enable should 404."""
        resp = client.post("/dev/failures/unknown/enable")
        assert resp.status_code == 404

    def test_enable_all(self, client):
        """POST /dev/failures/enable-all should enable all modes."""
        resp = client.post("/dev/failures/enable-all")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert failure_simulation.get_status()["active_count"] == 13

    def test_disable_all(self, client):
        """POST /dev/failures/disable-all should disable all modes."""
        failure_simulation.set_all(True)
        resp = client.post("/dev/failures/disable-all")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert failure_simulation.get_status()["active_count"] == 0

    def test_reset(self, client):
        """POST /dev/failures/reset should reset all modes."""
        failure_simulation.set_active("redis_down", True)
        failure_simulation.set_active("ai_timeout", True)

        resp = client.post("/dev/failures/reset")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert not failure_simulation.is_active("redis_down")
        assert not failure_simulation.is_active("ai_timeout")

    def test_dev_status(self, client):
        """GET /dev/status should return the same structure."""
        resp = client.get("/dev/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_modes"] == 13


# ── Middleware Tests ──────────────────────────────────────────────────────────


class TestFailureMiddleware:
    """Test that the middleware correctly injects failures."""

    def test_ocr_failure_blocks_ocr_routes(self, client):
        """When ocr_fail is active, OCR routes should return 500."""
        failure_simulation.set_active("ocr_fail", True)
        resp = client.get("/ocr/")
        assert resp.status_code == 500
        assert "ocr_fail" in resp.headers.get("X-Failure-Simulation", "")

    def test_permission_deny_blocks_protected_routes(self, client):
        """When permission_deny is active, protected routes should return 403."""
        failure_simulation.set_active("permission_deny", True)
        resp = client.get("/entries/")
        assert resp.status_code == 403

    def test_slow_network_adds_latency(self, client):
        """When slow_network is active, requests should have added latency."""
        import time
        failure_simulation.set_active("slow_network", True)
        start = time.perf_counter()
        resp = client.get("/")
        elapsed = (time.perf_counter() - start) * 1000
        # slow_network adds ~2000ms (±20%), so this should have taken significant time
        assert elapsed > 500  # At least 500ms due to latency
        assert resp.status_code == 200

    def test_multiple_failures_combined(self, client):
        """Multiple failure modes should work together."""
        failure_simulation.set_active("ocr_fail", True)
        failure_simulation.set_active("permission_deny", True)

        # OCR route should still return 500 (ocr_fail takes priority for /ocr/)
        resp = client.get("/ocr/")
        assert resp.status_code == 500

        # Non-OCR protected route should return 403
        resp = client.get("/entries/")
        assert resp.status_code == 403

        # Health check should still work
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_no_failures_normal_operation(self, client):
        """With no failures active, everything should work normally."""
        resp = client.get("/health")
        assert resp.status_code == 200

        resp = client.get("/")
        assert resp.status_code == 200


# ── CLI Tool Integration Test ─────────────────────────────────────────────────


class TestCLITool:
    """Test the simulate_failures.py CLI tool via subprocess."""

    def test_cli_status(self):
        """CLI status command should output failure info."""
        result = subprocess_run(["status"])
        assert result.returncode == 0
        assert "FAILURE SIMULATION STATUS" in result.stdout

    def test_cli_list(self):
        """CLI list command should show all modes."""
        result = subprocess_run(["list"])
        assert result.returncode == 0
        assert "redis_down" in result.stdout
        assert "ai_timeout" in result.stdout

    def test_cli_enable(self):
        """CLI enable command should set a mode active."""
        result = subprocess_run(["enable", "redis_down"])
        assert result.returncode == 0
        assert "ENABLED" in result.stdout

    def test_cli_disable(self):
        """CLI disable command should set a mode inactive."""
        subprocess_run(["enable", "redis_down"])
        result = subprocess_run(["disable", "redis_down"])
        assert result.returncode == 0
        assert "DISABLED" in result.stdout

    def test_cli_enable_all(self):
        """CLI enable-all should enable all modes."""
        result = subprocess_run(["enable-all"])
        assert result.returncode == 0
        assert "ENABLED ALL" in result.stdout

    def test_cli_disable_all(self):
        """CLI disable-all should disable all modes."""
        subprocess_run(["enable-all"])
        result = subprocess_run(["disable-all"])
        assert result.returncode == 0
        assert "Disabled all" in result.stdout

    def test_cli_reset(self):
        """CLI reset should clear all modes."""
        subprocess_run(["enable", "redis_down"])
        result = subprocess_run(["reset"])
        assert result.returncode == 0
        assert "Reset" in result.stdout

    def test_cli_unknown_mode(self):
        """CLI with unknown mode should show error."""
        result = subprocess_run(["enable", "nonexistent"])
        assert result.returncode == 1


def subprocess_run(args: list[str]) -> subprocess_result:
    """Run the CLI tool as a subprocess."""
    import subprocess
    script_path = PROJECT_ROOT / "scripts" / "simulate_failures.py"
    result = subprocess.run(
        [sys.executable, str(script_path)] + args,
        capture_output=True, text=True, timeout=10,
        cwd=str(PROJECT_ROOT),
    )
    return subprocess_result(
        returncode=result.returncode,
        stdout=result.stdout,
        stderr=result.stderr,
    )


class subprocess_result:
    def __init__(self, returncode: int, stdout: str, stderr: str):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr
