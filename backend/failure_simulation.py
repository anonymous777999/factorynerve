"""
failure_simulation.py — Failure injection engine for local development.

Allows simulating production-like failures (Redis down, AI timeout,
email failure, database lock, etc.) WITHOUT modifying production code.

Two modes:
  1. Env vars:    FAILURE_<MODE>=true/false (static, set before startup)
  2. Runtime API:  Toggle via /dev/failures endpoint or CLI

The middleware (failure_injection.py) reads this module to decide
whether to inject failures on each request.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ── Failure Mode Registry ─────────────────────────────────────────────────────
# Each mode has: env_var, label, description, default latency_ms

FAILURE_MODES: dict[str, dict[str, Any]] = {
    "redis_down": {
        "env_var": "FAILURE_REDIS_DOWN",
        "label": "Redis Unavailable",
        "description": "Makes Redis appear disconnected. Cache falls back to in-memory.",
        "category": "cache",
        "latency_ms": 0,
        "http_status": None,
    },
    "ai_timeout": {
        "env_var": "FAILURE_AI_TIMEOUT",
        "label": "AI Provider Timeout",
        "description": "AI provider calls time out after 1s. Tests retry/fallback logic.",
        "category": "ai",
        "latency_ms": 1000,
        "http_status": None,
    },
    "ai_unavailable": {
        "env_var": "FAILURE_AI_UNAVAILABLE",
        "label": "AI Provider Unavailable",
        "description": "AI provider returns 503 errors. Tests graceful degradation.",
        "category": "ai",
        "latency_ms": 0,
        "http_status": 503,
    },
    "email_fail": {
        "env_var": "FAILURE_EMAIL_FAIL",
        "label": "Email Send Failure",
        "description": "Email sending raises a simulated SMTP error. Tests queue retry logic.",
        "category": "email",
        "latency_ms": 0,
        "http_status": None,
    },
    "db_lock": {
        "env_var": "FAILURE_DB_LOCK",
        "label": "Database Lock Contention",
        "description": "Adds 2-5s artificial delay to database operations. Tests timeout handling.",
        "category": "database",
        "latency_ms": 3000,
        "http_status": None,
    },
    "ocr_fail": {
        "env_var": "FAILURE_OCR_FAIL",
        "label": "OCR Processing Failure",
        "description": "OCR endpoints return 500 errors. Tests error handling in scan flow.",
        "category": "ocr",
        "latency_ms": 0,
        "http_status": 500,
    },
    "slow_network": {
        "env_var": "FAILURE_SLOW_NETWORK",
        "label": "Slow Network / High Latency",
        "description": "Adds 1-3s artificial delay to every request. Tests timeout behavior.",
        "category": "network",
        "latency_ms": 2000,
        "http_status": None,
    },
    "permission_deny": {
        "env_var": "FAILURE_PERMISSION_DENY",
        "label": "Permission Denial",
        "description": "All auth-protected routes return 403. Tests permission gate logic.",
        "category": "auth",
        "latency_ms": 0,
        "http_status": 403,
    },
    "expired_session": {
        "env_var": "FAILURE_EXPIRED_SESSION",
        "label": "Expired Session",
        "description": "All authenticated sessions appear expired. Tests re-login flow.",
        "category": "auth",
        "latency_ms": 0,
        "http_status": 401,
    },
    "disk_full": {
        "env_var": "FAILURE_DISK_FULL",
        "label": "Disk Full / Storage Failure",
        "description": "File write operations raise IOError. Tests upload/export error paths.",
        "category": "storage",
        "latency_ms": 0,
        "http_status": 507,
    },
    "worker_crash": {
        "env_var": "FAILURE_WORKER_CRASH",
        "label": "Background Worker Crash",
        "description": "Background jobs immediately fail with simulated crash. Tests retry/resilience.",
        "category": "jobs",
        "latency_ms": 0,
        "http_status": None,
    },
    "queue_backlog": {
        "env_var": "FAILURE_QUEUE_BACKLOG",
        "label": "Queue Backlog",
        "description": "Job queue reports as backed up. Tests queue monitoring and backpressure.",
        "category": "jobs",
        "latency_ms": 0,
        "http_status": None,
    },
    "large_upload": {
        "env_var": "FAILURE_LARGE_UPLOAD",
        "label": "Large Upload Simulator",
        "description": "Lowers request size limit to 10KB. Tests upload validation.",
        "category": "storage",
        "latency_ms": 0,
        "http_status": 413,
    },
}

# ── Runtime State ─────────────────────────────────────────────────────────────

_lock = threading.Lock()
_runtime_failures: dict[str, bool] = {}
_runtime_file: Path | None = None
_RUNTIME_FILE_NAME = "failures.json"
_EXPORTS_DIR = Path(__file__).resolve().parents[1] / "exports"


def _runtime_config_path() -> Path:
    """Path to the runtime failure config file (JSON)."""
    _EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    return _EXPORTS_DIR / _RUNTIME_FILE_NAME


# ── Public API ────────────────────────────────────────────────────────────────


def is_active(mode: str) -> bool:
    """Check if a failure mode is currently active.

    Priority:
      1. Runtime file (set via API/CLI) — overrides env var
      2. Env var (FAILURE_<MODE>=true) — static config
      3. Default: False
    """
    normalized = mode.strip().lower()
    if normalized not in FAILURE_MODES:
        return False

    # 1. Check runtime state (set via API/CLI)
    with _lock:
        if normalized in _runtime_failures:
            return _runtime_failures[normalized]

    # 2. Check env var
    env_var = FAILURE_MODES[normalized]["env_var"]
    raw = os.getenv(env_var, "").strip().lower()
    if raw in ("1", "true", "yes", "on"):
        return True

    return False


def set_active(mode: str, active: bool) -> bool:
    """Set a failure mode active or inactive at runtime.

    Persists to the runtime config file so it survives across
    reloads within the same process lifetime.

    Returns True if the mode was found and set, False otherwise.
    """
    normalized = mode.strip().lower()
    if normalized not in FAILURE_MODES:
        logger.warning("failure_simulation: unknown mode '%s'", mode)
        return False

    with _lock:
        _runtime_failures[normalized] = active
        _persist_runtime_config()

    status = "ENABLED" if active else "DISABLED"
    logger.info(
        "failure_simulation: %s %s — %s",
        status,
        FAILURE_MODES[normalized]["label"],
        FAILURE_MODES[normalized]["description"],
    )
    return True


def set_all(active: bool) -> int:
    """Enable or disable ALL failure modes.

    Returns the number of modes affected.
    """
    count = 0
    with _lock:
        for mode in FAILURE_MODES:
            _runtime_failures[mode] = active
            count += 1
        _persist_runtime_config()
    logger.info("failure_simulation: %s ALL %d failure modes", "ENABLED" if active else "DISABLED", count)
    return count


def get_status() -> dict[str, Any]:
    """Get the current status of all failure modes.

    Returns a dict with:
      - modes:   dict of mode -> {active, label, description, category, latency_ms}
      - active_count: int
      - source:  "env_var" or "runtime_file"
    """
    modes: dict[str, Any] = {}
    active_count = 0
    source: str = "env_var"

    with _lock:
        has_runtime = bool(_runtime_failures)
        if has_runtime:
            source = "runtime_file"

        for mode, config in FAILURE_MODES.items():
            runtime_val = _runtime_failures.get(mode)
            if runtime_val is not None:
                active = runtime_val
            else:
                env_val = os.getenv(config["env_var"], "").strip().lower()
                active = env_val in ("1", "true", "yes", "on")

            modes[mode] = {
                "mode": mode,
                "active": active,
                "label": config["label"],
                "description": config["description"],
                "category": config["category"],
                "latency_ms": config["latency_ms"],
                "http_status": config["http_status"],
                "source": "runtime" if runtime_val is not None else "env_var",
            }
            if active:
                active_count += 1

    return {
        "modes": modes,
        "active_count": active_count,
        "total_modes": len(FAILURE_MODES),
        "source": source,
        "healthy": active_count == 0,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def reset_all() -> int:
    """Reset ALL failure modes to inactive (clear runtime state).

    Returns the number of modes reset.
    """
    count = 0
    with _lock:
        count = len(_runtime_failures)
        _runtime_failures.clear()
        _remove_runtime_config()
    if count:
        logger.info("failure_simulation: RESET %d failure modes to inactive", count)
    return count


def get_latency_ms(mode: str) -> int:
    """Get the artificial latency to inject for a failure mode.

    Returns 0 if the mode is not active.
    """
    if is_active(mode):
        config = FAILURE_MODES.get(mode, {})
        base = config.get("latency_ms", 0)
        # Add slight jitter (±20%) for realism
        jitter = int(base * 0.2)
        return max(0, base + _jitter(jitter))
    return 0


def get_http_status(mode: str) -> int | None:
    """Get the HTTP status code to return for a failure mode.

    Returns None if the mode has no associated HTTP status.
    """
    if is_active(mode):
        return FAILURE_MODES.get(mode, {}).get("http_status")
    return None


def env_overrides() -> dict[str, str]:
    """Get env var overrides for active failure modes.

    The middleware calls this before each request to set env vars
    that downstream services check (e.g., REDIS_URL, AI_TIMEOUT).
    """
    overrides: dict[str, str] = {}

    if is_active("redis_down"):
        # Override REDIS_URL to empty so get_redis_client() returns None
        overrides["REDIS_URL"] = ""

    if is_active("ai_timeout"):
        # Drastically reduce AI timeouts so they trigger immediately
        overrides["AI_PROVIDER_TIMEOUT_SECONDS"] = "1"
        overrides["INTELLIGENCE_PROVIDER_TIMEOUT_SECONDS"] = "1"
        overrides["OCR_PROVIDER_TIMEOUT_SECONDS"] = "2"

    if is_active("ai_unavailable"):
        # Use an invalid API key so AI calls return auth errors
        overrides["GROQ_API_KEY"] = "simulated-failure-key"
        overrides["ANTHROPIC_API_KEY"] = "simulated-failure-key"

    if is_active("email_fail"):
        # Set SMTP to a non-routable host so sends fail immediately
        overrides["SMTP_HOST"] = "256.0.0.1"
        overrides["SMTP_DRY_RUN"] = "0"

    if is_active("disk_full"):
        # Point exports to a non-writable location
        overrides["EXPORTS_DIR"] = "/dev/null/nonexistent"

    if is_active("large_upload"):
        # Lower request size limit to 10KB
        overrides["MAX_REQUEST_BYTES"] = "10240"

    if is_active("expired_session"):
        # Force session timeout to 0 (already expired)
        overrides["AUTH_SESSION_TTL_MINUTES"] = "0"
        overrides["SESSION_IDLE_TIMEOUT_MINUTES"] = "0"

    return overrides


# Shared list of auth-protected paths used by both should_block_path and
# the middleware's _identify_blocking_mode. Keep in sync with
# _PROTECTED_PATHS in backend/middleware/failure_injection.py.
PROTECTED_PATHS = ["/entries/", "/reports/", "/analytics/", "/ai/", "/settings/",
                   "/steel/", "/ocr/", "/billing/", "/attendance/", "/alerts/",
                   "/feedback/", "/premium/", "/profile/", "/jobs/"]


def protected_paths() -> list[str]:
    """Get path prefixes that should be blocked by permission/session failures."""
    if is_active("permission_deny"):
        return list(PROTECTED_PATHS)
    return []


def should_block_path(path: str) -> tuple[bool, int, str]:
    """Check if a request path should be blocked by an active failure mode.

    Returns (should_block: bool, status_code: int, detail: str)
    """
    normalized_path = path.lower()

    # OCR failure
    if is_active("ocr_fail") and normalized_path.startswith("/ocr/"):
        return True, 500, "Simulated OCR failure: OCR service is currently unavailable."

    # Permission denial
    if is_active("permission_deny"):
        for protected in protected_paths():
            if normalized_path.startswith(protected):
                return True, 403, "Simulated permission denial: Access denied by failure simulation."

    # Worker crash
    if is_active("worker_crash") and normalized_path.startswith(("/jobs/", "/cron/", "/intelligence/")):
        return True, 500, "Simulated worker crash: Background job processor is currently unavailable."

    # Queue backlog
    if is_active("queue_backlog") and normalized_path.startswith("/jobs/"):
        return True, 503, "Simulated queue backlog: Job queue is backed up and not accepting new requests."

    # Large upload
    if is_active("large_upload") and normalized_path.startswith(("/ocr/", "/settings/")):
        return True, 413, "Simulated large upload: Request size exceeds the maximum allowed limit."

    return False, 200, ""


def inject_db_latency() -> None:
    """If FAILURE_DB_LOCK is active, sleep for the configured latency."""
    if is_active("db_lock"):
        sleep_ms = get_latency_ms("db_lock")
        if sleep_ms > 0:
            jitter = int(sleep_ms * 0.3)
            actual = max(0, sleep_ms + _jitter(jitter))
            logger.debug("failure_simulation: injecting %dms DB latency", actual)
            time.sleep(actual / 1000.0)


def inject_network_latency() -> None:
    """If FAILURE_SLOW_NETWORK is active, sleep for the configured latency."""
    if is_active("slow_network"):
        sleep_ms = get_latency_ms("slow_network")
        if sleep_ms > 0:
            jitter = int(sleep_ms * 0.5)
            actual = max(0, sleep_ms + _jitter(jitter))
            logger.debug("failure_simulation: injecting %dms network latency", actual)
            time.sleep(actual / 1000.0)


# ── Internal ──────────────────────────────────────────────────────────────────


def _jitter(max_jitter: int) -> int:
    """Generate a random jitter value in [-max_jitter, +max_jitter]."""
    if max_jitter <= 0:
        return 0
    import random
    return random.randint(-max_jitter, max_jitter)


def _load_runtime_config() -> None:
    """Load runtime failure config from disk."""
    global _runtime_failures, _runtime_file
    config_path = _runtime_config_path()
    if not config_path.exists():
        _runtime_file = None
        return

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            with _lock:
                _runtime_failures.clear()
                for key, value in data.items():
                    if key in FAILURE_MODES and isinstance(value, bool):
                        _runtime_failures[key] = value
                _runtime_file = config_path
            logger.debug("failure_simulation: loaded runtime config from %s", config_path)
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("failure_simulation: could not load runtime config: %s", e)


def _persist_runtime_config() -> None:
    """Save current runtime failure config to disk."""
    config_path = _runtime_config_path()
    try:
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(_runtime_failures, f, indent=2)
        logger.debug("failure_simulation: saved runtime config to %s", config_path)
    except OSError as e:
        logger.warning("failure_simulation: could not save runtime config: %s", e)


def _remove_runtime_config() -> None:
    """Remove the runtime config file from disk."""
    config_path = _runtime_config_path()
    try:
        if config_path.exists():
            config_path.unlink()
            logger.debug("failure_simulation: removed runtime config %s", config_path)
    except OSError as e:
        logger.warning("failure_simulation: could not remove runtime config: %s", e)


# ── Initialize ────────────────────────────────────────────────────────────────

# Load any existing runtime config on import
_load_runtime_config()
